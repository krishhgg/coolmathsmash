import type { StageGeometry } from '../sim/stage';

/**
 * The hazard testbed: not a real stage. One of each stage hazard on a Battlefield-sized floor, for tests, the
 * harness (`__smash.newMatch({ stage: 'hazard-testbed' })` under ?harness, add `hazards: false` to turn them off)
 * and PR captures. Registered at runtime like the engine testbed, so it never shows up in the stage list.
 */
export const hazardTestbed: StageGeometry = {
  id: 'hazard-testbed',
  name: 'Hazard testbed',
  solids: [
    /** 0: the floor left of the trapdoor. */
    {
      points: [
        [-100, 0],
        [-100, -30],
        [-15, -30],
        [-15, 0],
      ],
    },
    /** 1: a timed trapdoor (Construction Site, Bloxorz): shut for 240 frames, open for 120. Shut with hazards off. */
    {
      points: [
        [-15, 0],
        [-15, -6],
        [15, -6],
        [15, 0],
      ],
      hazard: true,
      schedule: { period: 360, off: [[180, 299]] },
    },
    /** 2: the floor right of the trapdoor. */
    {
      points: [
        [15, 0],
        [15, -30],
        [100, -30],
        [100, 0],
      ],
    },
  ],
  platforms: [
    /** 0 and 1: conveyor belts (Papa's Pizza) carrying whoever stands on them toward the middle and off. */
    { x1: -75, x2: -35, y: 30, conveyor: 0.6 },
    { x1: 35, x2: 75, y: 30, conveyor: -0.6 },
  ],
  ledges: [
    { x: -100, y: 0, side: -1 },
    { x: 100, y: 0, side: 1 },
  ],
  zones: [
    /** 0: a goo pool (Forest Temple): hurts everyone. */
    { x1: -92, x2: -72, y1: -1, y2: 4, element: 'goo' },
    /** 1: a lava pool: hurts everyone but Fireboy. */
    { x1: -60, x2: -36, y1: -1, y2: 4, element: 'lava' },
    /** 2: a water pool: hurts everyone but Watergirl. */
    { x1: 36, x2: 60, y1: -1, y2: 4, element: 'water' },
  ],
  hitboxes: [
    /** 0: a blade that waits, sweeps the floor left to right from frame 120 to 300, and retracts to go back. */
    {
      x: 0,
      y: 6,
      motion: {
        period: 360,
        keys: [
          [0, -95, 0],
          [120, -95, 0],
          [300, 95, 0],
          [359, -95, 0],
        ],
      },
      schedule: {
        period: 360,
        off: [
          [0, 119],
          [301, 359],
        ],
      },
      boxes: [{ id: 0, x: 0, y: 0, radius: 6, damage: 8, angle: 45, kbg: 80, bkb: 50 }],
    },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-25, 0, 1],
    [25, 0, -1],
    [0, 0, 1],
    [80, 0, -1],
  ],
  respawns: [
    [-36, 80],
    [36, 80],
    [0, 80],
    [72, 80],
  ],
};
