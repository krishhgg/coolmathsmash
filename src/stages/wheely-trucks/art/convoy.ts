import { Container, Graphics } from 'pixi.js';
import type { PieceState, StageState } from '../../../sim/movingStage';
import { wrap } from '../../battlefield/art/parallax';
import { vGradient } from '../../battlefield/art/util';
import { hazardStage, isBraking, ROAD, TRUCK_SCALE } from '../hazardGeometry';
import { stage } from '../geometry';
import { createPlatform, createTruck } from './playfield';

export function createConvoy() {
  const container = new Container({ label: 'moving-convoy' });
  const pavement = new Graphics({ label: 'road-conveyor' });
  const stripes = new Graphics({ label: 'traffic-markings' });
  const roadTop = -ROAD.y;
  const roadWidth = ROAD.right - ROAD.left;
  pavement.rect(ROAD.left, roadTop, roadWidth, 47).fill(
    vGradient([
      [0, 0x657783],
      [0.25, 0x758893],
      [1, 0x718391],
    ]),
  );
  pavement.rect(ROAD.left, roadTop, roadWidth, 1).fill(0x2b4358);
  pavement.rect(ROAD.left, roadTop + 1.25, roadWidth, 0.72).fill(0xd7d9ba);
  pavement.rect(ROAD.left, roadTop + 18, roadWidth, 0.6).fill(0xb9bca6);
  const stripePeriod = 34;
  for (let x = ROAD.left - stripePeriod; x < ROAD.right + stripePeriod; x += stripePeriod) {
    stripes
      .poly([x + 5, roadTop + 5, x, roadTop + 7.5, x + 5, roadTop + 10, x + 3.9, roadTop + 7.5])
      .fill(0xc9b984);
    stripes.roundRect(x + 11, roadTop + 14, 14, 0.65, 0.28).fill({ color: 0xdcdabe, alpha: 0.67 });
  }
  container.addChild(pavement, stripes);

  const rear = stage.ledges[0]!.x;
  const trucks = hazardStage.platforms.map((p, i) => {
    const solid = hazardStage.solids[i]!;
    const x = (solid.points[0]![0] + solid.points[1]![0]) / 2;
    const truck = createTruck(i + 1, TRUCK_SCALE.y / TRUCK_SCALE.x);
    truck.scale.set(TRUCK_SCALE.x, TRUCK_SCALE.y);
    const brake = new Graphics({ label: 'brake-warning' });
    brake.ellipse(rear + 2.6, 13.7, 6.4, 4.2).fill({ color: 0xfe5644, alpha: 0.26 });
    brake
      .roundRect(rear + 0.8, 12, 3, 3.6, 0.6)
      .fill(0xfa554b)
      .stroke({ color: 0x663942, width: 0.5 });
    brake.roundRect(rear + 1.3, 12.55, 1.9, 1.05, 0.33).fill(0xffe3b4);
    brake.roundRect(rear + 1.35, 1.8, 2.85, 1.28, 0.28).fill(0xf9694d);
    truck.addChild(brake);
    const platform = createPlatform(p, i === 1);
    container.addChild(truck, platform);
    return { x, truck, platform, brake, px: p.x1, py: p.y };
  });

  return {
    container,
    update(frame: number, pieces: StageState, alpha: number) {
      stripes.x = wrap((frame - 1 + alpha) * ROAD.conveyor, -stripePeriod, stripePeriod);
      const pose = (sprite: Container, piece: PieceState, x: number, y: number) => {
        sprite.visible = piece.on;
        sprite.position.set(x + piece.x - piece.dx * (1 - alpha), -y - piece.y + piece.dy * (1 - alpha));
      };
      for (const [i, { x, truck, platform, brake, px, py }] of trucks.entries()) {
        pose(truck, pieces.solids[i]!, x, 0);
        pose(platform, pieces.platforms[i]!, px, py);
        brake.visible = isBraking(i, frame);
        brake.alpha = frame % 12 < 7 ? 1 : 0.27;
      }
    },
  };
}
