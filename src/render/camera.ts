import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { SimEvent } from '../sim/events';
import type { FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import type { StageGeometry } from '../sim/stage';

export interface CameraView {
  /** World point at the centre of the screen (game units, y up). */
  x: number;
  y: number;
  /** Screen pixels per game unit. */
  zoom: number;
}

/** A point the drawn view leans toward: `weight` 0 keeps the camera's view, 1 centres `x`, `y` at `zoom`. */
export interface Focus {
  x: number;
  y: number;
  zoom: number;
  weight: number;
}

const MARGIN_X = 55;
const MARGIN_TOP = 35;
const MARGIN_BOTTOM = 25;
/**
 * The narrowest view in game units. At 240 a 1v1 at Battlefield's spawns shows the 160-unit deck across 67% of the
 * screen (Ultimate: about 60%), and both lips stay in frame while a fighter dashes from its spawn to either side.
 */
const MIN_WIDTH = 240;
/** The closest the camera gets, in pixels per unit: MIN_WIDTH across the screen. Stage art caches at this resolution. */
export const MAX_ZOOM = VIEW_WIDTH / MIN_WIDTH;
export const SMOOTHING = 0.12;
/**
 * How fast the view widens while a fighter flies from a tumble launch. A KO launch covers 25-45 units a frame once
 * hitlag ends; at SMOOTHING the victim left the screen 1-3 frames before it reached the camera bounds, at 0.6 it
 * stays on screen until it passes them.
 */
export const LAUNCH_SMOOTHING = 0.6;

/** Hitlag is over and tumble hitstun is still running: the fighter is flying from a launch. */
const flying = (f: FighterState) => f.action === 'tumble' && f.hitlag === 0 && f.hitstun > 0;

/**
 * The easing rate toward `target` from `view`: LAUNCH_SMOOTHING while a fighter is flying from a launch and the
 * target is wider than the view, else SMOOTHING. Narrowing stays slow, so a fighter falling back does not snap the
 * view in.
 */
export function smoothingFor(state: MatchState, view: CameraView, target: CameraView): number {
  return target.zoom < view.zoom && state.fighters.some(flying) ? LAUNCH_SMOOTHING : SMOOTHING;
}

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

/** A screen shake: `amplitude` screen pixels, fading out over `frames` frames from frame `start`. */
export interface Shake {
  start: number;
  amplitude: number;
  frames: number;
}

/** A move asking the camera to shake, in screen pixels (until `SimEvent` carries it itself). */
type ShakeEvent = { type: 'shake'; port: number; amplitude: number; frames: number };

/**
 * Ultimate's screen shake, tuned by eye in screen pixels at 1280x720: launches strong enough to KO at mid
 * percent shake the camera through their hitlag and a little after, harder ones more, and a blast-zone KO
 * shakes it hardest.
 */
export const SHAKE = {
  heavy: { kb: 100, amplitude: 2.5, after: 8 },
  severe: { kb: 150, amplitude: 5, after: 12 },
  ko: { amplitude: 10, frames: 30 },
};

/** The shakes a frame's events start. */
export function shakesFrom(events: readonly (SimEvent | ShakeEvent)[], frame: number): Shake[] {
  const shakes: Shake[] = [];
  for (const e of events) {
    if (e.type === 'shake') shakes.push({ start: frame, amplitude: e.amplitude, frames: e.frames });
    if (e.type === 'ko') shakes.push({ start: frame, ...SHAKE.ko });
    if (e.type !== 'hit' || e.kb < SHAKE.heavy.kb) continue;
    const tier = e.kb >= SHAKE.severe.kb ? SHAKE.severe : SHAKE.heavy;
    shakes.push({ start: frame, amplitude: tier.amplitude, frames: e.hitlag + tier.after });
  }
  return shakes;
}

/**
 * Screen offset in pixels at `frame`: the strongest live shake's fading amplitude on a fast, mostly vertical
 * jitter. A pure function of the frame, so a frame shakes the same however it was reached.
 */
export function shakeOffset(shakes: readonly Shake[], frame: number): { x: number; y: number } {
  let amplitude = 0;
  for (const s of shakes) {
    const t = frame - s.start;
    if (t >= 0 && t < s.frames) amplitude = Math.max(amplitude, s.amplitude * (1 - t / s.frames));
  }
  if (amplitude === 0) return { x: 0, y: 0 };
  return { x: amplitude * 0.6 * Math.sin(frame * 1.9 + 1), y: amplitude * Math.sin(frame * 2.6) };
}

/**
 * Smoothed camera. `step` runs once after every simulated frame (Game.step), easing toward that frame's target, so the
 * view at a frame depends only on the frames simulated and never on how often or when they were drawn.
 */
export class Camera {
  private view: CameraView | null = null;
  private frame = -1;
  private shakes: Shake[] = [];

  step(state: MatchState, stage: StageGeometry): void {
    const target = cameraTarget(state, stage);
    const v = this.view;
    const next = v !== null && state.frame === this.frame + 1;
    this.shakes = [
      ...(next ? this.shakes.filter((s) => state.frame - s.start < s.frames) : []),
      ...shakesFrom(state.events, state.frame),
    ];
    if (next) {
      const k = smoothingFor(state, v, target);
      this.view = {
        x: v.x + (target.x - v.x) * k,
        y: v.y + (target.y - v.y) * k,
        zoom: v.zoom + (target.zoom - v.zoom) * k,
      };
    } else this.view = target;
    this.frame = state.frame;
  }

  /**
   * The view to draw `state` with: the smoothed view once stepped to its frame, leaning toward `focus` (the Special
   * and Finish Zoom, zoom.ts) and shaken by the live screen shakes (neither feeds back into the smoothing), else that
   * frame's target.
   */
  viewFor(state: MatchState, stage: StageGeometry, focus: Focus | null = null): CameraView {
    const v = this.view;
    if (!v || this.frame !== state.frame) return cameraTarget(state, stage);
    const w = focus?.weight ?? 0;
    const x = focus ? v.x + (focus.x - v.x) * w : v.x;
    const y = focus ? v.y + (focus.y - v.y) * w : v.y;
    const zoom = focus ? v.zoom * (focus.zoom / v.zoom) ** w : v.zoom;
    const s = shakeOffset(this.shakes, state.frame);
    return { x: x - s.x / zoom, y: y + s.y / zoom, zoom };
  }
}
