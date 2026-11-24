/**
 * Path builders for Johnny's hand-authored parts. Every shape in this folder is written from these primitives
 * and point lists, in rig units (y down).
 */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const K = 0.5523;

/** A point on a smooth outline; the optional third value scales its tangent (0 makes a sharp corner). */
export type P = readonly [number, number] | readonly [number, number, number];

/** Closed (or open) Catmull-Rom curve through the points, as cubic Beziers. */
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

/** Moves and scales a point list: (x, y) -> (dx + x * s, dy + y * s). */
export function place(points: readonly P[], dx: number, dy: number, sx = 1, sy = sx): P[] {
  return points.map((p) =>
    p.length === 3 ? [dx + p[0] * sx, dy + p[1] * sy, p[2]] : [dx + p[0] * sx, dy + p[1] * sy],
  );
}

/** A star with `count` points of radius `r` (inner radius `ri`), first point at `deg` (0 = +x, clockwise). */
export function star(x: number, y: number, r: number, ri: number, count: number, deg = -90): string {
  const pts: P[] = [];
  for (let i = 0; i < count * 2; i++) {
    const a = ((deg + (i * 180) / count) * Math.PI) / 180;
    const rr = i % 2 ? ri : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return poly(pts);
}
