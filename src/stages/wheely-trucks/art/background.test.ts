import { describe, expect, it } from 'vitest';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { HIGHWAY, SKY, VERGE } from './background';

const { left, right, top, bottom } = stage.camera;
const cameras = [2.5, REF_CAMERA.zoom, 9].flatMap((zoom) =>
  [left, REF_CAMERA.x, right].flatMap((x) => [bottom, REF_CAMERA.y, top].map((y) => ({ x, y, zoom }))),
);

describe('Truck Convoy background coverage', () => {
  it('keeps sky behind the entire viewport at each camera extreme', () => {
    for (const camera of cameras) {
      expect(layerRectOnScreen(SKY.depth, camera, SKY)).toEqual({
        left: 0,
        right: VIEW_W,
        top: 0,
        bottom: VIEW_H,
      });
    }
  });

  it.each([VERGE, HIGHWAY])('overscans the view below the horizon at parallax depth $depth', (layer) => {
    for (const camera of cameras) {
      const screen = layerRectOnScreen(layer.depth, camera, layer);
      expect(screen.left).toBeLessThanOrEqual(0);
      expect(screen.right).toBeGreaterThanOrEqual(VIEW_W);
      expect(screen.bottom).toBeGreaterThanOrEqual(VIEW_H);
    }
  });
});
