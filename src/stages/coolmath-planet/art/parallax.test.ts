import { describe, expect, it } from 'vitest';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { BACK_RING, STAR_FIELD } from './background';

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

  it('pins both rear ring tips to their grabbable ends as the camera pans and zooms', () => {
    const { x, y, half, depth } = BACK_RING;
    for (const camera of [REF_CAMERA, { x: -61, y: 28, zoom: 3.8 }, { x: 35, y: 5, zoom: 9 }]) {
      const ends = layerRectOnScreen(depth, camera, { left: x - half, right: x + half, top: y, bottom: y });
      for (const [i, ledge] of stage.ledges.entries()) {
        expect(i === 0 ? ends.left : ends.right).toBeCloseTo(VIEW_W / 2 + (ledge.x - camera.x) * camera.zoom);
        expect(ends.top).toBeCloseTo(VIEW_H / 2 - (ledge.y - camera.y) * camera.zoom);
      }
    }
  });
});
