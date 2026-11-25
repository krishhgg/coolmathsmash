import { Container } from 'pixi.js';
import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createConveyor, createToppingPlatforms } from './art/playfield';

export function createStageView(): StageView {
  const background = createBackground();
  const world = new Container({ label: 'pizzeria-world' });
  world.addChild(createConveyor(), createToppingPlatforms());
  return {
    background: background.container,
    world,
    update(frame, camera) {
      background.update(frame, camera);
    },
  };
}
