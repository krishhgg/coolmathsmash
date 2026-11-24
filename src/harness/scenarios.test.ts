import { describe, expect, it } from 'vitest';
import { getFighter, registerFighter } from '../fighters/registry';
import { createMatch } from '../sim/match';
import {
  FIGHTER_STATES,
  SCENARIOS,
  applyPatch,
  fighterScenarios,
  findScenario,
  isLabScenario,
  planScenario,
  scenarioConfig,
  scenarioInfo,
  scenarioInputs,
  startScenario,
  type FighterScenarios,
  type GameScenario,
} from './scenarios';
import { stepMatch } from '../sim/match';

const game = (name: string) => {
  const s = findScenario(name);
  if (isLabScenario(s)) throw new Error(`${name} is a lab scenario`);
  return s;
};

/** Run a scenario's setup and script on a bare simulation up to `frame`. */
function runTo(s: GameScenario, frame: number) {
  const m = createMatch(scenarioConfig(s));
  startScenario(m, s);
  while (m.frame < frame) stepMatch(m, scenarioInputs(s, m));
  return m;
}

describe('capture scenarios', () => {
  it('have unique names and JSON-safe descriptions', () => {
    const names = SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of [
      'idle',
      'run',
      'jump-apex',
      'attack-active',
      'launch-high-percent',
      'shield',
      'ledge-hang',
      'hud',
      'stage',
      'fighter-sheet',
    ]) {
      expect(names).toContain(name);
    }
    const info = SCENARIOS.map(scenarioInfo);
    expect(JSON.parse(JSON.stringify(info))).toEqual(info);
  });

  it('captures idle at a fixed frame with both fighters standing', () => {
    const s = game('idle');
    expect(planScenario(s)).toEqual({ status: 'captured', captureFrame: 60 });
    expect(runTo(s, 60).fighters.map((f) => f.action)).toEqual(['idle', 'idle']);
  });

  it('captures run once P1 is 12 frames into its run', () => {
    const s = game('run');
    const plan = planScenario(s);
    expect(plan.status).toBe('captured');
    const f = runTo(s, plan.captureFrame!).fighters[0]!;
    expect(f.action).toBe('run');
    expect(f.actionFrame).toBe(12);
  });

  it('captures the jump apex on the frame vertical speed turns downward', () => {
    const s = game('jump-apex');
    const plan = planScenario(s);
    expect(plan.status).toBe('captured');
    const before = runTo(s, plan.captureFrame! - 1).fighters[0]!;
    const apex = runTo(s, plan.captureFrame!).fighters[0]!;
    expect(before.vel.y).toBeGreaterThan(0);
    expect(apex.vel.y).toBeLessThanOrEqual(0);
    expect(apex.ground).toBeNull();
    expect(apex.pos.y).toBeGreaterThan(25);
  });

  it('captures shield and ledge hang', () => {
    expect(runTo(game('shield'), 40).fighters[0]!.action).toBe('shield');
    const ledge = game('ledge-hang');
    const plan = planScenario(ledge);
    expect(plan.status).toBe('captured');
    const f = runTo(ledge, plan.captureFrame!).fighters[0]!;
    expect(f.action).toBe('ledgeHang');
    expect(f.actionFrame).toBe(10);
  });

  it('reports combat scenarios as pending until the moves exist, and captures them after', () => {
    for (const name of ['attack-active', 'launch-high-percent']) {
      const plan = planScenario(game(name));
      if (plan.status === 'pending') expect(plan.reason).toMatch(/needs move 'fsmash'/);
      else expect(plan.status).toBe('captured');
    }
  });

  it('asks the host about requirements the simulation cannot answer', () => {
    const hud = game('hud');
    expect(planScenario(hud, () => false)).toEqual({ status: 'pending', reason: 'needs the in-match HUD' });
    expect(planScenario(hud, (req) => req === 'hud')).toEqual({ status: 'captured', captureFrame: 60 });
  });

  it('names unknown actions and reports missed captures with the final actions', () => {
    const base: GameScenario = { name: 't', description: '', page: { kind: 'game' }, capture: { frame: 5 } };
    expect(planScenario({ ...base, requires: ['action:nope'] })).toEqual({
      status: 'pending',
      reason: "needs action 'nope'",
    });
    const never = planScenario({ ...base, capture: { label: 'never', when: () => false, limit: 30 } });
    expect(never.status).toBe('missed');
    expect(never.reason).toBe('"never" not reached by frame 30 (ended with P1 idle, P2 idle)');
  });
});

describe('fighter scenarios (src/fighters/<id>/scenarios.ts)', () => {
  const spec: FighterScenarios = { fighter: 'redball', refs: { run: ['smash/run-*'] } };

  it('give a fighter its own copy of every standard state against Fireboy, with its references', () => {
    const list = fighterScenarios(spec);
    expect(list.map((s) => s.name)).toEqual(
      FIGHTER_STATES.filter((n) => n !== 'sheet').map((n) => `redball-${n}`),
    );
    const run = list.find((s) => s.name === 'redball-run')!;
    expect(run.refs).toEqual(['smash/run-*']);
    if (isLabScenario(run)) throw new Error('run is a game scenario');
    expect(scenarioConfig(run).ports.map((p) => p.fighter)).toEqual(['redball', 'fireboy']);
  });

  it('add the rig sheet once the fighter has art', () => {
    registerFighter({ ...getFighter('redball'), id: 'redball-drawn', art: {} });
    const sheet = fighterScenarios({ fighter: 'redball-drawn', refs: {} }).find(
      (s) => s.name === 'redball-drawn-sheet',
    );
    expect(sheet?.page).toEqual({ kind: 'lab', scene: 'fighter', params: { fighter: 'redball-drawn' } });
  });

  it('are discovered and appended after the shared states', () => {
    const names = SCENARIOS.map((s) => s.name);
    expect(names.indexOf('redball-idle')).toBeGreaterThan(names.indexOf('fighter-sheet'));
    expect(names).toContain('redball-dair-bounce');
  });

  it.each(SCENARIOS.filter((s) => !isLabScenario(s)).map((s) => [s.name, s] as const))(
    '%s reaches its capture frame or names what it is waiting for',
    (_, s) => {
      const plan = planScenario(s as GameScenario, () => true);
      expect(plan.status, plan.reason).not.toBe('missed');
    },
  );
});

describe('applyPatch', () => {
  it('merges vectors, replaces the rest and keeps prevPos with pos', () => {
    const f = createMatch().fighters[0]!;
    applyPatch(f, { pos: { x: 12 }, damage: 150, ground: null });
    expect(f.pos.x).toBe(12);
    expect(f.pos.y).toBeCloseTo(0.001);
    expect(f.prevPos).toEqual(f.pos);
    expect(f.damage).toBe(150);
    applyPatch(f, { vel: { y: 3 } });
    expect(f.vel).toEqual({ x: 0, y: 3 });
  });
});
