import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'duck-life-course',
  name: 'Duck Life Course',
  solids: [
    {
      points: [
        [-80, 0],
        [80, 0],
        [80, -8],
        [74, -17],
        [62, -26],
        [41, -34],
        [-41, -34],
        [-62, -26],
        [-74, -17],
        [-80, -8],
      ],
    },
  ],
  platforms: [
    { x1: -59.42, x2: -24.79, y: 24.12 },
    { x1: -17.32, x2: 17.32, y: 47.19 },
    { x1: 24.79, x2: 59.42, y: 24.12 },
  ],
  ledges: [
    { x: -80, y: 0, side: -1 },
    { x: 80, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-48, 0, 1],
    [48, 0, -1],
    [-16, 0, 1],
    [16, 0, -1],
  ],
  respawns: [
    [-54, 72],
    [54, 72],
    [-18, 82],
    [18, 82],
  ],
};
