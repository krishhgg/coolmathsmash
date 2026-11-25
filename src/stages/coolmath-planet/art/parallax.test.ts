import { describe, expect, it } from 'vitest';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { STAR_FIELD } from './background';

describe('Coolmath Planet parallax', () => {
  const { left, right, bottom, top } = stage.camera;

  it('keeps the viewport covered by the fixed sky and the wider moving star field', () => {
    const sky = { left: 0, top: 0, right: VIEW_W, bottom: VIEW_H };
    for (const x of [left, REF_CAMERA.x, right])
      for (const y of [bottom, REF_CAMERA.y, top])
        for (const zoom of [2.5, REF_CAMERA.zoom, 9]) {
          const camera = { x, y, zoom };
          expect(layerRectOnScreen(0, camera, sky)).toEqual(sky);
          const stars = layerRectOnScreen(STAR_FIELD.depth, camera, STAR_FIELD);
          expect(stars.left).toBeLessThan(0);
          expect(stars.top).toBeLessThan(0);
          expect(stars.right).toBeGreaterThan(VIEW_W);
          expect(stars.bottom).toBeGreaterThan(VIEW_H);
        }
  });
});
