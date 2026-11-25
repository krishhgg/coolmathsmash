import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS, layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../battlefield/art/parallax';
import { stageStateAt } from '../../sim/movingStage';
import { MOUNTAINS, SKY, VALLEY } from './art/background';
import { HIGHWAY } from './art/road';
import { HAULERS, stage } from './geometry';
import { haulerPoses } from './traffic';

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
  const states = (hazards: boolean) => {
    const out = [stageStateAt(stage, 0, undefined, hazards)];
    for (let f = 1; f <= HAULERS.period; f++) out.push(stageStateAt(stage, f, out[f - 1], hazards));
    return out;
  };

  it('are drawn where the match has their decks, between frames', () => {
    const [prev, now] = [stageStateAt(stage, 299), stageStateAt(stage, 300, stageStateAt(stage, 299))];
    const mid = (now.platforms[0]!.x + prev.platforms[0]!.x) / 2;
    expect(mid).toBeLessThan(-HAULERS.creep);
    for (const pose of haulerPoses(now, 0.5)) {
      expect(pose.x).toBeCloseTo(mid, 9);
      expect(pose.y).toBe(0);
      expect(pose.braking).toBe(true);
    }
    for (const pieces of states(false))
      expect(haulerPoses(pieces, 0.5)).toEqual([
        { x: 0, y: 0, braking: false },
        { x: 0, y: 0, braking: false },
      ]);
  });

  it('light their brake lights a brake tap before they fall back, and only while dropping back', () => {
    const traffic = states(true);
    const lit = traffic.map((pieces) => haulerPoses(pieces, 1)[0]!.braking);
    const first = lit.indexOf(true);
    expect(first).toBe(241);
    expect(traffic[first + HAULERS.warning - 1]!.platforms[0]!.x).toBeGreaterThanOrEqual(-HAULERS.creep);
    for (const [f, pieces] of traffic.entries()) expect(lit[f]).toBe(pieces.platforms[0]!.dx < 0);
    expect(lit.slice(960, 1080).some(Boolean)).toBe(false);
  });
});
