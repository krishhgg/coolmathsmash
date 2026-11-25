import { describe, expect, it } from 'vitest';
import { stageHitboxesAt } from '../../sim/hazards';
import { stageStateAt } from '../../sim/movingStage';
import { CAMERA_LIMITS, layerRectOnScreen, REF_CAMERA, VIEW_H, VIEW_W } from '../battlefield/art/parallax';
import { stage } from './geometry';
import { PATROLS } from './hazards';
import { createStageView } from './view';

describe("World's Hardest Stage background", () => {
  it.each([CAMERA_LIMITS.minZoom, REF_CAMERA.zoom, CAMERA_LIMITS.maxZoom])(
    'covers the screen at every corner of its camera bounds at %s px/unit',
    (zoom) => {
      const { left, right, bottom, top } = stage.camera;
      const view = createStageView();
      for (const x of [left, right])
        for (const y of [bottom, top]) {
          const camera = { x, y, zoom };
          view.update(120, camera);
          const { minX, minY, maxX, maxY } = view.background.getBounds();
          const rect = layerRectOnScreen(0, camera, { left: minX, top: minY, right: maxX, bottom: maxY });
          expect(rect).toEqual({ left: 0, top: 0, right: VIEW_W, bottom: VIEW_H });
        }
      view.background.destroy();
      view.world.destroy({ children: true });
    },
  );
});

describe("World's Hardest Stage presentation", () => {
  it('interpolates the visible patrols between their exact sim centers', () => {
    const view = createStageView();
    const frame = 50;
    const alpha = 0.25;
    view.update(frame, REF_CAMERA, { pieces: stageStateAt(stage, frame), hazards: true, alpha });
    const hazards = view.world.getChildByLabel('worlds-hardest-game-hazards')!;
    expect(hazards.visible).toBe(true);
    for (const [index, patrol] of PATROLS.entries()) {
      const [prev] = stageHitboxesAt(patrol, frame - 1);
      const [now] = stageHitboxesAt(patrol, frame);
      const sprite = hazards.getChildByLabel(`blue-patrol-${index}`)!;
      expect(sprite.x).toBeCloseTo(prev!.x + (now!.x - prev!.x) * alpha);
      expect(sprite.y).toBeCloseTo(-(prev!.y + (now!.y - prev!.y) * alpha));
    }
    view.world.destroy({ children: true });
    view.background.destroy();
  });

  it('only draws the patrols in the hazards-on form and the soft platforms in the legal form', () => {
    const view = createStageView();
    const hazards = view.world.getChildByLabel('worlds-hardest-game-hazards')!;
    const platforms = [0, 1].map((i) => view.world.getChildByLabel(`soft-platform-${i}`)!);
    const frame = 50;
    const draw = (hazards: boolean) =>
      view.update(frame, REF_CAMERA, {
        pieces: stageStateAt(stage, frame, undefined, hazards),
        hazards,
        alpha: 1,
      });
    draw(true);
    expect(hazards.visible).toBe(true);
    expect(hazards.children).toHaveLength(PATROLS.length);
    expect(platforms.every((p) => !p.visible)).toBe(true);
    draw(false);
    expect(hazards.visible).toBe(false);
    expect(platforms.every((p) => p.visible)).toBe(true);
    view.world.destroy({ children: true });
    view.background.destroy();
  });
});
