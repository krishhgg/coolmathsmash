import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'coolmath-planet',
  name: 'Coolmath Planet',
  solids: [
    {
      points: [
        [-80, 0],
        [80, 0],
        [80, -2.5],
        [70, -5.8],
        [38, -9],
        [-38, -9],
        [-70, -5.8],
        [-80, -2.5],
      ],
    },
  ],
  platforms: [],
  ledges: [
    { x: -80, y: 0, side: -1 },
    { x: 80, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 180, bottom: -140 },
  camera: { left: -170, right: 170, top: 125, bottom: -80 },
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
