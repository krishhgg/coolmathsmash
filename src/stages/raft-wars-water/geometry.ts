import type { StageGeometry } from '../../sim/stage';
import { boatMotion } from './tide';

export const BOAT_SOLID = 1;
export const CABIN_PLATFORM = 0;

const leftShore: StageGeometry['solids'][number]['points'] = [
  [-140, 0],
  [-80, 0],
  [-80, -6],
  [-84, -17],
  [-94, -33],
  [-108, -39],
  [-123, -31],
  [-135, -17],
  [-140, -7],
];

export const stage: StageGeometry = {
  id: 'raft-wars-water',
  name: 'Raft War Lagoon',
  solids: [
    { points: leftShore },
    {
      motion: boatMotion,
      hazard: true,
      points: [
        [-45, 0],
        [45, 0],
        [45, -5],
        [39, -13],
        [27, -21],
        [-27, -21],
        [-39, -13],
        [-45, -5],
      ],
    },
    { points: leftShore.map(([x, y]) => [-x, y]) },
  ],
  platforms: [{ x1: -15, x2: 15, y: 28, motion: boatMotion, hazard: true }],
  ledges: [
    { x: -140, y: 0, side: -1 },
    { x: -80, y: 0, side: 1 },
    { x: -45, y: 0, side: -1 },
    { x: 45, y: 0, side: 1 },
    { x: 80, y: 0, side: -1 },
    { x: 140, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 180, bottom: -140 },
  camera: { left: -190, right: 190, top: 136, bottom: -108 },
  spawns: [
    [-110, 0, 1],
    [110, 0, -1],
    [-27, 0, 1],
    [27, 0, -1],
  ],
  respawns: [
    [-110, 65],
    [110, 65],
    [-27, 65],
    [27, 65],
  ],
};
