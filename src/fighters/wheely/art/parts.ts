import type { Paint, PathShape } from '../../../render/rig/types';

/**
 * Wheely, drawn by hand in the style of the 2012 Flash game: a glossy red bubble car with a dark-red inked
 * outline, blue bumpers, chunky dark tyres and two big cartoon eyes on the windscreen. Every shape here is
 * authored as point lists that `curve` turns into cubic Béziers (Catmull-Rom), in rig units: y down, the ground
 * between the wheels at the origin, facing right. Body parts are drawn in rig space and shifted onto their bone.
 */

export type Pt = readonly [number, number];
/** A curve node; a third element 1 keeps the point a sharp corner. */
type Node = readonly [number, number] | readonly [number, number, 1];

const n = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return String(r === 0 ? 0 : r);
};
const pt = (p: Pt | Node) => `${n(p[0])} ${n(p[1])}`;
const C = (x: number, y: number): Node => [x, y, 1];

/** A smooth curve through the nodes (Catmull-Rom as cubic Béziers); corner nodes stay sharp. */
export function curve(nodes: readonly Node[], closed = true, tension = 1): string {
  const m = nodes.length;
  const at = (i: number) => nodes[closed ? (i + m) % m : Math.max(0, Math.min(m - 1, i))]!;
  const k = tension / 6;
  let d = `M${pt(at(0))}`;
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const a = at(i);
    const b = at(i + 1);
    const before = at(i - 1);
    const after = at(i + 2);
    const c1: Pt = a[2] ? [a[0], a[1]] : [a[0] + (b[0] - before[0]) * k, a[1] + (b[1] - before[1]) * k];
    const c2: Pt = b[2] ? [b[0], b[1]] : [b[0] - (after[0] - a[0]) * k, b[1] - (after[1] - a[1]) * k];
    d += cubic([a[0], a[1]], c1, c2, [b[0], b[1]]);
  }
  return closed ? d + 'Z' : d;
}

/**
 * One cubic Bézier as path data, split into pieces about 0.25 units long: the renderer tessellates curves in rig
 * units before the view scales them up, so long single curves would show facets.
 */
function cubic(a: Pt, c1: Pt, c2: Pt, b: Pt): string {
  const len =
    Math.hypot(c1[0] - a[0], c1[1] - a[1]) +
    Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) +
    Math.hypot(b[0] - c2[0], b[1] - c2[1]);
  const m = Math.max(1, Math.ceil(len / 0.25));
  const at = (t: number): Pt => {
    const u = 1 - t;
    return [
      u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
    ];
  };
  const slope = (t: number): Pt => {
    const u = 1 - t;
    return [
      3 * u * u * (c1[0] - a[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (b[0] - c2[0]),
      3 * u * u * (c1[1] - a[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (b[1] - c2[1]),
    ];
  };
  let d = '';
  for (let j = 0; j < m; j++) {
    const [t0, t1] = [j / m, (j + 1) / m];
    const h = (t1 - t0) / 3;
    const [p0, p1, s0, s1] = [at(t0), at(t1), slope(t0), slope(t1)];
    d += `C${pt([p0[0] + s0[0] * h, p0[1] + s0[1] * h])} ${pt([p1[0] - s1[0] * h, p1[1] - s1[1] * h])} ${pt(p1)}`;
  }
  return d;
}

/** Straight segments through the points. */
export function poly(points: readonly Pt[], closed = true): string {
  return points.map((p, i) => (i ? 'L' : 'M') + pt(p)).join('') + (closed ? 'Z' : '');
}

/** Points on an ellipse (angles in degrees, counter-clockwise on screen from +x), rotated by `rot`. */
export function ellipsePts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
  from = 0,
  to = 360,
  step = 15,
): Pt[] {
  const r = (rot * Math.PI) / 180;
  const out: Pt[] = [];
  const count = Math.max(1, Math.round(Math.abs(to - from) / step));
  for (let i = 0; i <= count; i++) {
    const a = ((from + ((to - from) * i) / count) * Math.PI) / 180;
    const x = rx * Math.cos(a);
    const y = -ry * Math.sin(a);
    out.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return out;
}

export const arc = (cx: number, cy: number, r: number, from: number, to: number, step = 15) =>
  ellipsePts(cx, cy, r, r, 0, from, to, step);

/** A closed ellipse. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
  return curve(ellipsePts(cx, cy, rx, ry, rot, 0, 360, 15).slice(0, -1));
}

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);

/** Clips a polygon to a convex polygon (Sutherland-Hodgman); both wind the same way. */
export function clipConvex(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let out = [...subject];
  const sign = Math.sign(area(clip));
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const inside = (p: Pt) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
    const cross = (p: Pt, q: Pt): Pt => {
      const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      const d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
      const t = d1 / (d1 - d2);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const input = out;
    out = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length]!;
      if (inside(q)) {
        if (!inside(p)) out.push(cross(p, q));
        out.push(q);
      } else if (inside(p)) out.push(cross(p, q));
    });
  }
  return out;
}

function area(p: readonly Pt[]): number {
  let s = 0;
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  });
  return s / 2;
}

/** Moves path data (absolute M L C Q Z only) and gradients by (dx, dy). */
export function shift(shapes: readonly PathShape[], dx: number, dy: number): PathShape[] {
  const move = (d: string) => {
    let i = 0;
    return d.replace(/-?\d+(?:\.\d+)?/g, (v) => n(Number(v) + (i++ % 2 ? dy : dx)));
  };
  const paint = (p: Paint): Paint =>
    typeof p === 'string'
      ? p
      : p.type === 'radial'
        ? { ...p, cx: p.cx + dx, cy: p.cy + dy }
        : { ...p, x0: p.x0 + dx, y0: p.y0 + dy, x1: p.x1 + dx, y1: p.y1 + dy };
  return shapes.map((s) => ({
    ...s,
    d: move(s.d),
    ...(s.fill === undefined ? {} : { fill: paint(s.fill) }),
  }));
}

/** A vertical gradient from y0 to y1 through palette keys. */
export function vgrad(y0: number, y1: number, ...stops: [number, string][]): Paint {
  return { type: 'linear', x0: 0, y0, x1: 0, y1, stops: stops.map(([offset, color]) => ({ offset, color })) };
}

/** A solid palette colour at partial opacity. */
export function faded(color: string, alpha: number): Paint {
  return {
    type: 'linear',
    x0: 0,
    y0: 0,
    x1: 1,
    y1: 0,
    stops: [
      { offset: 0, color, alpha },
      { offset: 1, color, alpha },
    ],
  };
}

const fill = (d: string, f: Paint, line?: string, width = SEAM): PathShape =>
  line ? { d, fill: f, stroke: { color: line, width } } : { d, fill: f };
const ink = (d: string, color: string, width: number): PathShape => ({ d, stroke: { color, width } });

/** Outline weights: the silhouette, inner seams and small details. */
export const LINE = 0.2;
export const SEAM = 0.12;
const FINE = 0.08;

// ---------------------------------------------------------------- proportions (rig space)

export const WHEEL_X = 4.3;
export const WHEEL_Y = -2.0;
export const WHEEL_R = 2.0;
const ARCH_R = 2.75;
const LIP_R = 3.35;
/** The body bone: the middle of the car, which flips and tilts around it. */
export const BODY: Pt = [0, -5.2];
export const EYES: Pt = [4.05, -8.05];
/** Hood hinge at the bottom of the windscreen, door hinge at the door's front edge, exhaust tip. */
export const HOOD: Pt = [4.45, -6.6];
export const DOOR: Pt = [2.7, -6.0];
export const EXHAUST: Pt = [-9.1, -2.2];
/** The horn, behind the front bumper: jab sound waves start here. */
export const HORN: Pt = [8.6, -3.6];
export const HEADLIGHT: Pt = [7.45, -5.2];

const SILHOUETTE: Node[] = [
  C(-8.05, -2.3),
  [-8.45, -3.15],
  [-8.62, -4.3],
  [-8.42, -5.35],
  [-7.8, -6.25],
  [-6.8, -7.6],
  [-5.65, -8.85],
  [-4.55, -9.45],
  [-3.2, -9.72],
  [0, -9.78],
  [1.5, -9.7],
  [2.45, -9.42],
  [3.2, -8.55],
  [3.9, -7.25],
  C(4.45, -6.6),
  [5.8, -6.36],
  [7.0, -6.0],
  [7.9, -5.38],
  [8.42, -4.42],
  [8.48, -3.3],
  C(8.1, -2.4),
  ...archNodes(WHEEL_X),
  C(1.4, -1.8),
  C(-1.4, -1.8),
  ...archNodes(-WHEEL_X),
];

function archNodes(cx: number): Node[] {
  const pts = arc(cx, WHEEL_Y, ARCH_R, 3, 177, 21);
  return pts.map((p, i) => (i === 0 || i === pts.length - 1 ? C(p[0], p[1]) : p));
}

/** Half disc of dark wheel well inside an arch, behind the tyre. */
const well = (cx: number) => fill(poly(arc(cx, WHEEL_Y, ARCH_R - 0.02, 0, 180, 10)), 'well');

/** The bulging fender lip around an arch, lit from above, with its two glossy streaks. */
function fender(cx: number): PathShape[] {
  const outer = arc(cx, WHEEL_Y, LIP_R, 3, 177, 12);
  const inner = arc(cx, WHEEL_Y, ARCH_R, 177, 3, 12);
  return [
    fill(
      curve([
        C(...outer[0]!),
        ...outer.slice(1, -1),
        C(...outer[outer.length - 1]!),
        C(...inner[0]!),
        ...inner.slice(1, -1),
        C(...inner[inner.length - 1]!),
      ]),
      vgrad(WHEEL_Y - LIP_R, WHEEL_Y - 0.5, [0, 'paintHi'], [0.55, 'paint'], [1, 'paint']),
      'line',
      SEAM,
    ),
    ink(curve(arc(cx, WHEEL_Y, (ARCH_R + LIP_R) / 2, 152, 122, 6), false), 'shine', 0.2),
    ink(curve(arc(cx, WHEEL_Y, (ARCH_R + LIP_R) / 2, 108, 92, 4), false), 'shine', 0.16),
  ];
}

const DOOR_WINDOW: Node[] = [
  C(-2.0, -9.12),
  [0.8, -9.2],
  [1.55, -9.12],
  [2.1, -8.6],
  C(2.58, -6.95),
  C(2.38, -6.62),
  C(-2.0, -6.72),
];
const SIDE_WINDOW: Node[] = [[-4.45, -9.08], C(-2.6, -9.12), C(-2.6, -6.72), C(-5.6, -6.62), [-5.25, -7.6]];
const HATCH_WINDOW: Node[] = [
  C(-4.72, -9.08),
  [-5.7, -8.5],
  [-6.7, -7.4],
  C(-7.42, -6.4),
  C(-6.05, -6.4),
  [-5.35, -7.7],
];

/** Window glass: deep red tint with two light diagonal reflections kept inside the frame. */
function glass(win: Node[], stripes: [number, number][], top: number, bottom: number): PathShape[] {
  return [
    fill(curve(win), vgrad(top, bottom, [0, 'glassHi'], [0.25, 'glass'], [1, 'glassLo']), 'line', SEAM),
    ...stripes.map(([x, w]) =>
      fill(
        poly([
          [x, bottom - 0.08],
          [x + w, bottom - 0.08],
          [x + w + 1.25, top + 0.12],
          [x + 1.25, top + 0.12],
        ]),
        faded('glassHi', 0.75),
      ),
    ),
  ];
}

const doorGlass = () =>
  glass(
    DOOR_WINDOW,
    [
      [-1.55, 0.42],
      [-0.55, 0.2],
    ],
    -9.2,
    -6.66,
  );

/** The race number: a white disc in a dark ring, shaded at the bottom, with a bold slanted 1. */
export function badge(cx = 0, cy = -4.75): PathShape[] {
  return [
    fill(circle(cx, cy, 1.62), 'badgeLine'),
    fill(circle(cx, cy, 1.3), 'badge'),
    fill(curve([...arc(cx, cy, 1.3, 198, 342, 18).map(([x, y]) => [x, y] as Node)]), 'badgeLo'),
    fill(
      poly([
        [cx - 0.66, cy - 0.5],
        [cx + 0.02, cy - 1.22],
        [cx + 0.62, cy - 1.22],
        [cx + 0.42, cy + 1.18],
        [cx - 0.26, cy + 1.18],
        [cx - 0.1, cy - 0.34],
        [cx - 0.52, cy - 0.12],
      ]),
      'digit',
    ),
  ];
}

const ROOF_RACK: PathShape[] = [
  ink(
    poly(
      [
        [-3.85, -9.62],
        [-3.98, -10.2],
      ],
      false,
    ),
    'rackLine',
    0.42,
  ),
  ink(
    poly(
      [
        [2.2, -9.45],
        [2.34, -10.05],
      ],
      false,
    ),
    'rackLine',
    0.42,
  ),
  ink(
    curve(
      [
        [-4.12, -10.12],
        [-1.2, -10.42],
        [1.4, -10.36],
        [2.48, -10.02],
      ],
      false,
    ),
    'rackLine',
    0.44,
  ),
  ink(
    poly(
      [
        [-3.85, -9.62],
        [-3.98, -10.2],
      ],
      false,
    ),
    'rack',
    0.24,
  ),
  ink(
    poly(
      [
        [2.2, -9.45],
        [2.34, -10.05],
      ],
      false,
    ),
    'rack',
    0.24,
  ),
  ink(
    curve(
      [
        [-4.12, -10.12],
        [-1.2, -10.42],
        [1.4, -10.36],
        [2.48, -10.02],
      ],
      false,
    ),
    'rack',
    0.26,
  ),
];

function bumper(cx: number, cy: number, rx: number, ry: number, rot: number): PathShape[] {
  return [
    fill(
      ellipse(cx, cy, rx, ry, rot),
      vgrad(cy - ry, cy + ry, [0, 'bumperHi'], [0.55, 'bumper'], [1, 'bumperLo']),
      'bumperLine',
      0.14,
    ),
    ink(curve(ellipsePts(cx, cy, rx * 0.68, ry * 0.5, rot, 150, 70, 20), false), 'bumperShine', 0.12),
  ];
}

/** The side mirror: a glossy red ball on a short stalk, just behind the windscreen. */
const MIRROR: PathShape[] = [
  ink(
    poly(
      [
        [2.35, -6.95],
        [2.75, -6.7],
      ],
      false,
    ),
    'line',
    0.26,
  ),
  {
    d: circle(2.02, -7.12, 0.5),
    fill: {
      type: 'radial',
      cx: 1.85,
      cy: -7.32,
      r: 0.62,
      stops: [
        { offset: 0, color: 'paintHi' },
        { offset: 0.6, color: 'paint' },
        { offset: 1, color: 'paintLo' },
      ],
    },
    stroke: { color: 'line', width: SEAM },
  },
  fill(ellipse(1.86, -7.33, 0.16, 0.1, -30), 'shine'),
];

const HEADLIGHT_LAMP: PathShape[] = [
  fill(
    ellipse(HEADLIGHT[0], HEADLIGHT[1], 0.4, 0.68, -18),
    vgrad(-5.9, -4.5, [0, 'chromeHi'], [1, 'chrome']),
    'line',
    SEAM,
  ),
  ink(
    poly(
      [
        [7.2, -5.42],
        [7.72, -5.6],
      ],
      false,
    ),
    'chromeLo',
    FINE,
  ),
  ink(
    poly(
      [
        [7.2, -5.0],
        [7.72, -5.18],
      ],
      false,
    ),
    'chromeLo',
    FINE,
  ),
  ink(
    poly(
      [
        [7.28, -4.72],
        [7.62, -4.84],
      ],
      false,
    ),
    'chromeLo',
    FINE,
  ),
  ink(
    poly(
      [
        [7.32, -5.8],
        [7.5, -4.6],
      ],
      false,
    ),
    'chromeLo',
    FINE,
  ),
  ink(
    poly(
      [
        [7.55, -5.86],
        [7.68, -4.72],
      ],
      false,
    ),
    'chromeLo',
    FINE,
  ),
];

const TAIL_LIGHT: PathShape[] = [
  fill(ellipse(-8.0, -5.0, 0.42, 0.55, 15), 'lamp', 'line', SEAM),
  fill(ellipse(-8.08, -5.18, 0.16, 0.2, 15), 'lampHi'),
];

/** The door's shape: from the roof down between its seams, around the fender lips to the sill. */
const DOOR_SHAPE: Node[] = [
  C(-2.32, -9.6),
  C(2.36, -9.44),
  C(2.62, -7.0),
  [2.76, -5.9],
  C(2.62, -4.9),
  ...arc(WHEEL_X, WHEEL_Y, LIP_R, 126, 174, 12),
  C(0.95, -2.02),
  C(-0.95, -2.02),
  ...arc(-WHEEL_X, WHEEL_Y, LIP_R, 6, 45, 13),
  C(-2.22, -4.62),
];

/** The whole body in rig space (wheels, eyes, pipe and opening panels are separate). */
function bodyShapes(): PathShape[] {
  return [
    ...ROOF_RACK,
    fill(
      curve(SILHOUETTE),
      vgrad(-9.8, -1.8, [0, 'paintHi'], [0.3, 'paint'], [0.8, 'paint'], [1, 'paintLo']),
      'line',
      LINE,
    ),
    ink(
      curve(
        [
          [-3.9, -9.36],
          [-1, -9.47],
          [1.6, -9.38],
        ],
        false,
      ),
      'paintHi',
      0.4,
    ),
    ink(
      curve(
        [
          [-3.4, -9.4],
          [-1.2, -9.48],
        ],
        false,
      ),
      'shine',
      0.12,
    ),
    fill(
      curve([
        [-1.5, -3.6],
        [-0.5, -3.32],
        [0.6, -3.42],
        [1.5, -3.62],
        C(1.55, -2.0),
        C(1.4, -1.8),
        C(-1.4, -1.8),
        C(-1.55, -2.0),
      ]),
      'paintLo',
    ),
    fill(curve([[5.0, -3.2], [6.4, -2.75], C(7.6, -2.3), C(6.95, -2.1), [6.0, -2.6]]), faded('paintLo', 0.7)),
    well(-WHEEL_X),
    well(WHEEL_X),
    ...fender(-WHEEL_X),
    ...fender(WHEEL_X),
    ...glass(HATCH_WINDOW, [[-6.85, 0.28]], -9.1, -6.4),
    ...glass(
      SIDE_WINDOW,
      [
        [-4.95, 0.2],
        [-4.55, 0.42],
      ],
      -9.12,
      -6.66,
    ),
    ...doorGlass(),
    ink(
      poly(
        [
          [-2.3, -9.62],
          [-2.3, -6.68],
          [-2.2, -4.62],
        ],
        false,
      ),
      'line',
      SEAM,
    ),
    ink(
      curve(
        [
          [2.62, -6.9],
          [2.76, -5.9],
          [2.62, -4.9],
        ],
        false,
      ),
      'line',
      SEAM,
    ),
    ink(
      poly(
        [
          [-1.75, -6.2],
          [-1.05, -6.2],
        ],
        false,
      ),
      'line',
      0.16,
    ),
    ink(
      curve(
        [
          [5.25, -5.98],
          [6.4, -5.72],
          [7.5, -5.18],
        ],
        false,
      ),
      'paintHi',
      0.34,
    ),
    ink(
      curve(
        [
          [5.6, -5.95],
          [6.5, -5.74],
        ],
        false,
      ),
      'shine',
      0.14,
    ),
    ...HEADLIGHT_LAMP,
    ...TAIL_LIGHT,
    ...badge(),
    ...MIRROR,
    ...bumper(-8.42, -3.45, 0.8, 0.52, -10),
    ...bumper(8.05, -3.12, 1.08, 0.44, -14),
  ];
}

const toBody = (shapes: PathShape[]) => shift(shapes, -BODY[0], -BODY[1]);

export const body = toBody(bodyShapes());

/** The open door's hole: dark cabin, a seat back and the steering wheel. */
export const doorGap = toBody([
  fill(curve(DOOR_SHAPE), 'cabin', 'line', SEAM),
  fill(
    curve([
      C(-1.9, -3.2),
      [-1.95, -6.0],
      [-1.7, -7.6],
      [-1.15, -7.85],
      [-0.75, -7.3],
      [-0.9, -6.0],
      C(-0.6, -3.2),
    ]),
    'seat',
    'cabinLine',
    FINE,
  ),
  fill(curve([C(-0.9, -3.4), [0.4, -3.6], C(1.2, -3.3), C(-0.9, -3.0)]), 'seat', 'cabinLine', FINE),
  ink(ellipse(1.85, -6.55, 0.22, 0.75, 12), 'cabinLine', 0.16),
]);

/** The door panel on its hinge (door bone space): its paint, window, number and seams. */
export const door = shift(
  [
    fill(
      curve(DOOR_SHAPE),
      vgrad(-9.6, -2.0, [0, 'paintHi'], [0.3, 'paint'], [0.85, 'paint'], [1, 'paintLo']),
      'line',
      LINE,
    ),
    ...doorGlass(),
    ...badge(),
    ink(
      poly(
        [
          [-1.75, -6.2],
          [-1.05, -6.2],
        ],
        false,
      ),
      'line',
      0.16,
    ),
  ],
  -DOOR[0],
  -DOOR[1],
);

const HOOD_TOP: Node[] = [C(4.45, -6.6), [5.8, -6.36], [7.0, -6.0], [7.9, -5.38], C(8.32, -4.7)];
const HOOD_SEAM: Node[] = [C(8.05, -4.5), [7.1, -5.3], [5.85, -5.72], C(4.6, -5.9)];

/** The engine bay the hood lifts off: dark, with the engine block's chrome caps showing. */
export const hoodBay = toBody([
  fill(curve([...HOOD_TOP, ...HOOD_SEAM]), 'cabin', 'line', SEAM),
  fill(
    curve([C(5.15, -5.55), C(5.15, -6.55), [5.6, -6.75], C(7.0, -6.6), C(7.2, -5.4)]),
    vgrad(-6.75, -5.4, [0, 'chromeHi'], [1, 'pipe']),
    'pipeLine',
    SEAM,
  ),
  fill(circle(5.65, -6.85, 0.24), 'chrome', 'pipeLine', FINE),
  fill(circle(6.25, -6.8, 0.24), 'chrome', 'pipeLine', FINE),
  fill(circle(6.85, -6.7, 0.24), 'chrome', 'pipeLine', FINE),
]);

/** The door's inside, seen when it swings open past square (door bone space): trim panel, armrest, window. */
export const doorInside = shift(
  [
    fill(curve(DOOR_SHAPE), vgrad(-9.6, -2.0, [0, 'paint'], [1, 'paintLo']), 'line', LINE),
    ...doorGlass(),
    fill(
      curve([
        C(-1.75, -6.4),
        [0.4, -6.5],
        C(2.3, -6.35),
        [2.2, -4.9],
        C(1.3, -3.55),
        C(-1.05, -3.55),
        [-1.8, -4.8],
      ]),
      'seat',
      'cabinLine',
      FINE,
    ),
    ink(
      curve(
        [
          [-1.45, -5.55],
          [0.3, -5.7],
          [2.0, -5.6],
        ],
        false,
      ),
      'cabinLine',
      0.26,
    ),
    fill(ellipse(1.6, -6.0, 0.3, 0.12), 'chrome', 'pipeLine', FINE),
  ],
  -DOOR[0],
  -DOOR[1],
);

/** The hood lid on its hinge (hood bone space). */
export const hood = shift(
  [
    fill(
      curve([...HOOD_TOP, C(8.12, -4.45), [7.75, -4.95], [6.95, -5.55], [5.8, -5.95], C(4.5, -6.18)]),
      vgrad(-6.6, -4.5, [0, 'paintHi'], [0.6, 'paint'], [1, 'paintLo']),
      'line',
      LINE,
    ),
    ink(
      curve(
        [
          [5.3, -6.15],
          [6.45, -5.9],
          [7.4, -5.42],
        ],
        false,
      ),
      'shine',
      0.14,
    ),
  ],
  -HOOD[0],
  -HOOD[1],
);

/** The exhaust pipe (exhaust bone space: its open end at the origin, pointing back). */
export const pipe: PathShape[] = [
  fill(
    curve([C(0, -0.24), C(1.2, -0.2), C(1.2, 0.22), C(0, 0.24)]),
    vgrad(-0.24, 0.24, [0, 'pipeHi'], [0.4, 'pipe'], [1, 'pipeLo']),
    'pipeLine',
    0.1,
  ),
  fill(ellipse(0, 0, 0.09, 0.22), 'pipeLine'),
];

/** A red glow over the tail light while braking (body bone space). */
export const brakeGlow: PathShape[] = toBody([
  {
    d: circle(-8.0, -5.0, 1.3),
    fill: {
      type: 'radial',
      cx: -8.0,
      cy: -5.0,
      r: 1.3,
      stops: [
        { offset: 0, color: '#fff2c0', alpha: 0.95 },
        { offset: 0.3, color: '#ff4a1a', alpha: 0.7 },
        { offset: 1, color: '#ff2000', alpha: 0 },
      ],
    },
  },
]);

// ---------------------------------------------------------------- wheels (wheel bone space, centred)

const TREADS = 10;
function treads(): string {
  let d = '';
  for (let i = 0; i < TREADS; i++) {
    const a = (i * 360) / TREADS;
    const pts = [
      ...arc(0, 0, WHEEL_R - 0.02, a - 9, a + 9, 6),
      ...arc(0, 0, WHEEL_R - 0.28, a + 7, a - 7, 7),
    ];
    d += poly(pts);
  }
  return d;
}

function bolts(): string {
  let d = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 + 54) * (Math.PI / 180);
    const [x, y] = [Math.cos(a) * 0.86, -Math.sin(a) * 0.86];
    d += poly(arc(x, y, 0.16, 0, 300, 60));
  }
  return d;
}

export const wheel: PathShape[] = [
  fill(circle(0, 0, WHEEL_R), 'tyre', 'tyreLine', 0.14),
  fill(treads(), 'tyreTread'),
  fill(circle(0, 0, 1.42), 'tyreLine'),
  fill(circle(0, 0, 1.28), vgrad(-1.28, 1.28, [0, 'rimHi'], [0.35, 'rim'], [1, 'rimLo']), 'rimLo', FINE),
  ink(circle(0, 0, 0.6), 'rimLo', 0.14),
  fill(bolts(), 'tyreLine'),
  fill(circle(0, 0, 0.42), 'hub', 'rimLo', FINE),
];

/** The same wheel spinning too fast to see its bolts: smeared rim and tread. */
export const wheelBlur: PathShape[] = [
  fill(circle(0, 0, WHEEL_R), 'tyre', 'tyreLine', 0.14),
  ink(circle(0, 0, WHEEL_R - 0.15), 'tyreTread', 0.24),
  fill(circle(0, 0, 1.42), 'tyreLine'),
  fill(circle(0, 0, 1.28), 'rim', 'rimLo', FINE),
  ...[0, 120, 240].map((a) => ink(curve(arc(0, 0, 0.95, a + 10, a + 80, 14), false), 'rimHi', 0.16)),
  ...[60, 180, 300].map((a) => ink(curve(arc(0, 0, 0.62, a, a + 50, 10), false), 'rimLo', 0.12)),
  fill(circle(0, 0, 0.42), 'hub', 'rimLo', FINE),
];

/** The tyre's fixed highlight (top left), drawn over the spinning wheel. */
export const wheelShine: PathShape[] = [
  ink(curve(arc(0, 0, 1.68, 150, 112, 8), false), 'tyreShine', 0.16),
  ink(curve(arc(0, 0, 1.68, 104, 90, 7), false), 'tyreShine', 0.16),
];

// ---------------------------------------------------------------- eyes (eyes bone space)

interface Look {
  /** Where the eyes look: -1 back .. 1 forward, -1 up .. 1 down. */
  x: number;
  y: number;
  /** How far the lids come down, 0 open .. 1 shut; `tilt` slants them (degrees, + lowers the inner corners). */
  lid?: number;
  tilt?: number;
  pupil?: number;
  iris?: number;
  /** Brows (only strong expressions have them, as in the game): lift (up is negative y) and each brow's rotation. */
  brows?: boolean;
  lift?: number;
  near?: number;
  far?: number;
  lashes?: boolean;
}

interface EyeShape {
  c: Pt;
  rx: number;
  ry: number;
  rot: number;
}

const NEAR: EyeShape = { c: [-0.4, 0.02], rx: 1.0, ry: 1.5, rot: -7 };
const FAR: EyeShape = { c: [0.52, -0.08], rx: 0.64, ry: 1.36, rot: -3 };

function eyeOutline(e: EyeShape): Pt[] {
  return ellipsePts(e.c[0], e.c[1], e.rx, e.ry, e.rot, 0, 360, 12).slice(0, -1);
}

/** A brow: a thick tapered stroke of ink, `len` long, centred at (cx, cy), rotated by `rot`. */
function brow(cx: number, cy: number, len: number, rot: number, thick = 0.3): string {
  const r = (rot * Math.PI) / 180;
  const top: Node[] = [];
  const bottom: Node[] = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6 - 0.5;
    const x = u * len;
    const bend = -0.18 * (1 - 4 * u * u);
    const t = (thick / 2) * Math.sqrt(Math.max(0.08, 1 - 4 * u * u));
    top.push([x, bend - t]);
    bottom.push([x, bend + t]);
  }
  const pts = [...top, ...bottom.reverse()].map(
    ([x, y]) => [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)] as Node,
  );
  return curve(pts);
}

function oneEye(e: EyeShape, look: Look, near: boolean): PathShape[] {
  const outline = eyeOutline(e);
  const shapes: PathShape[] = [fill(poly(outline), 'eyeWhite', 'eyeLine', 0.13)];
  const k = near ? 1 : 0.62;
  const iris = look.iris ?? 1;
  const ic: Pt = [e.c[0] + (near ? 0.14 : 0.16) + look.x * 0.3 * k, e.c[1] + 0.15 + look.y * 0.42];
  const irx = (near ? 0.46 : 0.27) * iris;
  const iry = (near ? 0.62 : 0.5) * iris;
  shapes.push(
    fill(
      poly(clipConvex(ellipsePts(ic[0], ic[1], irx, iry, e.rot, 0, 360, 15).slice(0, -1), outline)),
      'iris',
    ),
  );
  const pr = 0.3 * (look.pupil ?? 1) * iris;
  const pc: Pt = [ic[0] + 0.04 * k, ic[1] + 0.03];
  shapes.push(
    fill(
      poly(
        clipConvex(
          ellipsePts(
            pc[0],
            pc[1],
            pr * k * (near ? 1 : 0.95),
            pr * (near ? 1 : 1.0),
            e.rot,
            0,
            360,
            20,
          ).slice(0, -1),
          outline,
        ),
      ),
      'pupil',
    ),
  );
  shapes.push(fill(circle(pc[0] - 0.13 * k, pc[1] - 0.16, 0.12 * (near ? 1 : 0.7)), 'eyeWhite'));
  shapes.push(fill(circle(pc[0] + 0.12 * k, pc[1] + 0.13, 0.05), 'eyeWhite'));
  const lid = look.lid ?? 0;
  if (lid > 0) {
    const top = e.c[1] - e.ry;
    const y = top + lid * 2 * e.ry + (lid >= 1 ? 0.1 : 0);
    const slope = Math.tan(((look.tilt ?? 0) * (near ? 1 : -1) * Math.PI) / 180);
    const w = 3;
    const cut: Pt[] = [
      [e.c[0] - w, y - slope * w],
      [e.c[0] + w, y + slope * w],
      [e.c[0] + w, top - 2],
      [e.c[0] - w, top - 2],
    ];
    const cover = clipConvex(outline, cut);
    if (cover.length > 2) shapes.push(fill(poly(cover), 'lid', 'eyeLine', 0.1));
  }
  shapes.push(ink(poly([...outline, outline[0]!], false), 'eyeLine', 0.13));
  return shapes;
}

/** Both eyes for one expression; the far eye sits behind the near one. */
export function eyes(look: Look): PathShape[] {
  const lift = look.lift ?? 0;
  const shapes = [...oneEye(FAR, look, false), ...oneEye(NEAR, look, true)];
  if (look.brows) {
    shapes.push(fill(brow(-0.72, -1.95 + lift, 1.3, -22 + (look.near ?? 0), 0.38), 'brow'));
    shapes.push(fill(brow(0.66, -1.86 + lift, 0.86, 12 - (look.far ?? 0), 0.32), 'brow'));
  }
  if (look.lashes) {
    for (const [x, y, r] of [
      [-1.15, -0.95, -40],
      [-0.95, -1.15, -25],
    ] as const)
      shapes.push(fill(brow(x, y, 0.42, r, 0.12), 'brow'));
  }
  return shapes;
}

export const EXPRESSIONS: Record<string, Look> = {
  eyes: { x: 0.25, y: 0.05 },
  eyesBlink1: { x: 0.25, y: 0.05, lid: 0.35 },
  eyesBlink2: { x: 0.25, y: 0.05, lid: 0.7 },
  eyesClosed: { x: 0.25, y: 0.05, lid: 1, lift: 0.08 },
  eyesFocus: { x: 0.6, y: 0.05, lid: 0.22, tilt: 8, near: 14, far: 10, lift: 0.08 },
  eyesAngry: { brows: true, x: 0.7, y: 0.1, lid: 0.3, tilt: 16, near: 38, far: 32, lift: 0.2, pupil: 1.1 },
  eyesShout: {
    brows: true,
    x: 0.7,
    y: -0.1,
    lid: 0.12,
    tilt: 10,
    near: 30,
    far: 24,
    lift: 0.05,
    iris: 0.9,
    pupil: 0.8,
  },
  eyesSurprised: { brows: true, x: 0.2, y: 0, iris: 0.82, pupil: 0.65, lift: -0.42, near: -8, far: -10 },
  eyesHurt: { brows: true, x: -0.2, y: 0.3, lid: 0.55, tilt: -14, near: -22, far: -26, lift: -0.1 },
  eyesDizzy: { x: -0.5, y: -0.4, lid: 0.25, iris: 0.9, near: -15, far: -18 },
  eyesUp: { x: 0.25, y: -0.85, lift: -0.15, near: -6, far: -6 },
  eyesDown: { x: 0.45, y: 0.85, lid: 0.15, near: 8, far: 6 },
  eyesBack: { x: -0.95, y: 0.1, near: 4, far: 6 },
  eyesScared: { brows: true, x: 0.1, y: 0.2, iris: 0.85, pupil: 0.55, lift: -0.3, near: -30, far: -32 },
};

// ---------------------------------------------------------------- effects (fx bone space)

/** A band of ring around the origin, `thick` wide at radius `r`, from angle `from` to `to` (degrees). */
function band(r: number, thick: number, from: number, to: number): string {
  const outer = arc(0, 0, r + thick / 2, from, to, 10);
  const inner = arc(0, 0, r - thick / 2, to, from, 10);
  return curve([
    C(...outer[0]!),
    ...outer.slice(1, -1),
    C(...outer[outer.length - 1]!),
    C(...inner[0]!),
    ...inner.slice(1, -1),
    C(...inner[inner.length - 1]!),
  ]);
}

/** Horn sound waves: nested arcs opening forward from the horn. */
export function waves(count: number, thick = 0.26): PathShape[] {
  return Array.from({ length: count }, (_, i) =>
    fill(band(0.9 + i * 0.75, thick, -50, 50), 'wave', 'waveLine', 0.08),
  );
}

/** A horn blast where it hits: a soft disc of sound (radius 1, centred) with ringing arcs on its leading side. */
export function beep(rings: number): PathShape[] {
  return [
    {
      d: circle(0, 0, 1),
      fill: {
        type: 'radial',
        cx: 0,
        cy: 0,
        r: 1,
        stops: [
          { offset: 0, color: 'wave', alpha: 0.12 },
          { offset: 0.72, color: 'wave', alpha: 0.5 },
          { offset: 1, color: 'wave', alpha: 0 },
        ],
      },
    },
    ...Array.from({ length: rings }, (_, i) =>
      fill(band(0.4 + i * 0.2, 0.08, -55, 55), 'wave', 'waveLine', 0.035),
    ),
  ];
}

/**
 * A motion smear: a crescent of radius 1 that sweeps clockwise through `span` degrees to end at -20 degrees,
 * growing from nothing at its tail to a third of the radius at its head.
 */
export function swoosh(span: number): PathShape[] {
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= 18; i++) {
    const s = i / 18;
    const a = ((span - 20 - span * s) * Math.PI) / 180;
    const r = 1 - 0.36 * s ** 0.8;
    outer.push([Math.cos(a), -Math.sin(a)]);
    inner.push([r * Math.cos(a), -r * Math.sin(a)]);
  }
  const [tail, head] = [outer[0]!, outer[outer.length - 1]!];
  return [
    fill(
      curve([
        C(...tail),
        ...outer.slice(1, -1),
        C(...head),
        C(...inner[inner.length - 1]!),
        ...inner.slice(1, -1).reverse(),
      ]),
      {
        type: 'linear',
        x0: tail[0],
        y0: tail[1],
        x1: head[0],
        y1: head[1],
        stops: [
          { offset: 0, color: 'speed', alpha: 0 },
          { offset: 1, color: 'speed', alpha: 0.85 },
        ],
      },
    ),
  ];
}

/** Gravel flung forward low off a spinning tyre, from the contact point. */
export const gravel: PathShape[] = (() => {
  const stones: [number, number, number, string][] = [
    [0.8, -0.3, 0.3, 'stone'],
    [1.6, -0.8, 0.24, 'stoneHi'],
    [2.4, -0.45, 0.34, 'stoneLo'],
    [3.1, -1.1, 0.22, 'stone'],
    [3.7, -0.35, 0.28, 'stoneHi'],
    [4.4, -0.85, 0.2, 'stoneLo'],
    [2.0, -1.45, 0.17, 'stone'],
    [4.9, -0.3, 0.16, 'stone'],
  ];
  return [
    fill(curve([C(0, 0), [1.5, -0.9], [3.2, -1.1], [5.0, -0.6], C(5.4, 0)]), faded('dust', 0.55)),
    ...stones.map(([x, y, r, c], i) =>
      fill(poly(ellipsePts(x, y, r, r * 0.8, i * 37, 0, 360, 60).slice(0, -1)), c, 'stoneLine', 0.06),
    ),
  ];
})();

/** A smoke puff (`size` 0..4: growing, then breaking into balls), centred on the origin. */
export function puff(stage: number): PathShape[] {
  const sets: [number, number, number][][] = [
    [
      [0, 0, 0.45],
      [0.4, -0.15, 0.32],
      [-0.3, 0.1, 0.3],
    ],
    [
      [0, 0, 0.8],
      [0.7, -0.3, 0.55],
      [-0.6, -0.2, 0.55],
      [0.2, -0.7, 0.5],
      [-0.1, 0.5, 0.45],
    ],
    [
      [0, 0, 1.1],
      [1.0, -0.4, 0.75],
      [-0.9, -0.3, 0.75],
      [0.25, -1.0, 0.7],
      [-0.25, 0.75, 0.6],
      [0.9, 0.5, 0.55],
      [-0.95, 0.55, 0.5],
    ],
    [
      [0, -0.2, 0.75],
      [1.3, -0.6, 0.55],
      [-1.2, -0.5, 0.55],
      [0.4, -1.4, 0.45],
      [-0.4, 1.0, 0.45],
      [1.3, 0.7, 0.42],
      [-1.3, 0.8, 0.38],
    ],
    [
      [1.6, -0.9, 0.3],
      [-1.6, -0.8, 0.28],
      [0.5, -1.8, 0.24],
      [-0.6, 1.4, 0.22],
      [1.6, 1.0, 0.2],
      [-1.5, 1.1, 0.18],
    ],
  ];
  const balls = sets[Math.max(0, Math.min(4, stage))]!;
  return [
    ...balls.map(([x, y, r]) => fill(circle(x, y, r + 0.09), 'smokeLine')),
    ...balls.map(([x, y, r]) => fill(circle(x, y, r), 'smoke')),
    ...balls.map(([x, y, r]) => fill(circle(x - r * 0.25, y - r * 0.3, r * 0.45), 'smokeHi')),
  ];
}

/** Two dark tyre marks along the ground, trailing back from the origin. */
export const skid: PathShape[] = [
  fill(curve([C(0, -0.05), [-2.2, -0.12], C(-4.4, -0.06), C(-4.4, 0.06), [-2.2, 0.1], C(0, 0.07)]), {
    type: 'linear',
    x0: 0,
    y0: 0,
    x1: -4.4,
    y1: 0,
    stops: [
      { offset: 0, color: 'skid', alpha: 0.8 },
      { offset: 1, color: 'skid', alpha: 0 },
    ],
  }),
];

/** An exhaust backfire: a ragged flame blasting back (towards -x) from the pipe at the origin. */
export function flame(seed: number): PathShape[] {
  const j = (i: number) => Math.sin(seed * 2.3 + i * 1.7) * 0.18;
  const outer: Node[] = [
    C(0, -0.32),
    [-0.8, -0.75 + j(1)],
    [-1.7, -1.05 + j(2)],
    [-2.4, -0.75 + j(3)],
    [-3.1 + j(4), -0.15],
    [-2.5, 0.35 + j(5)],
    [-3.0 + j(6), 0.75],
    [-2.0, 0.95 + j(7)],
    [-1.0, 0.75 + j(8)],
    C(0, 0.32),
  ];
  const inner: Node[] = [
    C(0, -0.18),
    [-0.9, -0.5 + j(2)],
    [-1.8, -0.45 + j(4)],
    [-2.2 + j(1), 0.05],
    [-1.7, 0.45 + j(3)],
    [-0.8, 0.45],
    C(0, 0.18),
  ];
  const core: Node[] = [C(0, -0.1), [-0.7, -0.22], [-1.2 + j(5), 0], [-0.7, 0.24], C(0, 0.1)];
  return [
    fill(curve(outer), 'flame', 'flameLine', 0.1),
    fill(curve(inner), 'flameHi'),
    fill(curve(core), 'flameCore'),
  ];
}

/** The little wooden ramp from his puzzle levels (prop bone space: its foot on the ground at the origin). */
export const ramp: PathShape[] = [
  fill(
    poly([
      [5.6, -2.55],
      [6.9, -3.05],
      [6.9, 0],
      [5.6, 0],
    ]),
    vgrad(-3, 0, [0, 'wood'], [1, 'woodLo']),
    'woodLine',
    0.12,
  ),
  ink(
    poly(
      [
        [5.65, -2.4],
        [6.85, -0.1],
      ],
      false,
    ),
    'woodLine',
    0.1,
  ),
  ink(
    poly(
      [
        [6.85, -2.9],
        [5.65, -0.1],
      ],
      false,
    ),
    'woodLine',
    0.1,
  ),
  fill(
    curve([C(-0.15, 0.02), C(7.45, -3.3), C(7.62, -2.78), C(0.25, 0.08)]),
    vgrad(-3.3, 0, [0, 'woodHi'], [0.4, 'wood'], [1, 'woodLo']),
    'woodLine',
    0.13,
  ),
  ink(
    poly(
      [
        [0.9, -0.3],
        [7.1, -2.92],
      ],
      false,
    ),
    'woodHi',
    0.1,
  ),
  ink(
    poly(
      [
        [2.3, -0.8],
        [4.4, -1.72],
      ],
      false,
    ),
    'woodLo',
    0.06,
  ),
  fill(circle(1.2, -0.38, 0.07), 'woodLine'),
  fill(circle(6.9, -2.85, 0.07), 'woodLine'),
];

/** A headlight flash: a soft cone forward from the lamp plus a four-point glint on it. */
export const beam: PathShape[] = [
  fill(
    poly([
      [0, -0.5],
      [7, -2.4],
      [7, 2.0],
      [0, 0.5],
    ]),
    {
      type: 'linear',
      x0: 0,
      y0: 0,
      x1: 7,
      y1: 0,
      stops: [
        { offset: 0, color: 'beam', alpha: 0.75 },
        { offset: 1, color: 'beam', alpha: 0 },
      ],
    },
  ),
  fill(
    curve([
      C(0, -1.4),
      [0.18, -0.18],
      C(1.4, 0),
      [0.18, 0.18],
      C(0, 1.4),
      [-0.18, 0.18],
      C(-1.4, 0),
      [-0.18, -0.18],
    ]),
    'glint',
    'beamLine',
    0.06,
  ),
];

/** Speed lines streaming back behind a dash (origin at the car's tail). */
export const speedLines: PathShape[] = [
  [-1.0, -7.5, 4.5],
  [-0.4, -5.2, 6],
  [-1.6, -3.4, 3.8],
  [-0.8, -8.9, 2.6],
].map(([x, y, len]) =>
  fill(curve([C(x!, y! - 0.09), C(x! - len!, y!), C(x!, y! + 0.09)]), {
    type: 'linear',
    x0: x!,
    y0: 0,
    x1: x! - len!,
    y1: 0,
    stops: [
      { offset: 0, color: 'speed', alpha: 0.9 },
      { offset: 1, color: 'speed', alpha: 0 },
    ],
  }),
);

function star(cx: number, cy: number, r: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 - 90) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return poly(pts);
}

/**
 * The charge flash at full revs (Rev Up): a ragged burst of fourteen uneven rays about 7.5 units across, with a
 * white-hot core, centred on the origin. It draws behind the car, so the rays flare out round the body.
 */
export const flash: PathShape[] = (() => {
  const RAYS = [1, 0.78, 0.94, 0.7, 1.06, 0.82, 0.9, 0.74, 1.02, 0.8, 0.96, 0.72, 1.04, 0.86];
  const burst = (r: number, waist: number, turn: number): Pt[] =>
    RAYS.flatMap((len, i): Pt[] => {
      const a = (((i * 360) / RAYS.length + turn) * Math.PI) / 180;
      const b = ((((i + 0.5) * 360) / RAYS.length + turn) * Math.PI) / 180;
      return [
        [r * len * Math.cos(a), r * len * Math.sin(a)],
        [r * waist * Math.cos(b), r * waist * Math.sin(b)],
      ];
    });
  return [
    fill(poly(burst(7.6, 0.5, -90)), 'beam', 'beamLine', LINE),
    fill(poly(burst(4.6, 0.56, -77)), 'flameHi'),
    fill(ellipse(0, 0, 2.6, 2.3), 'glint'),
  ];
})();

/** Dizzy stars circling over the roof. */
export const stars: PathShape[] = [
  [-1.6, 0.15, 0.5],
  [0.9, -0.25, 0.42],
  [2.1, 0.3, 0.36],
].map(([x, y, r]) => fill(star(x!, y!, r!), 'star', 'starLine', 0.07));

/** The hood's pop-up spring: a zigzag coil one unit tall, standing on the origin. */
export const spring: PathShape[] = (() => {
  const pts: Pt[] = [[0, 0]];
  for (let i = 1; i <= 8; i++) pts.push([i % 2 ? 0.32 : -0.32, -i / 9]);
  pts.push([0, -1]);
  return [ink(poly(pts, false), 'pipeLine', 0.16), ink(poly(pts, false), 'chrome', 0.07)];
})();

// ---------------------------------------------------------------- Full Throttle (the Final Smash)

/**
 * The turbo jet out of the exhaust when he floors it for Full Throttle: a long ragged flame blasting back (towards
 * -x) from the pipe at the origin, about 6.5 long, orange outside, yellow, then a blue-hot core.
 */
export function turbo(seed: number): PathShape[] {
  const j = (i: number) => Math.sin(seed * 2.9 + i * 1.3) * 0.22;
  const outer: Node[] = [
    C(0, -0.42),
    [-1.2, -0.95 + j(1)],
    [-2.6, -1.18 + j(2)],
    [-3.9, -0.98 + j(3)],
    [-5.2, -0.62 + j(4)],
    [-6.6 + j(5), -0.12],
    [-5.5, 0.28 + j(6)],
    [-6.1 + j(7), 0.72],
    [-4.5, 0.98 + j(8)],
    [-2.9, 1.08 + j(9)],
    [-1.3, 0.86 + j(10)],
    C(0, 0.42),
  ];
  const inner: Node[] = [
    C(0, -0.28),
    [-1.4, -0.66 + j(2)],
    [-3.1, -0.64 + j(4)],
    [-4.5 + j(6), -0.18],
    [-3.9, 0.32 + j(8)],
    [-2.5, 0.62 + j(3)],
    [-1.1, 0.56],
    C(0, 0.28),
  ];
  const core: Node[] = [
    C(0, -0.17),
    [-1.3, -0.32 + j(5)],
    [-2.8 + j(7), -0.06],
    [-2.3, 0.2],
    [-1.0, 0.3],
    C(0, 0.17),
  ];
  const hot: Node[] = [C(0, -0.08), [-0.8, -0.13], [-1.4 + j(9), 0], [-0.8, 0.13], C(0, 0.08)];
  return [
    fill(curve(outer), 'flame', 'flameLine', 0.1),
    fill(curve(inner), 'flameHi'),
    fill(curve(core), 'turbo', 'turboLine', 0.04),
    fill(curve(hot), 'turboCore'),
  ];
}

/** The bow wave's size as drawn: from the ground under the bumper out to its front, and its height over the bumper. */
export const BOOM = { length: 20, height: 14 };

/**
 * The bow wave a car shoves ahead of it at full throttle: a faint dome of pressed air from the ground under his front
 * bumper (the origin) out to its front BOOM.length ahead, BOOM.height tall over the bumper, with three arcs of wind
 * spreading out from the bumper like his horn waves, each taller than the last. The air and the arcs fade in from the
 * bumper and are brightest at their fronts; the outermost arc is the dome's inked edge, so the drawing ends exactly at
 * its front.
 */
export const boom: PathShape[] = (() => {
  const { length: L, height: H } = BOOM;
  /** A quarter ellipse from the ground ahead (0 degrees) up over the bumper (90). */
  const quarter = (rx: number, ry: number) => ellipsePts(0, 0, rx, ry, 0, 0, 90, 6);
  /** An arc of wind along the quarter ellipse at `k` of the way out, `thick` at its middle and thinner at its ends. */
  const arcOf = (k: number, thick: number) => {
    const out = quarter(k * L, (0.55 + 0.45 * k) * H);
    const inner = out.map(([x, y], i): Pt => {
      const a = (i / (out.length - 1)) * (Math.PI / 2);
      const t = thick * (0.3 + 0.7 * Math.sin(2 * a));
      const r = Math.hypot(x, y);
      return [x * (1 - t / r), y * (1 - t / r)];
    });
    return curve([
      C(...out[0]!),
      ...out.slice(1, -1),
      C(...out[out.length - 1]!),
      C(...inner[inner.length - 1]!),
      ...inner.slice(1, -1).reverse(),
      C(...inner[0]!),
    ]);
  };
  const streak = (y: number, x0: number, len: number) =>
    fill(curve([C(x0, y - 0.12), C(x0 + len, y), C(x0, y + 0.12)]), {
      type: 'linear',
      x0,
      y0: 0,
      x1: x0 + len,
      y1: 0,
      stops: [
        { offset: 0, color: 'speed', alpha: 0 },
        { offset: 1, color: 'speed', alpha: 0.9 },
      ],
    });
  /** `color` fading in from the bumper to `to` units ahead. */
  const ahead = (color: string, to: number, from: number, alpha: number): Paint => ({
    type: 'linear',
    x0: 0,
    y0: 0,
    x1: to,
    y1: 0,
    stops: [
      { offset: 0, color, alpha: from },
      { offset: 1, color, alpha },
    ],
  });
  const dome = quarter(L, H);
  return [
    fill(
      curve([C(0, 0), C(...dome[0]!), ...dome.slice(1, -1), C(...dome[dome.length - 1]!)]),
      ahead('turbo', L, 0, 0.2),
    ),
    streak(-2.2, 1.5, 9),
    streak(-6.2, 0.8, 7),
    streak(-10, 0.5, 4.5),
    fill(arcOf(0.42, 0.4), ahead('speed', 0.42 * L, 0.05, 0.8)),
    fill(arcOf(0.7, 0.5), ahead('speed', 0.7 * L, 0.05, 0.85)),
    fill(arcOf(1, 0.65), ahead('speed', L, 0.15, 0.95), 'turboLine', 0.08),
  ];
})();

/**
 * A crash: a comic burst of twelve uneven spikes (radius 1, centred), yellow with an orange heart and a white-hot
 * middle, and three chips of paint flying off it.
 */
export const crash: PathShape[] = (() => {
  const SPIKES = [1, 0.62, 0.9, 0.7, 1.08, 0.6, 0.86, 0.74, 1.02, 0.64, 0.94, 0.68];
  const burst = (r: number, waist: number, turn: number): Pt[] =>
    SPIKES.flatMap((len, i): Pt[] => {
      const a = (((i * 360) / SPIKES.length + turn) * Math.PI) / 180;
      const b = ((((i + 0.5) * 360) / SPIKES.length + turn) * Math.PI) / 180;
      return [
        [r * len * Math.cos(a), r * len * Math.sin(a)],
        [r * waist * Math.cos(b), r * waist * Math.sin(b)],
      ];
    });
  const chip = (x: number, y: number, s: number, rot: number) =>
    fill(ellipse(x, y, 0.13 * s, 0.07 * s, rot), 'paint', 'line', 0.03);
  return [
    fill(poly(burst(1, 0.5, -84)), 'star', 'starLine', 0.06),
    fill(poly(burst(0.62, 0.52, -71)), 'flame'),
    fill(ellipse(0, 0, 0.3, 0.27), 'glint'),
    chip(1.25, -0.55, 1.2, -30),
    chip(1.05, 0.7, 1, 25),
    chip(-0.2, -1.25, 0.9, 70),
  ];
})();
