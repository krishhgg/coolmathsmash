import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';
import { swap } from '../fireboy/swap';

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
): HitboxDef => ({ id, x, y, radius, ...hit });

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/**
 * One weak, rehitting splash of the Geyser (up special). Set knockback straight up, like the multi-hits of Mario's
 * Super Jump Punch, keeps the opponent riding the geyser with her until the last splash.
 */
const geyserHit = (from: number) => ({
  frames: [from, from + 1] as [number, number],
  rehit: true,
  boxes: [box(0, 1, 9, 6, { damage: 2, angle: 92, kbg: 100, bkb: 0, wbkb: 110 })],
});

/**
 * Watergirl's moves: Fireboy's Mario-frame kit (same names, so the swap and the renderer's clips line up) with the
 * roster's water identity. She splashes instead of burning: slightly less damage than Fireboy, more reach and
 * push, a sideways fair with no meteor and a higher, weaker up special. Angle, BKB and KBG come from the closest
 * Ultimate move (ssbwiki hitbox data): Toon Link's sword normals for her ranged hair and water hits, Sheik's kicks,
 * and Fireboy's Mario values where neither has a matching move; damage is the roster's. Frame windows are
 * inclusive and faf is the first actionable frame. Move names double as animation clip names.
 *
 * Not here yet: neutralB (Water Stream, a charged pushing windbox) and sideB (Temple Mirror, a reflector) need
 * COOL-3's projectile, windbox and reflector systems, so Watergirl, like Fireboy, has no neutral or side special
 * for now. The jab stays one hit, like Fireboy's, until both get the roster's 1-2-Kick.
 */
export const moves: Record<string, MoveDef> = {
  /** Quick splash jab, a little longer than Fireboy's. */
  jab: {
    kind: 'other',
    faf: 19,
    hits: [{ frames: [3, 4], boxes: [box(0, 7.5, 9, 4, { damage: 2.5, angle: 361, kbg: 50, bkb: 25 })] }],
  },
  /** Hair Whip: her waterfall ponytail lashes forward, about 6 units past Fireboy's kick (Toon Link's f-tilt). */
  ftilt: {
    kind: 'other',
    faf: 28,
    hits: [
      {
        frames: [5, 7],
        boxes: [
          box(0, 15, 7.5, 4, { damage: 7, angle: 38, kbg: 83, bkb: 45 }),
          box(1, 8, 7.5, 3.5, { damage: 6.5, angle: 20, kbg: 83, bkb: 45 }),
        ],
      },
    ],
  },
  /** Hair Flick: the ponytail sweeps overhead; launches up for juggles (Toon Link's u-tilt). */
  utilt: {
    kind: 'other',
    faf: 31,
    hits: [
      {
        frames: [5, 11],
        boxes: [box(0, 2, 16.5, 6, { damage: 5, angle: 95, kbg: 140, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Temple Slide: a low, slippery slide kick that pops opponents up (Sheik's d-tilt). */
  dtilt: {
    kind: 'other',
    faf: 21,
    hits: [{ frames: [5, 7], boxes: [box(0, 10, 2, 4.5, { damage: 5.5, angle: 70, kbg: 100, bkb: 37 })] }],
  },
  /** Element Skid: she slides on a puddle feet first; weaker late (Toon Link's dash attack). */
  dashAttack: {
    kind: 'other',
    faf: 39,
    hits: [
      { frames: [6, 10], boxes: [box(0, 7, 6, 5.5, { damage: 7, angle: 65, kbg: 70, bkb: 70 })] },
      { frames: [11, 25], boxes: [box(0, 7, 6, 5, { damage: 4.5, angle: 65, kbg: 70, bkb: 70 })] },
    ],
  },
  /** Element Palm: a palm burst of water, longer and weaker than Fireboy's fire (Toon Link's f-smash). */
  fsmash: {
    kind: 'smash',
    faf: 50,
    charge: 12,
    hits: [
      {
        frames: [15, 17],
        boxes: [
          box(0, 13.5, 8.5, 6, { damage: 15, angle: 40, kbg: 110, bkb: 25 }),
          box(1, 6.5, 8.5, 4, { damage: 12.5, angle: 40, kbg: 110, bkb: 20 }),
        ],
      },
    ],
  },
  /** Pillar Headbutt: a water pillar that reaches higher than Fireboy's flame (Toon Link's u-smash). */
  usmash: {
    kind: 'smash',
    faf: 40,
    charge: 6,
    hits: [
      {
        frames: [9, 12],
        boxes: [
          box(0, 1, 15.5, 6.5, { damage: 13, angle: 100, kbg: 94, bkb: 43, direction: 'away' }),
          box(1, 0.5, 22, 4.5, { damage: 11, angle: 96, kbg: 93, bkb: 30, direction: 'away' }),
        ],
      },
    ],
  },
  /** Split Sweep: low kicks, front then back (Toon Link's d-smash, which sweeps front then back too). */
  dsmash: {
    kind: 'smash',
    faf: 49,
    charge: 3,
    hits: [
      { frames: [5, 6], boxes: [box(0, 9, 2, 5, { damage: 9, angle: 48, kbg: 90, bkb: 55 })] },
      {
        frames: [14, 15],
        boxes: [box(0, -9, 2, 5, { damage: 11, angle: 42, kbg: 85, bkb: 55, direction: 'back' })],
      },
    ],
  },
  /** Getting up from the floor splashing both sides; intangible until the second splash ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 8.5, 3, 5.5, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -8.5, 3, 5.5, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Twirl Kick: strong early, weaker lingering hit, a touch wider than Fireboy's (Sheik's n-air). */
  nair: {
    kind: 'aerial',
    faf: 45,
    landingLag: 6,
    autoCancel: [
      [1, 2],
      [39, 45],
    ],
    hits: [
      {
        frames: [3, 6],
        boxes: [box(0, 0, 7.5, 7, { damage: 7.5, angle: 361, kbg: 100, bkb: 30, direction: 'away' })],
      },
      {
        frames: [7, 30],
        boxes: [box(0, 0, 7.5, 6.5, { damage: 4.5, angle: 361, kbg: 100, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Element Chop: a quicker sideways chop with more reach than Fireboy's and no meteor (Toon Link's f-air). */
  fair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 14,
    autoCancel: [
      [1, 2],
      [40, 50],
    ],
    hits: [
      {
        frames: [12, 14],
        boxes: [
          box(0, 12, 7, 5, { damage: 11, angle: 361, kbg: 98, bkb: 35 }),
          box(1, 5.5, 8, 4, { damage: 9, angle: 361, kbg: 98, bkb: 35 }),
        ],
      },
    ],
  },
  /** Dropkick behind her (Sheik's b-air). */
  bair: {
    kind: 'aerial',
    faf: 33,
    landingLag: 6,
    autoCancel: [
      [1, 5],
      [20, 33],
    ],
    hits: [
      {
        frames: [6, 8],
        boxes: [box(0, -9, 7, 5, { damage: 9.5, angle: 361, kbg: 98, bkb: 30, direction: 'back' })],
      },
    ],
  },
  /** Flip Kick overhead: the roster gives both twins 7%, so hers just covers more (Fireboy's Mario values). */
  uair: {
    kind: 'aerial',
    faf: 30,
    landingLag: 6,
    autoCancel: [
      [1, 3],
      [17, 30],
    ],
    hits: [
      {
        frames: [4, 8],
        boxes: [box(0, 0, 15.5, 6, { damage: 7, angle: 70, kbg: 120, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Spiral: a water drill, five quick hits that drag down (Fireboy's), then a pop-up (Sheik's u-air finisher). */
  dair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 15,
    autoCancel: [
      [1, 4],
      [34, 40],
    ],
    hits: [
      ...[5, 8, 11, 14, 17].map((from) => ({
        frames: [from, from + 1] as [number, number],
        rehit: true,
        boxes: [box(0, 1, 1, 5.5, { damage: 1.2, angle: 280, kbg: 100, bkb: 0, wbkb: 20 })],
      })),
      {
        frames: [20, 21],
        rehit: true,
        boxes: [box(0, 1, 2, 6.5, { damage: 5, angle: 80, kbg: 138, bkb: 50, direction: 'away' })],
      },
    ],
  },
  /** Grabs: the roster's standard grab, on Fireboy's (Mario's) frame data and reach. */
  grab: { kind: 'other', faf: 35, hits: [{ frames: [6, 7], boxes: [grabBox(0, 7.5, 7, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 43, hits: [{ frames: [9, 10], boxes: [grabBox(0, 8.5, 7, 5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 37, hits: [{ frames: [10, 11], boxes: [grabBox(0, 9, 7, 5.5)] }] },
  /** Splash: Mario's 1.3% with his 14 frames of hitlag. */
  pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Shove: a two-handed push of water. Throws keep Fireboy's Mario values at the roster's damage. */
  fthrow: {
    kind: 'other',
    faf: 28,
    hits: [],
    throw: { frame: 13, hit: { damage: 8, angle: 45, kbg: 55, bkb: 45 } },
  },
  /** Twin Swing: spins the opponent round in a whirlpool and lets go behind her. */
  bthrow: {
    kind: 'other',
    faf: 60,
    hits: [],
    throw: { frame: 44, hit: { damage: 10, angle: 45, kbg: 75, bkb: 50, direction: 'back' } },
  },
  /** Pillar Toss: a water pillar launches the opponent straight up. */
  uthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 7, angle: 88, kbg: 70, bkb: 60 } },
  },
  /** Push Box: drops a Forest Temple box on the opponent; low knockback for follow-ups at low %. */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 5, angle: 70, kbg: 45, bkb: 55 } },
  },
  /**
   * Geyser (up special): she rides a water geyser about 20% higher than Fireboy's Flame Jump, steerable with the
   * stick, splashing anyone above her with weak hits and a last launching one (Mario's Super Jump Punch knockback).
   * Slower to start than his (frame 6 against his 4). Leaves her helpless and can grab the ledge on the way up.
   */
  upB: {
    kind: 'other',
    faf: 48,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 14,
    landingLag: 20,
    hits: [
      geyserHit(6),
      geyserHit(10),
      geyserHit(14),
      geyserHit(18),
      {
        frames: [22, 24],
        rehit: true,
        boxes: [box(0, 1, 10, 6, { damage: 2, angle: 60, kbg: 145, bkb: 50 })],
      },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < 6) {
        f.vel.x *= 0.8;
        f.vel.y = Math.max(f.vel.y, 0);
        return;
      }
      if (f.actionFrame <= 28) {
        f.vel.y = 3.4 - (f.actionFrame - 6) * 0.1;
        f.vel.x = stickX(c) * 1.1;
      }
    },
  },
  /** Swap (down special): Fireboy takes over. */
  downB: swap('fireboy'),
};
