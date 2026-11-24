import type { PathShape } from '../../../render/rig/types';
import { ellipse, place, poly, smooth, star, tube, type P } from './shapes';

/**
 * Johnny's parts, drawn by hand in the 2012 game's Flash look: flat fills with a darker shade band on one side,
 * a light highlight on the other and a thin outline in a dark tone of the fill (dark red on the suit, brown on
 * the skin, olive on the hair). Head and torso are drawn in the 3/4 view the game uses, facing right.
 */

/** Outline width of the body parts. */
export const LINE = 0.13;

const fill = (d: string, color: string): PathShape => ({ d, fill: color });
const inked = (d: string, color: string, line: string, width = LINE): PathShape => ({
  d,
  fill: color,
  stroke: { color: line, width },
});
const stroke = (d: string, color: string, width: number): PathShape => ({ d, stroke: { color, width } });

/** Pushes every point of a closed outline `by` units outwards along its normal (for outline underlays). */
export function inflate(points: readonly P[], by: number): P[] {
  const count = points.length;
  let area = 0;
  for (let i = 0; i < count; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[(i + 1) % count]!;
    area += x0 * y1 - x1 * y0;
  }
  const out = area > 0 ? 1 : -1;
  return points.map((p, i) => {
    const prev = points[(i + count - 1) % count]!;
    const next = points[(i + 1) % count]!;
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    const x = p[0] + (out * ty * by) / len;
    const y = p[1] - (out * tx * by) / len;
    return p.length === 3 ? [x, y, p[2]] : [x, y];
  });
}

// ---------------------------------------------------------------------------------------------------------
// Head, in head space: the origin is where the jaw rests on the chest; y up is negative.

const NAPE: P[] = [
  [-2.9, 0.55],
  [-2.6, -1.2],
  [-2.15, -2.4],
  [-1.2, -2.6],
  [0.4, -1.2],
  [0.4, 0.55],
];
const CRANIUM: P[] = [
  [-2.1, -2.3],
  [-2.2, -3.6],
  [-1.6, -4.5],
  [0.2, -4.8],
  [1.6, -4.75],
  [2.4, -4.3],
  [2.75, -3.5],
  [2.95, -2.75],
  [2.3, -2.3],
  [0.6, -2.2],
  [-1.0, -2.1],
];
const JAW: P[] = [
  [-2.3, -1.9],
  [-1.4, -2.3],
  [0.0, -2.45],
  [1.6, -2.5],
  [2.6, -2.66],
  [3.25, -2.72],
  [3.5, -1.9],
  [3.45, -0.9],
  [3.0, -0.12],
  [2.3, 0.18],
  [1.7, -0.04, 0.3],
  [1.1, 0.26],
  [0.0, 0.3],
  [-1.2, 0.05],
  [-2.05, -0.7],
];
const JAW_SHADE: P[] = [
  [-2.05, -0.7],
  [-1.2, 0.05],
  [0.0, 0.3],
  [1.1, 0.26],
  [1.7, -0.04, 0.3],
  [2.3, 0.18],
  [3.0, -0.12],
  [3.45, -0.9],
  [3.05, -0.62],
  [2.35, -0.34],
  [1.7, -0.48],
  [1.08, -0.2],
  [0.0, -0.14],
  [-1.15, -0.4],
];
/** The jutting muzzle over the mouth, lighter than the jaw. */
const SNOUT: P[] = [
  [-0.3, -2.42],
  [1.6, -2.48],
  [2.6, -2.64],
  [3.25, -2.7],
  [3.48, -1.95],
  [3.0, -1.72],
  [2.2, -1.98],
  [1.0, -1.98],
  [0.0, -1.86],
];
const NOSE: P[] = [
  [0.5, -3.4, 0],
  [1.5, -3.4, 0],
  [2.05, -2.95],
  [2.38, -2.55],
  [2.12, -2.2],
  [1.55, -2.2],
  [1.1, -2.48],
  [0.8, -2.9],
];

const QUIFF: P[] = [
  [-1.62, -4.42],
  [-1.1, -4.92],
  [-0.1, -5.12],
  [0.75, -5.45],
  [1.38, -6.02],
  [2.18, -6.4],
  [2.98, -6.36],
  [3.45, -6.0],
  [3.5, -5.38],
  [3.08, -4.86],
  [2.4, -4.68],
  [1.02, -4.58],
  [-0.34, -4.5],
];

/** Head without a mouth: nape, skull and jaw, ear, cheeks, nose, the blue visor and the yellow quiff. */
export const head: PathShape[] = [
  fill(smooth(NAPE), 'skinDark'),
  inked(star(-1.78, -5.12, 0.7, 0.3, 5, -128), 'hair', 'hairLine', 0.1),
  inked(smooth(CRANIUM), 'skin', 'skinLine'),
  inked(smooth(JAW), 'skin', 'skinLine'),
  fill(smooth(JAW_SHADE), 'skinLo'),
  fill(
    smooth([
      [-2.0, -0.55],
      [-1.1, 0.0],
      [0.0, 0.25],
      [-0.3, 0.0],
      [-1.25, -0.3],
    ]),
    'skinDark',
  ),
  fill(smooth(SNOUT), 'skinHi'),
  fill(
    smooth([
      [-2.0, -2.1],
      [-1.3, -2.25],
      [-0.6, -2.3],
      [-1.0, -1.7],
      [-1.7, -1.2],
      [-2.1, -1.5],
    ]),
    'skinLo',
  ),
  fill(ellipse(-0.62, -2.86, 0.74, 0.32), 'skinHi'),
  fill(ellipse(2.62, -2.8, 0.34, 0.3), 'skinHi'),
  inked(ellipse(-1.86, -2.95, 0.46, 0.6), 'skin', 'skinLine', 0.1),
  stroke(
    smooth(
      [
        [-1.64, -3.32],
        [-1.96, -3.12],
        [-1.9, -2.72],
      ],
      false,
    ),
    'skinDark',
    0.12,
  ),
  inked(smooth(NOSE), 'skinHi', 'skinLine', 0.08),
  fill(
    poly([
      [0.62, -3.36],
      [0.9, -3.36],
      [1.3, -2.46],
      [1.1, -2.42],
    ]),
    'shine',
  ),
  stroke(
    smooth(
      [
        [0.22, -3.3],
        [0.42, -3.0],
        [0.36, -2.66],
      ],
      false,
    ),
    'skinDark',
    0.1,
  ),
  inked(
    poly([
      [-2.25, -4.2],
      [-0.85, -4.38],
      [-0.85, -3.58],
      [-2.2, -3.62],
    ]),
    'visorHi',
    'visorLine',
    0.1,
  ),
  fill(
    poly([
      [-1.06, -4.36],
      [-0.8, -4.42],
      [-0.8, -3.54],
      [-1.06, -3.58],
    ]),
    'visorGlow',
  ),
  inked(
    smooth([
      [-0.85, -4.58, 0.2],
      [2.34, -4.58, 0.2],
      [2.4, -3.3, 0.2],
      [-0.85, -3.36, 0.2],
    ]),
    'visor',
    'visorLine',
    0.17,
  ),
  fill(
    poly([
      [-0.7, -4.45],
      [2.22, -4.45],
      [2.22, -4.17],
      [-0.7, -4.17],
    ]),
    'visorHi',
  ),
  fill(
    poly([
      [-0.12, -3.52],
      [0.3, -4.36],
      [0.62, -4.36],
      [0.2, -3.52],
    ]),
    'visorShine',
  ),
  fill(
    poly([
      [0.62, -3.52],
      [1.04, -4.36],
      [1.24, -4.36],
      [0.82, -3.52],
    ]),
    'visorShine',
  ),
  fill(
    poly([
      [1.6, -3.52],
      [1.6, -4.36],
      [1.9, -4.36],
      [1.9, -3.52],
    ]),
    'visorShine',
  ),
  inked(smooth(QUIFF), 'hair', 'hairLine'),
  fill(
    smooth([
      [-1.45, -4.5],
      [-0.3, -4.56],
      [1.0, -4.64],
      [2.4, -4.74],
      [3.0, -4.95],
      [2.4, -4.98],
      [1.0, -4.9],
      [-0.3, -4.8],
    ]),
    'hairLo',
  ),
  fill(
    smooth([
      [-0.9, -4.86],
      [0.2, -5.05],
      [1.0, -5.55],
      [1.75, -6.2],
      [1.2, -5.62],
      [0.3, -4.98],
    ]),
    'hairHi',
  ),
  fill(
    smooth([
      [2.0, -5.3],
      [2.22, -6.0],
      [2.85, -6.16],
      [3.32, -5.85],
      [3.28, -5.25],
      [2.85, -5.0],
      [2.98, -5.5],
      [2.7, -5.74],
      [2.36, -5.56],
    ]),
    'hairHi',
  ),
];

/** Mouths, in head space. The default is the game's gritted-teeth sneer, set right under the nose. */
export const mouths: Record<string, PathShape[]> = {
  grit: [
    fill(
      smooth([
        [-1.0, -1.38],
        [-0.62, -1.8],
        [0.6, -1.94],
        [2.05, -2.14, 0],
        [1.35, -1.72],
        [0.3, -1.24],
        [-0.5, -1.06],
      ]),
      'ink',
    ),
    fill(
      smooth([
        [-0.66, -1.42],
        [-0.4, -1.68],
        [0.7, -1.82],
        [1.62, -1.98, 0],
        [0.95, -1.62],
        [0.1, -1.36],
        [-0.42, -1.28],
      ]),
      'teeth',
    ),
  ],
  shout: [
    fill(
      smooth([
        [-1.0, -1.5],
        [0.4, -1.98],
        [2.05, -2.2, 0],
        [1.9, -1.3],
        [1.1, -0.55],
        [0.0, -0.45],
        [-0.8, -0.85],
      ]),
      'ink',
    ),
    fill(
      smooth([
        [-0.66, -1.5],
        [0.4, -1.84],
        [1.75, -2.02, 0],
        [1.68, -1.76],
        [0.5, -1.56],
        [-0.55, -1.3],
      ]),
      'teeth',
    ),
    fill(ellipse(0.5, -0.86, 0.66, 0.27), 'tongue'),
  ],
  smirk: [
    stroke(
      smooth(
        [
          [-0.9, -1.3],
          [0.2, -1.18],
          [1.25, -1.46],
          [1.95, -2.02],
        ],
        false,
      ),
      'ink',
      0.17,
    ),
    stroke(
      smooth(
        [
          [-1.0, -1.52],
          [-0.86, -1.27],
          [-1.0, -1.04],
        ],
        false,
      ),
      'skinDark',
      0.1,
    ),
  ],
  hurt: [
    fill(
      smooth([
        [-0.9, -1.55],
        [0.5, -1.86],
        [1.8, -1.92],
        [1.86, -1.1],
        [0.9, -0.6],
        [-0.3, -0.64],
        [-0.95, -1.05],
      ]),
      'ink',
    ),
    fill(
      poly([
        [-0.6, -1.5],
        [0.5, -1.72],
        [1.55, -1.76],
        [1.4, -1.46],
        [1.15, -1.62],
        [0.9, -1.4],
        [0.6, -1.58],
        [0.3, -1.35],
        [0.0, -1.5],
        [-0.3, -1.3],
      ]),
      'teeth',
    ),
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Torso, in hip space: the hip bone sits just under the belt, between the legs; the chest rises to y -7.

const TORSO: P[] = [
  [-2.0, -6.95],
  [-3.1, -6.55],
  [-3.75, -5.6],
  [-3.55, -4.0],
  [-2.75, -2.5],
  [-2.3, -1.3],
  [-2.35, -0.2],
  [-2.3, 0.6],
  [-1.3, 1.02],
  [0.3, 1.38, 0.4],
  [1.9, 1.02],
  [2.85, 0.55],
  [2.9, -0.2],
  [2.85, -1.3],
  [3.35, -2.5],
  [3.95, -4.0],
  [3.98, -5.6],
  [3.38, -6.6],
  [2.3, -6.95],
];

const rect = (x0: number, y0: number, x1: number, y1: number) =>
  poly([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);

/** Chest, abs, belt with its gold buckle, and the trunks (drawn over the tops of both thighs). */
export const torso: PathShape[] = [
  inked(smooth(TORSO), 'suit', 'suitLine'),
  fill(
    smooth([
      [3.38, -6.6],
      [3.98, -5.6],
      [3.95, -4.0],
      [3.5, -2.5],
      [2.85, -1.3],
      [2.3, -1.3],
      [2.8, -2.6],
      [3.35, -4.0],
      [3.4, -5.5],
      [2.95, -6.4],
    ]),
    'suitLo',
  ),
  fill(ellipse(0.55, -6.62, 1.9, 0.42), 'suitLo'),
  fill(ellipse(-1.55, -5.3, 0.95, 0.5), 'suitHi'),
  fill(ellipse(1.95, -5.4, 0.8, 0.45), 'suitHi'),
  fill(
    smooth([
      [-3.05, -4.3],
      [-1.8, -3.78],
      [-0.4, -3.72],
      [0.45, -4.12],
      [-0.4, -3.44],
      [-1.8, -3.42],
    ]),
    'suitLo',
  ),
  fill(
    smooth([
      [0.45, -4.12],
      [1.6, -3.72],
      [2.95, -3.8],
      [3.65, -4.3],
      [2.95, -3.5],
      [1.6, -3.4],
    ]),
    'suitLo',
  ),
  stroke(
    smooth(
      [
        [0.45, -6.2],
        [0.5, -5.2],
        [0.45, -4.2],
      ],
      false,
    ),
    'suitLo',
    0.12,
  ),
  fill(rect(-0.8, -3.05, 0.25, -2.62), 'suitLo'),
  fill(rect(0.65, -3.05, 1.7, -2.62), 'suitLo'),
  fill(rect(-0.7, -2.35, 0.25, -1.95), 'suitLo'),
  fill(rect(0.65, -2.35, 1.6, -1.95), 'suitLo'),
  fill(
    smooth([
      [-1.6, 0.55],
      [0.3, 0.98],
      [1.95, 0.55],
      [1.25, 1.12],
      [0.3, 1.36],
      [-0.65, 1.12],
    ]),
    'suitLo',
  ),
  inked(rect(-2.45, -1.38, 2.95, -0.08), 'belt', 'ink', 0.06),
  fill(rect(-2.34, -1.28, 2.84, -1.14), 'beltHi'),
  inked(rect(0.0, -1.68, 1.96, 0.18), 'buckle', 'buckleLo', 0.08),
  fill(rect(0.0, -1.68, 0.2, 0.18), 'buckleLo'),
  fill(rect(0.38, -1.3, 1.6, -0.2), 'belt'),
  fill(rect(0.76, -0.96, 1.24, -0.54), 'buckle'),
];

// ---------------------------------------------------------------------------------------------------------
// Limbs hang from their bone's origin down the +y axis. Each is two symbols: the outline, drawn in a slot behind
// both segments of the limb so elbows and knees have no seam, and the fill.

export interface Part {
  line: PathShape[];
  fill: PathShape[];
}

/** Colour keys for a limb: the front limbs use the bright suit, the far ones the shaded suit. */
interface Tone {
  base: string;
  lo: string;
  hi: string;
  boot: string;
  bootLo: string;
}
const NEAR: Tone = { base: 'suit', lo: 'suitLo', hi: 'suitHi', boot: 'boot', bootLo: 'bootLo' };
const FAR: Tone = { base: 'suitFar', lo: 'suitFarLo', hi: 'suit', boot: 'bootFar', bootLo: 'bootFarLo' };

export const UPPER_ARM = 2.5;
/** Elbow to the centre of the hand. */
export const FORE_ARM = 2.1;
export const THIGH = 2.4;
/** Knee to ankle; the boot's sole is `ANKLE` below the ankle. */
export const SHIN = 2.1;
export const ANKLE = 0.55;

/** A muscular upper arm: round deltoid on top, bulging biceps, tapering into the elbow. */
const ARM: P[] = place(
  [
    [0, -1.0],
    [0.75, -0.78],
    [1.1, 0.0],
    [1.18, 0.8],
    [1.02, 1.6],
    [0.78, 2.3],
    [0.5, 2.85],
    [0, 3.12],
    [-0.5, 2.85],
    [-0.72, 2.3],
    [-0.86, 1.5],
    [-0.96, 0.6],
    [-0.86, -0.3],
    [-0.6, -0.8],
  ],
  0,
  0,
  1.22,
  1,
);

function upperArm(t: Tone): Part {
  return {
    line: [fill(smooth(inflate(ARM, LINE)), 'suitLine')],
    fill: [
      fill(smooth(ARM), t.base),
      fill(
        smooth([
          [0.55, -0.6],
          [1.05, 0.2],
          [1.08, 1.2],
          [0.7, 2.3],
          [0.3, 2.8],
          [0.45, 1.8],
          [0.62, 0.6],
        ]),
        t.lo,
      ),
      fill(ellipse(-0.42, 0.2, 0.3, 0.75), t.hi),
    ],
  };
}

const WRIST = FORE_ARM - 0.85;

function forearmTube(t: Tone, end = WRIST): Part {
  return {
    line: [fill(tube(0, 0, end, 0.74 + LINE, 0.6 + LINE), 'suitLine')],
    fill: [
      fill(tube(0, 0, end, 0.74, 0.6), t.base),
      fill(tube(0.36, 0.15, end - 0.1, 0.28, 0.22), t.lo),
      fill(tube(-0.38, 0.2, end - 0.3, 0.14, 0.11), t.hi),
    ],
  };
}

const H = FORE_ARM;
/** Hand shapes are drawn around the hand point (0, 0) and scaled up: his fists and palms are huge. */
const FIST_SCALE = 1.2;
const PALM_SCALE = 1.45;
const hand = (pts: readonly P[], k: number) => place(pts, 0, H, k);

const FIST: P[] = [
  [-0.88, -0.82],
  [0.55, -0.95],
  [1.02, -0.42],
  [1.08, 0.45],
  [0.78, 0.98],
  [-0.2, 1.08],
  [-0.92, 0.75],
  [-1.02, -0.1],
];

/** A big balled fist with curled finger creases and the thumb on the +x side. */
function fistShapes(k = FIST_SCALE): PathShape[] {
  const crease = (pts: P[]) => stroke(smooth(hand(pts, k), false), 'skinLine', 0.08);
  return [
    inked(smooth(hand(FIST, k)), 'skin', 'skinLine'),
    fill(
      smooth(
        hand(
          [
            [-0.9, 0.2],
            [-0.2, 0.95],
            [0.7, 0.9],
            [0.95, 0.4],
            [0.5, 0.75],
            [-0.3, 0.75],
          ],
          k,
        ),
      ),
      'skinLo',
    ),
    crease([
      [-0.82, 0.05],
      [-0.1, 0.12],
      [0.62, 0.02],
    ]),
    crease([
      [-0.78, 0.42],
      [-0.1, 0.5],
      [0.6, 0.4],
    ]),
    crease([
      [-0.68, 0.78],
      [-0.1, 0.86],
      [0.45, 0.78],
    ]),
    inked(
      smooth(
        hand(
          [
            [0.28, -0.78],
            [0.98, -0.55],
            [1.08, 0.12],
            [0.78, 0.28],
            [0.5, -0.2],
          ],
          k,
        ),
      ),
      'skinHi',
      'skinLine',
      0.07,
    ),
    fill(
      smooth(
        hand(
          [
            [-0.74, -0.4],
            [-0.4, -0.64],
            [-0.06, -0.4],
            [-0.4, -0.16],
          ],
          k,
        ),
      ),
      'skinHi',
    ),
  ];
}

/** An open hand, palm out, fingers spread along +y and the thumb out to +x. */
function palmShapes(k = PALM_SCALE): PathShape[] {
  const finger = (x: number, len: number, lean: number): PathShape =>
    inked(
      smooth(
        hand(
          [
            [x - 0.21, 0.3],
            [x + lean - 0.2, 0.3 + len],
            [x + lean, 0.52 + len],
            [x + lean + 0.2, 0.3 + len],
            [x + 0.21, 0.3],
          ],
          k,
        ),
      ),
      'skin',
      'skinLine',
      0.1,
    );
  return [
    finger(-0.6, 1.05, -0.15),
    finger(-0.2, 1.25, -0.05),
    finger(0.2, 1.2, 0.05),
    finger(0.58, 0.95, 0.15),
    inked(
      smooth(
        hand(
          [
            [-0.82, -0.62],
            [0.72, -0.62],
            [0.88, 0.35],
            [0.6, 0.75],
            [-0.6, 0.78],
            [-0.88, 0.3],
          ],
          k,
        ),
      ),
      'skin',
      'skinLine',
      0.1,
    ),
    inked(
      smooth(
        hand(
          [
            [0.5, -0.32],
            [1.15, -0.12],
            [1.5, 0.32],
            [1.32, 0.56],
            [0.72, 0.36],
          ],
          k,
        ),
      ),
      'skin',
      'skinLine',
      0.09,
    ),
    fill(
      smooth(
        hand(
          [
            [-0.6, 0.1],
            [-0.15, -0.25],
            [0.3, 0.1],
            [-0.15, 0.45],
          ],
          k,
        ),
      ),
      'skinHi',
    ),
    stroke(
      smooth(
        hand(
          [
            [-0.55, 0.5],
            [0.0, 0.2],
            [0.45, -0.25],
          ],
          k,
        ),
        false,
      ),
      'skinLo',
      0.08,
    ),
  ];
}

function forearm(t: Tone, hand: PathShape[]): Part {
  const arm = forearmTube(t);
  return { line: arm.line, fill: [...arm.fill, ...hand] };
}

/** A shapely tube leg; `end` is how far down the bone the tube reaches. */
function legTube(t: Tone, len: number, r0: number, r1: number): Part {
  return {
    line: [fill(tube(0, 0, len, r0 + LINE, r1 + LINE), 'suitLine')],
    fill: [
      fill(tube(0, 0, len, r0, r1), t.base),
      fill(tube(r0 * 0.5, len * 0.08, len * 0.95, r0 * 0.38, r1 * 0.32), t.lo),
      fill(tube(-r0 * 0.5, len * 0.12, len * 0.75, r0 * 0.18, r1 * 0.14), t.hi),
    ],
  };
}

const BOOT: P[] = [
  [-0.58, -1.0],
  [0.5, -1.0],
  [0.72, -0.2],
  [1.3, 0.12],
  [2.15, 0.42, 0],
  [1.05, ANKLE, 0],
  [-0.4, ANKLE, 0],
  [-0.95, ANKLE - 0.04, 0],
  [-0.78, -0.1],
];

/** The yellow boot with its pointed toe, in foot space: ankle at the origin, sole at `ANKLE`, toe along +x. */
function boot(t: Tone): PathShape[] {
  return [
    inked(smooth(BOOT), t.boot, 'bootLine'),
    fill(
      smooth([
        [-0.4, ANKLE, 0],
        [1.05, ANKLE, 0],
        [2.15, 0.42, 0],
        [1.15, 0.34],
        [-0.3, 0.35],
        [-0.88, ANKLE - 0.06, 0],
      ]),
      t.bootLo,
    ),
    fill(
      smooth([
        [0.15, -0.05],
        [0.95, 0.12],
        [1.7, 0.32],
        [0.95, 0.26],
      ]),
      'bootHi',
    ),
    fill(
      poly([
        [-0.58, -0.98],
        [0.5, -0.98],
        [0.56, -0.76],
        [-0.62, -0.76],
      ]),
      t.bootLo,
    ),
  ];
}

export const parts: Record<string, Part> = {
  upperArm: upperArm(NEAR),
  upperArmFar: upperArm(FAR),
  fist: forearm(NEAR, fistShapes()),
  fistFar: forearm(FAR, fistShapes()),
  palm: forearm(NEAR, palmShapes()),
  palmFar: forearm(FAR, palmShapes()),
  thigh: legTube(NEAR, THIGH, 0.84, 0.66),
  thighFar: legTube(FAR, THIGH, 0.84, 0.66),
  shin: legTube(NEAR, SHIN - 0.35, 0.66, 0.54),
  shinFar: legTube(FAR, SHIN - 0.35, 0.66, 0.54),
};

export const boots = { boot: boot(NEAR), bootFar: boot(FAR) };
