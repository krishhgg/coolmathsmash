import { flattenPath } from '../../../render/rig/geometry';

/**
 * Path builders for Bob's parts, in rig units (y down). Organic outlines are closed Catmull-Rom curves through a
 * few anchors, the way a Flash artist pulls a brush stroke through a handful of points.
 */

export type P = readonly [number, number];

const K = 0.5523;
export const n = (v: number) => String(Math.round(v * 1000) / 1000);
const pt = ([x, y]: P) => `${n(x)} ${n(y)}`;

/** Ellipse centred at (x, y). */
export function ellipse(x: number, y: number, rx: number, ry: number): string {
  return [
    `M${n(x + rx)} ${n(y)}`,
    `C${n(x + rx)} ${n(y + K * ry)} ${n(x + K * rx)} ${n(y + ry)} ${n(x)} ${n(y + ry)}`,
    `C${n(x - K * rx)} ${n(y + ry)} ${n(x - rx)} ${n(y + K * ry)} ${n(x - rx)} ${n(y)}`,
    `C${n(x - rx)} ${n(y - K * ry)} ${n(x - K * rx)} ${n(y - ry)} ${n(x)} ${n(y - ry)}`,
    `C${n(x + K * rx)} ${n(y - ry)} ${n(x + rx)} ${n(y - K * ry)} ${n(x + rx)} ${n(y)}Z`,
  ].join('');
}

/** Capsule from (x, y0) with radius r0 to (x, y1) with radius r1, down the +y axis. */
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

/** Straight-edged polygon. */
export function poly(points: readonly P[]): string {
  return `M${points.map(pt).join('L')}Z`;
}

/** Open polyline, for strokes. */
export function line(points: readonly P[]): string {
  return `M${points.map(pt).join('L')}`;
}

function catmull(points: readonly P[], closed: boolean, t: number): string {
  const m = points.length;
  const at = (i: number) => (closed ? points[((i % m) + m) % m]! : points[Math.min(Math.max(i, 0), m - 1)]!);
  let d = `M${pt(at(0))}`;
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1: P = [x1 + ((x2 - x0) / 6) * t, y1 + ((y2 - y0) / 6) * t];
    const c2: P = [x2 - ((x3 - x1) / 6) * t, y2 - ((y3 - y1) / 6) * t];
    d += `C${pt(c1)} ${pt(c2)} ${pt([x2, y2])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Smooth closed curve through `points`; `t` below 1 tightens the corners. */
export function blob(points: readonly P[], t = 1): string {
  return catmull(points, true, t);
}

/** Smooth open curve through `points`, for strokes. */
export function curve(points: readonly P[], t = 1): string {
  return catmull(points, false, t);
}

/** Annular sector around the origin from angle a0 to a1 (degrees, 0 = +x, positive clockwise on screen). */
export function sector(a0: number, a1: number, r0: number, r1: number, steps = 18): string {
  const at = (r: number, a: number): P => [
    r * Math.cos((a * Math.PI) / 180),
    r * Math.sin((a * Math.PI) / 180),
  ];
  const outer: P[] = [];
  const inner: P[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    outer.push(at(r1, a));
    inner.push(at(r0, a));
  }
  return poly([...outer, ...inner.reverse()]);
}

/** Leftmost and rightmost x where the horizontal line at `y` crosses outline `o`, or null. */
function span(o: number[], y: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    const yi = o[i + 1]!;
    const yj = o[j + 1]!;
    if (yi > y === yj > y) continue;
    const x = o[i]! + ((o[j]! - o[i]!) * (y - yi)) / (yj - yi);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return lo < hi ? [lo, hi] : null;
}

/**
 * Horizontal bands cut out of a closed outline, such as the stripes on a shirt. Each band runs from y0 to y1,
 * bows downwards by `bow` in the middle (a cylinder seen from a little above) and stops at the outline, so it
 * never spills past the ink line.
 */
export function bands(outline: string, ranges: readonly (readonly [number, number])[], bow = 0): string[] {
  const o = flattenPath(outline, 12)[0] ?? [];
  let half = 0;
  for (let i = 0; i < o.length; i += 2) half = Math.max(half, Math.abs(o[i]!));
  const lift = (x: number) => bow * (1 - Math.min(1, (x / half) ** 2));
  return ranges.flatMap(([y0, y1]) => {
    const edge = (y: number, side: 0 | 1): P | null => {
      let s = span(o, y);
      if (!s) return null;
      let x = s[side];
      for (let k = 0; k < 4; k++) {
        s = span(o, y + lift(x));
        if (!s) return null;
        x = s[side];
      }
      return [x, y + lift(x)];
    };
    const tl = edge(y0, 0);
    const tr = edge(y0, 1);
    const bl = edge(y1, 0);
    const br = edge(y1, 1);
    if (!tl || !tr || !bl || !br) return [];
    const top: P[] = [];
    const bottom: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const xt = tl[0] + ((tr[0] - tl[0]) * i) / 12;
      const xb = br[0] + ((bl[0] - br[0]) * i) / 12;
      top.push([xt, y0 + lift(xt)]);
      bottom.push([xb, y1 + lift(xb)]);
    }
    const side = (from: P, to: P, which: 0 | 1): P[] => {
      const out: P[] = [];
      for (let i = 1; i < 4; i++) {
        const y = from[1] + ((to[1] - from[1]) * i) / 4;
        const s = span(o, y);
        if (s) out.push([s[which], y]);
      }
      return out;
    };
    return [poly([...top, ...side(tr, br, 1), ...bottom, ...side(bl, tl, 0)])];
  });
}
