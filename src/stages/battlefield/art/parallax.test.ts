import { describe, expect, it } from 'vitest';
import { stage } from '../geometry';
import {
  CAP_BOTTOM,
  HULL_BOTTOM,
  MAIN_HULL,
  SOFT_PLATFORMS,
  SOFT_THICKNESS,
  TOP_Y,
  UNDERSIDE,
  hullSpan,
} from './outline';
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
  it('is drawn from the collision geometry', () => {
    expect(MAIN_HULL).toBe(stage.solids[0]!.points);
    expect(SOFT_PLATFORMS).toEqual(stage.platforms.map((p) => ({ left: p.x1, right: p.x2, y: p.y })));
    expect(SOFT_THICKNESS).toBeCloseTo(2);
    expect(TOP_Y).toBe(0);
    expect(CAP_BOTTOM).toBeCloseTo(-8.32);
    expect(HULL_BOTTOM).toBeCloseTo(-40.12);
  });

  it('finds the solid span along the walls and slopes', () => {
    expect(hullSpan(0)).toEqual([-80, 80]);
    expect(hullSpan(CAP_BOTTOM)).toEqual([-80, 80]);
    const [l, r] = hullSpan(-25.1);
    expect(l).toBeCloseTo(-64.38, 1);
    expect(r).toBeCloseTo(64.39, 1);
    expect(hullSpan(HULL_BOTTOM)[1]).toBeCloseTo(41.42, 1);
    expect(UNDERSIDE.every(([, y]) => y <= CAP_BOTTOM)).toBe(true);
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
