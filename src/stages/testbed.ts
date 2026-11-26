import type { StageGeometry } from '../sim/stage';
import * as SimMath from '../sim/math';

/**
 * The engine testbed: not a real stage. It shows every stage system on one Battlefield-sized slab so tests,
 * the harness (`__smash.newMatch({ stage: 'testbed' })` under ?harness) and PR captures can exercise them.
 * Registered at runtime by the harness and the unit tests, so it never shows up in the stage list.
 */
export const testbed: StageGeometry = {
  id: 'testbed',
  name: 'Engine testbed',
  solids: [
    {
      points: [
        [-80, 0],
        [-80, -30],
        [80, -30],
        [80, 0],
      ],
    },
    /** 1: an elevator off the right edge with grabbable corners: rises 70, waits, sinks back, waits. */
    {
      points: [
        [100, 0],
        [100, -8],
        [140, -8],
        [140, 0],
      ],
      motion: {
        period: 420,
        ease: true,
        keys: [
          [0, 0, -40],
          [60, 0, -40],
          [210, 0, 30],
          [270, 0, 30],
        ],
      },
    },
    /** 2: a crusher over the left of the slab. It stops 5 above the floor, so a fighter under it is squeezed. */
    {
      points: [
        [-62, 0],
        [-38, 0],
        [-38, 10],
        [-62, 10],
      ],
      motion: {
        period: 300,
        ease: true,
        keys: [
          [0, 0, 50],
          [90, 0, 50],
          [140, 0, 5],
          [200, 0, 5],
        ],
      },
    },
  ],
  platforms: [
    /** 0: Smashville-style glider: crosses to the right, waits, comes back, waits. */
    {
      x1: -18,
      x2: 18,
      y: 30,
      motion: {
        period: 480,
        ease: true,
        keys: [
          [0, -5, 0],
          [60, -5, 0],
          [240, 50, 0],
          [300, 50, 0],
        ],
      },
    },
    /** 1: there for 200 frames, gone for 100 (Truck Convoy's trailers, Hangman Board's tiles). */
    { x1: -12, x2: 12, y: 58, schedule: { period: 300, off: [[200, 299]] } },
    /** 2: circles off the left edge, a motion written as a function of the frame. */
    {
      x1: -137,
      x2: -113,
      y: 25,
      motion: (frame) => {
        const a = (2 * Math.PI * frame) / 360;
        return [18 * SimMath.cos(a), 18 * SimMath.sin(a)];
      },
    },
  ],
  ledges: [
    { x: -80, y: 0, side: -1 },
    { x: 80, y: 0, side: 1 },
    { x: 100, y: 0, side: -1 },
    { x: 140, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-20, 0, 1],
    [20, 0, -1],
    [0, 0, 1],
    [60, 0, -1],
  ],
  respawns: [
    [0, 80],
    [36, 80],
    [-20, 80],
    [72, 80],
  ],
};
