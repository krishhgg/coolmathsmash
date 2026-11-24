import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';

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
 * Wheely's normals: a car with no fists, so every hit is the bumper, the wheels, the hood, the horn or the exhaust.
 * Damage and first active frames are the roster sheet's (handoffs/research/roster.md, "13. Wheely"); knockback is
 * tuned so the kill moves KO Mario at the Battlefield ledge near the sheet's percents (pinned in wheely.test.ts).
 * His body runs from x = -9 (rear bumper) to x = 9 (front bumper) and up to y = 11 (roof).
 */
export const moves: Record<string, MoveDef> = {
  /** Beep: a horn blast, a ring of sound just past the front bumper. */
  jab: {
    kind: 'other',
    faf: 18,
    hits: [{ frames: [3, 4], boxes: [box(0, 11, 5.5, 3.5, { damage: 2, angle: 361, kbg: 30, bkb: 25 })] }],
  },
  /** Bumper Bump: lurches forward bumper-first. */
  ftilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 11, 4, 4, { damage: 9, angle: 361, kbg: 94, bkb: 8 }),
          box(1, 5, 5, 4, { damage: 8, angle: 361, kbg: 94, bkb: 6 }),
        ],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame >= 5 && f.actionFrame <= 8) f.vel.x = f.facing * 0.9;
    },
  },
  /** Wheelie: rears up on the back wheels and the front bumper swings up through the target. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 10],
        boxes: [
          box(0, 6, 13, 4.5, { damage: 8, angle: 95, kbg: 125, bkb: 30 }),
          box(1, 9, 7, 4, { damage: 7, angle: 100, kbg: 120, bkb: 30 }),
        ],
      },
    ],
  },
  /** Gravel Spray: spins the front tyre and sprays gravel along the ground; trips at low %. */
  dtilt: {
    kind: 'other',
    faf: 22,
    hits: [
      {
        frames: [5, 7],
        boxes: [
          box(0, 11, 1.5, 3.5, { damage: 6, angle: 30, kbg: 60, bkb: 35 }),
          box(1, 16, 1.5, 3, { damage: 4, angle: 30, kbg: 60, bkb: 30 }),
        ],
      },
    ],
  },
  /** Handbrake Drift: yanks the handbrake out of a run and skids broadside into them; weaker as the skid dies. */
  dashAttack: {
    kind: 'other',
    faf: 42,
    hits: [
      {
        frames: [8, 12],
        boxes: [box(0, 5, 5, 7, { damage: 11, angle: 45, kbg: 56, bkb: 65 })],
      },
      {
        frames: [13, 22],
        boxes: [box(0, 5, 5, 6, { damage: 7, angle: 50, kbg: 49, bkb: 50 })],
      },
    ],
  },
  /** Rev Ram: revs in place (charges on frame 10), then lunges bumper-first. His forward kill move. */
  fsmash: {
    kind: 'smash',
    faf: 52,
    charge: 10,
    hits: [
      {
        frames: [16, 18],
        boxes: [
          box(0, 12, 5, 5.5, { damage: 17, angle: 361, kbg: 69, bkb: 32 }),
          box(1, 5, 5, 5, { damage: 15, angle: 361, kbg: 69, bkb: 28 }),
        ],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame >= 13 && f.actionFrame <= 17) f.vel.x = f.facing * 2;
    },
  },
  /** Hood Pop: the hood springs open straight up. */
  usmash: {
    kind: 'smash',
    faf: 48,
    charge: 6,
    hits: [
      {
        frames: [12, 15],
        boxes: [
          box(0, 3, 14, 6, { damage: 14, angle: 88, kbg: 94, bkb: 34 }),
          box(1, 7, 9, 4.5, { damage: 12, angle: 85, kbg: 94, bkb: 30 }),
        ],
      },
    ],
  },
  /** Donut: spins out on the spot; the front bumper sweeps first, then the rear swings round behind. */
  dsmash: {
    kind: 'smash',
    faf: 50,
    charge: 4,
    hits: [
      {
        frames: [11, 12],
        boxes: [box(0, 10, 3, 5, { damage: 13, angle: 30, kbg: 70, bkb: 30 })],
      },
      {
        frames: [15, 16],
        boxes: [box(0, -10, 3, 5, { damage: 13, angle: 30, kbg: 70, bkb: 30, direction: 'back' })],
      },
    ],
  },
  /** Rolling back onto his wheels from lying down, bumping both sides; intangible until the second bump ends. */
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
  /** Barrel Roll: rolls over in the air, the whole car a hitbox; strong early, weak late. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 9,
    autoCancel: [
      [1, 4],
      [33, 40],
    ],
    hits: [
      {
        frames: [6, 9],
        boxes: [box(0, 0, 5.5, 7.5, { damage: 9, angle: 361, kbg: 90, bkb: 15, direction: 'away' })],
      },
      {
        frames: [10, 20],
        boxes: [box(0, 0, 5.5, 7, { damage: 6, angle: 361, kbg: 90, bkb: 8, direction: 'away' })],
      },
    ],
  },
  /** Front Flip: flips forward and slams the front bumper down in front of him. */
  fair: {
    kind: 'aerial',
    faf: 44,
    landingLag: 14,
    autoCancel: [
      [1, 3],
      [37, 44],
    ],
    hits: [
      {
        frames: [10, 13],
        boxes: [
          box(0, 10, 3, 5, { damage: 12, angle: 361, kbg: 72, bkb: 30 }),
          box(1, 6, 9, 4.5, { damage: 10, angle: 361, kbg: 72, bkb: 25 }),
        ],
      },
    ],
  },
  /** Backfire: the exhaust pipe bangs out a burst of flame behind him. His aerial kill move. */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 10,
    autoCancel: [
      [1, 4],
      [28, 36],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: [
          box(0, -12, 4, 5, { damage: 13, angle: 361, kbg: 72, bkb: 24, effect: 'fire', direction: 'back' }),
        ],
      },
      {
        frames: [12, 15],
        boxes: [
          box(0, -11, 4, 4, { damage: 8, angle: 361, kbg: 72, bkb: 10, effect: 'fire', direction: 'back' }),
        ],
      },
    ],
  },
  /** Roof Flip: flips wheels-up and the tyres run over whoever is above. */
  uair: {
    kind: 'aerial',
    faf: 35,
    landingLag: 8,
    autoCancel: [
      [1, 3],
      [27, 35],
    ],
    hits: [
      {
        frames: [7, 11],
        boxes: [box(0, 0, 14, 6.5, { damage: 9, angle: 80, kbg: 115, bkb: 35, direction: 'away' })],
      },
    ],
  },
  /** Wheel Stomp: drops wheels-first; the tyres meteor on the first frames, then a weaker landing hit. */
  dair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 22,
    autoCancel: [
      [1, 3],
      [41, 50],
    ],
    hits: [
      { frames: [13, 16], boxes: [box(0, 0, -1, 6.5, { damage: 13, angle: 270, kbg: 85, bkb: 20 })] },
      { frames: [17, 24], boxes: [box(0, 0, 0, 6, { damage: 9, angle: 361, kbg: 90, bkb: 20 })] },
    ],
  },
  /** Door Scoop: swings the passenger door open and scoops them in; slow but long, like the heavies' grabs. */
  grab: { kind: 'other', faf: 40, hits: [{ frames: [9, 10], boxes: [grabBox(0, 8.5, 5.5, 5)] }] },
  dashGrab: { kind: 'other', faf: 46, hits: [{ frames: [11, 12], boxes: [grabBox(0, 9.5, 5.5, 5.5)] }] },
  /** Turns round out of a dash or run and scoops behind; the skid keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 42, hits: [{ frames: [12, 13], boxes: [grabBox(0, 10, 5.5, 6)] }] },
  /** Door Slam: slams the door on them. */
  pummel: { kind: 'other', faf: 8, hits: [], pummel: { frame: 1, damage: 1.5, hitlag: 2 } },
  /** Eject: pops the door and fires them out forward. */
  fthrow: {
    kind: 'other',
    faf: 32,
    hits: [],
    throw: { frame: 14, hit: { damage: 9, angle: 40, kbg: 57, bkb: 60 } },
  },
  /** Reverse Bump: throws it in reverse and rams them out of the back. His kill throw at the ledge. */
  bthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 22, hit: { damage: 11, angle: 40, kbg: 56, bkb: 60, direction: 'back' } },
  },
  /** Wheelie Flip: pops a wheelie and flips them off the hood, straight up. */
  uthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 20, hit: { damage: 9, angle: 90, kbg: 70, bkb: 65 } },
  },
  /** Run Over: drops them and drives over them, leaving tyre tracks; pops them up for a follow-up. */
  dthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 24, hit: { damage: 7, angle: 75, kbg: 45, bkb: 60 } },
  },
  /**
   * Charge Through (side special): spins the tyres for a moment, then floors it straight through whoever is in
   * the way. In the air he drives level and ends helpless; landing mid-dash keeps the dash going on the ground.
   */
  sideB: {
    kind: 'other',
    faf: 52,
    helpless: true,
    continuesOnLanding: true,
    landingLag: 20,
    hits: [
      {
        frames: [14, 28],
        boxes: [box(0, 3, 5, 7, { damage: 10, angle: 40, kbg: 70, bkb: 60 })],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame < 14) {
        f.vel.x *= 0.8;
        if (!f.ground) f.vel.y = Math.max(f.vel.y * 0.8, -0.4);
      } else if (f.actionFrame <= 29) {
        f.vel.x = f.facing * 3.2;
        if (!f.ground) f.vel.y = 0;
      } else {
        f.vel.x *= 0.85;
      }
    },
  },
  /**
   * Ramp Jump (up special): a little wooden ramp from his puzzle levels drops in front of him; he drives up it
   * and launches on a long diagonal, about 90 units, steerable a little with the stick. Ends helpless.
   */
  upB: {
    kind: 'other',
    faf: 40,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 16,
    landingLag: 24,
    hits: [
      { frames: [10, 14], boxes: [box(0, 4, 5, 6.5, { damage: 6, angle: 70, kbg: 80, bkb: 50 })] },
      { frames: [15, 24], boxes: [box(0, 3, 5, 5.5, { damage: 3, angle: 70, kbg: 60, bkb: 40 })] },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < 4) {
        f.vel.x *= 0.7;
        f.vel.y = Math.max(f.vel.y, 0);
      } else if (f.actionFrame < 10) {
        f.vel.x = f.facing * 0.9;
        f.vel.y = 0.6;
      } else if (f.actionFrame === 10) {
        const lean = stickX(c) * f.facing;
        f.vel.x = f.facing * (2 + 0.5 * lean);
        f.vel.y = 3.9 - 0.4 * Math.max(0, lean);
      }
    },
  },
};
