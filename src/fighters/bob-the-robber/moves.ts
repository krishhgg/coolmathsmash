import type { HitboxDef, MoveDef } from '../types';
import { sideB, upB } from './specials';

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

/** A multi-hit loop: the same boxes on each of `windows`, each one able to hit again. */
const loop = (windows: [number, number][], boxes: HitboxDef[]): MoveDef['hits'] =>
  windows.map((frames) => ({ frames, rehit: true, boxes }));

/**
 * Bob the Robber's normals (research roster, fighter 4): a disjointed night-stick with Marth-style tippers on
 * forward tilt, forward smash and forward air, his loot sack on dash attack and down air, and twirls on up tilt,
 * up smash and neutral air. Damage and first active frames are the roster's. Angle, BKB and KBG come from each
 * move's Ultimate analogue (13.0.1 data, rubendal/ssbu): a move in the same role at Bob's damage, so his KO percents
 * are Ultimate's. Marth's baton-like sword is the default (forward tilt sourspot, forward smash tip, front down smash,
 * down tilt, dash attack, down air); Lucina, Marth without tippers, where Bob hits as hard as she does (forward tilt
 * tip, forward smash sourspot, back air); Mario for the jab, neutral air and forward, up and down throws; Pit's
 * multi-hit finisher for up tilt and Young Link's for up smash; Meta Knight's back sweep for the back of down smash;
 * Inkling's forward air, Roy's up air, and Joker's back throw (Bob plays like Joker). bob-the-robber.test.ts names
 * the analogue of each kill move and checks its KO percent against it.
 *
 * Tippers: the baton's near boxes take the lower ids, so the tip lands only when it alone reaches the target, at
 * the end of the baton (Marth's spacing game), rather than whenever it overlaps.
 */
export const moves: Record<string, MoveDef> = {
  /** Baton Jab: a quick poke from the hip; Attack again chains into the second poke. */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [7, 19], move: 'jab2' },
    hits: [
      {
        frames: [4, 5],
        boxes: [
          box(0, 5, 8, 3, { damage: 2.5, angle: 361, kbg: 30, bkb: 20 }),
          box(1, 9.5, 8, 3, { damage: 2.5, angle: 361, kbg: 30, bkb: 20 }),
        ],
      },
    ],
  },
  /** Second poke, the other way up; Attack again finishes with the bonk. */
  jab2: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab3' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 5, 7, 3, { damage: 2, angle: 361, kbg: 30, bkb: 20 }),
          box(1, 9.5, 7, 3, { damage: 2, angle: 361, kbg: 30, bkb: 20 }),
        ],
      },
    ],
  },
  /** Bonk: the overhead night-stick finisher. */
  jab3: {
    kind: 'other',
    faf: 33,
    hits: [
      {
        frames: [6, 7],
        boxes: [
          box(0, 6, 10, 3.5, { damage: 4.5, angle: 361, kbg: 80, bkb: 60 }),
          box(1, 10.5, 8, 3.5, { damage: 4.5, angle: 361, kbg: 80, bkb: 60 }),
        ],
      },
    ],
  },
  /** Baton Swing: a level swing at arm's length; the tip is the sweetspot. */
  ftilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 8],
        boxes: [
          box(0, 4.5, 8, 3, { damage: 9, angle: 361, kbg: 70, bkb: 30 }),
          box(1, 8.5, 7.5, 2.5, { damage: 9, angle: 361, kbg: 70, bkb: 30 }),
          box(2, 12.5, 7.5, 2.5, { damage: 11, angle: 361, kbg: 74, bkb: 42 }),
        ],
      },
    ],
  },
  /** Twirl Up: three spins of the baton overhead that carry into a launcher, for juggles. */
  utilt: {
    kind: 'other',
    faf: 34,
    hits: [
      ...loop(
        [
          [6, 7],
          [9, 10],
          [12, 13],
        ],
        [
          box(0, 2, 15, 5.5, { damage: 1, angle: 96, kbg: 100, bkb: 0, wbkb: 35, hitlag: 0.5 }),
          box(1, 6, 10, 4, { damage: 1, angle: 110, kbg: 100, bkb: 0, wbkb: 35, hitlag: 0.5 }),
        ],
      ),
      {
        frames: [15, 17],
        rehit: true,
        boxes: [
          box(0, 1.5, 16, 6, { damage: 4, angle: 83, kbg: 30, bkb: 70, direction: 'away' }),
          box(1, 6, 10, 4.5, { damage: 4, angle: 83, kbg: 30, bkb: 70 }),
        ],
      },
    ],
  },
  /** Sweep: the baton along the ankles; low and quick. */
  dtilt: {
    kind: 'other',
    faf: 24,
    hits: [
      {
        frames: [6, 7],
        boxes: [
          box(0, 5, 2, 3, { damage: 7, angle: 30, kbg: 40, bkb: 40 }),
          box(1, 10.5, 1.5, 3.5, { damage: 7, angle: 30, kbg: 40, bkb: 40 }),
        ],
      },
    ],
  },
  /** Loot Bag Swing: slides in swinging the money sack; weaker late. */
  dashAttack: {
    kind: 'other',
    faf: 40,
    hits: [
      { frames: [9, 12], boxes: [box(0, 7.5, 6, 5, { damage: 10, angle: 45, kbg: 55, bkb: 70 })] },
      { frames: [13, 20], boxes: [box(0, 7, 6, 4.5, { damage: 7, angle: 361, kbg: 60, bkb: 35 })] },
    ],
  },
  /** Home-Run Bonk: a big two-handed swing with a tip sweetspot. Charges on frame 9. */
  fsmash: {
    kind: 'smash',
    faf: 50,
    charge: 9,
    hits: [
      {
        frames: [13, 15],
        boxes: [
          box(0, 4.5, 9, 3.5, { damage: 15, angle: 361, kbg: 73, bkb: 65 }),
          box(1, 9, 8.5, 3, { damage: 15, angle: 361, kbg: 73, bkb: 65 }),
          box(2, 13.5, 8, 3, { damage: 18, angle: 361, kbg: 80, bkb: 80 }),
        ],
      },
    ],
  },
  /** Helicopter Twirl: the baton spun overhead like a rotor, four hits that drag up into a launcher. */
  usmash: {
    kind: 'smash',
    faf: 52,
    charge: 6,
    hits: [
      ...loop(
        [
          [10, 11],
          [13, 14],
          [16, 17],
          [19, 20],
        ],
        [
          box(0, 0, 17, 6.5, { damage: 2, angle: 96, kbg: 100, bkb: 0, wbkb: 45, hitlag: 0.5 }),
          box(1, 6.5, 11, 4.5, { damage: 2, angle: 120, kbg: 100, bkb: 0, wbkb: 45, hitlag: 0.5 }),
          box(2, -6.5, 11, 4.5, { damage: 2, angle: 60, kbg: 100, bkb: 0, wbkb: 45, hitlag: 0.5 }),
        ],
      ),
      {
        frames: [23, 25],
        rehit: true,
        boxes: [box(0, 0, 17, 7.5, { damage: 7, angle: 100, kbg: 108, bkb: 75, direction: 'away' })],
      },
    ],
  },
  /** Floor Sweep: the baton along the floor in front, then behind. Low angles. */
  dsmash: {
    kind: 'smash',
    faf: 48,
    charge: 4,
    hits: [
      {
        frames: [7, 8],
        boxes: [
          box(0, 5, 2.5, 3.5, { damage: 12, angle: 361, kbg: 88, bkb: 57 }),
          box(1, 11, 2, 3.5, { damage: 12, angle: 361, kbg: 88, bkb: 57 }),
        ],
      },
      {
        frames: [15, 16],
        boxes: [
          box(0, -5, 2.5, 3.5, { damage: 13, angle: 35, kbg: 78, bkb: 50, direction: 'back' }),
          box(1, -11, 2, 3.5, { damage: 13, angle: 35, kbg: 78, bkb: 50, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up from the floor with a baton sweep to both sides; intangible until the second swing ends. */
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
  /** Twirl: the baton spun all the way round his body (the video's twirl). Strong early, weaker lingering. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 7,
    autoCancel: [
      [1, 3],
      [30, 40],
    ],
    hits: [
      {
        frames: [5, 8],
        boxes: [box(0, 0, 7, 10.5, { damage: 8, angle: 361, kbg: 100, bkb: 20, direction: 'away' })],
      },
      {
        frames: [9, 22],
        boxes: [box(0, 0, 7, 9.5, { damage: 5, angle: 361, kbg: 90, bkb: 13, direction: 'away' })],
      },
    ],
  },
  /** Overhead Chop: the baton brought down in front; the tip is the sweetspot. */
  fair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 8,
    autoCancel: [
      [1, 2],
      [26, 36],
    ],
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 5, 10, 3.5, { damage: 10, angle: 361, kbg: 90, bkb: 30 }),
          box(1, 9, 8, 3, { damage: 10, angle: 361, kbg: 90, bkb: 30 }),
          box(2, 12.5, 5, 3, { damage: 12, angle: 361, kbg: 90, bkb: 30 }),
        ],
      },
    ],
  },
  /** Backswing: turns his shoulders and swings the baton behind him. */
  bair: {
    kind: 'aerial',
    faf: 38,
    landingLag: 10,
    autoCancel: [
      [1, 3],
      [28, 38],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: [
          box(0, -5, 7.5, 3.5, { damage: 12, angle: 361, kbg: 90, bkb: 40, direction: 'back' }),
          box(1, -10.5, 7.5, 3.5, { damage: 12, angle: 361, kbg: 90, bkb: 40, direction: 'back' }),
        ],
      },
    ],
  },
  /** Baton Arc: an overhead arc from front to back. */
  uair: {
    kind: 'aerial',
    faf: 34,
    landingLag: 7,
    autoCancel: [
      [1, 3],
      [24, 34],
    ],
    hits: [
      {
        frames: [6, 9],
        boxes: [
          box(0, 0, 15, 4, { damage: 9, angle: 80, kbg: 105, bkb: 40, direction: 'away' }),
          box(1, 0, 19.5, 4, { damage: 9, angle: 80, kbg: 105, bkb: 40, direction: 'away' }),
        ],
      },
    ],
  },
  /** Sack Drop: the heavy loot sack swung straight down; meteors early, then a weaker lingering hit. */
  dair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 18,
    autoCancel: [
      [1, 3],
      [40, 50],
    ],
    hits: [
      { frames: [14, 16], boxes: [box(0, 1, -1, 5.5, { damage: 13, angle: 270, kbg: 80, bkb: 20 })] },
      { frames: [17, 22], boxes: [box(0, 1, 0, 5, { damage: 10, angle: 361, kbg: 70, bkb: 30 })] },
    ],
  },
  /** Collar Grab, on Ultimate's typical grab timings; the standing grab reaches 12 units, like Mario's. */
  grab: { kind: 'other', faf: 36, hits: [{ frames: [7, 8], boxes: [grabBox(0, 7.5, 7, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 44, hits: [{ frames: [10, 11], boxes: [grabBox(0, 8.5, 7, 5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 39, hits: [{ frames: [11, 12], boxes: [grabBox(0, 9, 7, 5.5)] }] },
  /** Pickpocket: rummages through their pockets. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.2, hitlag: 1.8 } },
  /** Door Shove: shoves them through an imaginary door. */
  fthrow: {
    kind: 'other',
    faf: 30,
    hits: [],
    throw: { frame: 12, hit: { damage: 8, angle: 45, kbg: 65, bkb: 60 } },
  },
  /** Knockout: spins them round and bonks the back of their head (guards go down from behind). Kill throw. */
  bthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 22, hit: { damage: 10, angle: 49, kbg: 66, bkb: 70, direction: 'back' } },
  },
  /** Loot Toss: heaves them overhead like a sack of loot. */
  uthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    throw: { frame: 16, hit: { damage: 7, angle: 90, kbg: 72, bkb: 70 } },
  },
  /** Cuffed: pins them and slams them down; pops up low for follow-ups. */
  dthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    throw: { frame: 18, hit: { damage: 6, angle: 68, kbg: 90, bkb: 40 } },
  },
  sideB,
  upB,
};
