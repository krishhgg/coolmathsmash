import { Container } from 'pixi.js';
import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createCarrier } from './art/carrier';
import { createHauler } from './art/hauler';
import { createRoad } from './art/road';
import { stage } from './geometry';
import { haulerPoses } from './traffic';

/**
 * Truck Convoy: the car carrier the fight is on, the two haulers in the far lane whose upper decks are the soft
 * platforms, and the highway sliding by underneath. `pieces` puts the haulers where the match has them, so the
 * renderer leaves out its placeholder platforms.
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
    update(frame, camera) {
      background.update(frame, camera);
      road.update(frame);
      carrier.update(frame);
      for (const h of haulers) h.spin(frame);
    },
    pieces(pieces, alpha) {
      haulerPoses(pieces, alpha).forEach((pose, i) => haulers[i]!.place(pose.x, pose.y, pose.braking));
    },
  };
}
