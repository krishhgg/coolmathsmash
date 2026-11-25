import type { AnimClip } from '../../../render/rig/types';
import {
  BLINK,
  DUST,
  FALL_FUR,
  FLAT_FUR,
  HALF,
  LOOK_BACK,
  PUFF,
  RUN_FUR,
  SHOCK,
  at,
  ball,
  key,
  type Ball,
} from './poses';

/**
 * Movement clips. Fluffy has no legs, so he moves the way his games' physics moves him: he rolls, his fur
 * turning under eyes that stay on top, and every take-off, landing and stop squashes or stretches the ball.
 */

const STAND: Ball = {};
/** Squashed flat on the floor before a jump or after a landing. */
const SQUAT: Ball = { sx: 1.24, sy: 0.74, face: { y: 0.35 }, look: [0.15, -0.25] };
/** Rolling: the fur turns while the eyes keep looking ahead. */
const ROLL: Ball = { y: -0.45, face: { x: 0.35 }, look: [0.3, 0.05], tilt: 4 };

/**
 * A bouncing loop of `hops` hops over `length` frames. The fur rolls once while the face looks ahead.
 */
function rolling(length: number, hops: number, base: Ball, hop: Ball, land: Ball): AnimClip {
  const keys = [];
  const step = length / (hops * 2);
  for (let i = 0; i <= hops * 2; i++) {
    const pose = i % 2 ? hop : land;
    keys.push(
      key(Math.round(i * step), ball({ ...base, ...pose, spin: (360 * i) / (hops * 2) }), {
        ease: 'linear',
      }),
    );
  }
  return { length, loop: true, keys };
}

export const LOCOMOTION: Record<string, AnimClip> = {
  idle: {
    length: 120,
    loop: true,
    keys: [
      key(0, ball(STAND)),
      key(30, ball({ sx: 1.035, sy: 0.965, look: [0.05, 0.05] })),
      key(42, ball({ sx: 1.02, sy: 0.98, look: [-0.45, -0.3] })),
      key(60, ball({ look: [-0.45, -0.3] })),
      key(70, ball({ look: [0.1, 0] })),
      key(90, ball({ sx: 1.035, sy: 0.965 })),
      key(98, undefined, { swaps: HALF }),
      key(100, undefined, { swaps: BLINK }),
      key(103, undefined, { swaps: HALF }),
      key(105, undefined, { swaps: {} }),
      key(120, ball(STAND)),
    ],
  },
  walk: {
    ...rolling(48, 2, ROLL, { y: -0.85, sx: 0.98, sy: 1.02 }, { sx: 1.03, sy: 0.97 }),
    swaps: { fur: 'furRoll' },
  },
  run: {
    ...rolling(
      24,
      2,
      { ...ROLL, tilt: 9, face: { x: 0.6, y: 0.1 }, look: [0.45, 0.05] },
      { y: -1.6, sx: 0.94, sy: 1.07 },
      { y: -0.44, sx: 1.1, sy: 0.88 },
    ),
    swaps: { fur: 'furRoll' },
  },
  dash: {
    length: 11,
    swaps: RUN_FUR,
    keys: [
      key(0, ball({ x: -0.4, sx: 1.16, sy: 0.84, tilt: -8, face: { x: 0.3 }, look: [0.4, 0] }), {
        ease: 'out',
      }),
      key(4, ball({ x: 0.6, y: -0.6, sx: 1.14, sy: 0.9, tilt: 12, face: { x: 0.7 }, look: [0.5, 0.05] }), {
        ease: 'inOut',
      }),
      key(11, ball({ tilt: 9, sx: 1.1, sy: 0.9, face: { x: 0.6, y: 0.1 }, look: [0.45, 0.05] })),
    ],
  },
  runBrake: {
    length: 14,
    swaps: { ...SHOCK, mouth: null },
    keys: [
      key(
        0,
        ball({
          x: 0.6,
          y: -0.4,
          sx: 1.16,
          sy: 0.86,
          tilt: -16,
          face: { x: 0.8 },
          look: [0.5, 0],
          fx3: at(4.2, 0, 0.55),
        }),
        { ease: 'out', swaps: DUST },
      ),
      key(7, ball({ x: 0.3, y: -0.2, sx: 1.06, sy: 0.95, tilt: -7, face: { x: 0.5 }, fx3: at(5.2, 0, 0.9) })),
      key(11, ball({ sx: 0.98, sy: 1.03, tilt: 2, fx3: at(5.8, 0, 0.2) }), { swaps: {} }),
      key(14, ball(STAND)),
    ],
  },
  turn: {
    length: 8,
    keys: [
      key(0, ball({ face: LOOK_BACK, look: [0.3, 0] }), { ease: 'in' }),
      key(3, ball({ sx: 1.08, sy: 0.93, x: -0.3, face: { x: -1.5, sx: -0.65 } }), {
        ease: 'step',
        swaps: BLINK,
      }),
      key(4, ball({ sx: 1.06, sy: 0.95, x: -0.2, face: { x: -0.4, sx: 0.65 } }), { ease: 'out', swaps: {} }),
      key(8, ball(STAND)),
    ],
  },
  crouch: {
    length: 6,
    swaps: { ...FLAT_FUR, ...HALF },
    keys: [
      key(0, ball(STAND), { ease: 'out' }),
      key(6, ball({ sx: 1.26, sy: 0.7, face: { y: 0.6 }, look: [0.35, -0.1] })),
    ],
  },
  jumpSquat: {
    length: 3,
    keys: [key(0, ball(STAND), { ease: 'out' }), key(3, ball(SQUAT))],
  },
  jump: {
    length: 30,
    swaps: FLAT_FUR,
    keys: [
      key(0, ball({ sx: 0.8, sy: 1.28, face: { y: -0.4 }, look: [0.25, -0.5] }), { ease: 'out' }),
      key(10, ball({ sx: 0.92, sy: 1.1, float: true, look: [0.3, -0.45] }), { ease: 'inOut', swaps: {} }),
      key(
        21,
        ball({
          sx: 1.1,
          sy: 0.93,
          float: true,
          tilt: -4,
          spin: -4,
          face: { x: 0.3, y: 0.28 },
          look: [0.45, 0.52],
        }),
        {
          ease: 'out',
          swaps: FALL_FUR,
        },
      ),
      key(
        30,
        ball({ sx: 1.07, sy: 0.95, float: true, spin: -7, face: { x: 0.34, y: 0.32 }, look: [0.45, 0.55] }),
      ),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: PUFF,
    keys: [
      key(0, ball({ sx: 1.2, sy: 0.82, float: true, puff: 1.08, look: [0.2, 0.4] }), { ease: 'out' }),
      key(5, ball({ sx: 0.86, sy: 1.18, float: true, tilt: 118, spin: 16, look: [0.25, -0.5] }), {
        ease: 'linear',
        swaps: FLAT_FUR,
      }),
      key(14, ball({ sx: 0.96, sy: 1.04, float: true, tilt: 335, spin: -12, look: [0.3, -0.3] }), {
        ease: 'out',
        swaps: {},
      }),
      key(21, ball({ sx: 1.06, sy: 0.96, float: true, tilt: 367, look: [0.42, 0.46] }), { swaps: FALL_FUR }),
      key(30, ball({ sx: 1.03, sy: 0.97, float: true, tilt: 360, look: [0.35, 0.2] })),
    ],
  },
  fall: {
    length: 40,
    loop: true,
    swaps: FALL_FUR,
    keys: [
      key(0, ball({ sx: 0.97, sy: 1.04, float: true, face: { y: 0.25 }, look: [0.2, 0.5] })),
      key(20, ball({ sx: 1.0, sy: 1.0, float: true, spin: 5, face: { y: 0.3 }, look: [0.25, 0.55] })),
    ],
  },
  land: {
    length: 4,
    swaps: DUST,
    keys: [
      key(0, ball({ sx: 1.3, sy: 0.68, face: { y: 0.45 }, look: [0.2, 0.2], fx3: at(0, 0, 0.7) }), {
        ease: 'out',
      }),
      key(4, ball({ fx3: at(0, 0, 1.05) })),
    ],
  },
};
