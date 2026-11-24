import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { MatchState } from '../sim/match';
import type { StageGeometry } from '../sim/stage';

export interface CameraView {
  /** World point at the centre of the screen (game units, y up). */
  x: number;
  y: number;
  /** Screen pixels per game unit. */
  zoom: number;
}

const MARGIN_X = 45;
const MARGIN_TOP = 35;
const MARGIN_BOTTOM = 25;
const MIN_WIDTH = 150;
const MAX_ZOOM = 9;
export const SMOOTHING = 0.12;

/** Frame-everyone target: the fighters' bounding box plus margins, kept inside the stage's camera bounds. */
export function cameraTarget(state: MatchState, stage: StageGeometry): CameraView {
  const live = state.fighters.filter((f) => f.action !== 'ko' && f.action !== 'out');
  const b = stage.camera;
  let left = Infinity;
  let right = -Infinity;
  let top = -Infinity;
  let bottom = Infinity;
  for (const f of live) {
    left = Math.min(left, f.pos.x - MARGIN_X);
    right = Math.max(right, f.pos.x + MARGIN_X);
    bottom = Math.min(bottom, f.pos.y - MARGIN_BOTTOM);
    top = Math.max(top, f.pos.y + 15 + MARGIN_TOP);
  }
  if (live.length === 0) {
    left = -80;
    right = 80;
    bottom = -20;
    top = 60;
  }
  left = Math.max(left, b.left);
  right = Math.min(right, b.right);
  bottom = Math.max(bottom, b.bottom);
  top = Math.min(top, b.top);
  let w = Math.max(right - left, MIN_WIDTH);
  let h = Math.max(top - bottom, (w * VIEW_HEIGHT) / VIEW_WIDTH);
  w = Math.max(w, (h * VIEW_WIDTH) / VIEW_HEIGHT);
  const minZoom = Math.max(VIEW_WIDTH / (b.right - b.left), VIEW_HEIGHT / (b.top - b.bottom));
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom, VIEW_WIDTH / w));
  h = VIEW_HEIGHT / zoom;
  w = VIEW_WIDTH / zoom;
  const cx = Math.min(Math.max((left + right) / 2, b.left + w / 2), b.right - w / 2);
  const cy = Math.min(Math.max((top + bottom) / 2, b.bottom + h / 2), b.top - h / 2);
  return { x: cx, y: cy, zoom };
}

/**
 * Smoothed camera. `step` runs once after every simulated frame (Game.step), easing toward that frame's target, so the
 * view at a frame depends only on the frames simulated and never on how often or when they were drawn.
 */
export class Camera {
  private view: CameraView | null = null;
  private frame = -1;

  step(state: MatchState, stage: StageGeometry): void {
    const target = cameraTarget(state, stage);
    const v = this.view;
    this.view =
      v && state.frame === this.frame + 1
        ? {
            x: v.x + (target.x - v.x) * SMOOTHING,
            y: v.y + (target.y - v.y) * SMOOTHING,
            zoom: v.zoom + (target.zoom - v.zoom) * SMOOTHING,
          }
        : target;
    this.frame = state.frame;
  }

  /** The view to draw `state` with: the smoothed view once stepped to its frame, else that frame's target. */
  viewFor(state: MatchState, stage: StageGeometry): CameraView {
    return this.view && this.frame === state.frame ? this.view : cameraTarget(state, stage);
  }
}
