import { Container } from 'pixi.js';
import type { StageState } from '../../sim/movingStage';
import { createBackground } from './art/background';
import { createIsland } from './art/island';
import type { StageCamera } from './art/parallax';
import { createPlatforms } from './art/platforms';

export type { StageCamera } from './art/parallax';

/** The match as a view that draws its own moving pieces sees it: where every piece is, hazards and interpolation. */
export interface StageMatch {
  pieces: StageState;
  hazards: boolean;
  /** Between the previous (0) and current (1) simulated frame, as the renderer draws fighters. */
  alpha: number;
}

/**
 * What a stage hands the renderer. `background` is screen space (1280x720) and parallaxes from the camera;
 * `world` is drawn in game units at (x, -y) and is placed by the renderer's world container; `foreground`, when
 * present, is in world units over the fighters. `update` is a pure function of the frame and camera.
 */
export interface StageView {
  background: Container;
  world: Container;
  foreground?: Container;
  /** The view draws the stage's moving pieces from `match`, so the renderer skips its placeholder shapes. */
  drawsPieces?: boolean;
  update(frame: number, camera: StageCamera, match?: StageMatch): void;
}

/** Coolmath Battlefield: a floating temple island under the Coolmath planet. */
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
