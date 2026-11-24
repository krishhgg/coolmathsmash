import type { HitboxDef, MoveDef } from '../types';
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
   * and their best kill move (about 90% on Mario at the ledge). The ring is the sweetspot, the body the sourspot.
   */
  fsmash: {
    kind: 'smash',
    faf: 52,
    charge: 9,
    hits: [
      {
        frames: [14, 16],
        boxes: [
          box(0, 10, 6, 5.5, { damage: 16, angle: 361, kbg: 75, bkb: 35 }),
          box(1, 4.5, 6, 4, { damage: 13, angle: 361, kbg: 75, bkb: 28 }),
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
  /** Rocket Toss: swings them behind on a rocket burst. Their kill throw, about 160% from the ledge. */
  bthrow: {
    kind: 'other',
    faf: 45,
    hits: [],
    throw: { frame: 22, hit: { damage: 11, angle: 40, kbg: 60, bkb: 50, direction: 'back' } },
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
};
