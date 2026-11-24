import type { PathShape } from '../../../render/rig/types';

/**
 * Hand-authored parts in the original's style: red limbs with a bright left edge, a dark right edge and a thick
 * black brush outline (the 2009 body is one traced blob, so limbs are rebuilt as tubes to animate them).
 * Every limb hangs from its bone's origin down the +y axis.
 */

const K = 0.5523;
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Closed capsule from (x, y0) radius r0 to (x, y1) radius r1, as SVG path data. */
export function tube(x: number, y0: number, y1: number, r0: number, r1: number): string {
  return [
    `M${n(x + r0)} ${n(y0)}`,
    `L${n(x + r1)} ${n(y1)}`,
    `C${n(x + r1)} ${n(y1 + K * r1)} ${n(x + K * r1)} ${n(y1 + r1)} ${n(x)} ${n(y1 + r1)}`,
    `C${n(x - K * r1)} ${n(y1 + r1)} ${n(x - r1)} ${n(y1 + K * r1)} ${n(x - r1)} ${n(y1)}`,
    `L${n(x - r0)} ${n(y0)}`,
    `C${n(x - r0)} ${n(y0 - K * r0)} ${n(x - K * r0)} ${n(y0 - r0)} ${n(x)} ${n(y0 - r0)}`,
    `C${n(x + K * r0)} ${n(y0 - r0)} ${n(x + r0)} ${n(y0 - K * r0)} ${n(x + r0)} ${n(y0)}Z`,
  ].join('');
}

/** Ellipse centred at (x, y). */
export function ellipse(x: number, y: number, rx: number, ry: number): string {
  return [
    `M${n(x + rx)} ${n(y)}`,
    `C${n(x + rx)} ${n(y + K * ry)} ${n(x + K * rx)} ${n(y + ry)} ${n(x)} ${n(y + ry)}`,
    `C${n(x - K * rx)} ${n(y + ry)} ${n(x - rx)} ${n(y + K * ry)} ${n(x - rx)} ${n(y)}`,
    `C${n(x - rx)} ${n(y - K * ry)} ${n(x - K * rx)} ${n(y - ry)} ${n(x)} ${n(y - ry)}`,
    `C${n(x + K * rx)} ${n(y - ry)} ${n(x + rx)} ${n(y - K * ry)} ${n(x + rx)} ${n(y)}Z`,
  ].join('');
}

/** Outline width of the body parts (the original brush is about 6 px at 0.036 units/px). */
export const LINE = 0.16;

/**
 * A limb segment from the origin to (0, len), as two symbols: the outline, drawn in a slot behind both segments
 * of the limb so the knee or elbow has no seam, and the fill with a bright left edge and a dark right edge.
 */
function limb(len: number, r0: number, r1: number): { line: PathShape[]; fill: PathShape[] } {
  return {
    line: [{ d: tube(0, 0, len, r0 + LINE, r1 + LINE), fill: 'line' }],
    fill: [
      { d: tube(0, 0, len, r0, r1), fill: 'skin' },
      { d: tube(-r0 * 0.45, len * 0.05, len * 0.85, r0 * 0.4, r1 * 0.35), fill: 'skinHi' },
      { d: tube(r0 * 0.55, len * 0.15, len * 0.9, r0 * 0.32, r1 * 0.3), fill: 'skinLo' },
    ],
  };
}

export const THIGH = 0.95;
export const SHIN = 1.05;
export const UPPER_ARM = 0.85;
export const FORE_ARM = 0.85;
const LEG_R = 0.32;
const ARM_R = 0.22;

export const thigh = limb(THIGH, LEG_R, LEG_R * 0.95);
/** Ends with a rounded, slightly flared foot whose bottom sits SHIN below the knee. */
export const shin = limb(SHIN - LEG_R - LINE, LEG_R * 0.95, LEG_R + 0.02);
export const upperArm = limb(UPPER_ARM, ARM_R, ARM_R * 0.95);
/** Ends in a rounded mitten hand. */
export const foreArm = limb(FORE_ARM - ARM_R * 1.3 - LINE, ARM_R * 0.95, ARM_R * 1.3);
const wrist = limb(FORE_ARM - ARM_R - LINE - 0.1, ARM_R * 0.95, ARM_R);
const FIST_Y = FORE_ARM - 0.3;
/** A balled-up hand for punches. */
export const fist = {
  line: [...wrist.line, { d: ellipse(0, FIST_Y, 0.34 + LINE, 0.34 + LINE), fill: 'line' }],
  fill: [
    ...wrist.fill,
    { d: ellipse(0, FIST_Y, 0.34, 0.34), fill: 'skin' },
    { d: ellipse(-0.1, FIST_Y - 0.07, 0.16, 0.13), fill: 'skinHi' },
  ],
};

/**
 * Torso in hip space: from the hips (y 0) up to the neck, mostly hidden under the head. Its fill is drawn over
 * the tops of both legs so body and legs read as one blob, as in the original.
 */
export const torso = {
  line: [{ d: tube(0, -1.3, -0.25, 0.66 + LINE, 0.7 + LINE), fill: 'line' }],
  fill: [
    { d: tube(0, -1.3, -0.25, 0.66, 0.7), fill: 'skin' },
    { d: tube(-0.36, -1.2, -0.35, 0.2, 0.24), fill: 'skinHi' },
    { d: tube(0.4, -1.1, -0.3, 0.17, 0.2), fill: 'skinLo' },
  ],
};

const stroke = (d: string, width = 0.2): PathShape => ({ d, stroke: { color: 'line', width } });

/**
 * Expressions, in head space (the head centre is the origin). Front faces follow the 2009 drawing: the big eye
 * sits left of centre at (-1.13, -0.6), the small one at (1.27, -0.55). The side face's eye is at (1.45, -0.65).
 */
export const lidsFront: PathShape[] = [
  { d: 'M-0.18 -0.7L-2.1 -1.2L-2.1 -1.75L-0.18 -1.75Z', fill: 'fire' },
  { d: 'M0.52 -0.62L2 -0.98L2 -1.5L0.52 -1.5Z', fill: 'fire' },
  stroke('M-0.2 -0.68L-2.02 -1.16', 0.22),
  stroke('M0.5 -0.6L1.95 -0.96', 0.2),
];
export const blinkFront: PathShape[] = [
  stroke('M-0.38 -0.55Q-1.13 -0.05 -1.9 -0.55'),
  stroke('M1.82 -0.5Q1.27 -0.1 0.72 -0.5'),
];
export const squintFront: PathShape[] = [
  stroke('M-1.75 -1.05L-0.7 -0.6L-1.75 -0.15', 0.3),
  stroke('M1.8 -0.95L0.9 -0.55L1.8 -0.15', 0.3),
];
export const shoutFront: PathShape[] = [
  { d: 'M0.9 1.3Q-0.25 1.6 -1.4 1.15Q-1.2 2.45 -0.2 2.42Q0.75 2.35 0.9 1.3Z', fill: 'line' },
  { d: 'M0.45 1.95Q-0.25 1.75 -0.95 1.85Q-0.7 2.25 -0.2 2.25Q0.25 2.22 0.45 1.95Z', fill: 'mouth' },
];
export const ouchFront: PathShape[] = [{ d: ellipse(-0.2, 1.75, 0.42, 0.34), fill: 'line' }];

export const lidsSide: PathShape[] = [
  { d: 'M0.45 -1.5L2.45 -0.88L2.45 -1.85L0.45 -1.85Z', fill: 'fire' },
  stroke('M0.5 -1.45L2.35 -0.88', 0.22),
];
export const blinkSide: PathShape[] = [stroke('M0.7 -0.6Q1.45 -0.1 2.2 -0.6')];
export const squintSide: PathShape[] = [stroke('M2.2 -1.05L1.0 -0.6L2.2 -0.15', 0.3)];
export const shoutSide: PathShape[] = [
  { d: 'M0.85 0.85Q1.6 1.05 2.25 0.7Q2.2 1.85 1.5 1.88Q0.95 1.8 0.85 0.85Z', fill: 'line' },
  { d: 'M1.15 1.5Q1.6 1.35 2.0 1.45Q1.85 1.75 1.5 1.75Q1.25 1.7 1.15 1.5Z', fill: 'mouth' },
];
export const ouchSide: PathShape[] = [{ d: ellipse(1.55, 1.25, 0.32, 0.28), fill: 'line' }];
