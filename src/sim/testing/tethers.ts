import { fighter as fireboy } from '../../fighters/fireboy';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type MoveDef } from '../../fighters/types';

/** Fluffy's Point Grapple (roster neutral special): aim a reticle, release to fire up to 160 units. */
export const pointGrapple: MoveDef = {
  kind: 'other',
  faf: 50,
  hits: [],
  tether: {
    frame: 6,
    range: 160,
    travel: 12,
    angle: 0,
    aimed: { speed: 6, quick: { frames: 6 } },
    latch: ['ledge', 'surface', 'sky'],
    pullSpeed: 4,
    hang: 'jump',
  },
};

/** Fluffy's Quick Grapple (roster up special): straight up, bent ±30° by the stick, 120 units. */
export const quickGrapple: MoveDef = {
  kind: 'other',
  faf: 45,
  hits: [],
  tether: {
    frame: 8,
    range: 120,
    travel: 10,
    angle: 90,
    stickAdjust: 30,
    latch: ['ledge', 'surface', 'sky'],
    pullSpeed: 4,
    hang: 'jump',
  },
};

/** The Fisherman's Line Tether (roster up special): up and forward to a ledge only, his one recovery. */
export const lineTether: MoveDef = {
  kind: 'other',
  faf: 50,
  helpless: true,
  hits: [],
  tether: { frame: 10, range: 70, travel: 8, angle: 45, latch: ['ledge'], pullSpeed: 3 },
};

/**
 * A test fighter until the tether fighters have their specials: Fireboy with Point Grapple as neutral special,
 * Quick Grapple as up special and the Line Tether as side special.
 */
export const tetherTester = defineFighter({
  ...fireboy,
  id: 'test-tether',
  name: 'Tether tester',
  moves: { ...fireboy.moves, neutralB: pointGrapple, upB: quickGrapple, sideB: lineTether },
  selectable: false,
});

registerFighter(tetherTester);
