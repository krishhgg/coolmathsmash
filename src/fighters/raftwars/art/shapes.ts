import type { PathShape } from '../../../render/rig/types';

/**
 * Path builders for the Raft Wars kids' hand-authored parts. Every shape in this folder is written from these
 * primitives and point lists, in rig units (y down), rounded to 0.001 so the data diffs cleanly.
 */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const K = 0.5523;
const { atan2, cos, PI, sin } = Math;

/** A point on a smooth outline; the optional third value scales its tangent (0 makes a sharp corner). */
export type P = readonly [number, number] | readonly [number, number, number];

/** Closed (or open) Catmull-Rom curve through the points, as cubic Béziers. */
export function smooth(points: readonly P[], closed = true): string {
  const count = points.length;
  const at = (i: number) => points[closed ? (i + count) % count : Math.min(Math.max(i, 0), count - 1)]!;
  const segments = closed ? count : count - 1;
  const parts = [`M${n(at(0)[0])} ${n(at(0)[1])}`];
  for (let i = 0; i < segments; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const t1 = (p1[2] ?? 1) / 6;
    const t2 = (p2[2] ?? 1) / 6;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t1, p1[1] + (p2[1] - p0[1]) * t1];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t2, p2[1] - (p3[1] - p1[1]) * t2];
    parts.push(`C${n(c1[0]!)} ${n(c1[1]!)} ${n(c2[0]!)} ${n(c2[1]!)} ${n(p2[0])} ${n(p2[1])}`);
  }
  return parts.join('') + (closed ? 'Z' : '');
}

/** Straight-edged polygon. */
export function poly(points: readonly P[]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join('') + 'Z';
}

/** Ellipse centred at (x, y). */
export function ellipse(x: number, y: number, rx: number, ry = rx): string {
  return [
    `M${n(x + rx)} ${n(y)}`,
    `C${n(x + rx)} ${n(y + K * ry)} ${n(x + K * rx)} ${n(y + ry)} ${n(x)} ${n(y + ry)}`,
    `C${n(x - K * rx)} ${n(y + ry)} ${n(x - rx)} ${n(y + K * ry)} ${n(x - rx)} ${n(y)}`,
    `C${n(x - rx)} ${n(y - K * ry)} ${n(x - K * rx)} ${n(y - ry)} ${n(x)} ${n(y - ry)}`,
    `C${n(x + K * rx)} ${n(y - ry)} ${n(x + rx)} ${n(y - K * ry)} ${n(x + rx)} ${n(y)}Z`,
  ].join('');
}

/** Points on an ellipse from angle a0 to a1 (degrees, 0 = +x, clockwise on screen), `steps` segments. */
export function arcPoints(
  x: number,
  y: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  steps = 12,
): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i): [number, number] => {
    const a = ((a0 + ((a1 - a0) * i) / steps) * PI) / 180;
    return [x + rx * cos(a), y + ry * sin(a)];
  });
}

/** Closed capsule along the y axis from (x, y0) radius r0 to (x, y1) radius r1. */
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

/** A stroke of ink from (x0, y0) to (x1, y1) with round ends, as a filled outline. */
export function capsule(x0: number, y0: number, x1: number, y1: number, w: number): string {
  const r = w / 2;
  const a = atan2(y1 - y0, x1 - x0);
  const nx = -sin(a) * r;
  const ny = cos(a) * r;
  /** Half a circle of points around (cx, cy), from angle `from` turning back through `from - 90°`. */
  const cap = (cx: number, cy: number, from: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = from - (PI * i) / 6;
      return `L${n(cx + r * cos(t))} ${n(cy + r * sin(t))}`;
    }).join('');
  return `M${n(x0 + nx)} ${n(y0 + ny)}` + cap(x1, y1, a + PI / 2) + cap(x0, y0, a - PI / 2) + 'Z';
}

/** A polyline of ink, one capsule per segment so the joins stay round. */
export function strokes(points: readonly P[], w: number, color = 'line'): PathShape[] {
  return points
    .slice(1)
    .map((p, i) => ({ d: capsule(points[i]![0], points[i]![1], p[0], p[1], w), fill: color }));
}

/** Points along a cubic Bézier, for curved strokes built from capsules. */
export function bezier(p0: P, p1: P, p2: P, p3: P, steps = 8): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i): [number, number] => {
    const t = i / steps;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    return [
      w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0],
      w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1],
    ];
  });
}

/** Moves and scales a point list: (x, y) -> (dx + x * sx, dy + y * sy). */
export function place(points: readonly P[], dx: number, dy: number, sx = 1, sy = sx): P[] {
  return points.map((p) =>
    p.length === 3 ? [dx + p[0] * sx, dy + p[1] * sy, p[2]] : [dx + p[0] * sx, dy + p[1] * sy],
  );
}

/** Turns a point list by `deg` (clockwise on screen) about (cx, cy). */
export function turn(points: readonly P[], deg: number, cx = 0, cy = 0): P[] {
  const r = (deg * PI) / 180;
  return points.map((p) => {
    const x = cx + (p[0] - cx) * cos(r) - (p[1] - cy) * sin(r);
    const y = cy + (p[0] - cx) * sin(r) + (p[1] - cy) * cos(r);
    return p.length === 3 ? [x, y, p[2]] : [x, y];
  });
}

/** Pushes every point of a closed outline `by` units outwards along its normal (for ink underlays). */
export function inflate(points: readonly P[], by: number): P[] {
  const count = points.length;
  let area = 0;
  for (let i = 0; i < count; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[(i + 1) % count]!;
    area += x0 * y1 - x1 * y0;
  }
  const out = area > 0 ? 1 : -1;
  return points.map((p, i) => {
    const prev = points[(i + count - 1) % count]!;
    const next = points[(i + 1) % count]!;
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    const x = p[0] + (out * ty * by) / len;
    const y = p[1] - (out * tx * by) / len;
    return p.length === 3 ? [x, y, p[2]] : [x, y];
  });
}

/** A star with `count` points of radius `r` (inner radius `ri`), first point at `deg` (0 = +x, clockwise). */
export function star(x: number, y: number, r: number, ri: number, count: number, deg = -90): string {
  const pts: P[] = [];
  for (let i = 0; i < count * 2; i++) {
    const a = ((deg + (i * 180) / count) * PI) / 180;
    const rr = i % 2 ? ri : r;
    pts.push([x + cos(a) * rr, y + sin(a) * rr]);
  }
  return poly(pts);
}
