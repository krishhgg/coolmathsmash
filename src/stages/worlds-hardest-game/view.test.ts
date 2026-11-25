import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../battlefield/art/parallax';
import { stage } from './geometry';
import { createStageView } from './view';

describe("World's Hardest Stage background", () => {
  it.each([CAMERA_LIMITS.minZoom, REF_CAMERA.zoom, CAMERA_LIMITS.maxZoom])(
    'covers the screen at every corner of its camera bounds at %s px/unit',
    (zoom) => {
      const { left, right, bottom, top } = stage.camera;
      const view = createStageView();
      for (const x of [left, right])
        for (const y of [bottom, top]) {
          const camera = { x, y, zoom };
          view.update(120, camera);
          const { minX, minY, maxX, maxY } = view.background.getBounds();
          const rect = layerRectOnScreen(0, camera, { left: minX, top: minY, right: maxX, bottom: maxY });
          expect(rect).toEqual({ left: 0, top: 0, right: VIEW_W, bottom: VIEW_H });
        }
      view.background.destroy();
      view.world.destroy();
    },
  );
});
