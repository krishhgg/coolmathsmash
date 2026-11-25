import { Polygon, Rectangle, type Graphics } from 'pixi.js';
import { compileStage, edgeMaxX, edgeMinX, floorY, type StageGeometry } from '../sim/stage';
import { isMoving } from './stagePieces';

/**
 * Checks that a stage's art shows the floor fighters stand on (docs/stages.md, "Lining art up with geometry"). All
 * heights are game units, y up.
 */

/** The highest floor of any static solid at x, where a grounded fighter's feet are; null over a gap. */
export function floorTopAt(stage: StageGeometry, x: number): number | null {
  let top: number | null = null;
  for (const e of compileStage(stage).edges) {
    if (e.kind !== 'floor' || isMoving(stage.solids[e.solid]!)) continue;
    if (x < edgeMinX(e) || x > edgeMaxX(e)) continue;
    const y = floorY(e, x);
    if (top === null || y > top) top = y;
  }
  return top;
}

/**
 * The highest filled point of `g` at x, read from its fill instructions in its own local space (Pixi's y down,
 * flipped back to game y). Polygons and rectangles only: any other filled shape throws, so a caller never gets
 * a top that silently skipped part of the drawing.
 */
export function drawnTopAt(g: Graphics, x: number): number | null {
  let top: number | null = null;
  for (const instruction of g.context.instructions) {
    if (instruction.action !== 'fill') continue;
    for (const { shape, transform } of instruction.data.path.shapePath.shapePrimitives) {
      let points: number[];
      if (shape instanceof Polygon) points = shape.points;
      else if (shape instanceof Rectangle) {
        const { left, right, top: t, bottom } = shape;
        points = [left, t, right, t, right, bottom, left, bottom];
      } else throw new Error(`drawnTopAt: unsupported filled shape ${shape.type}`);
      if (transform) {
        points = points.slice();
        for (let i = 0; i < points.length; i += 2) {
          const p = transform.apply({ x: points[i]!, y: points[i + 1]! });
          points[i] = p.x;
          points[i + 1] = p.y;
        }
      }
      for (let i = 0; i < points.length; i += 2) {
        const [ax, ay] = [points[i]!, points[i + 1]!];
        const j = (i + 2) % points.length;
        const [bx, by] = [points[j]!, points[j + 1]!];
        if (x < Math.min(ax, bx) || x > Math.max(ax, bx)) continue;
        const ys = ax === bx ? [ay, by] : [ay + ((x - ax) / (bx - ax)) * (by - ay)];
        for (const y of ys) if (top === null || 0 - y > top) top = 0 - y;
      }
    }
  }
  return top;
}

export interface SurfaceMismatch {
  x: number;
  floor: number;
  drawn: number | null;
}

/**
 * Every x along the stage's static floors, `step` units apart, where the top of `solids` (the Graphics that draws
 * the stage's solid ground, with no drop-through platforms in it) is not the collision floor. Empty when the art
 * shows exactly where fighters stand.
 */
export function surfaceMismatches(stage: StageGeometry, solids: Graphics, step = 0.25): SurfaceMismatch[] {
  const floors = compileStage(stage).edges.filter(
    (e) => e.kind === 'floor' && !isMoving(stage.solids[e.solid]!),
  );
  if (floors.length === 0) return [];
  const left = Math.min(...floors.map(edgeMinX));
  const right = Math.max(...floors.map(edgeMaxX));
  const xs: number[] = [];
  for (let i = 0; left + i * step < right; i++) xs.push(left + i * step);
  xs.push(right);
  const out: SurfaceMismatch[] = [];
  for (const x of xs) {
    const floor = floorTopAt(stage, x);
    if (floor === null) continue;
    const drawn = drawnTopAt(solids, x);
    if (drawn === null || Math.abs(drawn - floor) > 1e-6) out.push({ x, floor, drawn });
  }
  return out;
}
