import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'wheely-trucks',
  name: 'Truck Convoy',
  solids: [
    {
      points: [
        [-80, 0],
        [80, 0],
        [80, -12],
        [77, -18],
        [69, -24],
        [-72, -24],
        [-80, -18],
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
  blastZones: { left: -220, right: 220, top: 192, bottom: -140 },
  camera: { left: -165, right: 165, top: 126, bottom: -82 },
  spawns: [
    [-49, 0, 1],
    [49, 0, -1],
    [-16, 0, 1],
    [16, 0, -1],
  ],
  respawns: [
    [-42, 70],
    [42, 70],
    [-16, 70],
    [16, 70],
  ],
};
