import { describe, expect, it } from 'vitest';
import {
  CAMERA_LIMITS,
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  VIEW_H,
  VIEW_W,
} from '../../battlefield/art/parallax';
import { HILLS, MEADOW, racerHop, scrollAt } from './background';
import { stage } from '../geometry';

const zooms = [CAMERA_LIMITS.minZoom, REF_CAMERA.zoom, CAMERA_LIMITS.maxZoom];

function cameras() {
  const { left, right, bottom, top } = stage.camera;
  return zooms.flatMap((zoom) =>
    [left, REF_CAMERA.x, right].flatMap((x) => [bottom, REF_CAMERA.y, top].map((y) => ({ x, y, zoom }))),
  );
}

describe('Duck Life Course backdrop', () => {
  it.each(cameras())('leaves no gap at camera %o', (camera) => {
    expect(layerTransform(0, camera)).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2, scale: 1 });
    const meadow = layerRectOnScreen(MEADOW.depth, camera, MEADOW);
    expect(meadow.left).toBeLessThan(0);
    expect(meadow.right).toBeGreaterThan(VIEW_W);
    expect(meadow.bottom).toBeGreaterThan(VIEW_H);
    // The hills cover the width at the strip's worst scroll phase and reach below the meadow's horizon.
    const hills = layerRectOnScreen(HILLS.depth, camera, {
      left: HILLS.left,
      right: HILLS.right - HILLS.period,
      top: 0,
      bottom: HILLS.bottom,
    });
    expect(hills.left).toBeLessThan(0);
    expect(hills.right).toBeGreaterThan(VIEW_W);
    expect(hills.bottom).toBeGreaterThan(meadow.top);
  });

  it('keeps the meadow strip three periods wide around the screen at any scroll', () => {
    for (const camera of cameras()) {
      const { x, scale } = layerTransform(MEADOW.depth, camera);
      const refX = (sx: number) => VIEW_W / 2 + (sx - x) / scale;
      expect(refX(0)).toBeGreaterThan(-MEADOW.period);
      expect(refX(VIEW_W) + MEADOW.period).toBeLessThan(2 * MEADOW.period);
    }
  });

  it('scrolls every layer left at a speed set by its depth, looping by period', () => {
    expect(scrollAt(0, MEADOW.depth, MEADOW.period)).toBe(0);
    expect(scrollAt(100, MEADOW.depth, MEADOW.period)).toBeCloseTo(72);
    expect(scrollAt(100, HILLS.depth, HILLS.period)).toBeCloseTo(31.5);
    const lap = MEADOW.period / (4.5 * MEADOW.depth);
    expect(scrollAt(lap + 10, MEADOW.depth, MEADOW.period)).toBeCloseTo(
      scrollAt(10, MEADOW.depth, MEADOW.period),
    );
  });

  it('hops the racer over each hurdle and keeps it on the track between them', () => {
    const hops = Array.from({ length: MEADOW.period }, (_, s) => racerHop(s));
    expect(Math.max(...hops)).toBeCloseTo(30, 0);
    expect(hops.filter((h) => h > 0).length).toBe(8 * 51);
    expect(hops.every((h) => h >= 0)).toBe(true);
  });
});
