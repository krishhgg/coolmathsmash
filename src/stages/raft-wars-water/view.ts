import { Container } from 'pixi.js';
import type { StageView } from '../battlefield/view';
import { createBoat } from './art/boat';
import { createLagoon } from './art/lagoon';
import { createShores } from './art/shores';

export function createStageView(): StageView {
  const lagoon = createLagoon();
  const world = new Container({ label: 'raft-war-lagoon' });
  world.addChild(createShores(), createBoat());
  return {
    background: lagoon.container,
    world,
    update(_frame, camera) {
      lagoon.update(camera);
    },
  };
}
