import { Graphics } from 'pixi.js';
import { VIEW_H, VIEW_W } from '../battlefield/art/parallax';
import type { StageView } from '../battlefield/view';
import { createPlayfield } from './art/playfield';

export function createStageView(): StageView {
  const background = new Graphics({ label: 'worlds-hardest-game-lavender' })
    .rect(0, 0, VIEW_W, VIEW_H)
    .fill(0xaea6ed);
  return { background, world: createPlayfield(), update() {} };
}
