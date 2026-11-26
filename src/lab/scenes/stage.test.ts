import { Container, type Application, type Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { MAX_ZOOM } from '../../render/camera';
import { placeholderStage } from '../../render/placeholderStage';
import { STAGES } from '../../stages/registry';
import { scene } from './stage';

/** Stages with no src/stages/<id>/view.ts, which the game draws with placeholderStage (src/render/renderer.ts). */
const withArt = Object.keys(import.meta.glob('../../stages/*/view.ts')).map((path) => path.split('/')[3]);
const artless = Object.values(STAGES).filter((stage) => !withArt.includes(stage.id));

function mount(query: string): Container {
  const app = { stage: new Container(), ticker: { add() {} } } as unknown as Application;
  void scene.mount(app, new URLSearchParams(query));
  return app.stage.getChildByLabel('world-root')!;
}

/** Every fill and stroke in a drawing, child by child in draw order: its colour, alpha and the shapes it paints. */
function paint(root: Container) {
  return root.children.map((child) => ({
    label: child.label,
    instructions: (child as Graphics).context.instructions.map((i) => {
      if (i.action === 'texture') throw new Error('paint: textures are not compared');
      const { color, alpha } = i.data.style;
      return {
        action: i.action,
        color,
        alpha,
        shapes: i.data.path.shapePath.shapePrimitives.map((p) => p.shape),
      };
    }),
  }));
}

describe('stage lab scene', () => {
  it('has artless stages to compare', () => {
    expect(artless.map((stage) => stage.id)).toContain('forest-temple');
  });

  it.each(artless.map((stage) => [stage.id, stage] as const))('draws %s as the game does', (id, stage) => {
    const world = mount(`stage=${id}`).children[0]!;
    expect(paint(world)).toEqual(paint(placeholderStage(stage)));
  });

  it("stops ?zoom= at the game camera's closest zoom", () => {
    expect(mount('stage=forest-temple&zoom=9').scale.x).toBe(MAX_ZOOM);
    expect(mount('stage=forest-temple&zoom=3').scale.x).toBe(3);
  });

  it("stops the camera api at the game camera's closest zoom", () => {
    const root = mount('stage=forest-temple');
    const camera = scene.api!.camera as (x: number, y: number, zoom: number) => void;
    camera(0, 0, 9);
    expect(root.scale.x).toBe(MAX_ZOOM);
    camera(0, 0, 2.5);
    expect(root.scale.x).toBe(2.5);
  });
});
