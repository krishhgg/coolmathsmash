import { Container } from 'pixi.js';
import type { StageState } from '../../sim/movingStage';
import type { StageCamera, StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createConvoy } from './art/convoy';
import { createPlayfield } from './art/playfield';
import { hazardStage } from './hazardGeometry';

interface ConvoyView extends StageView {
  drawsStagePieces: true;
  update(
    frame: number,
    camera: StageCamera,
    context?: { pieces: StageState; hazards: boolean; alpha: number },
  ): void;
}

export function createStageView(): ConvoyView {
  const background = createBackground();
  const world = new Container({ label: 'truck-convoy' });
  const still = createPlayfield();
  const convoy = createConvoy();
  convoy.container.visible = false;
  world.addChild(still, convoy.container);
  return {
    background: background.container,
    world,
    drawsStagePieces: true,
    update(frame, camera, context) {
      const moving = context?.hazards === true && context.pieces.solids.length === hazardStage.solids.length;
      background.update(camera, moving);
      still.visible = !moving;
      convoy.container.visible = moving;
      if (moving) convoy.update(frame, context.pieces, context.alpha);
    },
  };
}
