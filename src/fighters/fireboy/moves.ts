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
 * Fireboy's moves: Mario's kit in Ultimate (the roster's "Mario frame" list), with fire on his heavy hits and his
 * own damage from the roster sheet. Angle, BKB, KBG and frame data come from each move's Mario analogue (SmashWiki
 * hitbox tables, UFD); a weaker late or far hit keeps Mario's damage ratio to the main hit. Frame windows are
 * inclusive, faf is the first actionable frame. Move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /**
   * 1-2-Kick (roster): punch, punch, fiery kick, chained with Attack. Mario's jab is the analogue for every hit:
   * frames, cancel windows, angles, BKB and KBG from Ultimate (UFD, Dragdown); the damage is the roster's, with
   * the burning kick 0.5% over Mario's.
   */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [5, 19], move: 'jab2' },
    hits: [{ frames: [2, 3], boxes: [box(0, 6.5, 9, 3.5, { damage: 2.2, angle: 361, kbg: 30, bkb: 20 })] }],
  },
  jab2: {
    kind: 'other',
    faf: 22,
    next: { window: [6, 21], move: 'jab3' },
    hits: [{ frames: [2, 3], boxes: [box(0, 6, 6, 3.5, { damage: 1.7, angle: 361, kbg: 30, bkb: 20 })] }],
  },
  jab3: {
    kind: 'other',
    faf: 34,
    hits: [
      {
        frames: [3, 4],
        boxes: [box(0, 6.5, 6, 4, { damage: 4.5, angle: 361, kbg: 80, bkb: 60, effect: fire })],
      },
    ],
  },
  /** Fiery kick at mid height: Mario's forward tilt. */
  ftilt: {
    kind: 'other',
    faf: 26,
    hits: [{ frames: [5, 7], boxes: [box(0, 9, 7, 4, { damage: 8, angle: 361, kbg: 70, bkb: 55 })] }],
  },
  /** Overhead flame swipe; launches up for juggles. Mario's up tilt. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [5, 11],
        boxes: [box(0, 2, 16, 5, { damage: 6, angle: 96, kbg: 130, bkb: 28, direction: 'away' })],
      },
    ],
  },
  /** Low sweep that pops opponents up: Mario's down tilt (its close hit). */
  dtilt: {
    kind: 'other',
    faf: 28,
    hits: [{ frames: [5, 7], boxes: [box(0, 8.5, 2, 4, { damage: 7, angle: 80, kbg: 80, bkb: 35 })] }],
  },
  /** Flaming shoulder charge; weaker late. Mario's dash attack. */
  dashAttack: {
    kind: 'other',
    faf: 38,
    hits: [
      { frames: [6, 9], boxes: [box(0, 6, 7, 5, { damage: 9, angle: 50, kbg: 43, bkb: 100, effect: fire })] },
      {
        frames: [10, 25],
        boxes: [box(0, 6, 7, 4.5, { damage: 6.8, angle: 48, kbg: 30, bkb: 100, effect: fire })],
      },
    ],
  },
  /** Forward fire burst: Fireboy's main kill move. Mario's forward smash (angled forward); charges on frame 5. */
  fsmash: {
    kind: 'smash',
    faf: 48,
    charge: 5,
    hits: [
      {
        frames: [15, 17],
        boxes: [
          box(0, 12, 8.5, 5.5, { damage: 18, angle: 361, kbg: 99, bkb: 25, effect: fire }),
          box(1, 6, 8.5, 3.5, { damage: 14.9, angle: 361, kbg: 105, bkb: 25, effect: fire }),
        ],
      },
    ],
  },
  /** Flame pillar overhead: Mario's up smash. */
  usmash: {
    kind: 'smash',
    faf: 40,
    charge: 6,
    hits: [
      {
        frames: [9, 12],
        boxes: [
          box(0, 1, 15, 6, { damage: 14, angle: 83, kbg: 94, bkb: 32, effect: fire, direction: 'away' }),
        ],
      },
    ],
  },
  /** Flames along the ground on both sides: front first, then back. Mario's down smash. */
  dsmash: {
    kind: 'smash',
    faf: 44,
    charge: 2,
    hits: [
      {
        frames: [5, 6],
        boxes: [box(0, 8, 2, 4.5, { damage: 11, angle: 32, kbg: 100, bkb: 30, effect: fire })],
      },
      {
        frames: [14, 14],
        boxes: [
          box(0, -8, 2, 4.5, { damage: 12, angle: 30, kbg: 100, bkb: 30, effect: fire, direction: 'back' }),
        ],
      },
    ],
  },
  /**
   * Getting up from the floor swinging a flame to both sides. Mario's floor attack (front) timing and knockback,
   * front swing first, with the game's existing 26-frame getup protection.
   */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      {
        frames: [16, 17],
        boxes: [box(0, 8, 3, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80, effect: fire })],
      },
      {
        frames: [21, 22],
        boxes: [
          box(0, -8, 3, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80, effect: fire, direction: 'back' }),
        ],
      },
    ],
  },
  /** Spinning ember: strong early, weaker lingering hit. Mario's neutral aerial. */
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
        boxes: [box(0, 0, 7.5, 6.5, { damage: 8, angle: 361, kbg: 100, bkb: 20, direction: 'away' })],
      },
      {
        frames: [6, 27],
        boxes: [box(0, 0, 7.5, 6, { damage: 5, angle: 361, kbg: 90, bkb: 13, direction: 'away' })],
      },
    ],
  },
  /**
   * Slow downward fire punch: Mario's forward aerial. The raised arm hits first (frame 16), then the clean swing
   * meteors at the fist and arm (17-20), then a weak late hit (21).
   */
  fair: {
    kind: 'aerial',
    faf: 60,
    landingLag: 17,
    autoCancel: [
      [1, 2],
      [43, 60],
    ],
    hits: [
      {
        frames: [16, 16],
        boxes: [box(1, 5, 9, 4, { damage: 12, angle: 361, kbg: 80, bkb: 30, effect: fire })],
      },
      {
        frames: [17, 20],
        boxes: [
          box(0, 9, 6, 4, { damage: 14, angle: 280, kbg: 78, bkb: 32, effect: fire }),
          box(1, 5, 9, 4, { damage: 14, angle: 280, kbg: 78, bkb: 32, effect: fire }),
        ],
      },
      {
        frames: [21, 21],
        boxes: [
          box(0, 9, 6, 4, { damage: 10, angle: 361, kbg: 80, bkb: 20, effect: fire }),
          box(1, 5, 9, 4, { damage: 10, angle: 361, kbg: 80, bkb: 20, effect: fire }),
        ],
      },
    ],
  },
  /** Back kick: Mario's back aerial; weaker late. */
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
        boxes: [box(0, -8, 7, 4.5, { damage: 11, angle: 361, kbg: 106, bkb: 12, direction: 'back' })],
      },
      {
        frames: [8, 10],
        boxes: [box(0, -8, 7, 4.5, { damage: 7.3, angle: 361, kbg: 90, bkb: 7, direction: 'back' })],
      },
    ],
  },
  /** Flame flip overhead: Mario's up aerial. */
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
        boxes: [box(0, 0, 15, 5, { damage: 7, angle: 75, kbg: 135, bkb: 10, direction: 'away' })],
      },
    ],
  },
  /** Drilling fire feet: five quick hits, then a launcher. Mario's down aerial (Mario Tornado). */
  dair: {
    kind: 'aerial',
    faf: 38,
    landingLag: 15,
    autoCancel: [
      [1, 4],
      [33, 38],
    ],
    hits: [
      ...[5, 7, 9, 11, 13].map((frame): MoveDef['hits'][number] => ({
        frames: [frame, frame],
        rehit: true,
        boxes: [box(0, 1, 1, 5, { damage: 1.4, angle: 94, kbg: 15, bkb: 50, direction: 'away' })],
      })),
      {
        frames: [23, 23],
        rehit: true,
        boxes: [
          box(0, 1, 2, 6, { damage: 5, angle: 75, kbg: 100, bkb: 80, effect: fire, direction: 'away' }),
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
  /** Flaming shove: Mario's forward throw. */
  fthrow: {
    kind: 'other',
    faf: 28,
    hits: [],
    throw: { frame: 13, hit: { damage: 8, angle: 45, kbg: 65, bkb: 60, effect: fire } },
  },
  /** Spins the opponent round in a fire wheel and flings them behind: Mario's back throw, his kill throw. */
  bthrow: {
    kind: 'other',
    faf: 60,
    hits: [],
    throw: { frame: 44, hit: { damage: 11, angle: 45, kbg: 66, bkb: 70, effect: fire, direction: 'back' } },
  },
  /** Heaves the opponent overhead on a burst of flame: Mario's up throw. */
  uthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 7, angle: 90, kbg: 72, bkb: 70, effect: fire } },
  },
  /** Slams the opponent onto the embers; low knockback for follow-ups at low %. Mario's down throw. */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 18, hit: { damage: 5, angle: 68, kbg: 90, bkb: 40 } },
  },
  /** Fireball (neutral special): a bouncing fireball like Mario's, out on frame 17 (roster sheet; Mario's FAF 50). */
  neutralB: {
    kind: 'other',
    faf: 50,
    hits: [],
    spawn: [{ frame: 17, entity: 'fireboy/fireball', x: 6, y: 8, vx: 1.4, vy: -0.6 }],
  },
  /**
   * Temple Mirror (side special): Mario's Cape in Ultimate. The mirror reflects projectiles on frames 9-20 with the
   * Cape's multipliers (SmashWiki, Reflection: damage x1.5, speed x1, lifespan x0.75) and hits for 7% on 12-14.
   */
  sideB: {
    kind: 'other',
    faf: 36,
    hits: [{ frames: [12, 14], boxes: [box(0, 7, 8, 6, { damage: 7, angle: 110, kbg: 100, bkb: 0 })] }],
    reflectors: [{ frames: [9, 20], x: 7, y: 8, radius: 7, damage: 1.5, speed: 1, lifetime: 0.75 }],
  },
  /**
   * Flame Jump (up special): a rising column of fire, steerable with the stick. Leaves Fireboy helpless and can
   * grab the ledge on the way up. Mario's Super Jump Punch: a 5% opener, five 0.6% set-knockback hits that carry
   * the opponent up, a 3% finisher.
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
        boxes: [box(0, 3, 8, 6, { damage: 5, angle: 86, kbg: 100, bkb: 0, wbkb: 150, effect: fire })],
      },
      ...[7, 9, 11, 13, 15].map((frame): MoveDef['hits'][number] => ({
        frames: [frame, frame + 1],
        rehit: true,
        boxes: [box(0, 0, 9, 5.5, { damage: 0.6, angle: 92, kbg: 100, bkb: 0, wbkb: 110, effect: fire })],
      })),
      {
        frames: [17, 18],
        rehit: true,
        boxes: [box(0, 0, 9, 5.5, { damage: 3, angle: 60, kbg: 145, bkb: 50, effect: fire })],
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
