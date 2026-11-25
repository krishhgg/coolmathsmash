import type { Motion, StageGeometry } from '../../sim/stage';

/**
 * Raft War Lagoon: the kids' log raft afloat in a lagoon. One raft (deck, two lookout decks on stilts and a
 * crow's nest on the mast) bobs as a single piece; nothing is under it but water, and the water is the bottom
 * blast zone.
 */
export const RAFT = { left: -75, right: 75, deck: 0, bottom: -10 } as const;

/** The lagoon's surface (art only): the log is half under it. */
export const WATER_Y = -5;

/**
 * The swell: the whole raft rises 1.6 units and settles back every 300 frames (5 s), eased at both ends. It only
 * rises above the authored place, so the stage the CPU reads (src/ai/stage.ts) is never above the real one. It is
 * a hazard, so with hazards off the raft stays at its authored place.
 */
export const SWELL: Motion = {
  period: 300,
  ease: true,
  keys: [
    [0, 0, 0],
    [150, 0, 1.6],
  ],
};

const afloat = { motion: SWELL, hazard: true } as const;

export const stage: StageGeometry = {
  id: 'raft-wars-water',
  name: 'Raft War Lagoon',
  solids: [
    {
      points: [
        [RAFT.left, RAFT.deck],
        [RAFT.right, RAFT.deck],
        [RAFT.right, -6.1],
        [74.4, -8.8],
        [72.8, RAFT.bottom],
        [-72.8, RAFT.bottom],
        [-74.4, -8.8],
        [RAFT.left, -6.1],
      ],
      ...afloat,
    },
  ],
  platforms: [
    { x1: -56, x2: -24, y: 25, ...afloat },
    { x1: 24, x2: 56, y: 25, ...afloat },
    { x1: -15, x2: 15, y: 49, ...afloat },
  ],
  ledges: [
    { x: RAFT.left, y: RAFT.deck, side: -1 },
    { x: RAFT.right, y: RAFT.deck, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-42, 0, 1],
    [42, 0, -1],
    [-14, 0, 1],
    [14, 0, -1],
  ],
  respawns: [
    [0, 72],
    [36, 72],
    [-36, 72],
    [62, 72],
  ],
};
