import { Container } from 'pixi.js';
import { createBackground } from './art/background';
import { createIsland } from './art/island';
import type { StageCamera } from './art/parallax';
import { createPlatforms } from './art/platforms';

export type { StageCamera } from './art/parallax';

/**
 * What a stage hands the renderer. `background` is screen space (1280x720) and parallaxes from the camera;
 * `world` is drawn in game units at (x, -y) and is placed by the renderer's world container; `foreground`, when
 * present, is in world units over the fighters. `update` is a pure function of the frame and camera.
 */
export interface StageView {
  background: Container;
  world: Container;
  foreground?: Container;
  update(frame: number, camera: StageCamera): void;
}

/** Coolmath Battlefield: a floating Forest Temple island under the Coolmath planet. */
export function createStageView(): StageView {
  const background = createBackground();
  const island = createIsland();
  const platforms = createPlatforms();
  const world = new Container({ label: 'battlefield-world' });
  world.addChild(island.container, platforms.container);
  return {
    background: background.container,
    world,
    update(frame, camera) {
      background.update(frame, camera);
      island.update(frame);
      platforms.update(frame);
    },
  };
}
