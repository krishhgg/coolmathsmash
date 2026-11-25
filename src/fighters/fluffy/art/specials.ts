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

/** Point Grapple's default target: up and ahead, where the reticle starts. */
const TARGET: Pt = [22, -19];
/** How far the line still has to go as the engine pulls him in, by frames after the latch. */
const toward = (t: number): Pt => [TARGET[0] * (1 - 0.6 * t), TARGET[1] * (1 - 0.6 * t)];
const from: Pt = [1.5, -6.5];

export const SPECIALS: Record<string, AnimClip> = {
  /** Point Grapple: aims IQ Ball's reticle, fires the grabber at it, latches, and is reeled up the line. */
  neutralB: {
    length: 50,
    swaps: FOCUS,
    keys: [
      key(0, ball({ look: [0.3, -0.2], fx2: at(10, -9, 0.2) }), {
        ease: 'out',
        swaps: { ...FOCUS, reticle: 'reticle' },
      }),
      key(
        8,
        ball({
          sx: 1.12,
          sy: 0.88,
          look: [0.5, -0.45],
          face: { y: 0.2 },
          fx2: at(TARGET[0], TARGET[1], 1.15, 45),
        }),
        {
          ease: 'inOut',
        },
      ),
      key(11, ball({ sx: 1.16, sy: 0.84, look: [0.5, -0.5], fx2: at(TARGET[0], TARGET[1], 1, 90) }), {
        ease: 'in',
        swaps: { ...FOCUS, reticle: 'reticle', fur: 'furPuff' },
      }),
      key(
        12,
        ball({
          sx: 0.95,
          sy: 1.06,
          tilt: -10,
          look: [0.5, -0.5],
          grab: { from, to: [8, -12] },
          fx2: at(TARGET[0], TARGET[1], 1, 90),
        }),
        {
          ease: 'linear',
          swaps: { ...FOCUS, ...GRAB, reticle: 'reticle' },
        },
      ),
      key(
        16,
        ball({
          sx: 0.95,
          sy: 1.06,
          tilt: -12,
          look: [0.5, -0.5],
          grab: { from, to: [17, -18] },
          fx2: at(TARGET[0], TARGET[1], 1, 90),
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
          grab: { from, to: TARGET },
          fx2: at(TARGET[0], TARGET[1], 1.3, 90),
        }),
        {
          ease: 'out',
          swaps: { ...SHOCK, ...GRAB, reticle: 'reticle' },
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
          grab: { from, to: toward(0.2) },
          fx2: at(...toward(0.2), 1.1, 90),
        }),
        {
          ease: 'linear',
          swaps: { ...EFFORT, ...GRAB, ...RUN_FUR },
        },
      ),
      key(
        40,
        ball({ float: true, sx: 1.2, sy: 0.82, tilt: -40, look: [0.5, -0.5], grab: { from, to: toward(1) } }),
        {
          ease: 'inOut',
        },
      ),
      key(44, ball({ float: true, sx: 0.96, sy: 1.04, tilt: -10, grab: { from, to: [4, -9] } }), {
        ease: 'out',
        swaps: { ...HALF, ...WHIP },
      }),
      key(46, undefined, { swaps: HALF }),
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
   * Quick Grapple: fires the grabber straight up on 8 and zips up the line after it. A long reel holds on 24, the
   * last frame the line still reaches well up, until the reel arrives.
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
      key(
        8,
        ball({
          float: true,
          sx: 0.92,
          sy: 1.1,
          look: [0.1, -0.6],
          grab: { from: [0, -6], to: [0, -14], near: -90 },
        }),
        {
          ease: 'linear',
          swaps: { ...FOCUS, ...GRAB },
        },
      ),
      key(
        12,
        ball({
          float: true,
          sx: 0.88,
          sy: 1.14,
          look: [0, -0.6],
          grab: { from: [0, -6], to: [2, -60], near: -90 },
        }),
        { ease: 'linear' },
      ),
      key(
        16,
        ball({
          float: true,
          sx: 0.8,
          sy: 1.3,
          look: [0, -0.6],
          grab: { from: [0, -6], to: [2, -50], near: -90 },
        }),
        {
          ease: 'linear',
          swaps: { ...EFFORT, ...GRAB, ...FALL_FUR },
        },
      ),
      key(
        28,
        ball({
          float: true,
          sx: 0.82,
          sy: 1.26,
          look: [0, -0.6],
          grab: { from: [0, -6], to: [1, -14], near: -90 },
        }),
        { ease: 'out' },
      ),
      key(
        32,
        ball({ float: true, sx: 1.04, sy: 0.96, spin: 120, grab: { from: [0, -6], to: [0, -8], near: -90 } }),
        {
          ease: 'inOut',
          swaps: { ...HALF, ...WHIP },
        },
      ),
      key(33, undefined, { swaps: HALF }),
      key(40, ball({ float: true, spin: 360 })),
    ],
  },
  /** Stick Tight: plants the grabber in the ground on 4 and braces, armoured, until 60; then lets go. */
  downB: {
    length: 100,
    swaps: { ...FIERCE, ...GRAB, ...PUFF },
    keys: [
      key(0, ball({ look: [0.2, 0.3] }), { ease: 'out', swaps: FOCUS }),
      key(3, ball({ sx: 1.08, sy: 0.92, look: [0.1, 0.5], grab: { from: [0.5, -4], to: [1, 0.5] } }), {
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
            grab: { from: [0.5, -3], to: [1.5, 1.2] },
          }),
          {
            ease: 'inOut',
          },
        ),
      ),
      key(
        66,
        ball({ y: -0.6, sx: 0.94, sy: 1.08, look: [0.3, -0.1], grab: { from: [0.5, -3], to: [1, -1] } }),
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
