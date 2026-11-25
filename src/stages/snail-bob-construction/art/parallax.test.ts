import { describe, expect, it } from 'vitest';
import {
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  VIEW_H,
  VIEW_W,
} from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { YARD } from './background';

describe('Construction Site backdrop', () => {
  it('keeps the sky locked to the screen and the yard opaque below the fence at every camera extreme', () => {
    const { left, right, top, bottom } = stage.camera;
    for (const x of [left, REF_CAMERA.x, right])
      for (const y of [bottom, REF_CAMERA.y, top])
        for (const zoom of [2.5, REF_CAMERA.zoom, 9]) {
          const camera = { x, y, zoom };
          expect(layerTransform(0, camera)).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2, scale: 1 });
          const rect = layerRectOnScreen(YARD.depth, camera, YARD);
          expect(rect.left).toBeLessThan(0);
          expect(rect.right).toBeGreaterThan(VIEW_W);
          expect(rect.bottom).toBeGreaterThan(VIEW_H);
        }
  });
});
