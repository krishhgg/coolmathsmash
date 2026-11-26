import { ellipse } from '../../fireboy/art/parts';
import type { PathShape } from '../../../render/rig/types';

/**
 * Water effects for Watergirl's placeholder mannequin, drawn by hand in the same frames as Fireboy's fire so
 * the shared clips place them the same way. A jet has its round head on the origin (radius 3 at scale 1) and
 * its tail running up -y to JET_TIP; a splash ball has radius 3.6 and trails towards -x.
 */

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** A water jet: a round head tapering into a smooth tail that bends by `bend`, scaled by `s` and lowered by `dy`. */
function stream(s: number, dy: number, bend: number): string {
  const p = (x: number, y: number) => `${n(x * s)} ${n(y * s + dy)}`;
  return [
    `M${p(0, 3)}`,
    `C${p(1.9, 3)} ${p(3.1, 1.6)} ${p(3, -0.4)}`,
    `C${p(2.9, -3.2)} ${p(1.6 + bend * 0.4, -6.4)} ${p(0.5 + bend, -10.6)}`,
    `C${p(-0.6 + bend * 0.6, -7.4)} ${p(-2.6, -3.6)} ${p(-3, -0.4)}`,
    `C${p(-3.1, 1.6)} ${p(-1.9, 3)} ${p(0, 3)}Z`,
  ].join('');
}

/** Two drops thrown off beside the tail, nudged by `t`. */
const drops = (t: number): PathShape[] => [
  { d: ellipse(2.6 + t * 0.4, -6.4 - t, 0.55, 0.75), fill: 'fx', stroke: { color: 'fxLine', width: 0.25 } },
  {
    d: ellipse(-2.3 - t * 0.3, -8.2 + t * 0.6, 0.4, 0.55),
    fill: 'fx',
    stroke: { color: 'fxLine', width: 0.22 },
  },
];

const RIPPLE: [number, number][] = [
  [0, 0],
  [0.45, 0.6],
  [-0.45, -0.6],
];

/** Strike jets: a blue stream with a pale core and a white glint, rippling through three drawings. */
export const streams: PathShape[][] = RIPPLE.map(([bend, t]) => [
  ...drops(t),
  { d: stream(1, 0, bend), fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
  { d: stream(0.66, 0.9, bend * 0.8), fill: 'fxHot' },
  { d: ellipse(-0.9, -0.4, 0.75, 1.1), fill: 'fxCore' },
]);

/** A splash ball of radius 3.6 with a tapered tail towards -x and a crescent glint. */
function splash(r: number, t: number): string {
  const K = 0.5523;
  return [
    `M0 ${n(-r)}`,
    `C${n(K * r)} ${n(-r)} ${n(r)} ${n(-K * r)} ${n(r)} 0`,
    `C${n(r)} ${n(K * r)} ${n(K * r)} ${n(r)} 0 ${n(r)}`,
    `C${n(-0.9 * r)} ${n(r)} ${n(-1.7 * r)} ${n((0.2 + t * 0.1) * r)} ${n(-2.4 * r)} ${n(t * 0.1 * r)}`,
    `C${n(-1.7 * r)} ${n((-0.3 + t * 0.1) * r)} ${n(-0.9 * r)} ${n(-r)} 0 ${n(-r)}Z`,
  ].join('');
}

export const splashes: PathShape[][] = RIPPLE.map(([bend, t]) => [
  { d: splash(3.6, bend + t), fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
  { d: splash(2.4, t), fill: 'fxHot' },
  { d: ellipse(1.2, -1.3, 0.9, 0.6), fill: 'fxCore' },
]);

/** Foam: blobs merged into one cloud with a single outline (outlines first, then fills, as the limbs are inked). */
function foam(blobs: [number, number, number][], line = 0.3): PathShape[] {
  return [
    ...blobs.map(([x, y, r]) => ({ d: ellipse(x, y, r + line, r + line), fill: 'fxLine' })),
    ...blobs.map(([x, y, r]) => ({ d: ellipse(x, y, r, r), fill: 'fxCore' })),
  ];
}

/** An arc of radius `r` round (cx, cy), from angle a0 to a1 (degrees, y down), as one quadratic stroke. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const at = (a: number, k = 1) => {
    const t = (a * Math.PI) / 180;
    return `${n(cx + Math.cos(t) * r * k)} ${n(cy + Math.sin(t) * r * k)}`;
  };
  const span = (((a1 - a0) / 2) * Math.PI) / 180;
  return `M${at(a0)} Q${at((a0 + a1) / 2, 1 / Math.cos(span))} ${at(a1)}`;
}

/**
 * Tidal Wave's wave (src/fighters/watergirl/finalSmash.ts), at world scale round the entity's centre, which rides 13
 * units over the floor: its crest (fire1's radius-16 box, 3 up) curls over towards +x and its body (fire2's, 3 down)
 * runs back along the floor, so the drawing fills both boxes and trails a long back slope behind them. `t` (0-2)
 * rolls the crest, foam and spray on for the three drawings of the loop.
 */
function waveDrawing(t: number): PathShape[] {
  const lip = 0.5 * Math.sin((t * 2 * Math.PI) / 3);
  const body = [
    `M-18 13.6`,
    `C-15 12.6 -13.4 7 -11.6 -1`,
    `C-9 -11.5 -3 -19.5 5.5 -19.6`,
    `C13 -19.7 18.6 -15.4 ${n(18.4 + lip)} -9`,
    `C${n(18 + lip)} -5 ${n(15.4 + lip)} -2.6 ${n(12.6 + lip)} -4`,
    `C13.4 -6.6 12 -9.6 8.6 -9.8`,
    `C4.6 -10 2.6 -5.6 3.6 -0.6`,
    `C4.6 5 10.2 10.4 19 12.4`,
    `C21.4 13 21.6 13.6 19.4 13.6Z`,
  ].join('');
  /** The lit back of the wave, light coming through the water under the crest. */
  const band = [
    `M-15.5 12.8`,
    `C-12.8 9.5 -11.2 2 -9.2 -6.5`,
    `C-5.5 -14 0 -17.6 5.6 -17.6`,
    `C11 -17.6 14.8 -14.6 15.6 -10.8`,
    `C12.2 -13.2 7.6 -13.6 3.6 -12`,
    `C-2.2 -9.6 -6 -2 -8 4.5`,
    `C-9 8.6 -11 12 -15.5 12.8Z`,
  ].join('');
  /** The barrel's dark back wall under the lip. */
  const tube = `M8.6 -9.8C4.6 -10 2.6 -5.6 3.6 -0.6C4.2 2.6 6.2 5.6 9 7.8C6.8 4.4 6.2 0 7.2 -3.6C8 -6.4 10 -8 12.6 -7.6C11.8 -9 10.4 -9.8 8.6 -9.8Z`;
  const k = (i: number) => 0.3 * Math.sin(((t + i) * 2 * Math.PI) / 3);
  const crest: [number, number, number][] = [
    [-8, -13.8, 1.9 + k(0)],
    [-4.4, -16.6, 2.4 + k(1)],
    [0.2, -18.6, 2.7 + k(2)],
    [5.4, -19.2, 2.9 + k(0)],
    [10.6, -18.1, 2.7 + k(1)],
    [15, -15, 2.4 + k(2)],
    [17.4 + lip, -10.6, 2 + k(0)],
    [16.8 + lip, -6.6, 1.6 + k(1)],
    [14.4 + lip, -4.6, 1.2 + k(2)],
  ];
  const base: [number, number, number][] = [
    [12.5, 11.9, 1.4 + k(1)],
    [15.6, 12.4, 1.7 + k(2)],
    [18.8, 12.7, 1.6 + k(0)],
    [21.4, 13, 1.1 + k(1)],
    [-12.6, 12.9, 1 + k(2)],
    [-15.8, 13.1, 1.2 + k(0)],
  ];
  const drop = (x: number, y: number, r: number): PathShape => ({
    d: ellipse(x, y, r * 0.8, r),
    fill: 'fxCore',
    stroke: { color: 'fxLine', width: 0.3 },
  });
  const flow = (r: number, a0: number, a1: number, w: number): PathShape => ({
    d: arc(6.5, -4.5, r, a0 + t * 40, a1 + t * 40),
    stroke: { color: 'fxLine', width: w },
  });
  return [
    { d: body, fill: 'fx', stroke: { color: 'fxLine', width: 0.7 } },
    { d: band, fill: 'fxHot' },
    { d: tube, fill: 'fxLine' },
    flow(11.5, 150, 215, 0.45),
    flow(8, 170, 240, 0.4),
    { d: arc(-3.5, 6, 6, 200 - t * 25, 250 - t * 25), stroke: { color: 'fxCore', width: 0.5 } },
    ...foam(crest),
    ...foam(base),
    drop(21.5 + t * 0.9, -15 - t * 0.6, 0.9),
    drop(23.6 + t * 0.7, -9.4 + t * 0.5, 0.7),
    drop(19 + t * 0.6, -21.6 - t * 0.4, 0.6),
  ];
}

/** Tidal Wave drawings: the crest rolls a third of a cycle between drawings. */
export const waves: PathShape[][] = [0, 1, 2].map(waveDrawing);

/**
 * The swell she raises while she powers up: a mound of water on the floor round her feet (origin on the floor, y
 * down, about 13 wide and 4 high at scale 1) with a foam rim and drops rising off it. `t` (0-2) heaves it.
 */
function swellDrawing(t: number): PathShape[] {
  const h = 0.25 * Math.sin((t * 2 * Math.PI) / 3);
  const mound = [
    `M-6.6 0.3`,
    `C-5.8 -1.4 -4.2 ${n(-3.2 - h)} -1.6 ${n(-3.6 - h)}`,
    `C0.4 ${n(-3.9 + h)} 2.4 ${n(-3.7 - h)} 4.2 ${n(-3 + h)}`,
    `C5.6 -2.3 6.4 -1.2 6.8 0.3Z`,
  ].join('');
  const rim: [number, number, number][] = [
    [-5.4, -0.9, 0.7],
    [-3.4, -2.6 - h, 0.8],
    [-1, -3.4, 0.8],
    [1.6, -3.6 + h, 0.8],
    [4, -2.9, 0.75],
    [6, -1, 0.6],
  ];
  const drop = (x: number, y: number, r: number): PathShape => ({
    d: ellipse(x, y, r * 0.8, r),
    fill: 'fxHot',
    stroke: { color: 'fxLine', width: 0.22 },
  });
  return [
    { d: mound, fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
    { d: ellipse(-0.6, -1.8, 3.6, 0.9), fill: 'fxHot' },
    ...foam(rim, 0.22),
    drop(-4.6 - t * 0.2, -5 - t * 0.9, 0.45),
    drop(3.6 + t * 0.2, -5.6 - t * 0.8, 0.5),
    drop(0.4, -6.6 - ((t + 1) % 3) * 0.9, 0.4),
  ];
}

export const swells: PathShape[][] = [0, 1, 2].map(swellDrawing);
