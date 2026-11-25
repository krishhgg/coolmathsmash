import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'snail-bob-construction',
  name: 'Construction Site',
  solids: [
    {
      points: [
        [-80, 0],
        [-80, -8],
        [-73, -15],
        [73, -15],
        [80, -8],
        [80, 0],
      ],
    },
  ],
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
