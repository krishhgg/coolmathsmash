import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'bloxorz-platform',
  name: 'Bloxorz Board',
  solids: [
    {
      points: [
        [-88, 0],
        [-8, 0],
        [-8, -22],
        [-88, -22],
      ],
    },
    {
      points: [
        [8, 0],
        [88, 0],
        [88, -22],
        [8, -22],
      ],
    },
  ],
  platforms: [
    { x1: -66, x2: -34, y: 26 },
    { x1: 34, x2: 66, y: 26 },
  ],
  ledges: [
    { x: -88, y: 0, side: -1 },
    { x: 88, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
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
