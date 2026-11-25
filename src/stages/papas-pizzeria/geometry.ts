import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'papas-pizzeria',
  name: "Papa's Pizzeria",
  solids: [
    {
      points: [
        [-75, 0],
        [75, 0],
        [75, -7],
        [69, -16],
        [58, -24],
        [-58, -24],
        [-69, -16],
        [-75, -7],
      ],
    },
  ],
  platforms: [
    { x1: -63, x2: -27, y: 26 },
    { x1: -15, x2: 15, y: 50 },
    { x1: 27, x2: 63, y: 26 },
  ],
  ledges: [
    { x: -75, y: 0, side: -1 },
    { x: 75, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -160, right: 160, top: 130, bottom: -80 },
  spawns: [
    [-40, 0, 1],
    [40, 0, -1],
    [-20, 0, 1],
    [20, 0, -1],
  ],
  respawns: [
    [0, 70],
    [36, 70],
    [-36, 70],
    [72, 70],
  ],
};
