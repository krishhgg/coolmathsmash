import { fighter as fireboy } from '../../fighters/fireboy';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type MoveDef } from '../../fighters/types';

/** Bob's Shadow Step (roster down special): a counter window of frames 6-25, answering from behind. */
export const shadowStep: MoveDef = {
  kind: 'other',
  faf: 50,
  hits: [],
  counter: { window: [6, 25], multiplier: 1.2, min: 8, max: 20, behind: 20, angle: 45, kbg: 60, bkb: 40 },
};

/** A counter that answers in place, with a plain x2 and no clamps. */
export const reflectStep: MoveDef = {
  kind: 'other',
  faf: 50,
  hits: [],
  counter: { window: [6, 25], multiplier: 2, angle: 361, kbg: 100, bkb: 20 },
};

/**
 * Test fighters until Bob exists: Fireboy with Shadow Step as down special (and a jab that deals `jab` damage on
 * frames 3-4, for hitting the window from either side of it).
 */
export function counterTester(id: string, jab = 3, move = shadowStep) {
  return defineFighter({
    ...fireboy,
    id,
    name: `Counter tester ${id}`,
    selectable: false,
    moves: {
      ...fireboy.moves,
      downB: move,
      jab: {
        kind: 'other',
        faf: 19,
        hits: [
          {
            frames: [3, 4],
            boxes: [{ id: 0, x: 6.5, y: 9, radius: 3.5, damage: jab, angle: 361, kbg: 50, bkb: 25 }],
          },
        ],
      },
    },
  });
}

registerFighter(counterTester('test-counter'));
