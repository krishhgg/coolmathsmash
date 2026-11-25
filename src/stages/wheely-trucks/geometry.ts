import type { Motion, StageGeometry } from '../../sim/stage';

/**
 * The car carrier everyone fights on, driving right: its top deck runs over the trailer and the cab-over cab at
 * the front, and the side of the trailer and cab drops to the hull's bottom.
 */
export const RIG = { left: -80, right: 80, top: 0, bottom: -25, cab: 53 } as const;

/** Road heights, for the art only: where the haulers' tyres and the carrier's tyres touch the road. */
export const ROAD = { far: -14, near: -32 } as const;

/**
 * The two car haulers in the far lane. Their upper decks are the soft platforms, `width` wide at `y`, centred at
 * `centers` when hazards are off. With hazards on the pair falls back `drift` units and later pulls ahead the same
 * distance, together, so the decks never meet and always end over the carrier's deck.
 */
export const HAULERS = { y: 26, width: 38, centers: [-42, 42], drift: 36, period: 1440 } as const;

const { drift, period } = HAULERS;

/**
 * 24 seconds of traffic: 4 s level with the carrier, 2 s falling back, 4 s behind, 2 s catching up, 4 s level,
 * 2 s pulling ahead, 4 s ahead and 2 s easing back to level.
 */
export const HAULER_MOTION: Motion = {
  period,
  ease: true,
  keys: [
    [0, 0, 0],
    [240, 0, 0],
    [360, -drift, 0],
    [600, -drift, 0],
    [720, 0, 0],
    [960, 0, 0],
    [1080, drift, 0],
    [1320, drift, 0],
  ],
};

const deck = (center: number) => ({
  x1: center - HAULERS.width / 2,
  x2: center + HAULERS.width / 2,
  y: HAULERS.y,
  motion: HAULER_MOTION,
  hazard: true,
});

const { left, right, top, bottom } = RIG;

export const stage: StageGeometry = {
  id: 'wheely-trucks',
  name: 'Truck Convoy',
  solids: [
    {
      points: [
        [left, top],
        [right, top],
        [right, bottom + 4],
        [right - 3, bottom],
        [left + 4, bottom],
        [left, bottom + 4],
      ],
    },
  ],
  platforms: HAULERS.centers.map(deck),
  ledges: [
    { x: left, y: top, side: -1 },
    { x: right, y: top, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-50, top, 1],
    [50, top, -1],
    [-20, top, 1],
    [20, top, -1],
  ],
  respawns: [
    [-40, 70],
    [40, 70],
    [-14, 70],
    [14, 70],
  ],
};
