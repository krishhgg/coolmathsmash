import type { PathShape } from '../../../render/rig/types';
import {
  arcPoints,
  bezier,
  ellipse,
  inflate,
  place,
  poly,
  smooth,
  star,
  strokes,
  tube,
  type P,
} from './shapes';

/**
 * The Raft Wars kids' parts: two kids of our own design, drawn by hand in the flat Flash cartoon look of the late
 * 2000s. The big kid wades inside a striped pool ring, a yellow bucket hat on his head and a homemade tennis-ball
 * launcher on a strap; his little brother, in a red life vest and swim goggles, rides on the back of the ring.
 * Flat fills, one darker shade shape on the side away from the light (top left), at most one highlight, and a
 * thick dark ink outline drawn as a shape under each fill. Every part sits around its bone's origin, facing
 * right, y down, in rig units (the pair stands 13 tall).
 */

/** Ink width of body outlines, and of face details. */
export const LINE = 0.26;
export const INK = 0.15;

const fill = (d: string, color: string): PathShape => ({ d, fill: color });
const inked = (d: string, color: string, width = INK): PathShape => ({
  d,
  fill: color,
  stroke: { color: 'line', width },
});
/** A closed outline as an ink underlay and its fill. */
const solid = (pts: readonly P[], color: string): PathShape[] => [
  fill(smooth(inflate(pts, LINE)), 'line'),
  fill(smooth(pts), color),
];

// ---------------------------------------------------------------------------------------------------------
// The big kid's head, in head space: the origin is where the chin meets the neck, up is -y. A round kid's head
// seen three-quarters from the front, a button nose on the profile and the ear at the back.

const HEAD: P[] = [
  [-2.15, -3.3],
  [-2.35, -2.25],
  [-2.05, -1.15],
  [-1.3, -0.25],
  [-0.1, 0.15],
  [1.25, 0.0],
  [2.15, -0.6],
  [2.55, -1.35],
  [2.7, -2.1],
  [2.72, -3.1],
  [2.2, -4.25],
  [0.9, -4.8],
  [-0.6, -4.75],
  [-1.7, -4.15],
];
/** The shade under the jaw, away from the light. */
const JAW_SHADE: P[] = [
  [-2.0, -1.2],
  [-1.3, -0.25],
  [-0.1, 0.15],
  [1.25, 0.0],
  [2.15, -0.6],
  [2.45, -1.1],
  [1.7, -0.55],
  [0.6, -0.3],
  [-0.5, -0.4],
  [-1.4, -0.75],
];
/** Brown hair sticking out under the back of the hat in three tufts. */
const HAIR: P[] = [
  [-1.2, -3.55, 0],
  [-2.25, -3.6],
  [-2.5, -3.0],
  [-2.55, -2.25, 0],
  [-2.05, -2.55],
  [-2.1, -1.75, 0],
  [-1.6, -2.3],
  [-1.25, -1.95, 0],
  [-1.15, -2.9],
];

const ear: PathShape[] = [
  inked(ellipse(-0.85, -2.05, 0.5, 0.66), 'skin', LINE * 0.7),
  ...strokes(bezier([-0.7, -2.45], [-1.15, -2.4], [-1.15, -1.7], [-0.75, -1.65], 5), INK, 'skinLo'),
];

export const head: PathShape[] = [
  ...solid(HEAD, 'skin'),
  fill(smooth(JAW_SHADE), 'skinLo'),
  ...ear,
  ...solid(HAIR, 'hair'),
  fill(ellipse(-0.6, -3.7, 0.55, 0.28), 'skinHi'),
];

/** The button nose sitting on the profile, drawn over the eyes. */
const nose: PathShape[] = [
  inked(ellipse(2.62, -1.95, 0.44, 0.38), 'skin', INK),
  fill(ellipse(2.72, -1.84, 0.2, 0.14), 'skinLo'),
];
const freckles: PathShape[] = [
  [0.45, -1.6],
  [0.72, -1.42],
  [0.3, -1.32],
  [2.1, -1.55],
].map(([x, y]) => fill(ellipse(x!, y!, 0.075), 'freckle'));

/** Eyes: the near one (left on screen) a little rounder than the far one. */
const EYES: [number, number, number, number][] = [
  [0.95, -2.45, 0.46, 0.6],
  [2.0, -2.55, 0.36, 0.55],
];

function eyes(look: [number, number] = [0.14, 0.06], squash = 1): PathShape[] {
  return EYES.flatMap(([x, y, rx, ry]) => [
    inked(ellipse(x, y, rx, ry * squash), 'eye'),
    fill(ellipse(x + look[0], y + look[1] * squash, rx * 0.5, ry * 0.52 * squash), 'pupil'),
    fill(ellipse(x + look[0] - rx * 0.18, y + (look[1] - ry * 0.22) * squash, rx * 0.16), 'eye'),
  ]);
}

/** Shut eyes as smiling arcs of ink. */
const shutEyes: PathShape[] = EYES.flatMap(([x, y, rx]) =>
  strokes(bezier([x - rx, y], [x - rx * 0.4, y + 0.35], [x + rx * 0.4, y + 0.35], [x + rx, y], 5), INK * 1.5),
);

/** Squeezed shut in pain: a ">" and a "<" of ink. */
const squint: PathShape[] = [
  ...strokes(
    [
      [0.6, -2.85],
      [1.25, -2.45],
      [0.6, -2.1],
    ],
    INK * 1.6,
  ),
  ...strokes(
    [
      [2.35, -2.9],
      [1.8, -2.5],
      [2.35, -2.15],
    ],
    INK * 1.6,
  ),
];

/** Spiral eyes for dizzy. */
const spiral = (cx: number, cy: number, r: number): PathShape[] =>
  strokes(
    Array.from({ length: 13 }, (_, i): P => {
      const a = (i / 12) * Math.PI * 3.2;
      const rr = r * (0.15 + (0.85 * i) / 12);
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    }),
    INK * 1.1,
  );
const dizzyEyes: PathShape[] = [
  ...EYES.map(([x, y, rx, ry]) => inked(ellipse(x, y, rx, ry), 'eye')),
  ...spiral(0.95, -2.45, 0.38),
  ...spiral(2.0, -2.55, 0.3),
];

/** Brows peeking out under the hat brim, slanted down towards the nose (angry) or up (worried). */
const brows = (tilt: number): PathShape[] => [
  ...strokes(
    [
      [0.5, -3.05 - tilt],
      [1.35, -3.05 + tilt],
    ],
    INK * 1.7,
  ),
  ...strokes(
    [
      [1.7, -3.12 + tilt],
      [2.35, -3.12 - tilt],
    ],
    INK * 1.7,
  ),
];

/** The big open grin: teeth along the top, a tongue at the bottom. */
const GRIN: P[] = [
  [0.95, -1.15, 0],
  [1.6, -1.1],
  [2.35, -1.3, 0],
  [2.1, -0.75],
  [1.55, -0.5],
  [1.15, -0.7],
];
const grin: PathShape[] = [
  inked(smooth(GRIN), 'mouth'),
  fill(
    smooth([
      [1.05, -1.12, 0],
      [1.6, -1.06],
      [2.25, -1.25, 0],
      [2.15, -1.08],
      [1.6, -0.92],
      [1.15, -0.98],
    ]),
    'teeth',
  ),
  fill(ellipse(1.6, -0.68, 0.35, 0.16), 'tongue'),
];

/** A shout: the mouth wide open in an O. */
const shout: PathShape[] = [
  inked(ellipse(1.65, -0.85, 0.48, 0.5), 'mouth'),
  fill(ellipse(1.65, -0.58, 0.3, 0.18), 'tongue'),
];

/** A closed smile line. */
const smile: PathShape[] = strokes(
  bezier([1.0, -1.1], [1.4, -0.7], [1.95, -0.7], [2.3, -1.15], 6),
  INK * 1.4,
);
/** A wobbly hurt mouth. */
const wobble: PathShape[] = [
  inked(
    smooth([
      [1.0, -0.85],
      [1.35, -1.1],
      [1.7, -0.85],
      [2.05, -1.1],
      [2.3, -0.85],
      [1.95, -0.6],
      [1.65, -0.7],
      [1.3, -0.6],
    ]),
    'mouth',
  ),
];
/** Gritted teeth for effort: a white bar crossed by tooth lines. */
const gritted: PathShape[] = [
  inked(
    smooth([
      [1.0, -1.15, 0],
      [2.3, -1.25, 0],
      [2.2, -0.7, 0],
      [1.1, -0.65, 0],
    ]),
    'teeth',
  ),
  ...strokes(
    [
      [1.05, -0.93],
      [2.25, -0.97],
    ],
    INK * 0.8,
  ),
  ...[1.45, 1.85].flatMap((x) =>
    strokes(
      [
        [x, -1.17],
        [x, -0.7],
      ],
      INK * 0.7,
    ),
  ),
];

const face = (...layers: PathShape[][]): PathShape[] => [...layers.flat(), ...nose, ...freckles];

export const faces: Record<string, PathShape[]> = {
  face: face(eyes(), grin),
  faceBlink: face(shutEyes, grin),
  faceSmile: face(eyes([0.16, 0.1]), smile),
  faceHappy: face(shutEyes, shout),
  faceShout: face(eyes([0.2, -0.04]), brows(0.12), shout),
  faceGrit: face(eyes([0.2, 0.02], 0.8), brows(0.2), gritted),
  faceHurt: face(squint, wobble),
  faceScared: face(eyes([0.05, -0.12], 1.08), brows(-0.15), shout),
  faceDizzy: face(dizzyEyes, wobble),
  faceUp: face(eyes([0.12, -0.24]), grin),
};

// ---------------------------------------------------------------------------------------------------------
// The bucket hat, in head space.

const CROWN: P[] = [
  [-1.95, -3.45],
  [-1.85, -4.6],
  [-1.3, -5.45],
  [0.25, -5.82],
  [1.85, -5.5],
  [2.35, -4.6],
  [2.4, -3.5],
];
const BRIM: P[] = [
  [-2.95, -3.35],
  [-2.55, -3.8],
  [-1.2, -3.98],
  [0.6, -3.98],
  [2.4, -3.82],
  [3.3, -3.45],
  [3.55, -3.0],
  [3.05, -2.95],
  [1.8, -3.22],
  [0.4, -3.3],
  [-1.2, -3.28],
  [-2.6, -3.05],
];

export const hat: PathShape[] = [
  ...solid(CROWN, 'hat'),
  fill(
    smooth([
      [1.35, -5.6],
      [2.35, -4.6],
      [2.4, -3.6],
      [1.75, -3.6],
      [1.85, -4.65],
    ]),
    'hatLo',
  ),
  fill(ellipse(-0.55, -5.15, 0.6, 0.3), 'hatHi'),
  fill(
    smooth([
      [-1.93, -3.6, 0],
      [0.2, -3.72],
      [2.39, -3.62, 0],
      [2.36, -4.15, 0],
      [0.2, -4.27],
      [-1.88, -4.17, 0],
    ]),
    'hatBand',
  ),
  ...solid(BRIM, 'hat'),
  fill(
    smooth([
      [3.4, -3.25],
      [3.55, -3.0],
      [3.05, -2.95],
      [1.8, -3.22],
      [0.4, -3.3],
      [-1.2, -3.28],
      [-2.6, -3.05],
      [-2.3, -3.35],
      [-1.0, -3.5],
      [0.5, -3.52],
      [2.0, -3.45],
    ]),
    'hatLo',
  ),
];

// ---------------------------------------------------------------------------------------------------------
// The big kid's torso, in torso space: the origin is the middle of his hips. A teal tee with a white stripe and
// the launcher's brown strap across it, over navy swim trunks.

const SHIRT: P[] = [
  [-1.3, -2.8],
  [-0.55, -3.1],
  [0.85, -3.15],
  [1.7, -2.85],
  [2.05, -2.0],
  [2.2, -1.0],
  [2.05, -0.15],
  [0.4, 0.15],
  [-1.25, 0.0],
  [-1.6, -1.0],
  [-1.6, -2.1],
];
const SHORTS: P[] = [
  [-1.5, -0.5],
  [2.0, -0.45],
  [2.12, 0.55],
  [1.45, 0.98],
  [0.5, 0.82],
  [-0.25, 0.98],
  [-1.55, 0.8],
];

export const torso: PathShape[] = [
  ...solid(SHORTS, 'shorts'),
  fill(
    smooth([
      [1.6, -0.4],
      [2.12, 0.55],
      [1.45, 0.98],
      [1.0, 0.85],
      [1.35, 0.2],
    ]),
    'shortsLo',
  ),
  ...solid(SHIRT, 'shirt'),
  fill(
    smooth([
      [1.3, -2.95],
      [1.7, -2.85],
      [2.05, -2.0],
      [2.2, -1.0],
      [2.05, -0.15],
      [1.3, -0.05],
      [1.6, -1.0],
      [1.55, -2.1],
    ]),
    'shirtLo',
  ),
  fill(
    smooth([
      [-1.6, -2.05, 0],
      [0.3, -1.95],
      [2.08, -1.88, 0],
      [2.12, -1.5, 0],
      [0.3, -1.55],
      [-1.6, -1.65, 0],
    ]),
    'stripe',
  ),
  ...strokes(bezier([0.1, -3.05], [0.35, -2.8], [0.75, -2.8], [1.05, -3.05], 4), INK * 1.2, 'shirtLo'),
  fill(
    poly([
      [-1.1, -3.0],
      [-0.7, -3.12],
      [2.05, -0.55],
      [1.95, -0.2],
    ]),
    'strap',
  ),
];

// ---------------------------------------------------------------------------------------------------------
// Limbs hang from their bone's origin down the +y axis. Each segment is two symbols: the ink, drawn in a slot
// behind both segments of the limb so elbows and knees have no seam, and the fill.

export interface Part {
  line: PathShape[];
  fill: PathShape[];
}

export const UPPER_ARM = 1.7;
/** Elbow to the centre of the hand. */
export const FORE_ARM = 1.55;
export const THIGH = 1.85;
/** Knee to ankle; the sole is `ANKLE` below the ankle. */
export const SHIN = 1.8;
export const ANKLE = 0.5;

/** Colour keys for a limb: near limbs in the bright colours, far ones in the shaded set. */
interface Tone {
  skin: string;
  lo: string;
  shirt: string;
}
const NEAR: Tone = { skin: 'skin', lo: 'skinLo', shirt: 'shirt' };
const FAR: Tone = { skin: 'skinFar', lo: 'skinLo', shirt: 'shirtFar' };

/** Upper arm: a skin tube under a short teal sleeve. */
function upperArm(t: Tone): Part {
  const sleeve: P[] = [
    [-0.66, -0.25],
    [0.0, -0.6],
    [0.66, -0.25],
    [0.62, 0.85, 0],
    [-0.62, 0.85, 0],
  ];
  return {
    line: [
      fill(tube(0, 0, UPPER_ARM, 0.44 + LINE, 0.38 + LINE), 'line'),
      fill(smooth(inflate(sleeve, LINE)), 'line'),
    ],
    fill: [
      fill(tube(0, 0, UPPER_ARM, 0.44, 0.38), t.skin),
      fill(tube(0.22, 0.8, UPPER_ARM, 0.16, 0.14), t.lo),
      fill(smooth(sleeve), t.shirt),
    ],
  };
}

/** Hand shapes are drawn around the hand point (0, FORE_ARM). */
const H = FORE_ARM;
const FIST: P[] = place(
  [
    [-0.5, -0.45],
    [0.35, -0.55],
    [0.62, -0.1],
    [0.55, 0.4],
    [0.05, 0.58],
    [-0.45, 0.4],
    [-0.6, -0.05],
  ],
  0,
  H,
);
const MITTEN: P[] = place(
  [
    [-0.45, -0.5],
    [0.4, -0.5],
    [0.62, 0.1],
    [0.55, 0.75],
    [0.15, 0.95],
    [-0.35, 0.8],
    [-0.55, 0.3],
    [-0.85, 0.05],
    [-0.8, -0.25],
  ],
  0,
  H,
);

function hand(pts: readonly P[], t: Tone, thumb: boolean): PathShape[] {
  return [
    fill(smooth(pts), t.skin),
    fill(ellipse(0.25, H + 0.2, 0.22, 0.3), t.lo),
    ...(thumb
      ? strokes(bezier([-0.35, H - 0.1], [-0.1, H - 0.25], [0.15, H - 0.2], [0.3, H - 0.05], 4), INK)
      : []),
  ];
}

function forearm(t: Tone, pts: readonly P[], thumb: boolean): Part {
  const end = FORE_ARM - 0.4;
  return {
    line: [fill(tube(0, 0, end, 0.38 + LINE, 0.33 + LINE), 'line'), fill(smooth(inflate(pts, LINE)), 'line')],
    fill: [fill(tube(0, 0, end, 0.38, 0.33), t.skin), ...hand(pts, t, thumb)],
  };
}

function legTube(t: Tone, len: number, r0: number, r1: number): Part {
  return {
    line: [fill(tube(0, 0, len, r0 + LINE, r1 + LINE), 'line')],
    fill: [
      fill(tube(0, 0, len, r0, r1), t.skin),
      fill(tube(r0 * 0.45, len * 0.15, len * 0.9, r0 * 0.32, r1 * 0.3), t.lo),
    ],
  };
}

/** A white sneaker with a blue sole, in foot space: ankle at the origin, sole at `ANKLE`, toe along +x. */
const SHOE: P[] = [
  [-0.55, -0.3],
  [0.3, -0.35],
  [0.7, -0.05],
  [1.3, 0.12],
  [1.62, 0.38],
  [1.5, ANKLE + 0.06, 0],
  [-0.6, ANKLE + 0.06, 0],
  [-0.72, 0.2],
];
function shoe(far: boolean): PathShape[] {
  return [
    ...solid(SHOE, far ? 'shoeLo' : 'shoe'),
    fill(
      smooth([
        [-0.66, ANKLE - 0.12, 0],
        [1.58, ANKLE - 0.12, 0],
        [1.5, ANKLE + 0.06, 0],
        [-0.6, ANKLE + 0.06, 0],
      ]),
      'sole',
    ),
    ...strokes(
      [
        [0.45, -0.05],
        [0.9, 0.15],
      ],
      INK,
      'hatBand',
    ),
    fill(ellipse(-0.15, -0.3, 0.42, 0.14), 'sock'),
  ];
}

export const parts: Record<string, Part> = {
  upperArm: upperArm(NEAR),
  upperArmFar: upperArm(FAR),
  fist: forearm(NEAR, FIST, true),
  fistFar: forearm(FAR, FIST, true),
  mitten: forearm(NEAR, MITTEN, false),
  mittenFar: forearm(FAR, MITTEN, false),
  thigh: legTube(NEAR, THIGH, 0.56, 0.46),
  thighFar: legTube(FAR, THIGH, 0.56, 0.46),
  shin: legTube(NEAR, SHIN - 0.25, 0.46, 0.36),
  shinFar: legTube(FAR, SHIN - 0.25, 0.46, 0.36),
};

export const shoes = { shoe: shoe(false), shoeFar: shoe(true) };
/** Ankle to the bottom of the sole's ink: how high the ankle sits when the sneaker stands flat on the floor. */
export const SOLE = ANKLE + 0.06 + LINE;

// ---------------------------------------------------------------------------------------------------------
// The pool ring, in ring space: centred on the origin, seen a little from above. `ringBack` is the whole ring,
// drawn behind the kids; `ringFront` redraws its near band over the big kid's belly, with its ink only along the
// edges so the two halves meet without a seam.

export const RING_RX = 3.75;
export const RING_RY = 1.45;
const HOLE: [number, number, number, number] = [0, -0.28, 2.15, 0.52];
/** Centre angles of the white stripes, degrees clockwise from +x (90 is the near side). */
const STRIPES = [35, 90, 145, 215, 270, 325];
const STRIPE_HALF = 13;

/** The ring's band between angles a0 and a1, as one closed shape. */
function band(a0: number, a1: number): string {
  const outer = arcPoints(0, 0, RING_RX, RING_RY, a0, a1, 10);
  const inner = arcPoints(HOLE[0], HOLE[1], HOLE[2], HOLE[3], a1, a0, 10);
  return poly([...outer, ...inner]);
}

const ringShade = (a0: number, a1: number) =>
  poly([
    ...arcPoints(0, 0, RING_RX, RING_RY, a0, a1, 10),
    ...arcPoints(0, 0.08, RING_RX - 0.35, RING_RY - 0.45, a1, a0, 10),
  ]);

export const ringBack: PathShape[] = [
  fill(
    ellipse(0, 0, RING_RX + LINE, RING_RY + LINE) + ellipse(HOLE[0], HOLE[1], HOLE[2] - LINE, HOLE[3] - LINE),
    'line',
  ),
  fill(ellipse(0, 0, RING_RX, RING_RY) + ellipse(HOLE[0], HOLE[1], HOLE[2], HOLE[3]), 'ring'),
  ...STRIPES.map((a) => fill(band(a - STRIPE_HALF, a + STRIPE_HALF), 'ringStripe')),
  fill(ringShade(12, 168), 'ringLo'),
];

export const ringFront: PathShape[] = [
  fill(band(-4, 184), 'ring'),
  ...STRIPES.filter((a) => a < 180).map((a) => fill(band(a - STRIPE_HALF, a + STRIPE_HALF), 'ringStripe')),
  fill(ringShade(12, 168), 'ringLo'),
  fill(ellipse(-2.35, 0.42, 0.55, 0.15), 'ringHi'),
  ...strokes(arcPoints(0, 0, RING_RX + LINE / 2, RING_RY + LINE / 2, -4, 184, 18), LINE),
  ...strokes(arcPoints(HOLE[0], HOLE[1], HOLE[2] - LINE / 2, HOLE[3] - LINE / 2, 8, 172, 14), LINE),
];

// ---------------------------------------------------------------------------------------------------------
// The tennis-ball launcher, in gun space: the origin is the pivot above the rear grip, the barrel along +x. A
// green pipe with a ball hopper on top, a rear pistol grip and a front handle.

/** Rear (trigger) and front grips, gun space; the hands IK onto these. */
export const GRIP_REAR: [number, number] = [-0.55, 0.8];
export const GRIP_FRONT: [number, number] = [1.55, 0.7];
export const MUZZLE: [number, number] = [3.25, 0];

const BARREL: P[] = [
  [-1.75, -0.48, 0],
  [3.0, -0.48, 0],
  [3.0, 0.48, 0],
  [-1.75, 0.48, 0],
  [-1.95, 0.0],
];

export const gun: PathShape[] = [
  ...solid(
    [
      [-0.85, 0.3, 0],
      [-0.2, 0.3, 0],
      [-0.35, 1.35],
      [-0.75, 1.42],
      [-0.95, 1.2],
    ],
    'grip',
  ),
  ...solid(
    [
      [1.3, 0.3, 0],
      [1.8, 0.3, 0],
      [1.75, 1.05],
      [1.35, 1.1],
    ],
    'grip',
  ),
  ...solid(BARREL, 'gun'),
  fill(
    poly([
      [-1.75, 0.18],
      [3.0, 0.18],
      [3.0, 0.48],
      [-1.75, 0.48],
    ]),
    'gunLo',
  ),
  fill(
    poly([
      [-1.4, -0.36],
      [2.6, -0.36],
      [2.6, -0.22],
      [-1.4, -0.22],
    ]),
    'gunHi',
  ),
  ...solid(
    [
      [2.85, -0.66, 0],
      [3.38, -0.66, 0],
      [3.38, 0.66, 0],
      [2.85, 0.66, 0],
    ],
    'gunLo',
  ),
  fill(ellipse(3.38, 0, 0.12, 0.42), 'line'),
  ...solid(
    [
      [-0.65, -0.4, 0],
      [0.75, -0.4, 0],
      [0.82, -1.25, 0],
      [-0.72, -1.25, 0],
    ],
    'gunLo',
  ),
  inked(ellipse(0.05, -1.42, 0.58, 0.5), 'ball', INK),
  ...strokes(bezier([-0.45, -1.62], [-0.1, -1.28], [0.2, -1.28], [0.55, -1.62], 5), INK * 0.8, 'ballSeam'),
  inked(ellipse(-1.25, -0.62, 0.22, 0.2), 'hatBand', INK * 0.7),
];

// ---------------------------------------------------------------------------------------------------------
// The little brother, riding on the back of the ring. Body space: the origin is his seat; head space: the
// origin is his neck. He looks out towards the camera.

const VEST: P[] = [
  [-1.0, -1.85],
  [-0.3, -2.05],
  [0.55, -2.05],
  [1.1, -1.8],
  [1.25, -0.9],
  [1.15, 0.0],
  [0.0, 0.2],
  [-1.05, 0.05],
  [-1.25, -0.9],
];
export const broBody: PathShape[] = [
  ...solid(VEST, 'vest'),
  fill(
    smooth([
      [0.6, -1.95],
      [1.1, -1.8],
      [1.25, -0.9],
      [1.15, 0.0],
      [0.55, 0.1],
      [0.8, -0.9],
    ]),
    'vestLo',
  ),
  ...[-0.35, 0.45].flatMap((x) =>
    strokes(
      [
        [x, -1.85],
        [x + 0.05, 0.05],
      ],
      INK,
      'vestLo',
    ),
  ),
  fill(
    poly([
      [-1.2, -0.95],
      [1.22, -0.95],
      [1.22, -0.68],
      [-1.2, -0.68],
    ]),
    'line',
  ),
  inked(ellipse(0.1, -0.82, 0.26, 0.2), 'buckle', INK * 0.6),
  fill(ellipse(-0.55, -1.45, 0.25, 0.32), 'vestHi'),
];

const BRO_HEAD: P[] = [
  [-1.55, -1.9],
  [-1.6, -1.0],
  [-1.15, -0.25],
  [-0.2, 0.05],
  [0.85, -0.1],
  [1.5, -0.7],
  [1.7, -1.45],
  [1.5, -2.35],
  [0.8, -2.95],
  [-0.3, -3.05],
  [-1.2, -2.6],
];
/** Ginger spikes. */
const BRO_HAIR: P[] = [
  [-1.4, -2.3],
  [-1.6, -3.1, 0],
  [-0.9, -2.95],
  [-0.65, -3.7, 0],
  [-0.1, -3.15],
  [0.45, -3.75, 0],
  [0.7, -3.05],
  [1.45, -3.3, 0],
  [1.35, -2.5],
  [0.6, -2.7],
  [-0.5, -2.75],
];

export const broHead: PathShape[] = [
  ...solid(BRO_HEAD, 'skin'),
  fill(
    smooth([
      [-1.45, -0.6],
      [-0.2, 0.05],
      [0.85, -0.1],
      [1.5, -0.7],
      [0.8, -0.35],
      [-0.4, -0.25],
    ]),
    'skinLo',
  ),
  inked(ellipse(-1.25, -1.3, 0.36, 0.46), 'skin', INK),
  ...solid(BRO_HAIR, 'broHair'),
  ...strokes(
    [
      [-1.62, -2.08],
      [1.66, -2.22],
    ],
    0.34,
    'goggle',
  ),
  inked(ellipse(-0.25, -2.2, 0.44, 0.37), 'lens', INK * 1.2),
  inked(ellipse(0.78, -2.25, 0.4, 0.35), 'lens', INK * 1.2),
  fill(ellipse(-0.38, -2.32, 0.14, 0.1), 'lensHi'),
  fill(ellipse(0.66, -2.36, 0.12, 0.09), 'lensHi'),
];

const BRO_EYES: [number, number, number, number][] = [
  [-0.2, -1.35, 0.34, 0.42],
  [0.72, -1.4, 0.3, 0.4],
];
function broEyes(look: [number, number] = [0.1, 0.04], squash = 1): PathShape[] {
  return BRO_EYES.flatMap(([x, y, rx, ry]) => [
    inked(ellipse(x, y, rx, ry * squash), 'eye'),
    fill(ellipse(x + look[0], y + look[1] * squash, rx * 0.52, ry * 0.55 * squash), 'pupil'),
    fill(ellipse(x + look[0] - rx * 0.2, y + (look[1] - ry * 0.25) * squash, rx * 0.17), 'eye'),
  ]);
}
const broShut: PathShape[] = BRO_EYES.flatMap(([x, y, rx]) =>
  strokes(bezier([x - rx, y], [x - rx * 0.4, y + 0.28], [x + rx * 0.4, y + 0.28], [x + rx, y], 5), INK * 1.4),
);
const broSquint: PathShape[] = [
  ...strokes(
    [
      [-0.5, -1.65],
      [0.0, -1.35],
      [-0.5, -1.05],
    ],
    INK * 1.5,
  ),
  ...strokes(
    [
      [1.0, -1.7],
      [0.55, -1.4],
      [1.0, -1.1],
    ],
    INK * 1.5,
  ),
];
const broNose: PathShape[] = [inked(ellipse(1.15, -0.95, 0.24, 0.2), 'skin', INK)];
const broFreckles: PathShape[] = [
  [-0.65, -0.85],
  [-0.45, -0.7],
  [-0.75, -0.65],
].map(([x, y]) => fill(ellipse(x!, y!, 0.06), 'freckle'));
/** A gap-toothed grin. */
const broGrin: PathShape[] = [
  inked(
    smooth([
      [-0.1, -0.72, 0],
      [0.45, -0.68],
      [1.0, -0.8, 0],
      [0.75, -0.35],
      [0.4, -0.25],
      [0.05, -0.4],
    ]),
    'mouth',
  ),
  fill(
    poly([
      [0.0, -0.7],
      [0.32, -0.67],
      [0.32, -0.55],
      [0.04, -0.58],
    ]),
    'teeth',
  ),
  fill(
    poly([
      [0.52, -0.67],
      [0.92, -0.76],
      [0.86, -0.64],
      [0.52, -0.56],
    ]),
    'teeth',
  ),
];
const broShout: PathShape[] = [
  inked(ellipse(0.45, -0.5, 0.36, 0.36), 'mouth'),
  fill(ellipse(0.45, -0.3, 0.22, 0.12), 'tongue'),
];
const broWobble: PathShape[] = strokes(
  [
    [0.0, -0.5],
    [0.25, -0.65],
    [0.5, -0.5],
    [0.75, -0.65],
    [0.95, -0.5],
  ],
  INK * 1.3,
);

const broFace = (...layers: PathShape[][]): PathShape[] => [...layers.flat(), ...broNose, ...broFreckles];

export const broFaces: Record<string, PathShape[]> = {
  broFace: broFace(broEyes(), broGrin),
  broBlink: broFace(broShut, broGrin),
  broCheer: broFace(broShut, broShout),
  broShout: broFace(broEyes([0.14, -0.06]), broShout),
  broScared: broFace(broEyes([-0.05, -0.1], 1.1), broShout),
  broHurt: broFace(broSquint, broWobble),
  broUp: broFace(broEyes([0.06, -0.2]), broGrin),
};

/** Brother's limbs: one-piece arms (shoulder to mitten) and his near leg dangling over the ring. */
export const BRO_ARM = 1.45;
function broArm(far: boolean): Part {
  const skin = far ? 'skinFar' : 'skin';
  const mitt = ellipse(0, BRO_ARM, 0.36, 0.33);
  return {
    line: [
      fill(tube(0, 0, BRO_ARM - 0.3, 0.32 + LINE, 0.28 + LINE), 'line'),
      fill(ellipse(0, BRO_ARM, 0.36 + LINE, 0.33 + LINE), 'line'),
    ],
    fill: [
      fill(tube(0, 0, BRO_ARM - 0.3, 0.32, 0.28), skin),
      fill(mitt, skin),
      fill(ellipse(0.14, BRO_ARM + 0.1, 0.14, 0.18), 'skinLo'),
    ],
  };
}
export const BRO_LEG = 1.5;
const BRO_FOOT: P[] = [
  [-0.3, BRO_LEG - 0.25],
  [0.35, BRO_LEG - 0.15],
  [0.75, BRO_LEG + 0.12],
  [0.65, BRO_LEG + 0.38, 0],
  [-0.3, BRO_LEG + 0.38, 0],
  [-0.4, BRO_LEG + 0.1],
];
const broLeg: Part = {
  line: [
    fill(tube(0, 0, BRO_LEG, 0.36 + LINE, 0.3 + LINE), 'line'),
    fill(smooth(inflate(BRO_FOOT, LINE)), 'line'),
  ],
  fill: [
    fill(tube(0, 0, BRO_LEG, 0.36, 0.3), 'skin'),
    fill(tube(0.15, 0.2, BRO_LEG - 0.1, 0.12, 0.1), 'skinLo'),
    fill(smooth(BRO_FOOT), 'sandal'),
    fill(
      poly([
        [-0.3, BRO_LEG + 0.22],
        [0.7, BRO_LEG + 0.22],
        [0.65, BRO_LEG + 0.38],
        [-0.3, BRO_LEG + 0.38],
      ]),
      'sole',
    ),
  ],
};

export const broParts: Record<string, Part> = {
  broArm: broArm(false),
  broArmFar: broArm(true),
  broLeg,
};

// ---------------------------------------------------------------------------------------------------------
// The rocket for Rocket Ride, in rocket space: the origin is the middle of its tail, the nose up -y.

export const ROCKET_LEN = 7.3;
const R = 0.85;
export const rocket: PathShape[] = [
  ...solid(
    [
      [-R, -2.3, 0],
      [-1.85, -0.55],
      [-1.8, 0.25, 0],
      [-R, -0.35, 0],
    ],
    'rocketTrim',
  ),
  ...solid(
    [
      [R, -2.3, 0],
      [1.85, -0.55],
      [1.8, 0.25, 0],
      [R, -0.35, 0],
    ],
    'rocketTrim',
  ),
  ...solid(
    [
      [-0.55, -0.5, 0],
      [0.55, -0.5, 0],
      [0.62, 0.3, 0],
      [-0.62, 0.3, 0],
    ],
    'nozzle',
  ),
  ...solid(
    [
      [-R, -5.4, 0],
      [-0.72, -6.25],
      [0, -ROCKET_LEN, 0],
      [0.72, -6.25],
      [R, -5.4, 0],
    ],
    'rocketTrim',
  ),
  ...solid(
    [
      [-R, -5.45, 0],
      [R, -5.45, 0],
      [R, -0.35, 0],
      [-R, -0.35, 0],
    ],
    'rocket',
  ),
  ...[-1.1, -3.3].map((y) =>
    fill(
      poly([
        [-R, y],
        [R, y - 0.95],
        [R, y - 0.4],
        [-R, y + 0.55],
      ]),
      'rocketTrim',
    ),
  ),
  fill(
    poly([
      [0.35, -5.45],
      [R, -5.45],
      [R, -0.35],
      [0.35, -0.35],
    ]),
    'rocketLo',
  ),
  inked(star(-0.05, -4.55, 0.42, 0.18, 5), 'star', INK * 0.6),
  fill(ellipse(-0.45, -6.0, 0.13, 0.4), 'rocketHi'),
];

// ---------------------------------------------------------------------------------------------------------
// Effects, drawn in the effect bones' space (unit size at scale 1).

export const fxPuff: PathShape[] = [
  inked(ellipse(-0.75, 0.25, 0.7), 'puff', INK * 0.8),
  inked(ellipse(0.75, 0.3, 0.62), 'puff', INK * 0.8),
  inked(ellipse(0, 0, 1.0), 'puff', INK * 0.8),
  fill(ellipse(-0.3, -0.35, 0.35, 0.22), 'puffHi'),
];

export const fxSpeed: PathShape[] = [
  ...strokes(
    [
      [-1.6, -0.7],
      [0.9, -0.7],
    ],
    0.22,
    'puffLine',
  ),
  ...strokes(
    [
      [-1.0, 0.0],
      [1.4, 0.0],
    ],
    0.22,
    'puffLine',
  ),
  ...strokes(
    [
      [-1.8, 0.7],
      [0.6, 0.7],
    ],
    0.22,
    'puffLine',
  ),
];

export const fxStar: PathShape[] = [inked(star(0, 0, 1, 0.45, 5), 'star', INK)];

export const fxSpark: PathShape[] = [
  inked(star(0, 0, 1.2, 0.45, 8, -90), 'spark', INK * 0.8),
  fill(star(0, 0, 0.6, 0.25, 8, -67.5), 'star'),
];

export const fxSweat: PathShape[] = [
  inked(
    smooth([
      [0, -0.6, 0],
      [0.35, 0.05],
      [0, 0.4],
      [-0.35, 0.05],
    ]),
    'sweat',
    INK * 0.8,
  ),
];

/** A tennis ball, radius 1 at scale 1. */
export const fxBall: PathShape[] = [
  inked(ellipse(0, 0, 1), 'ball', INK * 1.4),
  ...strokes(bezier([-0.85, -0.5], [-0.2, -0.05], [-0.2, 0.45], [-0.6, 0.8], 6), 0.16, 'ballSeam'),
  ...strokes(bezier([0.85, 0.5], [0.2, 0.05], [0.2, -0.45], [0.6, -0.8], 6), 0.16, 'ballSeam'),
];

/** Rocket exhaust: a flame pointing down +y from the nozzle, two drawings for the flicker. */
const flame = (len: number, wide: number): PathShape[] => [
  fill(
    smooth([
      [-0.75 * wide, 0],
      [0, -0.35],
      [0.75 * wide, 0],
      [0.45 * wide, len * 0.5],
      [0, len, 0],
      [-0.45 * wide, len * 0.5],
    ]),
    'flame',
  ),
  fill(
    smooth([
      [-0.4 * wide, 0],
      [0.4 * wide, 0],
      [0.2 * wide, len * 0.35],
      [0, len * 0.6, 0],
      [-0.2 * wide, len * 0.35],
    ]),
    'flameCore',
  ),
];
export const fxFlames = { fxFlameA: flame(2.4, 1), fxFlameB: flame(1.9, 1.15) };
