import type { StageGeometry } from '../../sim/stage';

const PERIOD = 1200;
const OPEN_FRAMES = 180;

function girder(left: number, right: number, opens?: number): StageGeometry['solids'][number] {
  const points: [number, number][] = [[left, 0]];
  if (left === -80) points.push([left, -8], [left + 7, -15]);
  else points.push([left, -15]);
  if (right === 80) points.push([right - 7, -15], [right, -8]);
  else points.push([right, -15]);
  points.push([right, 0]);
  if (opens === undefined) return { points };
  return { points, hazard: true, schedule: { period: PERIOD, off: [[opens, opens + OPEN_FRAMES - 1]] } };
}

export const stage: StageGeometry = {
  id: 'snail-bob-construction',
  name: 'Construction Site',
  solids: [girder(-80, -52), girder(-52, -28, 360), girder(-28, 28), girder(28, 52, 960), girder(52, 80)],
  platforms: [
    { x1: -59.42, x2: -24.79, y: 24.12 },
    { x1: 24.79, x2: 59.42, y: 24.12 },
  ],
  ledges: [
    { x: -80, y: 0, side: -1 },
    { x: 80, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-32, 0, 1],
    [32, 0, -1],
    [-60, 0, 1],
    [60, 0, -1],
  ],
  respawns: [
    [0, 70],
    [36, 70],
    [-36, 70],
    [72, 70],
  ],
};
