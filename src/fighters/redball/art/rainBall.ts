import type { ArtSymbol, PathShape } from '../../../render/rig/types';
import { brush, type Pt } from './draw';
import { R, ballFill, ballLine, ballShade, ballShine, brows, eyes, mouths } from './parts';

/** Trail direction, up and back from the ball's centre (y down): 14 degrees off straight up. */
const T: Pt = [-Math.sin((14 * Math.PI) / 180), -Math.cos((14 * Math.PI) / 180)];
/** Across the trail, towards the front. */
const P: Pt = [-T[1], T[0]];
const along = (s: number, o = 0): Pt => [T[0] * s + P[0] * o, T[1] * s + P[1] * o];

/** The red blur behind the ball, a ball wide where it leaves it and tapering to a point `len` back. */
const tail = (len: number): PathShape => ({
  d: brush([along(0), along(len * 0.5), along(len)], 2 * R - 0.9, 0, 1),
  fill: {
    type: 'linear',
    x0: 0,
    y0: 0,
    x1: along(len)[0],
    y1: along(len)[1],
    stops: [
      { offset: 0.25, color: 'bodyHi', alpha: 0.7 },
      { offset: 1, color: 'bodyHi', alpha: 0 },
    ],
  },
});

/** A speed line `o` across the trail, from just behind the ball to `len` back. */
const streak = (o: number, from: number, len: number, w: number): PathShape => ({
  d: brush([along(from, o), along(from + len, o)], w, 0.15, 0.9),
  fill: 'speed',
});

/**
 * One of the raining balls, drawn at Red Ball's size and scaled to its radius-16 hitbox by the prop: his ink ring,
 * glossy red body and rim shade, his brow and eyes looking down where it's going with gritted teeth, a red blur and
 * three speed lines streaming back up the way it came. It falls down and forward; the prop mirrors it to its facing.
 * `l` sets the speed lines' lengths, `t` the blur's, for the flicker drawings.
 */
function rainBall(l: [number, number, number], t: number): PathShape[] {
  return [
    tail(t),
    streak(-3.3, R + 0.4, l[0], 0.55),
    streak(0.2, R + 1.0, l[1], 0.7),
    streak(3.4, R + 0.2, l[2], 0.55),
    ...ballLine,
    ...ballFill,
    ...ballShade,
    ...(eyes.eyesDeterminedDown as PathShape[]),
    ...(brows.browAngry as PathShape[]),
    ...(mouths.mouthGrit as PathShape[]),
    ...ballShine,
  ];
}

const FLICKER: [[number, number, number], number][] = [
  [[5.5, 8.5, 4.5], 12],
  [[7, 6.5, 6], 13],
  [[4.5, 9.5, 7], 11.5],
];

/** The raining ball's drawings and its flicker loop (`fxRainBall`), for the rig's symbols. */
export const rainBallSymbols: Record<string, ArtSymbol> = {
  ...Object.fromEntries(FLICKER.map(([l, t], i) => [`fxRainBall${i}`, rainBall(l, t)])),
  fxRainBall: { loop: FLICKER.map((_, i) => `fxRainBall${i}`), fps: 20 },
};
