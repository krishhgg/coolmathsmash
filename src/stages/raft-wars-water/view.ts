import { Container } from 'pixi.js';
import { pieceOffset } from '../../render/stagePieces';
import type { StageView } from '../battlefield/view';
import { createBackground } from './art/background';
import { createRaft } from './art/raft';
import { createWater } from './art/water';

/**
 * Raft War Lagoon: the raft floats between the lagoon's body (behind) and its surface (in front), and rides the
 * swell by solid 0's offset, which every platform shares.
 */
export function createStageView(): StageView {
  const background = createBackground();
  const water = createWater();
  const raft = createRaft();
  const world = new Container({ label: 'raft-wars-water-world' });
  world.addChild(water.back, raft.container);
  return {
    background: background.container,
    world,
    foreground: water.front,
    update(frame, camera) {
      background.update(frame, camera);
      water.update(frame);
      raft.update(frame);
    },
    pieces(stage, alpha) {
      const at = pieceOffset(stage.solids[0]!, alpha);
      raft.container.position.set(at.x, -at.y);
    },
  };
}
