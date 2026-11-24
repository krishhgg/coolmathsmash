import { stage } from '../geometry';
import type { Point } from './util';

/**
 * The art is drawn straight from the collision geometry in ../geometry.ts so surfaces, walls, slopes and ledges
 * line up exactly. Battlefield has one solid (the main platform) and three drop-through platforms.
 */
export const MAIN_HULL: readonly Point[] = stage.solids[0]!.points;

export const SOFT_PLATFORMS: readonly { left: number; right: number; y: number }[] = stage.platforms.map(
  (p) => ({
    left: p.x1,
    right: p.x2,
    y: p.y,
  }),
);

/** Visual thickness of a soft platform slab below its walkable surface. */
export const SOFT_THICKNESS = 2;

const ys = MAIN_HULL.map(([, y]) => y);
export const TOP_Y = Math.max(...ys);
export const HULL_BOTTOM = Math.min(...ys);
/** Bottom of the vertical side walls: the highest hull corner below the top surface. */
export const CAP_BOTTOM = Math.max(...ys.filter((y) => y < TOP_Y));

/** The solid's left and right x at height y (TOP_Y >= y >= HULL_BOTTOM). */
export function hullSpan(y: number): [number, number] {
  let left = Infinity;
  let right = -Infinity;
  MAIN_HULL.forEach(([ax, ay], i) => {
    const [bx, by] = MAIN_HULL[(i + 1) % MAIN_HULL.length]!;
    if (y < Math.min(ay, by) - 1e-9 || y > Math.max(ay, by) + 1e-9) return;
    const xs = ay === by ? [ax, bx] : [ax + ((y - ay) / (by - ay)) * (bx - ax)];
    for (const x of xs) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  });
  return [left, right];
}

/** The hull below the cap (walls excluded), in hull order. */
export const UNDERSIDE: readonly Point[] = MAIN_HULL.filter(([, y]) => y <= CAP_BOTTOM);
