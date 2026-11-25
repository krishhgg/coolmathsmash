import { defineFighter, type FighterDef } from '../../fighters/types';
import { marioReference } from './reference';

/**
 * Small test fighters for the air-mobility systems (src/sim/mobility.ts), each carrying one roster fighter's
 * numbers on the Mario reference body. Tests register them, and so does the harness (`?harness`), so captures
 * can show them; normal play never sees them.
 */
const mario = marioReference.stats;

/** Papa Louie's glide (roster: max fall 0.6, horizontal 1.2, Zelda-like jumps) and a rising up special that glides. */
export const testGlider = defineFighter({
  id: 'test-glider',
  name: 'Test: glide (Papa Louie)',
  series: 'test',
  selectable: false,
  stats: {
    ...mario,
    gravity: 0.075,
    fallSpeed: 1.35,
    fastFallSpeed: 2.16,
    fullHopHeight: 32,
    shortHopHeight: 15.5,
    doubleJumpHeight: 32,
  },
  glide: { speed: 1.2, fallSpeed: 0.6 },
  moves: {
    nair: marioReference.moves.nair,
    upB: {
      kind: 'other',
      faf: 40,
      leavesGround: true,
      helpless: true,
      glide: true,
      landingLag: 20,
      hits: [],
      script: (x) => {
        if (x.f.actionFrame === 1) x.f.vel.y = 3;
      },
    },
  },
});

/** Balloon Boy: 4 jumps (3 balloon jumps of 24) and a 120-frame float. */
export const testFloater = defineFighter({
  id: 'test-floater',
  name: 'Test: float (Balloon Boy)',
  series: 'test',
  selectable: false,
  stats: {
    ...mario,
    gravity: 0.07,
    fallSpeed: 1.19,
    fastFallSpeed: 1.904,
    fullHopHeight: 30,
    shortHopHeight: 14.5,
    doubleJumpHeight: 24,
    jumps: 4,
  },
  float: { frames: 120 },
  moves: { nair: marioReference.moves.nair },
});

/** Snail Bob's Rocket Hover: up special thrusts on 120 frames of fuel; the nozzle hits on frame 6. */
export const testHover = defineFighter({
  id: 'test-hover',
  name: 'Test: hover (Snail Bob)',
  series: 'test',
  selectable: false,
  stats: { ...mario, gravity: 0.068, fallSpeed: 1.35, fastFallSpeed: 2.16 },
  hover: { fuel: 120, rise: 1, accel: 0.1 },
  moves: {
    upB: {
      kind: 'other',
      faf: 12,
      action: 'hover',
      hits: [
        {
          frames: [6, 7],
          boxes: [{ id: 0, x: 0, y: 0, radius: 4, damage: 3, angle: 270, kbg: 50, bkb: 20 }],
        },
      ],
    },
  },
});

export const MOBILITY_TEST_FIGHTERS: FighterDef[] = [testGlider, testFloater, testHover];
