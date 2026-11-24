import type { Graphics } from 'pixi.js';
import { scheduledOn, type PieceState, type StageState } from '../sim/movingStage';
import type { Moving, StageGeometry } from '../sim/stage';

/** A scheduled piece blinks for this many frames before it vanishes. */
const WARN_FRAMES = 45;

export const isMoving = (p: Moving) => p.motion !== undefined || p.schedule !== undefined;

function vanishesSoon(piece: Moving, frame: number): boolean {
  for (let k = 1; k <= WARN_FRAMES; k++) if (!scheduledOn(piece.schedule, frame + k)) return true;
  return false;
}

/**
 * Placeholder drawing of the stage's moving and scheduled pieces (the renderer draws the static ones once),
 * interpolated between the last two frames. Absent pieces show as faint ghosts; pieces about to vanish blink.
 */
export function drawMovingPieces(
  g: Graphics,
  geo: StageGeometry,
  st: StageState,
  frame: number,
  alpha: number,
): void {
  g.clear();
  const look = (piece: Moving, p: PieceState) => ({
    x: p.x - p.dx * (1 - alpha),
    y: p.y - p.dy * (1 - alpha),
    alpha: !p.on ? 0.15 : vanishesSoon(piece, frame) && Math.floor(frame / 5) % 2 === 0 ? 0.4 : 1,
  });
  geo.solids.forEach((s, i) => {
    if (!isMoving(s)) return;
    const o = look(s, st.solids[i]!);
    g.poly(s.points.flatMap(([x, y]) => [x + o.x, -(y + o.y)])).fill({ color: '#56688f', alpha: o.alpha });
  });
  geo.platforms.forEach((p, i) => {
    if (!isMoving(p)) return;
    const o = look(p, st.platforms[i]!);
    g.roundRect(p.x1 + o.x, -(p.y + o.y), p.x2 - p.x1, 2.2, 1.1).fill({ color: '#b9d0ff', alpha: o.alpha });
  });
}
