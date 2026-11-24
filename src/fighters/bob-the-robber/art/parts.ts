import type { PathShape } from '../../../render/rig/types';
import { bands, blob, curve, ellipse, line, poly, sector, tube, type P } from './shapes';

/**
 * Bob the Robber's parts, drawn from scratch in the Coolmath port's style: flat fills, one shade and one
 * highlight per part, and a thick dark-brown ink line. Every part is in its own bone's space; limbs hang from
 * their bone's origin down +y, props (baton, taser, hook) point along +x from the grip.
 */

/** Ink line width around each part. */
export const LW = 0.26;
/** Extra radius of the ink tube behind each limb segment. */
const LIMB_LINE = 0.18;

const ink = (d: string, fill: PathShape['fill'], width = LW): PathShape => ({
  d,
  fill,
  stroke: { color: 'line', width },
});
const stroke = (d: string, width = 0.2, color = 'line'): PathShape => ({ d, stroke: { color, width } });
const fill = (d: string, color: PathShape['fill']): PathShape => ({ d, fill: color });

/** Rotates and moves points: `a` degrees clockwise, then by (x, y). */
const place = (points: readonly P[], a: number, x: number, y: number): P[] => {
  const c = Math.cos((a * Math.PI) / 180);
  const s = Math.sin((a * Math.PI) / 180);
  return points.map(([px, py]) => [px * c - py * s + x, px * s + py * c + y] as const);
};

/** A capsule between two points with radii r0 and r1, for sticks and props. */
export function capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): string {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const pts: P[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = a - Math.PI / 2 + (Math.PI * i) / 10;
    pts.push([x1 + r1 * Math.cos(t), y1 + r1 * Math.sin(t)]);
  }
  for (let i = 0; i <= 10; i++) {
    const t = a + Math.PI / 2 + (Math.PI * i) / 10;
    pts.push([x0 + r0 * Math.cos(t), y0 + r0 * Math.sin(t)]);
  }
  return poly(pts);
}

// ---------------------------------------------------------------------------------------------------------
// Head (head space: the centre of the face is the origin; the beanie's crown is 4.25 above it)

const FACE: P[] = [
  [0, -2.9],
  [2.2, -2.3],
  [3.08, -0.4],
  [2.85, 1.5],
  [1.7, 2.8],
  [0, 3.15],
  [-1.7, 2.8],
  [-2.85, 1.5],
  [-3.08, -0.4],
  [-2.2, -2.3],
];

const ear = (x: number, flip: number): PathShape[] => [
  ink(ellipse(x, 0.45, 0.72, 0.86), 'skin'),
  stroke(
    curve([
      [x + 0.3 * flip, 0.05],
      [x - 0.15 * flip, 0.35],
      [x + 0.05 * flip, 0.9],
    ]),
    0.16,
    'skinLo',
  ),
];

/** The bare head: face disc and ears, with a soft shadow under the jaw. */
export const headFront: PathShape[] = [
  ...ear(-3.0, 1),
  ...ear(3.0, -1),
  ink(blob(FACE), 'skin'),
  fill(
    blob([
      [-2.85, 1.0],
      [-1.7, 2.45],
      [0, 2.85],
      [1.7, 2.45],
      [2.85, 1.0],
      [1.8, 2.05],
      [0, 2.35],
      [-1.8, 2.05],
    ]),
    'skinLo',
  ),
  fill(ellipse(-1.9, 1.45, 0.55, 0.32), 'blush'),
  fill(ellipse(1.9, 1.45, 0.55, 0.32), 'blush'),
];

/** Three-quarter view facing right: only the back ear shows, the jaw shadow sits on the back cheek. */
export const head3q: PathShape[] = [
  ...ear(-3.0, 1),
  ink(blob(FACE), 'skin'),
  fill(
    blob([
      [-3.0, 0.0],
      [-2.6, 1.6],
      [-1.3, 2.7],
      [0.6, 3.05],
      [-0.7, 2.35],
      [-1.8, 1.5],
      [-2.35, 0.2],
    ]),
    'skinLo',
  ),
  fill(ellipse(-1.75, 1.45, 0.5, 0.3), 'blush'),
  fill(ellipse(2.35, 1.35, 0.45, 0.28), 'blush'),
];

type View = 'front' | '3q';

/** Where the features sit in each view. */
const LAYOUT = {
  front: { eyes: [-1.22, 1.22] as const, rx: [0.98, 0.98] as const, nose: 0, mouth: [-1.75, 1.95] as const },
  '3q': { eyes: [-0.82, 1.6] as const, rx: [0.86, 0.96] as const, nose: 0.82, mouth: [-1.45, 2.45] as const },
};
const EYE_Y = -0.62;
const EYE_RY = 0.76;

/** The eye mask: a band under the beanie's cuff with a bulge under each eye hole and a notch over the nose. */
function mask(view: View): PathShape {
  const [a, b] = LAYOUT[view].eyes;
  const m = (a + b) / 2;
  return ink(
    blob(
      [
        [-3.25, -1.95],
        [m, -2.05],
        [3.25, -1.95],
        [3.42, -1.0],
        [3.22, 0.05],
        [b + 0.98, 0.45],
        [b, 0.82],
        [b - 0.8, 0.55],
        [m, 0.12],
        [a + 0.8, 0.55],
        [a, 0.82],
        [a - 0.98, 0.45],
        [-3.22, 0.05],
        [-3.42, -1.0],
      ],
      0.9,
    ),
    'mask',
    0.2,
  );
}

/** The part of an eye ellipse below its lid line (lid y at the left and right ends). */
function eyeBelow(cx: number, cy: number, rx: number, ry: number, lidL: number, lidR: number): string {
  const pts: P[] = [];
  const lid = (x: number) => lidL + ((lidR - lidL) * (x - (cx - rx))) / (2 * rx);
  const all: [P, boolean][] = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const p: P = [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
    all.push([p, p[1] >= lid(p[0])]);
  }
  const start = Math.max(
    0,
    all.findIndex(([, ok], i) => ok && !all[(i + 63) % 64]![1]),
  );
  for (let k = 0; k < 64; k++) {
    const [p, ok] = all[(start + k) % 64]!;
    if (!ok) break;
    pts.push(p);
  }
  return poly(pts);
}

type Eyes = 'sly' | 'angry' | 'wide' | 'blink' | 'hurt' | 'strain' | 'dazed' | 'glow';

/** Eye holes in the mask: whites under a lid, pupils glancing forward. */
function eyes(view: View, kind: Eyes): PathShape[] {
  const out: PathShape[] = [];
  const glance = view === 'front' ? 0.3 : 0.34;
  LAYOUT[view].eyes.forEach((cx, i) => {
    const rx = LAYOUT[view].rx[i]!;
    const inner = i === 0 ? 1 : -1;
    if (kind === 'blink') {
      out.push(fill(eyeBelow(cx, EYE_Y, rx, EYE_RY, EYE_Y - 0.05, EYE_Y - 0.05), 'skin'));
      out.push(
        stroke(
          curve([
            [cx - rx * 0.8, EYE_Y + 0.05],
            [cx, EYE_Y + 0.38],
            [cx + rx * 0.8, EYE_Y + 0.05],
          ]),
          0.2,
        ),
      );
      return;
    }
    if (kind === 'hurt' || kind === 'strain') {
      out.push(fill(eyeBelow(cx, EYE_Y, rx, EYE_RY, EYE_Y - 0.3, EYE_Y - 0.3), 'skin'));
      const s = inner;
      out.push(
        stroke(
          line([
            [cx - 0.45 * s, EYE_Y - 0.3],
            [cx + 0.35 * s, EYE_Y + 0.05],
            [cx - 0.45 * s, EYE_Y + 0.38],
          ]),
          0.24,
        ),
      );
      return;
    }
    if (kind === 'glow') {
      out.push(fill(eyeBelow(cx, EYE_Y + 0.1, rx * 0.9, EYE_RY * 0.55, EYE_Y + 0.05, EYE_Y + 0.05), 'glow'));
      return;
    }
    const lid = {
      sly: [EYE_Y - 0.28, EYE_Y - 0.22],
      angry: i === 0 ? [EYE_Y - 0.25, EYE_Y + 0.12] : [EYE_Y + 0.12, EYE_Y - 0.25],
      wide: [EYE_Y - 0.75, EYE_Y - 0.75],
      dazed: [EYE_Y - 0.35, EYE_Y - 0.35],
    }[kind];
    const [l, r] = lid as [number, number];
    out.push(fill(eyeBelow(cx, EYE_Y, rx, EYE_RY, l, r), 'eye'));
    if (kind !== 'wide')
      out.push(
        stroke(
          line([
            [cx - rx - 0.04, l],
            [cx + rx + 0.04, r],
          ]),
          0.2,
          'mask',
        ),
      );
    if (kind === 'dazed') {
      out.push(
        stroke(
          curve([
            [cx - 0.3, EYE_Y + 0.2],
            [cx, EYE_Y - 0.1],
            [cx + 0.3, EYE_Y + 0.2],
            [cx, EYE_Y + 0.45],
            [cx - 0.12, EYE_Y + 0.2],
          ]),
          0.12,
        ),
      );
      return;
    }
    const lidAt = (x: number) => l + ((r - l) * (x - (cx - rx))) / (2 * rx);
    const px = cx + glance * (kind === 'wide' ? 0.5 : 1);
    const py = kind === 'wide' ? EYE_Y : lidAt(px) + 0.24;
    out.push(fill(ellipse(px, py, 0.22, kind === 'wide' ? 0.26 : 0.22), 'pupil'));
  });
  return out;
}

function nose(view: View): PathShape[] {
  const x = LAYOUT[view].nose;
  return [ink(ellipse(x, 0.82, 0.62, 0.52), 'skin', 0.2), fill(ellipse(x - 0.2, 0.66, 0.22, 0.14), 'skinHi')];
}

type Mouth = 'smirk' | 'grin' | 'shout' | 'ouch' | 'grit' | 'flat';

function mouth(view: View, kind: Mouth): PathShape[] {
  const [a, b] = LAYOUT[view].mouth;
  const m = (a + b) / 2;
  switch (kind) {
    case 'smirk':
      return [
        stroke(
          curve([
            [a, 1.6],
            [m - 0.6, 2.18],
            [m + 0.7, 2.12],
            [b, 1.42],
          ]),
          0.22,
        ),
        stroke(
          line([
            [b - 0.18, 1.2],
            [b + 0.02, 1.47],
          ]),
          0.16,
        ),
      ];
    case 'flat':
      return [
        stroke(
          curve([
            [a + 0.4, 1.95],
            [m, 2.08],
            [b - 0.3, 1.9],
          ]),
          0.22,
        ),
      ];
    case 'grin':
      return [
        ink(
          blob(
            [
              [a, 1.45],
              [m, 1.75],
              [b, 1.35],
              [b - 0.5, 2.25],
              [m, 2.65],
              [a + 0.5, 2.3],
            ],
            0.8,
          ),
          'mouth',
          0.2,
        ),
        fill(
          blob(
            [
              [a + 0.25, 1.58],
              [m, 1.85],
              [b - 0.25, 1.5],
              [b - 0.5, 1.9],
              [m, 2.05],
              [a + 0.5, 1.95],
            ],
            0.8,
          ),
          'eye',
        ),
      ];
    case 'shout':
      return [
        ink(
          blob(
            [
              [m - 0.85, 1.55],
              [m + 0.85, 1.5],
              [m + 0.6, 2.55],
              [m, 2.85],
              [m - 0.6, 2.55],
            ],
            0.9,
          ),
          'mouth',
          0.2,
        ),
        fill(ellipse(m, 2.45, 0.45, 0.22), 'tongue'),
      ];
    case 'ouch':
      return [ink(ellipse(m, 2.05, 0.42, 0.5), 'mouth', 0.2), fill(ellipse(m, 2.3, 0.25, 0.14), 'tongue')];
    case 'grit':
      return [
        ink(
          blob(
            [
              [m - 1.0, 1.75],
              [m + 1.0, 1.7],
              [m + 0.9, 2.3],
              [m - 0.9, 2.35],
            ],
            0.7,
          ),
          'eye',
          0.2,
        ),
        stroke(
          line([
            [m - 0.9, 2.02],
            [m + 0.9, 2.0],
          ]),
          0.1,
        ),
        stroke(
          line([
            [m - 0.3, 1.75],
            [m - 0.3, 2.33],
          ]),
          0.1,
        ),
        stroke(
          line([
            [m + 0.3, 1.73],
            [m + 0.3, 2.32],
          ]),
          0.1,
        ),
      ];
  }
}

const face = (view: View, e: Eyes, mo: Mouth): PathShape[] => [
  mask(view),
  ...eyes(view, e),
  ...nose(view),
  ...mouth(view, mo),
];

export const faces: Record<string, PathShape[]> = {
  faceFront: face('front', 'sly', 'smirk'),
  faceFrontBlink: face('front', 'blink', 'smirk'),
  faceFrontGrin: face('front', 'sly', 'grin'),
  faceFrontHurt: face('front', 'hurt', 'ouch'),
  faceFrontStrain: face('front', 'strain', 'grit'),
  faceFrontDazed: face('front', 'dazed', 'ouch'),
  faceFrontWide: face('front', 'wide', 'flat'),
  face3q: face('3q', 'sly', 'smirk'),
  face3qBlink: face('3q', 'blink', 'smirk'),
  face3qAngry: face('3q', 'angry', 'grit'),
  face3qShout: face('3q', 'angry', 'shout'),
  face3qGrin: face('3q', 'sly', 'grin'),
  face3qHurt: face('3q', 'hurt', 'ouch'),
  face3qWide: face('3q', 'wide', 'ouch'),
  face3qGlow: face('3q', 'glow', 'flat'),
};

// ---------------------------------------------------------------------------------------------------------
// Beanie (head space), with the blue feather tucked into the cuff at the back

const CUFF_TOP = -2.55;
const CUFF_BOT = -1.42;
const CUFF_W = 3.42;
const BOW = 0.16;
const bowY = (x: number) => BOW * (1 - (x / CUFF_W) ** 2);

const cuffOutline = blob(
  [
    ...[-2.9, -1.5, 0, 1.5, 2.9].map((x): P => [x, CUFF_TOP + bowY(x)]),
    [3.38, -2.25],
    [3.42, -1.85],
    ...[2.9, 1.5, 0, -1.5, -2.9].map((x): P => [x, CUFF_BOT + bowY(x)]),
    [-3.42, -1.85],
    [-3.38, -2.25],
  ],
  0.85,
);

/** Vertical knit ribs on the cuff, bunching towards the sides like stripes on a cylinder. */
function ribs(turn: number): PathShape[] {
  const xs: number[] = [];
  for (let a = -84; a <= 84; a += 8.4) xs.push(3.3 * Math.sin(((a + turn) * Math.PI) / 180));
  const out: PathShape[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const [x0, x1] = [Math.max(-3.05, xs[i]!), Math.min(3.05, xs[i + 1]!)];
    if (x1 - x0 < 0.04) continue;
    out.push(
      fill(
        poly([
          [x0, CUFF_TOP + 0.1 + bowY(x0)],
          [x1, CUFF_TOP + 0.1 + bowY(x1)],
          [x1, CUFF_BOT - 0.08 + bowY(x1)],
          [x0, CUFF_BOT - 0.08 + bowY(x0)],
        ]),
        'hatRib',
      ),
    );
  }
  return out;
}

const DOME: P[] = [
  [-3.18, -2.3],
  [-3.05, -3.1],
  [-2.45, -3.78],
  [-1.35, -4.16],
  [0, -4.27],
  [1.35, -4.16],
  [2.45, -3.78],
  [3.05, -3.1],
  [3.18, -2.3],
  [0, -2.1],
];

/** Faint knit lines on the crown, curving in towards the top. */
function knit(turn: number): PathShape[] {
  return [-0.62, -0.3, 0.02, 0.34, 0.64].map((k) => {
    const x = 3.0 * Math.sin(((k * 90 + turn) * Math.PI) / 180);
    return stroke(
      curve([
        [x, -2.6],
        [x * 0.92, -3.35],
        [x * 0.6, -3.95],
      ]),
      0.1,
      'hatLo',
    );
  });
}

const FEATHER: P[] = (
  [
    [0, 0.3],
    [0.42, -0.55],
    [0.55, -1.55],
    [0.38, -2.45],
    [0.02, -3.15],
    [-0.32, -2.5],
    [-0.5, -1.6],
    [-0.42, -0.6],
  ] as const
).map(([x, y]): P => [x * 1.15, y * 1.12]);

function feather(a: number, x: number, y: number): PathShape[] {
  const at = (pts: readonly P[]) => place(pts, a, x, y);
  return [
    ink(blob(at(FEATHER)), 'feather', 0.2),
    fill(
      blob(
        at([
          [0.05, -0.2],
          [0.4, -1.2],
          [0.32, -2.3],
          [0.05, -2.9],
          [0.12, -1.6],
        ]),
      ),
      'featherHi',
    ),
    stroke(
      curve(
        at([
          [0, 0.25],
          [0.02, -1.5],
          [0.02, -2.9],
        ]),
      ),
      0.1,
      'featherLo',
    ),
    stroke(
      line(
        at([
          [-0.5, -1.45],
          [-0.15, -1.25],
        ]),
      ),
      0.1,
      'line',
    ),
    stroke(
      line(
        at([
          [-0.42, -2.25],
          [-0.12, -2.05],
        ]),
      ),
      0.1,
      'line',
    ),
  ];
}

function beanie(turn: number): PathShape[] {
  const shift = turn / 60;
  return [
    ...feather(-38, -2.15 - shift * 0.4, -2.55),
    ink(blob(DOME.map(([x, y]): P => [x - shift * 0.25 * (1 + y / 4.3), y])), 'hat'),
    fill(
      blob([
        [-2.35, -3.4],
        [-1.7, -3.85],
        [-0.6, -4.02],
        [-0.95, -3.72],
        [-1.85, -3.35],
      ]),
      'hatHi',
    ),
    fill(
      blob([
        [2.35, -3.75],
        [2.95, -3.1],
        [3.05, -2.45],
        [2.4, -2.6],
        [2.55, -3.15],
      ]),
      'hatLo',
    ),
    ...knit(turn),
    ink(cuffOutline, 'hat'),
    ...ribs(turn),
    stroke(cuffOutline, LW),
  ];
}

export const hatFront = beanie(0);
export const hat3q = beanie(14);

// ---------------------------------------------------------------------------------------------------------
// Body (hip space: the hips are the origin, the shirt runs up to the neck at -3.95 and down past the hips)

const TORSO: P[] = [
  [0, -4.4],
  [1.35, -4.3],
  [2.12, -3.85],
  [2.5, -3.0],
  [2.64, -1.7],
  [2.78, -0.4],
  [2.88, 0.5],
  [2.52, 0.84],
  [1.3, 0.95],
  [0, 0.98],
  [-1.3, 0.95],
  [-2.52, 0.84],
  [-2.88, 0.5],
  [-2.78, -0.4],
  [-2.64, -1.7],
  [-2.5, -3.0],
  [-2.12, -3.85],
  [-1.35, -4.3],
];
const torsoOutline = blob(TORSO);

/** The striped shirt: white with four black hoops, shaded on the far side. */
export const torso: PathShape[] = [
  fill(torsoOutline, 'shirt'),
  fill(
    blob([
      [2.05, -3.6],
      [2.48, -2.7],
      [2.64, -1.2],
      [2.8, 0.5],
      [2.32, 0.8],
      [2.2, -0.9],
      [2.06, -2.6],
    ]),
    'shirtLo',
  ),
  ...bands(
    torsoOutline,
    [
      [-2.9, -2.25],
      [-1.65, -1.0],
      [-0.4, 0.25],
    ],
    0.24,
  ).map((d) => fill(d, 'stripe')),
  stroke(torsoOutline, LW),
];

/** Arm lengths (shoulder to elbow, elbow to wrist) and leg lengths (hip to knee, knee to ankle). */
export const UPPER_ARM = 1.45;
export const FORE_ARM = 1.25;
export const THIGH = 1.45;
export const SHIN = 1.35;
/** The shoe's sole sits this far below the ankle. */
export const ANKLE = 0.9;

type Part = { line: PathShape[]; fill: PathShape[] };

/** A striped sleeve segment: black hoops across a white tube. */
function sleeve(len: number, r0: number, r1: number, hoops: [number, number][]): Part {
  const outline = tube(0, 0, len, r0, r1);
  return {
    line: [fill(tube(0, 0, len, r0 + LIMB_LINE, r1 + LIMB_LINE), 'line')],
    fill: [fill(outline, 'shirt'), ...bands(outline, hoops, 0.08).map((d) => fill(d, 'stripe'))],
  };
}

export const upperArm = sleeve(UPPER_ARM, 0.6, 0.55, [
  [0.22, 0.62],
  [0.98, 1.4],
]);
export const foreArm = sleeve(FORE_ARM, 0.55, 0.5, [[0.32, 0.74]]);

/** Black trousers: a dark tube with a grey sheen down the front. */
function trouser(len: number, r0: number, r1: number): Part {
  return {
    line: [fill(tube(0, 0, len, r0 + LIMB_LINE, r1 + LIMB_LINE), 'line')],
    fill: [
      fill(tube(0, 0, len, r0, r1), 'pants'),
      fill(tube(r0 * 0.42, len * 0.08, len * 0.85, r0 * 0.2, r1 * 0.2), 'pantsHi'),
    ],
  };
}

export const thigh = trouser(THIGH, 0.82, 0.72);
export const shin = trouser(SHIN - 0.2, 0.72, 0.64);

// Hands (hand space: the wrist is the origin, the fingers point down +y)

export const handOpen: PathShape[] = [
  ink(ellipse(0.5, 0.42, 0.26, 0.34), 'skin', 0.2),
  ink(
    blob([
      [-0.52, 0.0],
      [0.5, 0.0],
      [0.66, 0.55],
      [0.5, 1.06],
      [0.0, 1.22],
      [-0.48, 1.08],
      [-0.66, 0.55],
    ]),
    'skin',
  ),
  stroke(
    line([
      [-0.18, 0.86],
      [-0.2, 1.15],
    ]),
    0.12,
  ),
  stroke(
    line([
      [0.18, 0.88],
      [0.18, 1.16],
    ]),
    0.12,
  ),
];
export const fist: PathShape[] = [
  ink(ellipse(0, 0.5, 0.64, 0.6), 'skin'),
  fill(ellipse(-0.2, 0.32, 0.22, 0.16), 'skinHi'),
  stroke(
    curve([
      [0.62, 0.35],
      [0.2, 0.55],
      [0.0, 0.95],
    ]),
    0.13,
  ),
  stroke(
    curve([
      [-0.45, 0.85],
      [-0.1, 1.0],
      [0.25, 0.95],
    ]),
    0.12,
  ),
];
/** Pointing finger, for the shh. */
export const point: PathShape[] = [
  ink(ellipse(0, 0.45, 0.58, 0.52), 'skin'),
  ink(capsule(0.1, 0.55, 0.12, 1.55, 0.2, 0.18), 'skin', 0.2),
];

// Feet (foot space: the ankle is the origin, the toe points along +x)

const SHOE: P[] = [
  [-0.85, 0.15],
  [-0.75, -0.32],
  [-0.1, -0.52],
  [0.65, -0.35],
  [1.4, -0.12],
  [1.95, 0.2],
  [2.08, 0.58],
  [1.75, 0.86],
  [0.5, ANKLE],
  [-0.62, 0.88],
  [-0.95, 0.58],
];
const shoeOutline = blob(SHOE, 0.95);
export const shoe: PathShape[] = [
  fill(shoeOutline, 'shoe'),
  ...bands(shoeOutline, [[0.66, 1.2]]).map((d) => fill(d, 'sole')),
  fill(
    blob([
      [0.85, -0.18],
      [1.5, 0.02],
      [1.8, 0.3],
      [1.3, 0.22],
      [0.8, 0.04],
    ]),
    'shoeHi',
  ),
  fill(ellipse(-0.25, -0.18, 0.3, 0.14), 'shoeHi'),
  stroke(shoeOutline, LW),
];
const SHOE_FRONT: P[] = [
  [-0.78, -0.28],
  [0, -0.48],
  [0.78, -0.28],
  [1.0, 0.35],
  [0.72, 0.86],
  [0, ANKLE],
  [-0.72, 0.86],
  [-1.0, 0.35],
];
const shoeFrontOutline = blob(SHOE_FRONT, 0.95);
/** The shoe seen from the front, for the idle stance. */
export const shoeFront: PathShape[] = [
  fill(shoeFrontOutline, 'shoe'),
  ...bands(shoeFrontOutline, [[0.64, 1.2]]).map((d) => fill(d, 'sole')),
  fill(ellipse(-0.25, -0.1, 0.35, 0.16), 'shoeHi'),
  stroke(shoeFrontOutline, LW),
];

// ---------------------------------------------------------------------------------------------------------
// Props: night-stick, loot sack, grappling hook, stun gun (grip at the origin, pointing along +x)

/** The night-stick runs from its knob at -1.05 to its tip at BATON_TIP. */
export const BATON_TIP = 7.5;
export const baton: PathShape[] = [
  ink(ellipse(-1.05, 0, 0.38, 0.42), 'baton', 0.18),
  ink(capsule(-0.95, 0, BATON_TIP - 0.3, 0, 0.33, 0.3), 'baton', 0.18),
  ...[-0.72, -0.4, -0.08, 0.24].map((x) =>
    fill(
      poly([
        [x, -0.3],
        [x + 0.12, -0.3],
        [x + 0.12, 0.3],
        [x, 0.3],
      ]),
      'batonGrip',
    ),
  ),
  ink(ellipse(0.72, 0, 0.17, 0.46), 'baton', 0.14),
  fill(capsule(1.3, -0.13, BATON_TIP - 0.7, -0.13, 0.07, 0.06), 'batonHi'),
  fill(ellipse(-1.15, -0.15, 0.13, 0.1), 'batonHi'),
];

/** The loot sack hanging from its tied neck (the origin): cream canvas with a green dollar sign. */
export const SACK_BOTTOM = 4.45;
const SACK: P[] = [
  [-0.42, 0.12],
  [0.42, 0.12],
  [1.55, 0.85],
  [2.3, 2.15],
  [2.22, 3.6],
  [1.25, 4.3],
  [-0.15, SACK_BOTTOM],
  [-1.6, 4.22],
  [-2.38, 3.3],
  [-2.25, 1.9],
  [-1.45, 0.85],
];
export const sack: PathShape[] = [
  ink(
    blob(
      [
        [-0.65, -0.95],
        [-0.2, -0.55],
        [0.02, -1.05],
        [0.28, -0.55],
        [0.7, -0.85],
        [0.42, -0.08],
        [-0.45, -0.08],
      ],
      0.8,
    ),
    'sack',
    0.2,
  ),
  ink(blob(SACK), 'sack'),
  fill(
    blob([
      [2.0, 2.0],
      [2.1, 3.5],
      [1.2, 4.12],
      [-0.4, 4.2],
      [0.9, 3.7],
      [1.6, 3.0],
    ]),
    'sackLo',
  ),
  fill(
    blob([
      [-1.85, 1.6],
      [-1.3, 1.0],
      [-1.0, 1.4],
      [-1.55, 2.3],
    ]),
    'sackHi',
  ),
  stroke(
    curve([
      [-0.3, 0.35],
      [-0.75, 1.1],
      [-1.0, 1.7],
    ]),
    0.12,
    'sackLo',
  ),
  stroke(
    curve([
      [0.3, 0.35],
      [0.85, 1.0],
      [1.2, 1.5],
    ]),
    0.12,
    'sackLo',
  ),
  stroke(
    line([
      [0, 1.25],
      [0, 4.0],
    ]),
    0.3,
    'dollar',
  ),
  stroke(
    curve([
      [0.72, 1.82],
      [0.1, 1.62],
      [-0.62, 1.95],
      [-0.42, 2.5],
      [0.45, 2.78],
      [0.68, 3.32],
      [-0.1, 3.62],
      [-0.78, 3.36],
    ]),
    0.42,
    'dollar',
  ),
  ink(
    poly([
      [-0.55, -0.22],
      [0.55, -0.22],
      [0.5, 0.2],
      [-0.5, 0.2],
    ]),
    'rope',
    0.16,
  ),
];

/** Grappling hook: a ring at the back, a shank and three curved prongs. */
export const hook: PathShape[] = [
  stroke(
    curve([
      [0.45, 0],
      [1.05, -0.35],
      [1.1, -1.0],
      [0.75, -1.25],
    ]),
    0.58,
  ),
  stroke(
    curve([
      [0.45, 0],
      [1.05, 0.35],
      [1.1, 1.0],
      [0.75, 1.25],
    ]),
    0.58,
  ),
  stroke(
    curve([
      [0.45, 0],
      [1.05, -0.35],
      [1.1, -1.0],
      [0.75, -1.25],
    ]),
    0.3,
    'metal',
  ),
  stroke(
    curve([
      [0.45, 0],
      [1.05, 0.35],
      [1.1, 1.0],
      [0.75, 1.25],
    ]),
    0.3,
    'metal',
  ),
  ink(capsule(-0.7, 0, 1.25, 0, 0.2, 0.15), 'metal', 0.16),
  ink(
    poly([
      [1.25, -0.3],
      [1.8, 0],
      [1.25, 0.3],
    ]),
    'metal',
    0.14,
  ),
  fill(capsule(-0.5, -0.07, 1.0, -0.07, 0.05, 0.05), 'metalHi'),
  ink(ellipse(-0.95, 0, 0.32, 0.32), 'metalLo', 0.14),
  fill(ellipse(-0.95, 0, 0.14, 0.14), 'line'),
];

/** One unit of rope along +x; its bone stretches it to length. */
export const rope: PathShape[] = [
  fill(
    poly([
      [0, -0.19],
      [1, -0.19],
      [1, 0.19],
      [0, 0.19],
    ]),
    'line',
  ),
  fill(
    poly([
      [0, -0.1],
      [1, -0.1],
      [1, 0.1],
      [0, 0.1],
    ]),
    'rope',
  ),
];

/** Stun gun: a chunky yellow taser with a black grip and two prongs. */
export const taser: PathShape[] = [
  ink(
    blob(
      [
        [-0.35, -0.2],
        [0.32, -0.2],
        [0.42, 0.85],
        [0.05, 1.05],
        [-0.38, 0.9],
      ],
      0.8,
    ),
    'baton',
    0.18,
  ),
  ink(
    blob(
      [
        [-0.65, -0.75],
        [1.45, -0.72],
        [1.62, -0.4],
        [1.45, 0.0],
        [-0.6, 0.02],
        [-0.75, -0.35],
      ],
      0.7,
    ),
    'taser',
    0.2,
  ),
  fill(
    blob(
      [
        [-0.4, -0.6],
        [1.1, -0.6],
        [1.25, -0.48],
        [-0.35, -0.45],
      ],
      0.7,
    ),
    'taserHi',
  ),
  fill(
    poly([
      [1.55, -0.6],
      [1.95, -0.6],
      [1.95, -0.48],
      [1.55, -0.48],
    ]),
    'metal',
  ),
  fill(
    poly([
      [1.55, -0.2],
      [1.95, -0.2],
      [1.95, -0.08],
      [1.55, -0.08],
    ]),
    'metal',
  ),
  fill(ellipse(0.4, -0.35, 0.16, 0.12), 'line'),
];

/** An electric arc: a jagged bolt along +x, one unit long. */
const BOLT: P[] = [
  [0, 0],
  [0.14, -0.35],
  [0.27, 0.25],
  [0.42, -0.3],
  [0.56, 0.3],
  [0.7, -0.25],
  [0.85, 0.2],
  [1, 0],
];
export const zap: PathShape[] = [stroke(line(BOLT), 0.32, 'zap2'), stroke(line(BOLT), 0.14, 'zap')];

/** A burst of sparks around the origin. */
export const spark: PathShape[] = [
  ink(
    poly(
      Array.from({ length: 16 }, (_, i): P => {
        const r = i % 2 ? 0.45 : 1.15;
        const a = (i / 16) * Math.PI * 2;
        return [r * Math.cos(a), r * Math.sin(a)];
      }),
    ),
    'zap',
    0.12,
  ),
  fill(ellipse(0, 0, 0.35, 0.35), 'eye'),
];

/** The taser dart in flight (a projectile prop): barbed tip, body and a crackling wire behind it. */
export const dart: PathShape[] = [
  stroke(
    line([
      [-3.2, 0.1],
      [-2.4, -0.25],
      [-1.6, 0.25],
      [-0.8, -0.2],
      [-0.3, 0],
    ]),
    0.3,
    'zap2',
  ),
  stroke(
    line([
      [-3.2, 0.1],
      [-2.4, -0.25],
      [-1.6, 0.25],
      [-0.8, -0.2],
      [-0.3, 0],
    ]),
    0.12,
    'zap',
  ),
  ink(capsule(-0.5, 0, 0.6, 0, 0.22, 0.18), 'taser', 0.14),
  ink(
    poly([
      [0.55, -0.32],
      [1.2, 0],
      [0.55, 0.32],
    ]),
    'metal',
    0.12,
  ),
];

/** A gold coin, for the taunt's flip. */
export const coin: PathShape[] = [
  ink(ellipse(0, 0, 0.75, 0.75), 'gold', 0.16),
  ink(ellipse(0, 0, 0.5, 0.5), 'goldLo', 0.08),
  fill(ellipse(-0.2, -0.22, 0.18, 0.12), 'goldHi'),
];
/** The same coin edge-on, mid-flip. */
export const coinEdge: PathShape[] = [ink(ellipse(0, 0, 0.75, 0.2), 'gold', 0.16)];

/** Stars circling a dazed head (fx space: the ring is centred on the origin). */
function star(x: number, y: number, r: number): string {
  return poly(
    Array.from({ length: 10 }, (_, i): P => {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const k = i % 2 ? r * 0.45 : r;
      return [x + k * Math.cos(a), y + k * Math.sin(a)];
    }),
  );
}
export const stars: PathShape[] = [
  stroke(ellipse(0, 0, 2.6, 0.7), 0.08, 'goldLo'),
  ink(star(-2.4, 0.1, 0.55), 'gold', 0.12),
  ink(star(1.2, 0.62, 0.48), 'gold', 0.12),
  ink(star(1.6, -0.5, 0.4), 'gold', 0.12),
];

// ---------------------------------------------------------------------------------------------------------
// Effects: swing smears, the baton's twirl disc, Bob's shadow

/**
 * A Flash swing smear: a crescent swept by the baton's far end, trailing `sweep` degrees behind the leading
 * edge (angle 0), thickest and most opaque at the front and fading out towards its tail.
 */
function smear(sweep: number): PathShape[] {
  const steps = 8;
  return Array.from({ length: steps }, (_, i) => {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const alpha = 0.12 + 0.8 * t1 * t1;
    return fill(sector(-sweep * (1 - t0), -sweep * (1 - t1) + 0.5, 0.86 - 0.2 * t1, 1.03, 6), {
      type: 'radial' as const,
      cx: 0,
      cy: 0,
      r: 1.03,
      stops: [
        { offset: 0.6, color: 'smear', alpha: 0 },
        { offset: 0.88, color: 'smear', alpha: alpha * 0.7 },
        { offset: 1, color: 'smear', alpha },
      ],
    });
  });
}

export const smears: Record<string, PathShape[]> = {
  smear90: smear(90),
  smear150: smear(150),
  smear220: smear(220),
};

/** The baton twirled too fast to see: a pale disc with streaks. */
export const twirl: PathShape[] = [
  fill(ellipse(0, 0, 1, 1), {
    type: 'radial',
    cx: 0,
    cy: 0,
    r: 1,
    stops: [
      { offset: 0, color: 'smear', alpha: 0.1 },
      { offset: 0.7, color: 'smear', alpha: 0.4 },
      { offset: 1, color: 'smear', alpha: 0.7 },
    ],
  }),
  ...[0, 120, 240].map((a) => fill(sector(a, a + 55, 0.86, 1.0, 10), 'smearEdge')),
  ...[60, 180, 300].map((a) => fill(sector(a, a + 35, 0.6, 0.68, 8), 'smearEdge')),
];

/** Two eyes glinting out of the dark (fx space: centred between the eyes, facing right). */
export const shadowEyes: PathShape[] = [
  ...[-0.85, 1.55].map((x) =>
    fill(ellipse(x, 0, 1.0, 0.55), {
      type: 'radial' as const,
      cx: x,
      cy: 0,
      r: 1.0,
      stops: [
        { offset: 0, color: 'glow', alpha: 0.7 },
        { offset: 1, color: 'glow', alpha: 0 },
      ],
    }),
  ),
  ...[-0.85, 1.55].map((x) =>
    fill(
      blob(
        [
          [x - 0.62, 0.05],
          [x, -0.2],
          [x + 0.62, 0.0],
          [x, 0.22],
        ],
        0.8,
      ),
      'glow',
    ),
  ),
];

/** Shadow Step: Bob's own patch of darkness, densest in the middle (body space). */
export const shadow: PathShape[] = [
  fill(ellipse(0, -0.5, 6.2, 7.6), {
    type: 'radial',
    cx: 0,
    cy: -0.5,
    r: 7.6,
    stops: [
      { offset: 0, color: 'shadow', alpha: 0.92 },
      { offset: 0.62, color: 'shadow', alpha: 0.78 },
      { offset: 1, color: 'shadow', alpha: 0 },
    ],
  }),
];
