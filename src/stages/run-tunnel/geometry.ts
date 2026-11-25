import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'run-tunnel',
  name: 'Run Tunnel',
  solids: [
    {
      points: [
        [-88, 0],
        [-88, -10],
        [-48, -10],
        [-48, 0],
      ],
    },
    {
      points: [
        [-32, 0],
        [-32, -10],
        [32, -10],
        [32, 0],
      ],
    },
    {
      points: [
        [48, 0],
        [48, -10],
        [88, -10],
        [88, 0],
      ],
    },
  ],
  platforms: [
    { x1: -76, x2: -44, y: 70 },
    { x1: -36, x2: -4, y: 70 },
    { x1: 4, x2: 36, y: 70 },
    { x1: 44, x2: 76, y: 70 },
  ],
  ledges: [
    { x: -88, y: 0, side: -1 },
    { x: 88, y: 0, side: 1 },
  ],
  blastZones: { left: -230, right: 230, top: 180, bottom: -120 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-64, 0, 1],
    [64, 0, -1],
    [-20, 0, 1],
    [20, 0, -1],
  ],
  respawns: [
    [-64, 94],
    [64, 94],
    [-20, 94],
    [20, 94],
  ],
};
