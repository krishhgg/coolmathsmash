import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages/registry';
import { stage as forestTemple } from '../stages/forest-temple/geometry';
import { placeholderStage } from './placeholderStage';
import { drawnTopAt, floorTopAt, surfaceMismatches } from './surface';

const solidsOf = (view: ReturnType<typeof placeholderStage>) => view.getChildByLabel('solids') as Graphics;

describe('placeholder stage drawing', () => {
  it.each(Object.values(STAGES).map((stage) => [stage.id, stage] as const))(
    'draws the top of %s exactly on its collision floor',
    (_, stage) => {
      expect(surfaceMismatches(stage, solidsOf(placeholderStage(stage)))).toEqual([]);
    },
  );

  it.each([
    [-40, 0],
    [-12, 0],
    [-8.5, -3],
    [-5, -6],
    [0, -6],
    [5, -6],
    [8.5, -3],
    [12, 0],
    [40, 0],
  ])('follows the Forest Temple dip: the grass at x=%d is at y=%d', (x, y) => {
    expect(floorTopAt(forestTemple, x)).toBeCloseTo(y);
    expect(drawnTopAt(solidsOf(placeholderStage(forestTemple)), x)).toBeCloseTo(y);
  });

  it('flags grass drawn flat across the Forest Temple dip', () => {
    const flat = new Graphics();
    flat.poly(forestTemple.solids[0]!.points.flatMap(([x, y]) => [x, -y])).fill('#7a5230');
    flat.rect(-85, 0, 170, 3).fill('#3d8f3a');
    const misses = surfaceMismatches(forestTemple, flat);
    expect(misses.map((m) => m.x)).toEqual(Array.from({ length: 95 }, (_, i) => -11.75 + i * 0.25));
    expect(misses.find((m) => m.x === 0)).toEqual({ x: 0, floor: -6, drawn: 0 });
  });

  it('keeps drop-through platforms out of the solids it checks', () => {
    const view = placeholderStage(forestTemple);
    const platforms = view.getChildByLabel('platforms') as Graphics;
    expect(platforms.context.instructions).toHaveLength(forestTemple.platforms.length);
    expect(drawnTopAt(solidsOf(view), 0)).toBe(-6);
  });
});
