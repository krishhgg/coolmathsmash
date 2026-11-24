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

type Hit = Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>;

/**
 * The grabber line: count boxes evenly spaced from the tip at to back to from (forward units) at height y. The tip
 * gets id 0, so it wins over the line behind it, and each box's size and hit are functions of its index from the tip.
 */
function line(
  from: number,
  to: number,
  y: number,
  count: number,
  radius: (i: number) => number,
  hit: (i: number) => Hit,
): HitboxDef[] {
  return Array.from({ length: count }, (_, i) =>
    box(i, to - ((to - from) * i) / (count - 1), y, radius(i), hit(i)),
  );
}

/** The tether grab's line at full length: 70 units, like the roster's Grabber Grab. */
const tether = (near: number) => [
  grabBox(0, near, 6, 5),
  grabBox(1, 22, 6, 4.5),
  grabBox(2, 36, 6, 4.5),
  grabBox(3, 51, 6, 4.5),
  grabBox(4, 65.5, 6, 4.5),
];

/**
 * Fluffy's normals (roster sheet 8). His game is a grabber fired across the screen, so his tilts, smashes and grab
 * reach far (forward tilt 45 units, forward smash and grab 70, Min Min range) and recover slowly, while the
 * close-range moves use his fuzzy body. Damage and first active frames are the roster's; the roster gives no growth
 * or base knockback, so those are Ultimate-standard values for each kind of move. They are not lowered to hit the
 * roster's kill percents in our engine, which KOs early until COOL-3's calibration lands (CREW.md, "Knockback
 * values"). Frame windows are inclusive; faf is the first actionable frame.
 */
export const moves: Record<string, MoveDef> = {
  /** Fuzz Bump: a quick shove with the fur. Attack again to bump twice and finish with the Tail Slap. */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab2' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 6, 5.5, 3.5, { damage: 2, angle: 361, kbg: 25, bkb: 20 }),
          box(1, 3, 5.5, 4, { damage: 2, angle: 361, kbg: 25, bkb: 20 }),
        ],
      },
    ],
  },
  /** Second Fuzz Bump. */
  jab2: {
    kind: 'other',
    faf: 21,
    next: { window: [6, 20], move: 'jab3' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 6.5, 5, 3.5, { damage: 2, angle: 361, kbg: 25, bkb: 25 }),
          box(1, 3, 5, 4, { damage: 2, angle: 361, kbg: 25, bkb: 25 }),
        ],
      },
    ],
  },
  /** Tail Slap: the grabber's tail cracks forward to finish the jab. */
  jab3: {
    kind: 'other',
    faf: 33,
    hits: [
      {
        frames: [5, 6],
        boxes: [
          box(0, 10, 5, 4, { damage: 3, angle: 361, kbg: 130, bkb: 45 }),
          box(1, 4, 5, 4, { damage: 3, angle: 361, kbg: 130, bkb: 45 }),
        ],
      },
    ],
  },
  /** Grabber Whip: the grabber cracks out 45 units in front; the tip hits hardest. */
  ftilt: {
    kind: 'other',
    faf: 36,
    hits: [
      {
        frames: [7, 9],
        boxes: line(
          9,
          40.5,
          6,
          4,
          (i) => (i === 0 ? 4.5 : 3.5),
          (i) => ({ damage: i === 0 ? 8 : 6, angle: 361, kbg: 95, bkb: i === 0 ? 30 : 20 }),
        ),
      },
    ],
  },
  /** Grabber Flick: the grabber flicks up in an arc over his head; a juggling launcher. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 7],
        boxes: [
          box(0, 7, 13, 4.5, { damage: 6, angle: 88, kbg: 115, bkb: 35, direction: 'away' }),
          box(1, 3, 8, 4, { damage: 6, angle: 88, kbg: 115, bkb: 35, direction: 'away' }),
        ],
      },
      {
        frames: [8, 10],
        boxes: [
          box(0, 0, 19, 5, { damage: 6, angle: 88, kbg: 115, bkb: 35, direction: 'away' }),
          box(1, 0, 12, 4, { damage: 6, angle: 88, kbg: 115, bkb: 35, direction: 'away' }),
        ],
      },
      {
        frames: [11, 12],
        boxes: [box(0, -7, 14, 4.5, { damage: 6, angle: 88, kbg: 115, bkb: 35, direction: 'away' })],
      },
    ],
  },
  /** Low Lash: the grabber skims the floor 30 units ahead and trips them up into the air. */
  dtilt: {
    kind: 'other',
    faf: 27,
    hits: [
      {
        frames: [6, 8],
        boxes: line(
          8,
          26,
          1.5,
          3,
          (i) => (i === 0 ? 4 : 3.5),
          () => ({ damage: 6, angle: 75, kbg: 60, bkb: 45 }),
        ),
      },
    ],
  },
  /** Fuzz Roll: rolls into them as a ball; weaker once the roll slows. */
  dashAttack: {
    kind: 'other',
    faf: 42,
    hits: [
      { frames: [8, 12], boxes: [box(0, 4, 5.5, 6.5, { damage: 9, angle: 50, kbg: 80, bkb: 65 })] },
      { frames: [13, 22], boxes: [box(0, 3, 5.5, 6, { damage: 6, angle: 50, kbg: 80, bkb: 50 })] },
    ],
  },
  /** Spiked Ball: IQ Ball's spiked grabber thrust out to 70 units; the ball at the end is the kill hit. */
  fsmash: {
    kind: 'smash',
    faf: 62,
    charge: 13,
    hits: [
      {
        frames: [16, 18],
        boxes: line(
          12,
          64,
          6.5,
          5,
          (i) => (i === 0 ? 6 : 3.5),
          (i): Hit =>
            i === 0
              ? { damage: 15, angle: 361, kbg: 95, bkb: 38 }
              : { damage: 11, angle: 361, kbg: 85, bkb: 30 },
        ),
      },
    ],
  },
  /** Spike Arc: the spiked ball swung overhead from front to back. */
  usmash: {
    kind: 'smash',
    faf: 50,
    charge: 8,
    hits: [
      {
        frames: [13, 14],
        boxes: [
          box(0, 14, 16, 6, { damage: 14, angle: 82, kbg: 92, bkb: 36, direction: 'away' }),
          box(1, 6, 11, 4.5, { damage: 14, angle: 82, kbg: 92, bkb: 36, direction: 'away' }),
        ],
      },
      {
        frames: [15, 16],
        boxes: [
          box(0, 0, 23, 6.5, { damage: 14, angle: 88, kbg: 92, bkb: 36, direction: 'away' }),
          box(1, 0, 13, 4.5, { damage: 14, angle: 88, kbg: 92, bkb: 36, direction: 'away' }),
        ],
      },
      {
        frames: [17, 18],
        boxes: [box(0, -14, 16, 6, { damage: 11, angle: 82, kbg: 92, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Tail Twister: the grabber spun round him at floor level, in front first, then behind. */
  dsmash: {
    kind: 'smash',
    faf: 52,
    charge: 6,
    hits: [
      {
        frames: [10, 11],
        boxes: line(
          7,
          24,
          2,
          3,
          (i) => (i === 0 ? 5 : 4),
          () => ({ damage: 12, angle: 30, kbg: 95, bkb: 28 }),
        ),
      },
      {
        frames: [15, 16],
        boxes: line(
          -7,
          -24,
          2,
          3,
          (i) => (i === 0 ? 5 : 4),
          () => ({ damage: 12, angle: 30, kbg: 95, bkb: 28, direction: 'back' }),
        ),
      },
    ],
  },
  /** Getting up with the grabber spinning to both sides; intangible until the second swing ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 9, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -9, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Bristle: every hair stands on end; strong at first, then a lingering prickle. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 8,
    autoCancel: [
      [1, 4],
      [30, 40],
    ],
    hits: [
      {
        frames: [5, 7],
        boxes: [box(0, 0, 5.5, 8, { damage: 8, angle: 361, kbg: 95, bkb: 20, direction: 'away' })],
      },
      {
        frames: [8, 24],
        boxes: [box(0, 0, 5.5, 7, { damage: 5, angle: 361, kbg: 95, bkb: 10, direction: 'away' })],
      },
    ],
  },
  /** Lash: the grabber whips forward 25 units. */
  fair: {
    kind: 'aerial',
    faf: 42,
    landingLag: 11,
    autoCancel: [
      [1, 6],
      [30, 42],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: line(
          9,
          21,
          5,
          2,
          (i) => (i === 0 ? 4.5 : 4),
          (i) => ({ damage: i === 0 ? 10 : 8, angle: 361, kbg: 95, bkb: 25 }),
        ),
      },
    ],
  },
  /** Back Lash: the grabber cracks behind him; his aerial kill move. */
  bair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 11,
    autoCancel: [
      [1, 6],
      [28, 40],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: line(
          -9,
          -21,
          5,
          2,
          (i) => (i === 0 ? 5 : 4.5),
          (i) => ({ damage: i === 0 ? 11 : 9, angle: 361, kbg: 100, bkb: 22, direction: 'back' }),
        ),
      },
    ],
  },
  /** Whirl: the grabber twirls over his head. */
  uair: {
    kind: 'aerial',
    faf: 34,
    landingLag: 8,
    autoCancel: [
      [1, 4],
      [22, 34],
    ],
    hits: [
      {
        frames: [6, 10],
        boxes: [
          box(0, 0, 17, 6, { damage: 7, angle: 80, kbg: 110, bkb: 35, direction: 'away' }),
          box(1, 0, 11, 5, { damage: 7, angle: 80, kbg: 110, bkb: 35, direction: 'away' }),
        ],
      },
    ],
  },
  /** Candy Drop: a hard candy slammed down beneath him; it spikes when it first comes out. */
  dair: {
    kind: 'aerial',
    faf: 48,
    landingLag: 17,
    autoCancel: [
      [1, 8],
      [38, 48],
    ],
    hits: [
      { frames: [12, 14], boxes: [box(0, 0, -2, 5.5, { damage: 10, angle: 270, kbg: 75, bkb: 25 })] },
      { frames: [15, 24], boxes: [box(0, 0, -1, 5, { damage: 7, angle: 70, kbg: 80, bkb: 30 })] },
    ],
  },
  /**
   * Grabber Grab: a tether grab on frame 12 whose line flies out to 70 units over three frames, with the long
   * recovery every tether grab pays for its range.
   */
  grab: {
    kind: 'other',
    faf: 58,
    hits: [
      { frames: [12, 12], boxes: [grabBox(0, 8, 6, 5), grabBox(1, 20, 6, 4.5)] },
      { frames: [13, 13], boxes: [grabBox(0, 8, 6, 5), grabBox(1, 22, 6, 4.5), grabBox(2, 38, 6, 4.5)] },
      { frames: [14, 17], boxes: tether(8) },
    ],
  },
  dashGrab: {
    kind: 'other',
    faf: 64,
    hits: [
      { frames: [14, 14], boxes: [grabBox(0, 9, 6, 5), grabBox(1, 22, 6, 4.5)] },
      { frames: [15, 19], boxes: tether(9) },
    ],
  },
  /** Turns round out of a dash or run and fires the tether behind; the slide keeps going the old way. */
  pivotGrab: {
    kind: 'other',
    faf: 66,
    hits: [
      { frames: [15, 15], boxes: [grabBox(0, 9, 6, 5), grabBox(1, 22, 6, 4.5)] },
      { frames: [16, 20], boxes: tether(9) },
    ],
  },
  /** Squeeze: the grabber tightens. */
  pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Fling: whips them away in front. */
  fthrow: {
    kind: 'other',
    faf: 34,
    hits: [],
    throw: { frame: 14, hit: { damage: 8, angle: 40, kbg: 60, bkb: 55 } },
  },
  /** Swing-Around: swings them round on the grabber and lets go behind him; his kill throw. */
  bthrow: {
    kind: 'other',
    faf: 56,
    hits: [],
    throw: { frame: 32, hit: { damage: 11, angle: 42, kbg: 72, bkb: 55, direction: 'back' } },
  },
  /** Upward Whip: cracks them straight up. */
  uthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 18, hit: { damage: 9, angle: 90, kbg: 75, bkb: 60 } },
  },
  /** Bounce: hops onto them and bounces off; low knockback for follow-ups. */
  dthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 22, hit: { damage: 6, angle: 75, kbg: 45, bkb: 60 } },
  },
};
