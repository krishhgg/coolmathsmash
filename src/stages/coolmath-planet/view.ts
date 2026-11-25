import { createBackground } from './art/background';
import { createRing } from './art/ring';
import type { StageView } from '../battlefield/view';

export function createStageView(): StageView {
  const sky = createBackground();
  return {
    background: sky.container,
    world: createRing(),
    update(frame, camera) {
      sky.update(frame, camera);
    },
  };
}
