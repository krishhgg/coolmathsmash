import type { AnimClip } from '../../../render/rig/types';
import {
  BRISTLE,
  EFFORT,
  FIERCE,
  FLAT_FUR,
  FOCUS,
  GRAB,
  HALF,
  HAPPY,
  HURT,
  LOOK_BACK,
  PUFF,
  RUN_FUR,
  SHOCK,
  WHIP,
  at,
  ball,
  centreOf,
  key,
  type Aim,
  type Ball,
  type Pt,
} from './poses';

/**
 * Attack clips, keyed on Fluffy's frame data in `../moves.ts`: Smash numbering (frame 1 is the move's first frame),
 * length FAF - 1, and on every active frame the grabber (or the ball, or the candy) covers every hitbox centre.
 * Moves give hitboxes with y up; `P` turns them into rig points (y down).
 */

const P = (x: number, y: number): Pt => [x, -y];

/** The grabber laid along a line of hitboxes: from `back` units behind the nearest centre to the farthest. */
function along(near: Pt, far: Pt, back = 6, turn = 0): Aim {
  const len = Math.hypot(far[0] - near[0], far[1] - near[1]);
  const ux = (far[0] - near[0]) / len;
  const uy = (far[1] - near[1]) / len;
  return { from: [near[0] - ux * back, near[1] - uy * back], to: far, near: turn };
}

/** The grabber held short at the ball's centre, pointing at `dir` degrees, `len` units long (coiled, ready). */
function coil(b: Ball, dir: number, len: number): Aim {
  const [cx, cy] = centreOf(b);
  const r = (dir * Math.PI) / 180;
  return { from: [cx, cy], to: [cx + Math.cos(r) * len, cy + Math.sin(r) * len], near: dir };
}

/** A pose with the grabber aimed: the ball's own fields plus the aim. */
const with_ = (b: Ball, grab: Aim): Ball => ({ ...b, grab });

/** Ball shapes used across the attacks. */
const STAND: Ball = {};
const WIND: Ball = { x: -0.6, sx: 0.9, sy: 1.08, tilt: -10, face: { x: 0.2 }, look: [0.45, 0] };
const LUNGE: Ball = { x: 1.4, sx: 1.14, sy: 0.9, tilt: 10, face: { x: 0.6 }, look: [0.5, 0.05] };
const SQUAT: Ball = { sx: 1.16, sy: 0.84, face: { y: 0.3 } };
const THRUST: Ball = { x: 2.1, sx: 1.23, sy: 0.84, tilt: 6, face: { x: 0.38, y: -0.65 }, look: [0.65, 0.15] };
const WHIP_OUT = along(P(9, 6), P(40.5, 6), 7);
const WHIP_CRACK: Ball = {
  x: 1.65,
  sx: 1.17,
  sy: 0.89,
  tilt: 12,
  face: { x: 0.35, y: -0.6 },
  look: [0.57, 0.32],
  fx3: at(22, -6.1, 1),
};

/** The usual whip: wind up behind, crack forward along the hitbox line, hold, then reel the line back in. */
function whip(o: {
  length: number;
  active: [number, number];
  line: Aim;
  windup?: Ball;
  strike?: Ball;
  coilDir?: number;
  recover?: number;
}): AnimClip {
  const [a0, a1] = o.active;
  const windup = o.windup ?? WIND;
  const strike = o.strike ?? LUNGE;
  const back = coil(windup, o.coilDir ?? -150, 4.5);
  const reel = o.recover ?? Math.min(o.length - 4, a1 + 12);
  const [fx, fy] = o.line.from;
  const [tx, ty] = o.line.to;
  const mid: Aim = { from: o.line.from, to: [fx + (tx - fx) * 0.5, fy + (ty - fy) * 0.5], near: o.line.near };
  return {
    length: o.length,
    swaps: FOCUS,
    keys: [
      key(0, ball(STAND), { ease: 'out' }),
      key(Math.max(1, a0 - 4), ball(with_(windup, back)), { ease: 'in', swaps: { ...FOCUS, ...GRAB } }),
      key(a0 - 1, ball(with_(strike, mid)), { ease: 'out' }),
      key(a0, ball(with_(strike, o.line)), { ease: 'linear' }),
      key(a1, ball(with_(strike, o.line)), { ease: 'inOut' }),
      key(a1 + 3, ball(with_({ ...strike, x: (strike.x ?? 0) * 0.6 }, o.line)), {
        ease: 'in',
        swaps: { ...FOCUS, ...WHIP },
      }),
      key(reel, ball(with_({ sx: 1.04, sy: 0.97 }, coil(STAND, -30, 2.5))), {
        ease: 'out',
        swaps: { ...HALF, ...GRAB },
      }),
      key(reel + 1, undefined, { swaps: HALF }),
      key(o.length, ball(STAND)),
    ],
  };
}

const TETHER = P(65.5, 6);

/** A tether grab: the line flies out over the given frames, holds, then is reeled in for a long time. */
function tether(o: { length: number; out: [number, Pt][]; hold: number; turnFrom?: number }): AnimClip {
  const from = P(2, 6);
  const [first] = o.out[0]!;
  const startBall: Ball = o.turnFrom === undefined ? WIND : { ...WIND, face: LOOK_BACK };
  return {
    length: o.length,
    swaps: FOCUS,
    keys: [
      key(0, ball(o.turnFrom === undefined ? STAND : { face: LOOK_BACK }), { ease: 'out' }),
      key(first - 5, ball(with_(startBall, coil(startBall, -160, 4))), {
        ease: 'in',
        swaps: { ...FOCUS, ...GRAB },
      }),
      key(first - 1, ball(with_(LUNGE, { from, to: P(9, 6) })), { ease: 'linear' }),
      ...o.out.map(([f, tip]) => key(f, ball(with_(LUNGE, { from, to: tip })), { ease: 'linear' })),
      key(o.hold, ball(with_(LUNGE, { from, to: TETHER })), { ease: 'inOut', swaps: { ...SHOCK, ...GRAB } }),
      key(o.hold + 8, ball(with_({ x: 0.6, sx: 1.06, sy: 0.95 }, { from, to: P(48, 3) })), {
        ease: 'inOut',
        swaps: { ...HALF, ...WHIP },
      }),
      key(o.length - 12, ball(with_({ sx: 1.03, sy: 0.98 }, coil(STAND, 10, 4))), { ease: 'out' }),
      key(o.length - 9, undefined, { swaps: HALF }),
      key(o.length, ball(STAND)),
    ],
  };
}

/** Where a grabbed fighter is held (in front of him, the engine's hold distance). */
const HELD = P(10, 6.5);
const HOLD: Aim = { from: P(1.5, 6), to: HELD };

/** A throw: held, then the line swings the victim through `path` (tip positions) and lets go on `release`. */
function throwClip(o: { length: number; release: number; path: [number, Ball, Aim][] }): AnimClip {
  const keys = [
    key(0, ball(with_(STAND, HOLD)), { ease: 'out', swaps: { ...EFFORT, ...GRAB } }),
    ...o.path.map(([f, b, a]) =>
      key(f, ball(with_(b, a)), {
        ease: 'inOut',
        swaps: f <= o.release ? { ...EFFORT, ...GRAB } : { ...HAPPY, ...WHIP },
      }),
    ),
    key(o.length - 6, ball(with_(STAND, coil(STAND, -30, 2))), { ease: 'out', swaps: { ...HALF, ...GRAB } }),
    key(o.length - 5, undefined, { swaps: HALF }),
    key(o.length, ball(STAND)),
  ];
  if (!o.path.some(([f]) => f === o.release + 1))
    keys.push(key(o.release + 1, undefined, { swaps: { ...HAPPY, ...WHIP } }));
  return { length: o.length, swaps: EFFORT, keys: keys.sort((a, b) => a.frame - b.frame) };
}

export const ATTACKS: Record<string, AnimClip> = {
  /** Fuzz Bump: a shove with the puffed-up fur (hits 3-4). */
  jab: {
    length: 19,
    swaps: FOCUS,
    keys: [
      key(0, ball(STAND), { ease: 'out' }),
      key(2, ball({ x: -0.5, sx: 0.9, sy: 1.08, tilt: -6 }), { ease: 'out', swaps: { ...FOCUS, ...PUFF } }),
      key(3, ball({ x: 2.3, sx: 1.16, sy: 0.9, tilt: 10, puff: 1.08, face: { x: 0.6 }, look: [0.5, 0] }), {
        ease: 'linear',
      }),
      key(5, ball({ x: 2.4, sx: 1.12, sy: 0.92, tilt: 9, puff: 1.06, face: { x: 0.6 }, look: [0.5, 0] }), {
        ease: 'inOut',
      }),
      key(12, ball({ x: 0.4, sx: 0.98, sy: 1.02 }), { swaps: FOCUS }),
      key(19, ball(STAND)),
    ],
  },
  /** Fuzz Bump 2 (hits 3-4): a second shove, low and bouncing. */
  jab2: {
    length: 20,
    swaps: { ...FOCUS, ...PUFF },
    keys: [
      key(0, ball({ x: 0.6, sx: 1.02, sy: 0.98 }), { ease: 'out' }),
      key(2, ball({ x: -0.2, sx: 1.12, sy: 0.86, tilt: 4 }), { ease: 'out' }),
      key(
        3,
        ball({
          x: 2.6,
          y: -0.4,
          sx: 1.08,
          sy: 0.94,
          tilt: 16,
          puff: 1.1,
          face: { x: 0.7 },
          look: [0.5, 0.1],
        }),
        {
          ease: 'linear',
        },
      ),
      key(
        5,
        ball({
          x: 2.6,
          y: -0.2,
          sx: 1.1,
          sy: 0.92,
          tilt: 14,
          puff: 1.06,
          face: { x: 0.7 },
          look: [0.5, 0.1],
        }),
      ),
      key(12, ball({ x: 0.5, sx: 0.98, sy: 1.03 }), { swaps: FOCUS }),
      key(20, ball(STAND)),
    ],
  },
  /** Tail Slap (hits 5-6): the grabber swung over his head and slapped down in front of him. */
  jab3: {
    length: 32,
    swaps: { ...EFFORT, ...GRAB },
    keys: [
      key(0, ball(with_({ x: 0.4 }, coil({ x: 0.4 }, -170, 3))), { ease: 'out' }),
      key(
        3,
        ball(
          with_(
            { x: -0.4, sx: 0.92, sy: 1.08, tilt: -10, look: [0.3, -0.4] },
            { from: P(0, 6), to: P(-6, 15), near: -120 },
          ),
        ),
        {
          ease: 'in',
        },
      ),
      key(
        4,
        ball(with_({ sx: 0.95, sy: 1.05, look: [0.4, -0.2] }, { from: P(1, 6), to: P(5, 16), near: -70 })),
        { ease: 'linear' },
      ),
      key(5, ball(with_({ ...LUNGE, x: 1.2 }, { from: P(2, 6), to: P(10.5, 5), near: 0 })), {
        ease: 'linear',
        swaps: { ...SHOCK, ...GRAB },
      }),
      key(6, ball(with_({ ...LUNGE, x: 1.2 }, { from: P(2, 6), to: P(11, 4.5), near: 0 })), {
        ease: 'inOut',
      }),
      key(8, undefined, { swaps: { ...FOCUS, ...WHIP } }),
      key(20, ball(with_({ sx: 1.04, sy: 0.97 }, coil(STAND, 0, 2))), {
        ease: 'out',
        swaps: { ...HALF, ...GRAB },
      }),
      key(21, undefined, { swaps: HALF }),
      key(32, ball(STAND)),
    ],
  },
  /** Grabber Whip (hits 7-9): the line cracks out to 40.5 units at hip height. */
  ftilt: {
    length: 35,
    active: [[7, 9]],
    swaps: FOCUS,
    keys: [
      key(0, ball(STAND), { ease: 'out' }),
      key(
        3,
        ball(
          with_({ x: -0.85, sx: 0.91, sy: 1.03, tilt: -12 }, { from: P(-1, 4), to: P(-6, 2), near: -180 }),
        ),
        {
          ease: 'in',
          swaps: { ...FOCUS, ...WHIP, grabLine: 'lineWaveBig' },
        },
      ),
      key(
        5,
        ball(with_({ ...WIND, tilt: -21, look: [0.41, -0.45] }, { from: P(-1, 6), to: P(3, 11), near: -70 })),
        {
          ease: 'in',
        },
      ),
      key(
        6,
        ball(
          with_(
            { ...WHIP_CRACK, x: 0.65, fx3: at(19, -8.5, 0.93, 16) },
            { from: P(2, 7), to: P(27, 9), near: -5 },
          ),
        ),
        {
          ease: 'out',
          swaps: { ...FOCUS, ...WHIP, ...RUN_FUR, grabLine: 'lineWaveBig', fxBack: 'whipWake' },
        },
      ),
      key(7, ball(with_(WHIP_CRACK, WHIP_OUT)), {
        ease: 'inOut',
        swaps: { ...EFFORT, ...GRAB, ...RUN_FUR, fxBack: 'whipWake' },
      }),
      key(9, ball(with_({ ...WHIP_CRACK, x: 1.2, tilt: 3, fx3: at(24, -6.1, 0.41) }, WHIP_OUT)), {
        ease: 'in',
      }),
      key(10, undefined, { swaps: { ...FOCUS, ...WHIP, grabLine: 'lineWaveBig' } }),
      key(
        14,
        ball(
          with_(
            { x: -0.5, sx: 0.9, sy: 1.09, tilt: -13, look: [0.44, -0.3] },
            { from: P(1, 5), to: P(24, 8) },
          ),
        ),
        {
          ease: 'out',
        },
      ),
      key(24, ball(with_({ sx: 1.07, sy: 0.95, tilt: 6 }, coil(STAND, 0, 3))), {
        swaps: { ...HALF, ...GRAB },
      }),
      key(25, undefined, { swaps: FOCUS }),
      key(35, ball(STAND), { swaps: {} }),
    ],
  },
  /** Grabber Flick (6-7 in front, 8-10 overhead, 11-12 behind): an arc over his head. */
  utilt: {
    length: 29,
    swaps: { ...FOCUS, ...GRAB },
    keys: [
      key(0, ball(STAND), { ease: 'out', swaps: FOCUS }),
      key(3, ball(with_(SQUAT, coil(SQUAT, -10, 3))), { ease: 'in', swaps: { ...FOCUS, ...GRAB } }),
      key(5, ball(with_({ sx: 0.94, sy: 1.08, look: [0.4, -0.4] }, along(P(3, 8), P(7, 13), 4.5, -55))), {
        ease: 'linear',
      }),
      key(7, ball(with_({ sx: 0.94, sy: 1.08, look: [0.4, -0.4] }, along(P(3, 8), P(7, 13), 4.5, -55))), {
        ease: 'linear',
      }),
      key(8, ball(with_({ sx: 0.9, sy: 1.12, look: [0, -0.55] }, along(P(0, 12), P(0, 19), 6, -90))), {
        ease: 'linear',
      }),
      key(10, ball(with_({ sx: 0.9, sy: 1.12, look: [0, -0.55] }, along(P(0, 12), P(0, 19), 6, -90))), {
        ease: 'linear',
      }),
      key(
        11,
        ball(with_({ sx: 0.95, sy: 1.06, look: [-0.4, -0.45] }, along(P(-2, 8.5), P(-7, 14), 4, -130))),
        {
          ease: 'linear',
        },
      ),
      key(
        12,
        ball(with_({ sx: 0.95, sy: 1.06, look: [-0.4, -0.45] }, along(P(-2, 8.5), P(-7, 14), 4, -130))),
        {
          ease: 'out',
        },
      ),
      key(13, undefined, { swaps: { ...FOCUS, ...WHIP } }),
      key(20, ball(with_(STAND, coil(STAND, -150, 2.5))), { ease: 'inOut', swaps: { ...HALF, ...GRAB } }),
      key(21, undefined, { swaps: HALF }),
      key(29, ball(STAND)),
    ],
  },
  /** Low Lash (6-8): the line skims the floor out to 26 units. */
  dtilt: whip({
    length: 26,
    active: [6, 8],
    line: along(P(8, 1.5), P(26, 1.5), 6),
    windup: { ...SQUAT, sx: 1.2, sy: 0.78, x: -0.4, look: [0.45, 0.3] },
    strike: { sx: 1.22, sy: 0.78, x: 0.8, tilt: 6, face: { x: 0.6, y: 0.4 }, look: [0.5, 0.35] },
    coilDir: 170,
    recover: 18,
  }),
  /** Fuzz Roll (8-12 strong, 13-22 late): a whole-body roll into them. */
  dashAttack: {
    length: 41,
    swaps: { ...HURT, mouth: null, fur: 'furRoll' },
    keys: [
      key(0, ball({ sx: 1.1, sy: 0.9, tilt: 8 }), { ease: 'out', swaps: FOCUS }),
      key(4, ball({ x: -0.4, sx: 0.88, sy: 1.1, tilt: -10, y: -0.3 }), { ease: 'in', swaps: FOCUS }),
      key(7, ball({ x: 1.6, y: -0.4, tilt: 120 }), {
        ease: 'linear',
        swaps: { ...HURT, mouth: null, fur: 'furRoll' },
      }),
      key(12, ball({ x: 2.2, y: -0.4, tilt: 330 }), { ease: 'linear' }),
      key(22, ball({ x: 1.6, y: -0.4, tilt: 720 }), { ease: 'out' }),
      key(28, ball({ x: 0.8, sx: 1.12, sy: 0.88, tilt: 740, face: { y: 0.3 } }), {
        ease: 'inOut',
        swaps: SHOCK,
      }),
      key(34, ball({ x: 0.3, sx: 0.97, sy: 1.03, tilt: 720 }), { swaps: HALF }),
      key(41, ball({ tilt: 720 })),
    ],
  },
  /** Spiked Ball (charge on 13, hits 16-18): the spiked ball thrust out to 64 units. */
  fsmash: {
    length: 61,
    active: [[16, 18]],
    swaps: { ...FOCUS, ...GRAB },
    keys: [
      key(0, ball(STAND), { ease: 'out', swaps: FOCUS }),
      key(
        6,
        ball(
          with_(
            { x: -1.1, sx: 0.85, sy: 1.07, tilt: -7, look: [0.45, 0.05] },
            { from: P(-2, 6), to: P(-7, 6), near: -180 },
          ),
        ),
        {
          ease: 'inOut',
          swaps: { ...FIERCE, ...WHIP, ...FLAT_FUR },
        },
      ),
      key(
        13,
        ball(
          with_(
            { x: -2, sx: 0.79, sy: 0.96, puff: 0.96, tilt: -10, look: [0.55, 0.1] },
            { from: P(-2, 5.5), to: P(-10, 5.5), near: -180 },
          ),
        ),
        {
          ease: 'in',
        },
      ),
      key(
        14,
        ball(
          with_({ x: -0.85, sx: 0.98, sy: 0.93, tilt: 1, look: [0.6, 0.1] }, { from: P(-2, 6), to: P(3, 6) }),
        ),
        {
          ease: 'in',
          swaps: { ...FOCUS, ...RUN_FUR },
        },
      ),
      key(
        15,
        ball(with_({ ...THRUST, x: 1.4, fx3: at(33, -6.5, 0.9) }, { from: P(2, 6.5), to: P(35, 6.5) })),
        {
          ease: 'linear',
          swaps: { ...EFFORT, ...GRAB, ...RUN_FUR, fxBack: 'thrustSmear' },
        },
      ),
      key(16, ball(with_({ ...THRUST, fx3: at(63, -6.5, 1.45) }, along(P(12, 6.5), P(64, 6.5), 10))), {
        ease: 'linear',
      }),
      key(17, undefined, { swaps: { ...EFFORT, ...GRAB, ...RUN_FUR } }),
      key(18, ball(with_({ ...THRUST, x: 1.85, sx: 1.15, sy: 0.9 }, along(P(12, 6.5), P(64, 6.5), 10))), {
        ease: 'in',
      }),
      key(
        22,
        ball(
          with_({ x: -1.15, sx: 0.88, sy: 1.1, tilt: -16, look: [0.55, 0] }, { from: P(0, 5), to: P(54, 7) }),
        ),
        {
          ease: 'out',
          swaps: { ...SHOCK, ...WHIP, grabLine: 'lineWaveBig' },
        },
      ),
      key(34, ball(with_({ x: 0.45, sx: 1.12, sy: 0.88, tilt: 4 }, { from: P(2, 5), to: P(12, 4) })), {
        ease: 'inOut',
        swaps: { ...FOCUS, ...WHIP },
      }),
      key(43, ball(with_({ x: -0.2, sx: 0.98, sy: 1.03 }, coil(STAND, 0, 2))), {
        ease: 'out',
        swaps: { ...HALF, ...GRAB },
      }),
      key(44, undefined, { swaps: { ...HALF, grabLine: null, tip: null } }),
      key(52, ball(STAND), { swaps: { grabLine: null, tip: null } }),
      key(61, ball(STAND)),
    ],
  },
  /** Spike Arc (charge on 8, hits 13-14 in front, 15-16 overhead, 17-18 behind): the ball swung over his head. */
  usmash: {
    length: 49,
    swaps: { ...EFFORT, ...GRAB },
    keys: [
      key(0, ball(STAND), { ease: 'out', swaps: EFFORT }),
      key(
        8,
        ball(with_({ ...SQUAT, sx: 1.2, sy: 0.8, look: [0.4, -0.3] }, coil({ sx: 1.2, sy: 0.8 }, 10, 6))),
        {
          ease: 'inOut',
          swaps: { ...EFFORT, grabLine: 'line', tip: 'tipSpin', fur: 'furPuff' },
        },
      ),
      key(12, ball(with_({ sx: 0.95, sy: 1.08 }, { from: P(2, 6), to: P(17, 9) })), {
        ease: 'linear',
        swaps: { ...EFFORT, ...GRAB },
      }),
      key(13, ball(with_({ sx: 0.92, sy: 1.1, look: [0.45, -0.4] }, along(P(6, 11), P(14, 16), 5, -30))), {
        ease: 'linear',
      }),
      key(14, ball(with_({ sx: 0.92, sy: 1.1, look: [0.45, -0.4] }, along(P(6, 11), P(14, 16), 5, -30))), {
        ease: 'linear',
      }),
      key(15, ball(with_({ sx: 0.88, sy: 1.15, look: [0, -0.6] }, along(P(0, 13), P(0, 23), 6, -90))), {
        ease: 'linear',
      }),
      key(16, ball(with_({ sx: 0.88, sy: 1.15, look: [0, -0.6] }, along(P(0, 13), P(0, 23), 6, -90))), {
        ease: 'linear',
      }),
      key(
        17,
        ball(
          with_({ sx: 0.92, sy: 1.1, look: [-0.45, -0.4] }, { from: P(0, 6), to: P(-14, 16), near: -150 }),
        ),
        {
          ease: 'linear',
        },
      ),
      key(
        18,
        ball(
          with_({ sx: 0.92, sy: 1.1, look: [-0.45, -0.4] }, { from: P(0, 6), to: P(-14, 16), near: -150 }),
        ),
        {
          ease: 'out',
        },
      ),
      key(19, undefined, { swaps: { ...FOCUS, ...WHIP } }),
      key(26, ball(with_({ sx: 1.06, sy: 0.95 }, { from: P(0, 5), to: P(-12, 2), near: -190 })), {
        ease: 'inOut',
      }),
      key(38, ball(with_(STAND, coil(STAND, -170, 2.5))), { ease: 'out', swaps: { ...HALF, ...GRAB } }),
      key(40, undefined, { swaps: HALF }),
      key(49, ball(STAND)),
    ],
  },
  /** Tail Twister (charge on 6, hits 10-11 in front, 15-16 behind): spun round him along the floor. */
  dsmash: {
    length: 51,
    swaps: { ...EFFORT, ...GRAB },
    keys: [
      key(0, ball(STAND), { ease: 'out', swaps: EFFORT }),
      key(6, ball(with_({ sx: 1.22, sy: 0.78, look: [0.4, 0.3] }, coil({ sx: 1.22, sy: 0.78 }, 175, 5))), {
        ease: 'inOut',
        swaps: { ...EFFORT, grabLine: 'line', tip: 'tipSpin', fur: 'furPuff' },
      }),
      key(9, ball(with_({ sx: 1.2, sy: 0.82, tilt: 6 }, { from: P(1, 2), to: P(16, 2) })), {
        ease: 'linear',
        swaps: { ...EFFORT, ...GRAB },
      }),
      key(10, ball(with_({ sx: 1.2, sy: 0.82, tilt: 6, look: [0.5, 0.3] }, along(P(7, 2), P(24, 2), 6))), {
        ease: 'linear',
      }),
      key(11, ball(with_({ sx: 1.2, sy: 0.82, tilt: 6, look: [0.5, 0.3] }, along(P(7, 2), P(24, 2), 6))), {
        ease: 'in',
      }),
      key(
        13,
        ball(with_({ sx: 1.18, sy: 0.84, face: { x: -0.9, sx: 0.6 } }, { from: P(0, 2), to: P(3, 1.2) })),
        {
          ease: 'step',
          swaps: { ...EFFORT, ...GRAB },
          z: { grabLine: 9.5, tip: 9.6 },
        },
      ),
      key(
        14,
        ball(
          with_(
            { sx: 1.2, sy: 0.82, tilt: -6, face: LOOK_BACK },
            { from: P(0, 2), to: P(-16, 2), near: 180 },
          ),
        ),
        {
          ease: 'linear',
          z: {},
        },
      ),
      key(
        15,
        ball(
          with_(
            { sx: 1.2, sy: 0.82, tilt: -6, face: LOOK_BACK, look: [0.5, 0.3] },
            along(P(-7, 2), P(-24, 2), 6, 180),
          ),
        ),
        {
          ease: 'linear',
        },
      ),
      key(
        16,
        ball(
          with_(
            { sx: 1.2, sy: 0.82, tilt: -6, face: LOOK_BACK, look: [0.5, 0.3] },
            along(P(-7, 2), P(-24, 2), 6, 180),
          ),
        ),
        {
          ease: 'inOut',
        },
      ),
      key(17, undefined, { swaps: { ...FOCUS, ...WHIP } }),
      key(
        30,
        ball(
          with_(
            { sx: 1.04, sy: 0.97, face: { x: -0.6, sx: 0.4 } },
            { from: P(0, 3), to: P(-6, 1.5), near: 180 },
          ),
        ),
        {
          ease: 'inOut',
          swaps: { ...HALF, ...GRAB },
        },
      ),
      key(40, ball(with_(STAND, coil(STAND, 180, 1.5))), { ease: 'out' }),
      key(41, undefined, { swaps: HALF }),
      key(51, ball(STAND)),
    ],
  },
  /** Getup attack (17-18 in front, 25-26 behind; intangible to 26): from lying flat, the line spun both ways. */
  getupAttack: {
    length: 45,
    swaps: { ...FOCUS, fur: 'furFlat' },
    keys: [
      key(0, ball({ sx: 1.3, sy: 0.62, face: { y: 0.6 } }), { ease: 'inOut' }),
      key(12, ball(with_({ sx: 1.18, sy: 0.8, face: { y: 0.3 } }, coil({ sx: 1.18, sy: 0.8 }, 170, 3))), {
        ease: 'in',
        swaps: { ...FOCUS, ...GRAB },
      }),
      key(16, ball(with_({ sx: 1.15, sy: 0.85, tilt: 6 }, { from: P(1, 3), to: P(7, 3) })), {
        ease: 'linear',
      }),
      key(17, ball(with_({ sx: 1.15, sy: 0.85, tilt: 6, look: [0.5, 0.2] }, along(P(4, 3), P(9, 3), 4))), {
        ease: 'linear',
      }),
      key(18, ball(with_({ sx: 1.15, sy: 0.85, tilt: 6, look: [0.5, 0.2] }, along(P(4, 3), P(9, 3), 4))), {
        ease: 'in',
      }),
      key(
        21,
        ball(with_({ sx: 1.12, sy: 0.88, face: { x: -0.9, sx: 0.6 } }, { from: P(0, 3), to: P(2, 2.5) })),
        {
          ease: 'step',
          z: { grabLine: 9.5, tip: 9.6 },
        },
      ),
      key(
        23,
        ball(
          with_(
            { sx: 1.15, sy: 0.85, tilt: -6, face: LOOK_BACK },
            { from: P(0, 3), to: P(-6, 3), near: 180 },
          ),
        ),
        {
          ease: 'linear',
          z: {},
        },
      ),
      key(
        25,
        ball(
          with_(
            { sx: 1.15, sy: 0.85, tilt: -6, face: LOOK_BACK, look: [0.5, 0.2] },
            along(P(-4, 3), P(-9, 3), 4, 180),
          ),
        ),
        {
          ease: 'linear',
        },
      ),
      key(
        26,
        ball(
          with_(
            { sx: 1.15, sy: 0.85, tilt: -6, face: LOOK_BACK, look: [0.5, 0.2] },
            along(P(-4, 3), P(-9, 3), 4, 180),
          ),
        ),
        {
          ease: 'inOut',
        },
      ),
      key(34, ball(with_({ face: { x: -0.5, sx: 0.5 } }, coil(STAND, 180, 1.5))), {
        ease: 'out',
        swaps: HALF,
      }),
      key(45, ball(STAND)),
    ],
  },
  /** Bristle (5-7 strong, 8-24 lingering): every hair stands on end. */
  nair: {
    length: 39,
    swaps: FOCUS,
    keys: [
      key(0, ball({ float: true }), { ease: 'out' }),
      key(3, ball({ sx: 0.86, sy: 0.86, float: true, look: [0.2, 0] }), {
        ease: 'out',
        swaps: { ...EFFORT },
      }),
      key(5, ball({ sx: 1.12, sy: 1.12, float: true, puff: 1.12, look: [0.2, 0] }), {
        ease: 'inOut',
        swaps: { ...SHOCK, ...BRISTLE },
      }),
      key(8, ball({ sx: 1.06, sy: 1.06, float: true, puff: 1.06 }), {
        ease: 'inOut',
        swaps: { ...FOCUS, ...BRISTLE },
      }),
      key(24, ball({ sx: 1.04, sy: 1.04, float: true, puff: 1.02 }), { ease: 'inOut' }),
      key(25, undefined, { swaps: { ...HALF, fur: 'furPuff' } }),
      key(32, ball({ float: true }), { swaps: HALF }),
      key(39, ball({ float: true })),
    ],
  },
  /** Lash (9-11): the line whips forward 21 units. */
  fair: {
    ...whip({
      length: 41,
      active: [9, 11],
      line: along(P(9, 5), P(21, 5), 7),
      windup: { ...WIND, float: true, tilt: -14 },
      strike: { ...LUNGE, float: true, x: 0.8 },
      coilDir: -120,
      recover: 26,
    }),
  },
  /** Back Lash (9-11): the line cracks behind him, 21 units back. */
  bair: whip({
    length: 39,
    active: [9, 11],
    line: along(P(-9, 5), P(-21, 5), 7, 180),
    windup: { float: true, x: 0.5, sx: 0.9, sy: 1.08, tilt: 10, face: { x: -0.8, sx: 0.6 }, look: [0.3, 0] },
    strike: { float: true, x: -1.0, sx: 1.12, sy: 0.92, tilt: -10, face: LOOK_BACK, look: [0.5, 0.05] },
    coilDir: -60,
    recover: 26,
  }),
  /** Whirl (6-10): the line twirls straight up over his head, the spiked ball spinning at 17 units. */
  uair: {
    length: 33,
    swaps: FOCUS,
    keys: [
      key(0, ball({ float: true }), { ease: 'out' }),
      key(
        3,
        ball(with_({ float: true, sx: 1.08, sy: 0.92, look: [0.2, -0.4] }, coil({ float: true }, -60, 3))),
        {
          ease: 'linear',
          swaps: { ...FOCUS, grabLine: 'line', tip: 'tipSpin' },
        },
      ),
      key(
        5,
        ball(
          with_(
            { float: true, sx: 0.95, sy: 1.06, look: [0, -0.6] },
            { from: P(0.5, 5), to: P(1.5, 14), near: -90 },
          ),
        ),
        {
          ease: 'linear',
        },
      ),
      key(
        6,
        ball(
          with_(
            { float: true, sx: 0.92, sy: 1.1, spin: 40, look: [0, -0.6] },
            along(P(0, 11), P(0, 17), 5, -90),
          ),
        ),
        {
          ease: 'linear',
        },
      ),
      key(
        10,
        ball(
          with_(
            { float: true, sx: 0.92, sy: 1.1, spin: 200, look: [0, -0.6] },
            along(P(0, 11), P(0, 17), 5, -90),
          ),
        ),
        {
          ease: 'out',
        },
      ),
      key(
        13,
        ball(
          with_({ float: true, spin: 260, look: [-0.2, -0.4] }, { from: P(0, 5), to: P(-5, 14), near: -110 }),
        ),
        {
          ease: 'inOut',
          swaps: { ...FOCUS, ...WHIP },
        },
      ),
      key(24, ball(with_({ float: true, spin: 360 }, coil({ float: true }, -120, 2))), {
        ease: 'out',
        swaps: { ...HALF, ...GRAB },
      }),
      key(25, undefined, { swaps: HALF }),
      key(33, ball({ float: true, spin: 360 })),
    ],
  },
  /** Candy Drop (12-14 spike, 15-24): a hard candy slammed down beneath him. */
  dair: {
    length: 47,
    swaps: EFFORT,
    keys: [
      key(0, ball({ float: true }), { ease: 'out' }),
      key(8, ball({ float: true, sx: 1.1, sy: 0.92, y: -0.6, look: [0.1, 0.5], fx1: at(0, -2.5, 0.7) }), {
        ease: 'in',
        swaps: { ...EFFORT, prop: 'candy' },
        z: { prop: 2.5 },
      }),
      key(11, ball({ float: true, sx: 0.9, sy: 1.12, y: -0.4, look: [0, 0.6], fx1: at(0, 1.2, 1) }), {
        ease: 'linear',
      }),
      key(12, ball({ float: true, sx: 0.88, sy: 1.14, look: [0, 0.6], fx1: at(0, 2, 1.05) }), {
        ease: 'linear',
        swaps: { ...SHOCK, prop: 'candy', ...RUN_FUR },
        z: { prop: 9 },
      }),
      key(14, ball({ float: true, sx: 0.9, sy: 1.12, look: [0, 0.6], fx1: at(0, 2, 1.05) }), {
        ease: 'linear',
      }),
      key(15, ball({ float: true, sx: 0.94, sy: 1.08, look: [0, 0.55], fx1: at(0, 1, 1) }), {
        ease: 'linear',
        swaps: { ...EFFORT, prop: 'candy' },
      }),
      key(24, ball({ float: true, sx: 0.98, sy: 1.02, look: [0, 0.5], fx1: at(0, 1, 1) }), { ease: 'in' }),
      key(30, ball({ float: true, look: [0, 0.3], fx1: at(0, -2, 0.6) }), {
        ease: 'out',
        swaps: { ...HALF, prop: 'candy' },
        z: { prop: 2.5 },
      }),
      key(31, undefined, { swaps: HALF, z: {} }),
      key(47, ball({ float: true })),
    ],
  },
  /** Grabber Grab: a tether grab whose line flies out over frames 12-14 and catches until 17. */
  grab: tether({
    length: 57,
    out: [
      [12, P(20, 6)],
      [13, P(38, 6)],
      [14, TETHER],
    ],
    hold: 17,
  }),
  /** Dash grab: the same tether, a little later (14, then 15-19). */
  dashGrab: tether({
    length: 63,
    out: [
      [14, P(22, 6)],
      [15, TETHER],
    ],
    hold: 19,
  }),
  /** Pivot grab: turns round from the slide, then fires the tether (15, then 16-20). */
  pivotGrab: tether({
    length: 65,
    out: [
      [15, P(22, 6)],
      [16, TETHER],
    ],
    hold: 20,
    turnFrom: 0,
  }),
  /** Holding the catch at the end of the line, squeezing now and then. */
  grabHold: {
    length: 40,
    loop: true,
    swaps: { ...FOCUS, ...GRAB },
    keys: [
      key(0, ball(with_({ sx: 1.02, sy: 0.98, look: [0.5, 0.1] }, HOLD))),
      key(
        20,
        ball(
          with_({ sx: 0.99, sy: 1.02, look: [0.45, 0.05] }, { ...HOLD, to: [HELD[0] + 0.3, HELD[1] - 0.2] }),
        ),
      ),
    ],
  },
  /** Squeeze: the grabber tightens (pummel on frame 1). */
  pummel: {
    length: 5,
    swaps: { ...EFFORT, grabLine: 'line', tip: 'tipSpin' },
    keys: [
      key(
        0,
        ball(
          with_(
            { sx: 1.12, sy: 0.88, look: [0.5, 0.1], puff: 1.08 },
            { ...HOLD, to: [HELD[0] - 1, HELD[1]] },
          ),
        ),
        { ease: 'out' },
      ),
      key(5, ball(with_({ sx: 1.02, sy: 0.98, look: [0.5, 0.1] }, HOLD))),
    ],
  },
  /** Fling (release on 14): reels the catch in, then whips it away in front. */
  fthrow: throwClip({
    length: 33,
    release: 14,
    path: [
      [6, { x: -0.6, sx: 0.9, sy: 1.08, tilt: -10 }, { from: P(1, 6), to: P(6, 7) }],
      [12, { x: 1, sx: 1.12, sy: 0.9, tilt: 10 }, { from: P(2, 6), to: P(14, 8) }],
      [16, { x: 1.4, sx: 1.12, sy: 0.9, tilt: 12, look: [0.5, -0.1] }, { from: P(2, 6), to: P(22, 9) }],
    ],
  }),
  /** Swing-Around (release on 32): swings the catch round over his head and lets go behind him. */
  bthrow: throwClip({
    length: 55,
    release: 32,
    path: [
      [8, { sx: 1.1, sy: 0.92, x: 0.4 }, { from: P(1, 6), to: P(12, 4), near: 0 }],
      [16, { sx: 0.94, sy: 1.08, look: [0.3, -0.5] }, { from: P(0, 6), to: P(6, 16), near: -60 }],
      [24, { sx: 0.92, sy: 1.1, look: [-0.3, -0.5] }, { from: P(0, 6), to: P(-6, 16), near: -120 }],
      [
        32,
        { x: -0.8, sx: 1.12, sy: 0.9, tilt: -12, face: LOOK_BACK },
        { from: P(-1, 6), to: P(-14, 7), near: -175 },
      ],
      [
        38,
        { x: -0.6, sx: 1.06, sy: 0.95, tilt: -6, face: LOOK_BACK },
        { from: P(-1, 6), to: P(-18, 4), near: -185 },
      ],
    ],
  }),
  /** Upward Whip (release on 18): cracks the catch straight up. */
  uthrow: throwClip({
    length: 41,
    release: 18,
    path: [
      [8, { sx: 1.18, sy: 0.84, look: [0.4, -0.2] }, { from: P(1, 5), to: P(9, 4) }],
      [16, { sx: 0.9, sy: 1.14, look: [0.1, -0.6] }, { from: P(0.5, 6), to: P(3, 16), near: -80 }],
      [20, { sx: 0.88, sy: 1.15, look: [0, -0.6] }, { from: P(0, 6), to: P(0, 24), near: -90 }],
    ],
  }),
  /** Bounce (release on 22): hops onto the catch and bounces off it. */
  dthrow: throwClip({
    length: 43,
    release: 22,
    path: [
      [8, { sx: 1.2, sy: 0.8 }, HOLD],
      [15, { x: 6, y: -9, sx: 0.9, sy: 1.12, look: [0.3, 0.5] }, { from: P(6, 13), to: P(10, 8) }],
      [21, { x: 9, y: -6, sx: 1.25, sy: 0.75, look: [0, 0.5] }, { from: P(9, 10), to: P(10, 7) }],
      [27, { x: 4, y: -6, sx: 0.92, sy: 1.1, tilt: -10, look: [0.2, 0.3] }, { from: P(4, 10), to: P(6, 8) }],
      [34, { sx: 1.18, sy: 0.84 }, coil(STAND, -10, 2)],
    ],
  }),
};
