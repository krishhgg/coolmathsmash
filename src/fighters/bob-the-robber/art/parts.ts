import type { PathShape } from '../../../render/rig/types';
import { bands, blob, curve, ellipse, line, n, poly, tube, type P } from './shapes';

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
        [3.05, -0.22],
        [b + 0.9, 0.42],
        [b, 0.8],
        [b - 0.78, 0.5],
        [m, -0.12],
        [a + 0.78, 0.5],
        [a, 0.8],
        [a - 0.9, 0.42],
        [-3.05, -0.22],
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
      sly: [EYE_Y - 0.28, EYE_Y - 0.22],
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
  [3.1, 0.45],
  [2.75, 0.86],
  [1.4, 0.99],
  [0, 1.02],
  [-1.4, 0.99],
  [-2.75, 0.86],
  [-3.1, 0.45],
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
      [3.02, 0.45],
      [2.52, 0.82],
      [2.3, -0.8],
      [2.06, -2.34],
    ]),
    'shirtLo',
  ),
];

/** The striped shirt, flaring into a bell at the hem: white with three black hoops, shaded on the far side. */
export const torso: PathShape[] = [
  ...shirtBase,
  ...bands(
    torsoOutline,
    [
      [-2.62, -2.02],
      [-1.5, -0.9],
      [-0.36, 0.26],
    ],
    0.24,
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
