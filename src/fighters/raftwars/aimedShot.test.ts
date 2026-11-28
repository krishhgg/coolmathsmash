import { describe, expect, it } from 'vitest';
import { runCpuMatch } from '../../ai/bench';
import { knowledge } from '../../ai/knowledge';
import { chargeScale } from '../../sim/actions/charge';
import type { EntityState } from '../../sim/entities/types';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { runPorts, type Hold } from '../../sim/testing/sim';
import { AIMED_SHOT, aimedShotEntities } from './aimedShot';

type Hit = Extract<SimEvent, { type: 'hit' }>;

const SPECIAL: Hold = { buttons: ['special'] };
const FULL = AIMED_SHOT.fullDamage / AIMED_SHOT.damage;
/** Ultimate's 1.2x damage in 1v1 and the fresh-move bonus (x1.05) that every first hit gets. */
const ONE_ON_ONE = 1.2;
const FRESH = 1.05;

/** P1 kids facing right at x, the Mario reference `gap` units ahead, both settled; `air` lifts P1 to that height. */
function setup(gap = 40, air?: number, x = -40): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'raftwars' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const at = { x, y: air ?? 0 };
  Object.assign(a, { pos: { ...at }, prevPos: { ...at }, vel: { x: 0, y: 0 }, facing: 1, intangible: 0 });
  if (air !== undefined) Object.assign(a, { ground: null, action: 'fall', jumpsUsed: 1 });
  else a.action = 'idle';
  const there = { x: x + gap, y: 0 };
  Object.assign(v, { pos: { ...there }, prevPos: { ...there }, facing: -1, action: 'idle', intangible: 0 });
  return { m, a, v };
}

/** Press Special, hold it until the move has charged `frames` frames, then let go. */
function charge(m: MatchState, a: FighterState, frames: number): void {
  runPorts(m, 1, [SPECIAL, {}]);
  for (let i = 0; i < 300 && a.charge < frames; i++) runPorts(m, 1, [SPECIAL, {}]);
  expect(a.charge).toBe(frames);
}

const shots = (m: MatchState): EntityState[] => m.entities.filter((e) => e.kind === 'raftwars/aimedShot');

/** Step until the ball is out; returns it on its first frame. */
function fired(m: MatchState): EntityState {
  for (let i = 0; i < 60 && shots(m).length === 0; i++) runPorts(m, 1, [{}, {}]);
  return shots(m)[0]!;
}

/** Charge `frames` frames at Mario `gap` units ahead and return the hit that lands on him. */
function shotHit(frames: number, gap = 40, percent = 0): Hit {
  const { m, a, v } = setup(gap);
  v.damage = percent;
  charge(m, a, frames);
  for (let i = 0; i < 120; i++) {
    const hit = m.events.find((e): e is Hit => e.type === 'hit');
    if (hit) return hit;
    runPorts(m, 1, [{}, {}]);
  }
  throw new Error(`the shot charged ${frames} frames never hit`);
}

describe('Raft Wars kids: Aimed Shot (neutral special)', () => {
  it('holds on frame 13 while Special is held, fires 3 frames after the release and is done on frame 45', () => {
    const { m, a } = setup();
    runPorts(m, 1, [SPECIAL, {}]);
    expect(a.move).toBe('neutralB');
    runPorts(m, 40, [SPECIAL, {}]);
    expect(a.actionFrame).toBe(AIMED_SHOT.charge - 1);
    expect(a.charge).toBe(40 - (AIMED_SHOT.charge - 2));
    expect(shots(m)).toHaveLength(0);
    runPorts(m, 1, [{}, {}]);
    expect(a.actionFrame).toBe(AIMED_SHOT.charge);
    runPorts(m, 2, [{}, {}]);
    expect(shots(m)).toHaveLength(0);
    runPorts(m, 1, [{}, {}]);
    expect(a.actionFrame).toBe(AIMED_SHOT.fire);
    expect(shots(m)).toHaveLength(1);
    expect(shots(m)[0]!.age).toBe(1);
    for (let i = 0; i < 60 && a.move === 'neutralB'; i++) runPorts(m, 1, [{}, {}]);
    expect(a.action).toBe('idle');
    expect(a.actionFrame).toBeLessThanOrEqual(1);
  });

  it('fires by itself at full charge, 112 frames in, and never stores the charge', () => {
    const { m, a } = setup();
    runPorts(m, 1, [SPECIAL, {}]);
    for (let i = 0; i < 300 && shots(m).length === 0; i++) runPorts(m, 1, [SPECIAL, {}]);
    expect(a.charge).toBe(AIMED_SHOT.chargeFrames);
    expect(shots(m)[0]!.damageMul).toBeCloseTo(FULL, 12);
    expect(a.storedCharge).toBeNull();
  });

  it.each([
    ['no', 0, 0, 1.6, 5],
    ['half', AIMED_SHOT.chargeFrames / 2, 0.5, 2.45, 16.5],
    ['full', AIMED_SHOT.chargeFrames, 1, 3.3, 28],
  ])('at %s charge (%i frames, level %f) flies at %f and hits for %f%', (_, frames, level, speed, damage) => {
    const { m, a } = setup();
    charge(m, a, frames);
    const ball = fired(m);
    expect(Math.hypot(ball.vel.x, ball.vel.y)).toBeCloseTo(speed, 12);
    expect(Math.atan2(ball.vel.y, ball.vel.x) * (180 / Math.PI)).toBeCloseTo(AIMED_SHOT.elevation, 12);
    expect(AIMED_SHOT.damage * chargeScale(level, FULL)).toBeCloseTo(damage, 12);
    expect(shotHit(frames).damage).toBeCloseTo(damage * FRESH * ONE_ON_ONE, 9);
  });

  it('launches harder the longer it charged', () => {
    const kb = [0, 28, 56, 84, 112].map((frames) => shotHit(frames, 40, 60).kb);
    expect(kb).toEqual([...kb].sort((x, y) => x - y));
    expect(new Set(kb).size).toBe(kb.length);
    expect(shotHit(0, 40, 60).tumble).toBe(false);
    expect(shotHit(112, 40, 60).tumble).toBe(true);
  });

  it('arcs to the floor about 57 units ahead uncharged and flies its whole 60 frames, about 190 units, at full', () => {
    const range = (frames: number) => {
      const { m, a } = setup(-10, undefined, -70);
      charge(m, a, frames);
      const ball = fired(m);
      const from = ball.pos.x;
      let peak = ball.pos.y;
      let last = { pos: { ...ball.pos }, age: ball.age };
      while (shots(m).length) {
        const e = shots(m)[0]!;
        last = { pos: { ...e.pos }, age: e.age };
        peak = Math.max(peak, e.pos.y);
        runPorts(m, 1, [{}, {}]);
      }
      const end = m.events.find((e) => e.type === 'entityDestroy');
      return {
        distance: last.pos.x - from,
        peak,
        age: last.age,
        reason: end?.type === 'entityDestroy' && end.reason,
      };
    };
    const low = range(0);
    expect(low.distance).toBeGreaterThan(50);
    expect(low.distance).toBeLessThan(65);
    expect(low.reason).toBe('stage');
    const high = range(AIMED_SHOT.chargeFrames);
    expect(high.age).toBe(AIMED_SHOT.lifetime);
    expect(high.reason).toBe('expired');
    expect(high.distance).toBeGreaterThan(185);
    expect(high.distance).toBeLessThan(200);
    expect(high.peak).toBeLessThan(16);
  });

  it('charges and fires in the air as neutralBAir, with the same ball', () => {
    const { m, a } = setup(40, 60);
    runPorts(m, 1, [SPECIAL, {}]);
    expect(a.move).toBe('neutralBAir');
    for (let i = 0; i < 30; i++) runPorts(m, 1, [SPECIAL, {}]);
    expect(a.charge).toBeGreaterThan(0);
    const ball = fired(m);
    expect(ball.kind).toBe('raftwars/aimedShot');
    expect(ball.pos.x - a.pos.x).toBeCloseTo(AIMED_SHOT.airMuzzle.x, 1);
  });

  /**
   * koPercent: the Mario reference at Battlefield's ledge, fresh, no rage, no DI. Samus's fully charged Charge Shot
   * (28%, 40 degrees, KBG 50, BKB 46) KOs him there from 69.9% through koPercent, and SmashWiki gives it 70-110%
   * depending on rage, weight and DI.
   */
  it("KOs at full charge within 5 points of Samus's full Charge Shot (69.9%); uncharged is no kill move", () => {
    const box = aimedShotEntities.aimedShot!.hits![0]!.boxes[0]!;
    const full = koPercent({ hit: { ...box, damage: box.damage * FULL } })!;
    expect(Math.abs(full - 69.9)).toBeLessThanOrEqual(5);
    expect(koPercent({ hit: box })!).toBeGreaterThan(250);
  });

  it('a CPU can use it: its move probe plays the move through and the kids play a CPU match', () => {
    const probe = knowledge('raftwars', 'battlefield').ground.neutralB;
    expect(probe).toBeDefined();
    expect(probe!.busy).toBeGreaterThanOrEqual(AIMED_SHOT.faf - 1);
    expect(probe!.busy).toBeLessThan(AIMED_SHOT.faf + 5);
    const r = runCpuMatch({
      seed: 3,
      levels: [9, 9],
      fighters: ['raftwars', 'raftwars'],
      maxFrames: 60 * 60,
    });
    // A KO resets damage, so a fight that ends just after one reads 0% on both sides: count KOs as fighting too.
    expect(r.kos.length > 0 || r.damage.some((d) => d > 0)).toBe(true);
  }, 60_000);
});
