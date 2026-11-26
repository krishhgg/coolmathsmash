import type { Paint, PathShape } from '../../../render/rig/types';

/**
 * Papa Louie's parts, drawn from scratch in the Flipline Flash style: round shapes in flat colours with one
 * shade tone and a dark brown ink line. Each part sits in its bone's space (y down); limbs and the paddle hang
 * down the bone's +y axis from its origin.
 */

const K = 0.5523;
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Ink width: the outline shows this far outside every part. */
export const LINE = 0.2;

export function ellipse(x: number, y: number, rx: number, ry: number): string {
  return [
    `M${n(x + rx)} ${n(y)}`,
    `C${n(x + rx)} ${n(y + K * ry)} ${n(x + K * rx)} ${n(y + ry)} ${n(x)} ${n(y + ry)}`,
    `C${n(x - K * rx)} ${n(y + ry)} ${n(x - rx)} ${n(y + K * ry)} ${n(x - rx)} ${n(y)}`,
    `C${n(x - rx)} ${n(y - K * ry)} ${n(x - K * rx)} ${n(y - ry)} ${n(x)} ${n(y - ry)}`,
    `C${n(x + K * rx)} ${n(y - ry)} ${n(x + rx)} ${n(y - K * ry)} ${n(x + rx)} ${n(y)}Z`,
  ].join('');
}

/** Closed capsule from (x, y0) radius r0 to (x, y1) radius r1. */
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

/** Rounded rectangle. */
export function rrect(x0: number, y0: number, x1: number, y1: number, r: number): string {
  const k = r * (1 - K);
  return [
    `M${n(x0 + r)} ${n(y0)}L${n(x1 - r)} ${n(y0)}C${n(x1 - k)} ${n(y0)} ${n(x1)} ${n(y0 + k)} ${n(x1)} ${n(y0 + r)}`,
    `L${n(x1)} ${n(y1 - r)}C${n(x1)} ${n(y1 - k)} ${n(x1 - k)} ${n(y1)} ${n(x1 - r)} ${n(y1)}`,
    `L${n(x0 + r)} ${n(y1)}C${n(x0 + k)} ${n(y1)} ${n(x0)} ${n(y1 - k)} ${n(x0)} ${n(y1 - r)}`,
    `L${n(x0)} ${n(y0 + r)}C${n(x0)} ${n(y0 + k)} ${n(x0 + k)} ${n(y0)} ${n(x0 + r)} ${n(y0)}Z`,
  ].join('');
}

/** Path data mirrored left to right (x -> -x). Paths here use absolute M, L, C and Z only. */
export function mirror(d: string): string {
  return transform(d, (x, y) => [-x, y]);
}

/** Path data moved by (dx, dy) and scaled by s about the origin first. */
export function place(d: string, dx: number, dy: number, s = 1): string {
  return transform(d, (x, y) => [x * s + dx, y * s + dy]);
}

function transform(d: string, f: (x: number, y: number) => [number, number]): string {
  const tokens = d.match(/[MLCZ]|-?[0-9.]+(?:e-?d+)?/g) ?? [];
  let out = '';
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i]!;
    if (/[MLCZ]/.test(t)) {
      out += t;
      i++;
      continue;
    }
    const [x, y] = f(Number(t), Number(tokens[i + 1]));
    out += (/[0-9]$/.test(out) ? ' ' : '') + n(x) + ' ' + n(y);
    i += 2;
  }
  return out;
}

/** Shapes stretched about the origin by (sx, sy), keeping their ink widths. */
export function resize(shapes: PathShape[], sx: number, sy = sx): PathShape[] {
  return shapes.map((p) => ({ ...p, d: transform(p.d, (x, y) => [x * sx, y * sy]) }));
}

/** Shapes placed by (dx, dy) and scaled by s (outlines thicken with s). */
export function moved(shapes: PathShape[], dx: number, dy: number, s = 1): PathShape[] {
  return shapes.map((p) => ({
    ...p,
    d: place(p.d, dx, dy, s),
    ...(p.stroke ? { stroke: { ...p.stroke, width: p.stroke.width * s } } : {}),
  }));
}

/**
 * Shapes inked the Flash way: every outline goes under every fill, so the pieces of one part (a skull and its
 * ear, a blade and its handle) join without seams and only the silhouette is outlined. Details go on top.
 */
export function inked(shapes: [string, Paint][], details: PathShape[] = [], width = LINE): PathShape[] {
  return [
    ...shapes.map(([d]) => ({ d, stroke: { color: 'line', width: width * 2 } })),
    ...shapes.map(([d, fill]) => ({ d, fill })),
    ...details,
  ];
}

const line = (d: string, color = 'line', width = 0.12): PathShape => ({ d, stroke: { color, width } });

/** A shape with its own outline on top of whatever it overlaps (a nose on a face). */
const outlined = (d: string, fill: Paint, width = 0.14): PathShape => ({
  d,
  fill,
  stroke: { color: 'line', width },
});

// --- Legs and shoes --------------------------------------------------------------------------------------

export const THIGH = 1.1;
export const SHIN = 1.1;
const LEG_R = 0.62;

/** A blue trouser segment from the origin down +y, as an outline symbol and a fill symbol (no seam at the knee). */
function legPart(len: number, r0: number, r1: number) {
  return {
    line: [{ d: tube(0, 0, len, r0 + LINE, r1 + LINE), fill: 'line' }],
    fill: [
      { d: tube(0, 0, len, r0, r1), fill: 'pants' },
      { d: tube(-r0 * 0.45, len * 0.05, len * 0.9, r0 * 0.38, r1 * 0.32), fill: 'pantsLo' },
    ],
  } satisfies { line: PathShape[]; fill: PathShape[] };
}
export const thigh = legPart(THIGH, LEG_R, LEG_R * 0.95);
export const shin = legPart(SHIN, LEG_R * 0.95, LEG_R * 0.85);

/** His big brown shoe: the ankle at the origin, the sole 1 unit below it, the round toe pointing forward. */
export const shoe = inked(
  [
    [
      'M-0.95 0.1C-1.35 0.4 -1.3 1 -0.8 1L1.95 1C2.75 1 2.9 0.3 2.3 -0.1C1.75 -0.45 0.75 -0.55 0.15 -0.45C-0.35 -0.4 -0.75 -0.2 -0.95 0.1Z',
      'shoe',
    ],
  ],
  [
    {
      d: 'M-1.12 0.7L2.68 0.7C2.58 0.92 2.3 1 1.95 1L-0.8 1C-1.02 0.98 -1.15 0.88 -1.12 0.7Z',
      fill: 'shoeLo',
    },
    { d: ellipse(1.55, 0.02, 0.5, 0.17), fill: 'shoeHi' },
    line('M-0.35 -0.32C0 -0.05 0.25 0.05 0.55 0.02', 'shoeLo', 0.1),
  ],
);

// --- Body ------------------------------------------------------------------------------------------------

/** The white chef's coat: the hips at the origin, the shoulders 5 up, the round belly forward (+x). */
export const torso = resize(
  inked(
    [
      [
        'M-2.32 0.38C-2.22 -0.65 -1.89 -1.6 -1.71 -2.8C-1.58 -3.7 -1.61 -4.8 -0.87 -5.18C-0.32 -5.46 0.64 -5.28 1.2 -4.96C1.77 -4.62 1.65 -3.67 1.96 -2.8C2.23 -1.93 2.6 -0.89 2.69 0.42C1.05 0.83 -0.78 0.83 -2.32 0.38Z',
        'coat',
      ],
    ],
    [
      {
        d: 'M-2.32 0.38C-2.22 -0.65 -1.89 -1.6 -1.71 -2.8C-1.58 -3.7 -1.61 -4.8 -0.87 -5.18C-1.01 -3.74 -1.29 -1.97 -1.34 -0.87C-1.39 -0.23 -1.4 0.24 -1.42 0.61Z',
        fill: 'coatLo',
      },
      line('M0.24 -5.1C0.47 -3.4 0.52 -1.66 0.88 0.62', 'coatLo', 0.13),
      ...[
        [0.09, -4.1],
        [0.16, -3.05],
        [0.22, -2.02],
        [0.32, -0.97],
      ].map(([x, y]) => outlined(ellipse(x!, y!, 0.17, 0.17), 'button', 0.06)),
    ],
  ),
  0.94,
  0.98,
);

/** The red apron tied round his middle, with the bow's tail flying behind. Origin at the hips. */
export const apron = inked(
  [
    [
      'M-2.26 -0.69C-0.78 -0.32 1.19 -0.33 2.53 -0.78L2.47 -0.17C2.37 0.03 2.04 0.1 1.75 0.17C1.94 0.6 2.18 1.39 2.11 1.8C1.68 2.09 0.92 2.01 0.4 1.84C-0.17 1.99 -0.87 1.9 -1.25 1.62C-1.59 1.75 -1.97 1.51 -2.15 1.27C-2.15 0.69 -1.94 0.18 -1.95 -0.02C-2.09 -0.13 -2.25 -0.35 -2.26 -0.69Z',
      'apron',
    ],
    ['M-2.11 -0.59C-2.85 -0.55 -3.18 -0.02 -3.16 0.48C-2.74 0.13 -2.39 0.19 -2.08 -0.14Z', 'apron'],
  ],
  [
    {
      d: 'M-1.95 -0.02C-1.63 0.1 -1.32 0.16 -1.16 0.18C-1.38 0.68 -1.49 1.25 -1.25 1.62C-1.59 1.75 -1.97 1.51 -2.15 1.27C-2.15 0.69 -1.94 0.18 -1.95 -0.02Z',
      fill: 'apronLo',
    },
    line('M-1.95 -0.02C-0.72 0.33 0.71 0.42 1.75 0.17', 'apronLo', 0.12),
    line('M0.4 0.31C0.24 0.89 0.37 1.32 0.4 1.84', 'apronLo', 0.14),
  ],
);

export const royWaist = inked(
  [
    ['M-2.13 -0.4C-0.85 -0.06 1.21 -0.13 2.4 -0.47L2.44 0.37C1.27 0.7 -0.52 0.73 -2.11 0.4Z', 'pants'],
    ['M-2.15 -0.6C-0.84 -0.25 1.28 -0.31 2.44 -0.66L2.42 -0.27C0.98 0.12 -0.78 0.1 -2.14 -0.23Z', 'apron'],
  ],
  [line('M1.55 0.04C1.51 0.25 1.41 0.39 1.22 0.49', 'pantsLo', 0.1)],
);

/** The red neckerchief, knotted at the front with two tails. Origin where the neck meets the coat. */
export const scarf = inked(
  [
    ['M-1.25 -0.35C-0.4 0.1 0.6 0.1 1.45 -0.35L1.6 0.3C0.7 0.85 -0.45 0.85 -1.3 0.35Z', 'scarf'],
    ['M1 0.45L0.5 1.6L1.2 1.3Z', 'scarf'],
    ['M1.35 0.45L2.05 1.5L2.3 0.85Z', 'scarf'],
    [ellipse(1.18, 0.38, 0.46, 0.38), 'scarf'],
  ],
  [{ d: ellipse(1.05, 0.48, 0.22, 0.17), fill: 'scarfLo' }],
);

// --- Head ------------------------------------------------------------------------------------------------

/**
 * His tall bald egg of a head, centred on the origin, turned three-quarters to the right like Flipline's art: no
 * nose or ears drawn, just the dot eyes, high arched brows and the moustache doing all the work.
 */
export const head = inked(
  [
    [
      'M0 -1.75C0.95 -1.75 1.45 -1 1.45 0C1.45 0.9 0.85 1.45 0.05 1.45C-0.8 1.45 -1.35 0.9 -1.35 0C-1.35 -1 -0.9 -1.75 0 -1.75Z',
      'skin',
    ],
  ],
  [
    {
      d: 'M-0.45 -1.68C-1.05 -1.45 -1.35 -0.8 -1.35 0C-1.35 0.9 -0.8 1.45 0.05 1.45C-0.55 1.2 -0.9 0.65 -0.95 0C-1 -0.75 -0.8 -1.3 -0.45 -1.68Z',
      fill: 'skinLo',
    },
    { d: ellipse(-0.25, -1.2, 0.55, 0.26), fill: 'skinHi' },
  ],
);

/** The thin neck between his collar and his chin, from the neck bone up. */
export const neckSkin = inked(
  [[tube(0, 0.1, -1.5, 0.3, 0.32), 'skin']],
  [{ d: tube(-0.12, 0, -1.3, 0.12, 0.12), fill: 'skinLo' }],
);

const EYES = [0.2, 0.85];
const EYE_Y = -0.1;

/** Arched brows high on the forehead: each a crescent, thick in the middle. `tilt` lifts the inner ends (+) or drops them (-). */
function browArcs(tilt = 0, lift = 0): PathShape[] {
  return EYES.map((x, i) => {
    const inner = i === 0 ? 1 : -1;
    const yIn = -0.95 - lift - tilt * 0.25;
    const yOut = -0.95 - lift + tilt * 0.25;
    const [yl, yr] = inner === 1 ? [yOut, yIn] : [yIn, yOut];
    const top = -1.45 - lift;
    return {
      d: `M${n(x - 0.36)} ${n(yl)}C${n(x - 0.27)} ${n(top - 0.05)} ${n(x + 0.27)} ${n(top - 0.05)} ${n(x + 0.36)} ${n(yr)}C${n(x + 0.18)} ${n(top + 0.24)} ${n(x - 0.18)} ${n(top + 0.24)} ${n(x - 0.36)} ${n(yl)}Z`,
      fill: 'brow',
      stroke: { color: 'brow', width: 0.06 },
    };
  });
}

/** Small round eyes: a thin white ring round a big black pupil, as Flipline draws them. */
function eyes(look = 0.05, open = 1, up = 0): PathShape[] {
  return EYES.flatMap((x) => [
    outlined(ellipse(x, EYE_Y, 0.22, 0.3 * open), 'eyeWhite', 0.07),
    { d: ellipse(x + look, EYE_Y - up, 0.15, 0.22 * open), fill: 'eye' },
    { d: ellipse(x + look + 0.04, EYE_Y - up - 0.07 * open, 0.04, 0.05), fill: 'eyeWhite' },
  ]);
}
const shut = (): PathShape[] =>
  EYES.map((x) =>
    line(
      `M${n(x - 0.2)} ${n(EYE_Y)}C${n(x - 0.07)} ${n(EYE_Y + 0.12)} ${n(x + 0.07)} ${n(EYE_Y + 0.12)} ${n(x + 0.2)} ${n(EYE_Y)}`,
      'eye',
      0.1,
    ),
  );
const squint: PathShape[] = EYES.map((x, i) =>
  line(
    i === 0
      ? `M${n(x - 0.2)} ${n(EYE_Y - 0.18)}L${n(x + 0.18)} ${n(EYE_Y)}L${n(x - 0.2)} ${n(EYE_Y + 0.18)}`
      : `M${n(x + 0.2)} ${n(EYE_Y - 0.18)}L${n(x - 0.18)} ${n(EYE_Y)}L${n(x + 0.2)} ${n(EYE_Y + 0.18)}`,
    'eye',
    0.1,
  ),
);
const dazed: PathShape[] = EYES.flatMap((x) => [
  outlined(ellipse(x, EYE_Y, 0.22, 0.28), 'eyeWhite', 0.07),
  line(
    `M${n(x - 0.1)} ${n(EYE_Y - 0.08)}C${n(x - 0.03)} ${n(EYE_Y - 0.22)} ${n(x + 0.14)} ${n(EYE_Y - 0.12)} ${n(x + 0.08)} ${n(EYE_Y + 0.02)}C${n(x + 0.03)} ${n(EYE_Y + 0.15)} ${n(x - 0.14)} ${n(EYE_Y + 0.08)} ${n(x - 0.07)} ${n(EYE_Y - 0.02)}`,
    'eye',
    0.06,
  ),
]);

export const faces: Record<string, PathShape[]> = {
  face: [...eyes(), ...browArcs()],
  faceBlink: [...shut(), ...browArcs()],
  faceAngry: [...eyes(0.06, 0.85), ...browArcs(-1, -0.08)],
  faceHurt: [...squint, ...browArcs(1)],
  faceWorried: [...eyes(-0.01, 1.05), ...browArcs(1, 0.05)],
  faceDazed: [...dazed, ...browArcs(1)],
  faceBack: [...eyes(-0.07), ...browArcs()],
  faceUp: [...eyes(0.03, 1, 0.07), ...browArcs(0, 0.1)],
};

/** The great black handlebar moustache, centred under his eyes, each side drooping and then curling up. */
const STACHE_R =
  'M0 -0.3C0.4 -0.83 0.89 -0.65 1.18 -0.13C1.52 0.49 2.09 0.58 2.39 0.14C2.33 0.91 1.58 1.11 1.03 0.91C0.52 0.73 0.25 0.49 0 0.29Z';
const STACHE_L = mirror(STACHE_R);
const stacheShapes = (): PathShape[] => [
  { d: STACHE_R + STACHE_L, fill: 'stache', stroke: { color: 'stache', width: 0.1 } },
  line('M0.31 -0.23C0.67 -0.51 0.94 -0.19 1.16 0.2C1.33 0.49 1.57 0.59 1.8 0.59', 'stacheHi', 0.08),
  line(mirror('M0.31 -0.23C0.67 -0.51 0.94 -0.19 1.16 0.2C1.33 0.49 1.57 0.59 1.8 0.59'), 'stacheHi', 0.08),
];
export const stache = stacheShapes();
/** Mouth wide open under the moustache (shouting, hurt). */
export const stacheShout: PathShape[] = [
  outlined('M-0.5 0.3C-0.45 1.2 0.45 1.2 0.5 0.3Z', 'mouth', 0.1),
  { d: 'M-0.28 0.88C-0.1 0.74 0.12 0.74 0.3 0.88C0.14 1.04 -0.14 1.04 -0.28 0.88Z', fill: 'tongue' },
  ...stacheShapes(),
];
/** A gritted grin under the moustache (effort). */
export const stacheGrit: PathShape[] = [
  outlined('M-0.55 0.35C-0.28 0.75 0.28 0.75 0.55 0.35C0.28 0.5 -0.28 0.5 -0.55 0.35Z', 'eyeWhite', 0.08),
  ...stacheShapes(),
];

/** The chef's toque: its band sits on the head at the origin, the puff rises above it. */
export const hat = resize(
  inked(
    [
      [
        'M-1.44 0.23C-1.59 -0.52 -1.84 -1.11 -2.06 -1.89L0.34 -2.35C0.68 -1.54 1.09 -0.7 1.37 -0.19C0.52 0.24 -0.38 0.47 -1.44 0.23Z',
        'hat',
      ],
      [
        'M-2.02 -1.45C-2.57 -1.26 -3.36 -1.54 -3.1 -2.18C-3.94 -2.3 -4.02 -3.24 -3.42 -3.62C-2.83 -4.03 -1.88 -3.99 -1.2 -3.28C-1 -3.83 -0.19 -4.01 0.29 -3.69C0.63 -3.48 0.74 -3.09 0.6 -2.83C1.18 -3.1 1.87 -2.64 1.68 -2.11C1.55 -1.67 0.9 -1.45 0.41 -1.63C0.18 -2.07 -0.03 -2.27 -0.26 -2.27C-0.96 -2.3 -1.86 -1.9 -2.02 -1.45Z',
        'hat',
      ],
    ],
    [
      {
        d: 'M-1.44 0.23C-1.47 0.02 -1.56 -0.23 -1.64 -0.51C-0.64 -0.31 0.33 -0.48 1.03 -0.84L1.37 -0.19C0.52 0.24 -0.38 0.47 -1.44 0.23Z',
        fill: 'hatLo',
      },
      {
        d: 'M-2.02 -1.45C-2.57 -1.26 -3.36 -1.54 -3.1 -2.18C-3.65 -2.26 -3.91 -2.7 -3.78 -3.07C-3.59 -2.56 -2.71 -2.56 -2.33 -2.66C-2.12 -2.55 -1.93 -2.5 -1.61 -2.52C-1.94 -2.22 -2.06 -1.91 -2.02 -1.45Z',
        fill: 'hatLo',
      },
      line('M-1.2 -3.28C-1.31 -2.96 -1.26 -2.74 -1.11 -2.53', 'hatLo', 0.13),
      line('M0.6 -2.83C0.49 -2.6 0.27 -2.39 0.06 -2.32', 'hatLo', 0.13),
      line('M-1.52 -1.86L-1.07 -0.42M-0.88 -2.04L-0.44 -0.48M-0.26 -2.14L0.24 -0.58', 'hatLo', 0.11),
    ],
  ),
  0.88,
  0.79,
);

/** The toque held overhead and puffed out like a parachute: his glide in When Pizzas Attack!. */
export const hatChute = inked(
  [
    [
      'M-3.2 0.2C-3.6 -1.8 -1.8 -3.4 0 -3.4C1.8 -3.4 3.6 -1.8 3.2 0.2C2.3 -0.3 1.6 0.3 1 -0.1C0.4 0.35 -0.4 0.35 -1 -0.1C-1.6 0.3 -2.3 -0.3 -3.2 0.2Z',
      'hat',
    ],
  ],
  [
    {
      d: 'M-3.2 0.2C-3.35 -0.6 -3.15 -1.3 -2.7 -1.9C-2.4 -1.2 -1.6 -0.6 -1 -0.1C-1.6 0.3 -2.3 -0.3 -3.2 0.2Z',
      fill: 'hatLo',
    },
    line('M-1 -0.1C-0.9 -1.2 -0.6 -2.2 -0.1 -3.3', 'hatLo', 0.12),
    line('M1 -0.1C1 -1.2 0.9 -2.3 0.6 -3.3', 'hatLo', 0.12),
  ],
);

export const cap = moved(
  inked(
    [
      ['M-1.65 0.09C-1.75 -1.54 -0.72 -2.5 0.55 -2.16C1.48 -1.93 1.83 -0.95 1.5 -0.19Z', 'hat'],
      ['M0.08 -0.27C1 -1.08 2.48 -0.9 3.05 -0.35C3.51 0.1 2.46 0.49 1.19 0.27Z', 'scarf'],
    ],
    [
      {
        d: 'M-1.65 0.09C-1.72 -0.88 -1.36 -1.64 -0.77 -1.96C-1.03 -1.28 -1.02 -0.65 -0.78 0.03Z',
        fill: 'hatLo',
      },
      line('M0.55 -2.16C0.97 -1.76 1.04 -1.29 1.02 -0.71', 'hatLo'),
      { d: ellipse(0.44, -1.19, 0.35, 0.32), fill: 'eyeWhite' },
    ],
  ),
  0.22,
  0.48,
);

export const captainHat = moved(
  inked(
    [
      [
        'M-2.7 -0.8C-1.96 -1.13 -1.53 -2.38 -0.91 -2.47C-0.44 -2.52 -0.15 -2.04 0.14 -2.03C0.63 -2.16 0.94 -2.55 1.47 -2.21C1.91 -1.94 2.08 -1.21 2.76 -0.91C2.41 0.12 1.07 0.5 0 0.42C-0.95 0.44 -2.43 0.17 -2.7 -0.8Z',
        'hat',
      ],
    ],
    [
      line('M-2.33 -0.68C-1.77 0.02 -0.66 0.23 0 0.15C0.85 0.24 1.92 -0.11 2.4 -0.8', 'hatLo', 0.22),
      { d: ellipse(0.22, -1.09, 0.31, 0.37), fill: 'coat' },
    ],
  ),
  0.14,
  0.31,
);

// --- Arms and hands ---------------------------------------------------------------------------------------

export const UPPER_ARM = 1.9;
export const FORE_ARM = 1.55;
const ARM_R = 0.55;

/** A white sleeve segment down +y, as an outline symbol and a fill symbol. */
function sleevePart(len: number, r0: number, r1: number, cuff: boolean) {
  return {
    line: [{ d: tube(0, 0, len, r0 + LINE, r1 + LINE), fill: 'line' }],
    fill: [
      { d: tube(0, 0, len, r0, r1), fill: 'coat' },
      { d: tube(-r0 * 0.45, len * 0.1, len * 0.85, r0 * 0.35, r1 * 0.3), fill: 'coatLo' },
      ...(cuff ? [{ d: tube(0, len - 0.2, len, r1 + 0.02, r1 + 0.04), fill: 'coatLo' }] : []),
    ],
  } satisfies { line: PathShape[]; fill: PathShape[] };
}
export const upperArm = sleevePart(UPPER_ARM, ARM_R, ARM_R * 0.92, false);
export const foreArm = sleevePart(FORE_ARM, ARM_R * 0.92, ARM_R * 0.85, true);

/** An open glove-less hand: the wrist at the origin, fingers down +y, thumb on the +x side. */
export const handOpen = inked(
  [
    [ellipse(0, 0.55, 0.62, 0.58), 'skin'],
    [tube(-0.38, 0.75, 1.15, 0.19, 0.17), 'skin'],
    [tube(0, 0.8, 1.32, 0.2, 0.18), 'skin'],
    [tube(0.38, 0.75, 1.18, 0.19, 0.17), 'skin'],
    ['M0.4 0.3C0.85 0.1 1.15 0.3 1 0.6C0.9 0.78 0.62 0.75 0.5 0.65Z', 'skin'],
  ],
  [{ d: ellipse(-0.25, 0.45, 0.25, 0.2), fill: 'skinLo' }],
);

/** A closed fist (also his grip on the paddle's handle). */
export const fist = inked(
  [
    [ellipse(0, 0.6, 0.66, 0.6), 'skin'],
    ['M0.45 0.25C0.9 0.25 1.05 0.6 0.85 0.85C0.7 1 0.45 0.95 0.35 0.8Z', 'skin'],
  ],
  [
    line('M-0.45 0.95C-0.2 1.1 0.15 1.1 0.35 0.95', 'skinLo', 0.1),
    line('M-0.55 0.65C-0.3 0.8 0 0.8 0.2 0.7', 'skinLo', 0.08),
  ],
);

// --- Paddle and props ------------------------------------------------------------------------------------

/** Distance from his grip to the far end of the paddle's blade. */
export const PADDLE = 8.6;

/** The wooden pizza peel: gripped at the origin, the handle and then the blade running down +y. */
export const paddle = inked(
  [
    [rrect(-0.32, -0.75, 0.32, 3, 0.3), 'wood'],
    ['M-0.32 2.7L0.32 2.7L1 3.45L-1 3.45Z', 'wood'],
    [
      'M-0.95 3.3C-1.65 3.35 -2.1 3.65 -2.1 4.35L-2.1 7.4C-2.1 8.2 -1.6 8.6 -0.9 8.6L0.9 8.6C1.6 8.6 2.1 8.2 2.1 7.4L2.1 4.35C2.1 3.65 1.65 3.35 0.95 3.3Z',
      'wood',
    ],
  ],
  [
    {
      d: 'M-2.1 4.35C-2.1 3.65 -1.65 3.35 -0.95 3.3C-1.35 3.7 -1.5 4.3 -1.5 5L-1.5 7.6C-1.5 8.1 -1.35 8.4 -1.1 8.6L-0.9 8.6C-1.6 8.6 -2.1 8.2 -2.1 7.4Z',
      fill: 'woodHi',
    },
    {
      d: 'M2.1 4.35C2.1 3.65 1.65 3.35 0.95 3.3C1.35 3.7 1.55 4.3 1.55 5L1.55 7.6C1.55 8.1 1.4 8.4 1.1 8.6L0.9 8.6C1.6 8.6 2.1 8.2 2.1 7.4Z',
      fill: 'woodLo',
    },
    line('M-0.75 4.2C-0.85 5.5 -0.65 6.8 -0.8 8.1', 'grain', 0.08),
    line('M0.35 3.9C0.25 5.4 0.45 6.6 0.3 8.25', 'grain', 0.08),
    line('M1.05 4.6C1.15 5.6 1 6.6 1.1 7.6', 'grain', 0.07),
    { d: ellipse(0, -0.4, 0.13, 0.13), fill: 'line' },
  ],
);

/** His pepper bomb: a glass shaker of red pepper flakes with a punched metal lid. Centred on the origin. */
export const pepperBomb = inked(
  [
    [rrect(-0.75, -0.65, 0.75, 0.95, 0.38), 'glass'],
    ['M-0.62 -0.6C-0.62 -1.25 0.62 -1.25 0.62 -0.6Z', 'metal'],
  ],
  [
    {
      d: 'M-0.68 -0.1C-0.3 0.05 0.3 -0.1 0.68 0L0.68 0.6C0.68 0.8 0.5 0.92 0.3 0.92L-0.3 0.92C-0.5 0.92 -0.68 0.8 -0.68 0.6Z',
      fill: 'flakes',
    },
    ...[
      [-0.35, 0.2],
      [0.1, 0.45],
      [0.4, 0.15],
      [-0.15, 0.65],
      [0.35, 0.7],
    ].map(([x, y]) => ({ d: ellipse(x!, y!, 0.1, 0.07), fill: 'flakesLo' })),
    ...[-0.3, 0, 0.3].map((x) => ({ d: ellipse(x, -0.85, 0.06, 0.06), fill: 'line' })),
    { d: ellipse(-0.45, -0.25, 0.1, 0.25), fill: 'glassHi' },
  ],
);

/** The top of the shaker's inked chrome cap, above its centre: where Parmesan Shaker's spray comes out. */
export const SHAKER_TIP = 1.45;

/** The Parmesan shaker: a taller glass of grated cheese with a green label and a chrome cap. */
export const shaker = inked(
  [
    [rrect(-0.62, -0.85, 0.62, 1.15, 0.3), 'glass'],
    ['M-0.55 -0.8C-0.55 -1.45 0.55 -1.45 0.55 -0.8Z', 'metal'],
  ],
  [
    { d: rrect(-0.56, -0.2, 0.56, 1.1, 0.25), fill: 'cheese' },
    { d: rrect(-0.62, 0.05, 0.62, 0.55, 0.05), fill: 'label' },
    ...[-0.25, 0, 0.25].map((x) => ({ d: ellipse(x, -1.05, 0.05, 0.05), fill: 'line' })),
    { d: ellipse(-0.38, -0.45, 0.09, 0.22), fill: 'glassHi' },
  ],
);

/** A disc of pizza dough, seen from the side, centred on the origin. */
export const dough = inked(
  [[ellipse(0, 0, 2.5, 0.75), 'dough']],
  [
    {
      d: 'M-2.4 0.15C-1.5 0.7 1.5 0.7 2.4 0.15C2.2 0.55 1.4 0.75 0 0.75C-1.4 0.75 -2.2 0.55 -2.4 0.15Z',
      fill: 'doughLo',
    },
    { d: ellipse(-0.6, -0.25, 0.9, 0.18), fill: 'doughHi' },
  ],
);

/** A stack of three pizza boxes, top face up, their bottom at the origin (for Box Stomp). */
export const boxes = inked(
  [0, 1, 2].map(
    (i) =>
      [rrect(-2.3 + i * 0.08, -0.85 * (i + 1), 2.3 - i * 0.06, -0.85 * i, 0.12), 'box'] as [string, Paint],
  ),
  [
    ...[0, 1, 2].map((i) => ({
      d: rrect(-2.25 + i * 0.08, -0.85 * i - 0.3, 2.25 - i * 0.06, -0.85 * i - 0.05, 0.05),
      fill: 'boxLo',
    })),
    line('M-1.2 -2.25C-0.9 -2.45 -0.6 -2.05 -0.3 -2.25C0 -2.45 0.3 -2.05 0.6 -2.25', 'logo', 0.12),
    { d: ellipse(1.3, -2.2, 0.32, 0.22), stroke: { color: 'logo', width: 0.1 } },
  ],
);

/** A paddle smear: a crescent of motion behind a fast swing, its bright edge on the +y side. Spans 0-90 degrees. */
export const swoosh: PathShape[] = [
  {
    d: 'M0 9C3.5 9 7 6.5 8.6 3.2C9 2.3 9.2 1.2 9.2 0.4C8.2 3.6 5.2 6.6 0 7.2Z',
    fill: {
      type: 'linear',
      x0: 0,
      y0: 4,
      x1: 7,
      y1: 8,
      stops: [
        { offset: 0, color: 'swoosh', alpha: 0 },
        { offset: 1, color: 'swoosh', alpha: 0.85 },
      ],
    },
  },
];

export const rotorTrail: PathShape[] = [
  {
    d: 'M-5.6 0.45C-4.4 -2.05 3.31 -2.2 5.91 -0.3C5.36 2 -2.83 2.4 -5.95 1.01C-1.37 1.97 4.5 0.96 4.39 -0.08C3.7 -0.91 -1.9 -1.38 -5.6 0.45Z',
    fill: {
      type: 'linear',
      x0: -5.6,
      y0: 0,
      x1: 5.9,
      y1: 0,
      stops: [
        { offset: 0, color: 'swoosh', alpha: 0 },
        { offset: 0.72, color: 'woodHi', alpha: 0.8 },
        { offset: 1, color: 'swoosh', alpha: 0.96 },
      ],
    },
  },
];

/** A brick oven mouth with fire inside (Brick Oven, his back throw). Its floor is at the origin. */
export const oven = inked(
  [['M-3 0L-3 -3C-3 -5.2 3 -5.2 3 -3L3 0Z', 'brick']],
  [
    { d: 'M-1.9 0L-1.9 -2.6C-1.9 -3.9 1.9 -3.9 1.9 -2.6L1.9 0Z', fill: 'ovenDark' },
    {
      d: 'M-1.5 0C-1.7 -0.8 -1.1 -1.4 -0.9 -2.1C-0.6 -1.4 -0.3 -1.5 -0.2 -2.4C0.3 -1.6 0.6 -1.7 0.8 -2.2C1.2 -1.4 1.6 -0.8 1.4 0Z',
      fill: 'flame',
    },
    {
      d: 'M-0.9 0C-1 -0.6 -0.5 -0.9 -0.4 -1.3C-0.1 -0.8 0.3 -0.9 0.45 -1.3C0.75 -0.7 0.9 -0.4 0.8 0Z',
      fill: 'flameHi',
    },
    line(
      'M-3 -1.5L-1.9 -1.5M1.9 -1.5L3 -1.5M-2.6 -3.4L-1.6 -3.3M1.6 -3.3L2.6 -3.4M-0.6 -4.3L-0.5 -3.6M0.6 -4.3L0.5 -3.6',
      'brickLo',
      0.12,
    ),
  ],
);

/** A star of `outer.length` spikes round the origin, each reaching its own radius, with notches at `inner`. */
function star(outer: number[], inner: number, turn = 0): string {
  const step = Math.PI / outer.length;
  const at = (r: number, a: number) => `${n(Math.sin(a + turn) * r)} ${n(-Math.cos(a + turn) * r)}`;
  return (
    outer.map((r, i) => `${i ? 'L' : 'M'}${at(inner, 2 * i * step - step)}L${at(r, 2 * i * step)}`).join('') +
    'Z'
  );
}

/**
 * The Pepper Bomb going off: a ragged orange blast with a hot yellow core and pepper flakes flying out, centred on
 * the origin. It spans about 10 units, between the burst's 3.8 and 6.3 hit radii.
 */
export const pepperBurst: PathShape[] = [
  ...inked(
    [
      [star([5.2, 4.5, 5.5, 4.7, 5.0, 4.4, 5.4, 4.8, 5.1, 4.5, 5.6, 4.6], 3.4), 'flame'],
      [star([3.6, 3.1, 3.8, 3.2, 3.5, 3.0, 3.7, 3.3, 3.6, 3.1, 3.8, 3.2], 2.4, 0.26), 'flameHi'],
    ],
    [
      { d: ellipse(0, 0, 1.5, 1.3), fill: 'cheese' },
      ...[
        [-2.6, -1.2, 0.4],
        [1.9, -2.4, -0.6],
        [2.8, 1.0, 0.9],
        [-1.4, 2.6, -0.3],
        [0.6, 2.2, 0.5],
        [-3.0, 1.1, 1.1],
        [0.2, -3.0, 0.2],
        [3.4, -1.2, -1.0],
      ].map(([x, y]) => ({ d: ellipse(x!, y!, 0.32, 0.2), fill: 'flakes' })),
    ],
  ),
];

/** A puff of pepper flakes shaken out of the shaker's cap at the origin, spreading down +y (the pummel). */
export const pepperDust: PathShape[] = [
  {
    d: 'M-0.15 0.1L0.15 0.1L1.45 4.1C0.7 4.6 -0.7 4.6 -1.45 4.1Z',
    fill: {
      type: 'linear',
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 4.5,
      stops: [
        { offset: 0, color: 'flakes', alpha: 0.45 },
        { offset: 1, color: 'flakes', alpha: 0 },
      ],
    },
  },
  ...inked(
    [
      [0.05, 0.55],
      [-0.25, 1.0],
      [0.3, 1.3],
      [-0.1, 1.75],
      [0.5, 2.05],
      [-0.55, 2.3],
      [0.15, 2.6],
      [-0.3, 3.0],
      [0.7, 3.1],
      [0.0, 3.5],
      [-0.75, 3.55],
      [0.45, 3.9],
      [-0.25, 4.2],
    ].map(
      ([x, y], i) =>
        [ellipse(x!, y!, 0.17 - (i % 3) * 0.02, 0.11), i % 2 ? 'flakesLo' : 'flakes'] as [string, Paint],
    ),
    [],
    0.05,
  ),
];

/** A shred of grated Parmesan at (x, y): a short curled sliver turned `rot` radians, `s` units long. */
function shred(x: number, y: number, s: number, rot: number): string {
  const c = Math.cos(rot);
  const k = Math.sin(rot);
  const at = (u: number, v: number) => `${n(x + u * c - v * k)} ${n(y + u * k + v * c)}`;
  const h = s / 2;
  return `M${at(-h, 0)}C${at(-h * 0.4, -s * 0.32)} ${at(h * 0.4, -s * 0.3)} ${at(h, 0.02 * s)}C${at(h * 0.4, s * 0.16)} ${at(-h * 0.4, s * 0.2)} ${at(-h, 0)}Z`;
}

/** Shreds of cheese inked thinly, alternating the light and the shaded yellow. */
const shreds = (at: number[][]): PathShape[] =>
  inked(
    at.map(
      ([x, y, s, r], i) => [shred(x!, y!, s!, r!), i % 3 === 2 ? 'cheeseLo' : 'cheese'] as [string, Paint],
    ),
    [],
    0.05,
  );

/**
 * The burst of grated Parmesan that each shake throws out of the shaker's cap (Parmesan Shaker), at the origin and
 * spreading down +y: a clump of cloud puffs with shreds flying off it, about 3.6 units across.
 */
export const parmesanPuff: PathShape[] = [
  ...inked(
    [
      [ellipse(0, 1.0, 1.0, 0.95), 'cheese'],
      [ellipse(-0.95, 1.85, 0.85, 0.8), 'cheese'],
      [ellipse(0.95, 1.95, 0.9, 0.85), 'cheese'],
      [ellipse(-0.1, 2.75, 1.05, 0.95), 'cheese'],
    ],
    [
      {
        d: 'M-1.7 2.1C-1.5 2.75 -0.95 3.55 -0.1 3.65C0.75 3.6 1.45 3.05 1.75 2.3C1.2 2.9 0.4 3.15 -0.25 3.1C-0.85 3.05 -1.35 2.7 -1.7 2.1Z',
        fill: 'cheeseLo',
      },
      { d: ellipse(-0.3, 0.65, 0.35, 0.22), fill: 'glassHi' },
    ],
    0.16,
  ),
  ...shreds([
    [-1.9, 3.4, 0.55, 0.7],
    [1.95, 3.2, 0.5, -0.6],
    [0.4, 4.3, 0.55, 0.2],
    [-1.2, 4.0, 0.45, -0.3],
    [2.2, 1.0, 0.45, 1.1],
    [-2.1, 0.9, 0.4, -1.2],
  ]),
];

/** The spray's length: from the cap past the late box, 19.6 units out (moves.ts SHAKER). */
const SPRAY = 22.5;

/** One drawing of the spray, its shreds `shift` units further out than the first drawing's. */
function sprayDrawing(shift: number): PathShape[] {
  const w = (y: number) =>
    0.55 + 3.0 * Math.sin(Math.min(1, y / 13) * (Math.PI / 2)) - Math.max(0, y - 17) * 0.12;
  const edge: string[] = [];
  const steps = 9;
  for (let i = 1; i <= steps; i++) {
    const y0 = (SPRAY - 1.2) * ((i - 1) / steps);
    const y1 = (SPRAY - 1.2) * (i / steps);
    const bulge = 0.45 + (i % 2) * 0.25;
    edge.push(
      `C${n(w(y0) + bulge)} ${n(y0 + (y1 - y0) * 0.25)} ${n(w(y1) + bulge)} ${n(y0 + (y1 - y0) * 0.75)} ${n(w(y1))} ${n(y1)}`,
    );
  }
  const tip = w(SPRAY - 1.2);
  const right = `M${n(w(0))} 0${edge.join('')}`;
  const end = `C${n(tip + 0.6)} ${n(SPRAY - 0.2)} ${n(0.8)} ${n(SPRAY + 0.3)} 0 ${n(SPRAY)}C${n(-0.9)} ${n(SPRAY + 0.35)} ${n(-tip - 0.5)} ${n(SPRAY - 0.1)} ${n(-tip)} ${n(SPRAY - 1.2)}`;
  const left: string[] = [];
  for (let i = steps; i >= 1; i--) {
    const y1 = (SPRAY - 1.2) * (i / steps);
    const y0 = (SPRAY - 1.2) * ((i - 1) / steps);
    const bulge = 0.45 + ((i + 1) % 2) * 0.25;
    left.push(
      `C${n(-w(y1) - bulge)} ${n(y0 + (y1 - y0) * 0.75)} ${n(-w(y0) - bulge)} ${n(y0 + (y1 - y0) * 0.25)} ${n(-w(y0))} ${n(y0)}`,
    );
  }
  const cloud = `${right}${end}${left.join('')}Z`;
  const flecks: number[][] = [];
  for (let i = 0; i < 26; i++) {
    const y = (((i * 0.87 + shift) % 1) * 0.92 + 0.04) * SPRAY;
    const side = ((i * 7) % 11) / 5 - 1;
    flecks.push([side * w(y) * 0.8, y, 0.42 + (i % 4) * 0.07, i * 1.7 + shift * 3]);
  }
  return [
    {
      d: cloud,
      fill: {
        type: 'linear',
        x0: 0,
        y0: 0,
        x1: 0,
        y1: SPRAY,
        stops: [
          { offset: 0, color: 'cheese', alpha: 0.95 },
          { offset: 0.45, color: 'cheeseLo', alpha: 0.7 },
          { offset: 1, color: 'cheeseLo', alpha: 0.3 },
        ],
      },
    },
    {
      d: ellipse(0, SPRAY * 0.3, 1.3, SPRAY * 0.26),
      fill: {
        type: 'linear',
        x0: 0,
        y0: 0,
        x1: 0,
        y1: SPRAY * 0.6,
        stops: [
          { offset: 0, color: 'swoosh', alpha: 0.6 },
          { offset: 1, color: 'swoosh', alpha: 0 },
        ],
      },
    },
    ...shreds(flecks),
  ];
}

/**
 * Parmesan Shaker's spray: grated cheese streaming from the cap at the origin down +y in a widening cloud, out past
 * the late box. Three drawings, each with the shreds a third of the spray further out (wrapping), played as a loop at
 * 20 fps: about 2.3 units a frame, near the shots' 2.8.
 */
export const parmesanSpray = [0, 1 / 3, 2 / 3].map(sprayDrawing);
