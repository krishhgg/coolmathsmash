import type { StageGeometry } from '../../sim/stage';

/**
 * The race-course deck: Battlefield's 160-unit floor with a rounded earth underside, so the walkable top and both
 * ledges match Battlefield while the silhouette reads as a turf island. The art draws from these numbers.
 */
export const COURSE = {
  left: -80,
  right: 80,
  top: 0,
  /** The grass lip the checkered start and finish lines are painted on. */
  turf: 3.6,
  bottom: -34,
} as const;

const { left, right, top, bottom } = COURSE;

export const stage: StageGeometry = {
  id: 'duck-life-world',
  name: 'Duck Life Course',
  solids: [
    {
      points: [
        [left, top],
        [right, top],
        [right, top - 7],
        [right - 3, top - 12],
        [right - 10, top - 18.5],
        [right - 22, top - 25],
        [right - 38, top - 30.5],
        [right - 58, top - 33.4],
        [0, bottom],
        [left + 58, top - 33.4],
        [left + 38, top - 30.5],
        [left + 22, top - 25],
        [left + 10, top - 18.5],
        [left + 3, top - 12],
        [left, top - 7],
      ],
    },
  ],
  platforms: [
    { x1: -59.42, x2: -24.79, y: 24.12 },
    { x1: -17.32, x2: 17.32, y: 47.19 },
    { x1: 24.79, x2: 59.42, y: 24.12 },
  ],
  ledges: [
    { x: left, y: top, side: -1 },
    { x: right, y: top, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-40, top, 1],
    [40, top, -1],
    [-66, top, 1],
    [66, top, -1],
  ],
  respawns: [
    [-36, 70],
    [36, 70],
    [-66, 70],
    [66, 70],
  ],
};
