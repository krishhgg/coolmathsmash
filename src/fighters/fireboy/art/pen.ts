import type { Paint, PathShape } from '../../../render/rig/types';

/**
 * A small pen for drawing fighters from scratch in the Flash look: smooth shapes through a handful of points
 * placed by eye, a hand-inked outline whose weight varies around the shape, and tapered brush strokes for faces.
 * Every shape is built from numbers in this repo, never from the original game files.
 *
 * Coordinates are rig units, y down. Angles are degrees clockwise from straight up.
 */

/** A point on a drawn outline. `sharp` makes a corner such as a flame tip; `w` scales the ink weight there. */
export interface Node {
  x: number;
  y: number;
  sharp?: boolean;
  w?: number;
}

export type Pt = readonly [number, number];

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Unit vector pointing `deg` degrees clockwise from straight up. */
export function dir(deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/** Signed angle from `a` to `b`, in (-180, 180]. */
export function turn(a: number, b: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Catmull-Rom tangents (in, out) at each node; sharp nodes get short one-sided tangents, making a cusp. */
function tangents(nodes: Node[], closed: boolean): [Pt, Pt][] {
  const len = nodes.length;
  const at = (i: number) => nodes[closed ? (i + len) % len : Math.max(0, Math.min(len - 1, i))]!;
  return nodes.map((p, i) => {
    const a = at(i - 1);
    const b = at(i + 1);
    if (p.sharp)
      return [
        [(p.x - a.x) * 0.3, (p.y - a.y) * 0.3],
        [(b.x - p.x) * 0.3, (b.y - p.y) * 0.3],
      ];
    const t: Pt = [(b.x - a.x) / 2, (b.y - a.y) / 2];
    return [t, t];
  });
}

/** SVG path data for a smooth curve through the nodes (closed by default). */
export function curve(nodes: Node[], closed = true): string {
  const t = tangents(nodes, closed);
  const len = nodes.length;
  let d = `M${n(nodes[0]!.x)} ${n(nodes[0]!.y)}`;
  for (let i = 0; i < (closed ? len : len - 1); i++) {
    const j = (i + 1) % len;
    const p = nodes[i]!;
    const q = nodes[j]!;
    const out = t[i]![1];
    const inn = t[j]![0];
    d += `C${n(p.x + out[0] / 3)} ${n(p.y + out[1] / 3)} ${n(q.x - inn[0] / 3)} ${n(q.y - inn[1] / 3)} ${n(q.x)} ${n(q.y)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Points along the same curve, `per` per segment, carrying the nodes' `w` along. */
export function sample(nodes: Node[], closed = false, per = 8): Node[] {
  const t = tangents(nodes, closed);
  const len = nodes.length;
  const out: Node[] = [];
  for (let i = 0; i < (closed ? len : len - 1); i++) {
    const j = (i + 1) % len;
    const p = nodes[i]!;
    const q = nodes[j]!;
    const c1: Pt = [p.x + t[i]![1][0] / 3, p.y + t[i]![1][1] / 3];
    const c2: Pt = [q.x - t[j]![0][0] / 3, q.y - t[j]![0][1] / 3];
    for (let k = 0; k < per; k++) {
      const s = k / per;
      const u = 1 - s;
      out.push({
        x: u * u * u * p.x + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * q.x,
        y: u * u * u * p.y + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * q.y,
        w: (p.w ?? 1) * u + (q.w ?? 1) * s,
      });
    }
  }
  if (!closed) out.push({ ...nodes[len - 1]!, w: nodes[len - 1]!.w ?? 1 });
  return out;
}

function area(nodes: readonly Node[]): number {
  let a = 0;
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i]!;
    const q = nodes[(i + 1) % nodes.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * The outline pushed inwards by `by` times each node's `w`: where the fill goes, so the outline shows around it
 * with the weight each node asks for. A negative `by` grows the shape instead.
 */
export function inset(nodes: Node[], by: number): Node[] {
  const sign = area(nodes) > 0 ? 1 : -1;
  const len = nodes.length;
  return nodes.map((p, i) => {
    const a = nodes[(i - 1 + len) % len]!;
    const b = nodes[(i + 1) % len]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = (p.w ?? 1) * by;
    return { ...p, x: p.x - ((b.y - a.y) / l) * sign * d, y: p.y + ((b.x - a.x) / l) * sign * d };
  });
}

/** A shape with a hand-inked outline: the silhouette in `line`, then the fill inset by `ink` (times each w). */
export function inked(nodes: Node[], fill: Paint, ink: number, line: Paint = 'line'): PathShape[] {
  return [
    { d: curve(nodes), fill: line },
    { d: curve(inset(nodes, ink)), fill },
  ];
}

/**
 * A tapered brush stroke along a spine, `width` at its fullest and thin at both ends like a Flash brush line.
 * Spine nodes' `w` scale the width locally; `ends` sets how thin the tips get (0 = a point).
 */
export function brush(spine: Node[], width: number, ends = 0.25): string {
  const pts = sample(spine, false, 6);
  const left: Node[] = [];
  const right: Node[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = i / (pts.length - 1);
    const hw = (width / 2) * (p.w ?? 1) * (ends + (1 - ends) * Math.sin(Math.PI * t) ** 0.6);
    const nx = -(b.y - a.y) / l;
    const ny = (b.x - a.x) / l;
    left.push({ x: p.x + nx * hw, y: p.y + ny * hw });
    right.push({ x: p.x - nx * hw, y: p.y - ny * hw });
  });
  return curve([...left, ...right.reverse()]);
}

/** Nodes of an ellipse, starting at the top and going clockwise. */
export function oval(cx: number, cy: number, rx: number, ry: number, count = 8): Node[] {
  return Array.from({ length: count }, (_, i) => {
    const [dx, dy] = dir((360 * i) / count);
    return { x: cx + dx * rx, y: cy + dy * ry };
  });
}

/** A capsule from (x, 0) down to (x, len) with end radii r0 and r1: a limb segment hanging from its bone. */
export function capsule(len: number, r0: number, r1: number, x = 0): Node[] {
  const k = 0.72;
  return [
    { x: x + r0, y: 0 },
    { x: x + (r0 + r1) / 2, y: len / 2 },
    { x: x + r1, y: len },
    { x: x + r1 * k, y: len + r1 * k },
    { x, y: len + r1 },
    { x: x - r1 * k, y: len + r1 * k },
    { x: x - r1, y: len },
    { x: x - (r0 + r1) / 2, y: len / 2 },
    { x: x - r0, y: 0 },
    { x: x - r0 * k, y: -r0 * k },
    { x, y: -r0 },
    { x: x + r0 * k, y: -r0 * k },
  ];
}

/** Moves and scales nodes: (x, y) -> (cx + x * sx, cy + y * sy). */
export function place(nodes: Node[], cx: number, cy: number, sx = 1, sy = sx): Node[] {
  return nodes.map((p) => ({ ...p, x: cx + p.x * sx, y: cy + p.y * sy }));
}

/** A fixed wobble in [-1, 1] for hand-drawn variation between flicker drawings (no randomness). */
export function wobble(i: number, k: number): number {
  return Math.sin(i * 12.9898 + k * 78.233) * 0.5 + Math.sin(i * 4.1 + k * 1.7) * 0.5;
}
