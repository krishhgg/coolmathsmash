import { setAction } from '../../sim/actions/registry';
import { approach } from '../../sim/vec';
import type { HitboxDef, MoveDef } from '../types';
import { specials } from './specials';

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

/** Frame of down air on which Red Ball stops winding up and drops onto the target. */
export const DAIR_DROP_FRAME = 10;
/**
 * Down air's wind-up holds a sliver of upward speed, so he hovers in place and a down flick can't start a fast
 * fall (fast-falling needs a falling fighter). Hovering, he only lands before the drop if knockback is still
 * carrying him down, and the early auto-cancel window keeps that landing soft.
 */
const DAIR_HANG_LIFT = 0.01;

/**
 * Red Ball's normals. He has no arms, so everything is his body: bumps, rolls, bounces and squashes, plus the
 * tongue the roster video gave him for the jab finisher and the grab. First active frames and damage follow the
 * roster sheet. Each kill move copies its Ultimate analogue's hit (named on the move; redball.test.ts checks it KOs
 * where the analogue does), which puts dash attack, down smash, back air and back throw a point off the sheet's
 * damage; the rest use Ultimate-style knockback for moves of their size and speed. Frame windows are inclusive,
 * faf is the first actionable frame.
 */
export const moves: Record<string, MoveDef> = {
  /** Bump: a quick body bump. */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab2' },
    hits: [{ frames: [3, 4], boxes: [box(0, 6.5, 5.5, 3.5, { damage: 2, angle: 361, kbg: 35, bkb: 22 })] }],
  },
  /** Second bump. */
  jab2: {
    kind: 'other',
    faf: 21,
    next: { window: [6, 20], move: 'jab3' },
    hits: [{ frames: [3, 4], boxes: [box(0, 7, 5.5, 3.5, { damage: 2, angle: 361, kbg: 35, bkb: 20 })] }],
  },
  /** Lick: the tongue shoots out and pushes them away. */
  jab3: {
    kind: 'other',
    faf: 32,
    hits: [
      {
        frames: [4, 6],
        boxes: [
          box(0, 10, 5, 3, { damage: 3, angle: 361, kbg: 120, bkb: 45 }),
          box(1, 5.5, 5.5, 3.5, { damage: 3, angle: 361, kbg: 120, bkb: 45 }),
        ],
      },
    ],
  },
  /** Lean Bump: leans in and shoulder-bumps with his whole body. */
  ftilt: {
    kind: 'other',
    faf: 29,
    hits: [{ frames: [6, 8], boxes: [box(0, 8, 5.5, 4.5, { damage: 8, angle: 361, kbg: 100, bkb: 10 })] }],
  },
  /** Header: bounces straight up off the ground; launches up for juggles. */
  utilt: {
    kind: 'other',
    faf: 28,
    hits: [
      {
        frames: [5, 10],
        boxes: [box(0, 0.5, 12, 5.5, { damage: 7, angle: 95, kbg: 125, bkb: 32, direction: 'away' })],
      },
    ],
  },
  /** Squash Skid: squashes flat and skids forward along the floor; low angle. */
  dtilt: {
    kind: 'other',
    faf: 24,
    hits: [{ frames: [5, 8], boxes: [box(0, 8, 2, 4, { damage: 6, angle: 30, kbg: 60, bkb: 45 })] }],
    script({ f }) {
      if (f.actionFrame === 3) f.vel.x = f.facing * 1.4;
    },
  },
  /** Rolling Charge: barrels into them at full roll; weaker late. Jigglypuff's dash attack. */
  dashAttack: {
    kind: 'other',
    faf: 38,
    hits: [
      { frames: [6, 9], boxes: [box(0, 5, 5.5, 5.5, { damage: 12, angle: 43, kbg: 83, bkb: 57 })] },
      { frames: [10, 20], boxes: [box(0, 5, 5.5, 5, { damage: 7, angle: 43, kbg: 83, bkb: 8 })] },
    ],
    script({ f }) {
      if (f.actionFrame >= 4 && f.actionFrame <= 16) f.vel.x = f.facing * 2;
    },
  },
  /** Wind-up Ram: spins in place, then lunges. His forward kill move, Jigglypuff's fsmash. Charges on frame 10. */
  fsmash: {
    kind: 'smash',
    faf: 52,
    charge: 10,
    hits: [
      { frames: [15, 18], boxes: [box(0, 7.5, 5.5, 6, { damage: 16, angle: 361, kbg: 110, bkb: 10 })] },
      { frames: [19, 22], boxes: [box(0, 7, 5.5, 5, { damage: 11, angle: 361, kbg: 85, bkb: 6 })] },
    ],
    script({ f }) {
      if (f.actionFrame >= 13 && f.actionFrame <= 18) f.vel.x = f.facing * 2.4;
      if (f.actionFrame > 18) f.vel.x = approach(f.vel.x, 0, 0.8);
    },
  },
  /** Super Bounce: squashes, then springs straight up. Jigglypuff's up smash. Charges on frame 6. */
  usmash: {
    kind: 'smash',
    faf: 46,
    charge: 6,
    hits: [
      {
        frames: [11, 14],
        boxes: [
          box(0, 0, 13, 6.5, { damage: 15, angle: 87, kbg: 100, bkb: 20, direction: 'away' }),
          box(1, 0, 6, 5.5, { damage: 13, angle: 87, kbg: 100, bkb: 20, direction: 'away' }),
        ],
      },
    ],
  },
  /** Splat: flattens hard, a shockwave out both sides at a low angle like Sonic's dsmash. Charges on frame 4. */
  dsmash: {
    kind: 'smash',
    faf: 46,
    charge: 4,
    hits: [
      {
        frames: [9, 11],
        boxes: [
          box(0, 8, 2, 5, { damage: 12, angle: 30, kbg: 80, bkb: 50 }),
          box(1, -8, 2, 5, { damage: 12, angle: 30, kbg: 80, bkb: 50, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up from the floor rolling out to both sides; intangible until the second roll ends. */
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
  /** Spin: spins in place, strong early, weaker lingering hit. */
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
        frames: [4, 7],
        boxes: [box(0, 0, 5.5, 6.5, { damage: 8, angle: 361, kbg: 100, bkb: 10, direction: 'away' })],
      },
      {
        frames: [8, 24],
        boxes: [box(0, 0, 5.5, 6, { damage: 5, angle: 361, kbg: 100, bkb: 5, direction: 'away' })],
      },
    ],
  },
  /** Roll Slam: a forward roll that slams down in front of him. */
  fair: {
    kind: 'aerial',
    faf: 38,
    landingLag: 9,
    autoCancel: [
      [1, 2],
      [28, 38],
    ],
    hits: [
      { frames: [8, 11], boxes: [box(0, 7, 4.5, 5.5, { damage: 10, angle: 45, kbg: 100, bkb: 22 })] },
      { frames: [12, 16], boxes: [box(0, 6.5, 3.5, 5, { damage: 7, angle: 45, kbg: 95, bkb: 15 })] },
    ],
  },
  /** Back Bump: bumps backward with his whole body; his air kill move, Jigglypuff's back air. */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 9,
    autoCancel: [
      [1, 3],
      [24, 36],
    ],
    hits: [
      {
        frames: [7, 9],
        boxes: [box(0, -7.5, 5.5, 5, { damage: 13, angle: 42, kbg: 120, bkb: 30, direction: 'back' })],
      },
      {
        frames: [10, 14],
        boxes: [box(0, -7, 5.5, 4.5, { damage: 8, angle: 42, kbg: 120, bkb: 0, direction: 'back' })],
      },
    ],
  },
  /** Bounce Header: heads upward. */
  uair: {
    kind: 'aerial',
    faf: 32,
    landingLag: 7,
    autoCancel: [
      [1, 2],
      [20, 32],
    ],
    hits: [
      {
        frames: [5, 9],
        boxes: [box(0, 0, 12, 5.5, { damage: 9, angle: 80, kbg: 118, bkb: 25, direction: 'away' })],
      },
    ],
  },
  /**
   * Cube Squash, the attack from his game: he hovers for a moment, then drops onto the target at fast-fall speed.
   * The clean hit meteors. Connecting bounces him back up like squashing a Gray Cube, gives back one midair jump
   * and lets him act.
   */
  dair: {
    kind: 'aerial',
    faf: 42,
    landingLag: 18,
    autoCancel: [
      [1, 3],
      [36, 42],
    ],
    hits: [
      { frames: [12, 14], boxes: [box(0, 0, 0.5, 5, { damage: 14, angle: 270, kbg: 75, bkb: 30 })] },
      { frames: [15, 24], boxes: [box(0, 0, 0.5, 4.5, { damage: 10, angle: 70, kbg: 70, bkb: 40 })] },
    ],
    script(x) {
      const { f, d } = x;
      if (f.hitVictims.length > 0) {
        f.vel.y = d.shortHopV;
        f.fastFalling = false;
        f.jumpsUsed = Math.max(1, f.jumpsUsed - 1);
        setAction(x, 'fall');
        return;
      }
      if (f.actionFrame < DAIR_DROP_FRAME) {
        f.fastFalling = false;
        f.vel.y = Math.max(f.vel.y * 0.7, DAIR_HANG_LIFT);
      } else if (f.actionFrame <= 24) f.fastFalling = true;
    },
  },
  /** Tongue Grab: a short tongue lash, a little slower than a hand grab and a little longer. */
  grab: { kind: 'other', faf: 38, hits: [{ frames: [10, 11], boxes: [grabBox(0, 9, 5.5, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 46, hits: [{ frames: [12, 13], boxes: [grabBox(0, 10, 5.5, 5)] }] },
  /** Turns around out of a dash or run and licks behind; the roll keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 42, hits: [{ frames: [13, 14], boxes: [grabBox(0, 10.5, 5.5, 5.5)] }] },
  /** Lick: a fast, light pummel. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1, hitlag: 1.5 } },
  /** Spit: spits them forward. */
  fthrow: {
    kind: 'other',
    faf: 30,
    hits: [],
    throw: { frame: 12, hit: { damage: 8, angle: 40, kbg: 62, bkb: 55 } },
  },
  /** Roll-Over: rolls backward over them and flings them behind. His kill throw, Mario's back throw. */
  bthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 24, hit: { damage: 11, angle: 45, kbg: 66, bkb: 70, direction: 'back' } },
  },
  /** Bounce Launch: bounces them straight up off his head. */
  uthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 18, hit: { damage: 8, angle: 90, kbg: 70, bkb: 65 } },
  },
  /** Sit-Squash: sits on them; low knockback for follow-ups. Leaves them Squared (statuses.ts). */
  dthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    throw: { frame: 20, hit: { damage: 7, angle: 75, kbg: 45, bkb: 55, status: 'redball/squared' } },
  },
  ...specials,
};
