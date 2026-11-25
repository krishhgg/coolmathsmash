import { Container } from 'pixi.js';
import type { PieceState } from '../../sim/movingStage';
import { createBackground } from './art/background';
import { createIsland } from './art/island';
import type { StageCamera } from './art/parallax';
import { createPlatforms } from './art/platforms';

export type { StageCamera } from './art/parallax';

export interface StageViewFrame {
  readonly pieces: {
    readonly solids: readonly Readonly<PieceState>[];
    readonly platforms: readonly Readonly<PieceState>[];
  };
  readonly hazards: boolean;
  readonly alpha: number;
}

/**
 * What a stage hands the renderer. `background` is screen space (1280x720) and parallaxes from the camera;
 * `world` is drawn in game units at (x, -y) and is placed by the renderer's world container; `foreground`, when
 * present, is in world units over the fighters.
 */
export interface StageView {
  background: Container;
  world: Container;
  foreground?: Container;
  /** This view draws moving pieces and hazards instead of the generic shapes. */
  drawsStagePieces?: boolean;
  update(frame: number, camera: StageCamera, pose: StageViewFrame): void;
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
