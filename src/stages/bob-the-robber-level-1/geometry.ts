import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'bob-the-robber-level-1',
  name: "Bob's First Heist",
  solids: [
    {
      points: [
        [-90, 0],
        [90, 0],
        [90, -8],
        [83, -16],
        [-83, -16],
        [-90, -8],
      ],
    },
  ],
  platforms: [
    { x1: -60, x2: 60, y: 38 },
    { x1: -20, x2: 20, y: 76 },
  ],
  ledges: [
    { x: -90, y: 0, side: -1 },
    { x: 90, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -180, right: 180, top: 152, bottom: -80 },
  spawns: [
    [-54, 0, 1],
    [54, 0, -1],
    [-18, 0, 1],
    [18, 0, -1],
  ],
  respawns: [
    [-12, 104],
    [12, 104],
    [-44, 104],
    [44, 104],
  ],
};
