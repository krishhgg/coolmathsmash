import type { AnimClip } from '../../../render/rig/types';
import {
  EFFORT,
  FALL_FUR,
  FIERCE,
  FOCUS,
  GRAB,
  HALF,
  HAPPY,
  PUFF,
  RUN_FUR,
  SHOCK,
  WHIP,
  at,
  ball,
  key,
  type Ball,
  type Pt,
} from './poses';

/**
 * Specials. Their frame data isn't final, so the timings follow the roster: Point Grapple reaches its target 12
 * frames after the shot, Candy Frisbee lets go on 14, Quick Grapple fires on 8 and Stick Tight braces from 4 to 60
 * with 40 frames to recover. Where the grabber latches depends on the game, so the clips use a typical target.
 */

const STAND: Ball = {};

/**
 * Point Grapple's typical target, up and ahead: where the lab shows the reticle and the line (art.reticle and
 * art.tetherLine; in a match the renderer draws both from the real aim and line).
 */
export const TARGET: Pt = [22, -19];

export const SPECIALS: Record<string, AnimClip> = {
  /**
   * Point Grapple: aims, fires the grabber, latches, and is reeled up the line. The renderer draws IQ Ball's reticle
   * at the aim and the grabber from his hand to the line's real end (src/render/reticle.ts, tetherLine.ts), so the
   * clip draws neither. The line anchors by 23 at the latest (fired on 12, 12 frames out), so a long reel holds on
   * 28, pulled along, until the reel arrives.
   */
  neutralB: {
    length: 50,
    reel: 28,
    swaps: FOCUS,
    keys: [
      key(0, ball({ look: [0.3, -0.2] }), { ease: 'out' }),
      key(
        8,
        ball({
          sx: 1.12,
          sy: 0.88,
          look: [0.5, -0.45],
          face: { y: 0.2 },
        }),
        {
          ease: 'inOut',
        },
      ),
      key(11, ball({ sx: 1.16, sy: 0.84, look: [0.5, -0.5] }), {
        ease: 'in',
        swaps: { ...FOCUS, fur: 'furPuff' },
      }),
      key(
        12,
        ball({
          sx: 0.95,
          sy: 1.06,
          tilt: -10,
          look: [0.5, -0.5],
        }),
        {
          ease: 'linear',
          swaps: FOCUS,
        },
      ),
      key(
        16,
        ball({
          sx: 0.95,
          sy: 1.06,
          tilt: -12,
          look: [0.5, -0.5],
        }),
        {
          ease: 'linear',
        },
      ),
      key(
        24,
        ball({
          sx: 0.92,
          sy: 1.08,
          tilt: -20,
          look: [0.5, -0.5],
        }),
        {
          ease: 'out',
          swaps: SHOCK,
        },
      ),
      key(
        28,
        ball({
          float: true,
          sx: 1.18,
          sy: 0.84,
          tilt: -40,
          look: [0.5, -0.5],
        }),
        {
          ease: 'linear',
          swaps: { ...EFFORT, ...RUN_FUR },
        },
      ),
      key(40, ball({ float: true, sx: 1.2, sy: 0.82, tilt: -40, look: [0.5, -0.5] }), { ease: 'inOut' }),
      key(44, ball({ float: true, sx: 0.96, sy: 1.04, tilt: -10 }), { ease: 'out', swaps: HALF }),
      key(50, ball({ float: true })),
    ],
  },
  /** Candy Frisbee: winds back with a candy and flings it flat like a frisbee (it leaves his side on 14). */
  sideB: {
    length: 45,
    swaps: { ...EFFORT, prop: 'candy' },
    keys: [
      key(0, ball({ fx1: at(1, -5, 0.2) }), { ease: 'out' }),
      key(8, ball({ x: -0.8, tilt: -14, sx: 0.9, sy: 1.08, look: [0.5, -0.1], fx1: at(-5.5, -7, 1) }), {
        ease: 'in',
      }),
      key(11, ball({ x: -0.9, tilt: -16, sx: 0.88, sy: 1.1, look: [0.5, -0.1], fx1: at(-6, -6.5, 1) }), {
        ease: 'in',
      }),
      key(14, ball({ x: 1.6, tilt: 12, sx: 1.16, sy: 0.88, look: [0.5, 0], fx1: at(8.5, -5.5, 1) }), {
        ease: 'out',
        swaps: { ...FOCUS, prop: 'candy', ...RUN_FUR },
      }),
      key(15, undefined, { swaps: { ...FOCUS, prop: null, ...RUN_FUR } }),
      key(24, ball({ x: 1.2, tilt: 8, sx: 1.05, sy: 0.96, look: [0.5, 0] }), {
        ease: 'inOut',
        swaps: { ...HAPPY, prop: null },
      }),
      key(45, ball(STAND), { swaps: { prop: null } }),
    ],
  },
  /**
   * Quick Grapple: fires the grabber straight up on 8 and zips up the line after it. The renderer draws the grabber
   * from his hand to the line's real end (src/render/tetherLine.ts), so the clip leaves it out. The line anchors by
   * 17 at the latest (fired on 8, 10 frames out), so a long reel holds on 24, stretched along the line, until the
   * reel arrives.
   */
  upB: {
    length: 40,
    reel: 24,
    swaps: FOCUS,
    keys: [
      key(0, ball({ float: true, look: [0.2, -0.5] }), { ease: 'out' }),
      key(6, ball({ float: true, sx: 1.2, sy: 0.82, look: [0.2, -0.6], face: { y: -0.2 } }), {
        ease: 'in',
        swaps: { ...FOCUS, ...PUFF },
      }),
      key(8, ball({ float: true, sx: 0.92, sy: 1.1, look: [0.1, -0.6] }), { ease: 'linear', swaps: FOCUS }),
      key(12, ball({ float: true, sx: 0.88, sy: 1.14, look: [0, -0.6] }), { ease: 'linear' }),
      key(16, ball({ float: true, sx: 0.8, sy: 1.3, look: [0, -0.6] }), {
        ease: 'linear',
        swaps: { ...EFFORT, ...FALL_FUR },
      }),
      key(28, ball({ float: true, sx: 0.82, sy: 1.26, look: [0, -0.6] }), { ease: 'out' }),
      key(32, ball({ float: true, sx: 1.04, sy: 0.96, spin: 120 }), { ease: 'inOut', swaps: HALF }),
      key(40, ball({ float: true, spin: 360 })),
    ],
  },
  /**
   * Stick Tight: sticks the grabber's ball to the floor in front of him on 4 and braces, armoured, until 60; then lets
   * go.
   */
  downB: {
    length: 100,
    swaps: { ...FIERCE, ...GRAB, ...PUFF },
    keys: [
      key(0, ball({ look: [0.2, 0.3] }), { ease: 'out', swaps: FOCUS }),
      key(3, ball({ sx: 1.08, sy: 0.92, look: [0.1, 0.5], grab: { from: [0.5, -4], to: [7, -1.6] } }), {
        ease: 'linear',
        swaps: { ...FIERCE, ...GRAB, ...PUFF },
      }),
      ...[4, 12, 20, 28, 36, 44, 52, 60].map((f, i) =>
        key(
          f,
          ball({
            sx: i % 2 ? 1.24 : 1.2,
            sy: i % 2 ? 0.8 : 0.83,
            puff: i % 2 ? 1.06 : 1.08,
            face: { y: 0.4 },
            look: [0.45, 0.1],
            grab: { from: [0.5, -3], to: [7, -1.6] },
          }),
          {
            ease: 'inOut',
          },
        ),
      ),
      key(
        66,
        ball({ y: -0.6, sx: 0.94, sy: 1.08, look: [0.3, -0.1], grab: { from: [0.5, -3], to: [2, -3] } }),
        {
          ease: 'inOut',
          swaps: { ...HALF, ...WHIP },
        },
      ),
      key(74, ball({ sx: 1.06, sy: 0.95, grab: { from: [0, -4.5], to: [0.6, -4.5] } }), {
        ease: 'out',
        swaps: { ...HALF, grabLine: null, tip: null },
      }),
      key(100, ball(STAND), { swaps: { grabLine: null, tip: null, mouth: null, lids: null, fur: 'fur' } }),
    ],
  },
};
