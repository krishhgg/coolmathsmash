import { expect, it } from 'vitest';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { PASTURE, SKY } from './background';

it('paints sky and uninterrupted pasture at all camera bounds and zoom limits', () => {
  const { left, right, top, bottom } = stage.camera;
  for (const zoom of [2.5, REF_CAMERA.zoom, 9])
    for (const x of [left, REF_CAMERA.x, right])
      for (const y of [bottom, REF_CAMERA.y, top]) {
        const camera = { x, y, zoom };
        expect(layerRectOnScreen(SKY.depth, camera, SKY)).toEqual({
          left: 0,
          top: 0,
          right: VIEW_W,
          bottom: VIEW_H,
        });
        const pasture = layerRectOnScreen(PASTURE.depth, camera, PASTURE);
        expect(pasture.left).toBeLessThan(0);
        expect(pasture.right).toBeGreaterThan(VIEW_W);
        expect(pasture.top).toBeLessThan(VIEW_H);
        expect(pasture.bottom).toBeGreaterThan(VIEW_H);
      }
});
