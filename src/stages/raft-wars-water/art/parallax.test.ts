import { describe, expect, it, vi } from 'vitest';
import { cameraTarget } from '../../../render/camera';
import { stageStateAt } from '../../../sim/movingStage';
import { testMatch } from '../../../sim/testing/sim';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import type * as ArtUtil from '../../battlefield/art/util';
import { BOAT_SOLID, stage } from '../geometry';
import { tideHeight, TIDE_HEIGHT } from '../tide';
import { createStageView } from '../view';
import { SKY_RECT, WATER_DEPTH, WATER_RECT, WATER_Y } from './lagoon';

vi.mock('../../battlefield/art/util', async (importOriginal) => ({
  ...(await importOriginal<typeof ArtUtil>()),
  vGradient: () => 0xffffff,
}));

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
          expect(water.bottom - TIDE_HEIGHT * zoom).toBeGreaterThan(VIEW_H);
          expect(water.top).toBeCloseTo(VIEW_H / 2 + (y - WATER_Y) * zoom);
        }
  });

  it('interpolates the rendered boat and the waterline and keeps the water still with hazards off', () => {
    const view = createStageView();
    const frame = 2490;
    const previous = stageStateAt(stage, frame - 1);
    const pieces = stageStateAt(stage, frame, previous);
    const renderedY = (pieces.solids[BOAT_SOLID]!.y + previous.solids[BOAT_SOLID]!.y) / 2;
    const canopy = view.world.getChildByLabel('lagoon-canopy')!;
    const hull = view.world.getChildByLabel('lagoon-skiff')!;
    const water = view.background.getChildByLabel('lagoon-water', true)!;
    view.update(frame, REF_CAMERA, { hazards: true, pieces, alpha: 0.5 });
    expect(hull.y).toBeCloseTo(-renderedY);
    expect(canopy.y).toBeCloseTo(-renderedY);
    const interpolatedTide = (tideHeight(frame - 1) + tideHeight(frame)) / 2;
    expect(water.y).toBeCloseTo(VIEW_H / 2 - interpolatedTide * REF_CAMERA.zoom);

    const still = stageStateAt(stage, frame, undefined, false);
    view.update(frame, REF_CAMERA, { hazards: false, pieces: still, alpha: 0.5 });
    expect(hull.y).toBeCloseTo(0);
    expect(canopy.y).toBeCloseTo(0);
    expect(water.y).toBe(VIEW_H / 2);
    expect(view.drawsStagePieces).toBe(true);
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
