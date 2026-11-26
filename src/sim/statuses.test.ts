import { describe, expect, it } from 'vitest';
import { hashState } from '../engine/hash';
import { registerFighter } from '../fighters/registry';
import { defineFighter } from '../fighters/types';
import { registerStage } from '../stages/registry';
import { HITLAG, hitlagFrames, knockback } from './combat/formulas';
import { registerEntity, spawnEntity } from './entities/entities';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import { createMatch, type MatchState } from './match';
import { addMeter, meter, setMeter, spendMeter } from './meters';
import { applyStatus, clearStatus, hasStatus, statusOf } from './statuses';
import { marioReference } from './testing/reference';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from './testing/sim';
import { testStatus } from './testing/statuses';

registerFighter(testStatus);

const FLOWER = 'test-status/flower';
const CHARGED = 'test-status/charged';
const WARM = 'test-status/warm';
const STUN = 'test-status/stun';
const INK = 'test-status/ink';

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

describe('statuses: coats', () => {
  it("adds 12 a hit up to 300 and lasts 120 + level / 0.25 frames (Inkling's ink)", () => {
    const { m, v } = versus(3);
    land(m, v, 'utilt');
    expect(m.events).toContainEqual({ type: 'statusStart', port: 1, status: INK, frames: 168, source: 0 });
    expect(statusOf(v, INK)).toMatchObject({ level: 12, frames: 168, source: 0 });
    m.events = [];
    applyStatus(m, v, INK);
    expect(statusOf(v, INK)).toMatchObject({ level: 24, frames: 216 });
    applyStatus(m, v, INK, { level: 400 });
    expect(statusOf(v, INK)).toMatchObject({ level: 300, frames: 1320 });
    expect(m.events).toEqual([]);
  });

  it('holds its level for 120 frames after the last coat, then wears off 0.25 a frame and ends at 0', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, INK, { level: 180 });
    runPorts(m, 1, []); // the frame it went on
    runPorts(m, 120, []);
    expect(statusOf(v, INK)).toMatchObject({ level: 180, frames: 720 });
    runPorts(m, 1, []);
    expect(statusOf(v, INK)).toMatchObject({ level: 179.75, frames: 719 });
    runPorts(m, 360, []);
    expect(statusOf(v, INK)!.level).toBe(89.75);
    applyStatus(m, v, INK); // a new coat starts the hold again
    expect(statusOf(v, INK)).toMatchObject({ level: 101.75, frames: 527 });
    runPorts(m, 120, []);
    expect(statusOf(v, INK)!.level).toBe(101.75);
    runPorts(m, 406, []);
    expect(statusOf(v, INK)).toMatchObject({ level: 0.25, frames: 1 });
    runPorts(m, 1, []);
    expect(hasStatus(v, INK)).toBe(false);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: INK, reason: 'expired' });
  });

  it.each([
    [0, '1', 1],
    [12, '1.033', 1 + 12 / 360],
    [90, '1.25', 1.25],
    [180, '1.5', 1.5],
    [300, '1.5', 1.5],
  ])(
    "at %s units the fighter takes ink's 1 + level x 0.5 / 180 times the damage, at most 1.5 (x%s)",
    (level, _, mul) => {
      const { m, v } = versus(3);
      if (level) applyStatus(m, v, INK, { level });
      expect(land(m, v, 'ftilt')).toBeCloseTo(4 * 1.05 * mul, 9);
    },
  );

  it("doesn't change the hit's knockback, and multiplies every source of %, a status tick's included", () => {
    const kb = (level: number) => {
      const { m, v } = versus(3);
      if (level) applyStatus(m, v, INK, { level });
      land(m, v, 'ftilt');
      return v.launch!.kb;
    };
    expect(kb(180)).toBe(kb(0));
    const { m, v } = versus(3);
    applyStatus(m, v, INK, { level: 180 });
    applyStatus(m, v, FLOWER, { damage: 5 });
    runPorts(m, 22, []);
    expect(v.damage).toBe(1.5);
  });

  it('a KO clears it with the rest', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, INK, { level: 300 });
    Object.assign(v, { pos: { x: 400, y: 20 }, ground: null, action: 'fall' });
    runPorts(m, 1, []);
    expect(v.statuses).toEqual([]);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: INK, reason: 'ko' });
  });
});

describe('statuses: freezing', () => {
  /** The stun dtilt's knockback on the Mario reference at 0%: 4%, 30 base, 30 growth, fresh (x1.05). */
  const dtiltKb = (crouch = false) =>
    knockback({ percent: 0, damage: 4, kbg: 30, bkb: 30, weight: 98, stale: 1.05, crouch });

  it("lasts floor(1 + knockback x hitlag multiplier), Ultimate's paralysis, at most 90 frames", () => {
    const { m, v } = versus(3);
    land(m, v, 'dtilt');
    const frames = Math.floor(1 + dtiltKb() * 0.5);
    expect(frames).toBe(18);
    expect(statusOf(v, STUN)).toMatchObject({ frames, source: 0 });
    expect(m.events).toContainEqual({ type: 'statusStart', port: 1, status: STUN, frames, source: 0 });
    clearStatus(m, v, STUN);
    expect(applyStatus(m, v, STUN, { knockback: 200 })!.frames).toBe(90);
  });

  it('a crouch cancel shortens it as it does hitlag: knockback x0.85, then x0.67', () => {
    const { m, v } = versus(3);
    runPorts(m, 3, [{}, { y: -100 }]);
    expect(v.action).toBe('crouch');
    attack(m, 0, 'dtilt');
    stepUntil(m, 'hit', [{}, { y: -100 }]);
    expect(statusOf(v, STUN)!.frames).toBe(Math.floor(1 + dtiltKb(true) * 0.5 * HITLAG.crouch));
    expect(statusOf(v, STUN)!.frames).toBe(11);
  });

  it('freezes the fighter where it was hit through its hitlag and after, then the launch goes', () => {
    const { m, v } = versus(3);
    land(m, v, 'dtilt');
    expect(v.hitlag).toBe(hitlagFrames(4 * 1.05, { mult: 0.5 }));
    expect(v.hitlag).toBe(4);
    const at = { ...v.pos };
    const pending = v.launch;
    for (let i = 1; i <= 18; i++) {
      runPorts(m, 1, []);
      expect(v.pos, `frame ${i}`).toEqual(at);
      expect(v.launch, `frame ${i}`).toBe(pending);
      expect(v.actionFrame).toBe(0);
    }
    expect(hasStatus(v, STUN)).toBe(false);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: STUN, reason: 'expired' });
    runPorts(m, 1, []);
    expect(v.launch).toBeNull();
    expect(v.actionFrame).toBe(1);
    expect(v.pos).not.toEqual(at);
  });

  it('holds an airborne fighter in the air, then it falls', () => {
    const { m, v } = versus(3);
    const at = { x: 10, y: 30 };
    Object.assign(v, {
      pos: { ...at },
      prevPos: { ...at },
      ground: null,
      action: 'fall',
      vel: { x: 0, y: -1 },
    });
    applyStatus(m, v, STUN, { frames: 20 });
    runPorts(m, 1, []);
    expect(v.pos).toEqual({ x: 10, y: 29 }); // it went on during this frame: it starts on the next one
    runPorts(m, 20, []);
    expect(v.pos).toEqual({ x: 10, y: 29 });
    runPorts(m, 1, []);
    expect(v.pos.y).toBeLessThan(29);
  });

  it('mashing cuts it like any status', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, STUN, { frames: 60 });
    runPorts(m, 1, []);
    runPorts(m, 1, [{}, { x: 100 }]);
    expect(statusOf(v, STUN)!.frames).toBe(60 - 1 - 4);
    runPorts(m, 1, [{}, { x: -100, buttons: ['attack'] }]);
    expect(statusOf(v, STUN)!.frames).toBe(60 - 2 - 8 - 6);
  });

  it('pauses the other statuses, as hitlag does', () => {
    const { m, v } = versus(3);
    applyStatus(m, v, WARM);
    applyStatus(m, v, STUN, { frames: 10 });
    runPorts(m, 11, []);
    expect(statusOf(v, WARM)).toMatchObject({ frames: 90, age: 0 });
    runPorts(m, 1, []);
    expect(statusOf(v, WARM)).toMatchObject({ frames: 89, age: 1 });
  });

  it("a later hit ends it, and that hit's hitlag and launch take over", () => {
    const { m, v } = versus(3);
    land(m, v, 'dtilt');
    runPorts(m, 10, []);
    expect(statusOf(v, STUN)!.frames).toBe(8);
    const before = v.damage;
    const events = (land(m, v, 'jab'), m.events);
    expect(events).toContainEqual({ type: 'statusEnd', port: 1, status: STUN, reason: 'hit' });
    expect(hasStatus(v, STUN)).toBe(false);
    expect(hasStatus(v, FLOWER)).toBe(true);
    expect(v.hitlag).toBe(hitlagFrames(5 * 1.05));
    const kb = knockback({ percent: before, damage: 5, kbg: 30, bkb: 30, weight: 98, stale: 1.05 });
    expect(v.launch!.kb).toBeCloseTo(kb, 9);
    runPorts(m, v.hitlag, []);
    expect(v.launch).not.toBeNull();
    runPorts(m, 1, []);
    expect(v.launch).toBeNull();
  });

  it("a stunning hit on a stunned fighter ends the stun and doesn't stun it again", () => {
    const { m, v } = versus(3);
    land(m, v, 'dtilt');
    runPorts(m, 5, []);
    land(m, v, 'dtilt');
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: STUN, reason: 'hit' });
    expect(m.events.some((e) => e.type === 'statusStart')).toBe(false);
    expect(hasStatus(v, STUN)).toBe(false);
  });

  it('a stunning hit landing with a hit that ends the stun does not stun again, in either port order', () => {
    for (const stunFirst of [true, false]) {
      // The fixture on both sides of the stunned Mario (P2): P1 swings first, P3 second, on the same frame.
      const m = createMatch({
        seed: 1,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'test-status' }, { fighter: 'reference-mario' }, { fighter: 'test-status' }],
      });
      runPorts(m, 10, []);
      const [a, v, b] = m.fighters as [FighterState, FighterState, FighterState];
      for (const [f, x, facing] of [
        [a, 0, 1],
        [v, 10, -1],
        [b, 20, -1],
      ] as const) {
        Object.assign(f, {
          pos: { x, y: a.pos.y },
          ground: a.ground,
          action: 'idle',
          actionFrame: 1,
          facing,
        });
        f.prevPos = { ...f.pos };
      }
      applyStatus(m, v, STUN, { frames: 60 });
      runPorts(m, 2, []);
      attack(m, 0, stunFirst ? 'dtilt' : 'ftilt');
      attack(m, 2, stunFirst ? 'ftilt' : 'dtilt');
      const events = stepUntil(m, 'hit');
      const order = `stun ${stunFirst ? 'first' : 'second'}`;
      expect(
        events.filter((e) => e.type === 'hit').map((e) => (e as { attacker: number }).attacker),
        order,
      ).toEqual([0, 2]);
      expect(events, order).toContainEqual({ type: 'statusEnd', port: 1, status: STUN, reason: 'hit' });
      expect(
        events.some((e) => e.type === 'statusStart' && e.status === STUN),
        order,
      ).toBe(false);
      expect(hasStatus(v, STUN), order).toBe(false);
    }
  });

  it("can't be shoved: a fighter walking into a frozen one doesn't push it", () => {
    const { m, a, v } = versus(3);
    applyStatus(m, v, STUN, { frames: 60 });
    runPorts(m, 1, []);
    expect(v.hitlag).toBe(0);
    Object.assign(a, { pos: { x: v.pos.x - 5, y: v.pos.y } });
    a.prevPos = { ...a.pos };
    const at = { ...v.pos };
    for (let i = 0; i < 20; i++) {
      runPorts(m, 1, [{ x: 100 }, {}]);
      expect(v.pos, `frame ${i}`).toEqual(at);
    }
    expect(hasStatus(v, STUN)).toBe(true);
  });

  it('is still frozen on the frame it runs out: a fighter standing in it pushes it only on the frame it acts again', () => {
    const { m, a, v } = versus(3);
    const frames = 10;
    applyStatus(m, v, STUN, { frames });
    runPorts(m, 1, []);
    // P1 stands 5 units from the stunned Mario, 3 units inside it (their widths are 8).
    Object.assign(a, { pos: { x: v.pos.x - 5, y: v.pos.y } });
    a.prevPos = { ...a.pos };
    const at = { a: { ...a.pos }, v: { ...v.pos } };
    const held = v.actionFrame;
    for (let frame = 1; frame <= frames; frame++) {
      runPorts(m, 1, []);
      expect({ frame, a: a.pos, v: v.pos }).toEqual({ frame, ...at });
      expect({ frame, stunned: hasStatus(v, STUN) }).toEqual({ frame, stunned: frame < frames });
      expect({ frame, actionFrame: v.actionFrame }).toEqual({ frame, actionFrame: held });
    }
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: STUN, reason: 'expired' });
    // The frame after: Mario acts again, and the two push apart.
    runPorts(m, 1, []);
    expect(v.actionFrame).toBe(held + 1);
    expect(a.pos.x).toBeLessThan(at.a.x);
    expect(v.pos.x).toBeGreaterThan(at.v.x);
  });
});

/**
 * The Mario reference with heavy armor through two long moves, so a stunning hit freezes it mid-move instead of
 * launching it, as an armored fighter paralyzed mid-attack is: `swing`, a 10% box out in front on frames 3-40, and
 * `grab`, a grab box out on the same frames. `stunSelf` stuns itself for 10 frames from its script on frame 1.
 */
const FROZEN = 'test-frozen';
registerFighter(
  defineFighter({
    ...marioReference,
    id: FROZEN,
    name: 'Test: frozen mid-move',
    moves: {
      swing: {
        kind: 'other',
        faf: 60,
        armor: { frames: [1, 60] },
        hits: [
          {
            frames: [3, 40],
            boxes: [{ id: 0, x: 10, y: 8, radius: 6, damage: 10, angle: 45, kbg: 50, bkb: 30 }],
          },
        ],
      },
      grab: {
        kind: 'other',
        faf: 60,
        armor: { frames: [1, 60] },
        hits: [
          {
            frames: [3, 40],
            boxes: [{ id: 0, x: 9, y: 7, radius: 5, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
          },
        ],
      },
      stunSelf: {
        kind: 'other',
        faf: 30,
        hits: [],
        script: (x) => {
          if (x.f.actionFrame === 1) applyStatus(x.m, x.f, STUN, { frames: 10 });
        },
      },
    },
  }),
);
/** A hittable entity with no hitboxes of its own. */
const CRATE = 'test-frozen/crate';
registerEntity(CRATE, { floor: 'pass', wall: 'pass', radius: 3, hp: 100 });

describe('statuses: a frozen fighter acts on nothing', () => {
  /**
   * The stun fixture (P1) 10 units behind the armored fixture (P2), which faces away from it toward a Mario reference
   * (P3) 12 units in front, on Battlefield. P1's stun dtilt hits P2 on frame 3 of P2's `move`, whose box is out by
   * then; P3 is intangible until 7 frames after that hit, so nothing of P2's can reach it before.
   */
  function stunnedMidMove(move: string): {
    m: MatchState;
    a: FighterState;
    b: FighterState;
    lag: number;
    frames: number;
  } {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'test-status' }, { fighter: FROZEN }, { fighter: 'reference-mario' }],
    });
    runPorts(m, 10, []);
    const [s, a, b] = m.fighters as [FighterState, FighterState, FighterState];
    for (const [f, x, facing] of [
      [s, -10, 1],
      [a, 0, 1],
      [b, 12, -1],
    ] as const) {
      Object.assign(f, { pos: { x, y: s.pos.y }, ground: s.ground, action: 'idle', actionFrame: 1, facing });
      f.prevPos = { ...f.pos };
    }
    attack(m, 0, 'dtilt');
    attack(m, 1, move);
    b.intangible = 10;
    const events = stepUntil(m, 'hit');
    expect(events.filter((e) => e.type === 'hit')).toMatchObject([{ attacker: 0, victim: 1 }]);
    // Armored: still in its move, on frame 3, frozen for its hitlag and then the stun.
    expect([a.action, a.move, a.actionFrame]).toEqual(['attack', move, 3]);
    const lag = a.hitlag;
    const frames = statusOf(a, STUN)!.frames;
    expect([lag, frames]).toEqual([4, 18]);
    expect(b.intangible).toBe(7);
    return { m, a, b, lag, frames };
  }

  it('lands none of its hitboxes while frozen: its still-active box waits for the first frame it acts again', () => {
    const { m, a, frames } = stunnedMidMove('swing');
    const landed: number[] = [];
    const held: number[] = [];
    for (let frame = 1; frame <= frames + 1; frame++) {
      runPorts(m, 1, []);
      if (m.events.some((e) => e.type === 'hit' && e.attacker === 1 && e.victim === 2)) landed.push(frame);
      if (a.actionFrame === 3) held.push(frame);
    }
    expect(landed).toEqual([frames + 1]);
    // Its move holds on frame 3 through the hitlag and the stun, and goes on to frame 4 on the frame the box lands.
    expect(held).toEqual(Array.from({ length: frames }, (_, i) => i + 1));
    expect(a.actionFrame).toBe(4);
  });

  it('catches no one with its grab box while frozen, and grabs on the first frame it acts again', () => {
    const { m, a, b, frames } = stunnedMidMove('grab');
    const caught: number[] = [];
    for (let frame = 1; frame <= frames + 1; frame++) {
      runPorts(m, 1, []);
      if (m.events.some((e) => e.type === 'grab')) caught.push(frame);
    }
    expect(caught).toEqual([frames + 1]);
    expect([a.action, b.action]).toEqual(['grabHold', 'grabbed']);
  });

  it("doesn't hit an entity while frozen: a crate inside its box takes the hit on the first frame it acts again", () => {
    const { m, a, b, lag, frames } = stunnedMidMove('swing');
    b.intangible = 600;
    runPorts(m, lag + 2, []);
    // Past the hitlag, still stunned: a crate appears inside the swing's box.
    const crate = spawnEntity(m, { kind: CRATE, owner: -1, pos: { x: a.pos.x + 10, y: a.pos.y + 8 } });
    const struck: number[] = [];
    for (let frame = lag + 3; frame <= frames + 1; frame++) {
      runPorts(m, 1, []);
      if (m.events.some((e) => e.type === 'entityHit' && e.id === crate.id)) struck.push(frame);
    }
    expect(struck).toEqual([frames + 1]);
  });

  it('acts on the frame a script stuns it, so it is pushed then, and not again until it acts after the stun', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: FROZEN }, { fighter: 'reference-mario' }, { fighter: 'reference-mario' }],
    });
    runPorts(m, 10, []);
    const [a, v] = m.fighters as [FighterState, FighterState];
    // P2 stands 5 units from P1, 3 units inside it (their widths are 8).
    Object.assign(v, { pos: { x: a.pos.x + 5, y: a.pos.y }, ground: a.ground, action: 'idle', facing: -1 });
    v.prevPos = { ...v.pos };
    attack(m, 0, 'stunSelf');
    const pushed: number[] = [];
    for (let frame = 1; frame <= 12; frame++) {
      const before = a.pos.x;
      runPorts(m, 1, []);
      if (frame === 1) expect(statusOf(a, STUN)).toMatchObject({ frames: 10, age: 0 });
      if (a.pos.x !== before) pushed.push(frame);
    }
    // Frame 1: it acts (its move starts and stuns it). Frames 2-11: stunned. Frame 12: it acts again.
    expect(pushed).toEqual([1, 12]);
  });

  it('is still hit while frozen: a hazard and a projectile each land on a frozen frame and end the stun', () => {
    const lava = createMatch({
      seed: 1,
      stage: 'hazard-testbed',
      stocks: 3,
      ports: [{ fighter: 'reference-mario' }],
    });
    const f = lava.fighters[0]!;
    // In the testbed's lava, locked out of stage hits until frame 6. The stun freezes it from frame 2.
    Object.assign(f, { pos: { x: -48, y: 0.001 }, prevPos: { x: -48, y: 0.001 }, stageHitLock: 6 });
    applyStatus(lava, f, STUN, { frames: 30 });
    const burned: number[] = [];
    for (let frame = 1; frame <= 6; frame++) {
      runPorts(lava, 1, []);
      if (lava.events.some((e) => e.type === 'stageHit')) burned.push(frame);
    }
    expect(burned).toEqual([6]);
    expect(lava.events).toContainEqual({ type: 'statusEnd', port: 0, status: STUN, reason: 'hit' });

    const { m, v } = versus(3);
    applyStatus(m, v, STUN, { frames: 30 });
    runPorts(m, 5, []);
    expect(v.hitlag).toBe(0);
    spawnEntity(m, {
      kind: 'test-status/petal',
      owner: 0,
      pos: { x: v.pos.x, y: v.pos.y + 8 },
      move: 'neutralB',
    });
    runPorts(m, 1, []);
    expect(m.events.filter((e) => e.type === 'hit')).toMatchObject([{ attacker: 0, victim: 1 }]);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: STUN, reason: 'hit' });
  });
});

describe('statuses: a KO from a ledge hang', () => {
  /** A block whose left ledge holds still for 2 seconds, then sinks 400 units, through the bottom blast zone. */
  registerStage({
    id: 'test-sinking-ledge',
    name: 'test-sinking-ledge',
    solids: [
      {
        points: [
          [-20, -10],
          [20, -10],
          [20, 0],
          [-20, 0],
        ],
        motion: {
          period: 6000,
          keys: [
            [0, 0, 0],
            [120, 0, 0],
            [300, 0, -400],
            [5999, 0, -400],
          ],
        },
      },
    ],
    platforms: [],
    ledges: [{ x: -20, y: 0, side: -1, solid: 0 }],
    blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
    camera: { left: -170, right: 170, top: 130, bottom: -80 },
    spawns: [[0, 0, 1]],
    respawns: [[0, 80]],
  });

  it('clears every status and resets meters when the ledge carries a hanging fighter out', () => {
    const m = testMatch({ fighter: 'test-status', stage: 'test-sinking-ledge' });
    const f = placeInAir(m, -25, 4, 1);
    until(m, (g) => g.action === 'ledgeHang');
    while (m.frame < 160) run(m, 1);
    expect(f.action).toBe('ledgeHang');
    applyStatus(m, f, WARM);
    applyStatus(m, f, FLOWER, { damage: 5 });
    setMeter(f, 'ammo', 1);
    for (let i = 0; i < 400 && f.action === 'ledgeHang'; i++) run(m, 1);
    expect(f.action).toBe('ko');
    expect(f.statuses).toEqual([]);
    expect(f.meters).toMatchObject({ ammo: 3 });
    expect(m.events.filter((e) => e.type === 'statusEnd')).toEqual([
      { type: 'statusEnd', port: 0, status: WARM, reason: 'ko' },
      { type: 'statusEnd', port: 0, status: FLOWER, reason: 'ko' },
    ]);
  });
});

describe('meters', () => {
  it('start at their start values', () => {
    const { a } = versus(3);
    expect(a.meters).toEqual({ ammo: 3, heat: 0, hop: 1, coins: 0, charge: 0 });
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

  it('a KO resets meters to their start values, except those with onKo keep, and pauses them until respawn', () => {
    const { m, a } = versus(3);
    setMeter(a, 'ammo', 1);
    setMeter(a, 'coins', 7);
    Object.assign(a, { pos: { x: -400, y: 20 }, ground: null, action: 'fall' });
    runPorts(m, 1, []);
    expect(a.action).toBe('ko');
    expect(a.meters).toMatchObject({ ammo: 3, coins: 7 });
    setMeter(a, 'heat', 10);
    runPorts(m, 30, []);
    expect(a.action).toBe('ko');
    expect(meter(a, 'heat')).toBe(10); // no regen or drain while off screen
  });
});

describe('meters filled by damage (MeterDef dealt, taken and full)', () => {
  /** Two status fixtures 10 apart, P1 facing P2, and a parked Mario: three players, so no 1v1 multiplier. */
  function pair(): { m: MatchState; a: FighterState; v: FighterState } {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'test-status' }, { fighter: 'test-status' }, { fighter: 'reference-mario' }],
    });
    runPorts(m, 10, []);
    const [a, v, far] = m.fighters as [FighterState, FighterState, FighterState];
    for (const [f, x, facing] of [
      [a, 0, 1],
      [v, 10, -1],
      [far, -60, 1],
    ] as const) {
      Object.assign(f, { pos: { x, y: a.pos.y }, ground: a.ground, action: 'idle', actionFrame: 1, facing });
      f.prevPos = { ...f.pos };
      f.intangible = 0;
    }
    return { m, a, v };
  }

  it('gain from the % a hit adds: half of it for the attacker, all of it for the victim', () => {
    const { m, a, v } = pair();
    attack(m, 0, 'ftilt');
    stepUntil(m, 'hit');
    expect(v.damage).toBeCloseTo(4.2, 9); // 4%, fresh x1.05
    expect(meter(a, 'charge')).toBeCloseTo(2.1, 9);
    expect(meter(v, 'charge')).toBeCloseTo(4.2, 9);
  });

  it("count a status's damage for its source and its victim, and a projectile's for its owner", () => {
    const { m, a, v } = pair();
    attack(m, 0, 'jab');
    stepUntil(m, 'hit');
    const hit = v.damage;
    stepUntil(m, 'statusDamage');
    expect(v.damage - hit).toBe(1);
    expect(meter(a, 'charge')).toBeCloseTo((hit + 1) / 2, 9);
    expect(meter(v, 'charge')).toBeCloseTo(hit + 1, 9);
    clearStatus(m, v, FLOWER);
    setMeter(a, 'charge', 0);
    setMeter(v, 'charge', 0);
    runPorts(m, 30, []);
    const before = v.damage;
    attack(m, 0, 'neutralB');
    const seen = stepUntil(m, 'hit');
    expect(seen.find((e) => e.type === 'hit')).toHaveProperty('entity');
    expect(meter(a, 'charge')).toBeCloseTo((v.damage - before) / 2, 9);
    expect(meter(v, 'charge')).toBeCloseTo(v.damage - before, 9);
  });

  it('a shield hit fills nothing', () => {
    const { m, a, v } = pair();
    Object.assign(v, { action: 'shield', actionFrame: 1 });
    attack(m, 0, 'ftilt');
    stepUntil(m, 'shieldHit', [{}, { buttons: ['shield'] }]);
    expect([meter(a, 'charge'), meter(v, 'charge')]).toEqual([0, 0]);
  });

  it('put the full status on at the end of the frame a hit fills the meter', () => {
    const { m, a, v } = pair();
    setMeter(a, 'charge', 98);
    attack(m, 0, 'ftilt');
    const seen = stepUntil(m, 'hit');
    expect(meter(a, 'charge')).toBe(100);
    expect(statusOf(a, CHARGED)).toMatchObject({ frames: 30, since: m.frame - 1, source: 0 });
    expect(seen.filter((e) => e.type === 'statusStart' && e.status === CHARGED)).toEqual([
      { type: 'statusStart', port: 0, status: CHARGED, frames: 30, source: 0 },
    ]);
    expect(hasStatus(v, CHARGED)).toBe(false);
  });

  it('hold the full status until it runs out, then empty the meter', () => {
    const { m, a } = pair();
    setMeter(a, 'charge', 100);
    runPorts(m, 1, []);
    expect(hasStatus(a, CHARGED)).toBe(true);
    runPorts(m, 29, []);
    expect([hasStatus(a, CHARGED), meter(a, 'charge')]).toEqual([true, 100]);
    runPorts(m, 1, []);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 0, status: CHARGED, reason: 'expired' });
    expect([hasStatus(a, CHARGED), meter(a, 'charge')]).toEqual([false, 0]);
  });

  it('take the full status off at the end of the frame the meter is spent', () => {
    const { m, a } = pair();
    setMeter(a, 'charge', 100);
    runPorts(m, 1, []);
    expect(hasStatus(a, CHARGED)).toBe(true);
    expect(spendMeter(a, 'charge', 100)).toBe(true);
    runPorts(m, 1, []);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 0, status: CHARGED, reason: 'cleared' });
    expect(hasStatus(a, CHARGED)).toBe(false);
  });

  it('a KO takes the full status off and empties the meter', () => {
    const { m, a } = pair();
    setMeter(a, 'charge', 100);
    runPorts(m, 1, []);
    Object.assign(a, { pos: { x: -400, y: 20 }, ground: null, action: 'fall' });
    runPorts(m, 1, []);
    expect(a.action).toBe('ko');
    expect([hasStatus(a, CHARGED), meter(a, 'charge')]).toEqual([false, 0]);
  });
});
