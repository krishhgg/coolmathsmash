import type { HitboxDef, MoveDef } from '../types';
import { startMove } from '../../sim/actions/attack';

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({ id, x, y, radius, ...hit });

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/** Shell Pound: the frame the shell starts to plunge, and its speed. */
export const DAIR_PLUNGE_FROM = 13;
export const DAIR_PLUNGE_SPEED = 2.8;

/**
 * Snail Bob's moves (handoffs/research/roster.md, "5. Snail Bob"): damage and first active frames are the
 * roster's; knockback growth and base are Ultimate-style values for moves like them (CREW.md, "Knockback
 * values": retuned once COOL-3's KO calibration lands). He is slow and heavy, so his endlag is long. Frame windows are
 * inclusive, faf is the first actionable frame, and move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /** Snail Punches, first hit: a little jab. */
  jab: {
    kind: 'other',
    faf: 20,
    hits: [{ frames: [4, 5], boxes: [box(0, 9, 6, 3.5, { damage: 2, angle: 361, kbg: 30, bkb: 18 })] }],
  },
  /** Shell Bump: turns and bumps with the shell. */
  ftilt: {
    kind: 'other',
    faf: 34,
    hits: [
      {
        frames: [8, 10],
        boxes: [
          box(0, 10.5, 6, 5, { damage: 9, angle: 361, kbg: 98, bkb: 14 }),
          box(1, 5, 6, 4, { damage: 9, angle: 361, kbg: 98, bkb: 14 }),
        ],
      },
    ],
  },
  /** Antenna Whip: the eyestalks whip overhead, front to back; launches up for juggles. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 11],
        boxes: [
          box(0, 2, 15, 5, { damage: 6, angle: 95, kbg: 120, bkb: 32, direction: 'away' }),
          box(1, 6, 11, 4, { damage: 6, angle: 95, kbg: 120, bkb: 32, direction: 'away' }),
        ],
      },
    ],
  },
  /** Slime Trail: a low slither that knocks feet out from under opponents at a low angle. */
  dtilt: {
    kind: 'other',
    faf: 25,
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 11, 2, 4, { damage: 5, angle: 25, kbg: 45, bkb: 40 }),
          box(1, 6, 2, 3.5, { damage: 5, angle: 25, kbg: 45, bkb: 40 }),
        ],
      },
    ],
  },
  /** Shell Slide: pulls into the shell and slides along the ground; weaker late. */
  dashAttack: {
    kind: 'other',
    faf: 44,
    hits: [
      { frames: [9, 12], boxes: [box(0, 6, 5, 6, { damage: 10, angle: 50, kbg: 80, bkb: 60 })] },
      { frames: [13, 24], boxes: [box(0, 6, 5, 5.5, { damage: 6, angle: 50, kbg: 70, bkb: 45 })] },
    ],
    script({ f }) {
      if (f.actionFrame < 9) f.vel.x *= 0.9;
      else if (f.actionFrame <= 28) f.vel.x = f.facing * Math.max(2 - (f.actionFrame - 9) * 0.085, 0.2);
    },
  },
  /** Lever Punch: yanks a construction lever and a girder swings forward. His main kill move. */
  fsmash: {
    kind: 'smash',
    faf: 56,
    charge: 11,
    hits: [
      {
        frames: [16, 18],
        boxes: [
          box(0, 15, 7, 5.5, { damage: 16, angle: 361, kbg: 104, bkb: 30 }),
          box(1, 8, 7, 4, { damage: 14, angle: 361, kbg: 104, bkb: 25 }),
        ],
      },
    ],
  },
  /** Shell Pop: pops the shell straight up out of the ground. */
  usmash: {
    kind: 'smash',
    faf: 50,
    charge: 7,
    hits: [
      {
        frames: [12, 15],
        boxes: [
          box(0, 0, 15, 6.5, { damage: 15, angle: 88, kbg: 93, bkb: 34, direction: 'away' }),
          box(1, 0, 7, 6, { damage: 13, angle: 88, kbg: 93, bkb: 30, direction: 'away' }),
        ],
      },
    ],
  },
  /** Shell Spin: spins in place in the shell, front then back, at a low angle. */
  dsmash: {
    kind: 'smash',
    faf: 48,
    charge: 4,
    hits: [
      {
        frames: [10, 11],
        boxes: [box(0, 9, 4, 5.5, { damage: 13, angle: 30, kbg: 95, bkb: 30 })],
      },
      {
        frames: [14, 15],
        boxes: [box(0, -9, 4, 5.5, { damage: 12, angle: 30, kbg: 95, bkb: 30, direction: 'back' })],
      },
    ],
  },
  /** Spins up from the floor in the shell, hitting both sides; intangible until the second hit ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 9, 4, 5.5, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -9, 4, 5.5, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Shell Tuck: tucks into the shell and spins; strong early, weaker lingering hit. */
  nair: {
    kind: 'aerial',
    faf: 42,
    landingLag: 9,
    autoCancel: [
      [1, 3],
      [34, 42],
    ],
    hits: [
      {
        frames: [6, 9],
        boxes: [box(0, 0, 6, 7.5, { damage: 9, angle: 361, kbg: 100, bkb: 15, direction: 'away' })],
      },
      {
        frames: [10, 24],
        boxes: [box(0, 0, 6, 7, { damage: 6, angle: 361, kbg: 90, bkb: 10, direction: 'away' })],
      },
    ],
  },
  /** Shell Punch: punches forward out of the shell. */
  fair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 12,
    autoCancel: [
      [1, 2],
      [32, 40],
    ],
    hits: [
      {
        frames: [10, 12],
        boxes: [
          box(0, 10, 6, 4.5, { damage: 11, angle: 361, kbg: 100, bkb: 20 }),
          box(1, 5.5, 7, 3.5, { damage: 10, angle: 361, kbg: 100, bkb: 18 }),
        ],
      },
    ],
  },
  /** Shell Bash: bashes backward with the shell; his aerial kill move. */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 10,
    autoCancel: [
      [1, 3],
      [26, 36],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: [box(0, -9, 6, 6, { damage: 12, angle: 361, kbg: 100, bkb: 25, direction: 'back' })],
      },
      {
        frames: [12, 16],
        boxes: [box(0, -8, 6, 5, { damage: 8, angle: 361, kbg: 100, bkb: 10, direction: 'back' })],
      },
    ],
  },
  /** Eyestalk Flick: flicks the eyestalks overhead. */
  uair: {
    kind: 'aerial',
    faf: 32,
    landingLag: 8,
    autoCancel: [
      [1, 2],
      [22, 32],
    ],
    hits: [
      {
        frames: [6, 10],
        boxes: [
          box(0, 1, 16, 5, { damage: 8, angle: 75, kbg: 108, bkb: 35, direction: 'away' }),
          box(1, 5, 13, 4, { damage: 8, angle: 75, kbg: 108, bkb: 35, direction: 'away' }),
        ],
      },
    ],
  },
  /**
   * Shell Pound (the video's ground pound): Bob hangs for a moment, rising a little, then drops shell-first.
   * The early drop meteors (frames 16-20), the rest of the drop hits normally, and landing always turns into the
   * shockwave and its lag (`dairLand`), so `landingLag` only mirrors that. The script owns the fall, so it marks
   * him fast-falling to keep a down flick from overriding it; if the move ends in the air he keeps falling fast.
   */
  dair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 29,
    continuesOnLanding: true,
    hits: [
      {
        frames: [16, 20],
        boxes: [box(0, 0, 1, 6, { damage: 14, angle: 270, kbg: 80, bkb: 30 })],
      },
      {
        frames: [21, 45],
        boxes: [box(0, 0, 2, 5.5, { damage: 9, angle: 361, kbg: 85, bkb: 25, direction: 'away' })],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.ground) {
        startMove(x, 'dairLand');
        return;
      }
      f.fastFalling = true;
      if (f.actionFrame < DAIR_PLUNGE_FROM) {
        f.vel.x *= 0.85;
        f.vel.y = 0.5 - f.actionFrame * 0.05;
      } else f.vel.y = -DAIR_PLUNGE_SPEED;
    },
  },
  /** Shell Pound landing: the shockwave on both sides, then the shell's landing lag. */
  dairLand: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [1, 3],
        boxes: [
          box(0, 8, 2, 5, { damage: 4, angle: 361, kbg: 70, bkb: 50 }),
          box(1, -8, 2, 5, { damage: 4, angle: 361, kbg: 70, bkb: 50, direction: 'back' }),
        ],
      },
    ],
  },
  /** Grabs: slow, short-armed (frame 9, about 11.5 units against Mario's 12 from a wider body). */
  grab: { kind: 'other', faf: 40, hits: [{ frames: [9, 10], boxes: [grabBox(0, 7.5, 6, 4)] }] },
  dashGrab: { kind: 'other', faf: 48, hits: [{ frames: [11, 12], boxes: [grabBox(0, 8.5, 6, 4.5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 44, hits: [{ frames: [12, 13], boxes: [grabBox(0, 9, 6, 5)] }] },
  /** Slime: a slimy squeeze. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.2, hitlag: 2 } },
  /** Shell Shove: shoves them away with the shell. */
  fthrow: {
    kind: 'other',
    faf: 34,
    hits: [],
    throw: { frame: 14, hit: { damage: 8, angle: 45, kbg: 60, bkb: 55 } },
  },
  /** Roll Over: rolls backward over them; his kill throw at the ledge. */
  bthrow: {
    kind: 'other',
    faf: 46,
    hits: [],
    throw: { frame: 24, hit: { damage: 10, angle: 45, kbg: 66, bkb: 55, direction: 'back' } },
  },
  /** Crane Magnet: a construction magnet hauls them up and lets go. */
  uthrow: {
    kind: 'other',
    faf: 52,
    hits: [],
    throw: { frame: 30, hit: { damage: 9, angle: 90, kbg: 70, bkb: 65 } },
  },
  /** Shell Sit: sits on them shell-first; low knockback, a combo starter. */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 20, hit: { damage: 6, angle: 78, kbg: 45, bkb: 55 } },
  },
};
