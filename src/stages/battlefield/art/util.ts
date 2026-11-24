import { FillGradient, type ColorSource, type Graphics } from 'pixi.js';

export type Point = readonly [number, number];

/** Linear blend of two 0xRRGGBB colours; t = 0 gives `a`, 1 gives `b`. */
export function mix(a: number, b: number, t: number): number {
  const channel = (shift: number) => {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    return Math.round(ca + (cb - ca) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/** Deterministic hash of an integer to [0, 1), used instead of randomness for hand-placed variety. */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x2c1b3c6d, 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** Game points (y up) to a flat Pixi point list (y down). */
export function flipY(points: readonly Point[]): number[] {
  return points.flatMap(([x, y]) => [x, -y]);
}

/** Vertical gradient in the filled shape's local space, top (offset 0) to bottom (offset 1). */
export function vGradient(stops: readonly (readonly [number, ColorSource])[]): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
    textureSpace: 'local',
  });
}

/**
 * A Flash-style cumulus: a shaded underside with lit puffs on top. Drawn opaque so overlapping puffs merge.
 * (x, y) is the middle of the flat base, in the target's units.
 */
export function cloud(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  body: number,
  shade: number,
  seed: number,
): void {
  const n = Math.max(3, Math.round(w / (h * 0.75)));
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = h * (0.32 + 0.4 * Math.sin(Math.PI * t)) * (0.85 + 0.3 * hash01(seed * 31 + i));
    puffs.push([x + (t - 0.5) * (w - h * 0.6), y - r * 0.55, r]);
  }
  g.roundRect(x - w / 2, y - h * 0.32, w, h * 0.32, h * 0.16).fill(shade);
  for (const [px, py, r] of puffs) g.circle(px, py, r).fill(shade);
  for (const [px, py, r] of puffs) g.circle(px - r * 0.08, py - r * 0.14, r * 0.86).fill(body);
}

/** A faceted diamond centred on (x, y), `s` half-width, in Pixi (y down) coordinates. */
export function diamond(
  g: Graphics,
  x: number,
  y: number,
  s: number,
  base: number,
  dark: number,
  ink: number,
  inkWidth: number,
): void {
  const top = y - s * 0.75;
  const mid = y - s * 0.2;
  const tip = y + s * 1.05;
  g.poly([x - s, mid, x - s * 0.5, top, x + s * 0.5, top, x + s, mid, x, tip]).fill(base);
  g.poly([x + s * 0.15, mid, x + s, mid, x, tip]).fill(dark);
  g.poly([x - s * 0.5, top, x + s * 0.5, top, x + s * 0.25, mid, x - s * 0.25, mid]).fill(
    mix(base, 0xffffff, 0.45),
  );
  g.poly([x - s, mid, x - s * 0.25, mid, x, tip]).fill(mix(base, 0xffffff, 0.15));
  g.poly([x - s, mid, x - s * 0.5, top, x + s * 0.5, top, x + s, mid, x, tip]).stroke({
    width: inkWidth,
    color: ink,
    join: 'round',
  });
}

/** A four-point twinkle star centred on (x, y). */
export function sparkle(g: Graphics, x: number, y: number, r: number, color: number): void {
  const k = r * 0.22;
  g.poly([
    x,
    y - r,
    x + k,
    y - k,
    x + r,
    y,
    x + k,
    y + k,
    x,
    y + r,
    x - k,
    y + k,
    x - r,
    y,
    x - k,
    y - k,
  ]).fill(color);
}
