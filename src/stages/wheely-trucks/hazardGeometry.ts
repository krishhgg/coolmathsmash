import type { StageGeometry } from '../../sim/stage';
import { stage } from './geometry';

const CENTERS = [-90, 0, 90] as const;
const SHIFT = 30 * 60;
const WARNING = 60;
const ABSENT = 4 * 60;
const DRIFT_PERIOD = 900;
export const TRUCK_SCALE = { x: 72 / 160, y: 0.8 };

export function isBraking(index: number, frame: number): boolean {
  return Math.floor(frame / SHIFT) % CENTERS.length === index && frame % SHIFT >= SHIFT - WARNING;
}

const trucks = CENTERS.map((center, index) => {
  const motion = (frame: number): [number, number] => {
    const phase = (2 * Math.PI * frame) / DRIFT_PERIOD + ((index - 1) * Math.PI) / 6;
    const brake = isBraking(index, frame) ? 4.5 * (((frame % SHIFT) - SHIFT + WARNING) / WARNING) ** 2 : 0;
    return [20 * Math.sin(phase) - brake, 0];
  };
  const schedule = (frame: number) => {
    const departure = Math.floor(frame / SHIFT);
    return departure <= 0 || (departure - 1) % CENTERS.length !== index || frame % SHIFT >= ABSENT;
  };
  return { center, motion, schedule, hazard: true };
});

export const ROAD = { left: -256, right: 256, y: -40, bottom: -49, conveyor: -4 };

export const hazardStage: StageGeometry = {
  ...stage,
  solids: [
    ...trucks.map(({ center, ...piece }) => ({
      ...piece,
      points: stage.solids[0]!.points.map(([x, y]): [number, number] => [
        center + x * TRUCK_SCALE.x,
        y * TRUCK_SCALE.y,
      ]),
    })),
    {
      conveyor: ROAD.conveyor,
      points: [
        [ROAD.left, ROAD.y],
        [ROAD.right, ROAD.y],
        [ROAD.right, ROAD.bottom],
        [ROAD.left, ROAD.bottom],
      ],
    },
  ],
  platforms: trucks.map(({ center, ...piece }) => ({ ...piece, x1: center - 12, x2: center + 12, y: 22 })),
  ledges: trucks.flatMap(({ center }, solid) =>
    stage.ledges.map(({ x, y, side }) => ({ x: center + x * TRUCK_SCALE.x, y, side, solid })),
  ),
  blastZones: { ...stage.blastZones, bottom: -110 },
  spawns: [
    [-90, 0, 1],
    [90, 0, -1],
    [-16, 0, 1],
    [16, 0, -1],
  ],
  respawns: [
    [-90, 70],
    [90, 70],
    [-16, 70],
    [16, 70],
  ],
};
