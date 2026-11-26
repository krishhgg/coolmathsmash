import type { PathShape } from '../../../render/rig/types';
import { bands, blob, bottomOf, curve, ellipse, line, n, poly, sector, tube, type P } from './shapes';

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
  [2.28, -2.38],
  [3.26, -0.85],
  [3.35, 0.72],
  [2.86, 1.96],
  [1.62, 2.85],
  [0, 3.16],
  [-1.62, 2.85],
  [-2.86, 1.96],
  [-3.35, 0.72],
  [-3.26, -0.85],
  [-2.28, -2.38],
];
const faceOutline = blob(FACE);

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
  ...ear(-3.1, 1),
  ...ear(3.1, -1),
  fill(faceOutline, 'skin'),
  fill(
    blob([
      [-3.22, 0.96],
      [-2.79, 1.92],
      [-1.58, 2.82],
      [0, 3.12],
      [1.58, 2.82],
      [2.79, 1.92],
      [3.22, 0.96],
      [2.27, 2.02],
      [0, 2.72],
      [-2.27, 2.02],
    ]),
    'skinLo',
  ),
  stroke(faceOutline, LW),
];

/** Three-quarter view facing right: only the back ear shows, the jaw shadow sits on the back cheek. */
export const head3q: PathShape[] = [
  ...ear(-3.1, 1),
  fill(faceOutline, 'skin'),
  fill(
    blob([
      [-3.29, 0.4],
      [-3.02, 1.55],
      [-2.4, 2.41],
      [-1.42, 2.89],
      [0.1, 3.11],
      [1.75, 2.77],
      [-0.03, 2.63],
      [-1.66, 2.11],
      [-2.63, 1.05],
    ]),
    'skinLo',
  ),
  stroke(faceOutline, LW),
];

type View = 'front' | '3q';

/** Where the features sit in each view. */
const LAYOUT = {
  front: { eyes: [-1.22, 1.22] as const, rx: [0.98, 0.98] as const, nose: 0, mouth: [-1.75, 1.95] as const },
  '3q': { eyes: [-0.82, 1.6] as const, rx: [0.86, 0.96] as const, nose: 0.82, mouth: [-1.45, 2.45] as const },
};
const EYE_Y = -0.62;
const EYE_RY = 0.7;

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
        [3.4, -1.1],
        [3.1, -0.15],
        [b + 0.95, 0.53],
        [b + 0.09, 0.87],
        [b - 0.75, 0.63],
        [m, -0.12],
        [a + 0.75, 0.63],
        [a - 0.09, 0.87],
        [a - 0.95, 0.53],
        [-3.1, -0.15],
        [-3.4, -1.1],
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

type Eyes = 'sly' | 'angry' | 'wide' | 'blink' | 'hurt' | 'strain' | 'dazed' | 'glow' | 'sneak';

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
      sly: view === 'front' ? [EYE_Y - 0.3, EYE_Y - 0.3] : [EYE_Y - 0.42, EYE_Y - 0.22],
      sneak: [EYE_Y - 0.37, EYE_Y - 0.3],
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
    const px = cx + (kind === 'sneak' ? -0.46 : glance * (kind === 'wide' ? 0.5 : 1));
    const py = kind === 'wide' ? EYE_Y : lidAt(px) + 0.24;
    out.push(fill(ellipse(px, py, 0.22, kind === 'wide' ? 0.26 : 0.22), 'pupil'));
  });
  return out;
}

function nose(view: View): PathShape[] {
  const x = LAYOUT[view].nose;
  return [ink(ellipse(x, 0.82, 0.62, 0.52), 'skin', 0.2), fill(ellipse(x - 0.2, 0.66, 0.22, 0.14), 'skinHi')];
}

type Mouth = 'smirk' | 'grin' | 'shout' | 'ouch' | 'grit' | 'flat' | 'shush';

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
    case 'shush':
      return [ink(ellipse(m + 0.28, 2.03, 0.28, 0.34), 'mouth', 0.18)];
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
  face3qShush: face('3q', 'sneak', 'shush'),
  /** Only his eyes, glowing in the dark: drawn over the shadow he hides in (Shadow Step). */
  face3qShadow: [
    ...LAYOUT['3q'].eyes.map((cx, i) =>
      fill(ellipse(cx, EYE_Y + 0.1, LAYOUT['3q'].rx[i]! * 1.5, 0.9), {
        type: 'radial',
        cx,
        cy: EYE_Y + 0.1,
        r: LAYOUT['3q'].rx[i]! * 1.5,
        stops: [
          { offset: 0, color: 'glow', alpha: 0.55 },
          { offset: 1, color: 'glow', alpha: 0 },
        ],
      }),
    ),
    ...eyes('3q', 'glow'),
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Beanie (head space), with the blue feather tucked into the cuff at the back

const CUFF_TOP = -2.55;
const CUFF_BOT = -1.42;
const CUFF_W = 3.42;
const BOW = -0.22;
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
  const seams = xs
    .filter((x) => Math.abs(x) < 2.99)
    .map((x) =>
      stroke(
        line([
          [x * 0.95, CUFF_TOP + 0.09 + bowY(x)],
          [x, CUFF_BOT - 0.08 + bowY(x)],
        ]),
        0.11,
      ),
    );
  return [...out, ...seams];
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
    ink(cuffOutline, 'hat'),
    ...ribs(turn),
    stroke(cuffOutline, LW),
  ];
}

export const hatFront = beanie(0);
export const hat3q = beanie(14);

/** One night-vision lens tube looking forward, as on Bob the Robber 3's spy headset. */
const lens = (x: number, y: number, r: number): PathShape[] => [
  ink(ellipse(x, y, r, r), 'gear'),
  fill(ellipse(x, y, r * 0.68, r * 0.68), 'lens'),
  fill(ellipse(x - r * 0.22, y - r * 0.22, r * 0.24, r * 0.24), 'lensHi'),
];

/** Bob the Robber 3's night-vision headset: a strap round the beanie and three green lenses over the brow. */
export const goggles: PathShape[] = [
  ink(
    blob([
      [-3.2, -2.55],
      [-1.6, -2.88],
      [0, -2.98],
      [1.6, -2.88],
      [3.2, -2.55],
      [3.15, -3.1],
      [1.6, -3.45],
      [0, -3.55],
      [-1.6, -3.45],
      [-3.15, -3.1],
    ]),
    'gear',
  ),
  ink(capsule(-0.55, -3.1, 1.95, -3.1, 0.74, 0.74), 'gear'),
  fill(capsule(-0.55, -3.45, 1.95, -3.45, 0.2, 0.2), 'gearHi'),
  ...lens(0.7, -4.1, 0.52),
  ...lens(-0.42, -2.95, 0.66),
  ...lens(1.82, -2.95, 0.66),
];

/** Bob the Robber 5's explorer hat: a dented brown crown, a wide brim and a headlamp on the band. */
export const explorerHat: PathShape[] = [
  ink(
    blob([
      [-4.55, -1.75],
      [-3.6, -2.4],
      [0, -2.55],
      [3.7, -2.4],
      [4.7, -1.65],
      [4.25, -1.3],
      [2.6, -1.3],
      [0, -1.18],
      [-2.6, -1.3],
      [-4.2, -1.3],
    ]),
    'hatLo',
  ),
  ink(
    blob([
      [-3.0, -1.9],
      [-3.1, -2.95],
      [-2.75, -3.95],
      [-1.65, -4.6],
      [-0.4, -4.55],
      [0.3, -4.38],
      [1.0, -4.6],
      [2.1, -4.62],
      [3.0, -3.95],
      [3.25, -2.95],
      [3.15, -1.9],
      [0, -1.75],
    ]),
    'hat',
  ),
  fill(
    blob([
      [-2.6, -2.9],
      [-2.4, -3.85],
      [-1.6, -4.3],
      [-1.75, -3.6],
      [-2.05, -2.9],
    ]),
    'hatHi',
  ),
  stroke(
    curve([
      [0.3, -4.38],
      [0.15, -3.75],
      [0.35, -3.2],
    ]),
    0.12,
    'hatLo',
  ),
  ink(
    blob([
      [-3.06, -2.0],
      [0, -1.85],
      [3.2, -2.0],
      [3.22, -2.7],
      [0, -2.62],
      [-3.08, -2.72],
    ]),
    'hatRib',
  ),
  ink(ellipse(0.55, -2.35, 0.88, 0.82), 'metal'),
  fill(ellipse(0.55, -2.35, 0.62, 0.58), 'gold'),
  fill(ellipse(0.35, -2.55, 0.24, 0.22), 'goldHi'),
];

// ---------------------------------------------------------------------------------------------------------
// Body (hip space: the hips are the origin, the shirt runs up to the neck at -3.6 and flares out past the hips)

const TORSO: P[] = [
  [0, -3.96],
  [1.35, -3.87],
  [2.12, -3.47],
  [2.45, -2.7],
  [2.62, -1.55],
  [2.86, -0.4],
  [3.05, 0.28],
  [2.71, 0.65],
  [1.4, 0.88],
  [0, 0.95],
  [-1.4, 0.88],
  [-2.71, 0.65],
  [-3.05, 0.28],
  [-2.86, -0.4],
  [-2.62, -1.55],
  [-2.45, -2.7],
  [-2.12, -3.47],
  [-1.35, -3.87],
];
const torsoOutline = blob(TORSO);
const shirtBase: PathShape[] = [
  fill(torsoOutline, 'shirt'),
  fill(
    blob([
      [2.05, -3.24],
      [2.45, -2.43],
      [2.66, -1.1],
      [2.96, 0.25],
      [2.52, 0.62],
      [2.3, -0.8],
      [2.06, -2.34],
    ]),
    'shirtLo',
  ),
];

/** The striped shirt, with two wide hoops rounded over the belly. */
export const torso: PathShape[] = [
  ...shirtBase,
  ...bands(
    torsoOutline,
    [
      [-2.85, -1.92],
      [-1.15, -0.16],
    ],
    0.44,
  ).map((d) => fill(d, 'stripe')),
  stroke(torsoOutline, LW),
];

export const explorerJacket: PathShape[] = [
  ...shirtBase,
  ink(
    poly([
      [-1.06, -3.76],
      [0, -3.42],
      [1.06, -3.76],
      [0.76, -2.79],
      [0, -3.19],
      [-0.76, -2.79],
    ]),
    'stripe',
    0.16,
  ),
  stroke(
    line([
      [0, -3.17],
      [0, -0.13],
    ]),
    0.16,
    'hatLo',
  ),
  ...[-1.45, 1.45].flatMap((x) => [
    ink(
      blob(
        [
          [x - 0.47, -2.4],
          [x + 0.47, -2.4],
          [x + 0.43, -1.48],
          [x, -1.35],
          [x - 0.43, -1.48],
        ],
        0.4,
      ),
      'stripe',
      0.15,
    ),
    stroke(
      line([
        [x - 0.47, -2.23],
        [x, -2.09],
        [x + 0.47, -2.23],
      ]),
      0.13,
      'hatLo',
    ),
  ]),
  fill(bands(torsoOutline, [[-0.48, 0.17]], 0.22)[0]!, 'hatRib'),
  ink(
    blob(
      [
        [-0.45, -0.36],
        [0.45, -0.36],
        [0.45, 0.25],
        [-0.45, 0.25],
      ],
      0.25,
    ),
    'metalLo',
    0.14,
  ),
  fill(ellipse(0, -0.07, 0.23, 0.16), 'hatRib'),
  stroke(torsoOutline, LW),
];

/** Arm lengths (shoulder to elbow, elbow to wrist) and leg lengths (hip to knee, knee to ankle). */
export const UPPER_ARM = 1.45;
export const FORE_ARM = 1.25;
export const THIGH = 1.0;
export const SHIN = 0.95;
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

/** Striped trousers to match the shirt, as in the official art. */
function trouser(len: number, r0: number, r1: number, hoops: [number, number][]): Part {
  const outline = tube(0, 0, len, r0, r1);
  return {
    line: [fill(tube(0, 0, len, r0 + LIMB_LINE, r1 + LIMB_LINE), 'line')],
    fill: [fill(outline, 'leg'), ...bands(outline, hoops, 0.08).map((d) => fill(d, 'legStripe'))],
  };
}

export const thigh = trouser(THIGH, 0.84, 0.74, [[0.5, 0.82]]);
export const shin = trouser(SHIN - 0.15, 0.74, 0.66, [[0.12, 0.42]]);

// Hands (hand space: the wrist is the origin, the fingers point down +y)

const HAND_OPEN: PathShape[] = [
  ink(ellipse(0.5, 0.42, 0.26, 0.34), 'hand', 0.2),
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
    'hand',
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
const FIST: PathShape[] = [
  ink(ellipse(0, 0.5, 0.64, 0.6), 'hand'),
  fill(ellipse(-0.2, 0.32, 0.22, 0.16), 'handHi'),
  ink(capsule(0.3, 0.12, 0.5, 0.62, 0.2, 0.18), 'hand', 0.18),
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
const POINT: PathShape[] = [
  ink(ellipse(0, 0.45, 0.58, 0.52), 'hand'),
  ink(capsule(0.1, 0.55, 0.12, 1.55, 0.2, 0.18), 'hand', 0.2),
];

/** Hands are drawn a size up, chunky like the official art's, so a grip on the baton or the sack reads. */
const grow = (shapes: PathShape[], k: number): PathShape[] =>
  shapes.map((shape) => ({ ...shape, d: shape.d.replace(/-?\d*\.?\d+/g, (v) => n(+v * k)) }));
export const handOpen = grow(HAND_OPEN, 1.35);
export const fist = grow(FIST, 1.35);
export const point = grow(POINT, 1.35);
export const ledgeGripHand = grow(
  [
    ink(
      blob(
        [
          [-0.42, -0.01],
          [0.38, -0.06],
          [0.58, 0.29],
          [0.56, 0.71],
          [0.23, 1.06],
          [-0.27, 0.99],
          [-0.58, 0.7],
          [-0.58, 0.24],
        ],
        0.75,
      ),
      'hand',
    ),
    stroke(
      curve([
        [-0.57, 0.56],
        [-0.23, 0.69],
        [0.21, 0.62],
        [0.55, 0.48],
      ]),
      0.14,
    ),
    stroke(
      line([
        [-0.18, 0.71],
        [-0.16, 1.0],
      ]),
      0.1,
    ),
    stroke(
      line([
        [0.2, 0.65],
        [0.22, 0.99],
      ]),
      0.1,
    ),
  ],
  1.35,
);

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
  fill(bottomOf(shoeOutline, 0.63), 'sole'),
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
  fill(bottomOf(shoeFrontOutline, 0.63), 'sole'),
  fill(ellipse(-0.25, -0.1, 0.35, 0.16), 'shoeHi'),
  stroke(shoeFrontOutline, LW),
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

// ---------------------------------------------------------------------------------------------------------
// Attack props: night-stick and grappling hook (grip at the origin, pointing along +x)

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

/**
 * The stun gun: a stubby yellow taser held by its black grip (the origin sits in the fist), the barrel above the
 * hand pointing along +x, a dark cartridge on the nose and two metal prongs whose tips are TASER_TIP.
 */
export const TASER_TIP: P = [2.9, -1.0];
export const taser: PathShape[] = [
  ink(
    poly([
      [-0.55, -0.7],
      [0.5, -0.7],
      [0.42, 0.55],
      [-0.5, 0.5],
    ]),
    'gear',
    0.18,
  ),
  stroke(
    curve([
      [0.5, -0.55],
      [1.05, -0.2],
      [0.62, 0.12],
    ]),
    0.16,
  ),
  ink(capsule(-0.55, -1.0, 1.75, -1.0, 0.52, 0.5), 'taser', 0.2),
  fill(capsule(-0.5, -0.66, 1.65, -0.66, 0.14, 0.14), 'goldLo'),
  fill(capsule(-0.25, -1.3, 1.3, -1.3, 0.1, 0.09), 'taserHi'),
  ink(
    poly([
      [0.55, -1.32],
      [0.98, -1.32],
      [0.78, -1.02],
      [1.08, -1.02],
      [0.6, -0.6],
      [0.72, -0.92],
      [0.46, -0.92],
    ]),
    'line',
    0.04,
  ),
  ink(
    poly([
      [1.75, -1.5],
      [2.45, -1.42],
      [2.45, -0.58],
      [1.75, -0.5],
    ]),
    'gear',
    0.18,
  ),
  fill(capsule(1.85, -1.32, 2.33, -1.3, 0.06, 0.05), 'gearHi'),
  ink(capsule(2.45, -1.22, TASER_TIP[0], -1.22, 0.1, 0.08), 'metal', 0.12),
  ink(capsule(2.45, -0.78, TASER_TIP[0], -0.78, 0.1, 0.08), 'metal', 0.12),
];

/** A zigzag bolt through `points`, inked dark under a pale core. */
const bolt = (points: readonly P[], width = 0.16): PathShape[] => [
  stroke(line(points), width + 0.14),
  stroke(line(points), width, 'zap'),
];

/**
 * The taser crackling while it charges, between and around the prongs (prong space: TASER_TIP is the origin, +x
 * forward). Three drawings looped at 30 fps on the match clock, so a held charge keeps sparking.
 */
const crackle = (k: number): PathShape[] => {
  const j = (a: number, b: number, c: number) => [a, b, c][k]!;
  return [
    fill(ellipse(0.1, 0, 0.75, 0.6), {
      type: 'radial',
      cx: 0.1,
      cy: 0,
      r: 0.75,
      stops: [
        { offset: 0, color: 'zap', alpha: 0.9 },
        { offset: 0.5, color: 'zap2', alpha: 0.45 },
        { offset: 1, color: 'zap2', alpha: 0 },
      ],
    }),
    ...bolt([
      [0, -0.22],
      [j(0.2, 0.28, 0.14), j(-0.06, 0.02, -0.1)],
      [j(0.06, 0.02, 0.12), j(0.06, -0.04, 0.1)],
      [0, 0.22],
    ]),
    ...bolt(
      [
        [0.05, j(-0.22, 0.22, -0.22)],
        [j(0.35, 0.3, 0.42), j(-0.42, 0.36, -0.3)],
        [j(0.55, 0.62, 0.5), j(-0.3, 0.5, -0.55)],
      ],
      0.1,
    ),
  ];
};

/**
 * The shot: a ball of crackling current (radius about 1 at the shot's own scale; the prop scale sets its size),
 * pale at the core, blue at the rim, with a short tail behind it and arcs that jump about in three drawings.
 */
const shotDrawing = (k: number): PathShape[] => {
  const turn = [0, 40, 80][k]!;
  const arc = (a: number, len: number): P[] => {
    const r = (deg: number, d: number): P => [
      d * Math.cos(((deg + turn) * Math.PI) / 180),
      d * Math.sin(((deg + turn) * Math.PI) / 180),
    ];
    return [r(a, 0.55), r(a + 18, 0.85), r(a - 10, 1.05), r(a + 12, 1.15 + len)];
  };
  return [
    fill(
      poly([
        [-0.2, -0.62],
        [-1.9, -0.18],
        [-2.3, 0],
        [-1.9, 0.18],
        [-0.2, 0.62],
      ]),
      {
        type: 'linear',
        x0: -2.3,
        y0: 0,
        x1: -0.2,
        y1: 0,
        stops: [
          { offset: 0, color: 'zap2', alpha: 0 },
          { offset: 1, color: 'zap2', alpha: 0.6 },
        ],
      },
    ),
    fill(ellipse(0, 0, 1.25, 1.25), {
      type: 'radial',
      cx: 0,
      cy: 0,
      r: 1.25,
      stops: [
        { offset: 0.45, color: 'zap2', alpha: 0.55 },
        { offset: 1, color: 'zap2', alpha: 0 },
      ],
    }),
    ink(
      poly(
        Array.from({ length: 14 }, (_, i): P => {
          const r = i % 2 ? 0.62 : 0.86 + 0.06 * ((i + k) % 3);
          const a = ((i / 14) * 360 + turn / 2) * (Math.PI / 180);
          return [r * Math.cos(a), r * Math.sin(a)];
        }),
      ),
      'zap2',
      0.12,
    ),
    fill(ellipse(0.05, 0, 0.5, 0.46), 'zap'),
    fill(ellipse(0.12, -0.08, 0.22, 0.18), 'eye'),
    ...bolt(arc(-50, 0.15), 0.1),
    ...bolt(arc(70, 0.05), 0.1),
    ...bolt(arc(190, 0.2), 0.1),
  ];
};

/** The flash as the shot leaves the prongs: a spiky white-cored burst (prong space). */
export const zapFlash: PathShape[] = [
  fill(ellipse(0.6, 0, 1.4, 1.1), {
    type: 'radial',
    cx: 0.6,
    cy: 0,
    r: 1.4,
    stops: [
      { offset: 0, color: 'zap', alpha: 0.9 },
      { offset: 0.6, color: 'zap2', alpha: 0.35 },
      { offset: 1, color: 'zap2', alpha: 0 },
    ],
  }),
  ink(
    poly(
      Array.from({ length: 12 }, (_, i): P => {
        const r = i % 2 ? 0.35 : i % 4 ? 0.85 : 1.25;
        const a = (i / 12) * Math.PI * 2;
        return [0.5 + r * Math.cos(a), r * 0.8 * Math.sin(a)];
      }),
    ),
    'zap',
    0.12,
  ),
  fill(ellipse(0.5, 0, 0.3, 0.26), 'eye'),
];

export const zaps: Record<string, PathShape[] | { loop: string[]; fps: number }> = {
  zapCrackle0: crackle(0),
  zapCrackle1: crackle(1),
  zapCrackle2: crackle(2),
  zapCrackle: { loop: ['zapCrackle0', 'zapCrackle1', 'zapCrackle2'], fps: 30 },
  zapFlash,
  stunShot0: shotDrawing(0),
  stunShot1: shotDrawing(1),
  stunShot2: shotDrawing(2),
  stunShot: { loop: ['stunShot0', 'stunShot1', 'stunShot2'], fps: 30 },
};

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
// Effects: swing smears and the baton's twirl disc

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

// ---------------------------------------------------------------------------------------------------------
// Shadow Step: the pool Bob sinks into, the shadow over him, its burst as he steps out, and his eyes in the dark

/** Three drawings of a shadow effect, looped at 10 fps on the match clock so the smoke churns while he waits. */
const churn = (draw: (k: number) => PathShape[], name: string) => ({
  [`${name}0`]: draw(0),
  [`${name}1`]: draw(1),
  [`${name}2`]: draw(2),
  [name]: { loop: [`${name}0`, `${name}1`, `${name}2`], fps: 10 },
});

/** A dark flame of shadow rising `h` from (x, 0), its tip leaning `lean` units. */
const wisp = (x: number, h: number, lean: number, w = 0.55): string =>
  blob(
    [
      [x - w, 0.1],
      [x - w * 0.55, -h * 0.45],
      [x + lean, -h],
      [x + w * 0.5, -h * 0.5],
      [x + w, 0.1],
    ],
    0.8,
  );

/**
 * The pool on the floor under him (rig space, centred between the feet): a flat puddle of shadow with a paler rim
 * and dark wisps curling up from it.
 */
const shadowPool = (k: number): PathShape[] => {
  const j = (a: number, b: number, c: number) => [a, b, c][k]!;
  const rim: P[] = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const r = 1 + (i % 2 ? -0.04 : 0.05 + 0.03 * ((i + k) % 3));
    return [6.3 * r * Math.cos(a), 0.15 + 1.05 * r * Math.sin(a)];
  });
  return [
    ink(blob(rim), 'shadow', 0.14),
    stroke(ellipse(0, 0.2, 4.1, 0.55), 0.1, 'shadowHi'),
    ...[
      [-4.6, j(1.6, 2.2, 1.3), j(-0.3, 0.2, -0.5)],
      [-1.9, j(2.6, 1.8, 2.9), j(0.3, -0.2, 0.1)],
      [2.2, j(2.0, 2.8, 1.7), j(-0.2, 0.4, 0.3)],
      [4.7, j(1.3, 1.6, 2.1), j(0.4, -0.1, 0.5)],
    ].map(([x, h, lean]) => ink(wisp(x!, h!, lean!), 'shadow', 0.12)),
  ];
};

/**
 * The shadow over him while he hides: a lumpy column of smoke from the floor to just over his beanie (rig space,
 * feet at the origin), darkest at the floor and see-through enough near the top that his shape shows inside it.
 */
const shadowVeil = (k: number): PathShape[] => {
  const j = (a: number, b: number, c: number) => [a, b, c][k]!;
  const outline: P[] = [
    [-5.4, 0.5],
    [-5.3 + j(0, 0.2, -0.2), -2.4],
    [-5.9, -4.9 + j(0, -0.3, 0.2)],
    [-5.6 + j(0.2, 0, -0.2), -7.2],
    [-6.8, -9.3 + j(0, 0.2, -0.2)],
    [-5.9, -12.1],
    [-3.6 + j(0, 0.2, -0.1), -13.6],
    [-2.0, -13.2],
    [-0.7, -13.3 + j(0, 0.25, -0.15)],
    [1.5 + j(0, -0.2, 0.1), -12.9],
    [3.6, -11.9 + j(0, -0.2, 0.2)],
    [5.6, -10.0],
    [5.6 + j(0, -0.2, 0.2), -7.6],
    [5.0, -5.2 + j(0, 0.3, -0.2)],
    [5.7 + j(0.1, -0.1, 0), -2.8],
    [5.4, 0.5],
    [2.4, 1.0],
    [-2.6, 1.0],
  ];
  return [
    {
      d: blob(outline, 0.9),
      fill: {
        type: 'linear',
        x0: 0,
        y0: -13.3,
        x1: 0,
        y1: 1,
        stops: [
          { offset: 0, color: 'shadow', alpha: 0.8 },
          { offset: 0.55, color: 'shadow', alpha: 0.88 },
          { offset: 1, color: 'shadow', alpha: 0.96 },
        ],
      },
      stroke: { color: 'shadowHi', width: 0.16 },
    },
    stroke(
      curve([
        [-3.6, -2.6 + j(0, 0.3, -0.3)],
        [-2.2, -4.2],
        [-3.3, -5.8 + j(0, -0.2, 0.3)],
      ]),
      0.12,
      'shadowHi',
    ),
    stroke(
      curve([
        [3.4, -6.2 + j(0, -0.3, 0.2)],
        [2.1, -7.9],
        [3.2, -9.6 + j(0, 0.2, -0.3)],
      ]),
      0.12,
      'shadowHi',
    ),
    stroke(
      curve([
        [-1.6 + j(0, 0.3, -0.2), -10.8],
        [0.2, -11.7],
        [1.8 + j(0, -0.2, 0.3), -10.9],
      ]),
      0.1,
      'shadowHi',
    ),
  ];
};

/** A round puff of smoke at (x, y), radius r, its edge lumpy with `lobes` bumps. */
const puff = (x: number, y: number, r: number, lobes = 7, turn = 0): string =>
  blob(
    Array.from({ length: lobes * 2 }, (_, i): P => {
      const a = ((i / (lobes * 2)) * 360 + turn) * (Math.PI / 180);
      const k = i % 2 ? 0.93 : 1.05;
      return [x + r * k * Math.cos(a), y + r * k * Math.sin(a)];
    }),
  );

/**
 * The shadow going "poof" as he springs out of it: a ring of dark smoke puffs round his middle (rig space, centred
 * on (0, -6)) with a few specks thrown clear. Clips grow it and drop it within a few frames.
 */
export const shadowBurst: PathShape[] = [
  ...Array.from({ length: 9 }, (_, i) => {
    const a = ((i * 40 + (i % 2 ? 8 : -5)) * Math.PI) / 180;
    const d = i % 3 === 1 ? 4.9 : 4.3;
    const r = [1.7, 1.35, 1.55][i % 3]!;
    const [x, y] = [d * Math.cos(a), -6 + d * 1.05 * Math.sin(a)];
    return {
      d: puff(x, y, r, 8, i * 23),
      fill: {
        type: 'radial' as const,
        cx: x - r * 0.3,
        cy: y - r * 0.3,
        r: r * 1.3,
        stops: [
          { offset: 0, color: 'shadowHi', alpha: 0.9 },
          { offset: 0.55, color: 'shadow', alpha: 0.92 },
          { offset: 1, color: 'shadow', alpha: 0.85 },
        ],
      },
      stroke: { color: 'shadow', width: 0.14 },
    };
  }),
  ...[
    [-6.9, -9.4, 0.42],
    [6.6, -2.8, 0.36],
    [6.2, -10.6, 0.3],
    [-6.4, -1.9, 0.34],
    [0.4, -12.6, 0.38],
  ].map(([x, y, r]) => ink(ellipse(x!, y!, r!, r!), 'shadow', 0.08)),
];

export const shadows: Record<string, PathShape[] | { loop: string[]; fps: number }> = {
  ...churn(shadowPool, 'shadowPool'),
  ...churn(shadowVeil, 'shadowVeil'),
  shadowBurst,
};
