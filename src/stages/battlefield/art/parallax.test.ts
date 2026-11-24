import { describe, expect, it } from 'vitest';
import { MAIN_HULL, SOFT_PLATFORMS, SOFT_THICKNESS, hullHalfWidth } from './outline';
import {
  extremeCameras,
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  SEA_LAYER,
  VIEW_H,
  VIEW_W,
  wrap,
} from './parallax';

describe('stage art outline', () => {
  it('matches Battlefield collision geometry exactly', () => {
    expect(MAIN_HULL).toEqual([
      [-80, 0],
      [80, 0],
      [80, -8.3],
      [64.4, -25.1],
      [41.4, -40.1],
      [-41.4, -40.1],
      [-64.4, -25.1],
      [-80, -8.3],
    ]);
    expect(SOFT_PLATFORMS).toEqual([
      { left: -59.42, right: -24.79, y: 24.12 },
      { left: -17.32, right: 17.32, y: 47.19 },
      { left: 24.79, right: 59.42, y: 24.12 },
    ]);
    expect(SOFT_THICKNESS).toBeCloseTo(2);
  });

  it('interpolates the hull width along the walls and slopes', () => {
    expect(hullHalfWidth(0)).toBe(80);
    expect(hullHalfWidth(-8.3)).toBe(80);
    expect(hullHalfWidth(-25.1)).toBeCloseTo(64.4);
    expect(hullHalfWidth(-40.1)).toBeCloseTo(41.4);
    expect(hullHalfWidth(-16.7)).toBeCloseTo((80 + 64.4) / 2);
  });
});

describe('parallax', () => {
  it('depth 1 moves exactly like the world', () => {
    const cam = { x: 37, y: -12, zoom: 7.25 };
    const t = layerTransform(1, cam);
    const worldPoint = { x: 15, y: 30 };
    const refScreen = {
      x: VIEW_W / 2 + (worldPoint.x - REF_CAMERA.x) * REF_CAMERA.zoom,
      y: VIEW_H / 2 - (worldPoint.y - REF_CAMERA.y) * REF_CAMERA.zoom,
    };
    expect(t.x + (refScreen.x - VIEW_W / 2) * t.scale).toBeCloseTo(
      VIEW_W / 2 + (worldPoint.x - cam.x) * cam.zoom,
    );
    expect(t.y + (refScreen.y - VIEW_H / 2) * t.scale).toBeCloseTo(
      VIEW_H / 2 - (worldPoint.y - cam.y) * cam.zoom,
    );
  });

  it('depth 0 never moves', () => {
    for (const cam of extremeCameras())
      expect(layerTransform(0, cam)).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2, scale: 1 });
  });

  it('the cloud sea covers the screen below the horizon at every camera inside the bounds', () => {
    for (const cam of extremeCameras()) {
      const r = layerRectOnScreen(SEA_LAYER.depth, cam, {
        left: SEA_LAYER.left,
        right: SEA_LAYER.right,
        top: SEA_LAYER.horizon,
        bottom: SEA_LAYER.bottom,
      });
      expect(r.left).toBeLessThan(0);
      expect(r.right).toBeGreaterThan(VIEW_W);
      expect(r.bottom).toBeGreaterThan(VIEW_H);
      expect(r.top).toBeLessThan(VIEW_H);
    }
  });

  it('wraps drifting coordinates into range', () => {
    expect(wrap(-501, -500, 2300)).toBeCloseTo(1799);
    expect(wrap(1800, -500, 2300)).toBeCloseTo(-500);
    expect(wrap(100, -500, 2300)).toBe(100);
  });
});
