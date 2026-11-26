import type { ArtSymbol, ColorRef, PathShape } from '../../../render/rig/types';

/**
 * Bloxorz block's drawings, made from scratch in the Coolmath Flash style: flat fills, a heavy dark outline and a
 * 3/4 bevel. The block is two 12-unit cubes; its long face is drawn standing, centred on the block bone (local
 * x -6..6, y -12..12, y down). Lying is the same drawing turned 90 degrees.
 *
 * The material is painted, not photographic: exposed gunmetal under broken copper-rust clouds and dark pitting.
 */

export type Pt = [number, number];

export const HALF_W = 6;
export const HALF_H = 12;

/**
 * The 3/4 view: the block's back face sits this far up and right of its front face on screen. It is fixed in
 * screen space, so the bevel is redrawn for every ANGLE_STEP degrees of rotation and the lit top face stays on
 * top while the block tumbles, like the original's pre-rendered rotation frames.
 */
export const DEPTH: Pt = [2.2, -2.6];
export const ANGLE_STEP = 3;
export const ANGLES = 360 / ANGLE_STEP;

const OUTLINE = 0.74;
const INNER = 0.28;
/** Light from the upper left (y down), for shading the bevel faces. */
const LIGHT: Pt = [-0.37, -0.93];

const num = (v: number) => String(Math.round(v * 1000) / 1000);
export const poly = (pts: Pt[], close = true) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${num(x)} ${num(y)}`).join('') + (close ? 'Z' : '');

/** A circle as four cubic arcs. */
export function circle(cx: number, cy: number, r: number): string {
  const k = r * 0.5523;
  return (
    `M${num(cx + r)} ${num(cy)}` +
    `C${num(cx + r)} ${num(cy + k)} ${num(cx + k)} ${num(cy + r)} ${num(cx)} ${num(cy + r)}` +
    `C${num(cx - k)} ${num(cy + r)} ${num(cx - r)} ${num(cy + k)} ${num(cx - r)} ${num(cy)}` +
    `C${num(cx - r)} ${num(cy - k)} ${num(cx - k)} ${num(cy - r)} ${num(cx)} ${num(cy - r)}` +
    `C${num(cx + k)} ${num(cy - r)} ${num(cx + r)} ${num(cy - k)} ${num(cx + r)} ${num(cy)}Z`
  );
}

/** Sutherland-Hodgman clip of a polygon to an axis-aligned box. */
function clipBox(pts: Pt[], x0: number, y0: number, x1: number, y1: number): Pt[] {
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = pts;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    input.forEach((p, i) => {
      const prev = input[(i + input.length - 1) % input.length]!;
      if (inside(p)) {
        if (!inside(prev)) out.push(cut(prev, p));
        out.push(p);
      } else if (inside(prev)) out.push(cut(prev, p));
    });
    if (!out.length) break;
  }
  return out;
}

/** A wobbly blob around (x, y), optionally with a hole, seeded so it never changes. */
interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
  seed: number;
  /** Turn of the blob's long axis, in radians. */
  rot?: number;
  /** Points round the outline. */
  n?: number;
}

function blob({ x, y, rx, ry, seed, rot = 0, n = 44 }: Blob, scale = 1): Pt[] {
  const p1 = seed * 1.7;
  const p2 = seed * 2.9 + 1;
  const p3 = seed * 0.6 + 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const w =
      1 +
      0.22 * Math.sin(2 * a + p1) +
      0.14 * Math.sin(3 * a + p2) +
      0.09 * Math.sin(5 * a + p3) +
      0.06 * Math.sin(8 * a + p1 + p2);
    const lx = Math.cos(a) * rx * w * scale;
    const ly = Math.sin(a) * ry * w * scale;
    return [x + lx * c - ly * s, y + lx * s + ly * c] as Pt;
  });
}

/** A small seeded generator, so the texture is the same on every build. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Stain = Blob & { color: ColorRef };

const CLOUDS: Stain[] = [
  { x: -2.7, y: -8.4, rx: 3.5, ry: 3.7, seed: 5, rot: -0.5, color: 'steelDark' },
  { x: 2.3, y: -3.6, rx: 3.5, ry: 3.2, seed: 10, rot: 0.4, color: 'steelDark' },
  { x: 2.2, y: -9.1, rx: 3.9, ry: 3.2, seed: 3, rot: 0.7, color: 'rust' },
  { x: -3.2, y: -4.6, rx: 3.1, ry: 2.7, seed: 6, rot: -0.4, color: 'rust' },
  { x: -2.5, y: -1, rx: 2.3, ry: 2.1, seed: 1, rot: 0.2, color: 'rust' },
  { x: 3.3, y: -9.9, rx: 1.4, ry: 1.1, seed: 11, rot: 0.42, color: 'rust2' },
];

const PITS: Stain[] = (() => {
  const rnd = seeded(23);
  return Array.from({ length: 28 }, (_, i) => {
    const r = 0.08 + rnd() * 0.18;
    return {
      x: (rnd() - 0.5) * 11,
      y: -0.5 - rnd() * 11,
      rx: r,
      ry: r * 0.8,
      seed: rnd() * 60,
      n: 7,
      color: i % 4 === 0 ? 'rust2' : 'steelDark',
    };
  });
})();

const rect = (hw: number, hh: number): Pt[] => [
  [-hw, -hh],
  [hw, -hh],
  [hw, hh],
  [-hw, hh],
];

function face(hw: number, hh: number, simple = false): PathShape[] {
  const outline = poly(rect(hw, hh));
  const stains = simple ? CLOUDS.filter((c) => c.rx > 2.4) : [...CLOUDS, ...PITS];
  return [
    { d: outline, fill: 'steel' },
    ...stains.flatMap((s): PathShape[] => {
      const painted = !simple && s.rx > 1;
      const pts = blob(s, painted ? 1.35 : 1);
      // Matching opposite ends keep this stateless rig continuous when a two-tip cycle returns to idle.
      return ([1, -1] as const).flatMap((dir): PathShape[] => {
        const clipped = clipBox(
          dir === 1 ? pts : pts.map(([x, y]) => [-x, -y]),
          -hw + 0.08,
          -hh + 0.08,
          hw - 0.08,
          hh - 0.08,
        );
        if (clipped.length < 3) return [];
        return [
          {
            d: poly(clipped),
            fill: painted
              ? {
                  type: 'radial',
                  cx: dir * s.x,
                  cy: dir * s.y,
                  r: Math.max(s.rx, s.ry) * 1.11,
                  stops: [
                    { color: s.color, offset: 0, alpha: 0.64 },
                    { color: s.color, offset: 0.32, alpha: 0.62 },
                    { color: s.color, offset: 0.67, alpha: 0.32 },
                    { color: s.color, offset: 1, alpha: 0 },
                  ],
                }
              : s.color,
          },
        ];
      });
    }),
    ...(simple ? [] : ([-1, 1] as const)).flatMap((dir): PathShape[] => [
      {
        d: poly(
          [
            [hw, -hh],
            [hw - 1.7, -hh],
            [hw - 0.5, -hh + 0.9],
            [hw, -hh + 2.2],
          ].map(([x, y]) => [dir * x!, dir * y!]),
        ),
        fill: 'chip',
      },
      {
        d: poly(
          [
            [-hw, -hh * 0.57],
            [-hw * 0.43, -hh * 0.54],
            [0, -hh * 0.13],
            [hw * 0.8, -hh * 0.24],
          ].map(([x, y]) => [dir * x!, dir * y!]),
          false,
        ),
        stroke: { color: 'vein', width: 0.38 },
      },
      {
        d: poly(
          [
            [-hw + 0.56, 0],
            [-hw + 0.56, -hh + 0.55],
            [hw - 0.56, -hh + 0.55],
          ].map(([x, y]) => [dir * x!, dir * y!]),
          false,
        ),
        stroke: { color: 'sheen', width: 0.48 },
      },
    ]),
    simple
      ? { d: poly(rect(hw - 0.14, hh - 0.14)), stroke: { color: 'rim', width: 0.28 } }
      : { d: outline + poly(rect(hw - 0.28, hh - 0.28)), fill: 'rim' },
    { d: outline, stroke: { color: 'line', width: INNER } },
  ];
}

function hull(pts: Pt[]): Pt[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half([...s].reverse())];
}

/**
 * Rust stains on a bevel face, in the face's own (u along the edge, v into the depth) unit square. Opposite faces
 * share a pattern, so a block turned half a lap looks the same.
 */
function faceStains(length: number, pair: number): Pt[][] {
  const rnd = seeded(31 + pair);
  const count = Math.round(length / 3);
  return Array.from({ length: count }, (_, k) => {
    const u = (k + 0.15 + 0.7 * rnd()) / count;
    const big = k % 3 !== 1;
    const ru = (big ? 0.8 + 1.4 * rnd() : 0.25 + 0.2 * rnd()) / length;
    const v = 0.2 + 0.6 * rnd();
    const rv = big ? 0.18 + 0.22 * rnd() : 0.1 + 0.06 * rnd();
    const b = { x: u, y: v, rx: ru, ry: rv, seed: 1 + 20 * rnd() };
    return clipBox(blob({ ...b, n: 20 }), 0.02, 0.04, 0.98, 0.96);
  });
}

/**
 * The bevel for a block turned `deg` degrees on screen, in the block's own space: the outline hull of front and
 * back faces, then each visible side face: its tone, its stains, a lit edge and its outline.
 */
function bevel(hw: number, hh: number, deg: number): PathShape[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const d: Pt = [DEPTH[0] * c + DEPTH[1] * s, -DEPTH[0] * s + DEPTH[1] * c];
  const corners = rect(hw, hh);
  const back = corners.map(([x, y]) => [x + d[0], y + d[1]] as Pt);
  const normals: Pt[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const faces: PathShape[] = [];
  normals.forEach(([nx, ny], i) => {
    if (nx * d[0] + ny * d[1] <= 1e-6) return;
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    const quad = poly([a, b, [b[0] + d[0], b[1] + d[1]], [a[0] + d[0], a[1] + d[1]]]);
    const lit = (nx * c - ny * s) * LIGHT[0] + (nx * s + ny * c) * LIGHT[1];
    const tone = Math.round(Math.max(0, lit) * 16);
    const at = ([u, v]: Pt): Pt => [a[0] + (b[0] - a[0]) * u + d[0] * v, a[1] + (b[1] - a[1]) * u + d[1] * v];
    const edge = (v: number): string =>
      poly([at([0, v]), at([1, v]), at([1, Math.min(v + 0.14, 1)]), at([0, Math.min(v + 0.14, 1)])]);
    faces.push(
      { d: quad, fill: `plane${tone}` },
      ...faceStains(i % 2 ? 2 * hh : 2 * hw, i % 2)
        .filter((p) => p.length > 2)
        .map((p) => ({ d: poly(p.map(at)), fill: `stain${tone}` })),
      { d: edge(0.06), fill: 'bevelEdge' },
      { d: quad, stroke: { color: 'line', width: INNER } },
    );
  });
  return [
    { d: poly(hull([...corners, ...back])), fill: 'line', stroke: { color: 'line', width: OUTLINE } },
    ...faces,
  ];
}

/** Symbol names: the bevel drawn for world rotation `deg` (snapped to ANGLE_STEP). */
export function bevelName(prefix: string, deg: number): string {
  const k = ((Math.round(deg / ANGLE_STEP) % ANGLES) + ANGLES) % ANGLES;
  return `${prefix}${k}`;
}

function bevels(prefix: string, hw: number, hh: number): Record<string, PathShape[]> {
  return Object.fromEntries(
    Array.from({ length: ANGLES }, (_, k) => [`${prefix}${k}`, bevel(hw, hh, k * ANGLE_STEP)]),
  );
}

/** Dust puff: three round lobes. */
const puff = (lobes: [number, number, number][]): PathShape[] =>
  lobes.map(([x, y, r]) => ({
    d: circle(x, y, r),
    fill: 'dust',
    stroke: { color: 'dustLine', width: 0.22 },
  }));

function star(points: number, outer: number, inner: number, turn = -90): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = ((turn + (i * 180) / points) * Math.PI) / 180;
    const r = i % 2 ? inner : outer;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
}

/** A ragged mound of rubble and dust standing on the floor (y = 0), `w` wide and `h` tall. */
function rubble(cx: number, w: number, h: number, seed: number): PathShape[] {
  const n = 9;
  const top: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const bump = Math.sin(Math.PI * u) * (0.75 + 0.25 * Math.sin(seed + i * 2.3));
    return [cx - w / 2 + w * u, -h * bump] as Pt;
  });
  const rocks: PathShape[] = [-0.3, 0.05, 0.32].map((u, i) => ({
    d: poly(
      star(3, 0.9 + 0.3 * Math.sin(seed + i), 0.7, seed * 40 + i * 25).map(
        ([x, y]) => [cx + u * w + x, -h * (0.95 + 0.25 * i) + y] as Pt,
      ),
    ),
    fill: 'rust3',
    stroke: { color: 'line', width: 0.2 },
  }));
  return [{ d: poly(top), fill: 'dust', stroke: { color: 'dustLine', width: 0.25 } }, ...rocks];
}

/** Curved speed lines a little outside the corners of a spinning block (radius 14.5), trailing anticlockwise. */
function arcs(r: number): PathShape[] {
  return [
    [-30, 40],
    [150, 220],
    [70, 100],
    [250, 280],
  ].map(([a0, a1], i) => {
    const rr = r + (i > 1 ? 1.6 : 0);
    const pts = Array.from({ length: 9 }, (_, k) => {
      const a = ((a0! + ((a1! - a0!) * k) / 8) * Math.PI) / 180;
      return [Math.cos(a) * rr, Math.sin(a) * rr] as Pt;
    });
    return { d: poly(pts, false), stroke: { color: 'spark', width: i > 1 ? 0.35 : 0.5 } };
  });
}

/**
 * Broken trail for a launched block: short dashes on three radii, thinner and cooler than the swoosh arcs, so a
 * tumble never reads as an attack.
 */
const trail: PathShape[] = [
  [0, 34],
  [46, 62],
  [96, 118],
  [140, 168],
  [196, 224],
  [252, 288],
  [318, 342],
].map(([a0, a1], i) => {
  const rr = 16 + (i % 3) * 1.5;
  const pts = Array.from({ length: 6 }, (_, k) => {
    const a = ((a0! + ((a1! - a0!) * k) / 5) * Math.PI) / 180;
    return [Math.cos(a) * rr, Math.sin(a) * rr] as Pt;
  });
  return { d: poly(pts, false), stroke: { color: 'trail', width: 0.3 } };
});

/** Sparks skidding out from under a block sliding on its face. */
const skid: PathShape[] = [
  [-4.2, 2.6],
  [-1.4, 3.4],
  [1.8, 2.9],
  [5.2, 2.2],
].map(([x, r], i) => ({
  d: poly(star(4, r! * 0.55, r! * 0.16, i * 30).map(([px, py]) => [x! + px, py - 0.5] as Pt)),
  fill: 'spark',
}));

/** A shock ring thrown out from an impact. */
const ring: PathShape[] = [
  { d: circle(0, -1, 9), stroke: { color: 'star', width: 0.55 } },
  { d: circle(0, -1, 5.6), stroke: { color: 'spark', width: 0.3 } },
];

const sweep: PathShape[] = [
  { d: 'M1 -15Q16 -14 17 -2Q14 6 6 10Q12 3 12 -3Q12 -11 1 -15Z', fill: 'star' },
  { d: 'M5 -14Q17 -12 15 -3Q14 1 12 2Q14 -8 5 -14Z', fill: 'spark' },
];

const streak: PathShape[] = [
  { d: 'M-13 -2L3 -3L5 -1L-10 -1Z M-10 2L1 1L-1 3Z', fill: 'spark' },
  { d: 'M-15 0L-3 -1L-6 1Z M-8 5L0 4L-2 6Z', fill: 'star' },
];

/** The tile the block stands on in its icon: a light stone slab with a darker front edge. */
const tile: PathShape[] = [
  {
    d: poly([
      [-9, 0],
      [9, 0],
      [9 + DEPTH[0] * 1.6, DEPTH[1] * 1.6],
      [-9 + DEPTH[0] * 1.6, DEPTH[1] * 1.6],
    ]),
    fill: 'tileTop',
    stroke: { color: 'line', width: INNER },
  },
  {
    d: poly([
      [9, 0],
      [9 + DEPTH[0] * 1.6, DEPTH[1] * 1.6],
      [9 + DEPTH[0] * 1.6, DEPTH[1] * 1.6 + 2],
      [9, 2],
    ]),
    fill: 'tileSide',
    stroke: { color: 'line', width: INNER },
  },
  {
    d: poly(rect(9, 1).map(([x, y]) => [x, y + 1] as Pt)),
    fill: 'tile',
    stroke: { color: 'line', width: INNER },
  },
];

/**
 * A level tile for the Final Smash: a cube's footprint (12 wide, with a hair of gap) drawn like the icon's slab, its
 * top face going back along DEPTH as the block's own bevel does, centred on x 0 with its top surface on y 0.
 */
function levelTile(): PathShape[] {
  const w = HALF_W - 0.2;
  const t = 2.2;
  const [dx, dy] = DEPTH;
  const top: Pt[] = [
    [-w, 0],
    [w, 0],
    [w + dx, dy],
    [-w + dx, dy],
  ];
  const side: Pt[] = [
    [w, 0],
    [w + dx, dy],
    [w + dx, dy + t],
    [w, t],
  ];
  const front = rect(w, t / 2).map(([x, y]) => [x, y + t / 2] as Pt);
  return [
    {
      d: poly(hull([...top, ...side, ...front])),
      fill: 'line',
      stroke: { color: 'line', width: OUTLINE * 0.7 },
    },
    { d: poly(top), fill: 'tileTop', stroke: { color: 'line', width: INNER } },
    { d: poly(side), fill: 'tileSide', stroke: { color: 'line', width: INNER } },
    { d: poly(front), fill: 'tile', stroke: { color: 'line', width: INNER } },
    {
      d: poly([
        [-w + 0.5, -0.35],
        [w - 0.3, -0.35],
        [w - 0.3 + dx * 0.25, -0.35 + dy * 0.25],
        [-w + 0.5 + dx * 0.25, -0.35 + dy * 0.25],
      ]),
      fill: 'spark',
    },
  ];
}

/**
 * The swing of a toppling block's far end, about the edge it falls over (the origin): a band 27 units out, from
 * straight up round to just above the floor, thickening towards its head.
 */
function swing(): PathShape[] {
  const band = (r: number, width: number): Pt[] => {
    const n = 16;
    const at = (i: number, out: number): Pt => {
      const a = ((-95 + (83 * i) / n) * Math.PI) / 180;
      return [Math.cos(a) * out, Math.sin(a) * out];
    };
    const outer = Array.from({ length: n + 1 }, (_, i) => at(i, r));
    const inner = Array.from({ length: n + 1 }, (_, i) => at(n - i, r - (width * (n - i)) / n));
    return [...outer, ...inner];
  };
  return [
    { d: poly(band(27, 3.4)), fill: 'star' },
    { d: poly(band(26.4, 1.6)), fill: 'spark' },
  ];
}

/** The split switch's sign, Bloxorz's "( )", in gold with a dark outline: two bold brackets 9 wide and 7 tall. */
function splitGlyph(): PathShape[] {
  const bracket = (dir: 1 | -1): Pt[] => {
    const outer = Array.from({ length: 9 }, (_, i) => {
      const a = ((-60 + (120 * i) / 8) * Math.PI) / 180;
      return [dir * (-1.2 - 3.3 * Math.cos(a)), 3.5 * Math.sin(a)] as Pt;
    });
    const inner = Array.from({ length: 9 }, (_, i) => {
      const a = ((60 - (120 * i) / 8) * Math.PI) / 180;
      return [dir * (-1.2 - 2.1 * Math.cos(a)), 3.2 * Math.sin(a)] as Pt;
    });
    return [...outer, ...inner];
  };
  return ([1, -1] as const).flatMap((dir): PathShape[] => [
    { d: poly(bracket(dir)), fill: 'star', stroke: { color: 'line', width: 0.32 } },
  ]);
}

const moved = (shapes: PathShape[], dx: number, dy: number): PathShape[] =>
  shapes.map((s) => ({
    ...s,
    d: s.d.replace(/([MLC])([^MLCZ]+)/g, (_, cmd: string, args: string) => {
      const v = args.trim().split(/[ ,]+/).map(Number);
      return cmd + v.map((n, i) => num(n + (i % 2 ? dy : dx))).join(' ');
    }),
  }));

export const symbols: Record<string, ArtSymbol> = {
  face: face(HALF_W, HALF_H),
  ...bevels('bevel', HALF_W, HALF_H),
  cube: face(HALF_W, HALF_W),
  ...bevels('cubeBevel', HALF_W, HALF_W),
  dust: puff([
    [-1.3, -1.2, 1.4],
    [1.1, -1.5, 1.7],
    [0, -0.3, 1.2],
  ]),
  slam: puff([
    [-2.6, -2.4, 2.4],
    [2.4, -2.6, 2.6],
    [0, -5.6, 3.0],
    [-1.2, -8.2, 2.0],
    [1.6, -8.6, 1.7],
    [0, -1.6, 2.2],
  ]),
  wave: rubble(0, 11, 6, 1),
  quake: [6, 13, 20, 27, 34, 41, 47, 53].flatMap((x, i) => [
    ...rubble(x, 7, 4.2 + (i % 2), i + 2),
    ...rubble(-x, 7, 4.2 + ((i + 1) % 2), i + 7),
  ]),
  burst: [
    { d: poly(star(8, 6.5, 2.6)), fill: 'spark', stroke: { color: 'line', width: 0.3 } },
    { d: poly(star(8, 3.2, 1.3, -67.5)), fill: 'star' },
  ],
  arcs: arcs(14.5),
  trail,
  skid,
  ring,
  sweep,
  streak,
  lines: [-4, -1.5, 1.5, 4].map((x, i) => ({
    d: poly(
      [
        [x, 2 + (i % 2) * 1.5],
        [x, 8 + (i % 2) * 2.5],
      ],
      false,
    ),
    stroke: { color: 'spark', width: 0.45 },
  })),
  /** Switch Bridge's stone bridge tile, the icon's slab, flipping up on its hinge. */
  tile,
  levelTile: levelTile(),
  splitGlyph: splitGlyph(),
  swing: swing(),
  star: [{ d: poly(star(5, 1.7, 0.75)), fill: 'star', stroke: { color: 'line', width: 0.22 } }],
  spark: [{ d: poly(star(4, 1.6, 0.45, 0)), fill: 'spark', stroke: { color: 'line', width: 0.18 } }],
};

/** The HUD icon's drawings: the standing block on a stone tile, placed in icon space. */
export const iconSymbols: Record<string, ArtSymbol> = {
  tile,
  bevel: moved(bevel(HALF_W, HALF_H, 0), 0, -HALF_H),
  face: moved(face(HALF_W, HALF_H, true), 0, -HALF_H),
};
