import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';
import { swap } from './swap';

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

const fire = 'fire' as const;

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/**
 * Fireboy's moves, built on Ultimate middleweight frame data (Mario-like timings) with fire on his heavy hits.
 * Frame windows are inclusive, faf is the first actionable frame. Move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /** Quick flame jab. */
  jab: {
    kind: 'other',
    faf: 19,
    hits: [{ frames: [3, 4], boxes: [box(0, 6.5, 9, 3.5, { damage: 3, angle: 361, kbg: 50, bkb: 25 })] }],
  },
  /** Fiery kick at mid height. */
  ftilt: {
    kind: 'other',
    faf: 28,
    hits: [{ frames: [5, 7], boxes: [box(0, 9, 7, 4, { damage: 8, angle: 361, kbg: 100, bkb: 8 })] }],
  },
  /** Overhead flame swipe; launches up for juggles. */
  utilt: {
    kind: 'other',
    faf: 31,
    hits: [
      {
        frames: [5, 11],
        boxes: [box(0, 2, 16, 5, { damage: 5.5, angle: 96, kbg: 130, bkb: 22, direction: 'away' })],
      },
    ],
  },
  /** Low sweep that pops opponents up. */
  dtilt: {
    kind: 'other',
    faf: 21,
    hits: [{ frames: [5, 7], boxes: [box(0, 8.5, 2, 4, { damage: 6, angle: 80, kbg: 45, bkb: 50 })] }],
  },
  /** Flaming shoulder charge; weaker late. */
  dashAttack: {
    kind: 'other',
    faf: 39,
    hits: [
      { frames: [6, 10], boxes: [box(0, 6, 7, 5, { damage: 8, angle: 70, kbg: 90, bkb: 60, effect: fire })] },
      {
        frames: [11, 25],
        boxes: [box(0, 6, 7, 4.5, { damage: 5, angle: 70, kbg: 90, bkb: 40, effect: fire })],
      },
    ],
  },
  /** Forward fire burst: Fireboy's main kill move. Charges on frame 12. */
  fsmash: {
    kind: 'smash',
    faf: 50,
    charge: 12,
    hits: [
      {
        frames: [15, 17],
        boxes: [
          box(0, 12, 8.5, 5.5, { damage: 17.8, angle: 361, kbg: 102, bkb: 30, effect: fire }),
          box(1, 6, 8.5, 3.5, { damage: 14.7, angle: 361, kbg: 102, bkb: 25, effect: fire }),
        ],
      },
    ],
  },
  /** Flame pillar overhead. */
  usmash: {
    kind: 'smash',
    faf: 40,
    charge: 6,
    hits: [
      {
        frames: [9, 12],
        boxes: [
          box(0, 1, 15, 6, { damage: 14, angle: 85, kbg: 97, bkb: 32, effect: fire, direction: 'away' }),
        ],
      },
    ],
  },
  /** Flames along the ground on both sides: front first, then back. */
  dsmash: {
    kind: 'smash',
    faf: 49,
    charge: 3,
    hits: [
      {
        frames: [5, 6],
        boxes: [box(0, 8, 2, 4.5, { damage: 10, angle: 25, kbg: 100, bkb: 20, effect: fire })],
      },
      {
        frames: [14, 15],
        boxes: [
          box(0, -8, 2, 4.5, { damage: 12, angle: 25, kbg: 100, bkb: 20, effect: fire, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up from the floor swinging a flame to both sides; intangible until the second swing ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      {
        frames: [17, 18],
        boxes: [box(0, 8, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80, effect: fire })],
      },
      {
        frames: [25, 26],
        boxes: [
          box(0, -8, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80, effect: fire, direction: 'back' }),
        ],
      },
    ],
  },
  /** Spinning ember: strong early, weaker lingering hit. */
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
        boxes: [box(0, 0, 7.5, 6.5, { damage: 8, angle: 361, kbg: 100, bkb: 10, direction: 'away' })],
      },
      {
        frames: [7, 30],
        boxes: [box(0, 0, 7.5, 6, { damage: 5, angle: 361, kbg: 100, bkb: 10, direction: 'away' })],
      },
    ],
  },
  /** Slow downward fire punch that meteors at the fist. */
  fair: {
    kind: 'aerial',
    faf: 59,
    landingLag: 17,
    autoCancel: [
      [1, 2],
      [49, 59],
    ],
    hits: [
      {
        frames: [16, 18],
        boxes: [
          box(0, 9, 6, 4, { damage: 14, angle: 290, kbg: 70, bkb: 20, effect: fire }),
          box(1, 5, 9, 4, { damage: 12, angle: 361, kbg: 100, bkb: 10, effect: fire }),
        ],
      },
    ],
  },
  /** Back kick. */
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
        boxes: [box(0, -8, 7, 4.5, { damage: 10.5, angle: 361, kbg: 100, bkb: 10, direction: 'back' })],
      },
    ],
  },
  /** Flame flip overhead. */
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
        boxes: [box(0, 0, 15, 5, { damage: 7, angle: 70, kbg: 120, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Drilling fire feet: four quick hits that drag down, then a launcher. */
  dair: {
    kind: 'aerial',
    faf: 37,
    landingLag: 15,
    autoCancel: [
      [1, 4],
      [32, 37],
    ],
    hits: [
      {
        frames: [5, 6],
        rehit: true,
        boxes: [box(0, 1, 1, 5, { damage: 1.4, angle: 280, kbg: 100, bkb: 0, wbkb: 20 })],
      },
      {
        frames: [8, 9],
        rehit: true,
        boxes: [box(0, 1, 1, 5, { damage: 1.4, angle: 280, kbg: 100, bkb: 0, wbkb: 20 })],
      },
      {
        frames: [11, 12],
        rehit: true,
        boxes: [box(0, 1, 1, 5, { damage: 1.4, angle: 280, kbg: 100, bkb: 0, wbkb: 20 })],
      },
      {
        frames: [14, 15],
        rehit: true,
        boxes: [box(0, 1, 1, 5, { damage: 1.4, angle: 280, kbg: 100, bkb: 0, wbkb: 20 })],
      },
      {
        frames: [17, 18],
        rehit: true,
        boxes: [
          box(0, 1, 2, 6, { damage: 5.5, angle: 361, kbg: 140, bkb: 30, effect: fire, direction: 'away' }),
        ],
      },
    ],
  },
  /** Grabs, on Mario's frame data (UFD); the standing grab reaches 12 units, like Mario's. */
  grab: { kind: 'other', faf: 35, hits: [{ frames: [6, 7], boxes: [grabBox(0, 7.5, 7, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 43, hits: [{ frames: [9, 10], boxes: [grabBox(0, 8.5, 7, 5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 37, hits: [{ frames: [10, 11], boxes: [grabBox(0, 9, 7, 5.5)] }] },
  /** Hot-hands squeeze. Mario's 1.3% with his 14 frames of hitlag. */
  pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Flaming shove. */
  fthrow: {
    kind: 'other',
    faf: 28,
    hits: [],
    throw: { frame: 13, hit: { damage: 8, angle: 45, kbg: 70, bkb: 60, effect: fire } },
  },
  /** Spins the opponent round in a fire wheel and flings them behind: his kill throw near the ledge. */
  bthrow: {
    kind: 'other',
    faf: 60,
    hits: [],
    throw: { frame: 44, hit: { damage: 11, angle: 45, kbg: 70, bkb: 60, effect: fire, direction: 'back' } },
  },
  /** Heaves the opponent overhead on a burst of flame. */
  uthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 7, angle: 88, kbg: 70, bkb: 60, effect: fire } },
  },
  /** Slams the opponent onto the embers; low knockback for follow-ups at low %. */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 5, angle: 70, kbg: 45, bkb: 55 } },
  },
  /**
   * Flame Jump (up special): a rising column of fire, steerable with the stick. Leaves Fireboy helpless and can
   * grab the ledge on the way up.
   */
  upB: {
    kind: 'other',
    faf: 42,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 12,
    landingLag: 20,
    hits: [
      { frames: [4, 6], boxes: [box(0, 3, 8, 6, { damage: 7, angle: 80, kbg: 60, bkb: 60, effect: fire })] },
      {
        frames: [7, 20],
        boxes: [box(0, 0, 9, 5.5, { damage: 3, angle: 80, kbg: 80, bkb: 30, effect: fire })],
      },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < 4) {
        f.vel.x *= 0.8;
        f.vel.y = Math.max(f.vel.y, 0);
        return;
      }
      if (f.actionFrame <= 24) {
        f.vel.y = 3.4 - (f.actionFrame - 4) * 0.12;
        f.vel.x = stickX(c) * 1.1;
      }
    },
  },
  /** Swap (down special): Watergirl takes over. */
  downB: swap('watergirl'),
};
