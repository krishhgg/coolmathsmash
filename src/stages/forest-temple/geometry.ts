import type { DamageZone, StageGeometry } from '../../sim/stage';

export const GOO = { x1: -12, x2: 12, y1: -6, y2: -0.45, element: 'goo' } satisfies DamageZone;

export const POOL_FILL: StageGeometry['solids'][number] = {
  points: [
    [GOO.x1, 0],
    [GOO.x2, 0],
    [5, GOO.y1],
    [-5, GOO.y1],
  ],
  hazard: true,
  schedule: () => false,
};

export const TEMPLE_HULL: StageGeometry['solids'][number] = {
  points: [
    [-85, 0],
    [GOO.x1, 0],
    [-5, GOO.y1],
    [5, GOO.y1],
    [GOO.x2, 0],
    [85, 0],
    [85, -10],
    [72, -28],
    [-72, -28],
    [-85, -10],
  ],
};

export const stage: StageGeometry = {
  id: 'forest-temple',
  name: 'Forest Temple',
  solids: [POOL_FILL, TEMPLE_HULL],
  zones: [GOO],
  platforms: [
    { x1: -59.42, x2: -24.79, y: 24.12 },
    { x1: -17.32, x2: 17.32, y: 47.19 },
    { x1: 24.79, x2: 59.42, y: 24.12 },
  ],
  ledges: [
    { x: -85, y: 0, side: -1 },
    { x: 85, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-40, 0, 1],
    [40, 0, -1],
    [-70, 0, 1],
    [70, 0, -1],
  ],
  respawns: [
    [0, 70],
    [36, 70],
    [-36, 70],
    [72, 70],
  ],
};
