import type { AnimClip } from '../../../render/rig/types';
import { R } from './parts';
import {
  DETERMINED,
  DETERMINED_DOWN,
  DIZZY,
  GRIT,
  GRIT_DOWN,
  GRIT_UP,
  LICK,
  LICK_AIM,
  MOUTH_OPEN,
  SHOUT,
  SPIT,
  TONGUE_IN,
  WHEE,
  body,
  fx,
  ground,
  key,
  lick,
  look,
  mix,
  roll,
  type Pose,
} from './poses';

/**
 * Red Ball's move clips, one per move in moves.ts and specials.ts and named after it. Smash numbering: frame 1 is
 * the move's first frame and the clip is FAF - 1 long. `active` lists the hit windows each clip is keyed on, so
 * the renderer can stretch a clip onto changed frame data; from the frame before each window to its end the ball
 * or the tongue covers every hitbox centre (the coverage test in index.test.ts). Effects are switched on by the
 * key that places them and off with `swaps: {}`, which returns the slots to the clip's face.
 */
export type MoveClip = AnimClip & { active: [number, number][] };

/** Holding a grabbed fighter (held just in front of him): the tongue stuck to them. */
const HOLD: Pose = lick(mix(body(1.02, 0.98, 0.5), roll(4)), [7.2, -5.4]);

/** A tongue lash at rig point `to` from a lean `dx` forward. */
const lash = (dx: number, to: readonly [number, number], sx = 1.06, sy = 0.96): Pose =>
  lick(mix(body(sx, sy, dx), roll(4)), to);

/** Swirl arcs around the ball and speed lines behind it. */
const swirl = (x: number, y = -R, s = 1): Pose => fx('fx4', x, y, s);
const speed = (x: number, y = -R, s = 1, rot = 0): Pose => fx('fx3', x, y, s, rot);
const CUBE = { ballLine: 'cubeLine', ballFill: 'cubeFill', ballShade: 'cubeShade' };

/**
 * The Charge Roll rev from frame `from` to `length`: keys every `step` frames, the spin speeding up from `rate0`
 * to `rate1` degrees per frame by frame `full`, the ball shaking on the spot and dust thrown out behind.
 */
function rev(from: number, length: number, full: number, rate0: number, rate1: number, step: number) {
  const keys = [];
  let deg = 0;
  for (let f = from, i = 0; f <= length; f += step, i++) {
    const pose = mix(
      ground(1.1, 0.92, -0.6 + (i % 2 ? 0.15 : -0.15)),
      roll(Math.round(deg)),
      fx('fx1', -6.2 - (i % 3) * 0.6, -0.5 - (i % 3) * 0.3, 0.6 + (i % 3) * 0.2),
      swirl(-0.6),
    );
    keys.push(key(f, pose, { ease: 'linear' }));
    deg += step * (rate0 + (rate1 - rate0) * Math.min(1, (f - from) / (full - from)));
  }
  return keys;
}

/**
 * A Charge Roll tier: rolling at `rate` degrees per frame for `frames`, then slowing to an upright stop. Each tier
 * rolls faster and reads faster: tier 1 is a plain lean, tier 2 adds the swirl arcs, tier 3 stretches into the roll
 * and drags two afterimages behind it.
 */
function chargeRoll(
  frames: number,
  rate: number,
  face: Record<string, string | null>,
  tier: number,
): MoveClip {
  const length = frames + 15;
  const end = Math.ceil((rate * (frames + 6)) / 360) * 360;
  const lean: Pose = tier >= 3 ? body(1.22, 0.87, 1.0) : body(1.06 + tier * 0.03, 0.96 - tier * 0.015, 0.6);
  const fxOn = {
    fxBack: 'speed',
    fx4: tier >= 2 ? 'swirl' : null,
    fx2: tier >= 3 ? 'after' : null,
    fx1: 'dust',
  };
  return {
    length,
    active: [[2, frames]],
    swaps: face,
    keys: [
      key(0, mix(lean, roll(0), speed(-3.5), swirl(0.8), fx('fx1', -5, -0.4, 0.6), fx('fx2', 0, -R, 1)), {
        swaps: fxOn,
        ease: 'linear',
      }),
      key(
        frames,
        mix(
          lean,
          roll(rate * frames),
          speed(-3.5),
          swirl(0.8),
          fx('fx1', -6.5, -0.7, 1),
          fx('fx2', 0, -R, 1),
        ),
        {
          ease: 'out',
        },
      ),
      key(frames + 1, undefined, { swaps: {} }),
      key(frames + 8, mix(ground(1.06, 0.95, 0.4), roll(end))),
      key(length, mix(ground(), roll(end)), { swaps: DETERMINED }),
    ],
  };
}

export const attacks = {
  /** Bump: a quick body bump. */
  jab: {
    length: 19,
    active: [[3, 4]],
    keys: [
      key(0, body()),
      key(1, mix(body(0.9, 1.08, -0.7), roll(-8)), { swaps: GRIT, ease: 'out' }),
      key(2, mix(body(1.2, 0.86, 2.8), roll(8))),
      key(4, mix(body(1.18, 0.88, 3.0), roll(8))),
      key(9, mix(body(0.97, 1.03, 0.4), roll(0))),
      key(12, undefined, { swaps: DETERMINED }),
      key(19, body()),
    ],
  },
  /** Second bump, a bit further. */
  jab2: {
    length: 20,
    active: [[3, 4]],
    keys: [
      key(0, body(1, 1, 0.3)),
      key(1, mix(body(0.92, 1.06, -0.3), roll(-6)), { swaps: GRIT, ease: 'out' }),
      key(2, mix(body(1.24, 0.84, 3.2), roll(12))),
      key(4, mix(body(1.22, 0.85, 3.4), roll(12))),
      key(10, mix(body(0.98, 1.02, 0.5), roll(0))),
      key(13, undefined, { swaps: DETERMINED }),
      key(20, body()),
    ],
  },
  /** Lick: the tongue shoots out and shoves them away. */
  jab3: {
    length: 31,
    active: [[4, 6]],
    keys: [
      key(0, body()),
      key(2, mix(body(0.92, 1.06, -0.6), roll(-10)), { swaps: MOUTH_OPEN, ease: 'out' }),
      key(3, lash(1.6, [10.6, -5.0], 1.08, 0.95), { swaps: LICK }),
      key(6, lash(1.8, [11.0, -5.2], 1.08, 0.95)),
      key(10, lash(1.0, [6.5, -5.0], 1.02, 0.98)),
      key(13, mix(body(1, 1, 0.4), TONGUE_IN), { swaps: MOUTH_OPEN }),
      key(16, body(), { swaps: DETERMINED }),
      key(31, body()),
    ],
  },
  /** Lean Bump: rocks back, then throws his whole body forwards. */
  ftilt: {
    length: 28,
    active: [[6, 8]],
    swaps: GRIT,
    keys: [
      key(0, body(), { swaps: DETERMINED }),
      key(3, mix(body(0.9, 1.08, -1.2), roll(-14)), { swaps: {}, ease: 'in' }),
      key(5, mix(body(1.28, 0.84, 3.4), roll(12), speed(-1.5)), { swaps: { fxBack: 'speed' }, ease: 'out' }),
      key(8, mix(body(1.25, 0.85, 3.6), roll(12), speed(-1.2))),
      key(10, undefined, { swaps: {} }),
      key(14, mix(body(0.96, 1.04, 0.6), roll(-2))),
      key(16, undefined, { swaps: DETERMINED }),
      key(20, body(1.02, 0.98, 0.2)),
      key(28, body()),
    ],
  },
  /** Header: squashes and bounces straight up. */
  utilt: {
    length: 27,
    active: [[5, 10]],
    keys: [
      key(0, ground()),
      key(2, ground(1.22, 0.8), { swaps: GRIT_UP, ease: 'out' }),
      key(4, mix(ground(0.86, 1.2, 0, 1.6), roll(-4))),
      key(7, mix(ground(0.88, 1.18, 0, 2.6), roll(-4))),
      key(10, ground(0.92, 1.12, 0, 2.2), { ease: 'in' }),
      key(15, ground(1, 1, 0, 0.4)),
      key(17, ground(1.2, 0.82), { swaps: DETERMINED }),
      key(21, ground(0.97, 1.03)),
      key(27, ground()),
    ],
  },
  /** Squash Skid: flattens and skids along the floor, dust behind. */
  dtilt: {
    length: 23,
    active: [[5, 8]],
    swaps: GRIT_DOWN,
    keys: [
      key(0, ground(), { swaps: DETERMINED }),
      key(2, ground(1.3, 0.72), { swaps: {}, ease: 'out' }),
      key(4, mix(ground(1.45, 0.6, 3.6), fx('fx1', -2.4, -0.3, 0.6)), { swaps: { fx1: 'dust' } }),
      key(8, mix(ground(1.42, 0.62, 4.0), fx('fx1', -4.0, -0.6, 1.0))),
      key(11, undefined, { swaps: {} }),
      key(13, ground(1.1, 0.9, 1.5)),
      key(16, undefined, { swaps: DETERMINED }),
      key(18, ground(0.98, 1.02, 0.3)),
      key(23, ground()),
    ],
  },
  /** Rolling Charge: barrels in at full roll, then skids to a stop. */
  dashAttack: {
    length: 37,
    active: [
      [6, 9],
      [10, 20],
    ],
    swaps: GRIT,
    keys: [
      key(0, body()),
      key(3, mix(ground(1.15, 0.88, -0.5), roll(-15))),
      key(5, mix(body(1.1, 0.93, 1.8), roll(40), speed(-2.2), swirl(1.8)), {
        swaps: { fxBack: 'speed', fx4: 'swirl' },
        ease: 'linear',
      }),
      key(20, mix(body(1.1, 0.93, 2.0), roll(520), speed(-2.0), swirl(2.0)), { ease: 'out' }),
      key(21, undefined, { swaps: {} }),
      key(28, mix(ground(1.1, 0.92, 1.2), roll(700))),
      key(31, undefined, { swaps: DETERMINED }),
      key(37, mix(ground(), roll(720))),
    ],
  },
  /** Wind-up Ram: revs in place, then lunges. Charges on frame 10. */
  fsmash: {
    length: 51,
    active: [
      [15, 18],
      [19, 22],
    ],
    swaps: GRIT,
    keys: [
      key(0, ground()),
      key(3, mix(ground(1.12, 0.9, -1.0), roll(-15), fx('fx1', -5.6, -0.4, 0.5), swirl(-1.0)), {
        swaps: { fx1: 'dust', fx4: 'swirl' },
        ease: 'linear',
      }),
      key(10, mix(ground(1.1, 0.92, -1.4), roll(340), fx('fx1', -7.2, -0.8, 0.9), swirl(-1.4)), {
        ease: 'linear',
      }),
      key(13, mix(ground(1.06, 0.95, -1.2), roll(560), fx('fx1', -6.4, -0.6, 0.7), swirl(-1.2)), {
        ease: 'out',
      }),
      key(14, mix(body(1.46, 0.76, 4.6), roll(720), speed(0.4), fx('fx2', 0.6, -R, 1.05)), {
        swaps: { ...SHOUT, fxBack: 'speed', fx2: 'after' },
        ease: 'out',
      }),
      key(18, mix(body(1.44, 0.77, 5.0), roll(725), speed(0.8), fx('fx2', 1.0, -R, 1.15))),
      key(19, undefined, { swaps: {} }),
      key(22, mix(body(1.15, 0.9, 3.6), roll(732))),
      key(30, mix(body(0.94, 1.05, 1.0), roll(724))),
      key(34, undefined, { swaps: DETERMINED }),
      key(38, mix(ground(1.06, 0.95), roll(720))),
      key(51, mix(ground(), roll(720))),
    ],
  },
  /** Super Bounce: squashes flat, then springs straight up off a ring of air. Charges on frame 6. */
  usmash: {
    length: 45,
    active: [[11, 14]],
    swaps: GRIT_UP,
    keys: [
      key(0, ground()),
      key(3, ground(1.25, 0.76)),
      key(6, ground(1.35, 0.68)),
      key(9, ground(1.42, 0.62), { ease: 'out' }),
      key(10, mix(ground(0.8, 1.34, 0, 1.0), fx('fx1', 0, 0, 0.7)), {
        swaps: { ...SHOUT, fx1: 'ring' },
        ease: 'out',
      }),
      key(14, mix(ground(0.82, 1.3, 0, 2.2), fx('fx1', 0, 0, 1.4))),
      key(17, undefined, { swaps: SHOUT }),
      key(18, ground(0.95, 1.06, 0, 2.0), { ease: 'in' }),
      key(23, ground(1, 1, 0, 0.4)),
      key(25, ground(1.25, 0.78), { ease: 'out' }),
      key(28, undefined, { swaps: DETERMINED }),
      key(30, ground(0.96, 1.04)),
      key(45, ground()),
    ],
  },
  /** Splat: hops, then flattens hard with a wave out both sides. Charges on frame 4. */
  dsmash: {
    length: 45,
    active: [[9, 11]],
    swaps: GRIT,
    keys: [
      key(0, ground()),
      key(2, ground(1.2, 0.8), { ease: 'out' }),
      key(4, ground(0.86, 1.16, 0, 1.8)),
      key(7, ground(0.9, 1.1, 0, 2.6), { ease: 'in' }),
      key(8, mix(ground(1.75, 0.42), fx('fx1', 5.0, 0, 0.8), fx('fx2', -5.0, 0, -0.8, 0, 0.8)), {
        swaps: { ...GRIT_DOWN, fx1: 'wave', fx2: 'wave' },
        ease: 'out',
      }),
      key(11, mix(ground(1.78, 0.41), fx('fx1', 7.4, 0, 1.05), fx('fx2', -7.4, 0, -1.05, 0, 1.05))),
      key(15, mix(ground(1.3, 0.72), fx('fx1', 9.5, 0, 0.8), fx('fx2', -9.5, 0, -0.8, 0, 0.8))),
      key(17, undefined, { swaps: {} }),
      key(20, ground(0.9, 1.1)),
      key(25, ground(1.08, 0.93), { swaps: DETERMINED }),
      key(32, ground()),
      key(45, ground()),
    ],
  },
  /** Getting up rolling out to one side, then the other. */
  getupAttack: {
    length: 45,
    active: [
      [17, 18],
      [25, 26],
    ],
    keys: [
      key(0, mix(ground(1.32, 0.7), roll(-75)), { swaps: DIZZY }),
      key(6, mix(ground(1.2, 0.8), roll(-20)), { swaps: GRIT }),
      key(12, mix(ground(1.05, 0.95, 1.0), roll(0)), { ease: 'in' }),
      key(16, mix(ground(1, 1, 4.8), roll(150))),
      key(18, mix(ground(1.02, 0.98, 5.0), roll(170))),
      key(21, mix(ground(1, 1, 0.5), roll(40))),
      key(24, mix(ground(1, 1, -4.8), roll(-110))),
      key(26, mix(ground(1.02, 0.98, -5.0), roll(-130))),
      key(33, mix(ground(1.05, 0.95, -1), roll(-20))),
      key(34, undefined, { swaps: DETERMINED }),
      key(38, mix(ground(), roll(0))),
      key(45, ground()),
    ],
  },
  /** Spin: two fast turns in place. */
  nair: {
    length: 39,
    active: [
      [4, 7],
      [8, 24],
    ],
    swaps: GRIT,
    keys: [
      key(0, body()),
      key(2, mix(body(1.1, 0.92), roll(-20))),
      key(3, mix(body(1.05, 0.96), roll(0), swirl(0)), { swaps: { fx4: 'swirl' }, ease: 'linear' }),
      key(24, mix(body(1.04, 0.97), roll(690), swirl(0)), { ease: 'out' }),
      key(25, undefined, { swaps: {} }),
      key(32, mix(body(), roll(720)), { swaps: DETERMINED }),
      key(39, mix(body(), roll(720))),
    ],
  },
  /** Roll Slam: a forward roll that slams down in front of him. */
  fair: {
    length: 37,
    active: [
      [8, 11],
      [12, 16],
    ],
    swaps: GRIT,
    keys: [
      key(0, body()),
      key(3, mix(body(0.95, 1.06, -1.0, -0.8), roll(-40)), { ease: 'in' }),
      key(7, mix(body(1.3, 0.86, 3.0, 0.2), roll(38), swirl(3.0, -4.8)), {
        swaps: { fx4: 'swirl' },
        ease: 'out',
      }),
      key(11, mix(body(1.32, 0.85, 3.6, 0.8), roll(72), swirl(3.6, -4.2))),
      key(14, undefined, { swaps: {} }),
      key(16, mix(body(1.16, 0.9, 3.0, 1.4), roll(210))),
      key(22, mix(body(1, 1, 1.2, 0.6), roll(360)), { swaps: DETERMINED }),
      key(37, mix(body(), roll(360))),
    ],
  },
  /** Back Bump: looks over his shoulder and slams backwards. */
  bair: {
    length: 35,
    active: [
      [7, 9],
      [10, 14],
    ],
    swaps: GRIT,
    keys: [
      key(0, mix(body(), look(-0.5, 0, -1))),
      key(3, mix(body(0.92, 1.06, 1.0), roll(8), look(-0.6, 0, -1)), { ease: 'in' }),
      key(6, mix(body(1.26, 0.85, -3.4), roll(-10), look(-0.9, 0, -1), fx('fx3', 0.6, -R, -1, 0, 1)), {
        swaps: { fxBack: 'speed' },
        ease: 'out',
      }),
      key(9, mix(body(1.25, 0.85, -3.6), roll(-10), look(-0.9, 0, -1), fx('fx3', 0.4, -R, -1, 0, 1))),
      key(11, undefined, { swaps: {} }),
      key(14, mix(body(1.12, 0.92, -2.6), roll(-6), look(-0.8, 0, -1))),
      key(20, mix(body(0.98, 1.02, -0.5), look(-0.4, 0, -1))),
      key(26, mix(body(), look(0, 0, 1)), { swaps: DETERMINED }),
      key(35, body()),
    ],
  },
  /** Bounce Header: stretches up into a header. */
  uair: {
    length: 31,
    active: [[5, 9]],
    keys: [
      key(0, body(), { swaps: GRIT_UP }),
      key(2, body(1.15, 0.88, 0, 0.8), { ease: 'out' }),
      key(4, mix(body(0.82, 1.3, 0, -2.6), roll(-6))),
      key(9, mix(body(0.85, 1.26, 0, -2.8), roll(-6))),
      key(14, body(0.98, 1.03, 0, -0.8)),
      key(16, undefined, { swaps: DETERMINED }),
      key(20, body()),
      key(31, body()),
    ],
  },
  /** Cube Squash: hovers winding up, then drops as a rounded cube and flattens into the hit. */
  dair: {
    length: 41,
    active: [
      [12, 14],
      [15, 24],
    ],
    swaps: GRIT_DOWN,
    keys: [
      key(0, body()),
      key(3, mix(body(1.12, 0.9, 0, -0.5), roll(-8))),
      key(9, mix(body(1.18, 0.84, 0, -0.8), roll(-4)), {
        ease: 'out',
        swaps: CUBE,
      }),
      key(11, mix(body(0.9, 1.18, 0, 0.6), speed(0, -12.5, 1.1, 90)), {
        swaps: { ...CUBE, fxBack: 'speed' },
      }),
      key(14, mix(body(1.28, 0.8, 0, 0.9), speed(0, -12.5, 1.1, 90))),
      key(16, mix(body(1.3, 0.76, 0, 1.1), speed(0, -12.5, 1.1, 90))),
      key(24, mix(body(1.2, 0.84, 0, 1.0), speed(0, -12.5, 1.1, 90))),
      key(25, undefined, { swaps: {} }),
      key(28, body(0.94, 1.08)),
      key(30, undefined, { swaps: DETERMINED_DOWN }),
      key(34, body()),
      key(41, body()),
    ],
  },
  /** Tongue Grab: rocks back, then lashes the tongue out. */
  grab: {
    length: 37,
    active: [[10, 11]],
    keys: [
      key(0, body()),
      key(4, mix(body(0.94, 1.05, -0.8), roll(-10)), { swaps: MOUTH_OPEN }),
      key(8, mix(body(1, 1, 0.4), roll(0)), { ease: 'out' }),
      key(9, lash(1.0, [9.6, -5.5]), { swaps: LICK_AIM }),
      key(11, lash(1.1, [10.0, -5.6])),
      key(16, lash(0.6, [5.0, -4.4], 1, 1)),
      key(19, mix(body(1, 1, 0.3), TONGUE_IN), { swaps: MOUTH_OPEN }),
      key(24, body(), { swaps: DETERMINED }),
      key(37, body()),
    ],
  },
  /** Out of a dash: skids, then lashes the tongue further. */
  dashGrab: {
    length: 45,
    active: [[12, 13]],
    swaps: MOUTH_OPEN,
    keys: [
      key(0, mix(ground(1.1, 0.92), roll(-25), fx('fx1', 5.0, -0.3, 0.6)), { swaps: { fx1: 'dust' } }),
      key(8, mix(ground(1.05, 0.95, 0.8), roll(-8), fx('fx1', 7.2, -0.8, 1.0)), { ease: 'out' }),
      key(11, lash(1.4, [10.6, -5.5], 1.08, 0.95), { swaps: LICK_AIM }),
      key(13, lash(1.5, [11.0, -5.6], 1.08, 0.95)),
      key(19, lash(0.6, [5.2, -4.5], 1, 1)),
      key(22, mix(body(1, 1, 0.3), TONGUE_IN), { swaps: {} }),
      key(28, body(), { swaps: DETERMINED }),
      key(45, body()),
    ],
  },
  /** Turns round out of a run (the face swings across) and lashes the tongue the new way. */
  pivotGrab: {
    length: 41,
    active: [[13, 14]],
    keys: [
      key(0, mix(ground(1.08, 0.93), look(-2.4, 0, 0.5), roll(-20)), { swaps: MOUTH_OPEN }),
      key(6, mix(ground(1.03, 0.97), look(0), roll(-10)), { ease: 'out' }),
      key(12, lash(1.4, [11.1, -5.5], 1.08, 0.95), { swaps: LICK_AIM }),
      key(14, lash(1.5, [11.4, -5.6], 1.08, 0.95)),
      key(20, lash(0.6, [5.2, -4.5], 1, 1)),
      key(23, mix(body(1, 1, 0.3), TONGUE_IN), { swaps: MOUTH_OPEN }),
      key(29, body(), { swaps: DETERMINED }),
      key(41, body()),
    ],
  },
  /** Lick: the stuck tongue slurps up over them. */
  pummel: {
    length: 6,
    active: [],
    swaps: LICK,
    keys: [
      key(0, HOLD),
      key(2, lick(mix(body(1.06, 0.95, 0.8), roll(3)), [7.8, -7.4])),
      key(4, lick(mix(body(1.02, 0.98, 0.5), roll(4)), [7.4, -5.9])),
      key(6, HOLD),
    ],
  },
  /** Spit: reels them in, puffs up and spits them out. */
  fthrow: {
    length: 29,
    active: [],
    keys: [
      key(0, HOLD, { swaps: LICK_AIM }),
      key(4, lick(mix(body(0.95, 1.05, -0.5), roll(-10)), [4.2, -4.8])),
      key(7, mix(body(1.16, 1.1, -0.6), roll(-14), TONGUE_IN), {
        swaps: { eyes: 'eyesHurt', brow: 'browAngry', mouth: 'mouthSpit' },
      }),
      key(10, mix(body(1.18, 1.1, -0.7), roll(-16)), { ease: 'out' }),
      key(11, mix(body(1.2, 0.86, 2.0), roll(10), fx('fx1', 7.0, -5.6, 0.5)), {
        swaps: { ...SPIT, fx1: 'pop' },
      }),
      key(15, mix(body(1.15, 0.9, 1.8), roll(8), fx('fx1', 8.0, -5.8, 0.9))),
      key(17, undefined, { swaps: SPIT }),
      key(20, mix(body(0.98, 1.02, 0.4), roll(0))),
      key(22, undefined, { swaps: DETERMINED }),
      key(29, body()),
    ],
  },
  /** Roll-Over: a back flip that flings them behind him. */
  bthrow: {
    length: 41,
    active: [],
    keys: [
      key(0, HOLD, { swaps: LICK_AIM }),
      key(6, lick(mix(ground(1.15, 0.88), roll(-5)), [6.8, -5.0])),
      key(10, mix(ground(1.2, 0.8), TONGUE_IN), { swaps: GRIT, ease: 'out' }),
      key(17, mix(ground(0.9, 1.1, -1.5, 4.5), roll(-180)), { ease: 'in' }),
      key(24, mix(ground(1.25, 0.78, -3.0), roll(-360)), { swaps: SHOUT, ease: 'out' }),
      key(30, mix(ground(0.97, 1.03, -1.5), roll(-360)), { swaps: DETERMINED }),
      key(41, mix(ground(), roll(-360))),
    ],
  },
  /** Bounce Launch: squashes under them and springs them upwards. */
  uthrow: {
    length: 41,
    active: [],
    keys: [
      key(0, HOLD, { swaps: LICK_AIM }),
      key(6, lick(ground(1.2, 0.82), [6.8, -4.8])),
      key(12, mix(ground(1.38, 0.66), TONGUE_IN), { swaps: GRIT_UP, ease: 'out' }),
      key(16, mix(ground(0.82, 1.3, 0, 2.0), fx('fx1', 0, 0, 0.8)), { swaps: { ...SHOUT, fx1: 'ring' } }),
      key(20, mix(ground(0.86, 1.22, 0, 3.0), fx('fx1', 0, 0, 1.4)), { ease: 'in' }),
      key(23, undefined, { swaps: SHOUT }),
      key(26, ground(1, 1, 0, 0.8)),
      key(29, ground(1.22, 0.8), { swaps: DETERMINED }),
      key(34, ground(0.97, 1.03)),
      key(41, ground()),
    ],
  },
  /** Sit-Squash: hops up and squashes down on them. */
  dthrow: {
    length: 37,
    active: [],
    keys: [
      key(0, HOLD, { swaps: LICK_AIM }),
      key(4, lick(ground(1.18, 0.84), [6.8, -4.8])),
      key(7, mix(ground(1.25, 0.78), TONGUE_IN), { swaps: GRIT_DOWN, ease: 'out' }),
      key(11, ground(0.88, 1.14, 4.5, 4.5)),
      key(15, ground(0.95, 1.05, 7.0, 3.5), { ease: 'in' }),
      key(18, ground(1.3, 0.72, 8.0, 1.2)),
      key(20, ground(1.4, 0.62, 8.0, 0.8), { ease: 'out' }),
      key(24, ground(0.9, 1.1, 4.0, 3.0), { ease: 'in' }),
      key(29, ground(1.2, 0.8), { swaps: DETERMINED }),
      key(33, ground(0.97, 1.03)),
      key(37, ground()),
    ],
  },

  /** Charge Roll's rev: leans in and spins on the spot faster and faster, kicking up dust. */
  neutralB: {
    length: 77,
    active: [],
    swaps: GRIT,
    keys: [
      key(0, ground()),
      key(4, mix(ground(1.15, 0.88, -0.5), roll(-15)), { ease: 'out' }),
      key(8, undefined, { swaps: { fx1: 'dust', fx4: 'swirl' } }),
      ...rev(8, 29, 68, 20, 62, 3),
      key(30, undefined, { swaps: { ...SHOUT, fx1: 'dust', fx4: 'swirl' } }),
      ...rev(8, 74, 68, 20, 62, 3).filter((k) => k.frame >= 30),
      key(75, mix(fx('fx2', 0, -R, 1.15), swirl(-0.6)), {
        swaps: { ...SHOUT, fx1: null, fx4: 'swirl', fx2: 'flash' },
      }),
      key(77, undefined, { swaps: { ...SHOUT, fx2: null, fx4: null } }),
    ],
  },
  chargeRoll1: chargeRoll(30, 26, GRIT, 1),
  chargeRoll2: chargeRoll(40, 36, GRIT, 2),
  chargeRoll3: chargeRoll(50, 48, GRIT, 3),
  /** Mega Bounce: squashes flat, then springs up stretched off a ring of air, flipping as he goes. */
  upB: {
    length: 45,
    active: [[8, 11]],
    swaps: GRIT,
    keys: [
      key(0, ground()),
      key(3, ground(1.3, 0.72)),
      key(7, ground(1.52, 0.6), { ease: 'out' }),
      key(
        8,
        mix(ground(0.7, 1.46, 0, 0.6), fx('fx1', 0, 0, 0.9), fx('fx3', 0, -7, 1.7), fx('fx2', 0, -R, 1.15)),
        {
          swaps: { ...WHEE, fx1: 'ring', fxBack: 'pop', fx2: 'spike' },
          ease: 'out',
        },
      ),
      key(
        12,
        mix(body(0.76, 1.36), roll(10), fx('fx1', 0, 3, 1.6), fx('fx3', 0, -R, 2.4), fx('fx2', 0, -R, 1.3)),
        {
          swaps: { ...WHEE, fx1: 'ring', fx2: 'spike' },
        },
      ),
      key(15, undefined, { swaps: { ...WHEE, fx2: null } }),
      key(20, mix(body(0.92, 1.1), roll(60))),
      key(30, mix(body(), roll(200))),
      key(34, undefined, { swaps: DIZZY }),
      key(45, mix(body(), roll(360))),
    ],
  },
} satisfies Record<string, MoveClip>;
