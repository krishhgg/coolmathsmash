import type { StageGeometry } from '../../sim/stage';

export const stage: StageGeometry = {
  id: 'johnny-upgrade-boss',
  name: "Johnny's Level",
  solids: [
    {
      points: [
        [-85, 0],
        [-85, -32],
        [85, -32],
        [85, -6],
        [85 / 3, -6],
        [85 / 3, 0],
      ],
    },
  ],
  platforms: [
    { x1: -68, x2: -32, y: 26 },
    { x1: 32, x2: 68, y: 26 },
  ],
  ledges: [
    { x: -85, y: 0, side: -1 },
    { x: 85, y: -6, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-42, 0, 1],
    [42, -6, -1],
    [-18, 0, 1],
    [18, 0, -1],
  ],
  respawns: [
    [-18, 70],
    [18, 70],
    [-50, 70],
    [50, 70],
  ],
};
