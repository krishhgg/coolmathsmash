import { describe, expect, it } from 'vitest';
import { neutralInput } from '../../input/types';
import { createCpu } from '../../ai';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { art } from './art';
import { MAX_UPGRADE, MAX_UPGRADE_RANGE, OMNISLASH, finalSmash, finalSmashCinematic } from './finalSmash';
import { moves } from './moves';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };
const { dash, box, holds } = MAX_UPGRADE;
const { damage } = OMNISLASH;

/** Hits 1-18 of Omnislash, then the explosion, in SmashWiki's order. */
const HITS = [
  damage.catch,
  damage.tackle,
  ...Array<number>(OMNISLASH.barrageHits).fill(damage.barrage),
  damage.charge,
  damage.fall,
  damage.explosion,
];
const HELD = HITS.slice(0, -1).reduce((a, b) => a + b, 0);

function step(m: MatchState, frames: number, holds: Hold[] = []): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < frames; i++) {
    stepMatch(
      m,
      m.players.map((p) => input(holds[p.port])),
    );
    seen.push(...m.events);
  }
  return seen;
}

/**
 * Johnny at `at` facing right, a Mario-weight target at `target` facing him on `percent`, and a third Mario at
 * `bystander` (three players: no 1v1 damage multiplier), all settled on Battlefield. Returns with Johnny holding the
 * charge, before the press.
 */
function setup(
  at: number,
  target: number,
  bystander: number,
  percent = 0,
): { m: MatchState; a: FighterState; v: FighterState; b: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'johnny' }, { fighter: marioReference.id }, { fighter: marioReference.id }],
  });
  const xs = [at, target, bystander];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: x > at ? -1 : 1 });
  });
  step(m, 30);
  const [a, v, b] = m.fighters as [FighterState, FighterState, FighterState];
  v.damage = percent;
  a.finalReady = true;
  return { m, a, v, b };
}

/** Press neutral special, then step until the catch (or `limit` frames); the catch's frame of the dash, or null. */
function dashIn(m: MatchState, limit = MAX_UPGRADE.faf): number | null {
  const a = m.fighters[0]!;
  step(m, 1, [SPECIAL]);
  for (let i = 1; i < limit; i++) {
    const frame = a.actionFrame;
    if (step(m, 1).some((e) => e.type === 'commandGrab')) return frame + 1;
  }
  return null;
}

describe('Max Upgrade (Final Smash), on Omnislash', () => {
  it('starts from neutral special with the charge: a jet dash with the trap box out on 42-65, actionable on 96', () => {
    const { m, a } = setup(-60, 70, -78);
    step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    expect(finalSmash.final).toEqual({ still: true, range: MAX_UPGRADE_RANGE });
    expect(finalSmash.commandGrab).toBe('finalSmashCinematic');
    // The first frame the framework lets anything out: the freeze holds the others on frames 2 to 41.
    expect(dash.from).toBe(FINAL_SMASH.freeze + 2);
    expect(finalSmash.hits).toEqual([
      {
        frames: [42, 65],
        boxes: [{ id: 0, x: 7, y: 9, radius: 6, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
      },
    ]);
    const x0 = a.pos.x;
    step(m, dash.from - 2);
    expect([a.actionFrame, a.pos.x]).toEqual([dash.from - 1, x0]);
    step(m, dash.to - dash.from + 1);
    // 24 frames at 3.6 a frame, less the ground's 0.08 friction each frame.
    expect(a.pos.x - x0).toBeCloseTo(24 * (3.6 - 0.08), 6);
    step(m, MAX_UPGRADE.faf - 1 - dash.to);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', MAX_UPGRADE.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it("deals Omnislash's 19 hits: 1, 3, fourteen 2.2s, 5, 4 and the 10% explosion, 53.8% in all", () => {
    const cine = finalSmashCinematic;
    expect(cine.final).toEqual({ still: true });
    expect(cine.holdHits!.map((h) => h.damage)).toEqual(HITS.slice(0, -1));
    expect(cine.holdHits!.map((h) => h.frame)).toEqual([
      holds.catch,
      holds.tackle,
      ...Array.from({ length: 14 }, (_, i) => 24 + 6 * i),
      holds.charge,
      holds.fall,
    ]);
    expect(cine.throw).toEqual({
      frame: 142,
      hit: { damage: 10, angle: 45, bkb: 85, kbg: 100 },
    });
    expect([cine.faf, cine.hits]).toEqual([172, []]);
    expect(HITS.reduce((a, b) => a + b, 0)).toBeCloseTo(OMNISLASH.total, 9);
  });

  it('catches a Mario standing 30 units ahead, holds everyone else still, and deals 53.8% within 5 points', () => {
    const { m, a, v, b } = setup(-60, -30, -78);
    const caught = dashIn(m);
    expect(caught).not.toBe(null);
    expect([a.action, a.move, v.action, v.grabPartner]).toEqual([
      'grabThrow',
      'finalSmashCinematic',
      'grabbed',
      0,
    ]);
    const bystander = { ...b.pos };
    const seen: SimEvent[] = [];
    let held = 0;
    for (let i = 0; i < 400 && a.grabPartner >= 0; i++) {
      seen.push(...step(m, 1));
      if (m.finalHold?.fighters.includes(b.port)) held++;
      expect(b.pos).toEqual(bystander);
    }
    expect(a.grabPartner).toBe(-1);
    // Every frame of the cinematic until the release, hitlag included.
    expect(held).toBeGreaterThanOrEqual(MAX_UPGRADE.release);
    const landed = seen.flatMap((e) => (e.type === 'pummel' && e.victim === v.port ? [e.damage] : []));
    expect(landed).toHaveLength(18);
    landed.forEach((d, i) => expect(d, `hit ${i + 1}`).toBeCloseTo(HITS[i]!, 9));
    expect(seen.filter((e) => e.type === 'throw')).toEqual([
      expect.objectContaining({ attacker: 0, victim: 1, move: 'finalSmashCinematic' }),
    ]);
    // Hold hits land at their face value; the release is fresh (x1.05).
    expect(v.damage).toBeCloseTo(HELD + damage.explosion * 1.05, 6);
    expect(Math.abs(v.damage - OMNISLASH.total)).toBeLessThanOrEqual(5);
    expect(b.damage).toBe(0);
  });

  it('reaches as far as the dash flies plus the box: a Mario 96 units ahead is caught, one 110 ahead is not', () => {
    const reach = 24 * (dash.speed - 0.08) + box.x + box.radius;
    expect(reach).toBeLessThanOrEqual(MAX_UPGRADE_RANGE);
    const near = setup(-80, 16, -95);
    expect(dashIn(near.m)).not.toBe(null);
    const far = setup(-80, 30, -95);
    expect(dashIn(far.m)).toBe(null);
    step(far.m, 30);
    expect([far.v.damage, far.v.action]).toEqual([0, 'idle']);
  });

  it('leaves foes outside the box untouched: behind him, and on the platform above the dash', () => {
    const { m, a, v, b } = setup(-40, -70, -60);
    // The target behind him; the bystander on the left platform (top at y 24.1), over the dash's path.
    Object.assign(b, { pos: { x: -30, y: 30 }, prevPos: { x: -30, y: 30 }, ground: null, action: 'fall' });
    step(m, 30);
    expect(b.ground).not.toBe(null);
    a.finalReady = true;
    const seen: SimEvent[] = [];
    seen.push(...step(m, 1, [SPECIAL]));
    seen.push(...step(m, MAX_UPGRADE.faf));
    expect(seen.filter((e) => e.type === 'commandGrab' || e.type === 'pummel' || e.type === 'hit')).toEqual(
      [],
    );
    expect([v.damage, b.damage, a.action]).toEqual([0, 0, 'idle']);
  });

  it('catches through a shield: the trap is a command grab', () => {
    const { m, v } = setup(-60, -30, -78);
    step(m, 1, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    step(m, 1, [SPECIAL, { buttons: ['shield'] }]);
    let caught = false;
    for (let i = 0; i < MAX_UPGRADE.faf && !caught; i++)
      caught = step(m, 1, [{}, { buttons: ['shield'] }]).some((e) => e.type === 'commandGrab');
    expect([caught, v.action]).toEqual([true, 'grabbed']);
  });

  it('in the air holds still through the freeze, flies level through the dash, then falls', () => {
    const { m, a } = setup(-60, 70, -78);
    Object.assign(a, { pos: { x: -60, y: 80 }, prevPos: { x: -60, y: 80 }, ground: null, action: 'fall' });
    step(m, 1, [SPECIAL]);
    expect([a.move, a.action, a.vel]).toEqual(['finalSmash', 'aerial', { x: 0, y: 0 }]);
    const at = { ...a.pos };
    step(m, dash.from - 2);
    expect(a.pos).toEqual(at);
    step(m, dash.to - dash.from + 1);
    expect(a.pos.y).toBe(at.y);
    expect(a.pos.x - at.x).toBeCloseTo(24 * dash.speed, 6);
    step(m, MAX_UPGRADE.faf - 1 - dash.to);
    expect(a.pos.y).toBeLessThan(at.y - 5);
    expect([a.move, a.action]).toEqual(['finalSmash', 'aerial']);
    step(m, 1);
    expect(a.action).toBe('fall');
  });

  it('keeps a mid-air catch where it happened: Johnny and the trapped Mario hold still in the air', () => {
    const { m, a, v } = setup(-60, -30, -78);
    for (const [f, x] of [
      [a, -60],
      [v, -30],
    ] as const)
      Object.assign(f, { pos: { x, y: 40 }, prevPos: { x, y: 40 }, ground: null, action: 'fall' });
    a.finalReady = true;
    v.damage = 0;
    expect(dashIn(m)).not.toBe(null);
    const at = { ...a.pos };
    step(m, 60);
    expect([a.pos, a.action, v.action]).toEqual([at, 'grabThrow', 'grabbed']);
    expect(v.pos.y).toBe(at.y);
  });

  it('lets CPUs use it on anyone within 100 units in front, and catches them', () => {
    expect(finalReach('johnny')).toEqual({
      ahead: MAX_UPGRADE_RANGE,
      low: box.y - box.radius,
      high: box.y + box.radius,
    });
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'johnny' }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -40, 1],
      [opp, 40, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let used = -1;
    let caught = false;
    for (let i = 0; i < 120 && !caught; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) used = i;
      caught = m.events.some((e) => e.type === 'commandGrab' && e.attacker === 0);
    }
    expect(used).toBeGreaterThanOrEqual(0);
    expect(used).toBeLessThan(15);
    expect(caught).toBe(true);
  });

  it('has a clip for the dash and one for the cinematic on their frame data', () => {
    expect(moves.finalSmash).toBe(finalSmash);
    expect(moves.finalSmashCinematic).toBe(finalSmashCinematic);
    expect(art.clips.finalSmash?.length).toBe(MAX_UPGRADE.faf - 1);
    expect(art.clips.finalSmash?.active).toEqual([[dash.from, dash.to]]);
    expect(art.clips.finalSmashCinematic?.length).toBe(MAX_UPGRADE.cinematicFaf - 1);
    expect(art.clips.finalSmashCinematic?.active).toEqual([[MAX_UPGRADE.release, MAX_UPGRADE.release]]);
  });
});

describe('Max Upgrade kill percent (Mario at the Battlefield ledge, fresh, no rage, no DI)', () => {
  it("the release KOs within 5 points of Omnislash's 22%, less the 43.8% the hold hits add first", () => {
    const release = koPercent({ hit: { fighter: 'johnny', move: 'finalSmashCinematic' } })!;
    expect(HELD).toBeCloseTo(43.8, 9);
    expect(Math.abs(release - HELD - OMNISLASH.ko)).toBeLessThanOrEqual(5);
  });

  /**
   * Johnny dashes into a Mario at the right ledge on `percent`: whether the release KOs him before its hitstun ends
   * (the koPercent definition). The dash's first frame carries Johnny 3.52 units, to 70.42, and the trap holds Mario
   * 9.5 in front of him, at 79.92: where koPercent stands its target, 0.1 in from the ledge at 80.
   */
  function trapped(percent: number): boolean {
    const { m, a, v } = setup(66.9, 79, -60, percent);
    if (dashIn(m) !== dash.from) throw new Error('no catch on the first frame of the dash');
    expect(v.pos.x).toBeCloseTo(79.92, 6);
    let released = false;
    for (let i = 0; i < 600; i++) {
      const seen = step(m, 1);
      if (v.action === 'ko') return true;
      if (released && v.hitlag === 0 && v.hitstun <= 0) return false;
      released ||= seen.some((e) => e.type === 'throw') && a.grabPartner < 0;
    }
    throw new Error('no release');
  }

  it("the whole Final Smash KOs within 5 points of Omnislash's 22%", () => {
    let lo = 0;
    let hi = 100;
    expect(trapped(lo)).toBe(false);
    expect(trapped(hi)).toBe(true);
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      if (trapped(mid)) hi = mid;
      else lo = mid;
    }
    expect(Math.abs(hi - OMNISLASH.ko)).toBeLessThanOrEqual(5);
  }, 60_000);
});
