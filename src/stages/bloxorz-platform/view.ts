import { Container } from 'pixi.js';
import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { drawBank, drawBridge, drawGoalRecess } from './art/playfield';
import { stage } from './geometry';

export function createStageView(): StageView {
  const background = createBackground();
  const world = new Container({ label: 'bloxorz-board-world' });
  world.addChild(drawGoalRecess(), ...stage.solids.map(drawBank), ...stage.platforms.map(drawBridge));
  return {
    background: background.container,
    world,
    update(frame, camera) {
      background.update(frame, camera);
    },
  };
}
