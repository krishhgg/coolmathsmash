/**
 * Effects are drawn as plain shape lists (pure data) that `paint` turns into Pixi Graphics calls, so every
 * effect's geometry can be tested without a renderer. World-space shapes are in game units with y down (the world
 * container's space); the KO blast draws in screen pixels.
 */

export interface Fill {
  color: number;
  alpha?: number;
}

export interface Line {
  color: number;
  width: number;
  alpha?: number;
}

export type Shape =
  | { type: 'poly'; points: number[]; fill?: Fill; line?: Line; open?: boolean }
  | { type: 'circle'; x: number; y: number; r: number; fill?: Fill; line?: Line }
  | { type: 'ellipse'; x: number; y: number; rx: number; ry: number; fill?: Fill; line?: Line };

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const TAU = Math.PI * 2;

/** Mix two 0xRRGGBB colours; `t` = 0 gives `a`. */
export function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t)) << shift;
  return ch(16) | ch(8) | ch(0);
}

/** '#rrggbb' as 0xRRGGBB. */
export const hex = (css: string): number => parseInt(css.slice(1, 7), 16);

/** A star: spikes at `radius(i)` alternating with notches at `inner`, the first spike at angle `rot`. */
export function star(
  cx: number,
  cy: number,
  n: number,
  radius: (i: number) => number,
  inner: number,
  rot: number,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const r = radius(i);
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    const b = a + Math.PI / n;
    pts.push(cx + Math.cos(b) * inner, cy + Math.sin(b) * inner);
  }
  return pts;
}

/** A four-point twinkle: arms `rx` along `rot` and `ry` across it, pinched to `waist`. */
export function twinkle(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  waist: number,
  rot: number,
): number[] {
  const pts: number[] = [];
  const arms = [rx, ry, rx, ry];
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2;
    pts.push(cx + Math.cos(a) * arms[i]!, cy + Math.sin(a) * arms[i]!);
    const b = a + Math.PI / 4;
    pts.push(cx + Math.cos(b) * waist, cy + Math.sin(b) * waist);
  }
  return pts;
}

/**
 * A tapered blade from `(x0, y0)` along angle `a` for `len`: `width` wide at its base, bulging to `bulge` times
 * that a third of the way along, and bending sideways by `curl` (a fraction of `len`) toward its point. Flame
 * tongues, streaks and beams are all blades.
 */
export function blade(
  x0: number,
  y0: number,
  a: number,
  len: number,
  width: number,
  bulge = 1,
  curl = 0,
  steps = 6,
): number[] {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const left: number[] = [];
  const right: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const s = k / steps;
    const half = (width / 2) * (1 - s) ** 0.9 * (1 + (bulge - 1) * Math.sin(Math.PI * Math.min(1, s * 1.5)));
    const along = len * s;
    const side = curl * len * s * s;
    const px = x0 + ux * along - uy * side;
    const py = y0 + uy * along + ux * side;
    left.push(px - uy * half, py + ux * half);
    right.push(px + uy * half, py - ux * half);
  }
  const pts = [...left];
  for (let k = right.length - 2; k >= 0; k -= 2) pts.push(right[k]!, right[k + 1]!);
  return pts;
}

/** An arc band between radii `r0` and `r1` from angle `a0` to `a1` (a crescent highlight or a ring segment). */
export function arcBand(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  steps = 10,
): number[] {
  const pts: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = lerp(a0, a1, k / steps);
    pts.push(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
  }
  for (let k = steps; k >= 0; k--) {
    const a = lerp(a0, a1, k / steps);
    pts.push(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
  }
  return pts;
}
