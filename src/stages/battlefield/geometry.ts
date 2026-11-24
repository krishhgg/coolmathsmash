import type { StageGeometry } from '../../sim/stage';

/** Smash Ultimate's Battlefield collision (battlefield_00 LVD), rounded to 0.01 units. */
export const stage: StageGeometry = {
  id: 'battlefield',
  name: 'Coolmath Battlefield',
  solids: [
    {
      points: [
        [41.42, -40.12],
        [-41.4, -40.1],
        [-64.39, -25.11],
        [-80, -8.32],
        [-80, 0],
        [80, 0],
        [80, -8.32],
        [64.39, -25.1],
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
