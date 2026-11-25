import { Container } from 'pixi.js';
import type { StageMatch, StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createCarrier } from './art/carrier';
import { createHauler } from './art/hauler';
import { createRoad } from './art/road';
import { stage } from './geometry';
import { haulerPoses } from './traffic';

/**
 * Truck Convoy: the car carrier the fight is on, the two haulers in the far lane whose upper decks are the soft
 * platforms, and the highway sliding by underneath. The view draws the haulers where the match has them, so the
 * renderer skips its placeholder pieces; without a match (the stage lab) it shows them as hazards-on traffic.
 */
export function createStageView(): StageView {
  const background = createBackground();
  const road = createRoad();
  const haulers = stage.platforms.map((_, i) => createHauler(i));
  const carrier = createCarrier();
  const world = new Container({ label: 'truck-convoy' });
  world.addChild(road.container, ...haulers.map((h) => h.container), carrier.container);
  return {
    background: background.container,
    world,
    drawsPieces: true,
    update(frame, camera, match?: StageMatch) {
      background.update(frame, camera);
      road.update(frame);
      carrier.update(frame);
      haulerPoses(frame, match).forEach((pose, i) => haulers[i]!.update(frame, pose.x, pose.y, pose.braking));
    },
  };
}
