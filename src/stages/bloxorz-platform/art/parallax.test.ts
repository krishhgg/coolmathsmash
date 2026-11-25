import { describe, expect, it } from 'vitest';
import {
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  VIEW_H,
  VIEW_W,
} from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { SKY_BOUNDS, SKY_DEPTH, VEIL_BOUNDS, VEIL_DEPTH } from './background';
import { BRIDGE_REAR, BRIDGE_THICKNESS, DECK_REAR, drawBank, drawBridge } from './playfield';

describe('Bloxorz Board parallax', () => {
  it('keeps the fixed void and lower smoke coverage at the stage camera corners', () => {
    const { left, right, bottom, top } = stage.camera;
    const cameras = [
      REF_CAMERA,
      ...[2.5, REF_CAMERA.zoom, 9].flatMap((zoom) =>
        [left, right].flatMap((x) => [bottom, top].map((y) => ({ x, y, zoom }))),
      ),
    ];
    for (const camera of cameras) {
      expect(layerTransform(SKY_DEPTH, camera)).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2, scale: 1 });
      const sky = layerRectOnScreen(SKY_DEPTH, camera, SKY_BOUNDS);
      const veil = layerRectOnScreen(VEIL_DEPTH, camera, VEIL_BOUNDS);
      for (const r of [sky, veil]) {
        expect(r.left).toBeLessThan(0);
        expect(r.right).toBeGreaterThan(VIEW_W);
        expect(r.bottom).toBeGreaterThan(VIEW_H);
      }
      expect(sky.top).toBeLessThan(0);
      expect(veil.top).toBeLessThan(VIEW_H);
    }
  });
});

describe('Bloxorz Board collision silhouettes', () => {
  it('follows both hulls, with shallow rear planes wholly outside the goal opening', () => {
    const banks = stage.solids.map(drawBank).sort((a, b) => a.bounds.minX - b.bounds.minX);
    expect(banks.map(({ bounds: b }) => [b.minX, b.maxX, b.minY, b.maxY])).toEqual([
      [-88, -8, -DECK_REAR, 22],
      [8, 88, -DECK_REAR, 22],
    ]);
    for (const g of banks) {
      for (const x of [g.bounds.minX + 0.1, g.bounds.maxX - 0.1]) {
        expect(g.containsPoint({ x, y: 0.1 })).toBe(true);
        expect(g.containsPoint({ x, y: 21.9 })).toBe(true);
      }
      for (const x of [-7.99, 0, 7.99]) {
        for (const y of [-DECK_REAR / 2, 0, 11, 21.9]) expect(g.containsPoint({ x, y })).toBe(false);
      }
    }
    expect(stage.ledges.map(({ x, y }) => [x, y])).toEqual([
      [-88, 0],
      [88, 0],
    ]);
  });

  it('starts each painted bridge front exactly at the soft platform height', () => {
    expect(stage.platforms.map(({ x1, x2, y }) => [x1, x2, y])).toEqual([
      [-66, -34, 26],
      [34, 66, 26],
    ]);
    for (const p of stage.platforms) {
      const g = drawBridge(p);
      expect(g.bounds.minX).toBe(p.x1);
      expect(g.bounds.maxX).toBe(p.x2);
      expect(g.bounds.maxY).toBeCloseTo(-p.y + BRIDGE_THICKNESS);
      expect(g.bounds.minY).toBe(-p.y - BRIDGE_REAR);
      for (const x of [p.x1 + 0.1, p.x2 - 0.1]) expect(g.containsPoint({ x, y: -p.y + 0.1 })).toBe(true);
    }
  });
});
