import { Container, Graphics } from 'pixi.js';
import { compileStage, type StageGeometry } from '../sim/stage';
import { isMoving } from './stagePieces';

/** How far the grass strip reaches below each floor edge, in game units. */
export const GRASS_DEPTH = 3;

/**
 * Collision geometry drawn flat, for stages without art: each static solid as an earth-brown polygon with a grass
 * strip hanging below every floor edge, so the top of the drawing is exactly the floor fighters stand on (dips and
 * slopes included), and drop-through platforms as cream slabs. The `solids` and `platforms` children are separate so
 * `surfaceMismatches` (./surface.ts) can check the ground on its own.
 */
export function placeholderStage(stage: StageGeometry): Container {
  const solids = new Graphics({ label: 'solids' });
  for (const solid of stage.solids) {
    if (isMoving(solid)) continue;
    solids.poly(solid.points.flatMap(([x, y]) => [x, -y])).fill('#7a5230');
  }
  for (const { kind, solid, a, b } of compileStage(stage).edges) {
    if (kind !== 'floor' || isMoving(stage.solids[solid]!)) continue;
    solids.poly([a.x, -a.y, b.x, -b.y, b.x, -b.y + GRASS_DEPTH, a.x, -a.y + GRASS_DEPTH]).fill('#3d8f3a');
  }
  const platforms = new Graphics({ label: 'platforms' });
  for (const p of stage.platforms)
    if (!isMoving(p)) platforms.roundRect(p.x1, -p.y, p.x2 - p.x1, 2.2, 1.1).fill('#d9d2c0');
  const view = new Container({ label: 'placeholder-stage' });
  view.addChild(solids, platforms);
  return view;
}
