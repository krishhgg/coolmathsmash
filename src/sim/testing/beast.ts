import { fighter as fireboy } from '../../fighters/fireboy';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type MoveDef } from '../../fighters/types';

/**
 * Beast Lunge, the roster's command grab for Balloon Boy & the Beast (side special): the Beast lunges, and its
 * grab box catches on frames 14-16. A catch plays beastChew: two 3% chews, then a 6% spit up and forward.
 */
export const beastLunge: MoveDef = {
  kind: 'other',
  faf: 50,
  commandGrab: 'beastChew',
  hits: [
    {
      frames: [14, 16],
      boxes: [{ id: 0, x: 10, y: 7, radius: 5, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
    },
  ],
};

export const beastChew: MoveDef = {
  kind: 'other',
  faf: 55,
  hits: [],
  holdHits: [
    { frame: 10, damage: 3 },
    { frame: 24, damage: 3 },
  ],
  throw: { frame: 40, hit: { damage: 6, angle: 55, kbg: 70, bkb: 70 } },
};

/** A test fighter until Balloon Boy & the Beast exist: Fireboy with Beast Lunge as his side special. */
export const lungeTester = defineFighter({
  ...fireboy,
  id: 'test-lunge',
  name: 'Lunge tester',
  moves: { ...fireboy.moves, sideB: beastLunge, beastChew },
  selectable: false,
});

registerFighter(lungeTester);
