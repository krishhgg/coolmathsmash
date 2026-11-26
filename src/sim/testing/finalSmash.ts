import { registerFighter } from '../../fighters/registry';
import { defineFighter, type MoveDef } from '../../fighters/types';
import { marioReference } from './reference';

/**
 * The two shapes of Final Smash (src/sim/finalSmash.ts), on the Mario reference, with round numbers. Both start on
 * neutral special while the fighter holds the charge, and both have an ordinary neutral and side special so tests
 * can tell a special from a Final Smash.
 */

/** An ordinary neutral special: what neutral special plays without the charge. */
const neutralB: MoveDef = {
  kind: 'other',
  faf: 30,
  hits: [
    { frames: [10, 12], boxes: [{ id: 0, x: 8, y: 8, radius: 5, damage: 5, angle: 45, kbg: 50, bkb: 30 }] },
  ],
};

/** An ordinary side special: side special with the charge stays a special. */
const sideB: MoveDef = {
  kind: 'other',
  faf: 32,
  hits: [
    { frames: [12, 14], boxes: [{ id: 0, x: 9, y: 7, radius: 5, damage: 6, angle: 40, kbg: 60, bkb: 30 }] },
  ],
};

/**
 * Direct, like Mario Finale: a blast the fighter puts out in front once the activation freeze is over, 50 units long.
 * Others are free to move after the freeze. In the air it holds still.
 */
export const finalBlast: MoveDef = {
  kind: 'other',
  faf: 90,
  final: { still: true },
  hits: [
    {
      frames: [42, 51],
      boxes: [
        { id: 0, x: 10, y: 8, radius: 10, damage: 30, angle: 40, kbg: 70, bkb: 80 },
        { id: 1, x: 32, y: 8, radius: 18, damage: 30, angle: 40, kbg: 70, bkb: 80 },
      ],
    },
  ],
};

/**
 * Trapping, like a cinematic Final Smash: a reach in front after the freeze catches the first fighter it touches and
 * plays finalSmashCinematic, where everyone else holds still.
 */
export const finalTrap: MoveDef = {
  kind: 'other',
  faf: 80,
  final: {},
  commandGrab: 'finalSmashCinematic',
  hits: [
    {
      frames: [42, 51],
      boxes: [{ id: 0, x: 12, y: 7, radius: 10, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
    },
  ],
};

/** The cinematic: three 8% hits on the trapped fighter, then a 16% launch on frame 100. */
export const finalCinematic: MoveDef = {
  kind: 'other',
  faf: 130,
  final: {},
  hits: [],
  holdHits: [
    { frame: 20, damage: 8 },
    { frame: 40, damage: 8 },
    { frame: 60, damage: 8 },
  ],
  throw: { frame: 100, hit: { damage: 16, angle: 45, kbg: 70, bkb: 90 } },
};

export const finalDirectTester = defineFighter({
  ...marioReference,
  id: 'test-final-direct',
  name: 'Final Smash tester (direct)',
  moves: { ...marioReference.moves, neutralB, sideB, finalSmash: finalBlast },
  selectable: false,
});

export const finalTrapTester = defineFighter({
  ...marioReference,
  id: 'test-final-trap',
  name: 'Final Smash tester (trap)',
  moves: {
    ...marioReference.moves,
    neutralB,
    sideB,
    finalSmash: finalTrap,
    finalSmashCinematic: finalCinematic,
  },
  selectable: false,
});

/** Neutral and side special but no Final Smash: holding the charge changes nothing. */
export const noFinalTester = defineFighter({
  ...marioReference,
  id: 'test-final-none',
  name: 'Final Smash tester (none)',
  moves: { ...marioReference.moves, neutralB, sideB },
  selectable: false,
});

export const FINAL_SMASH_TEST_FIGHTERS = [finalDirectTester, finalTrapTester, noFinalTester];
for (const def of FINAL_SMASH_TEST_FIGHTERS) registerFighter(def);
