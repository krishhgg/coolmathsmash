import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createPlayfield } from './art/playfield';

export function createStageView(): StageView {
  const background = createBackground();
  const playfield = createPlayfield();
  return {
    background: background.container,
    world: playfield.container,
    drawsStagePieces: true,
    update(frame, camera, pose) {
      background.update(frame, camera);
      playfield.update(frame, pose);
    },
  };
}
