import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';
import { moves as fireboyMoves } from '../fireboy/moves';
import { swap } from '../fireboy/swap';
import { waterStream } from './waterStream';

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

/** Geyser: climb speed on frames from..to, tapering each frame, and the stick's steering speed. */
const GEYSER = { from: 3, to: 26, rise: 3.4, taper: 0.1, steer: 1.1 };

/** Temple Mirror (side special) is the twins' shared move: she keeps Fireboy's once he has one (COOL-3's #37). */
const templeMirror = fireboyMoves.sideB && { sideB: fireboyMoves.sideB };

/**
 * Watergirl's moves: Mario's kit in Ultimate (the roster's "Mario frame" list), with her own damage from the roster
 * sheet and her extra range in hitbox size and position. Angle, BKB, KBG and frame data come from each move's
 * Ultimate analogue (SmashWiki hitbox tables, UFD); a sourspot keeps the analogue's damage ratio to its sweetspot.
 * Frame windows are inclusive and faf is the first actionable frame; move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /** 1-2-Kick, first punch: Mario's jab 1 (the tip box is his far box, 361/15/20). Attack again for jab2. */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [5, 20], move: 'jab2' },
    hits: [
      {
        frames: [2, 3],
        boxes: [
          box(0, 6.5, 8.5, 3, { damage: 2, angle: 361, kbg: 30, bkb: 20 }),
          box(1, 10, 8.5, 2.5, { damage: 2, angle: 361, kbg: 20, bkb: 15 }),
        ],
      },
    ],
  },
  /** 1-2-Kick, second punch: Mario's jab 2. Attack again for the kick. */
  jab2: {
    kind: 'other',
    faf: 22,
    next: { window: [6, 22], move: 'jab3' },
    hits: [
      {
        frames: [2, 3],
        boxes: [
          box(0, 6.5, 8, 3, { damage: 1.5, angle: 361, kbg: 30, bkb: 20 }),
          box(1, 10.5, 8, 2.5, { damage: 1.5, angle: 361, kbg: 15, bkb: 15 }),
        ],
      },
    ],
  },
  /** 1-2-Kick, the splash kick: Mario's jab 3. */
  jab3: {
    kind: 'other',
    faf: 34,
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 10, 6.5, 4, { damage: 4, angle: 361, kbg: 80, bkb: 60 }),
          box(1, 5, 6, 3, { damage: 4, angle: 361, kbg: 80, bkb: 60 }),
        ],
      },
    ],
  },
  /** Hair Whip: Mario's forward tilt. The waterfall ponytail reaches 6 units past Fireboy's flame hair. */
  ftilt: {
    kind: 'other',
    faf: 26,
    hits: [
      {
        frames: [5, 7],
        boxes: [
          box(0, 15, 8, 4, { damage: 7, angle: 361, kbg: 70, bkb: 55 }),
          box(1, 10, 8, 3.5, { damage: 7, angle: 361, kbg: 70, bkb: 55 }),
          box(2, 5.5, 7.5, 3, { damage: 7, angle: 361, kbg: 70, bkb: 55 }),
        ],
      },
    ],
  },
  /** Hair Flick: Mario's up tilt, a juggle starter. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [5, 11],
        boxes: [
          box(0, 1, 16, 5, { damage: 5.5, angle: 96, kbg: 130, bkb: 28, direction: 'away' }),
          box(1, 4, 11, 4, { damage: 5.5, angle: 96, kbg: 130, bkb: 28, direction: 'away' }),
        ],
      },
    ],
  },
  /** Temple Slide: Mario's down tilt, a low kick; the knee hits harder than the toe. */
  dtilt: {
    kind: 'other',
    faf: 28,
    hits: [
      {
        frames: [5, 7],
        boxes: [
          box(0, 5.5, 2, 3.5, { damage: 6.5, angle: 80, kbg: 80, bkb: 35 }),
          box(1, 10, 1.5, 4, { damage: 4.6, angle: 80, kbg: 80, bkb: 35 }),
        ],
      },
    ],
  },
  /** Element Skid: Mario's dash attack, a feet-first slide; weaker late. */
  dashAttack: {
    kind: 'other',
    faf: 38,
    hits: [
      { frames: [6, 9], boxes: [box(0, 6.5, 3.5, 4.5, { damage: 8, angle: 50, kbg: 43, bkb: 100 })] },
      { frames: [10, 25], boxes: [box(0, 6, 3.5, 4, { damage: 6, angle: 48, kbg: 30, bkb: 100 })] },
    ],
  },
  /** Element Palm: Mario's forward smash (angled forward), the water burst reaching farther than Fireboy's flames. */
  fsmash: {
    kind: 'smash',
    faf: 48,
    charge: 5,
    hits: [
      {
        frames: [15, 17],
        boxes: [
          box(0, 14, 8.5, 6, { damage: 15, angle: 361, kbg: 99, bkb: 25 }),
          box(1, 7, 8.5, 3.5, { damage: 12.4, angle: 361, kbg: 105, bkb: 25 }),
        ],
      },
    ],
  },
  /** Pillar Headbutt: Mario's up smash. */
  usmash: {
    kind: 'smash',
    faf: 40,
    charge: 6,
    hits: [
      {
        frames: [9, 12],
        boxes: [
          box(0, 1, 16, 5.5, { damage: 13, angle: 83, kbg: 94, bkb: 32, direction: 'away' }),
          box(1, 0.5, 10.5, 4, { damage: 13, angle: 83, kbg: 94, bkb: 32, direction: 'away' }),
        ],
      },
    ],
  },
  /** Split Sweep: Mario's down smash, low kicks to the front, then the back. */
  dsmash: {
    kind: 'smash',
    faf: 44,
    charge: 2,
    hits: [
      {
        frames: [5, 6],
        boxes: [
          box(0, 11, 2.5, 4, { damage: 10, angle: 32, kbg: 100, bkb: 30 }),
          box(1, 6.5, 2.5, 3.5, { damage: 10, angle: 32, kbg: 100, bkb: 30 }),
        ],
      },
      {
        frames: [14, 14],
        boxes: [
          box(0, -10.5, 2.5, 4, { damage: 11, angle: 30, kbg: 100, bkb: 30, direction: 'back' }),
          box(1, -6, 2.5, 3.5, { damage: 11, angle: 30, kbg: 100, bkb: 30, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up with a sweep behind, then in front: Mario's floor attack (front), intangible until it ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 22],
    hits: [
      {
        frames: [16, 17],
        boxes: [box(0, -8.5, 4, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80, direction: 'back' })],
      },
      { frames: [21, 22], boxes: [box(0, 8.5, 4, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80 })] },
    ],
  },
  /** Twirl Kick: Mario's neutral aerial, a sex kick that is strong early and lingers weakly. */
  nair: {
    kind: 'aerial',
    faf: 46,
    landingLag: 6,
    autoCancel: [
      [1, 2],
      [39, 46],
    ],
    hits: [
      {
        frames: [3, 5],
        boxes: [box(0, 0, 7.5, 6.5, { damage: 7.5, angle: 361, kbg: 100, bkb: 20, direction: 'away' })],
      },
      {
        frames: [6, 27],
        boxes: [box(0, 0, 7.5, 6, { damage: 4.7, angle: 361, kbg: 90, bkb: 13, direction: 'away' })],
      },
    ],
  },
  /**
   * Element Chop: an overhead chop that doesn't meteor. Mario's fair meteors, so this is Toon Link's forward
   * aerial, the Ultimate overhead swing with her role (a spacer's long, non-meteor chop; Toon Link is also her stat
   * template). It reaches 5 units past Fireboy's.
   */
  fair: {
    kind: 'aerial',
    faf: 39,
    landingLag: 11,
    autoCancel: [
      [1, 3],
      [39, 39],
    ],
    hits: [
      {
        frames: [14, 15],
        boxes: [
          box(0, 13, 8, 5, { damage: 11, angle: 361, kbg: 98, bkb: 35 }),
          box(1, 8.5, 10, 4.5, { damage: 11, angle: 361, kbg: 98, bkb: 35 }),
          box(2, 4, 10.5, 3.5, { damage: 11, angle: 361, kbg: 98, bkb: 35 }),
        ],
      },
    ],
  },
  /** Dropkick: Mario's back aerial; weaker late. */
  bair: {
    kind: 'aerial',
    faf: 34,
    landingLag: 6,
    autoCancel: [
      [1, 5],
      [19, 34],
    ],
    hits: [
      {
        frames: [6, 7],
        boxes: [
          box(0, -9, 7, 4.5, { damage: 10, angle: 361, kbg: 106, bkb: 12, direction: 'back' }),
          box(1, -5, 7, 4, { damage: 10, angle: 361, kbg: 106, bkb: 12, direction: 'back' }),
        ],
      },
      {
        frames: [8, 10],
        boxes: [box(0, -9, 7, 4.5, { damage: 6.7, angle: 361, kbg: 90, bkb: 7, direction: 'back' })],
      },
    ],
  },
  /** Flip Kick: Mario's up aerial, a juggle. */
  uair: {
    kind: 'aerial',
    faf: 31,
    landingLag: 6,
    autoCancel: [
      [1, 1],
      [17, 31],
    ],
    hits: [
      {
        frames: [4, 7],
        boxes: [
          box(0, 0, 15.5, 5, { damage: 7, angle: 75, kbg: 135, bkb: 10, direction: 'away' }),
          box(1, 3, 12, 4, { damage: 7, angle: 75, kbg: 135, bkb: 10, direction: 'away' }),
        ],
      },
    ],
  },
  /** Spiral: Mario's down aerial (Mario Tornado), five spinning hits and a last one that pops up. */
  dair: {
    kind: 'aerial',
    faf: 38,
    landingLag: 15,
    autoCancel: [
      [1, 4],
      [33, 38],
    ],
    hits: [
      ...[5, 7, 9, 11, 13].map((frame) => ({
        frames: [frame, frame] as [number, number],
        rehit: true,
        boxes: [
          box(0, 0, 0, 4, { damage: 1.2, angle: 94, kbg: 15, bkb: 50, direction: 'away' }),
          box(1, 0, 6, 7, { damage: 1.2, angle: 94, kbg: 15, bkb: 25, direction: 'away' }),
        ],
      })),
      {
        frames: [23, 23],
        rehit: true,
        boxes: [box(0, 0, 7, 11, { damage: 5, angle: 75, kbg: 100, bkb: 80, direction: 'away' })],
      },
    ],
  },
  /** Grabs: Fireboy's (Mario's frame data, UFD); the standing grab reaches 12 units, like Mario's. */
  grab: { kind: 'other', faf: 35, hits: [{ frames: [6, 7], boxes: [grabBox(0, 7.5, 7, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 43, hits: [{ frames: [9, 10], boxes: [grabBox(0, 8.5, 7, 5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 37, hits: [{ frames: [10, 11], boxes: [grabBox(0, 9, 7, 5.5)] }] },
  /** Splash: Mario's pummel, 1.3% with his 14 frames of hitlag. */
  pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Shove: Mario's forward throw. */
  fthrow: {
    kind: 'other',
    faf: 28,
    hits: [],
    throw: { frame: 13, hit: { damage: 8, angle: 45, kbg: 65, bkb: 60 } },
  },
  /** Twin Swing: Mario's back throw, swung round and let go behind. */
  bthrow: {
    kind: 'other',
    faf: 60,
    hits: [],
    throw: { frame: 44, hit: { damage: 10, angle: 45, kbg: 66, bkb: 70, direction: 'back' } },
  },
  /** Pillar Toss: Mario's up throw, a water pillar overhead. */
  uthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 7, angle: 90, kbg: 72, bkb: 70 } },
  },
  /** Push Box: Mario's down throw, low knockback for follow-ups. */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 5, angle: 68, kbg: 90, bkb: 40 } },
  },
  /**
   * Geyser (up special): Mario's Super Jump Punch timing and knockback (a 2% opener, three set-knockback hits that
   * carry the opponent up, a 2% finisher), riding a geyser about 20% higher than Fireboy's Flame Jump. Steerable,
   * ends helpless, and can grab the ledge on the way up.
   */
  upB: {
    kind: 'other',
    faf: 38,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 12,
    landingLag: 30,
    hits: [
      {
        frames: [3, 6],
        boxes: [
          box(0, 0, 6, 6, { damage: 2, angle: 86, kbg: 100, bkb: 0, wbkb: 150 }),
          box(1, 6.5, 7, 4, { damage: 2, angle: 100, kbg: 100, bkb: 0, wbkb: 150 }),
        ],
      },
      ...(
        [
          [7, 9],
          [10, 12],
          [13, 16],
        ] as [number, number][]
      ).map((frames) => ({
        frames,
        rehit: true,
        boxes: [
          box(0, 0, 6, 5.5, { damage: 2, angle: 92, kbg: 100, bkb: 0, wbkb: 170 }),
          box(1, 0, 12.5, 5, { damage: 2, angle: 92, kbg: 100, bkb: 0, wbkb: 110 }),
        ],
      })),
      {
        frames: [17, 18],
        rehit: true,
        boxes: [box(0, 0, 12, 7, { damage: 2, angle: 60, kbg: 145, bkb: 50 })],
      },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < GEYSER.from) {
        f.vel.x *= 0.8;
        f.vel.y = Math.max(f.vel.y, 0);
        return;
      }
      if (f.actionFrame <= GEYSER.to) {
        f.vel.y = GEYSER.rise - (f.actionFrame - GEYSER.from) * GEYSER.taper;
        f.vel.x = stickX(c) * GEYSER.steer;
      }
    },
  },
  /** Water Stream (neutral special): src/fighters/watergirl/waterStream.ts. */
  ...waterStream,
  /** Swap (down special): Fireboy takes over. */
  downB: swap('fireboy'),
  ...templeMirror,
};
