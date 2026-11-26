import { Polygon, Rectangle, type Graphics } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import {
  CAMERA_LIMITS,
  layerRectOnScreen,
  layerTransform,
  REF_CAMERA,
  VIEW_H,
  VIEW_W,
} from '../battlefield/art/parallax';
import { stageStateAt } from '../../sim/movingStage';
import type * as Util from '../battlefield/art/util';
import { SEA } from './art/background';
import { PLANK_DEPTH, LOG_RADIUS } from './art/raft';
import { LAGOON } from './art/water';
import { RAFT, stage, WATER_Y } from './geometry';
import { createStageView } from './view';

/**
 * Pixi paints a gradient onto a canvas, which the node test environment has no document for. These tests check
 * shapes and transforms, so gradients become a flat colour here.
 */
vi.mock('../battlefield/art/util', async (importOriginal) => ({
  ...(await importOriginal<typeof Util>()),
  vGradient: () => 0x808080,
}));

const ZOOMS = [CAMERA_LIMITS.minZoom, REF_CAMERA.zoom, CAMERA_LIMITS.maxZoom];

function cameras() {
  const { left, right, bottom, top } = stage.camera;
  return ZOOMS.flatMap((zoom) =>
    [left, 0, right].flatMap((x) => [bottom, REF_CAMERA.y, top].map((y) => ({ x, y, zoom }))),
  );
}

/** Shapes a Graphics strokes, in its local space. */
function stroked(g: Graphics) {
  return g.context.instructions.flatMap((instruction) =>
    instruction.action === 'stroke'
      ? instruction.data.path.shapePath.shapePrimitives.map(({ shape }) => shape)
      : [],
  );
}

describe('Raft War Lagoon backdrop', () => {
  it('keeps the sky on the screen and the sea under the horizon past every edge at every camera', () => {
    for (const camera of cameras()) {
      expect(layerTransform(0, camera)).toEqual({ x: VIEW_W / 2, y: VIEW_H / 2, scale: 1 });
      const sea = layerRectOnScreen(SEA.depth, camera, { ...SEA, top: SEA.horizon });
      expect(sea.left).toBeLessThan(0);
      expect(sea.right).toBeGreaterThan(VIEW_W);
      expect(sea.bottom).toBeGreaterThan(VIEW_H);
    }
  });

  it('fills everything under the surface with water, down past the bottom blast zone, at every camera', () => {
    expect(LAGOON.top).toBe(-WATER_Y);
    expect(LAGOON.top).toBeGreaterThan(PLANK_DEPTH);
    expect(LAGOON.top).toBeLessThan(PLANK_DEPTH + LOG_RADIUS * 2);
    expect(LAGOON.bottom).toBeGreaterThan(-stage.blastZones.bottom);
    expect(LAGOON.left).toBeLessThan(stage.blastZones.left);
    expect(LAGOON.right).toBeGreaterThan(stage.blastZones.right);
    for (const camera of cameras()) {
      expect(LAGOON.left).toBeLessThan(camera.x - VIEW_W / 2 / camera.zoom);
      expect(LAGOON.right).toBeGreaterThan(camera.x + VIEW_W / 2 / camera.zoom);
      expect(LAGOON.bottom).toBeGreaterThan(-(camera.y - VIEW_H / 2 / camera.zoom));
    }
  });
});

describe('Raft War Lagoon raft art', () => {
  it('outlines the hull on the collision polygon, out to both ledges', () => {
    const { world } = createStageView();
    const hull = world.getChildByLabel('raft-hull', true) as Graphics;
    const expected = stage.solids[0]!.points.flatMap(([x, y]) => [x, -y]);
    const outlines = stroked(hull).filter((s): s is Polygon => s instanceof Polygon);
    expect(outlines.some((p) => p.points.every((v, i) => v === expected[i]))).toBe(true);
    expect(stage.solids[0]!.points.filter(([, y]) => y === RAFT.deck)).toEqual(
      stage.ledges.map(({ x, y }) => [x, y]),
    );
  });

  it("inks each deck and the crow's nest with its top edge on the drop-through surface", () => {
    const { world } = createStageView();
    const slabs = [
      ...world.getChildrenByLabel('lookout-deck', true),
      world.getChildByLabel('mast-and-nest', true)!,
    ] as Graphics[];
    expect(slabs).toHaveLength(stage.platforms.length);
    for (const [i, { x1, x2, y }] of stage.platforms.entries()) {
      const rects = stroked(slabs[i]!).filter((s): s is Rectangle => s instanceof Rectangle);
      expect(rects).toContainEqual(expect.objectContaining({ x: x1, y: -y, width: x2 - x1 }));
    }
  });

  it('rides the swell with solid 0, interpolated between frames', () => {
    const view = createStageView();
    const raft = view.world.getChildByLabel('raft', true)!;
    view.pieces!(stageStateAt(stage, 0), 1);
    expect(raft.x).toBe(0);
    expect(raft.y).toBeCloseTo(0, 9);
    const prev = stageStateAt(stage, 149);
    const now = stageStateAt(stage, 150, prev);
    view.pieces!(now, 0);
    expect(raft.y).toBeCloseTo(-prev.solids[0]!.y, 9);
    view.pieces!(now, 1);
    expect(raft.y).toBeCloseTo(-1.6, 9);
    const still = stageStateAt(stage, 150, undefined, false);
    view.pieces!(still, 1);
    expect(raft.y).toBeCloseTo(0, 9);
  });

  it('poses the flag, water and sky from the frame alone, even after a rewind', () => {
    const view = createStageView();
    const pose = () => [
      ...view.background.children.flatMap((l) =>
        l.children.map(({ x, y, scale }) => [x, y, scale.x, scale.y]),
      ),
      ...view.foreground!.children.map(({ x, alpha }) => [x, alpha]),
      (view.world.getChildByLabel('flag', true) as Graphics).bounds.maxX,
    ];
    view.update(57, REF_CAMERA);
    const first = pose();
    view.update(311, { x: 40, y: 60, zoom: 6 });
    expect(pose()).not.toEqual(first);
    view.update(57, REF_CAMERA);
    expect(pose()).toEqual(first);
  });
});
