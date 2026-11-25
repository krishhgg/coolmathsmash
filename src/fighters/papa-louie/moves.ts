import { stickX } from '../../sim/control';
import type { HitboxDef, MoveDef } from '../types';

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
 * Paddle Propeller: a steady climb while the rotor hits carry the opponent (from `from`), then a burst from `burst`
 * to `to` that tapers each frame; about 60 units in all. `steer` is the stick's sideways speed.
 */
const PROPELLER = { from: 6, lift: 1.7, burst: 28, to: 36, rise: 3, taper: 0.25, steer: 0.9 };

const fire = 'fire' as const;
const away = 'away' as const;

/**
 * Papa Louie's normals (roster: handoffs/research/roster.md, "1. Papa Louie"). Every strike is his wooden pizza
 * paddle, so the far box (id 0) is the paddle's face, out past his arm, and the near box is the handle. Damage and
 * startup follow the roster's table; the rest is Ultimate middleweight frame data (Mario's and Ness's shapes),
 * tuned so the roster's kill percents hold against Mario in the middle of Battlefield (papa-louie.test.ts).
 */
export const moves: Record<string, MoveDef> = {
  /** Paddle Poke: a short jab with the paddle's tip. The far box pulls in so the second poke connects. */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab2' },
    hits: [
      {
        frames: [4, 5],
        boxes: [
          box(0, 7, 8, 3, { damage: 2.5, angle: 361, kbg: 25, bkb: 20 }),
          box(1, 11.5, 8, 3.5, { damage: 2.5, angle: 180, kbg: 20, bkb: 15 }),
        ],
      },
    ],
  },
  /** Second Paddle Poke. */
  jab2: {
    kind: 'other',
    faf: 21,
    next: { window: [6, 20], move: 'jab3' },
    hits: [
      {
        frames: [4, 5],
        boxes: [
          box(0, 7, 8, 3, { damage: 2, angle: 361, kbg: 25, bkb: 20 }),
          box(1, 11.5, 8, 3.5, { damage: 2, angle: 180, kbg: 20, bkb: 15 }),
        ],
      },
    ],
  },
  /** Flat Slap: the paddle's flat face; a light finisher that sends forward. */
  jab3: {
    kind: 'other',
    faf: 32,
    hits: [
      {
        frames: [5, 6],
        boxes: [
          box(0, 12, 8, 4.5, { damage: 4, angle: 361, kbg: 110, bkb: 40 }),
          box(1, 6.5, 8, 3.5, { damage: 4, angle: 361, kbg: 110, bkb: 40 }),
        ],
      },
    ],
  },
  /** Peel Swipe: a horizontal swipe at arm's length; the paddle face is disjointed well past his hand. */
  ftilt: {
    kind: 'other',
    faf: 31,
    reflectors: [{ frames: [7, 9], x: 15, y: 7.5, radius: 4, maxDamage: 10 }],
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 15, 7.5, 4, { damage: 9, angle: 361, kbg: 98, bkb: 10 }),
          box(1, 9, 7.5, 3.5, { damage: 8, angle: 361, kbg: 98, bkb: 8 }),
        ],
      },
    ],
  },
  /**
   * Dough Twirl: spins a pizza dough overhead. Three 1% spins carry the target up into the dough, then a 4% toss
   * pops them up for a juggle.
   */
  utilt: {
    kind: 'other',
    faf: 34,
    hits: [
      ...[6, 9, 12].map((f) => ({
        frames: [f, f + 1] as [number, number],
        rehit: true,
        boxes: [
          box(0, 2, 15, 6, { damage: 1, angle: 100, kbg: 100, bkb: 0, wbkb: 30, direction: away }),
          box(1, 7, 10, 4, { damage: 1, angle: 110, kbg: 100, bkb: 0, wbkb: 35, direction: away }),
        ],
      })),
      {
        frames: [15, 17],
        rehit: true,
        boxes: [
          box(0, 1.5, 16, 6.5, { damage: 4, angle: 88, kbg: 120, bkb: 45, direction: away }),
          box(1, 7, 11, 4.5, { damage: 4, angle: 88, kbg: 120, bkb: 45, direction: away }),
        ],
      },
    ],
  },
  /** Oven Slide: pushes the paddle low along the floor, like sliding a pizza into the oven. Low angle. */
  dtilt: {
    kind: 'other',
    faf: 24,
    hits: [
      {
        frames: [6, 8],
        boxes: [
          box(0, 14, 1.5, 3.5, { damage: 7, angle: 25, kbg: 55, bkb: 45 }),
          box(1, 8, 2, 3, { damage: 6, angle: 25, kbg: 55, bkb: 40 }),
        ],
      },
    ],
  },
  /** Delivery Rush: a belly slide behind a paddle thrust; strong early, weaker late. */
  dashAttack: {
    kind: 'other',
    faf: 40,
    hits: [
      {
        frames: [8, 11],
        boxes: [
          box(0, 12, 6, 4.5, { damage: 10, angle: 50, kbg: 75, bkb: 62 }),
          box(1, 5, 6, 4, { damage: 10, angle: 50, kbg: 75, bkb: 62 }),
        ],
      },
      {
        frames: [12, 20],
        boxes: [box(0, 10, 5, 4.5, { damage: 6, angle: 60, kbg: 70, bkb: 45 })],
      },
    ],
  },
  /**
   * Poised Swing: his game's held "poised" swing. The paddle winds back on frame 10, where holding Attack charges
   * it, then comes down two-handed in front of him.
   */
  fsmash: {
    kind: 'smash',
    faf: 52,
    charge: 10,
    hits: [
      {
        frames: [15, 17],
        boxes: [
          box(0, 15.5, 8, 5, { damage: 17, angle: 361, kbg: 99, bkb: 30 }),
          box(1, 8.5, 9, 3.5, { damage: 14, angle: 361, kbg: 99, bkb: 25 }),
        ],
      },
    ],
  },
  /** Pizza Toss: the paddle flips up from in front of him to overhead, like launching a pizza. */
  usmash: {
    kind: 'smash',
    faf: 46,
    charge: 7,
    hits: [
      {
        frames: [11, 14],
        boxes: [
          box(0, 2, 18, 6, { damage: 15, angle: 88, kbg: 96, bkb: 33, direction: away }),
          box(1, 8, 10, 4.5, { damage: 15, angle: 88, kbg: 96, bkb: 33, direction: away }),
        ],
      },
    ],
  },
  /** Peel Spin: turns in place sweeping the paddle along the floor, in front first and then behind. */
  dsmash: {
    kind: 'smash',
    faf: 50,
    charge: 4,
    hits: [
      {
        frames: [8, 9],
        boxes: [
          box(0, 14, 2.5, 4.5, { damage: 13, angle: 30, kbg: 96, bkb: 26 }),
          box(1, 7, 3, 3.5, { damage: 11, angle: 30, kbg: 96, bkb: 26 }),
        ],
      },
      {
        frames: [14, 15],
        boxes: [
          box(0, -14, 2.5, 4.5, { damage: 13, angle: 30, kbg: 96, bkb: 26, direction: 'back' }),
          box(1, -7, 3, 3.5, { damage: 11, angle: 30, kbg: 96, bkb: 26, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up from the floor with a paddle sweep to both sides; intangible until the second sweep ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 10, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -10, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Glide Spin: spins with the paddle held flat, his glide pose. Strong early, a weaker lingering hit. */
  nair: {
    kind: 'aerial',
    faf: 44,
    landingLag: 7,
    autoCancel: [
      [1, 4],
      [38, 44],
    ],
    hits: [
      {
        frames: [5, 7],
        boxes: [
          box(0, 5, 7.5, 5.5, { damage: 8, angle: 361, kbg: 100, bkb: 10, direction: away }),
          box(1, -4, 7.5, 5, { damage: 8, angle: 361, kbg: 100, bkb: 10, direction: away }),
        ],
      },
      {
        frames: [8, 25],
        boxes: [
          box(0, 4.5, 7.5, 5, { damage: 5, angle: 361, kbg: 100, bkb: 8, direction: away }),
          box(1, -3.5, 7.5, 4.5, { damage: 5, angle: 361, kbg: 100, bkb: 8, direction: away }),
        ],
      },
    ],
  },
  /**
   * Peel Chop: an overhead chop with the paddle face. It comes over his head on frames 10-11; on frames 12-14 the
   * face (id 0) is the sweetspot and meteors, while the handle sends forward.
   */
  fair: {
    kind: 'aerial',
    faf: 46,
    landingLag: 15,
    autoCancel: [
      [1, 3],
      [36, 46],
    ],
    hits: [
      {
        frames: [10, 11],
        boxes: [
          box(0, 10, 14, 4.5, { damage: 12, angle: 361, kbg: 90, bkb: 30 }),
          box(1, 5, 11, 3.5, { damage: 10, angle: 361, kbg: 90, bkb: 25 }),
        ],
      },
      {
        frames: [12, 14],
        boxes: [
          box(0, 12.5, 3.5, 4, { damage: 12, angle: 285, kbg: 75, bkb: 20 }),
          box(1, 7, 7.5, 3.5, { damage: 10, angle: 361, kbg: 90, bkb: 25 }),
        ],
      },
    ],
  },
  /** Backhand Swat: a backhanded paddle swat behind him; his air kill move. */
  bair: {
    kind: 'aerial',
    faf: 34,
    landingLag: 8,
    autoCancel: [
      [1, 5],
      [22, 34],
    ],
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, -12.5, 8, 4.5, { damage: 11, angle: 361, kbg: 100, bkb: 14, direction: 'back' }),
          box(1, -6.5, 8, 3.5, { damage: 9, angle: 361, kbg: 100, bkb: 10, direction: 'back' }),
        ],
      },
    ],
  },
  /** Overhead Arc: the paddle arcs over his head, front to back; a juggling move. */
  uair: {
    kind: 'aerial',
    faf: 31,
    landingLag: 7,
    autoCancel: [
      [1, 4],
      [20, 31],
    ],
    hits: [
      {
        frames: [5, 8],
        boxes: [
          box(0, 1, 18, 5.5, { damage: 8, angle: 75, kbg: 115, bkb: 30, direction: away }),
          box(1, 6, 13.5, 4, { damage: 8, angle: 75, kbg: 115, bkb: 30, direction: away }),
        ],
      },
    ],
  },
  /**
   * Box Stomp: stomps on a stack of pizza boxes held under his feet. Four 1.5% stomps drag down, then a 5% stomp
   * is a weak meteor.
   */
  dair: {
    kind: 'aerial',
    faf: 46,
    landingLag: 17,
    autoCancel: [
      [1, 7],
      [38, 46],
    ],
    hits: [
      ...[8, 11, 14, 17].map((f) => ({
        frames: [f, f + 1] as [number, number],
        rehit: true,
        boxes: [box(0, 0, -1, 5.5, { damage: 1.5, angle: 270, kbg: 100, bkb: 0, wbkb: 10 })],
      })),
      {
        frames: [20, 21],
        rehit: true,
        boxes: [box(0, 0, -2, 6.5, { damage: 5, angle: 275, kbg: 60, bkb: 30 })],
      },
    ],
  },
  /** Peel Scoop: scoops the opponent up on the paddle. Reaches 13.5 units, a little past Mario's 12. */
  grab: { kind: 'other', faf: 37, hits: [{ frames: [8, 9], boxes: [grabBox(0, 9, 7, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 45, hits: [{ frames: [10, 11], boxes: [grabBox(0, 10, 7, 5)] }] },
  /** Turns around out of a dash or run and scoops behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 39, hits: [{ frames: [11, 12], boxes: [grabBox(0, 10.5, 7, 5.5)] }] },
  /**
   * Pepper Bomb (neutral special): his game's X button. A lobbed bomb that bounces twice and bursts on contact for
   * 10%, two at a time, as the roster has it.
   */
  neutralB: {
    kind: 'projectile',
    faf: 40,
    hits: [],
    spawn: [{ frame: 14, entity: 'pepperBomb', x: 6, y: 9, vx: 1.25, vy: 1.55, max: 2 }],
  },
  /** Pepper Shake: shakes pepper on the opponent sitting on the paddle. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Into the Oven: slides the opponent off the peel forward; it only kills from the ledge at very high %. */
  fthrow: {
    kind: 'other',
    faf: 30,
    hits: [],
    throw: { frame: 13, hit: { damage: 9, angle: 40, kbg: 70, bkb: 60 } },
  },
  /** Brick Oven: turns and shoves the opponent into an oven door behind him; his kill throw near the ledge. */
  bthrow: {
    kind: 'other',
    faf: 52,
    hits: [],
    throw: { frame: 30, hit: { damage: 11, angle: 45, kbg: 78, bkb: 55, effect: fire, direction: 'back' } },
  },
  /** Dough Spin: spins the opponent overhead like pizza dough and tosses them up; a combo throw at low %. */
  uthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    throw: { frame: 20, hit: { damage: 8, angle: 88, kbg: 70, bkb: 62 } },
  },
  /** Boxed Up: folds the opponent into a pizza box and stomps the lid; pops them up for a follow-up. */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 22, hit: { damage: 6, angle: 80, kbg: 50, bkb: 60 } },
  },
  /**
   * Paddle Propeller (up special): spins the paddle overhead like a rotor and rises about 60 units, five 1% hits
   * carrying the opponent up and a 4% finisher at the top. Steers with the stick and can grab the ledge on the way.
   * TODO(COOL-3): end in his glide (hold jump) instead of helpless once the glide system lands.
   */
  upB: {
    kind: 'other',
    faf: 46,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 12,
    landingLag: 22,
    hits: [
      ...[6, 10, 14, 18, 22].map((f) => ({
        frames: [f, f + 1] as [number, number],
        rehit: true,
        boxes: [
          box(0, 0, 17, 5.5, { damage: 1, angle: 90, kbg: 100, bkb: 0, wbkb: 60, direction: away }),
          box(1, 0, 9, 4.5, { damage: 1, angle: 90, kbg: 100, bkb: 0, wbkb: 60, direction: away }),
        ],
      })),
      {
        frames: [28, 29],
        rehit: true,
        boxes: [
          box(0, 0, 17, 6, { damage: 4, angle: 80, kbg: 120, bkb: 50, direction: away }),
          box(1, 0, 9, 5, { damage: 4, angle: 80, kbg: 120, bkb: 50, direction: away }),
        ],
      },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < PROPELLER.from) {
        f.vel.x *= 0.7;
        f.vel.y = Math.max(f.vel.y * 0.5, 0);
        return;
      }
      if (f.actionFrame > PROPELLER.to) return;
      f.vel.x = stickX(c) * PROPELLER.steer;
      f.vel.y =
        f.actionFrame < PROPELLER.burst
          ? PROPELLER.lift
          : PROPELLER.rise - (f.actionFrame - PROPELLER.burst) * PROPELLER.taper;
    },
  },
  /**
   * Paddle Deflect (down special): holds the paddle up flat, the move PL1 was built around. The paddle's edge hits
   * on frames 5-6; in the air the stance slows his fall.
   */
  downB: {
    kind: 'other',
    faf: 36,
    reflectors: [{ frames: [5, 20], x: 6.5, y: 8, radius: 5, damage: 1.5, speed: 1.25 }],
    hits: [{ frames: [5, 6], boxes: [box(0, 6.5, 8, 4.5, { damage: 7, angle: 45, kbg: 60, bkb: 45 })] }],
    script(x) {
      const { f } = x;
      if (f.ground || f.actionFrame > 20) return;
      f.vel.x *= 0.9;
      f.vel.y = Math.max(f.vel.y, -0.6);
    },
  },
};
