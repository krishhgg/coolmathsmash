import { Polygon, type Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../../battlefield/art/parallax';
import { stage } from '../geometry';
import { motionOffset, stageStateAt } from '../../../sim/movingStage';
import { ONION_ENTRY, ONION_WARNING, rollingOnion } from '../hazards';
import { createStageView } from '../view';
import { ROOM_LAYER } from './background';

describe("Papa's Pizzeria art", () => {
  it('keeps the tiled room and counter covering the viewport at the stage camera extrema', () => {
    const { left, right, bottom, top } = stage.camera;
    expect([left, right, bottom, top]).toEqual([-160, 160, -80, 130]);
    for (const zoom of [2.5, 4, REF_CAMERA.zoom, 6, 7.5, 9])
      for (const x of [left, right])
        for (const y of [bottom, top]) {
          const bounds = layerRectOnScreen(ROOM_LAYER.depth, { x, y, zoom }, ROOM_LAYER);
          expect(bounds.left).toBeLessThan(0);
          expect(bounds.right).toBeGreaterThan(VIEW_W);
          expect(bounds.top).toBeLessThan(0);
          expect(bounds.bottom).toBeGreaterThan(VIEW_H);
        }
  });

  it('pans and zooms the tile layer while leaving the full-screen base fixed', () => {
    const view = createStageView();
    const [base, room] = view.background.children;
    const { minX, minY, maxX, maxY } = base!.getLocalBounds();
    expect(minX).toBeLessThan(0);
    expect(minY).toBeLessThan(0);
    expect(maxX).toBeGreaterThan(VIEW_W);
    expect(maxY).toBeGreaterThan(VIEW_H);

    const camera = { x: stage.camera.right, y: stage.camera.top, zoom: 9 };
    view.update(40, camera);
    expect([base!.x, base!.y, base!.scale.x, base!.scale.y]).toEqual([0, 0, 1, 1]);
    const bounds = layerRectOnScreen(ROOM_LAYER.depth, camera, ROOM_LAYER);
    const layer = room!;
    expect(layer.x + (ROOM_LAYER.left - layer.pivot.x) * layer.scale.x).toBeCloseTo(bounds.left);
    expect(layer.y + (ROOM_LAYER.bottom - layer.pivot.y) * layer.scale.y).toBeCloseTo(bounds.bottom);
  });

  it('draws the wood-and-steel hull on the collision polygon all the way out to the ledges', () => {
    const { world } = createStageView();
    const conveyor = world.getChildByLabel('pizza-peel-conveyor', true) as Graphics;
    const points = conveyor.context.instructions.flatMap((instruction) => {
      if (instruction.action !== 'stroke') return [];
      return instruction.data.path.shapePath.shapePrimitives.flatMap(({ shape }) => {
        if (!(shape instanceof Polygon) || shape.points.length !== stage.solids[0]!.points.length * 2)
          return [];
        return [shape.points];
      });
    });
    const expected = stage.solids[0]!.points.flatMap(([x, y]) => [x - conveyor.x, -y - conveyor.y]);
    expect(points.some((p) => p.every((v, i) => v === expected[i]))).toBe(true);
    const top = stage.solids[0]!.points.filter(([, y]) => y === 0);
    expect(top).toEqual(stage.ledges.map(({ x, y }) => [x, y]));
  });

  it('places each topping’s flat inked edge on its drop-through segment', () => {
    const { world } = createStageView();
    const platforms = world.getChildByLabel('topping-platforms')!.children;
    expect(platforms).toHaveLength(stage.platforms.length);
    for (const [i, { x1, x2, y }] of stage.platforms.entries()) {
      const art = platforms[i] as Graphics;
      expect(art.x).toBe(x1);
      expect(art.y).toBe(-y);
      const surfaces = art.context.instructions.flatMap((instruction) => {
        if (instruction.action !== 'stroke') return [];
        const [start, end] = instruction.data.path.instructions;
        return start?.action === 'moveTo' && end?.action === 'lineTo' ? [[start.data, end.data]] : [];
      });
      expect(surfaces).toContainEqual([
        [0, 0],
        [x2 - x1, 0],
      ]);
    }
  });

  it('poses oven steam from the frame even after a rewind', () => {
    const view = createStageView();
    const oven = view.background.getChildByLabel('oven-and-hanging-tools', true)!;
    const pose = () => oven.children.map(({ x, y, alpha, scale }) => [x, y, alpha, scale.x]);
    view.update(33, REF_CAMERA);
    const first = pose();
    view.update(181, REF_CAMERA);
    expect(pose()).not.toEqual(first);
    view.update(33, REF_CAMERA);
    expect(pose()).toEqual(first);
  });

  it('starts the warning before the onion and hides both with hazards off', () => {
    const view = createStageView();
    const warning = view.world.getChildByLabel('onion-entry-warning', true)!;
    const onion = view.world.getChildByLabel('rolling-onion', true)!;
    const belt = view.world.getChildByLabel('conveyor-tread', true)!;
    const pose = (frame: number, hazards: boolean) =>
      view.update(frame, REF_CAMERA, {
        pieces: stageStateAt(stage, frame, undefined, hazards),
        hazards,
        alpha: 1,
      });
    pose(ONION_WARNING, true);
    expect(warning.visible).toBe(true);
    expect(onion.visible).toBe(false);
    const movingAt = ONION_ENTRY + 23;
    pose(movingAt, true);
    const [dx, dy] = motionOffset(rollingOnion.motion, movingAt);
    expect(warning.visible).toBe(false);
    expect(onion.visible).toBe(true);
    expect(onion.x).toBeCloseTo(rollingOnion.x + dx);
    expect(onion.y).toBeCloseTo(-(rollingOnion.y + dy));
    expect(belt.x).not.toBe(0);
    for (const frame of [movingAt, ONION_WARNING]) {
      pose(frame, false);
      expect(warning.visible).toBe(false);
      expect(onion.visible).toBe(false);
      expect(belt.x).toBe(0);
    }
  });
});
