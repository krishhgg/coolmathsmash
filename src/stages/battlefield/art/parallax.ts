/**
 * Parallax for screen-space background layers. Each layer is drawn in screen pixels as it looks from the
 * reference camera; `depth` places it between the sky (0, never moves) and the playfield (1, moves and zooms
 * exactly like the world). Pure maths so it can be unit tested and stays deterministic.
 */
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const REF_CAMERA = { x: 0, y: 20, zoom: 4.5 } as const;

/** Camera bounds and zoom range the background must cover (game units, px per unit). */
export const CAMERA_LIMITS = {
  left: -170,
  right: 170,
  top: 130,
  bottom: -80,
  minZoom: 2.5,
  maxZoom: 9,
} as const;

export interface StageCamera {
  /** Game point (y up) at the centre of the screen. */
  x: number;
  y: number;
  /** Pixels per game unit. */
  zoom: number;
}

export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
}

/** Position and scale for a layer container whose pivot sits at the screen centre. */
export function layerTransform(depth: number, camera: StageCamera): LayerTransform {
  return {
    scale: Math.pow(camera.zoom / REF_CAMERA.zoom, depth),
    x: VIEW_W / 2 - (camera.x - REF_CAMERA.x) * camera.zoom * depth,
    y: VIEW_H / 2 + (camera.y - REF_CAMERA.y) * camera.zoom * depth,
  };
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where a rectangle drawn in a layer's reference pixels lands on screen. */
export function layerRectOnScreen(depth: number, camera: StageCamera, rect: Rect): Rect {
  const t = layerTransform(depth, camera);
  const sx = (x: number) => t.x + (x - VIEW_W / 2) * t.scale;
  const sy = (y: number) => t.y + (y - VIEW_H / 2) * t.scale;
  return { left: sx(rect.left), right: sx(rect.right), top: sy(rect.top), bottom: sy(rect.bottom) };
}

/** The extreme cameras: every corner of the camera bounds at the minimum and maximum zoom, plus the reference. */
export function extremeCameras(): StageCamera[] {
  const { left, right, top, bottom, minZoom, maxZoom } = CAMERA_LIMITS;
  const cams: StageCamera[] = [{ ...REF_CAMERA }];
  for (const zoom of [minZoom, REF_CAMERA.zoom, maxZoom])
    for (const x of [left, 0, right]) for (const y of [bottom, REF_CAMERA.y, top]) cams.push({ x, y, zoom });
  return cams;
}

/**
 * The cloud sea fills everything below the horizon; it is the layer that must cover the bottom of the screen at
 * every camera (parallax.test.ts checks it), so its extent lives here with the maths.
 */
export const SEA_LAYER = {
  depth: 0.14,
  horizon: 374,
  left: -1700,
  right: VIEW_W + 1700,
  bottom: 3400,
} as const;

/** Wraps a drifting coordinate into [min, min + span) so looping clouds stay a pure function of the frame. */
export function wrap(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}
