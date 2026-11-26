import type { PathShape } from '../../../render/rig/types';

/**
 * Fluffy, hand-drawn in the style of his Flash games (IQ Ball, Catch the Candy): a fuzzy ball of flat purple fills
 * under a dark ink line, darker tufts at the rim and a lighter middle, two big white eyes, and a grabber that is
 * a thin line with a spiky ball on the end. Every drawing is generated here from a few numbers, so the fur can
 * boil, bristle and blow in the wind. Coordinates: y down, facing right, the ball's centre at the origin.
 */

const TAU = Math.PI * 2;
const n = (v: number) => {
  const s = String(Math.round(v * 1000) / 1000);
  return s === '-0' ? '0' : s;
};
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`;

type Pt = [number, number];

const poly = (points: Pt[]) => `M${points.map(([x, y]) => pt(x, y)).join('L')}Z`;

/**
 * Ellipse centred at (x, y), as a fine polygon: the renderer subdivides curves by their size in units, and Fluffy's
 * parts are only a few units across, so curves would come out faceted.
 */
export function ellipse(x: number, y: number, rx: number, ry: number): string {
  const k = Math.max(16, Math.round(Math.max(rx, ry) * 18));
  return poly(
    Array.from({ length: k }, (_, i) => [x + rx * Math.cos((i / k) * TAU), y + ry * Math.sin((i / k) * TAU)]),
  );
}

/** Points along a quadratic curve from p0 (excluded) through control c to p1. */
function quad(p0: Pt, c: Pt, p1: Pt, steps: number): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    const m = 1 - t;
    return [
      m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0],
      m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1],
    ];
  });
}

/** An open stroke along a quadratic curve. */
const curve = (p0: Pt, c: Pt, p1: Pt) =>
  `M${pt(p0[0], p0[1])}L${quad(p0, c, p1, 8)
    .map(([x, y]) => pt(x, y))
    .join('L')}`;

/** The ink line around the body and its parts. */
export const LINE = 0.24;
const ink = (width = LINE) => ({ color: 'line', width });
const strand = (d: string, color: string, width: number): PathShape => ({ d, stroke: { color, width } });

/** Fixed jitter, so the hand-drawn wobble is the same on every run. */
const JITTER = [
  0.42, -0.31, 0.77, -0.64, 0.12, 0.93, -0.18, -0.86, 0.55, 0.05, -0.47, 0.68, -0.92, 0.29, -0.08, 0.81,
  -0.55, 0.36, -0.73, 0.17, 0.61, -0.24, 0.88, -0.39, 0.02, -0.97, 0.49, 0.74, -0.13, -0.58,
];
const jit = (i: number) => JITTER[((i % JITTER.length) + JITTER.length) % JITTER.length]!;

/** Radius of the ball where the tufts start. */
export const CORE = 4.5;

interface Tufts {
  /** Valley radius. */
  r: number;
  /** Tuft count. */
  count: number;
  /** Tuft length at angle a (radians, y down: -PI/2 is the top). */
  len: (a: number) => number;
  /** Tips lean this way, times the tuft's length. */
  wind: Pt;
  /** Rotates the tufts, in tuft widths. */
  phase: number;
  /** Jitter table offset and strength (0..1). */
  seed: number;
  wobble: number;
  /** Centre offset. */
  at?: Pt;
  /** 0: curly swept tufts, 1: straight spikes. */
  sharp?: number;
}

/** A closed fuzzy outline: tufts of fur between valleys on a circle, each a pair of quadratic curves. */
function tufts(o: Tufts): string {
  const [cx, cy] = o.at ?? [0, 0];
  const polar = (r: number, a: number): Pt => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const step = TAU / o.count;
  const sharp = o.sharp ?? 0;
  const out: Pt[] = [];
  for (let i = 0; i < o.count; i++) {
    const a0 = (i + o.phase) * step - Math.PI / 2;
    const a1 = a0 + step;
    const am = a0 + step * (0.5 + 0.16 * jit(i + o.seed) * o.wobble);
    const len = o.len(am) * (1 + 0.45 * jit(i * 7 + o.seed + 3) * o.wobble);
    const valley = o.r * (1 + 0.025 * jit(i * 3 + o.seed + 1) * o.wobble);
    const [bx, by] = polar(valley, a0);
    const [ex, ey] = polar(o.r * (1 + 0.025 * jit((i + 1) * 3 + o.seed + 1) * o.wobble), a1);
    const [tx0, ty0] = polar(o.r + len, am);
    const tip: Pt = [tx0 + o.wind[0] * len, ty0 + o.wind[1] * len];
    const out0 = polar(o.r + len * (0.62 - 0.3 * sharp), a0 + (am - a0) * (0.35 + 0.4 * sharp));
    const out1 = polar(o.r + len * (0.3 - 0.15 * sharp), a1 - (a1 - am) * (0.15 + 0.5 * sharp));
    const c0: Pt = [out0[0] + o.wind[0] * len * 0.45, out0[1] + o.wind[1] * len * 0.45];
    const c1: Pt = [out1[0] + o.wind[0] * len * 0.2, out1[1] + o.wind[1] * len * 0.2];
    if (i === 0) out.push([bx, by]);
    out.push(...quad([bx, by], c0, tip, 5), ...quad(tip, c1, [ex, ey], 5));
  }
  out.pop();
  return poly(out);
}

/**
 * Fur length around the ball: a short fuzz all round, shortest underneath (he sits on it), with a crown of longer
 * clumps on top and a cowlick at the back, like the pom-pom in IQ Ball and Catch the Candy.
 */
function furLength(scale: number, cowlick: number) {
  return (a: number) => {
    const up = Math.max(0, -Math.sin(a));
    const down = Math.max(0, Math.sin(a));
    const near = (c: number, w: number) =>
      Math.exp(-((Math.atan2(Math.sin(a - c), Math.cos(a - c)) / w) ** 2));
    return (
      scale * (0.5 + 0.6 * up ** 3 - 0.25 * down ** 2) + cowlick * (near(-1.95, 0.3) + 0.6 * near(-1.3, 0.22))
    );
  };
}

export interface FurStyle {
  /** Tuft length multiplier (bristling: about 1.9). */
  length?: number;
  /** Tips lean this way (fractions of their length): blown back while running, up while falling. */
  wind?: Pt;
  /** 0 for curly tufts, 1 for straight spikes. */
  sharp?: number;
  /** Which hand-drawn variant (a boil drawing): changes the wobble and turns the tufts slightly. */
  variant?: number;
  /** Even tufts all round and no cowlick, so the ball can roll without bumping. */
  round?: boolean;
}

/**
 * The whole ball: a dark rim of fuzz in ink, a mid-tone middle with its own smaller tufts, a rim light up and back,
 * a soft pale glow under the eyes, and strands of fur flicked outwards.
 */
export function fur(style: FurStyle = {}): PathShape[] {
  const length = style.length ?? 1;
  const wind = style.wind ?? [-0.22, 0.05];
  const sharp = style.sharp ?? 0;
  const v = style.variant ?? 0;
  const seed = v * 11;
  const phase = v * 0.21;
  const strands: PathShape[] = [];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * TAU + 0.2 * jit(i + seed);
    const r0 = CORE * (0.55 + 0.08 * jit(i * 5 + seed));
    const r1 = CORE * (0.86 + 0.06 * jit(i * 2 + seed)) + 0.25 * (length - 1);
    const bend = 0.35 * jit(i * 3 + 1 + seed);
    const [x0, y0] = [r0 * Math.cos(a), r0 * Math.sin(a)];
    const [x1, y1] = [
      r1 * Math.cos(a + bend * 0.2) + wind[0] * 0.8,
      r1 * Math.sin(a + bend * 0.2) + wind[1] * 0.8,
    ];
    const [qx, qy] = [
      ((r0 + r1) / 2) * Math.cos(a - bend * 0.15),
      ((r0 + r1) / 2) * Math.sin(a - bend * 0.15),
    ];
    const lower = Math.sin(a) > -0.2;
    strands.push(strand(curve([x0, y0], [qx, qy], [x1, y1]), lower ? 'furDark' : 'fur', 0.16));
  }
  for (let i = 0; i < 5; i++) {
    const a = -2.55 + i * 0.22 + 0.05 * jit(i + seed);
    const r0 = CORE * 0.42;
    const r1 = CORE * (0.7 + 0.05 * jit(i + 4 + seed));
    strands.push(
      strand(
        curve(
          [r0 * Math.cos(a) + 0.3, r0 * Math.sin(a)],
          [((r0 + r1) / 2) * Math.cos(a - 0.12), ((r0 + r1) / 2) * Math.sin(a - 0.12)],
          [r1 * Math.cos(a), r1 * Math.sin(a)],
        ),
        'furHi',
        0.13,
      ),
    );
  }
  return [
    {
      d: tufts({
        r: CORE,
        count: 46,
        len: style.round ? () => 0.55 * length : furLength(length, 0.8 * length),
        wind,
        phase,
        seed,
        wobble: style.round ? 0.5 : 1,
        sharp,
      }),
      fill: 'furDark',
      stroke: ink(),
    },
    {
      d: tufts({
        r: CORE * 0.8,
        count: 30,
        len: furLength(0.55 * length, 0.2),
        wind,
        phase: phase + 0.4,
        seed: seed + 5,
        wobble: 0.9,
        sharp,
        at: [0.18, -0.22],
      }),
      fill: 'fur',
    },
    {
      d: tufts({
        r: CORE * 0.3,
        count: 12,
        len: () => 0.3 * Math.sqrt(length),
        wind,
        phase: phase + 0.2,
        seed: seed + 9,
        wobble: 0.8,
        sharp,
        at: [-1.75, -2.2],
      }),
      fill: 'furLight',
    },
    {
      d: ellipse(0.45, 1.35, 2.5, 2.5),
      fill: {
        type: 'radial',
        cx: 0.45,
        cy: 1.35,
        r: 2.5,
        stops: [
          { offset: 0, color: 'furGlow', alpha: 0.95 },
          { offset: 0.5, color: 'furGlow', alpha: 0.58 },
          { offset: 1, color: 'furGlow', alpha: 0 },
        ],
      },
    },
    ...strands,
  ];
}

/** The face: where the eyes sit on the ball (the face bone's rest position). */
export const FACE: Pt = [0.45, -1.3];

/**
 * Back and front eyes in face space: [cx, cy, rx, ry]. Big and side by side across most of his face, as in his
 * games; the front one is bigger (he faces right).
 */
export const EYES: [number, number, number, number][] = [
  [-1.62, 0.1, 1.98, 2.3],
  [1.6, 0, 2.15, 2.45],
];

/** Eye whites with a cool shade along the bottom, under an ink outline. */
export function eyes(at: Pt = [0, 0]): PathShape[] {
  return EYES.flatMap(([x, y, rx, ry]) => [
    { d: ellipse(at[0] + x, at[1] + y, rx, ry), fill: 'eyeShade' },
    { d: ellipse(at[0] + x - 0.08, at[1] + y - 0.16, rx * 0.93, ry * 0.9), fill: 'eye' },
    { d: ellipse(at[0] + x, at[1] + y, rx, ry), stroke: ink(0.24) },
  ]);
}

/** Pupils (an iris ring, the pupil and two glints), looking a little ahead and down as in his games. */
export function pupils(at: Pt = [0, 0], size = 1): PathShape[] {
  return EYES.flatMap(([x, y, , ry], i) => {
    const px = at[0] + x + (i ? 0.52 : 0.48);
    const py = at[1] + y + 0.3 * (ry / 1.9);
    const r = (i ? 0.92 : 0.84) * size;
    return [
      { d: ellipse(px, py, r, r * 1.05), fill: 'iris' },
      { d: ellipse(px + 0.05, py + 0.04, r * 0.66, r * 0.7), fill: 'pupil' },
      { d: ellipse(px - r * 0.34, py - r * 0.36, r * 0.3, r * 0.3), fill: 'glint' },
      { d: ellipse(px + r * 0.32, py + r * 0.36, r * 0.12, r * 0.12), fill: 'glint' },
    ];
  });
}

/** Dizzy: spirals for pupils. */
export const dizzyPupils: PathShape[] = EYES.map(([x, y], i) => {
  const pts: string[] = [];
  for (let k = 0; k <= 28; k++) {
    const a = k * 0.62 + (i ? 1 : 0);
    const r = 0.07 + k * 0.04;
    pts.push(pt(x + 0.2 + r * Math.cos(a), y + 0.15 + r * Math.sin(a)));
  }
  return strand(`M${pts.join('L')}`, 'pupil', 0.17);
});

/** Clips a polygon to the side of the line a->b where the cross product is negative (Sutherland-Hodgman). */
function clipHalf(points: Pt[], a: Pt, b: Pt): Pt[] {
  const side = ([x, y]: Pt) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const out: Pt[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]!;
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if (sp < 0 !== sq < 0 && sp !== sq) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return out;
}

const ring = (x: number, y: number, rx: number, ry: number, k = 40): Pt[] =>
  Array.from({ length: k }, (_, i) => [x + rx * Math.cos((i / k) * TAU), y + ry * Math.sin((i / k) * TAU)]);

/**
 * Eyelids: fur-coloured caps that cover each eye down to a line, from the outer corner's height `outer` to the
 * inner corner's `inner` (fractions of the eye's height from its top: 0 open, 1 shut), with an inked rim.
 */
export function lids(outer: number, inner: number): PathShape[] {
  return EYES.flatMap(([x, y, rx, ry], i) => {
    const toY = (f: number) => y - ry + 2 * ry * f;
    const left: Pt = [x - rx * 1.05, toY(i ? inner : outer)];
    const right: Pt = [x + rx * 1.05, toY(i ? outer : inner)];
    const cap = clipHalf(ring(x, y, rx + 0.02, ry + 0.02), left, right);
    if (cap.length < 3) return [];
    return [
      { d: poly(cap), fill: 'furLight', stroke: ink(0.24) },
      strand(`M${pt(left[0] + 0.12, left[1])}L${pt(right[0] - 0.12, right[1])}`, 'line', 0.3),
    ];
  });
}

/**
 * Eyes shut: light lids drawn inside the eye outline, closed down to a curved lash with a sliver of white left
 * below it so the pair still reads at gameplay size, or squeezed tight into chevrons when hurt.
 */
export function shut(squeeze: boolean): PathShape[] {
  return EYES.flatMap(([x, y, rx, ry], i) => {
    if (squeeze)
      return [
        { d: ellipse(x, y, rx - 0.1, ry - 0.1), fill: 'furLight' },
        strand(
          i
            ? `M${pt(x + rx * 0.55, y - ry * 0.45)}L${pt(x - rx * 0.45, y + 0.05)}L${pt(x + rx * 0.55, y + ry * 0.45)}`
            : `M${pt(x - rx * 0.55, y - ry * 0.45)}L${pt(x + rx * 0.45, y + 0.05)}L${pt(x - rx * 0.55, y + ry * 0.45)}`,
          'line',
          0.32,
        ),
      ];
    const cut = y + ry * 0.6;
    const lid = clipHalf(ring(x, y, rx - 0.1, ry - 0.1), [x - rx, cut], [x + rx, cut]);
    const half = rx * Math.sqrt(1 - 0.36) - 0.1;
    return [
      { d: poly(lid), fill: 'furLight' },
      strand(curve([x - half, cut - 0.05], [x, cut + ry * 0.22], [x + half, cut - 0.05]), 'line', 0.3),
    ];
  });
}

/** Mouths, under the eyes (face space). */
export const MOUTH: Pt = [0.1, 3.2];
export const mouthO: PathShape[] = [
  { d: ellipse(MOUTH[0], MOUTH[1], 0.72, 0.86), fill: 'mouth', stroke: ink(0.22) },
  { d: ellipse(MOUTH[0] + 0.05, MOUTH[1] + 0.4, 0.42, 0.3), fill: 'tongue' },
];
/** Straining: a small round mouth, tongue showing. */
export const mouthEffort: PathShape[] = [
  { d: ellipse(MOUTH[0], MOUTH[1], 0.5, 0.58), fill: 'mouth', stroke: ink(0.2) },
  { d: ellipse(MOUTH[0] + 0.04, MOUTH[1] + 0.27, 0.3, 0.2), fill: 'tongue' },
];
export const mouthSmile: PathShape[] = [
  {
    d: poly([
      [MOUTH[0] - 0.9, MOUTH[1] - 0.45],
      ...quad(
        [MOUTH[0] - 0.9, MOUTH[1] - 0.45],
        [MOUTH[0], MOUTH[1] + 0.95],
        [MOUTH[0] + 0.9, MOUTH[1] - 0.45],
        10,
      ),
      ...quad(
        [MOUTH[0] + 0.9, MOUTH[1] - 0.45],
        [MOUTH[0], MOUTH[1] + 0.05],
        [MOUTH[0] - 0.9, MOUTH[1] - 0.45],
        10,
      ).slice(0, -1),
    ]),
    fill: 'mouth',
    stroke: ink(0.2),
  },
];

/**
 * The grabber's line: unit length along +x, so its bone's x scale is the length in units. An ink edge around
 * a purple core, like the line in IQ Ball.
 */
export const GRAB_HALF = 0.36;
export const line: PathShape[] = [
  {
    d: poly([
      [0, -GRAB_HALF],
      [1, -GRAB_HALF],
      [1, GRAB_HALF],
      [0, GRAB_HALF],
    ]),
    fill: 'line',
  },
  {
    d: poly([
      [0, -0.17],
      [1, -0.17],
      [1, 0.17],
      [0, 0.17],
    ]),
    fill: 'grab',
  },
];

/** The line cracking like a whip: two waves that die out at both ends (amplitude in units). */
export function wave(amplitude: number, waves = 2): PathShape[] {
  const k = 40;
  const centre = (t: number) => amplitude * Math.sin(Math.PI * t) * Math.sin(TAU * waves * t);
  const band = (h: number) => {
    const top: Pt[] = [];
    const bottom: Pt[] = [];
    for (let i = 0; i <= k; i++) {
      const t = i / k;
      top.push([t, centre(t) - h]);
      bottom.push([t, centre(t) + h]);
    }
    return poly([...top, ...bottom.reverse()]);
  };
  return [
    { d: band(GRAB_HALF), fill: 'line' },
    { d: band(0.17), fill: 'grab' },
  ];
}

/** Radius of the ball on the grabber's end (nubs included). */
export const TIP_R = 1.75;

/** The sticky ball on the end of the grabber: a round bulb ringed with small fuzzy nubs, in his own colours. */
export function tip(turn = 0): PathShape[] {
  const nubs = 12;
  const points: Pt[] = [];
  for (let i = 0; i < nubs * 2; i++) {
    const a = ((i + turn) / (nubs * 2)) * TAU;
    const r = i % 2 ? 1.38 : TIP_R - LINE / 2 - 0.08 * (1 + jit(i));
    points.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return [
    { d: poly(points), fill: 'grabDark', stroke: ink(0.22) },
    { d: ellipse(0, 0, 1.15, 1.15), fill: 'grab' },
    { d: ellipse(-0.36, -0.38, 0.46, 0.34), fill: 'grabHi' },
  ];
}

/** The round red-and-white swirl candy of Catch the Candy (radius 2.2), turned by `turn` (radians). */
export function candy(turn: number): PathShape[] {
  const r = 2.2;
  const swirl: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const a = turn + t * 2.5 * Math.PI;
    const rr = 0.2 + t * (r - 0.4);
    swirl.push([rr * Math.cos(a), rr * Math.sin(a)]);
    const w = 0.2 + 0.42 * t;
    inner.push([(rr + w) * Math.cos(a + 0.5), (rr + w) * Math.sin(a + 0.5)]);
  }
  return [
    { d: ellipse(0, 0, r, r), fill: 'candy', stroke: ink(0.26) },
    { d: poly([...swirl, ...inner.reverse()]), fill: 'candyHi' },
    { d: ellipse(-0.75, -0.8, 0.5, 0.32), fill: 'candyHi' },
  ];
}

/** IQ Ball's aiming cursor: a ring with four ticks and a dot, where the grabber will land. */
export const reticle: PathShape[] = [
  { d: ellipse(0, 0, 2.6, 2.6), stroke: { color: 'reticle', width: 0.42 } },
  { d: ellipse(0, 0, 1.25, 1.25), stroke: { color: 'reticle', width: 0.22 } },
  strand('M0 -3.5L0 -1.7M0 1.7L0 3.5M-3.5 0L-1.7 0M1.7 0L3.5 0', 'reticle', 0.3),
  { d: ellipse(0, 0, 0.32, 0.32), fill: 'reticle' },
];

export const thrustSmear: PathShape[] = [
  { d: 'M-19 0Q-5 -2.2 0 -1.15Q2.4 0 0 1.15Q-7 1.9 -19 0Z', fill: 'smear' },
  strand('M-24 -1.6L-10 -1.9M-16 2L-4 1.75', 'grabHi', 0.22),
];

export const sweat: PathShape[] = [
  {
    d: 'M-3.4 -3.4Q-4.6 -2.3 -4.13 -1.77Q-3.4 -1.04 -2.67 -1.77Q-2.2 -2.3 -3.4 -3.4Z',
    fill: 'sweat',
    stroke: ink(0.17),
  },
  { d: ellipse(-3.67, -2.16, 0.2, 0.29), fill: 'eye' },
];

export const santaHat: PathShape[] = [
  {
    d: 'M-3.5 -3.6Q-3.65 -6.2 -1.4 -7.5Q0.7 -8.65 2.55 -6.2Q3.1 -5.4 3.3 -4.45L2.4 -4.22Q1.5 -5.6 0.64 -5.55L0.13 -3.7Z',
    fill: 'hatRed',
    stroke: ink(),
  },
  {
    d: 'M-0.48 -4.2Q0.1 -6.28 0.95 -6.05L2.3 -4.46L2.1 -4.14Q1.07 -5.65 0.62 -5.55L0.18 -4.04Z',
    fill: 'hatRedDark',
  },
  {
    d: 'M-3.98 -4.06Q-2.25 -4.9 0.05 -4.49Q0.76 -4.16 0.52 -3.54Q0.36 -2.93 -0.22 -3.07Q-2.02 -3.4 -3.51 -2.83Q-4.24 -2.75 -4.42 -3.34Q-4.53 -3.78 -3.98 -4.06Z',
    fill: 'hatTrim',
    stroke: ink(),
  },
  { d: ellipse(3.07, -4.3, 0.9, 0.9), fill: 'hatTrimShade', stroke: ink() },
  { d: ellipse(2.87, -4.48, 0.6, 0.6), fill: 'hatTrim' },
];

export const witchHat: PathShape[] = [
  {
    d: 'M-5.23 -3.32Q-3.45 -4.74 -0.93 -4.94Q1.9 -5.23 3.52 -4.65Q2.69 -3.47 -0.31 -2.83Q-3.06 -2.26 -5.23 -3.32Z',
    fill: 'hatBlackHi',
    stroke: ink(),
  },
  {
    d: 'M-3.94 -3.91L-2.68 -7.06L-0.19 -8.1L-0.78 -6.36L1.43 -4.69Q-0.18 -3.45 -3.94 -3.91Z',
    fill: 'hatBlack',
    stroke: ink(),
  },
  {
    d: 'M-3.94 -3.91L-3.5 -5.01Q-1.41 -4.73 0.5 -5.4L1.43 -4.69Q-0.17 -3.45 -3.94 -3.91Z',
    fill: 'hatBand',
    stroke: ink(0.14),
  },
  {
    d: 'M-1.92 -4.77L-0.69 -4.99L-0.48 -4.12L-1.72 -3.91ZM-1.53 -4.49L-1.45 -4.25L-0.86 -4.36L-0.92 -4.61Z',
    fill: 'hatBuckle',
  },
];

/** A puff of dust kicked up by a landing or a skid, centred on the floor. */
export const dust: PathShape[] = [
  { d: ellipse(-2.6, -0.7, 1.2, 0.85), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
  { d: ellipse(-0.9, -1.0, 1.3, 1.05), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
  { d: ellipse(2.7, -0.7, 1.2, 0.85), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
  { d: ellipse(1.0, -0.95, 1.35, 1.05), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
];

/** A star of `points` spikes about the origin: tips at `outer` (times 1 + jitter x `wobble`), valleys at `inner`. */
function star(points: number, outer: number, inner: number, wobble: number, seed: number, turn = 0): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = turn + (i / (points * 2)) * TAU - Math.PI / 2;
    const r = i % 2 ? inner * (1 + 0.08 * jit(seed + i)) : outer * (1 + wobble * jit(seed + i));
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
}

/**
 * Fuzz Frenzy's power-up: a halo of glowing fur spikes round the ball, about 8.5 units out, fading at the tips. Two
 * drawings with the spikes shifted half a spike, so the loop flickers like the fur boil.
 */
export function aura(variant: number): PathShape[] {
  const glow = (r: number) => ({
    type: 'radial' as const,
    cx: 0,
    cy: 0,
    r,
    stops: [
      { offset: 0, color: 'furGlow', alpha: 0.95 },
      { offset: 0.66, color: 'furGlow', alpha: 0.8 },
      { offset: 1, color: 'furHi', alpha: 0.1 },
    ],
  });
  return [
    { d: poly(star(18, 8.6, 6.2, 0.16, variant * 7, variant * 0.17)), fill: glow(9.4) },
    { d: poly(star(13, 7.2, 5.6, 0.12, variant * 5 + 3, variant * 0.24 + 0.1)), fill: glow(7.6) },
  ];
}

/** An impact flash, Flash style: a ragged white-hot star inside a pale one, inked, about 4 units across the tips. */
export function burst(seed: number): PathShape[] {
  return [
    { d: poly(star(9, 4, 1.9, 0.22, seed, seed * 0.11)), fill: 'smear', stroke: ink(0.22) },
    { d: poly(star(9, 2.3, 1.15, 0.2, seed + 9, seed * 0.11 + 0.2)), fill: 'eye' },
  ];
}

/** Points round an ellipse turned by `rot` radians. */
const tilted = (rx: number, ry: number, rot: number, k = 48): Pt[] =>
  Array.from({ length: k }, (_, i) => {
    const a = (i / k) * TAU;
    const [x, y] = [rx * Math.cos(a), ry * Math.sin(a)];
    return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)] as Pt;
  });

/** A straight band `half` thick each side of the segment from `a` to `b`. */
function band(a: Pt, b: Pt, half: number): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [nx, ny] = [((a[1] - b[1]) / len) * half, ((b[0] - a[0]) / len) * half];
  return poly([
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ]);
}

/**
 * The grabber coiled twice round a caught foe (Fuzz Frenzy), centred on the foe's middle: two loops of the line,
 * 5.2 units out to each side, the turn between them running down across the front, and the grabber's ball clamped
 * on the lower loop.
 */
export const wrap: PathShape[] = (() => {
  const loops: [number, number][] = [
    [-2.6, -0.1],
    [2.4, 0.08],
  ];
  const rings = (half: number) =>
    loops
      .map(([cy, rot]) => {
        const shift = ([x, y]: Pt): Pt => [x, y + cy];
        return `${poly(tilted(5.2 + half, 1.4 + half, rot).map(shift))}${poly(tilted(5.2 - half, 1.4 - half, rot).map(shift))}`;
      })
      .join('');
  const turn = (half: number) => band([4.4, -2.0], [-4.3, 2.0], half);
  return [
    { d: rings(GRAB_HALF), fill: 'line' },
    { d: turn(GRAB_HALF), fill: 'line' },
    { d: rings(0.17), fill: 'grab' },
    { d: turn(0.17), fill: 'grab' },
    ...tip(0.3).map((s) => ({ ...s, d: transformD(s.d, 5.1, 2.7) })),
  ];
})();

/** Moves a path made by `poly` or `ellipse` (absolute M/L/Z commands only) by (dx, dy). */
function transformD(d: string, dx: number, dy: number): string {
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x: string, y: string) => pt(Number(x) + dx, Number(y) + dy));
}
