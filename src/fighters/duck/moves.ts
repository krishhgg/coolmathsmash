import type { HitboxDef, MoveDef } from '../types';

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
 * The Duck's normals, from the roster sheet ("### 7. The Duck"): damage and first active frame per move, kill
 * percents against Mario at Battlefield's ledge (pinned in duck.test.ts). He has no fists, so the head is the
 * weapon: pecks, headbutts and the battering-ram dash, with wing flaps and webbed-foot kicks around it. Frame
 * windows are inclusive and faf is the first actionable frame; move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /** Peck, peck, wing slap: Attack again during each window continues the combo. */
  jab: {
    kind: 'other',
    faf: 18,
    next: { window: [6, 17], move: 'jab2' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 7, 6, 2.5, { damage: 2, angle: 361, kbg: 25, bkb: 20, hitlag: 0.5 }),
          box(1, 3.5, 6, 3, { damage: 2, angle: 361, kbg: 25, bkb: 20, hitlag: 0.5 }),
        ],
      },
    ],
  },
  jab2: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab3' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 7.5, 6.5, 2.5, { damage: 2, angle: 361, kbg: 25, bkb: 20, hitlag: 0.5 }),
          box(1, 3.5, 6, 3, { damage: 2, angle: 361, kbg: 25, bkb: 20, hitlag: 0.5 }),
        ],
      },
    ],
  },
  jab3: {
    kind: 'other',
    faf: 31,
    hits: [
      {
        frames: [4, 5],
        boxes: [box(0, 6.5, 5.5, 4, { damage: 4, angle: 361, kbg: 110, bkb: 45 })],
      },
    ],
  },
  /** Headbutt: the video's battering ram, a lunge with the head. */
  ftilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 9, 6.5, 3.5, { damage: 9, angle: 361, kbg: 91, bkb: 10 }),
          box(1, 4.5, 6, 3.5, { damage: 9, angle: 361, kbg: 91, bkb: 10 }),
        ],
      },
    ],
  },
  /** Wing Flap: both wings beat upward over his head; a juggle starter. */
  utilt: {
    kind: 'other',
    faf: 26,
    hits: [
      {
        frames: [5, 10],
        boxes: [
          box(0, 0, 12, 5, { damage: 6, angle: 95, kbg: 125, bkb: 28, direction: 'away' }),
          box(1, 4, 8, 3.5, { damage: 6, angle: 95, kbg: 125, bkb: 28, direction: 'away' }),
        ],
      },
    ],
  },
  /** Low Peck at the opponent's feet; pops them up for follow-ups. */
  dtilt: {
    kind: 'other',
    faf: 22,
    hits: [
      {
        frames: [4, 6],
        boxes: [
          box(0, 8, 1.5, 2.8, { damage: 6, angle: 75, kbg: 50, bkb: 50 }),
          box(1, 4, 2, 3, { damage: 6, angle: 75, kbg: 50, bkb: 50 }),
        ],
      },
    ],
  },
  /** Hurdle Run: the running-training sprint ends in a headfirst ram; weaker late. */
  dashAttack: {
    kind: 'other',
    faf: 40,
    hits: [
      { frames: [7, 10], boxes: [box(0, 6, 5.5, 4.5, { damage: 11, angle: 45, kbg: 60, bkb: 60 })] },
      { frames: [11, 20], boxes: [box(0, 5.5, 5.5, 4, { damage: 7, angle: 50, kbg: 60, bkb: 45 })] },
    ],
  },
  /** Big Headbutt: winds the neck back, then slams forward. His strongest grounded hit. */
  fsmash: {
    kind: 'smash',
    faf: 48,
    charge: 10,
    hits: [
      {
        frames: [14, 16],
        boxes: [
          box(0, 11, 6.5, 4, { damage: 16, angle: 361, kbg: 78, bkb: 20 }),
          box(1, 5.5, 6, 3.5, { damage: 13, angle: 361, kbg: 78, bkb: 20 }),
        ],
      },
    ],
  },
  /** Takeoff: a huge upward flap that launches whatever is overhead. */
  usmash: {
    kind: 'smash',
    faf: 44,
    charge: 6,
    hits: [
      {
        frames: [10, 13],
        boxes: [
          box(0, 0, 13, 5.5, { damage: 14, angle: 88, kbg: 91, bkb: 36, direction: 'away' }),
          box(1, 0, 6, 5, { damage: 12, angle: 88, kbg: 91, bkb: 32, direction: 'away' }),
        ],
      },
    ],
  },
  /** Wing Sweep: both wings sweep low on each side at once. */
  dsmash: {
    kind: 'smash',
    faf: 42,
    charge: 3,
    hits: [
      {
        frames: [7, 8],
        boxes: [
          box(0, 8.5, 2, 4, { damage: 12, angle: 30, kbg: 82, bkb: 25 }),
          box(1, -8.5, 2, 4, { damage: 12, angle: 30, kbg: 82, bkb: 25, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up pecking to both sides; intangible until the second peck ends. */
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
  /** Feather Spin: a spinning ball of feathers; strong at the start, weaker as it lingers. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 6,
    autoCancel: [
      [1, 3],
      [30, 40],
    ],
    hits: [
      {
        frames: [4, 6],
        boxes: [box(0, 0, 5.5, 6.5, { damage: 8, angle: 361, kbg: 100, bkb: 15, direction: 'away' })],
      },
      {
        frames: [7, 22],
        boxes: [box(0, 0, 5.5, 6, { damage: 5, angle: 361, kbg: 100, bkb: 10, direction: 'away' })],
      },
    ],
  },
  /** Dive Header: a short forward dive with the head. */
  fair: {
    kind: 'aerial',
    faf: 38,
    landingLag: 10,
    autoCancel: [
      [1, 3],
      [28, 38],
    ],
    hits: [
      {
        frames: [9, 12],
        boxes: [
          box(0, 8.5, 4.5, 4, { damage: 11, angle: 40, kbg: 80, bkb: 25 }),
          box(1, 4, 5, 3.5, { damage: 9, angle: 40, kbg: 80, bkb: 20 }),
        ],
      },
    ],
  },
  /** Web Kick: both webbed feet kick out behind him. His aerial kill move. */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 9,
    autoCancel: [
      [1, 4],
      [24, 36],
    ],
    hits: [
      {
        frames: [8, 10],
        boxes: [box(0, -8.5, 4, 4, { damage: 12, angle: 361, kbg: 79, bkb: 15, direction: 'back' })],
      },
      {
        frames: [11, 15],
        boxes: [box(0, -7.5, 4, 3.5, { damage: 8, angle: 361, kbg: 79, bkb: 5, direction: 'back' })],
      },
    ],
  },
  /** Beak Snap: snaps the beak straight up; a juggling tool. */
  uair: {
    kind: 'aerial',
    faf: 32,
    landingLag: 6,
    autoCancel: [
      [1, 3],
      [20, 32],
    ],
    hits: [
      {
        frames: [5, 8],
        boxes: [
          box(0, 1.5, 13, 4, { damage: 8, angle: 75, kbg: 115, bkb: 30, direction: 'away' }),
          box(1, 1, 9, 3.5, { damage: 8, angle: 75, kbg: 115, bkb: 30, direction: 'away' }),
        ],
      },
    ],
  },
  /**
   * Foot Stomp: a webbed-foot stomp straight down, a preview of the Final Smash. The foot meteors on its first
   * frames; the late hit sends away.
   */
  dair: {
    kind: 'aerial',
    faf: 46,
    landingLag: 18,
    autoCancel: [
      [1, 3],
      [36, 46],
    ],
    hits: [
      {
        frames: [12, 14],
        boxes: [
          box(0, 1, -1, 4, { damage: 12, angle: 270, kbg: 80, bkb: 20 }),
          box(1, 0, 3.5, 4, { damage: 10, angle: 361, kbg: 90, bkb: 20, direction: 'away' }),
        ],
      },
      {
        frames: [15, 20],
        boxes: [box(0, 0.5, 0, 4, { damage: 8, angle: 361, kbg: 90, bkb: 15, direction: 'away' })],
      },
    ],
  },
  /** Beak Grab: a short-ranged peck that catches (reach 11). */
  grab: { kind: 'other', faf: 34, hits: [{ frames: [7, 8], boxes: [grabBox(0, 7, 5.5, 4)] }] },
  dashGrab: { kind: 'other', faf: 42, hits: [{ frames: [10, 11], boxes: [grabBox(0, 8, 5.5, 4.5)] }] },
  pivotGrab: { kind: 'other', faf: 37, hits: [{ frames: [11, 12], boxes: [grabBox(0, 8.5, 5.5, 5)] }] },
  /** Peck on the held opponent. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.2, hitlag: 2 } },
  /** Head Toss: flicks the opponent forward with the head. */
  fthrow: {
    kind: 'other',
    faf: 30,
    hits: [],
    throw: { frame: 12, hit: { damage: 8, angle: 40, kbg: 65, bkb: 55 } },
  },
  /** Wing Fling: spins round and flings them behind with a wing. His kill throw at the ledge. */
  bthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 22, hit: { damage: 10, angle: 45, kbg: 59, bkb: 60, direction: 'back' } },
  },
  /** Carry & Drop: flaps up holding them, then lets go overhead. */
  uthrow: {
    kind: 'other',
    faf: 46,
    hits: [],
    throw: { frame: 24, hit: { damage: 8, angle: 90, kbg: 70, bkb: 65 } },
  },
  /** Double Stomp: two stomps on the floored opponent, popping them up at a combo angle. */
  dthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    throw: { frame: 20, hit: { damage: 6, angle: 75, kbg: 40, bkb: 60 } },
  },
};
