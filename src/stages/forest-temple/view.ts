import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createPlayfield } from './art/playfield';
import { createPool } from './art/pool';

export function createStageView(): StageView & { drawsStagePieces: boolean } {
  const background = createBackground();
  const world = createPlayfield();
  const pool = createPool();
  world.addChild(pool.container);
  return {
    background: background.container,
    world,
    drawsStagePieces: true,
    update(frame, camera, context?: { hazards: boolean }) {
      background.update(camera);
      pool.update(frame, context?.hazards ?? true);
    },
  };
}
