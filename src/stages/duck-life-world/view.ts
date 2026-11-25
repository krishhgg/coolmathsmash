import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createPlayfield } from './art/playfield';

export function createStageView(): StageView {
  const background = createBackground();
  return {
    background: background.container,
    world: createPlayfield(),
    update(frame, camera) {
      background.update(frame, camera);
    },
  };
}
