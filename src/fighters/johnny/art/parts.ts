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
  [2.6, -2.7],
  [3.4, -2.8],
  [3.85, -1.95],
  [3.78, -0.85],
  [3.2, -0.06],
  [2.3, 0.2],
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
  [3.2, -0.06],
  [3.78, -0.85],
  [3.3, -0.6],
  [2.35, -0.34],
  [1.7, -0.48],
  [1.08, -0.2],
  [0.0, -0.14],
  [-1.15, -0.4],
];
/** The big brown muzzle: the whole lower face from the ear to the jutting chin, darker than the brow. */
const MUZZLE: P[] = [
  [-1.5, -2.2],
  [-0.2, -2.42],
  [1.6, -2.5],
  [2.6, -2.68],
  [3.36, -2.76],
  [3.8, -1.95],
  [3.72, -0.88],
  [3.16, -0.08],
  [2.3, 0.16],
  [1.7, -0.06, 0.3],
  [1.1, 0.24],
  [0.0, 0.28],
  [-1.15, 0.02],
  [-1.85, -0.75],
  [-1.85, -1.6],
];
/** The rolled upper lip along the top of the muzzle. */
const LIP: P[] = [
  [0.1, -2.36],
  [1.6, -2.44],
  [2.6, -2.62],
  [3.32, -2.7],
  [3.66, -2.1],
  [3.2, -2.16],
  [2.3, -2.06],
  [1.2, -2.06],
  [0.3, -2.0],
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

/** The pompadour: swept up from the nape into a tall roll that curls back on itself over the brow. */
const QUIFF: P[] = [
  [-1.75, -4.4],
  [-1.95, -5.0],
  [-1.4, -5.5],
  [-0.4, -5.82],
  [0.7, -6.3],
  [1.6, -7.0],
  [2.6, -7.4],
  [3.5, -7.22],
  [4.02, -6.6],
  [4.05, -5.8],
  [3.65, -5.1],
  [3.0, -4.75],
  [2.3, -4.62],
  [1.0, -4.56],
  [-0.4, -4.5],
];
/** The spiral the roll curls into, read from the outside in. */
const CURL: P[] = [
  [3.7, -5.3],
  [3.62, -6.55],
  [2.8, -7.0],
  [2.06, -6.5],
  [2.1, -5.7],
  [2.85, -5.48],
  [3.2, -6.02],
  [2.86, -6.44],
  [2.5, -6.14],
];

/** Head without a mouth: nape, skull and jaw, ear, cheeks, nose, the blue visor and the yellow quiff. */
export const head: PathShape[] = [
  fill(smooth(NAPE), 'skinDark'),
  inked(star(-1.95, -5.15, 0.75, 0.32, 5, -128), 'hair', 'hairLine', 0.1),
  inked(smooth(CRANIUM), 'skin', 'skinLine'),
  inked(smooth(JAW), 'skin', 'skinLine'),
  fill(smooth(MUZZLE), 'skinLo'),
  fill(smooth(JAW_SHADE), 'skinDark'),
  fill(smooth(LIP), 'skin'),
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
  ...[-0.5, 0.18, 0.86, 1.54].map((x) =>
    fill(
      poly([
        [x, -3.52],
        [x + 0.42, -4.36],
        [x + 0.76, -4.36],
        [x + 0.34, -3.52],
      ]),
      'visorShine',
    ),
  ),
  inked(smooth(QUIFF), 'hair', 'hairLine'),
  fill(
    smooth([
      [-1.5, -4.5],
      [0.0, -4.6],
      [1.6, -4.68],
      [2.8, -4.82],
      [3.5, -5.25],
      [2.8, -5.1],
      [1.5, -4.98],
      [0.0, -4.88],
      [-1.4, -4.85],
    ]),
    'hairLo',
  ),
  fill(
    smooth([
      [2.0, -5.7],
      [2.5, -5.35],
      [3.2, -5.45],
      [3.5, -5.9],
      [3.1, -5.75],
      [2.6, -5.62],
    ]),
    'hairLo',
  ),
  fill(
    smooth([
      [-1.2, -5.3],
      [-0.2, -5.62],
      [0.9, -6.12],
      [0.2, -5.86],
      [-0.85, -5.48],
    ]),
    'hairHi',
  ),
  fill(
    smooth([
      [1.3, -6.75],
      [2.0, -7.18],
      [2.9, -7.25],
      [2.1, -7.02],
    ]),
    'hairHi',
  ),
  stroke(smooth(CURL, false), 'hairLine', 0.15),
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

// ---------------------------------------------------------------------------------------------------------
// Laser Gun: a chunky retro ray gun in the near fist. It is drawn in "gun space" (x along the barrel from the hand
// centre, y down, as it looks aimed level to the right) and turned into forearm space, where the barrel runs down
// the forearm's +y axis past the hand and the top of the gun is the thumb side (+x).

const gun = (pts: readonly P[]): P[] =>
  pts.map((p) => (p.length === 3 ? [-p[1], H + p[0], p[2]] : [-p[1], H + p[0]]));

/** The muzzle tip in gun space: the bore's centre line is 1.45 above the hand. */
export const GUN_MUZZLE: readonly [number, number] = [4.75, -1.45];

/** Ray gun: domed housing with an energy window and a fin, ringed barrel, flared emitter, grip in the fist. */
function gunShapes(): PathShape[] {
  const bore = GUN_MUZZLE[1];
  const ring = (x: number): PathShape =>
    inked(
      smooth(
        gun([
          [x - 0.14, bore - 0.62, 0],
          [x + 0.14, bore - 0.62, 0],
          [x + 0.14, bore + 0.62, 0],
          [x - 0.14, bore + 0.62, 0],
        ]),
      ),
      'suit',
      'suitLine',
      0.08,
    );
  return [
    // Grip, slanting back through the fist; only its butt shows below the fingers.
    inked(
      smooth(
        gun([
          [-0.95, -0.9, 0],
          [0.55, -0.9, 0],
          [0.2, 1.75],
          [-0.15, 2.05, 0],
          [-1.2, 2.05, 0],
          [-1.4, 1.7],
        ]),
      ),
      'gunLo',
      'gunLine',
    ),
    fill(
      poly(
        gun([
          [-1.32, 1.62],
          [-0.12, 1.62],
          [-0.15, 2.0],
          [-1.22, 2.0],
        ]),
      ),
      'suit',
    ),
    // Fin, swept back off the top of the housing.
    inked(
      smooth(
        gun([
          [-0.9, -2.1, 0],
          [0.5, -2.1, 0],
          [-0.75, -2.95, 0],
          [-1.35, -3.05, 0],
        ]),
      ),
      'suit',
      'suitLine',
    ),
    // Barrel, rings and flared emitter.
    inked(
      smooth(
        gun([
          [1.0, bore - 0.42, 0],
          [3.9, bore - 0.42, 0],
          [3.9, bore + 0.42, 0],
          [1.0, bore + 0.42, 0],
        ]),
      ),
      'gun',
      'gunLine',
    ),
    fill(
      poly(
        gun([
          [1.0, bore + 0.12],
          [3.9, bore + 0.12],
          [3.9, bore + 0.4],
          [1.0, bore + 0.4],
        ]),
      ),
      'gunLo',
    ),
    fill(
      poly(
        gun([
          [1.2, bore - 0.3],
          [3.7, bore - 0.3],
          [3.7, bore - 0.18],
          [1.2, bore - 0.18],
        ]),
      ),
      'gunHi',
    ),
    ring(2.2),
    ring(3.0),
    inked(
      smooth(
        gun([
          [3.75, bore - 0.5, 0],
          [4.55, bore - 0.88],
          [4.75, bore - 0.82, 0],
          [4.75, bore + 0.82, 0],
          [4.55, bore + 0.88],
          [3.75, bore + 0.5, 0],
        ]),
      ),
      'gun',
      'gunLine',
    ),
    fill(
      smooth(
        gun([
          [3.8, bore + 0.2, 0],
          [4.7, bore + 0.45],
          [4.7, bore + 0.75, 0],
          [3.8, bore + 0.45, 0],
        ]),
      ),
      'gunLo',
    ),
    inked(ellipseIn(4.68, bore, 0.16, 0.6), 'laser', 'laserLine', 0.06),
    fill(ellipseIn(4.7, bore - 0.12, 0.07, 0.26), 'laserHi'),
    // Domed housing with its glowing energy window.
    inked(
      smooth(
        gun([
          [-1.75, -1.35],
          [-1.35, -2.2],
          [-0.2, -2.42],
          [1.05, -2.12],
          [1.45, -1.45],
          [1.15, -0.72],
          [-0.2, -0.55],
          [-1.4, -0.72],
        ]),
      ),
      'gun',
      'gunLine',
    ),
    fill(
      smooth(
        gun([
          [-1.55, -0.95],
          [-0.2, -0.78],
          [1.15, -0.9],
          [1.2, -0.72, 0],
          [-0.2, -0.58],
          [-1.35, -0.75],
        ]),
      ),
      'gunLo',
    ),
    inked(ellipseIn(-0.15, -1.5, 0.9, 0.45), 'laser', 'laserLine', 0.07),
    fill(ellipseIn(-0.4, -1.62, 0.42, 0.14), 'laserHi'),
    fill(ellipseIn(-0.95, -2.0, 0.3, 0.12), 'gunHi'),
  ];
}

/** An ellipse at gun-space (x, y), its `rx` along the barrel. */
function ellipseIn(x: number, y: number, rx: number, ry: number): string {
  return ellipse(-y, H + x, ry, rx);
}

// ---------------------------------------------------------------------------------------------------------
// Coin Magnet: a red horseshoe magnet gripped by its bend in the near fist, prongs forward, silver poles at the tips.
// Drawn in gun space, like the ray gun.

/** The point between the pole tips in gun space, where the coins arrive. */
export const MAGNET_POLES: readonly [number, number] = [4.5, 0];

/** The horseshoe: outer edge round the bend from the top tip to the bottom tip, then back along the inner edge. */
const HORSESHOE: P[] = [
  [4.5, -1.75, 0],
  [2.4, -1.8],
  [0.8, -1.7],
  [-0.2, -1.32],
  [-0.72, -0.62],
  [-0.85, 0],
  [-0.72, 0.62],
  [-0.2, 1.32],
  [0.8, 1.7],
  [2.4, 1.8],
  [4.5, 1.75, 0],
  [4.5, 0.62, 0],
  [2.4, 0.62],
  [1.55, 0.55],
  [1.1, 0.32],
  [0.95, 0],
  [1.1, -0.32],
  [1.55, -0.55],
  [2.4, -0.62],
  [4.5, -0.62, 0],
];

function magnetShapes(): PathShape[] {
  const pole = (y0: number, y1: number): PathShape[] => [
    inked(
      poly(
        gun([
          [3.45, y0],
          [4.5, y0],
          [4.5, y1],
          [3.45, y1],
        ]),
      ),
      'gun',
      'gunLine',
      0.09,
    ),
    fill(
      poly(
        gun([
          [3.55, y0 + 0.14],
          [4.4, y0 + 0.14],
          [4.4, y0 + 0.32],
          [3.55, y0 + 0.32],
        ]),
      ),
      'gunHi',
    ),
  ];
  return [
    inked(smooth(gun(HORSESHOE)), 'magnet', 'magnetLine'),
    // Shade along the lower edge of each prong and round the bend's underside.
    fill(
      smooth(
        gun([
          [3.45, 1.75, 0],
          [2.4, 1.8],
          [0.8, 1.7],
          [-0.2, 1.32],
          [-0.72, 0.62],
          [-0.5, 0.62],
          [0.1, 1.12],
          [0.9, 1.42],
          [2.4, 1.45],
          [3.45, 1.4, 0],
        ]),
      ),
      'magnetLo',
    ),
    fill(
      smooth(
        gun([
          [3.45, -0.62, 0],
          [2.4, -0.62],
          [1.55, -0.55],
          [1.75, -0.86],
          [2.4, -0.92],
          [3.45, -0.92, 0],
        ]),
      ),
      'magnetLo',
    ),
    fill(
      smooth(
        gun([
          [0.9, -1.5],
          [2.6, -1.58],
          [2.6, -1.4],
          [0.9, -1.3],
        ]),
      ),
      'magnetHi',
    ),
    ...pole(-1.75, -0.62),
    ...pole(0.62, 1.75),
  ];
}

/** Muzzle flash, drawn in fx space at the muzzle: a cyan burst with a long spike along +x and a white core. */
export const muzzleFlash: PathShape[] = [
  inked(
    smooth(
      [
        [-0.35, -0.55, 0],
        [0.15, -1.05, 0],
        [0.45, -0.45, 0],
        [2.4, 0, 0],
        [0.45, 0.45, 0],
        [0.15, 1.05, 0],
        [-0.35, 0.55, 0],
        [-0.15, 0, 0],
      ],
      true,
    ),
    'laser',
    'laserLine',
    0.07,
  ),
  fill(ellipse(0.25, 0, 0.5, 0.36), 'laserHi'),
];

/**
 * The laser bolt, in its own space: its head (the hit's centre) on the origin, a flat-ended streak trailing back
 * 6 units to -x, with a white core. Two frames flicker the glow.
 */
function bolt(glow: number): PathShape[] {
  return [
    inked(
      smooth([
        [0.95, 0],
        [0.55, -0.72 * glow],
        [-2.5, -0.62 * glow, 0],
        [-6, -0.3, 0],
        [-6, 0.3, 0],
        [-2.5, 0.62 * glow, 0],
        [0.55, 0.72 * glow],
      ]),
      'laser',
      'laserLine',
      0.09,
    ),
    fill(
      smooth([
        [0.6, 0],
        [0.3, -0.3],
        [-2.6, -0.24, 0],
        [-5.2, -0.1, 0],
        [-5.2, 0.1, 0],
        [-2.6, 0.24, 0],
        [0.3, 0.3],
      ]),
      'laserHi',
    ),
  ];
}

export const laserBolt = { laserBolt0: bolt(1), laserBolt1: bolt(0.85) };

/**
 * Upgraded Laser's bolt, in its own space: a big round head (the hit's centre on the origin) on a fat streak trailing
 * back 11 units, a white core and a coin-gold rim. Half as tall as the 5.5 hit radius, as the laser's bolt is to its
 * 1.44. Two frames flicker the glow.
 */
function megaBolt(glow: number): PathShape[] {
  return [
    inked(
      smooth([
        [3.3, 0],
        [2.5, -2.5 * glow],
        [0, -2.85 * glow],
        [-4.5, -1.7 * glow, 0],
        [-11, -0.5, 0],
        [-11, 0.5, 0],
        [-4.5, 1.7 * glow, 0],
        [0, 2.85 * glow],
        [2.5, 2.5 * glow],
      ]),
      'laser',
      'coinLo',
      0.2,
    ),
    fill(
      smooth([
        [2.3, 0],
        [1.5, -1.45 * glow],
        [-1.5, -1.3 * glow],
        [-8.5, -0.2, 0],
        [-8.5, 0.2, 0],
        [-1.5, 1.3 * glow],
        [1.5, 1.45 * glow],
      ]),
      'laserHi',
    ),
  ];
}

export const megaLaserBolt = { megaBolt0: megaBolt(1), megaBolt1: megaBolt(0.88) };

export const parts: Record<string, Part> = {
  upperArm: upperArm(NEAR),
  upperArmFar: upperArm(FAR),
  fist: forearm(NEAR, fistShapes()),
  fistFar: forearm(FAR, fistShapes()),
  palm: forearm(NEAR, palmShapes()),
  palmFar: forearm(FAR, palmShapes()),
  gun: forearm(NEAR, [...gunShapes(), ...fistShapes()]),
  magnet: forearm(NEAR, [...magnetShapes(), ...fistShapes()]),
  thigh: legTube(NEAR, THIGH, 0.84, 0.66),
  thighFar: legTube(FAR, THIGH, 0.84, 0.66),
  shin: legTube(NEAR, SHIN - 0.35, 0.66, 0.54),
  shinFar: legTube(FAR, SHIN - 0.35, 0.66, 0.54),
};

export const boots = { boot: boot(NEAR), bootFar: boot(FAR) };

// ---------------------------------------------------------------------------------------------------------
// Strike effects, drawn in the effect bones' space.

/** Impact burst: an eight-point white star with a yellow core, radius 1 at scale 1. */
export const impact: PathShape[] = [
  inked(star(0, 0, 1, 0.46, 8, -90), 'hit', 'hitLine', 0.06),
  fill(star(0, 0, 0.6, 0.3, 8, -68), 'hitHi'),
];

/**
 * A motion smear: its blunt front edge on the origin, tapering to a point at x = 1 and fading out, half-width 1.
 * Scale x by the trail's length and y by its half-width.
 */
export const smear: PathShape[] = [
  {
    d: smooth([
      [0, -1, 0],
      [0.35, -0.72],
      [1, 0, 0],
      [0.35, 0.72],
      [0, 1, 0],
      [-0.05, 0],
    ]),
    fill: {
      type: 'linear',
      x0: 0,
      y0: 0,
      x1: 1,
      y1: 0,
      stops: [
        { offset: 0, color: 'smear', alpha: 0.9 },
        { offset: 0.55, color: 'smear', alpha: 0.45 },
        { offset: 1, color: 'smear', alpha: 0 },
      ],
    },
  },
  {
    d: smooth([
      [0, -0.4, 0],
      [0.5, -0.2],
      [0.8, 0, 0],
      [0.5, 0.2],
      [0, 0.4, 0],
    ]),
    fill: {
      type: 'linear',
      x0: 0,
      y0: 0,
      x1: 0.8,
      y1: 0,
      stops: [
        { offset: 0, color: 'smearHi', alpha: 0.9 },
        { offset: 1, color: 'smearHi', alpha: 0 },
      ],
    },
  },
];

const ARC: P[] = [];
for (let i = 0; i <= 10; i++) {
  const a = ((-150 + i * 15) * Math.PI) / 180;
  ARC.push([Math.cos(a), Math.sin(a)]);
}
for (let i = 10; i >= 0; i--) {
  const a = ((-150 + i * 15) * Math.PI) / 180;
  const r = 1 - 0.42 * (i / 10) ** 1.5;
  ARC.push([Math.cos(a) * r, Math.sin(a) * r]);
}

/** A swing swoosh: a crescent around the unit circle from -150 deg (thin tail) to 0 deg (thick head), clockwise. */
export const swoosh: PathShape[] = [
  { d: poly(ARC), fill: 'smear', stroke: { color: 'smearLine', width: 0.03 } },
  {
    d: poly(ARC.map(([x, y], i) => (i <= 10 ? [x * 0.93, y * 0.93] : [x * 1.02, y * 1.02]))),
    fill: 'smearHi',
  },
];
