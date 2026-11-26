import type { Graphics } from 'pixi.js';
import { zoneAt } from '../sim/hazards';
import type { MatchState } from '../sim/match';
import { motionOffset, scheduledOn, type PieceState } from '../sim/movingStage';
import type { Moving, PieceOptions, StageGeometry, TerrainElement } from '../sim/stage';

/** A scheduled piece blinks for this many frames before it vanishes. */
const WARN_FRAMES = 45;

const ZONE_COLORS: Record<TerrainElement, string> = { goo: '#5fd13a', lava: '#ff5a1f', water: '#2f8bff' };

export const isMoving = (p: Moving) => p.motion !== undefined || p.schedule !== undefined;

function vanishesSoon(piece: Moving, frame: number): boolean {
  for (let k = 1; k <= WARN_FRAMES; k++) if (!scheduledOn(piece.schedule, frame + k)) return true;
  return false;
}

/** A piece's offset `alpha` of the way from the previous frame to the current one. */
export function pieceOffset(p: PieceState, alpha: number): { x: number; y: number } {
  return { x: p.x - p.dx * (1 - alpha), y: p.y - p.dy * (1 - alpha) };
}

/**
 * Placeholder drawing of the stage's moving and scheduled pieces (the renderer draws the static ones once),
 * interpolated between the last two frames: absent pieces show as faint ghosts and pieces about to vanish
 * blink. With hazards on, damage zones are tinted by element and stage hitboxes are grey discs, solid while
 * active. `placeholders` false leaves out the solids and platforms, for a stage view that draws its own.
 */
export function drawStagePieces(
  g: Graphics,
  geo: StageGeometry,
  state: MatchState,
  alpha: number,
  placeholders = true,
): void {
  g.clear();
  const { frame, stage: st } = state;
  const still = (piece: PieceOptions) => piece.hazard === true && state.config.hazards === false;
  const look = (piece: PieceOptions, p: PieceState) => ({
    ...pieceOffset(p, alpha),
    alpha: !p.on
      ? 0.15
      : !still(piece) && vanishesSoon(piece, frame) && Math.floor(frame / 5) % 2 === 0
        ? 0.4
        : 1,
  });
  geo.solids.forEach((s, i) => {
    if (!placeholders || !isMoving(s)) return;
    const o = look(s, st.solids[i]!);
    g.poly(s.points.flatMap(([x, y]) => [x + o.x, -(y + o.y)])).fill({ color: '#56688f', alpha: o.alpha });
  });
  geo.platforms.forEach((p, i) => {
    if (!placeholders || !isMoving(p)) return;
    const o = look(p, st.platforms[i]!);
    g.roundRect(p.x1 + o.x, -(p.y + o.y), p.x2 - p.x1, 2.2, 1.1).fill({ color: '#b9d0ff', alpha: o.alpha });
  });
  if (state.config.hazards === false) return;
  for (const z of geo.zones ?? []) {
    const at = zoneAt(z, frame);
    if (at)
      g.rect(at.x1, -at.y2, at.x2 - at.x1, at.y2 - at.y1).fill({ color: ZONE_COLORS[z.element], alpha: 0.7 });
  }
  for (const h of geo.hitboxes ?? []) {
    const [dx, dy] = motionOffset(h.motion, frame);
    const fill = { color: '#3b3f4a', alpha: scheduledOn(h.schedule, frame) ? 0.9 : 0.2 };
    for (const b of h.boxes) g.circle(h.x + dx + b.x, -(h.y + dy + b.y), b.radius).fill(fill);
  }
}
