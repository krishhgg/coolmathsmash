import type { PathShape } from '../../../render/rig/types';

/**
 * The placeholder mannequin, drawn by hand on Fireboy's rig until his own drawing lands: wooden limbs with a
 * bright left edge, a dark right edge and a thick ink outline. Every limb hangs from its bone's origin down the
 * +y axis. Nothing here is traced or converted from original game files (docs/art.md).
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

/** Outline width of the body parts. */
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
      { d: tube(-r0 * 0.5, len * 0.05, len * 0.85, r0 * 0.28, r1 * 0.24), fill: 'skinHi' },
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
/** Ends in a plain rounded tip. */
export const foreArm = limb(FORE_ARM - ARM_R - LINE, ARM_R * 0.95, ARM_R * 1.05);
/** A forearm ending in a rounded mitten, for gripping. */
export const mitten = limb(FORE_ARM - ARM_R * 1.35 - LINE, ARM_R * 0.95, ARM_R * 1.35);
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
 * the tops of both legs so body and legs read as one piece.
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
 * The mannequin's head: a plain wooden egg drawn around the head centre, chin `HEAD_R` below it, with the
 * same inked outline as the limbs. Faces are drawn over it in head space, so a fighter's own head only has to
 * keep the head centre where the rig puts it.
 */
const HEAD_RX = 3.7;
/** The head reaches well above its centre, so the drawn fighter fills the 15-unit hurtbox. */
const HEAD_TOP = 7.5;
const HEAD_CHIN = 3.41;
function egg(rx: number, top: number, chin: number): string {
  const p = (x: number, y: number) => `${n(x)} ${n(y)}`;
  return [
    `M${p(rx, 0)}`,
    `C${p(rx, K * chin)} ${p(K * rx, chin)} ${p(0, chin)}`,
    `C${p(-K * rx, chin)} ${p(-rx, K * chin)} ${p(-rx, 0)}`,
    `C${p(-rx, -K * top)} ${p(-K * rx, -top)} ${p(0, -top)}`,
    `C${p(K * rx, -top)} ${p(rx, -K * top)} ${p(rx, 0)}Z`,
  ].join('');
}
function head(dx: number): PathShape[] {
  return [
    { d: egg(HEAD_RX + LINE, HEAD_TOP + LINE, HEAD_CHIN + LINE), fill: 'line' },
    { d: egg(HEAD_RX, HEAD_TOP, HEAD_CHIN), fill: 'skin' },
    { d: ellipse(2.1 + dx, -0.6, 1.1, 3.2), fill: 'skinLo' },
    { d: ellipse(-1.7 + dx, -4.2, 0.9, 1.6), fill: 'skinHi' },
  ];
}
export const headFront = head(0);
export const headSide = head(0.6);
export const headUp = head(0);

/** Eye line in head space: about two fifths of the way down the head. */
const EYE_Y = -2.2;
const MOUTH_Y = -0.3;
const dot = (x: number, y: number, r = 0.32): PathShape => ({ d: ellipse(x, y, r, r * 1.25), fill: 'line' });
const line = (pts: [number, number][], width = 0.22): PathShape =>
  stroke(pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join(''), width);
const EYES_FRONT = [dot(-1.1, EYE_Y), dot(1.1, EYE_Y)];
const BROWS_FRONT = [
  line([
    [-1.8, EYE_Y - 1.0],
    [-0.6, EYE_Y - 0.6],
  ]),
  line([
    [0.6, EYE_Y - 0.6],
    [1.8, EYE_Y - 1.0],
  ]),
];
const EYE_SIDE = [dot(2.2, EYE_Y)];
const BROW_SIDE = line([
  [1.5, EYE_Y - 0.6],
  [2.9, EYE_Y - 1.0],
]);
const squint = (x: number, dir: 1 | -1): PathShape =>
  line(
    [
      [x + 0.45 * dir, EYE_Y - 0.4],
      [x - 0.4 * dir, EYE_Y],
      [x + 0.45 * dir, EYE_Y + 0.4],
    ],
    0.26,
  );
const SMALL_O: PathShape = { d: ellipse(0, MOUTH_Y, 0.38, 0.32), fill: 'line' };

/** Face drawings in head space (the head centre is the origin, facing right). */
export const faces: Record<string, PathShape[]> = {
  faceFront: EYES_FRONT,
  faceFrontBlink: [
    line([
      [-1.5, EYE_Y],
      [-0.7, EYE_Y],
    ]),
    line([
      [0.7, EYE_Y],
      [1.5, EYE_Y],
    ]),
  ],
  faceFrontAngry: [...EYES_FRONT, ...BROWS_FRONT],
  faceFrontShout: [...EYES_FRONT, ...BROWS_FRONT, { d: ellipse(0, MOUTH_Y, 0.75, 0.6), fill: 'line' }],
  faceFrontHurt: [squint(-1.1, -1), squint(1.1, 1), SMALL_O],
  faceFrontDazed: [...EYES_FRONT, SMALL_O],
  faceFrontStrain: [
    ...EYES_FRONT,
    line([
      [-0.65, MOUTH_Y],
      [0.65, MOUTH_Y],
    ]),
  ],
  faceSide: EYE_SIDE,
  faceSideBlink: [
    line([
      [1.8, EYE_Y],
      [2.6, EYE_Y],
    ]),
  ],
  faceSideAngry: [...EYE_SIDE, BROW_SIDE],
  faceSideShout: [...EYE_SIDE, BROW_SIDE, { d: ellipse(2.5, MOUTH_Y, 0.5, 0.45), fill: 'line' }],
  faceSideHurt: [squint(2.2, 1)],
  faceUp: [dot(-1.0, EYE_Y - 1.6), dot(1.0, EYE_Y - 1.6)],
};

/**
 * A strike flame pointing up from its base at the origin, sized like the fireball (radius 3.6) so `flame()`
 * in poses.ts places it the same way: a pale core in an orange teardrop with three swept tongues and a thin
 * dark outline. `tips` nudges the left, middle and right tongues for the flicker drawings.
 */
/** How far the jet's middle tongue reaches from its base centre, in ball units. */
export const JET_TIP = 10.6;

export function jet(s: number, dy: number, [l, m, r]: [number, number, number]): string {
  const p = (x: number, y: number) => `${n(x * s)} ${n(y * s + dy)}`;
  return [
    `M${p(0, 3)}`,
    `C${p(2.2, 3)} ${p(3.2, 1.4)} ${p(3, -0.6)}`,
    `C${p(2.9, -2.4)} ${p(3.4, -3.8)} ${p(4 + r * 0.3, -5.6 - r)}`,
    `C${p(2.6, -4.6)} ${p(2, -4.4)} ${p(1.5, -4.2)}`,
    `C${p(1.6, -6.4)} ${p(1, -8.6)} ${p(m * 0.3, -10.6 - m)}`,
    `C${p(-0.9, -8.4)} ${p(-1.3, -6.2)} ${p(-1.6, -4.4)}`,
    `C${p(-2.2, -4.8)} ${p(-2.8, -5.2)} ${p(-3.6 - l * 0.3, -6.6 - l)}`,
    `C${p(-3.2, -4)} ${p(-3.2, -2.2)} ${p(-3, -0.6)}`,
    `C${p(-3.2, 1.4)} ${p(-2.2, 3)} ${p(0, 3)}Z`,
  ].join('');
}

const FLICKER: [number, number, number][] = [
  [0, 0, 0],
  [0.5, -0.7, 0.4],
  [-0.5, 0.6, -0.4],
];

export const jets: PathShape[][] = FLICKER.map((tips) => [
  { d: jet(1, 0, tips), fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
  { d: jet(0.64, 1.0, tips), fill: 'fxHot' },
  { d: jet(0.34, 1.75, tips), fill: 'fxCore' },
]);

/** A ball of radius `r` centred on the origin with a tail swept back towards -x, `t` nudging the tail tip. */
function comet(r: number, t: number): string {
  return [
    `M${n(0)} ${n(-r)}`,
    `C${n(K * r)} ${n(-r)} ${n(r)} ${n(-K * r)} ${n(r)} 0`,
    `C${n(r)} ${n(K * r)} ${n(K * r)} ${n(r)} 0 ${n(r)}`,
    `C${n(-0.8 * r)} ${n(r)} ${n(-1.5 * r)} ${n(0.5 * r)} ${n(-(2.2 + t * 0.2) * r)} ${n(t * 0.15 * r)}`,
    `C${n(-1.5 * r)} ${n(-0.4 * r)} ${n(-0.8 * r)} ${n(-r)} 0 ${n(-r)}Z`,
  ].join('');
}

/** Fireball drawings (radius 3.6 at scale 1, trailing towards -x). */
export const balls: PathShape[][] = FLICKER.map(([l, m]) => [
  { d: comet(3.6, l + m), fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
  { d: comet(2.5, m), fill: 'fxHot' },
  { d: ellipse(0.5, 0, 1.3, 1.3), fill: 'fxCore' },
]);

/**
 * Fire Blast's fire (src/fighters/fireboy/finalSmash.ts), at world scale: one flame as big as the blast's two
 * radius-16 hitboxes, its round front leading towards +x and three swept tongues trailing back, with the two
 * fireballs (fire1 and fire2, as in Mario Finale) rolling round each other inside it. `tips` nudges the top, middle
 * and bottom tongues for the flicker drawings.
 */
function blastFlame(s: number, dx: number, [t, m, b]: [number, number, number]): string {
  const p = (x: number, y: number) => `${n(x * s + dx)} ${n(y * s)}`;
  return [
    `M${p(0, -18)}`,
    `C${p(10, -18)} ${p(18, -10)} ${p(18, 0)}`,
    `C${p(18, 10)} ${p(10, 18)} ${p(0, 18)}`,
    `C${p(-8, 18)} ${p(-15, 16)} ${p(-24 - b * 1.5, 13 + b)}`,
    `C${p(-18, 11)} ${p(-15, 9)} ${p(-12, 6.5)}`,
    `C${p(-18, 5.5)} ${p(-24, 3)} ${p(-30 - m * 1.5, m)}`,
    `C${p(-24, -3)} ${p(-18, -5.5)} ${p(-12, -6.5)}`,
    `C${p(-15, -9)} ${p(-18, -11)} ${p(-24 - t * 1.5, -13 - t)}`,
    `C${p(-15, -16)} ${p(-8, -18)} ${p(0, -18)}Z`,
  ].join('');
}

/** A swirl line curling round the front of the blast, from angle a0 to a1 (degrees) at radius r. */
function swirl(r: number, a0: number, a1: number): string {
  const at = (a: number) => {
    const t = (a * Math.PI) / 180;
    return `${n(Math.cos(t) * r + 2)} ${n(Math.sin(t) * r)}`;
  };
  const mid = (a0 + a1) / 2;
  return `M${at(a0)} Q${at(mid)} ${at(a1)}`;
}

/** The whole blast with its fireballs rolled `turn` degrees round the centre line (y down). */
function blastDrawing(turn: number, tips: [number, number, number]): PathShape[] {
  const ball = (a: number): PathShape[] => {
    const t = ((turn + a) * Math.PI) / 180;
    const x = Math.cos(t) * 4 + 3;
    const y = Math.sin(t) * 7.5;
    return [
      { d: ellipse(x, y, 7.2, 7.2), fill: 'fxHot', stroke: { color: 'fxLine', width: 0.45 } },
      { d: ellipse(x + 1.4, y, 4.2, 4.2), fill: 'fxCore' },
    ];
  };
  const back = Math.sin((turn * Math.PI) / 180) > 0 ? 0 : 180;
  return [
    { d: blastFlame(1, 0, tips), fill: 'fx', stroke: { color: 'fxLine', width: 0.7 } },
    { d: blastFlame(0.7, 3.5, tips), fill: 'fxHot' },
    ...ball(back),
    { d: swirl(12.5, turn - 70, turn + 40), stroke: { color: 'fxLine', width: 0.5 } },
    { d: swirl(12.5, turn + 110, turn + 220), stroke: { color: 'fxLine', width: 0.5 } },
    ...ball(back + 180),
  ];
}

/** Fire Blast drawings: the pair rolls a third of a turn between drawings. */
export const blasts: PathShape[][] = FLICKER.map((tips, i) => blastDrawing(30 + i * 120, tips));
