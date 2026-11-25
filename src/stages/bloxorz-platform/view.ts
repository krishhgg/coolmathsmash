import { Container } from 'pixi.js';
import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { drawBank, drawBridge, drawGoalRecess } from './art/playfield';
import { stage } from './geometry';

export function createStageView(): StageView {
  const background = createBackground();
  const world = new Container({ label: 'bloxorz-board-world' });
  const goalShadow = drawGoalRecess();
  const banks = stage.solids.map(drawBank);
  world.addChild(goalShadow, ...banks, ...stage.platforms.map(drawBridge));
  return {
    background: background.container,
    world,
    drawsStagePieces: true,
    update(frame, camera, context) {
      background.update(frame, camera);
      banks.forEach((bank, i) => (bank.visible = context?.pieces.solids[i]?.on ?? i < 2));
      goalShadow.visible = !banks[2]!.visible;
    },
  };
}
