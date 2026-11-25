import { describe, expect, it } from 'vitest';
import { cameraTarget } from '../../../render/camera';
import { testMatch } from '../../../sim/testing/sim';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { SKY_RECT, WATER_DEPTH, WATER_RECT, WATER_Y } from './lagoon';

describe('Raft War Lagoon camera coverage', () => {
  it('covers the full screen at the corners of its camera bounds and all supported zooms', () => {
    const { left, right, top, bottom } = stage.camera;
    for (const zoom of [2.5, REF_CAMERA.zoom, 9])
      for (const x of [left, 0, right])
        for (const y of [bottom, REF_CAMERA.y, top]) {
          const camera = { x, y, zoom };
          expect(layerRectOnScreen(0, camera, SKY_RECT)).toEqual({
            left: 0,
            top: 0,
            right: VIEW_W,
            bottom: VIEW_H,
          });
          const water = layerRectOnScreen(WATER_DEPTH, camera, WATER_RECT);
          expect(water.left).toBeLessThan(0);
          expect(water.right).toBeGreaterThan(VIEW_W);
          expect(water.bottom).toBeGreaterThan(VIEW_H);
          expect(water.top).toBeCloseTo(VIEW_H / 2 + (y - WATER_Y) * zoom);
        }
  });

  it('frames both shores, the roof and the visible gaps at a four-port start', () => {
    const match = testMatch({ stage: stage.id, players: 4 });
    const camera = cameraTarget(match, stage);
    const outerLedges = stage.ledges.filter(({ x }) => Math.abs(x) === 140);
    expect(outerLedges).toHaveLength(2);
    for (const { x } of outerLedges) {
      expect(Math.abs(x - camera.x) * camera.zoom).toBeLessThan(VIEW_W / 2);
    }
    const water = layerRectOnScreen(WATER_DEPTH, camera, WATER_RECT);
    const roofY = VIEW_H / 2 - (stage.platforms[0]!.y - camera.y) * camera.zoom;
    expect(roofY).toBeGreaterThan(0);
    expect(roofY).toBeLessThan(water.top);
    expect(water.top).toBeLessThan(VIEW_H);
  });
});
