import type { StageGeometry } from '../../sim/stage';
import { PATROLS } from './hazards';

export const DECK = {
  left: -90,
  right: 90,
  top: 0,
  laneDepth: 24,
  safeDepth: 32,
  safeWidth: 30,
} as const;

const { left, right, top, laneDepth, safeDepth, safeWidth } = DECK;
const legalOnly = { hazard: true, schedule: () => false };

export const stage: StageGeometry = {
  id: 'worlds-hardest-game',
  name: "World's Hardest Stage",
  solids: [
    {
      points: [
        [left, top],
        [right, top],
        [right, top - safeDepth],
        [right - safeWidth, top - safeDepth],
        [right - safeWidth, top - laneDepth],
        [left + safeWidth, top - laneDepth],
        [left + safeWidth, top - safeDepth],
        [left, top - safeDepth],
      ],
    },
  ],
  platforms: [
    { x1: -59.42, x2: -24.79, y: 24.12, ...legalOnly },
    { x1: 24.79, x2: 59.42, y: 24.12, ...legalOnly },
  ],
  ledges: [
    { x: left, y: top, side: -1 },
    { x: right, y: top, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 180, bottom: -140 },
  camera: { left: -180, right: 180, top: 130, bottom: -85 },
  spawns: [
    [-80, top, 1],
    [80, top, -1],
    [-61, top, 1],
    [61, top, -1],
  ],
  respawns: [
    [-18, 68],
    [18, 68],
    [-54, 68],
    [54, 68],
  ],
  // TODO: Add the giant ball after contact KOs land, and healing coins after stage pickups land.
  hitboxes: PATROLS,
};
