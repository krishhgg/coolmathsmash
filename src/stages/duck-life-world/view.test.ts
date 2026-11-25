import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_LIMITS,
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  VIEW_H,
  VIEW_W,
} from '../battlefield/art/parallax';
import { HILLS, MEADOW, racerHop, scrollAt } from './art/background';
import { stage } from './geometry';
import { createStageView } from './view';

const zooms = [CAMERA_LIMITS.minZoom, REF_CAMERA.zoom, CAMERA_LIMITS.maxZoom];

function cameras() {
  const { left, right, bottom, top } = stage.camera;
  return zooms.flatMap((zoom) =>
    [left, REF_CAMERA.x, right].flatMap((x) => [bottom, REF_CAMERA.y, top].map((y) => ({ x, y, zoom }))),
  );
}

/** Every node's transform under `root`, depth first, for comparing two views. */
function transforms(root: Container): number[] {
  const out: number[] = [root.x, root.y, root.scale.x, root.rotation];
  for (const child of root.children) out.push(...transforms(child));
  return out;
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
    expect(scrollAt(lap + 10, MEADOW.depth, MEADOW.period)).toBeCloseTo(scrollAt(10, MEADOW.depth, MEADOW.period));
  });

  it('hops the racer over each hurdle and keeps it on the track between them', () => {
    const hops = Array.from({ length: MEADOW.period }, (_, s) => racerHop(s));
    expect(Math.max(...hops)).toBeCloseTo(30, 0);
    expect(hops.filter((h) => h > 0).length).toBe(8 * 51);
    expect(hops.every((h) => h >= 0)).toBe(true);
  });

  it('draws the same picture for a frame however it got there', () => {
    const camera = { x: 40, y: 10, zoom: 5 };
    const stepped = createStageView();
    for (let frame = 0; frame <= 900; frame++) stepped.update(frame, camera);
    const jumped = createStageView();
    jumped.update(900, camera);
    expect(transforms(jumped.background)).toEqual(transforms(stepped.background));
    for (const view of [stepped, jumped]) {
      view.background.destroy({ children: true });
      view.world.destroy({ children: true });
    }
  });

  it.each(zooms)('covers the whole screen at the camera corners at %s px/unit', (zoom) => {
    const { left, right, bottom, top } = stage.camera;
    const view = createStageView();
    for (const frame of [0, 1234, 4321])
      for (const x of [left, right])
        for (const y of [bottom, top]) {
          const camera = { x, y, zoom };
          view.update(frame, camera);
          const { minX, minY, maxX, maxY } = view.background.getBounds();
          const rect = layerRectOnScreen(0, camera, { left: minX, top: minY, right: maxX, bottom: maxY });
          expect(rect.left).toBeLessThanOrEqual(0);
          expect(rect.top).toBeLessThanOrEqual(0);
          expect(rect.right).toBeGreaterThanOrEqual(VIEW_W);
          expect(rect.bottom).toBeGreaterThanOrEqual(VIEW_H);
        }
    view.background.destroy({ children: true });
    view.world.destroy({ children: true });
  });
});
