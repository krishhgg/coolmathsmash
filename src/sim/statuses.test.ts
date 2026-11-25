import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { registerFighter } from '../fighters/registry';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import { createMatch, type MatchState } from './match';
import { addMeter, meter, setMeter, spendMeter } from './meters';
import { applyStatus, clearStatus, hasStatus, statusOf } from './statuses';
import { attack, runPorts, type Hold } from './testing/sim';
import { testStatus } from './testing/statuses';

registerFighter(testStatus);

const FLOWER = 'test-status/flower';
const WARM = 'test-status/warm';

/**
 * The status fixture (P1) facing the Mario reference (P2) 10 units away on Battlefield, plus more Marios parked
 * out of the way: 2 players is 1v1, where damage taken counts x1.2.
 */
function versus(players = 2): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [
      { fighter: 'test-status' },
      ...Array.from({ length: players - 1 }, () => ({ fighter: 'reference-mario' })),
    ],
  });
  runPorts(m, 10, []);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const place = (f: FighterState, x: number) => {
    Object.assign(f, {
      pos: { x, y: a.pos.y },
      ground: a.ground,
      action: 'idle',
      actionFrame: 1,
      intangible: 0,
    });
    f.prevPos = { ...f.pos };
  };
  place(a, 0);
  a.facing = 1;
  place(v, 10);
  v.facing = -1;
  m.fighters.slice(2).forEach((f, i) => place(f, -60 + 10 * i));
  return { m, a, v };
}

/** Step until the frame's events include one of `type` (max 30 frames); returns every event seen on the way. */
function stepUntil(m: MatchState, type: SimEvent['type'], holds: Hold[] = []): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < 30; i++) {
    runPorts(m, 1, holds);
    seen.push(...m.events);
    if (m.events.some((e) => e.type === type)) return seen;
  }
  throw new Error(`no ${type} event in 30 frames`);
}

/** Land port 0's `move` on port 1; returns the % it added. */
function land(m: MatchState, v: FighterState, move: string): number {
  const before = v.damage;
  attack(m, 0, move);
  stepUntil(m, 'hit');
  return v.damage - before;
}

describe('statuses: applying', () => {
  it("a hit's status lasts floor(20 + 40 x the % it added), the flower's length (3 players, no 1v1 multiplier)", () => {
    const { m, v } = versus(3);
    attack(m, 0, 'jab');
    const events = stepUntil(m, 'hit');
    const added = 5 * 1.05; // fresh move bonus
    expect(v.damage).toBeCloseTo(added, 9);
    const start = events.find((e) => e.type === 'statusStart');
    expect(start).toEqual({ type: 'statusStart', port: 1, status: FLOWER, frames: 230, source: 0 });
    expect(statusOf(v, FLOWER)).toMatchObject({ frames: 230, age: 0, source: 0 });
  });

  it('counts the 1v1 multiplier in the damage, as Ultimate does for the flower', () => {
    const { m, v } = versus(2);
    const added = land(m, v, 'jab');
    expect(added).toBeCloseTo(5 * 1.05 * 1.2, 9);
    expect(statusOf(v, FLOWER)!.frames).toBe(Math.floor(20 + 40 * added)); // 272
  });

  it('does not go through a shield', () => {
    const { m, v } = versus(3);
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    attack(m, 0, 'jab');
    stepUntil(m, 'shieldHit', [{}, { buttons: ['shield'] }]);
    expect(v.statuses).toEqual([]);
  });

  it("a projectile's status credits its owner", () => {
    const { m, a, v } = versus(3);
    attack(m, 0, 'neutralB');
    const events = stepUntil(m, 'statusStart');
    expect(events.find((e) => e.type === 'hit')).toMatchObject({ attacker: 0, victim: 1 });
    expect(statusOf(v, FLOWER)).toMatchObject({ frames: Math.floor(20 + 40 * 3 * 1.05), source: 0 });
    expect(meter(a, 'ammo')).toBe(2);
  });

  it('a script can apply one, which starts ticking on the next frame like a hit', () => {
    const { m, a } = versus(3);
    attack(m, 0, 'downB');
    runPorts(m, 1, []);
    expect(statusOf(a, WARM)).toMatchObject({ frames: 90, age: 0, source: 0 });
    runPorts(m, 1, []);
    expect(statusOf(a, WARM)).toMatchObject({ frames: 89, age: 1 });
  });

  it('applying the flower again adds to it, up to 3000 frames, with no second statusStart', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, FLOWER, { damage: 5 });
    expect(statusOf(v, FLOWER)!.frames).toBe(220);
    m.events = [];
    applyStatus(m, v, FLOWER, { damage: 5 });
    expect(statusOf(v, FLOWER)!.frames).toBe(440);
    applyStatus(m, v, FLOWER, { damage: 100 });
    expect(statusOf(v, FLOWER)!.frames).toBe(3000);
    expect(m.events).toEqual([]);
  });

  it('a refreshing status takes the longer of what is left and its new length', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, WARM);
    runPorts(m, 51, []);
    expect(statusOf(v, WARM)!.frames).toBe(40);
    applyStatus(m, v, WARM);
    expect(statusOf(v, WARM)!.frames).toBe(90);
    applyStatus(m, v, WARM, { frames: 30 });
    expect(statusOf(v, WARM)!.frames).toBe(90);
  });

  it('a length under one frame applies nothing, and an unknown kind throws', () => {
    const { m, v } = versus(3);
    expect(applyStatus(m, v, FLOWER, { frames: 0 })).toBeNull();
    expect(v.statuses).toEqual([]);
    expect(() => applyStatus(m, v, 'test-status/nope')).toThrow(/unknown status/);
    expect(() => applyStatus(m, v, 'nope')).toThrow(/unknown status/);
  });
});

describe('statuses: ticking', () => {
  it('the flower deals 1% on every 21st frame and ends on exactly its last frame', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, FLOWER, { damage: 5 }); // 220 frames, 10 ticks
    runPorts(m, 1, []); // the frame it went on
    runPorts(m, 20, []);
    expect(v.damage).toBe(0);
    runPorts(m, 1, []);
    expect(v.damage).toBe(1);
    runPorts(m, 198, []);
    expect(statusOf(v, FLOWER)).toMatchObject({ frames: 1, age: 219 });
    expect(v.damage).toBe(10);
    runPorts(m, 1, []);
    expect(hasStatus(v, FLOWER)).toBe(false);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: FLOWER, reason: 'expired' });
    expect(v.damage).toBe(10);
  });

  it('hitlag pauses it: it ticks only on frames the fighter acts', () => {
    const { m, v } = versus(3);
    land(m, v, 'jab');
    expect(v.hitlag).toBeGreaterThan(0);
    const lag = v.hitlag;
    runPorts(m, lag, []);
    expect(v.hitlag).toBe(0);
    expect(statusOf(v, FLOWER)).toMatchObject({ frames: 230, age: 0 });
    runPorts(m, 1, []);
    expect(statusOf(v, FLOWER)).toMatchObject({ frames: 229, age: 1 });
  });

  it("mashing cuts the flower: 16 frames a new stick direction, 28.8 a button press (SmashWiki's values)", () => {
    const { m, v } = versus(3);
    applyStatus(m, v, FLOWER, { damage: 20 }); // 820 frames
    runPorts(m, 1, []);
    const left = () => statusOf(v, FLOWER)!.frames;
    expect(left()).toBe(820);
    runPorts(m, 1, [{}, { x: 100 }]);
    expect(left()).toBeCloseTo(820 - 1 - 16, 9);
    runPorts(m, 1, [{}, { x: 100 }]);
    expect(left()).toBeCloseTo(820 - 2 - 16, 9);
    runPorts(m, 1, [{}, { x: 100, buttons: ['special'] }]);
    expect(left()).toBeCloseTo(820 - 3 - 16 - 28.8, 9);
    runPorts(m, 1, [{}, { y: 100 }]);
    expect(left()).toBeCloseTo(820 - 4 - 32 - 28.8, 9);
  });

  it("a status's script runs on each of its frames", () => {
    const { m, a } = versus(3);
    applyStatus(m, a, WARM);
    runPorts(m, 11, []);
    // +1 heat a frame from the status, -0.5 from the meter's drain, for 10 frames (none on the frame it went on)
    expect(meter(a, 'heat')).toBeCloseTo(5, 9);
    runPorts(m, 80, []);
    expect(hasStatus(a, WARM)).toBe(false);
    expect(meter(a, 'heat')).toBeCloseTo(45, 9);
    runPorts(m, 200, []);
    expect(meter(a, 'heat')).toBe(0);
  });

  it('clearStatus takes it off early; a KO clears every status', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, WARM);
    clearStatus(m, v, WARM);
    expect(m.events.at(-1)).toEqual({ type: 'statusEnd', port: 1, status: WARM, reason: 'cleared' });
    applyStatus(m, v, WARM);
    applyStatus(m, v, FLOWER, { damage: 5 });
    Object.assign(v, { pos: { x: 400, y: 20 }, ground: null, action: 'fall' });
    runPorts(m, 1, []);
    expect(v.action).toBe('ko');
    expect(v.statuses).toEqual([]);
    const ends = m.events.filter((e) => e.type === 'statusEnd');
    expect(ends).toEqual([
      { type: 'statusEnd', port: 1, status: WARM, reason: 'ko' },
      { type: 'statusEnd', port: 1, status: FLOWER, reason: 'ko' },
    ]);
  });

  it('is deterministic: the same inputs give the same state, statuses and all', () => {
    const play = () => {
      const { m, v } = versus(3);
      land(m, v, 'jab');
      for (let i = 0; i < 120; i++)
        runPorts(m, 1, [{}, { x: i % 4 < 2 ? 100 : -100, buttons: i % 6 ? [] : ['attack'] }]);
      return hashState(m);
    };
    expect(play()).toBe(play());
  });
});

describe('meters', () => {
  it('start at their start values', () => {
    const { a } = versus(3);
    expect(a.meters).toEqual({ ammo: 3, heat: 0, hop: 1, coins: 0 });
  });

  it('spendMeter spends only what is there: three shots, then nothing', () => {
    const { m, a } = versus(3);
    for (let i = 0; i < 3; i++) {
      attack(m, 0, 'neutralB');
      runPorts(m, 20, []);
    }
    expect(meter(a, 'ammo')).toBe(0);
    const spawned = m.entities.length;
    attack(m, 0, 'neutralB');
    runPorts(m, 1, []);
    expect(m.entities.length).toBe(spawned);
    expect(spendMeter(a, 'ammo', 1)).toBe(false);
    expect(meter(a, 'ammo')).toBe(0);
  });

  it('setMeter and addMeter clamp to 0..max; an unknown meter throws', () => {
    const { a } = versus(3);
    expect(setMeter(a, 'coins', 120)).toBe(99);
    expect(addMeter(a, 'coins', -150)).toBe(0);
    expect(addMeter(a, 'coins', 2.5)).toBe(2.5);
    expect(() => meter(a, 'nope')).toThrow(/no meter "nope"/);
  });

  it('a grounded meter regenerates only on the ground: a count that refills on landing', () => {
    const { m, a } = versus(3);
    setMeter(a, 'hop', 0);
    Object.assign(a, {
      pos: { x: 0, y: 40 },
      prevPos: { x: 0, y: 40 },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: 0 },
    });
    runPorts(m, 5, []);
    expect(a.ground).toBeNull();
    expect(meter(a, 'hop')).toBe(0);
    while (!a.ground) runPorts(m, 1, []);
    runPorts(m, 1, []);
    expect(meter(a, 'hop')).toBe(1);
  });

  it('a KO resets meters to their start values, except those with onKo keep', () => {
    const { m, a } = versus(3);
    setMeter(a, 'ammo', 1);
    setMeter(a, 'coins', 7);
    Object.assign(a, { pos: { x: -400, y: 20 }, ground: null, action: 'fall' });
    runPorts(m, 1, []);
    expect(a.action).toBe('ko');
    expect(a.meters).toMatchObject({ ammo: 3, coins: 7 });
  });
});
