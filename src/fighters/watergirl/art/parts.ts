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
