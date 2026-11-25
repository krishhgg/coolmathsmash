import type { Paint, PathShape } from '../../../render/rig/types';

/**
 * Drawing helpers for Snail Bob's hand-drawn parts. Every part is drawn from scratch in rig units (y down) as
 * SVG path data: smooth blobs through a few control points, capsules for tubes, ellipses for eyes.
 */

export type Pt = readonly [number, number];
/** A blob control point; a third element `true` makes it a sharp corner. */
export type BlobPt = readonly [number, number] | readonly [number, number, true];

const K = 0.5523;
export const n = (v: number) => String(Math.round(v * 1000) / 1000);
const p = (x: number, y: number) => `${n(x)} ${n(y)}`;

/** Outline width outside each part: the thick brush line of the Snail Bob games. */
export const LINE = 0.25;

/**
 * Ellipse centred at (x, y), optionally rotated by `deg` (clockwise), as twelve short arcs: the renderer flattens
 * each curve into a few segments in rig units, so short arcs keep small shapes round when zoomed in.
 */
export function ellipse(x: number, y: number, rx: number, ry: number, deg = 0): string {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const t = (u: number, v: number) => p(x + u * c - v * s, y + u * s + v * c);
  const n = 12;
  const k = (4 / 3) * Math.tan(Math.PI / (2 * n));
  const out = [`M${t(rx, 0)}`];
  for (let i = 0; i < n; i++) {
    const a0 = (i * 2 * Math.PI) / n;
    const a1 = ((i + 1) * 2 * Math.PI) / n;
    const [c0, s0, c1, s1] = [Math.cos(a0), Math.sin(a0), Math.cos(a1), Math.sin(a1)];
    out.push(
      `C${t(rx * (c0 - k * s0), ry * (s0 + k * c0))} ${t(rx * (c1 + k * s1), ry * (s1 - k * c1))} ${t(rx * c1, ry * s1)}`,
    );
  }
  return out.join('') + 'Z';
}

/** A capsule from a (radius r0) to b (radius r1), with round ends. */
export function capsule(a: Pt, b: Pt, r0: number, r1: number): string {
  const [ax, ay] = a;
  const [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const nx = -uy;
  const ny = ux;
  const at = (cx: number, cy: number, r: number, u: number, v: number) =>
    p(cx + (ux * u + nx * v) * r, cy + (uy * u + ny * v) * r);
  return [
    `M${at(ax, ay, r0, 0, 1)}`,
    `L${at(bx, by, r1, 0, 1)}`,
    `C${at(bx, by, r1, K, 1)} ${at(bx, by, r1, 1, K)} ${at(bx, by, r1, 1, 0)}`,
    `C${at(bx, by, r1, 1, -K)} ${at(bx, by, r1, K, -1)} ${at(bx, by, r1, 0, -1)}`,
    `L${at(ax, ay, r0, 0, -1)}`,
    `C${at(ax, ay, r0, -K, -1)} ${at(ax, ay, r0, -1, -K)} ${at(ax, ay, r0, -1, 0)}`,
    `C${at(ax, ay, r0, -1, K)} ${at(ax, ay, r0, -K, 1)} ${at(ax, ay, r0, 0, 1)}Z`,
  ].join('');
}

/**
 * A smooth curve through `pts` (Catmull-Rom as cubic Beziers), closed by default. Corner points (third element
 * true) get no tangent, so the curve turns sharply there, like a pen corner.
 */
export function blob(pts: readonly BlobPt[], closed = true, tension = 1): string {
  const count = pts.length;
  const at = (i: number): BlobPt =>
    closed ? pts[(i + count) % count]! : pts[Math.max(0, Math.min(count - 1, i))]!;
  const out = [`M${p(pts[0]![0], pts[0]![1])}`];
  const segments = closed ? count : count - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k1 = p1[2] ? 0 : tension / 6;
    const k2 = p2[2] ? 0 : tension / 6;
    const b: Pt[] = [
      [p1[0], p1[1]],
      [p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1],
      [p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2],
      [p2[0], p2[1]],
    ];
    out.push(...thirds(b));
  }
  return out.join('') + (closed ? 'Z' : '');
}

/** A cubic Bezier split into three (de Casteljau), so the renderer keeps long curves smooth when zoomed in. */
function thirds(b: Pt[]): string[] {
  const at = (q: Pt[], t: number): [Pt[], Pt[]] => {
    const l = (a: Pt, c: Pt): Pt => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
    const ab = l(q[0]!, q[1]!);
    const bc = l(q[1]!, q[2]!);
    const cd = l(q[2]!, q[3]!);
    const abc = l(ab, bc);
    const bcd = l(bc, cd);
    const m = l(abc, bcd);
    return [
      [q[0]!, ab, abc, m],
      [m, bcd, cd, q[3]!],
    ];
  };
  const [first, rest] = at(b, 1 / 3);
  const [second, third] = at(rest, 1 / 2);
  return [first, second, third].map((q) => `C${p(...q[1]!)} ${p(...q[2]!)} ${p(...q[3]!)}`);
}

/** Straight segments through `pts`. */
export function poly(pts: readonly Pt[], closed = true): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${p(x, y)}`).join('') + (closed ? 'Z' : '');
}

/** Points on an ellipse from angle a0 to a1 (degrees, 0 = +x, 90 = down), for lids and crescents. */
export function arc(x: number, y: number, rx: number, ry: number, a0: number, a1: number, steps = 16): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as const;
  });
}

/** A stroke-only line in the outline colour. */
export const ink = (d: string, width = LINE): PathShape => ({ d, stroke: { color: 'line', width } });

/** A filled shape with the thick outline around it. */
export const inkedFill = (d: string, fill: Paint, width = LINE * 2): PathShape => ({
  d,
  fill,
  stroke: { color: 'line', width },
});

/**
 * A part as two symbols: its outline (the shape grown by LINE, drawn in a slot behind every connected part) and
 * its fills, so parts that join (body, neck, head, eyestalks, arms) read as one inked blob without seams.
 */
export interface Part {
  line: PathShape[];
  fill: PathShape[];
}

export function part(d: string, fills: PathShape[], line = LINE): Part {
  return { line: [{ d, fill: 'line', stroke: { color: 'line', width: line * 2 } }], fill: fills };
}

/** A vertical gradient (top colour to bottom colour) between y0 and y1. */
export const vertical = (y0: number, y1: number, top: string, bottom: string): Paint => ({
  type: 'linear',
  x0: 0,
  y0,
  x1: 0,
  y1,
  stops: [
    { offset: 0, color: top },
    { offset: 1, color: bottom },
  ],
});
