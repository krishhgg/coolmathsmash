import { Container } from 'pixi.js';
import type { StageState } from '../../sim/movingStage';
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
  /**
   * For a stage with moving pieces: place their art from the match's piece state (MatchState.stage), `alpha`
   * between the last two frames as the renderer interpolates fighters (stagePieces.ts `pieceOffset`). A view
   * with it draws its own solids and platforms, so the renderer leaves out its placeholder shapes for them.
   */
  pieces?(stage: StageState, alpha: number): void;
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
