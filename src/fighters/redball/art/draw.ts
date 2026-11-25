/**
 * Path-data helpers for drawing Red Ball by hand: ellipse arcs, smooth closed blobs through hand-placed points and
 * tapered brush strokes (the Flash ink line). Every helper returns SVG path data in rig units with absolute
 * commands only, so the rig's even-odd splitter and the geometry tests can read it.
 */

export type Pt = readonly [number, number];

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const pt = ([x, y]: Pt) => `${num(x)} ${num(y)}`;
const RAD = Math.PI / 180;

/** A point on an ellipse at parametric angle `t` (degrees, clockwise from +x because y is down), rotated by `rot`. */
function onEllipse(cx: number, cy: number, rx: number, ry: number, t: number, rot: number): Pt {
  const [c, s] = [Math.cos(t * RAD), Math.sin(t * RAD)];
  const [cr, sr] = [Math.cos(rot * RAD), Math.sin(rot * RAD)];
  return [cx + rx * c * cr - ry * s * sr, cy + rx * c * sr + ry * s * cr];
}

/**
 * Cubic segments along an ellipse from angle a0 to a1 (degrees, either direction), without the leading move. Short
 * segments, because Pixi flattens each curve in symbol units, which are small next to the screen.
 */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, rot = 0): string {
  const segs = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 20));
  const step = (a1 - a0) / segs;
  const k = (4 / 3) * Math.tan((step * RAD) / 4);
  const [cr, sr] = [Math.cos(rot * RAD), Math.sin(rot * RAD)];
  const tangent = (t: number): Pt => {
    const dx = -rx * Math.sin(t * RAD);
    const dy = ry * Math.cos(t * RAD);
    return [dx * cr - dy * sr, dx * sr + dy * cr];
  };
  let d = '';
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + step * i;
    const p0 = onEllipse(cx, cy, rx, ry, t0, rot);
    const p3 = onEllipse(cx, cy, rx, ry, t0 + step, rot);
    const d0 = tangent(t0);
    const d1 = tangent(t0 + step);
    d += ` C ${pt([p0[0] + k * d0[0], p0[1] + k * d0[1]])} ${pt([p3[0] - k * d1[0], p3[1] - k * d1[1]])} ${pt(p3)}`;
  }
  return d;
}

/** A closed ellipse (a circle when rx = ry). */
export function ellipse(cx: number, cy: number, rx: number, ry = rx, rot = 0): string {
  return `M ${pt(onEllipse(cx, cy, rx, ry, 0, rot))}${arc(cx, cy, rx, ry, 0, 360, rot)} Z`;
}

type Ellipse = [cx: number, cy: number, rx: number, ry: number];

/**
 * A crescent: ellipse `a` from angle a0 to a1, closed back along ellipse `b` from a1 to a0. Shading bands and
 * rims are crescents of two nearly equal ellipses.
 */
export function crescent(a: Ellipse, b: Ellipse, a0: number, a1: number): string {
  const start = onEllipse(a[0], a[1], a[2], a[3], a0, 0);
  const back = onEllipse(b[0], b[1], b[2], b[3], a1, 0);
  return `M ${pt(start)}${arc(...a, a0, a1)} L ${pt(back)}${arc(...b, a1, a0)} Z`;
}

/** Catmull-Rom spline through `points` as cubic segments (closed loops wrap around). */
function spline(points: readonly Pt[], closed: boolean): string {
  const n = points.length;
  const at = (i: number): Pt =>
    closed ? points[((i % n) + n) % n]! : points[Math.min(Math.max(i, 0), n - 1)]!;
  let d = `M ${pt(points[0]!)}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d} Z` : d;
}

/** A smooth closed shape through hand-placed points. */
export const blob = (points: readonly Pt[]) => spline(points, true);

/** A smooth open curve through hand-placed points, for stroked lines. */
export const curve = (points: readonly Pt[]) => spline(points, false);

/** Samples the Catmull-Rom spline through `points` densely. */
function sample(points: readonly Pt[], perSegment = 14): Pt[] {
  const n = points.length;
  const at = (i: number): Pt => points[Math.min(Math.max(i, 0), n - 1)]!;
  const out: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[n - 1]!);
  return out;
}

/**
 * A tapered brush stroke through `points`, `width` wide at its fullest, thinning to a point over the first
 * `taperIn` and last `taperOut` fractions of its length (0 leaves that end blunt).
 */
export function brush(points: readonly Pt[], width: number, taperIn = 0.3, taperOut = 0.3): string {
  const p = sample(points);
  const lengths = [0];
  for (let i = 1; i < p.length; i++)
    lengths.push(lengths[i - 1]! + Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]));
  const total = lengths[lengths.length - 1] || 1;
  const ease = (u: number) => Math.sin((Math.min(1, Math.max(0, u)) * Math.PI) / 2);
  const left: Pt[] = [];
  const right: Pt[] = [];
  p.forEach(([x, y], i) => {
    const u = lengths[i]! / total;
    const w =
      (width / 2) *
      (taperIn > 0 ? Math.max(0.08, ease(u / taperIn)) : 1) *
      (taperOut > 0 ? Math.max(0.08, ease((1 - u) / taperOut)) : 1);
    const a = p[Math.max(0, i - 1)]!;
    const b = p[Math.min(p.length - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  });
  return `M ${[...left, ...right.reverse()].map(pt).join(' L ')} Z`;
}

/** A star with `points` tips, outer radius `r` and inner radius `inner`, the first tip pointing up. */
export function star(cx: number, cy: number, r: number, inner: number, points = 5): string {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (-90 + (i * 180) / points) * RAD;
    const rr = i % 2 ? inner : r;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return `M ${out.map(pt).join(' L ')} Z`;
}

/** `count` points along an ellipse from angle a0 to a1 (degrees), for brush strokes that follow an arc. */
export function arcPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  count = 6,
): Pt[] {
  return Array.from({ length: count }, (_, i) =>
    onEllipse(cx, cy, rx, ry, a0 + ((a1 - a0) * i) / (count - 1), 0),
  );
}
