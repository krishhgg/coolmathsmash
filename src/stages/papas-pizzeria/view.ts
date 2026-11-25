import { Container } from 'pixi.js';
import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createOnion } from './art/onion';
import { createConveyor, createToppingPlatforms } from './art/playfield';

export function createStageView(): StageView {
  const background = createBackground();
  const world = new Container({ label: 'pizzeria-world' });
  const belt = createConveyor();
  const onion = createOnion();
  world.addChild(belt.shape, createToppingPlatforms(), onion.container);
  return {
    background: background.container,
    world,
    drawsStagePieces: true,
    update(frame, camera, context) {
      background.update(frame, camera);
      const { hazards = true, alpha = 1 } = context ?? {};
      belt.update(Math.max(0, frame - 1 + alpha), hazards);
      onion.update(frame, hazards, alpha);
    },
  };
}
