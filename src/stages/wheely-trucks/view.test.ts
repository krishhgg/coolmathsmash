import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../battlefield/art/parallax';
import { stageStateAt } from '../../sim/movingStage';
import { MOUNTAINS, SKY, VALLEY } from './art/background';
import { HIGHWAY } from './art/road';
import { HAULERS, stage } from './geometry';
import { BRAKE_WARNING, braking, haulerPoses } from './traffic';

const ZOOMS = [CAMERA_LIMITS.minZoom, REF_CAMERA.zoom, CAMERA_LIMITS.maxZoom];

function corners(zoom: number) {
  const { left, right, bottom, top } = stage.camera;
  return [left, 0, right].flatMap((x) => [bottom, REF_CAMERA.y, top].map((y) => ({ x, y, zoom })));
}

describe('Truck Convoy backdrop', () => {
  it.each(ZOOMS)('covers the screen at every camera bound at %s px/unit', (zoom) => {
    // A sliding layer is scrolled left by less than one tile, so it always covers [left - tile, right].
    const scrolled = (band: typeof VALLEY) => ({ ...band, left: band.left - band.tile });
    for (const camera of corners(zoom)) {
      expect(layerRectOnScreen(SKY.depth, camera, SKY)).toEqual({
        left: 0,
        top: 0,
        right: VIEW_W,
        bottom: VIEW_H,
      });
      const valley = layerRectOnScreen(VALLEY.depth, camera, scrolled(VALLEY));
      expect(valley.left).toBeLessThan(0);
      expect(valley.right).toBeGreaterThan(VIEW_W);
      expect(valley.bottom).toBeGreaterThan(VIEW_H);
      const mountains = layerRectOnScreen(MOUNTAINS.depth, camera, scrolled(MOUNTAINS));
      expect(mountains.left).toBeLessThan(0);
      expect(mountains.right).toBeGreaterThan(VIEW_W);
      expect(mountains.bottom).toBeGreaterThan(valley.top);
    }
  });

  it('runs the highway past the widest view of the stage, and its piers below the lowest one', () => {
    const halfWidth = VIEW_W / 2 / CAMERA_LIMITS.minZoom;
    expect(HIGHWAY.left).toBeLessThan(stage.camera.left - halfWidth);
    expect(HIGHWAY.right).toBeGreaterThan(stage.camera.right + halfWidth);
    expect(HIGHWAY.pierBottom).toBeGreaterThan(VIEW_H / 2 / CAMERA_LIMITS.minZoom - stage.camera.bottom);
  });
});

describe('Truck Convoy haulers', () => {
  it('are drawn where the match has their decks, between frames', () => {
    const prev = stageStateAt(stage, 299);
    const pieces = stageStateAt(stage, 300, prev);
    const poses = haulerPoses(300, { pieces, hazards: true, alpha: 0.5 });
    const mid = (pieces.platforms[0]!.x + prev.platforms[0]!.x) / 2;
    expect(mid).toBeLessThan(0);
    for (const pose of poses) {
      expect(pose.x).toBeCloseTo(mid, 9);
      expect(pose.y).toBe(0);
      expect(pose.braking).toBe(true);
    }
    const still = stageStateAt(stage, 300, undefined, false);
    expect(haulerPoses(300, { pieces: still, hazards: false, alpha: 0.5 })).toEqual([
      { x: 0, y: 0, braking: false },
      { x: 0, y: 0, braking: false },
    ]);
    expect(haulerPoses(480).map((p) => p.x)).toEqual([-HAULERS.drift, -HAULERS.drift]);
  });

  it('light their brake lights before and while they fall back, and only then', () => {
    expect(braking(0, 240 - BRAKE_WARNING - 5)).toBe(false);
    expect(braking(0, 240 - BRAKE_WARNING + 5)).toBe(true);
    expect(braking(0, 300)).toBe(true);
    expect(braking(0, 420)).toBe(false);
    expect(braking(0, 1000)).toBe(false);
    for (let f = 0; f < HAULERS.period; f++) {
      const dx = stageStateAt(stage, f + 1, stageStateAt(stage, f)).platforms[0]!.dx;
      if (dx < -1e-6) expect(braking(0, f)).toBe(true);
      if (dx > 1e-6) expect(braking(0, f)).toBe(false);
    }
  });
});
