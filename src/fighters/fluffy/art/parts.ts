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
export const LINE = 0.3;
const ink = (width = LINE) => ({ color: 'line', width });
const strand = (d: string, color: string, width: number): PathShape => ({ d, stroke: { color, width } });

/** Fixed jitter, so the hand-drawn wobble is the same on every run. */
const JITTER = [
  0.42, -0.31, 0.77, -0.64, 0.12, 0.93, -0.18, -0.86, 0.55, 0.05, -0.47, 0.68, -0.92, 0.29, -0.08, 0.81,
  -0.55, 0.36, -0.73, 0.17, 0.61, -0.24, 0.88, -0.39, 0.02, -0.97, 0.49, 0.74, -0.13, -0.58,
];
const jit = (i: number) => JITTER[((i % JITTER.length) + JITTER.length) % JITTER.length]!;

/** Radius of the ball where the tufts start. */
export const CORE = 4.25;

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
    const len = o.len(am) * (1 + 0.32 * jit(i * 7 + o.seed + 3) * o.wobble);
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

/** Fur length around the ball: short underneath (he sits on it), long on top, with a cowlick at the back. */
function furLength(scale: number, cowlick: number) {
  return (a: number) => {
    const up = Math.max(0, -Math.sin(a));
    const down = Math.max(0, Math.sin(a));
    const lick = Math.exp(-((Math.atan2(Math.sin(a + 1.95), Math.cos(a + 1.95)) / 0.32) ** 2));
    return scale * (0.95 + 0.4 * up * up - 0.62 * down ** 3) + cowlick * lick;
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
 * The whole ball: a dark rim of tufts in ink, a mid-tone middle with its own smaller tufts, a light patch up front
 * where the light falls, and strands of fur flicked outwards.
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
        count: 30,
        len: style.round ? () => 0.78 * length : furLength(length, 0.65 * length),
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
        count: 21,
        len: furLength(0.62 * length, 0.2),
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
        r: CORE * 0.44,
        count: 13,
        len: () => 0.42 * Math.sqrt(length),
        wind,
        phase: phase + 0.2,
        seed: seed + 9,
        wobble: 0.8,
        sharp,
        at: [-0.35, -1.1],
      }),
      fill: 'furLight',
    },
    ...strands,
  ];
}

/** The face: where the eyes sit on the ball (the face bone's rest position). */
export const FACE: Pt = [0.95, -1.95];

/** Back and front eyes in face space: [cx, cy, rx, ry]. The front one is bigger (he faces right). */
export const EYES: [number, number, number, number][] = [
  [-1.25, 0.12, 1.45, 1.78],
  [1.15, 0, 1.62, 1.95],
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
    const px = at[0] + x + (i ? 0.42 : 0.38);
    const py = at[1] + y + 0.3 * (ry / 1.9);
    const r = (i ? 0.72 : 0.66) * size;
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
    const r = 0.06 + k * 0.032;
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
      { d: poly(cap), fill: 'fur', stroke: ink(0.24) },
      strand(`M${pt(left[0] + 0.12, left[1])}L${pt(right[0] - 0.12, right[1])}`, 'line', 0.3),
    ];
  });
}

/** Eyes shut: full lids with a curved lash line, or squeezed tight into chevrons when hurt. */
export function shut(squeeze: boolean): PathShape[] {
  return EYES.flatMap(([x, y, rx, ry], i) => [
    { d: ellipse(x, y, rx, ry), fill: 'fur', stroke: ink(0.24) },
    squeeze
      ? strand(
          i
            ? `M${pt(x + rx * 0.55, y - ry * 0.45)}L${pt(x - rx * 0.45, y + 0.05)}L${pt(x + rx * 0.55, y + ry * 0.45)}`
            : `M${pt(x - rx * 0.55, y - ry * 0.45)}L${pt(x + rx * 0.45, y + 0.05)}L${pt(x - rx * 0.55, y + ry * 0.45)}`,
          'line',
          0.32,
        )
      : strand(
          curve([x - rx * 0.8, y + ry * 0.1], [x, y + ry * 0.72], [x + rx * 0.8, y + ry * 0.1]),
          'line',
          0.3,
        ),
  ]);
}

/** Mouths, under the eyes (face space). */
export const MOUTH: Pt = [0.15, 2.75];
export const mouthO: PathShape[] = [
  { d: ellipse(MOUTH[0], MOUTH[1], 0.72, 0.86), fill: 'mouth', stroke: ink(0.22) },
  { d: ellipse(MOUTH[0] + 0.05, MOUTH[1] + 0.4, 0.42, 0.3), fill: 'tongue' },
];
export const mouthGrit: PathShape[] = [
  {
    d: poly([
      [MOUTH[0] - 1.1, MOUTH[1] - 0.25],
      ...quad(
        [MOUTH[0] - 1.1, MOUTH[1] - 0.25],
        [MOUTH[0], MOUTH[1] + 0.05],
        [MOUTH[0] + 1.1, MOUTH[1] - 0.3],
        8,
      ),
      [MOUTH[0] + 0.95, MOUTH[1] + 0.35],
      ...quad(
        [MOUTH[0] + 0.95, MOUTH[1] + 0.35],
        [MOUTH[0], MOUTH[1] + 0.6],
        [MOUTH[0] - 0.95, MOUTH[1] + 0.35],
        8,
      ),
    ]),
    fill: 'mouth',
    stroke: ink(0.2),
  },
  strand(`M${pt(MOUTH[0] - 0.85, MOUTH[1] + 0.12)}L${pt(MOUTH[0] + 0.85, MOUTH[1] + 0.1)}`, 'eye', 0.14),
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

/** Radius of the spiky ball on the grabber's end (spikes included). */
export const TIP_R = 1.95;

/** The spiked ball on the end of the grabber, as in IQ Ball: a little burr in his own fur colours. */
export function tip(turn = 0): PathShape[] {
  const spikes = 9;
  const points: Pt[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = ((i + turn) / (spikes * 2)) * TAU;
    const r = i % 2 ? 1.22 : TIP_R - LINE / 2;
    points.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return [
    { d: poly(points), fill: 'grabDark', stroke: ink(0.24) },
    { d: ellipse(0, 0, 1.05, 1.05), fill: 'grab' },
    { d: ellipse(-0.32, -0.34, 0.42, 0.32), fill: 'grabHi' },
  ];
}

/** The round red-and-white swirl candy of Catch the Candy (radius 2.2), turned by `turn` (radians). */
export function candy(turn: number): PathShape[] {
  const r = 2.2;
  const swirl: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const a = turn + t * 2.3 * Math.PI;
    const rr = 0.25 + t * (r - 0.45);
    swirl.push([rr * Math.cos(a), rr * Math.sin(a)]);
    const w = 0.12 + 0.3 * t;
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

/** A puff of dust kicked up by a landing or a skid, centred on the floor. */
export const dust: PathShape[] = [
  { d: ellipse(-2.6, -0.7, 1.2, 0.85), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
  { d: ellipse(-0.9, -1.0, 1.3, 1.05), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
  { d: ellipse(2.7, -0.7, 1.2, 0.85), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
  { d: ellipse(1.0, -0.95, 1.35, 1.05), fill: 'dust', stroke: { color: 'dustLine', width: 0.18 } },
];
