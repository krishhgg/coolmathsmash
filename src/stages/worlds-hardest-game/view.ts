import { Container, Graphics } from 'pixi.js';
import { type StageCamera, VIEW_H, VIEW_W } from '../battlefield/art/parallax';
import type { StageView, StageViewFrame } from '../battlefield/view';
import { createHazards } from './art/hazards';
import { createPlayfield } from './art/playfield';

export function createStageView() {
  const background = new Graphics({ label: 'worlds-hardest-game-lavender' })
    .rect(0, 0, VIEW_W, VIEW_H)
    .fill(0xaea6ed);
  const { deck, platforms } = createPlayfield();
  const hazards = createHazards();
  const world = new Container({ label: 'worlds-hardest-game-world' });
  world.addChild(deck, ...platforms, hazards.container);
  return {
    background,
    world,
    drawsStagePieces: true,
    update(frame: number, _camera: StageCamera, stageFrame?: StageViewFrame) {
      for (const [index, platform] of platforms.entries())
        platform.visible = stageFrame?.pieces.platforms[index]?.on ?? true;
      hazards.update(frame, stageFrame?.alpha ?? 1, stageFrame?.hazards ?? false);
    },
  } satisfies StageView;
}
