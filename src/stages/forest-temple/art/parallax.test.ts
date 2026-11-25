import { describe, expect, it } from 'vitest';
import {
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  VIEW_H,
  VIEW_W,
} from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { WALL, WALL_DEPTH } from './palette';

describe('Forest Temple parallax', () => {
  it('keeps the far wall over every screen edge, including at the camera limits', () => {
    const { left, right, top, bottom } = stage.camera;
    for (const zoom of [2.5, REF_CAMERA.zoom, 9])
      for (const x of [left, 0, right])
        for (const y of [bottom, REF_CAMERA.y, top]) {
          const cam = { x, y, zoom };
          expect(layerTransform(0, cam)).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2, scale: 1 });
          const wall = layerRectOnScreen(WALL_DEPTH, cam, WALL);
          expect(wall.left).toBeLessThan(0);
          expect(wall.right).toBeGreaterThan(VIEW_W);
          expect(wall.top).toBeLessThan(0);
          expect(wall.bottom).toBeGreaterThan(VIEW_H);
        }
  });
});
