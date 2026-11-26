import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { registerFighter } from '../fighters/registry';
import type { InputFrame } from '../input/types';
import { isIntangible } from './actions/registry';
import { knockback } from './combat/formulas';
import { spawnEntity } from './entities/entities';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import { FINAL_SMASH } from './finalSmash';
import { SMASH_BALL } from './items/spawn';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from './match';
import { decodeReplay, encodeReplay } from './replay';
import {
  finalBlast,
  finalCinematic,
  finalDirectTester,
  finalTrap,
  finalTrapTester,
  noFinalTester,
} from './testing/finalSmash';
import { counterTesterMarth, marthCounter } from './testing/counter';
import { input, type Hold } from './testing/sim';

const DIRECT = finalDirectTester.id;
const TRAP = finalTrapTester.id;
const NONE = noFinalTester.id;
registerFighter(counterTesterMarth);
const FREEZE = FINAL_SMASH.freeze;
const SPECIAL: Hold = { buttons: ['special'] };

function config(fighters: string[], items = false): MatchConfig {
  return { seed: 1, stage: 'battlefield', stocks: 3, items, ports: fighters.map((fighter) => ({ fighter })) };
}

/** Everyone standing on Battlefield's main stage at `xs`, facing the middle, after the match has settled. */
function match(fighters: string[], xs: number[], items = false): MatchState {
  const m = createMatch(config(fighters, items));
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: x <= 0 ? 1 : -1, intangible: 0 });
  });
  step(m, 30);
  for (const f of m.fighters) expect(f.action).toBe('idle');
  return m;
}

/** Step `frames` frames, port i holding holds[i]; returns every event. */
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

const where = (f: FighterState) => ({ x: f.pos.x, y: f.pos.y, action: f.action, frame: f.actionFrame });

describe('Final Smash activation', () => {
  it('neutral special with the charge plays the Final Smash on the ground, spends the charge and reports it', () => {
    const m = match([DIRECT, NONE], [-30, 30]);
    const a = m.fighters[0]!;
    a.finalReady = true;
    const seen = step(m, 1, [SPECIAL]);
    expect([a.action, a.move, a.actionFrame, a.finalReady]).toEqual(['attack', 'finalSmash', 1, false]);
    const mine = seen.filter((e) => e.type === 'move' || e.type === 'finalSmash');
    expect(mine).toEqual([
      { type: 'move', port: 0, move: 'finalSmash' },
      { type: 'finalSmash', port: 0, move: 'finalSmash', freeze: FREEZE, x: -30, y: a.pos.y + 7.5 },
    ]);
    step(m, finalBlast.faf - 1);
    expect(a.action).toBe('idle');
    step(m, 1, [SPECIAL]);
    expect(a.move).toBe('neutralB');
  });

  it('works in the air, out of a jump, and a still one stops the user and holds it there', () => {
    const m = match([DIRECT, NONE], [-30, 30]);
    const a = m.fighters[0]!;
    a.finalReady = true;
    step(m, 12, [{ x: 100, buttons: ['jump'] }]);
    expect([a.action, a.ground]).toEqual(['jump', null]);
    expect(a.vel.x).toBeGreaterThan(0);
    expect(a.vel.y).toBeGreaterThan(0);
    step(m, 1, [SPECIAL]);
    expect([a.action, a.move, a.finalReady, a.vel, a.kb]).toEqual([
      'aerial',
      'finalSmash',
      false,
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    const at = { ...a.pos };
    for (let i = 2; i < finalBlast.faf; i++) {
      step(m, 1, [{ x: 100, y: -100 }]);
      expect([a.move, a.pos.x, a.pos.y]).toEqual(['finalSmash', at.x, at.y]);
    }
    step(m, 2);
    expect(a.action).toBe('fall');
    expect(a.pos.y).toBeLessThan(at.y);
  });

  it('comes out of a dash, a run, a crouch and a fall, the states a special starts from', () => {
    const states: [string, Hold[]][] = [
      ['dash', [{ x: 100 }]],
      ['run', Array.from({ length: 20 }, () => ({ x: 100 }))],
      ['crouch', Array.from({ length: 4 }, () => ({ y: -100 }))],
    ];
    for (const [action, holds] of states) {
      const m = match([DIRECT, NONE], [-60, 60]);
      const a = m.fighters[0]!;
      a.finalReady = true;
      for (const h of holds) step(m, 1, [h]);
      expect(a.action).toBe(action);
      step(m, 1, [SPECIAL]);
      expect([action, a.move, a.finalReady]).toEqual([action, 'finalSmash', false]);
    }
  });

  it('needs the charge and neutral special: without the charge, or with a side special, specials stay specials', () => {
    const m = match([DIRECT, NONE], [-30, 30]);
    const a = m.fighters[0]!;
    step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['neutralB', false]);
    step(m, 40);
    a.finalReady = true;
    const seen = step(m, 1, [{ x: 100, buttons: ['special'] }]);
    expect([a.move, a.finalReady]).toEqual(['sideB', true]);
    expect(seen.some((e) => e.type === 'finalSmash')).toBe(false);
  });

  it('keeps the charge for a fighter without a Final Smash: neutral special is its special', () => {
    const m = match([NONE, DIRECT], [-30, 30]);
    const a = m.fighters[0]!;
    a.finalReady = true;
    const seen = step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['neutralB', true]);
    expect(seen.some((e) => e.type === 'finalSmash')).toBe(false);
  });

  it('spends the charge, so the Coolmath Planet lockout starts on the activation frame (Items on)', () => {
    const m = match([DIRECT, NONE], [-30, 30], true);
    const a = m.fighters[0]!;
    a.finalReady = true;
    step(m, 2);
    expect(m.items.planetInPlay).toBe(true);
    step(m, 1, [SPECIAL]);
    expect(a.finalReady).toBe(false);
    expect([m.items.planetInPlay, m.items.lockout]).toEqual([false, SMASH_BALL.lockout]);
  });
});

describe('Final Smash rules', () => {
  it('makes the user intangible on every frame, a cinematic included, so attacks pass through it', () => {
    for (const [fighter, frames] of [
      [DIRECT, finalBlast.faf - 1],
      [TRAP, finalTrap.hits[0]!.frames[0] + finalCinematic.faf - 1],
    ] as const) {
      const m = match([fighter, NONE], [-10, 2]);
      const [a, v] = m.fighters as [FighterState, FighterState];
      a.finalReady = true;
      step(m, 1, [SPECIAL]);
      const hits: SimEvent[] = [];
      let i = 0;
      for (; i < 600 && a.move !== null; i++) {
        expect(isIntangible(a)).toBe(true);
        hits.push(...step(m, 1, [{}, { buttons: i % 2 ? ['attack'] : [] }]).filter((e) => e.type === 'hit'));
      }
      expect(i).toBeGreaterThanOrEqual(frames);
      expect(hits.filter((e) => e.type === 'hit' && e.victim === a.port)).toEqual([]);
      expect(v.damage).toBeGreaterThan(0);
      expect(isIntangible(a)).toBe(false);
    }
  });

  it('holds everyone and everything else still for the activation freeze, then a direct one lets them move', () => {
    const m = match([DIRECT, NONE, NONE], [-60, 40, 70]);
    const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
    const walk: Hold = { x: -50 };
    step(m, 5, [{}, walk, { buttons: ['jump'] }]);
    const ball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 1,
      pos: { x: 0, y: 20 },
      vel: { x: 1, y: 0 },
    });
    step(m, 2, [{}, walk, {}]);
    a.finalReady = true;
    step(m, 1, [SPECIAL, walk, {}]);
    const held = { v: where(v), w: where(w), ball: { ...ball.pos, age: ball.age } };
    for (let i = 0; i < FREEZE; i++) {
      step(m, 1, [{}, walk, { buttons: ['jump'] }]);
      expect({ v: where(v), w: where(w), ball: { ...ball.pos, age: ball.age } }).toEqual(held);
      expect(a.actionFrame).toBe(i + 2);
    }
    step(m, 1, [{}, walk, {}]);
    expect(v.pos.x).toBeLessThan(held.v.x);
    expect(w.pos.y).not.toBe(held.w.y);
    expect(ball.age).toBe(held.ball.age + 1);
    for (let i = 0; i < 10; i++) {
      const x = v.pos.x;
      step(m, 1, [{}, walk, {}]);
      expect(v.pos.x).toBeLessThan(x);
    }
  });

  it('lands a direct hit with its own damage and launch, straight through a shield', () => {
    const m = match([DIRECT, NONE], [-30, 0]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    const shield: Hold = { buttons: ['shield'] };
    step(m, 5, [{}, shield]);
    expect(v.action).toBe('shield');
    a.finalReady = true;
    step(m, 1, [SPECIAL, shield]);
    const [from] = finalBlast.hits[0]!.frames;
    const before = step(m, from - 2, [{}, shield]);
    expect(before.some((e) => e.type === 'hit' || e.type === 'shieldHit')).toBe(false);
    expect(v.damage).toBe(0);
    const seen = step(m, 1, [{}, shield]);
    expect(a.actionFrame).toBe(from);
    const box = finalBlast.hits[0]!.boxes[1]!;
    expect(seen.filter((e) => e.type === 'shieldHit' || e.type === 'parry')).toEqual([]);
    expect(seen.filter((e) => e.type === 'hit')).toEqual([
      expect.objectContaining({ attacker: 0, victim: 1, move: 'finalSmash' }),
    ]);
    expect(v.damage).toBeCloseTo(30 * 1.05 * 1.2, 6);
    const kb = knockback({
      percent: 0,
      damage: box.damage,
      kbg: box.kbg,
      bkb: box.bkb,
      weight: noFinalTester.stats.weight,
      stale: 1.05,
      rage: 1,
    });
    expect(v.launch).toEqual({ kb, angle: box.angle, dir: 1, setKnockback: false });
    expect(v.action).toBe('tumble');
    step(m, 60);
    expect(v.pos.x).toBeGreaterThan(40);
    expect(v.pos.y).toBeGreaterThan(20);
  });

  it('goes through an open counter: unblockable attacks cannot be countered (SmashWiki, Counterattack)', () => {
    const m = match([DIRECT, counterTesterMarth.id], [-30, 0]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    const [open, close] = marthCounter.counter!.window;
    const [from, to] = finalBlast.hits[0]!.frames;
    // The counterer is held through the freeze, so it counters first: its window is open when the blast comes out.
    step(m, 1, [{}, { y: -100, buttons: ['special'] }]);
    expect([v.move, v.actionFrame]).toEqual(['downB', 1]);
    step(m, open - 2);
    a.finalReady = true;
    step(m, 1, [SPECIAL]);
    const seen = step(m, from - 2);
    expect([a.actionFrame, v.move]).toEqual([from - 1, 'downB']);
    expect(v.actionFrame).toBeGreaterThanOrEqual(open);
    expect(v.actionFrame).toBeLessThan(close);
    seen.push(...step(m, to - from + 1));
    expect(seen.filter((e) => e.type === 'counter')).toEqual([]);
    expect(seen.filter((e) => e.type === 'hit')).toEqual([
      expect.objectContaining({ attacker: 0, victim: 1 }),
    ]);
    expect(v.action).toBe('tumble');
  });

  it('traps the first fighter its reach catches, holds everyone else still through the cinematic, then launches it', () => {
    const m = match([TRAP, NONE, NONE], [-30, -16, 60]);
    const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
    a.finalReady = true;
    step(m, 1, [SPECIAL]);
    const [from] = finalTrap.hits[0]!.frames;
    let seen = step(m, from - 2, [{}, {}, { x: -60 }]);
    expect(seen.some((e) => e.type === 'commandGrab')).toBe(false);
    seen = step(m, 1, [{}, {}, { x: -60 }]);
    expect(seen.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
    ]);
    expect([a.action, a.move, v.action]).toEqual(['grabThrow', 'finalSmashCinematic', 'grabbed']);
    const held = where(w);
    const damage: number[] = [];
    const release = finalCinematic.throw!.frame;
    for (let i = 0; i < 400 && a.grabPartner >= 0; i++) {
      const before = v.damage;
      step(m, 1, [{}, { x: 100, buttons: i % 2 ? ['attack', 'jump'] : [] }, { x: -60, buttons: ['attack'] }]);
      if (v.damage !== before) damage.push(v.damage);
      if (a.grabPartner >= 0) expect(where(w)).toEqual(held);
    }
    // Three fighters: no 1v1 multiplier. Three 8% hold hits, then the release lands fresh (x1.05).
    expect(damage).toEqual([8, 16, 24, expect.closeTo(24 + 16 * 1.05, 6)]);
    expect(a.actionFrame).toBe(release);
    const hit = finalCinematic.throw!.hit;
    const kb = knockback({
      percent: 24,
      damage: hit.damage,
      kbg: hit.kbg,
      bkb: hit.bkb,
      weight: noFinalTester.stats.weight,
      stale: 1.05,
      rage: 1,
    });
    expect(v.launch).toEqual({ kb, angle: hit.angle, dir: 1, setKnockback: false });
    step(m, 1, [{}, {}, { x: -60 }]);
    expect(w.pos.x).toBeLessThan(held.x);
    step(m, 30);
    expect(v.pos.y).toBeGreaterThan(10);
    step(m, finalCinematic.faf);
    expect([a.action, isIntangible(a)]).toEqual(['idle', false]);
  });

  it('catches only the nearest of two fighters in reach; the other holds still until the release', () => {
    const m = match([TRAP, NONE, NONE], [-30, -12, -20]);
    const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
    a.finalReady = true;
    step(m, 1, [SPECIAL]);
    step(m, finalTrap.hits[0]!.frames[1]);
    expect([w.action, v.action]).toEqual(['grabbed', 'idle']);
    expect(a.grabPartner).toBe(w.port);
    const held = where(v);
    step(m, 30, [{}, { x: -100 }]);
    expect(where(v)).toEqual(held);
  });

  it('plays the whole trap move and frees everyone after the freeze when it catches nobody', () => {
    const m = match([TRAP, NONE], [-60, 60]);
    const [a, v] = m.fighters as [FighterState, FighterState];
    a.finalReady = true;
    step(m, 1, [SPECIAL]);
    step(m, FREEZE);
    expect(a.actionFrame).toBe(FREEZE + 1);
    const x = v.pos.x;
    step(m, 10, [{}, { x: -100 }]);
    expect(v.pos.x).toBeLessThan(x);
    step(m, finalTrap.faf - FREEZE - 12);
    expect([a.action, a.move, a.actionFrame]).toEqual(['attack', 'finalSmash', finalTrap.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
  });
});

describe('Final Smash determinism', () => {
  it('replays: the recorded inputs from the same start reproduce every frame, trap and freezes included', () => {
    // Breaking a planet takes thousands of frames, so both runs start with the charges already held.
    const start = () => {
      const m = match([DIRECT, TRAP, NONE], [-60, -30, -16], true);
      m.fighters[0]!.finalReady = true;
      m.fighters[1]!.finalReady = true;
      return m;
    };
    const script = (frame: number, port: number): Hold => {
      if (port !== 0 && frame <= 5) return port === 1 && frame === 5 ? SPECIAL : {};
      if (port === 0 && frame === 300) return SPECIAL;
      if (port === 0) return frame < 280 ? { x: frame % 120 < 60 ? 40 : -40 } : {};
      return { x: ((frame * 7 + port * 31) % 200) - 100, buttons: frame % 3 ? [] : ['attack'] };
    };
    const live = start();
    const frames: InputFrame[][] = [];
    const hashes: string[] = [];
    const events: SimEvent[] = [];
    for (let frame = 0; frame < 900; frame++) {
      const inputs = live.players.map((p) => input(script(frame, p.port)));
      frames.push(inputs);
      stepMatch(live, inputs);
      events.push(...live.events);
      hashes.push(hashState(live));
    }
    const ports = (type: string) => events.flatMap((e) => (e.type === type && 'port' in e ? [e.port] : []));
    expect(ports('finalSmash')).toEqual([1, 0]);
    expect(events.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 1, victim: 2, move: 'finalSmash' },
    ]);
    const replay = decodeReplay(
      encodeReplay({ version: 1, config: config([DIRECT, TRAP, NONE], true), frames }),
    );
    const again = start();
    const replayed = replay.frames.map((inputs) => {
      stepMatch(again, inputs);
      return hashState(again);
    });
    expect(replayed).toEqual(hashes);
  });
});
