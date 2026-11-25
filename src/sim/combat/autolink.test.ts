import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import type { MoveDef } from '../../fighters/types';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { marioReference } from '../testing/reference';
import { attack, run, testMatch } from '../testing/sim';
import { LAUNCH_DECAY } from './formulas';

/** Mario's attributes with one move per autolink angle, boxes reaching the fighter in front (`probe`'s geometry). */
const box = { id: 0, x: 8, y: 8, radius: 8, damage: 10, kbg: 100, bkb: 40 };
const move = (angle: number, extra: Partial<MoveDef['hits'][number]['boxes'][number]> = {}): MoveDef => ({
  kind: 'other',
  faf: 30,
  hits: [{ frames: [1, 3], boxes: [{ ...box, angle, ...extra }] }],
});
const autolinkRef = {
  ...marioReference,
  id: 'reference-autolink',
  name: 'Reference (autolink)',
  moves: {
    half: move(365),
    vortex: move(366),
    link: move(367),
    vector: move(368, { vector: { x: 14, y: 20, frames: 6 } }),
    bare: move(368),
  },
};
registerFighter(autolinkRef);

/** Two autolink reference fighters standing on Battlefield, `a` at -10 facing `v` at -2. */
function duel(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ fighter: autolinkRef.id, players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, -10, 1],
    [v, -2, -1],
  ] as const) {
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1 });
  }
  run(m, 20);
  expect(a.action).toBe('idle');
  expect(v.action).toBe('idle');
  return { m, a, v };
}

/** The velocity a launch started with, read one frame into the flight: launch speed only decays (0.051 a frame). */
function launchVel(f: FighterState): { x: number; y: number } {
  const n = Math.hypot(f.kb.x, f.kb.y);
  const k = (n + LAUNCH_DECAY) / n;
  return { x: f.kb.x * k, y: f.kb.y * k };
}

/** Float `f` in the air at (x, y), as if falling. */
function airborne(f: FighterState, x: number, y: number): void {
  Object.assign(f, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    airFrames: 0,
  });
}

describe('autolink angles (SmashWiki, "Autolink angle")', () => {
  it("365 launches the target at half the attacker's speed in the direction of their motion", () => {
    const { m, a, v } = duel();
    airborne(a, -10, 10);
    airborne(v, a.pos.x + 8, 6);
    a.vel = { x: 2.4, y: 1.6 };
    attack(m, 0, 'half');
    run(m, 1);

    const link = v.launch!.link!;
    expect(link.vel.x).toBeGreaterThan(2);
    expect(link.vel.y).toBeGreaterThan(1);
    run(m, v.hitlag + 1);
    const vel = launchVel(v);
    expect(vel.x).toBeCloseTo(link.vel.x * 0.5, 6);
    expect(vel.y).toBeCloseTo(link.vel.y * 0.5, 6);
    expect(v.launchMotion).toBeNull();
  });

  it('365 moves the target the same distance at any %: a launch that follows the attacker gets no balloon speed-up', () => {
    const firstFrame = (percent: number) => {
      const { m, a, v } = duel();
      airborne(a, -10, 10);
      airborne(v, a.pos.x + 8, 6);
      v.damage = percent;
      a.vel = { x: 2, y: 0 };
      attack(m, 0, 'half');
      run(m, 1);
      const kb = v.launch!.kb;
      run(m, v.hitlag + 1);
      return { kb, dx: v.pos.x - v.prevPos.x, speedUp: v.speedUpFaf };
    };
    const low = firstFrame(0);
    const high = firstFrame(150);
    expect(low.kb).toBeLessThan(80);
    expect(high.kb).toBeGreaterThan(80);
    expect(high.speedUp).toBe(0);
    expect(high.dx).toBeCloseTo(low.dx, 6);
  });

  it('366 sends the target at full launch speed the way the attacker moves, pulled toward the hitbox for 5 frames', () => {
    const { m, a, v } = duel();
    airborne(a, -10, 10);
    airborne(v, a.pos.x + 8, 0);
    a.vel = { x: 3, y: 0 };
    attack(m, 0, 'vortex');
    run(m, 1);

    const { kb, link } = v.launch!;
    run(m, v.hitlag + 1);
    expect(v.launchMotion).toMatchObject({ kind: 'vortex', frames: 4 });
    const speed = Math.hypot(v.kb.x, v.kb.y);
    expect(speed).toBeCloseTo(kb * 0.03 - LAUNCH_DECAY, 6);
    expect(v.kb.y).toBeGreaterThan(0);
    run(m, 4);
    expect(v.launchMotion).toMatchObject({ kind: 'vortex', frames: 0 });
    run(m, 1);
    expect(v.launchMotion).toBeNull();
    expect(v.kb.y / v.kb.x).toBeCloseTo(link!.vel.y / link!.vel.x, 6);
    expect(Math.hypot(v.kb.x, v.kb.y)).toBeCloseTo(speed - 5 * LAUNCH_DECAY, 6);
  });

  it('367 adds a fifth of the gap to the hitbox to the attacker’s velocity', () => {
    const { m, a, v } = duel();
    airborne(a, -10, 10);
    airborne(v, a.pos.x + 12, 14);
    a.vel = { x: 1.2, y: 1.2 };
    attack(m, 0, 'link');
    run(m, 1);
    const { at, vel } = v.launch!.link!;
    const { x, y } = v.pos;
    run(m, v.hitlag + 1);
    const launched = launchVel(v);
    expect(launched.x).toBeCloseTo(vel.x + 0.2 * (at.x - x), 6);
    expect(launched.y).toBeCloseTo(vel.y + 0.2 * (at.y - y - 7.5), 6);
  });

  it('367 caps launch speed at 3 after five frames', () => {
    const { m, a, v } = duel();
    airborne(a, -10, 10);
    airborne(v, a.pos.x + 8, 10);
    a.vel = { x: 6, y: 0 };
    attack(m, 0, 'link');
    run(m, 1);

    run(m, v.hitlag + 5);
    expect(Math.hypot(v.kb.x, v.kb.y)).toBeGreaterThan(3);
    run(m, 1);
    const vel = launchVel(v);
    expect(Math.hypot(vel.x, vel.y)).toBeCloseTo(3, 6);
    expect(vel.x).toBeGreaterThan(0);
  });

  it('367 never drags the target down faster than 1', () => {
    const { m, a, v } = duel();
    airborne(a, -10, 10);
    airborne(v, a.pos.x + 8, 24);
    attack(m, 0, 'link');
    run(m, 1);
    expect(v.launch!.link!.at.y - (v.pos.y + 7.5)).toBeLessThan(-5);
    run(m, v.hitlag + 1);
    expect(launchVel(v).y).toBeCloseTo(-1, 6);
  });

  it('367 launches a grounded target normally, at 80 degrees', () => {
    const { m, v } = duel();
    attack(m, 0, 'link');
    run(m, 1);
    run(m, v.hitlag + 1);
    expect(v.ground).toBeNull();
    expect(v.launchMotion).toBeNull();
    const angle = (Math.atan2(v.kb.y, v.kb.x) * 180) / Math.PI;
    expect(angle).toBeCloseTo(80, 1);
  });

  it("368 pulls the target's middle to the position vector, then stops the launch", () => {
    const { m, a, v } = duel();
    airborne(v, a.pos.x + 8, 4);
    attack(m, 0, 'vector');
    run(m, 1);

    const to = v.launch!.link!.to!;
    expect(to).toEqual({ x: a.pos.x + 14, y: a.pos.y + 20, frames: 6 });
    run(m, v.hitlag + 6);
    expect(v.pos.x).toBeCloseTo(to.x, 6);
    expect(v.pos.y + 7.5).toBeCloseTo(to.y, 6);
    run(m, 1);
    expect(v.launchMotion).toBeNull();
    expect(v.kb).toEqual({ x: 0, y: 0 });
  });

  it('368 without a vector acts as 367', () => {
    const grounded = duel();
    attack(grounded.m, 0, 'bare');
    run(grounded.m, 1);
    run(grounded.m, grounded.v.hitlag + 1);
    const groundedAngle = (Math.atan2(grounded.v.kb.y, grounded.v.kb.x) * 180) / Math.PI;
    expect(groundedAngle).toBeCloseTo(80, 1);

    const air = duel();
    airborne(air.a, -10, 10);
    airborne(air.v, air.a.pos.x + 8, 20);
    attack(air.m, 0, 'bare');
    run(air.m, 1);
    expect(air.v.launch!.link!.to).toBeUndefined();
    run(air.m, air.v.hitlag + 1);
    expect(air.v.kb.y).toBeLessThan(0);
  });
});
