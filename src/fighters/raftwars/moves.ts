import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';
import type { Ctx } from '../../sim/fighter';

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({
  id,
  x,
  y,
  radius,
  ...hit,
});

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/**
 * Raft Slide: a belly flop onto the pool float on frame 6 that keeps sliding with less than half the usual traction
 * until frame 20, so the dash attack covers about 30 units.
 */
function raftSlide(x: Ctx): void {
  const { f } = x;
  if (f.actionFrame === 6) f.vel.x = f.facing * 2;
  else if (f.actionFrame > 6 && f.actionFrame <= 20 && f.vel.x * f.facing > 0.1) f.vel.x += f.facing * 0.04;
}

const DEG = Math.PI / 180;
/** Rocket Ride: speed along the flight path, so frames 12-48 cover about 110 units. */
const ROCKET_SPEED = 2.95;
/** How far the rocket turns toward the stick each frame. */
const ROCKET_TURN = 2;

/**
 * Rocket Ride's heading in degrees from straight up, positive toward the facing direction: 15 (up-forward) with the
 * stick neutral, steering out to 30 forward or 30 back.
 */
function rocketTarget(x: Ctx): number {
  const forward = stickX(x.c) * x.f.facing;
  return clampHeading(forward >= 0 ? 15 + 15 * forward : 15 + 45 * forward);
}

const clampHeading = (deg: number) => Math.max(-30, Math.min(30, deg));

/**
 * Rocket Ride (up special): lights the rocket and hangs for 11 frames, rides it from frame 12 along a heading the
 * stick steers within 30 degrees of vertical, and bursts on frame 49, leaving them helpless. The current heading
 * lives in the horizontal velocity (its sine times the rocket's speed), so the script keeps no state of its own and a
 * ceiling, which only strips the vertical part, leaves the heading and the steering intact.
 */
function rocketRide(x: Ctx): void {
  const { f } = x;
  const t = f.actionFrame;
  if (t < 12) {
    f.vel.x *= 0.85;
    f.vel.y = Math.max(f.vel.y * 0.5, 0);
    return;
  }
  if (t <= 48) {
    const target = rocketTarget(x);
    const sin = Math.max(-1, Math.min(1, (f.vel.x * f.facing) / ROCKET_SPEED));
    const current = t === 12 ? target : clampHeading(Math.asin(sin) / DEG);
    const heading = current + Math.max(-ROCKET_TURN, Math.min(ROCKET_TURN, target - current));
    f.vel.x = Math.sin(heading * DEG) * ROCKET_SPEED * f.facing;
    f.vel.y = Math.cos(heading * DEG) * ROCKET_SPEED;
    return;
  }
  if (t === 49) {
    f.vel.x *= 0.3;
    f.vel.y = 0.8;
  }
}

/**
 * Raft Wars kids' moves (roster sheet, fighter 9). They are a pure zoner: everything but the floaty moves fires the
 * tennis-ball launcher, so the projectile normals (jab, tilts, aerials) and the specials arrive with the shared
 * projectile system. These are the melee moves and the grab game. Frame windows are inclusive, faf is the first
 * actionable frame, and move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /** Raft Slide: belly-slides along the ground on the pool float; strong on the flop, weaker as it slides. */
  dashAttack: {
    kind: 'other',
    faf: 42,
    hits: [
      { frames: [8, 11], boxes: [box(0, 5, 4, 5.5, { damage: 9, angle: 45, kbg: 75, bkb: 60 })] },
      { frames: [12, 22], boxes: [box(0, 5, 4, 4.5, { damage: 6, angle: 45, kbg: 70, bkb: 45 })] },
    ],
    script: raftSlide,
  },
  /**
   * Floaty Shove: the video's "good knockback attack". A hip check with the inflatable ring, their one big melee hit
   * and their best kill move (the roster targets about 90% on Mario at the ledge). The ring is the sweetspot, the body the sourspot.
   */
  fsmash: {
    kind: 'smash',
    faf: 52,
    charge: 9,
    hits: [
      {
        frames: [14, 16],
        boxes: [
          box(0, 10, 6, 5.5, { damage: 16, angle: 361, kbg: 100, bkb: 40 }),
          box(1, 4.5, 6, 4, { damage: 13, angle: 361, kbg: 100, bkb: 32 }),
        ],
      },
    ],
  },
  /**
   * Bottle Rocket: fires a small rocket straight up from the launcher. It rises above their head and bursts at the
   * top, an anti-air that kills around 120%; it barely touches grounded opponents beside them.
   */
  usmash: {
    kind: 'smash',
    faf: 47,
    charge: 7,
    hits: [
      {
        frames: [12, 14],
        boxes: [box(0, 2, 16, 4.5, { damage: 13, angle: 88, kbg: 96, bkb: 38, direction: 'away' })],
      },
      {
        frames: [15, 18],
        boxes: [box(0, 2, 24, 5, { damage: 13, angle: 88, kbg: 96, bkb: 38, direction: 'away' })],
      },
      {
        frames: [19, 22],
        boxes: [box(0, 2, 31, 7, { damage: 11, angle: 85, kbg: 92, bkb: 38, direction: 'away' })],
      },
    ],
  },
  /** Splash Down: slams the floaty onto the water, a splash ring hitting both sides at once. */
  dsmash: {
    kind: 'smash',
    faf: 44,
    charge: 4,
    hits: [
      {
        frames: [10, 12],
        boxes: [
          box(0, 9, 2.5, 5, { damage: 11, angle: 30, kbg: 95, bkb: 30 }),
          box(1, -9, 2.5, 5, { damage: 11, angle: 30, kbg: 95, bkb: 30, direction: 'back' }),
        ],
      },
    ],
  },
  /** Gets up swinging the float to both sides; intangible until the second swing ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 8, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -8, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** A short grab (10.5 units, Mario reaches 12): kids have short arms, so the grab game is a fallback. */
  grab: { kind: 'other', faf: 36, hits: [{ frames: [7, 8], boxes: [grabBox(0, 6.5, 7, 4)] }] },
  dashGrab: { kind: 'other', faf: 44, hits: [{ frames: [10, 11], boxes: [grabBox(0, 7.5, 7, 4.5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 38, hits: [{ frames: [11, 12], boxes: [grabBox(0, 8, 7, 5)] }] },
  /** Launcher Bonk: knocks the held opponent on the head with the launcher. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.2, hitlag: 2 } },
  /** Point-Blank: shoves them off and fires a tennis ball into them. */
  fthrow: {
    kind: 'other',
    faf: 34,
    hits: [],
    throw: { frame: 15, hit: { damage: 9, angle: 40, kbg: 60, bkb: 55 } },
  },
  /** Rocket Toss: swings them behind on a rocket burst. Their kill throw (the roster targets about 160% from the ledge). */
  bthrow: {
    kind: 'other',
    faf: 45,
    hits: [],
    throw: { frame: 22, hit: { damage: 11, angle: 40, kbg: 72, bkb: 55, direction: 'back' } },
  },
  /** Ball Launch: pops them straight up with a point-blank shot. */
  uthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 16, hit: { damage: 8, angle: 90, kbg: 70, bkb: 65 } },
  },
  /** Floaty Sit: plops onto them with the floaty; little knockback, so it starts combos at low %. */
  dthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    throw: { frame: 20, hit: { damage: 6, angle: 75, kbg: 45, bkb: 55 } },
  },
  /**
   * Rocket Ride (up special): Simon's brother rides a rocket about 110 units up and forward, steerable 30 degrees
   * either side of vertical, and it explodes at the end. The ride clips whoever it touches; the explosion is the
   * real hit (12%) and can hit them again. Ends in helpless fall; grabs the ledge from frame 12.
   */
  upB: {
    kind: 'other',
    faf: 62,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 12,
    landingLag: 24,
    hits: [
      {
        frames: [12, 48],
        boxes: [box(0, 0, 7, 5.5, { damage: 4, angle: 80, kbg: 60, bkb: 45, direction: 'away' })],
      },
      {
        frames: [49, 52],
        rehit: true,
        boxes: [box(0, 0, 8, 10, { damage: 12, angle: 361, kbg: 88, bkb: 45, direction: 'away' })],
      },
    ],
    script: rocketRide,
  },
};
