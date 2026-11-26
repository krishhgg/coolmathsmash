import type { PathShape } from '../../../render/rig/types';

/**
 * The Duck's parts, drawn by hand in Duck Life's Flash style: flat colours, one thick round black ink line, a
 * body built from two overlapping circles (head and belly), one big eye with a crescent iris, a small beak and
 * stick legs with flat feet. Every part sits around its bone's origin, facing right, y down, in rig units (the
 * duck stands 11 tall).
 */

const K = 0.5523;
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const { atan2, cos, hypot, PI, sin, sqrt } = Math;

/** Ink width of the body outline: Duck Life's line is about a thirtieth of the duck's height. */
export const LINE = 0.38;
/** Ink width of the face details. */
export const INK = 0.2;
export const BODY_R = 3.35;
export const HEAD_R = 2.85;
/** Hip to ankle, and ankle to toe tip. */
export const LEG = 1.5;
export const FOOT = 1.75;

type P = readonly [number, number];

export function ellipse(x: number, y: number, rx: number, ry: number): string {
  return [
    `M${n(x + rx)} ${n(y)}`,
    `C${n(x + rx)} ${n(y + K * ry)} ${n(x + K * rx)} ${n(y + ry)} ${n(x)} ${n(y + ry)}`,
    `C${n(x - K * rx)} ${n(y + ry)} ${n(x - rx)} ${n(y + K * ry)} ${n(x - rx)} ${n(y)}`,
    `C${n(x - rx)} ${n(y - K * ry)} ${n(x - K * rx)} ${n(y - ry)} ${n(x)} ${n(y - ry)}`,
    `C${n(x + K * rx)} ${n(y - ry)} ${n(x + rx)} ${n(y - K * ry)} ${n(x + rx)} ${n(y)}Z`,
  ].join('');
}

/** A circle as twelve short arcs, so it stays round however far the camera zooms in. */
export function circle(x: number, y: number, r: number): string {
  return `M${n(x + r)} ${n(y)}${arc(x, y, r, 0, 2 * PI, 12)}Z`;
}

/** Cubic segments continuing a path along circle (cx, cy, r) from angle a0 to a1 (radians, y down). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, min = 1): string {
  const segs = Math.max(min, Math.ceil(Math.abs(a1 - a0) / (PI / 6)));
  const da = (a1 - a0) / segs;
  const k = (4 / 3) * Math.tan(da / 4) * r;
  let out = '';
  for (let i = 0; i < segs; i++) {
    const s = a0 + i * da;
    const e = s + da;
    const x3 = cx + r * cos(e);
    const y3 = cy + r * sin(e);
    out += `C${n(cx + r * cos(s) - k * sin(s))} ${n(cy + r * sin(s) + k * cos(s))} `;
    out += `${n(x3 + k * sin(e))} ${n(y3 - k * cos(e))} ${n(x3)} ${n(y3)}`;
  }
  return out;
}

/** The end angle for an arc from a0 to a1 that passes through angle `via`. */
function sweep(a0: number, a1: number, via: number): number {
  const wrap = (a: number) => ((a % (2 * PI)) + 2 * PI) % (2 * PI);
  const ccw = wrap(a1 - a0);
  return wrap(via - a0) <= ccw ? a0 + ccw : a0 + ccw - 2 * PI;
}

/** Where circle A overlaps circle B (an iris inside the eye, a pupil inside the iris). */
export function lens(a: readonly [number, number, number], b: readonly [number, number, number]): string {
  const [ax, ay, ar] = a;
  const [bx, by, br] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const d = hypot(dx, dy);
  const along = (ar * ar - br * br + d * d) / (2 * d);
  const h = sqrt(Math.max(0, ar * ar - along * along));
  const mx = ax + (along * dx) / d;
  const my = ay + (along * dy) / d;
  const p1: P = [mx - (h * dy) / d, my + (h * dx) / d];
  const p2: P = [mx + (h * dy) / d, my - (h * dx) / d];
  const toB = atan2(dy, dx);
  const a0 = atan2(p1[1] - ay, p1[0] - ax);
  const a1 = sweep(a0, atan2(p2[1] - ay, p2[0] - ax), toB);
  const b0 = atan2(p2[1] - by, p2[0] - bx);
  const b1 = sweep(b0, atan2(p1[1] - by, p1[0] - bx), toB + PI);
  return `M${n(p1[0])} ${n(p1[1])}${arc(ax, ay, ar, a0, a1)}${arc(bx, by, br, b0, b1)}Z`;
}

/** A stroke of ink from (x0, y0) to (x1, y1) with round ends, as a filled outline. */
export function capsule(x0: number, y0: number, x1: number, y1: number, w: number): string {
  const r = w / 2;
  const a = atan2(y1 - y0, x1 - x0);
  const nx = -sin(a) * r;
  const ny = cos(a) * r;
  return (
    `M${n(x0 + nx)} ${n(y0 + ny)}L${n(x1 + nx)} ${n(y1 + ny)}` +
    arc(x1, y1, r, a + PI / 2, a - PI / 2) +
    `L${n(x0 - nx)} ${n(y0 - ny)}` +
    arc(x0, y0, r, a - PI / 2, a - (3 * PI) / 2) +
    'Z'
  );
}

/** A polyline of ink, one capsule per segment so the joins stay round. */
function strokes(points: P[], w: number, color = 'line'): PathShape[] {
  return points
    .slice(1)
    .map((p, i) => ({ d: capsule(points[i]![0], points[i]![1], p[0], p[1], w), fill: color }));
}

/** Points along a cubic Bézier, so a curved stroke of ink can be built from capsules with round ends. */
function bezier(p0: P, p1: P, p2: P, p3: P, steps = 8): P[] {
  return Array.from({ length: steps + 1 }, (_, i): P => {
    const t = i / steps;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    return [
      w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0],
      w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1],
    ];
  });
}

export function poly(points: P[]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('') + 'Z';
}

/** A smooth closed curve through hand-placed points (Catmull-Rom as cubic Béziers). */
export function blob(points: P[], tension = 1): string {
  const m = points.length;
  const at = (i: number) => points[((i % m) + m) % m]!;
  let d = `M${n(at(0)[0])} ${n(at(0)[1])}`;
  for (let i = 0; i < m; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const t = tension / 6;
    d += `C${n(p1[0] + (p2[0] - p0[0]) * t)} ${n(p1[1] + (p2[1] - p0[1]) * t)} `;
    d += `${n(p2[0] - (p3[0] - p1[0]) * t)} ${n(p2[1] - (p3[1] - p1[1]) * t)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d + 'Z';
}

/** Moves authored points: rotate by `deg` (clockwise), scale by `s`, then translate. */
function place(points: P[], deg: number, tx: number, ty: number, s = 1): P[] {
  const r = (deg * PI) / 180;
  return points.map(([x, y]) => [tx + s * (x * cos(r) - y * sin(r)), ty + s * (x * sin(r) + y * cos(r))]);
}

/** Body and head: an ink disc drawn behind both fills, so the two circles read as one round duckling. */
export const bodyLine: PathShape[] = [{ d: circle(0, 0, BODY_R + LINE / 2), fill: 'line' }];
export const body: PathShape[] = [{ d: circle(0, 0, BODY_R - LINE / 2), fill: 'body' }];
export const headLine: PathShape[] = [{ d: circle(0, 0, HEAD_R + LINE / 2), fill: 'line' }];
export const head: PathShape[] = [{ d: circle(0, 0, HEAD_R - LINE / 2), fill: 'body' }];

/** The eye, high on the front of the head: white, a crescent of iris and a big pupil against the front edge. */
const EX = 1.0;
const EY = -0.95;
const ER = 1.02;
/** A point just inside the eye's rim, `deg` clockwise from the front. */
const rim = (deg: number): P => [
  EX + (ER - 0.1) * cos((deg * PI) / 180),
  EY + (ER - 0.1) * sin((deg * PI) / 180),
];

function eye(look: P = [0, 0]): PathShape[] {
  const [lx, ly] = look;
  return [
    { d: circle(EX, EY, ER), fill: 'eye' },
    { d: lens([EX, EY, ER - 0.04], [EX + 0.55 + lx, EY + ly, 0.84]), fill: 'iris' },
    { d: lens([EX, EY, ER - 0.04], [EX + 0.92 + lx, EY + 0.03 + ly, 0.6]), fill: 'pupil' },
    { d: circle(EX, EY, ER), stroke: { color: 'line', width: INK } },
  ];
}

/** Eyelid closed: the lid in body colour with a smile-shaped lash line. */
const lidShut: PathShape[] = [
  { d: circle(EX, EY, ER), fill: 'body', stroke: { color: 'line', width: INK } },
  {
    d: `M${n(EX - ER + 0.12)} ${n(EY - 0.05)}C${n(EX - 0.4)} ${n(EY + 0.5)} ${n(EX + 0.4)} ${n(EY + 0.5)} ${n(EX + ER - 0.12)} ${n(EY - 0.05)}`,
    stroke: { color: 'line', width: INK * 1.3 },
  },
];

/** Eyes shut in a grin: the lid in body colour with an arched lash line from rim to rim. */
const lidHappy: PathShape[] = [
  { d: circle(EX, EY, ER), fill: 'body', stroke: { color: 'line', width: INK } },
  ...strokes(bezier(rim(158), [EX - 0.5, EY - 0.5], [EX + 0.5, EY - 0.5], rim(22)), INK * 1.5),
];

/** Squeezed shut in pain: no eye at all, just a thick ">" crease in the head colour, its point towards the beak. */
const VERTEX: P = [EX + 0.6, EY + 0.02];
const squint: PathShape[] = [
  ...strokes(bezier([EX - 0.62, EY - 0.78], [EX - 0.15, EY - 0.5], [EX + 0.25, EY - 0.2], VERTEX, 6), 0.34),
  ...strokes(bezier(VERTEX, [EX + 0.25, EY + 0.22], [EX - 0.15, EY + 0.52], [EX - 0.62, EY + 0.8], 6), 0.34),
];

/**
 * The evil costume's stare: the red eye hooded by a lid in body colour whose edge slants sharply down towards
 * the beak, cutting off the top of the eye and half the pupil, inked with one heavy line.
 */
const LID_BACK = (-128 * PI) / 180;
const LID_FRONT = (8 * PI) / 180;
const lidAt = (a: number): P => [EX + ER * cos(a), EY + ER * sin(a)];
const evilEye: PathShape[] = [
  ...eye().slice(0, 3),
  {
    d: `M${n(lidAt(LID_BACK)[0])} ${n(lidAt(LID_BACK)[1])}${arc(EX, EY, ER, LID_BACK, LID_FRONT)}Z`,
    fill: 'body',
  },
  { d: circle(EX, EY, ER), stroke: { color: 'line', width: INK } },
  {
    d: capsule(
      lidAt(LID_BACK)[0] - 0.18,
      lidAt(LID_BACK)[1] - 0.12,
      lidAt(LID_FRONT)[0] + 0.08,
      lidAt(LID_FRONT)[1] + 0.05,
      0.3,
    ),
    fill: 'line',
  },
];

/** Seeing stars: a white eye with a loose hand-drawn spiral of two turns and no pupil. */
const spiral: PathShape[] = [
  { d: circle(EX, EY, ER), fill: 'eye', stroke: { color: 'line', width: INK } },
  ...strokes(
    Array.from({ length: 49 }, (_, i): P => {
      const t = i / 48;
      const a = t * 4 * PI - PI / 2;
      const r = (0.06 + 0.72 * t) * (1 + 0.07 * sin(3 * a + 1));
      return [EX + 0.03 + r * cos(a), EY + r * sin(a)];
    }),
    INK * 0.85,
  ),
];

/** A heavy brow slanting down to the beak: the fighting face. */
const brow: PathShape[] = [{ d: capsule(-0.15, -2.3, 1.95, -1.62, 0.34), fill: 'line' }];

/** An open line of ink (no fill), for edges that should not close back on themselves. */
function edge(points: P[], w: number): PathShape {
  return {
    d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join(''),
    stroke: { color: 'line', width: w },
  };
}

/**
 * The beak: a small orange wedge growing out of the head's outline, inked along its two outer edges and
 * split by the line between the bills.
 */
const beakShut: PathShape[] = [
  {
    d: poly([
      [2.3, -0.74],
      [4.02, 0],
      [2.3, 0.7],
    ]),
    fill: 'beak',
  },
  edge(
    [
      [2.62, -0.72],
      [4.02, 0],
      [2.62, 0.7],
    ],
    0.3,
  ),
  edge(
    [
      [2.7, 0],
      [3.85, 0],
    ],
    INK,
  ),
];

/**
 * Beak open: two short, wide wedges with rounded outer edges, the upper bill orange and the lower one a shade
 * darker, hinged at the head with a black mouth between them, so it reads as a beak at any angle. Neither reaches
 * past the closed beak's tip.
 */
const beakOpen: PathShape[] = [
  { d: 'M2.45 -0.1L3.74 -0.36Q3.3 0.04 3.5 0.42L2.45 0.14Z', fill: 'mouth' },
  { d: 'M2.3 -0.86L2.62 -0.9C3.2 -0.93 3.62 -0.7 3.8 -0.38L2.42 -0.06Z', fill: 'beak' },
  { d: 'M2.62 -0.9C3.2 -0.93 3.62 -0.7 3.8 -0.38L2.66 -0.12', stroke: { color: 'line', width: 0.28 } },
  { d: 'M2.42 0.1L3.56 0.44C3.43 0.72 3.06 0.88 2.62 0.88L2.3 0.84Z', fill: 'beakLo' },
  { d: 'M2.66 0.14L3.56 0.44C3.43 0.72 3.06 0.88 2.62 0.88', stroke: { color: 'line', width: 0.28 } },
];

export const faces: Record<string, PathShape[]> = {
  face: [...eye(), ...beakShut],
  faceUp: [...eye([0.02, -0.28]), ...beakShut],
  faceDown: [...eye([0.0, 0.28]), ...beakShut],
  faceBlink: [...lidShut, ...beakShut],
  faceAngry: [...eye(), ...brow, ...beakShut],
  facePeck: [...eye(), ...brow, ...beakOpen],
  faceShout: [...eye([0.02, -0.1]), ...brow, ...beakOpen],
  faceHurt: [...squint, ...beakOpen],
  faceDizzy: [...spiral, ...beakOpen],
  faceHappy: [...lidHappy, ...beakOpen],
  faceEvil: [...evilEye, ...beakShut],
};

/** Shoulder to wing tip of the open wing. */
export const WING = 3.78;

/**
 * The open wing for wing attacks: a plain teardrop in body colour under a heavy ink contour, round at the shoulder
 * (origin) and pointed at the tip back along -x, with a shallow notch under the tip.
 */
export const wingOpen: PathShape[] = [
  {
    d:
      `M${n(-WING)} -0.02C-2.9 -0.66 -1.7 -1.06 -0.6 -0.98C0.28 -0.9 0.68 -0.24 0.44 0.32` +
      `C0.16 0.9 -1.0 0.98 -1.9 0.8C-2.6 0.66 -3.1 0.5 -3.5 0.3L-3.16 0.14L${n(-WING)} -0.02Z`,
    fill: 'body',
    stroke: { color: 'line', width: LINE },
  },
];

/**
 * Duck Life's flying wing is a single stroke of ink across the body that flaps from down to up. Five drawings of
 * it, each one barely bowed dash 3 long pointing back from just in front of the shoulder, turned for the beat:
 * `deg` is how far the tail end tips up (negative tips it down).
 */
const lineWing = (deg: number) => {
  const [a, c, b] = place(
    [
      [0, 0],
      [-1.5, -0.1],
      [-3.0, 0],
    ],
    deg,
    0.9,
    0.1,
  );
  return strokes(bezier(a!, c!, c!, b!, 6), 0.36);
};
export const wingLines: Record<string, PathShape[]> = {
  wingV: lineWing(-35),
  wingVs: lineWing(-18),
  wingFlat: lineWing(0),
  wingAs: lineWing(18),
  wingA: lineWing(35),
};

/** Leg and foot: Duck Life's single ink stroke down from the belly and a flat foot pointing forwards. */
export const leg: PathShape[] = [{ d: capsule(0, 0, 0, LEG, LINE), fill: 'leg' }];
export const foot: PathShape[] = [{ d: capsule(0, 0, FOOT, 0, LINE), fill: 'leg' }];

/**
 * The webbed foot shown in kicks, stomps and the dive: the leg's own ink spread open into a fan of three toes, the
 * web scalloped between them.
 */
const TOES: P[] = [
  [1.92, -0.8],
  [2.3, 0],
  [1.92, 0.8],
];
export const footWeb: PathShape[] = [
  ...TOES.map(([x, y]) => ({ d: capsule(0, 0, x, y, LINE), fill: 'leg' })),
  {
    d:
      `M0 0L${n(TOES[0]![0])} ${n(TOES[0]![1])}` +
      TOES.slice(1)
        .map(([bx, by], i) => {
          const [ax, ay] = TOES[i]!;
          const qx = (ax + bx) * 0.3;
          const qy = (ay + by) * 0.3;
          return `C${n(ax + (2 / 3) * (qx - ax))} ${n(ay + (2 / 3) * (qy - ay))} ${n(bx + (2 / 3) * (qx - bx))} ${n(by + (2 / 3) * (qy - by))} ${n(bx)} ${n(by)}`;
        })
        .join('') +
      'Z',
    fill: 'leg',
  },
];

/** The Crown hat from the Duck Life shop: a tilted gold band with four points on the back of the head. */
const CROWN: P[] = place(
  [
    [-1.55, 0.1],
    [-1.8, -1.9],
    [-0.95, -1.15],
    [-0.4, -2.15],
    [0.18, -1.18],
    [0.75, -2.15],
    [1.22, -1.12],
    [1.88, -1.82],
    [1.62, 0.1],
  ],
  -30,
  -1.05,
  -2.3,
);
const [c0, c1] = place(
  [
    [-1.7, 0],
    [1.8, 0],
  ],
  -30,
  -1.05,
  -2.3,
);
export const crown: PathShape[] = [
  {
    d: poly(CROWN),
    fill: {
      type: 'linear',
      x0: c0![0],
      y0: c0![1],
      x1: c1![0],
      y1: c1![1],
      stops: [
        { offset: 0, color: 'crownLo' },
        { offset: 0.2, color: 'crown' },
        { offset: 0.52, color: 'crownHi' },
        { offset: 0.84, color: 'crown' },
        { offset: 1, color: 'crownLo' },
      ],
    },
    stroke: { color: 'line', width: LINE * 0.8 },
  },
];

/**
 * The evil costume's crest: six broad, jagged dark spikes swept back from the top of the head down its back, on
 * the hat bone (the head's centre), rooted in a band just inside the head's outline that stays clear of the brow.
 */
export const crest: PathShape[] = (() => {
  const from = -66;
  const to = -190;
  const spikes: [number, number][] = [
    [1.05, 20],
    [1.5, 26],
    [1.85, 32],
    [1.9, 38],
    [1.55, 46],
    [1.05, 52],
  ];
  const step = (to - from) / spikes.length;
  const at = (deg: number, r: number): P => [r * cos((deg * PI) / 180), r * sin((deg * PI) / 180)];
  const outer: P[] = spikes.flatMap(([len, sweep], i): P[] => {
    const mid = from + (i + 0.5) * step;
    const [bx, by] = at(mid, HEAD_R + 0.1);
    const tip: P = [bx + len * cos(((mid - sweep) * PI) / 180), by + len * sin(((mid - sweep) * PI) / 180)];
    return [at(from + i * step, HEAD_R + 0.1), tip];
  });
  const inner = Array.from({ length: spikes.length + 1 }, (_, i) => at(to - i * step, HEAD_R - 0.4));
  return [
    {
      d: poly([...outer, at(to, HEAD_R + 0.1), ...inner]),
      fill: 'crest',
      stroke: { color: 'line', width: LINE * 0.7 },
    },
  ];
})();

/** A cloud of dust, for dashes, landings and stomps (radius about 1). */
export const fxPuff: PathShape[] = (() => {
  const puffs: [number, number, number][] = [
    [0, 0, 0.8],
    [0.85, 0.15, 0.62],
    [-0.8, 0.2, 0.58],
    [0.15, -0.55, 0.55],
  ];
  return [
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r + 0.12), fill: 'puffLine' })),
    ...puffs.map(([x, y, r]) => ({ d: circle(x, y, r), fill: 'puff' })),
  ];
})();

/** One loose feather, quill at the origin pointing +x (1.6 long). */
const FEATHER: P[] = [
  [0, 0],
  [0.45, -0.3],
  [1.15, -0.34],
  [1.65, 0],
  [1.15, 0.32],
  [0.45, 0.28],
];
function feather(deg: number, tx: number, ty: number, s: number): PathShape[] {
  const [q0, q1] = place(
    [
      [0.1, 0],
      [1.45, 0],
    ],
    deg,
    tx,
    ty,
    s,
  );
  return [
    { d: blob(place(FEATHER, deg, tx, ty, s)), fill: 'feather', stroke: { color: 'line', width: 0.12 } },
    { d: capsule(q0![0], q0![1], q1![0], q1![1], 0.07), fill: 'line' },
  ];
}
export const fxFeather: PathShape[] = feather(0, -0.8, 0, 1);

/** Feathers flying round a ring of radius 5.5 (the Feather Spin's reach), each turned along the spin. */
export const fxFeathers: PathShape[] = [0, 1, 2, 3, 4, 5, 6].flatMap((i) => {
  const a = (i * 2 * PI) / 7 + 0.3;
  return feather((a * 180) / PI + 100, 5.5 * cos(a), 5.5 * sin(a), 1.1);
});

/** A motion smear: a crescent fading from its tail (top) to its leading edge (bottom), radius 1. */
export const fxSwoosh: PathShape[] = [
  {
    d:
      `M${n(cos(-1.25))} ${n(sin(-1.25))}` +
      arc(0, 0, 1, -1.25, 1.25) +
      arc(-0.2, 0.05, 0.78, 1.25, -1.15) +
      'Z',
    fill: {
      type: 'linear',
      x0: 0,
      y0: -1,
      x1: 0,
      y1: 1,
      stops: [
        { offset: 0, color: 'swoosh', alpha: 0 },
        { offset: 0.6, color: 'swoosh', alpha: 0.55 },
        { offset: 1, color: 'swoosh', alpha: 0.9 },
      ],
    },
  },
];

/** Speed lines trailing a charge, pointing back along -x from the origin. */
export const fxSpeed: PathShape[] = [
  { d: capsule(-0.4, -0.9, -3.2, -0.9, 0.16), fill: 'swoosh' },
  { d: capsule(0, 0, -4.2, 0, 0.18), fill: 'swoosh' },
  { d: capsule(-0.6, 0.9, -2.8, 0.9, 0.16), fill: 'swoosh' },
];

/** An impact burst: an eight-point star, radius 1. */
export const fxStar: PathShape[] = (() => {
  const pts: P[] = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 ? 0.42 : 1;
    const a = (i * PI) / 8 - PI / 2;
    return [r * cos(a), r * sin(a)];
  });
  return [
    { d: poly(pts), fill: 'star', stroke: { color: 'line', width: 0.1 } },
    { d: circle(0, 0, 0.28), fill: 'starCore' },
  ];
})();

/**
 * The charge glow, radius 1: a soft disc fading out from a pale core. Running Ram's charge grows it and swaps in the
 * brighter drawings as the charge builds (`fxGlow1` to `fxGlow3`).
 */
const glow = (core: number, mid: number): PathShape[] => [
  {
    d: circle(0, 0, 1),
    fill: {
      type: 'radial',
      cx: 0,
      cy: 0,
      r: 1,
      stops: [
        { offset: 0, color: 'glowCore', alpha: core },
        { offset: 0.5, color: 'glow', alpha: mid },
        { offset: 1, color: 'glow', alpha: 0 },
      ],
    },
  },
];
export const fxGlows: Record<string, PathShape[]> = {
  fxGlow1: glow(0.5, 0.25),
  fxGlow2: glow(0.7, 0.4),
  fxGlow3: glow(0.9, 0.55),
};

/** One fluffed-up feather pointing out from the belly's centre at `deg` (y down), its base hidden under the belly. */
function tuft(deg: number, len: number): PathShape[] {
  const base = BODY_R - 0.55;
  const pts: P[] = [
    [base, -0.5],
    [base + 0.55 * len, -0.42],
    [base + 1.1 * len, -0.08],
    [base + 1.25 * len, 0.05],
    [base + 0.75 * len, 0.36],
    [base, 0.46],
  ];
  return [{ d: blob(place(pts, deg, 0, 0)), fill: 'body', stroke: { color: 'line', width: LINE * 0.8 } }];
}

/**
 * Ruffled feathers: tufts standing up round the back and top of the belly, centred on it. Three drawings with each
 * tuft turned and stretched a little differently, for Running Ram's charge to flicker through on the match clock.
 */
const TUFTS: [number, number][] = [
  [150, 0.9],
  [178, 1.15],
  [205, 1.0],
  [232, 1.1],
  [258, 0.95],
  [284, 0.8],
];
const ruffle = (turn: number[], grow: number[]): PathShape[] =>
  TUFTS.flatMap(([deg, len], i) => tuft(deg + turn[i % turn.length]!, len * grow[i % grow.length]!));
export const ruffles: Record<string, PathShape[]> = {
  ruffleA: ruffle([0, 6, -4], [1, 0.9, 1.1]),
  ruffleB: ruffle([-6, -2, 5], [1.12, 1, 0.92]),
  ruffleC: ruffle([5, -5, 1], [0.92, 1.12, 1]),
};
