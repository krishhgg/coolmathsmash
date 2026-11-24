import type { Point } from './util';

/**
 * Battlefield's collision shape in game units (y up), copied from Smash Ultimate. The art is drawn on these exact
 * numbers so surfaces, walls and ledges line up with the geometry; view.test.ts pins them.
 */
export const MAIN_HULL: readonly Point[] = [
  [-80, 0],
  [80, 0],
  [80, -8.3],
  [64.4, -25.1],
  [41.4, -40.1],
  [-41.4, -40.1],
  [-64.4, -25.1],
  [-80, -8.3],
];

export interface SoftPlatform {
  left: number;
  right: number;
  y: number;
}

export const SOFT_PLATFORMS: readonly SoftPlatform[] = [
  { left: -59.42, right: -24.79, y: 24.12 },
  { left: -17.32, right: 17.32, y: 47.19 },
  { left: 24.79, right: 59.42, y: 24.12 },
];

/** Visual thickness of a soft platform slab below its walkable surface. */
export const SOFT_THICKNESS = 2;

export const CAP_BOTTOM = -8.3;

/** Half-width of the main platform at height y (y between the hull bottom and the top). */
export function hullHalfWidth(y: number): number {
  const right = MAIN_HULL.slice(1, 5);
  for (let i = 0; i < right.length - 1; i++) {
    const [x1, y1] = right[i]!;
    const [x2, y2] = right[i + 1]!;
    if (y <= y1 && y >= y2) return y1 === y2 ? Math.max(x1, x2) : x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
  }
  return 0;
}
