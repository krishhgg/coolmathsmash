import { Container } from 'pixi.js';
import type { PieceState } from '../../sim/movingStage';
import type { StageView } from '../battlefield/view';
import { createBoat } from './art/boat';
import { createLagoon, createWaterline, WATER_Y } from './art/lagoon';
import { createShores } from './art/shores';
import { BOAT_SOLID, CABIN_PLATFORM, stage } from './geometry';
import { tideHeight } from './tide';

function offset(piece: Readonly<PieceState>, alpha: number): [number, number] {
  return [piece.x - piece.dx * (1 - alpha), piece.y - piece.dy * (1 - alpha)];
}

export function createStageView(): StageView {
  const lagoon = createLagoon();
  const { hull, canopy } = createBoat();
  const waterlines = stage.solids.map(({ points }) => createWaterline(points));
  const world = new Container({ label: 'raft-war-lagoon' });
  world.addChild(createShores(), canopy, hull, ...waterlines.map(({ graphics }) => graphics));
  return {
    background: lagoon.container,
    world,
    drawsStagePieces: true,
    update(frame, camera, { pieces, hazards, alpha }) {
      const [boatX, boatY] = offset(pieces.solids[BOAT_SOLID]!, alpha);
      const [roofX, roofY] = offset(pieces.platforms[CABIN_PLATFORM]!, alpha);
      hull.position.set(boatX, -boatY);
      canopy.position.set(roofX, -roofY);
      const rise = hazards ? tideHeight(frame - 1) * (1 - alpha) + tideHeight(frame) * alpha : 0;
      lagoon.update(camera, rise);
      for (const [index, line] of waterlines.entries())
        line.update(WATER_Y + rise, index === BOAT_SOLID ? boatX : 0, index === BOAT_SOLID ? boatY : 0);
    },
  };
}
