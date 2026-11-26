import { fighter as fireboy } from '../../fighters/fireboy';
import { defineFighter, type MoveDef } from '../../fighters/types';

/**
 * Marth's Counter in Ultimate (SmashWiki, Marth (SSBU)/Down special): intangible on frames 5-6, catches hits on
 * 6-27 and is interruptible from 65 when nothing hits it. The counter's defaults are Marth's (COUNTER): x1.2, at most
 * 50%, and a 21-frame freeze.
 */
export const marthCounter: MoveDef = {
  kind: 'other',
  faf: 65,
  hits: [],
  intangible: [5, 6],
  counter: { window: [6, 27], move: 'downBHit' },
};

/**
 * Marth's counterattack (same page): intangible 1-8, the swing out on 5-7, interruptible from 42. Its 8% is the
 * counter's minimum, at the Sakurai angle with BKB 90 and KBG 60. The box's size and place are the fixture's.
 */
export const marthCounterattack: MoveDef = {
  kind: 'other',
  faf: 42,
  intangible: [1, 8],
  hits: [
    {
      frames: [5, 7],
      boxes: [{ id: 0, x: 9, y: 8, radius: 8, damage: 8, angle: 361, kbg: 60, bkb: 90 }],
    },
  ],
};

/**
 * A counter that reappears behind the attacker, as Lucario's Double Team does (SmashWiki, Lucario (SSBU)/Down
 * special): it catches on frames 5-24 and is interruptible from 71 on a whiff. Double Team's kick deals a fixed 12.5%
 * at base aura (`multiplier: 0`) at 70 degrees, BKB 50, KBG 105. Its timing is Marth's, because the engine freezes
 * both fighters as Marth's Counter does; Double Team's attacker-only freeze and slowdown are not modelled. 12 units
 * behind is an ESTIMATE that puts the kick in reach.
 */
export const doubleTeam: MoveDef = {
  kind: 'other',
  faf: 71,
  hits: [],
  counter: { window: [5, 24], move: 'downBHit', multiplier: 0, behind: 12 },
};

export const doubleTeamKick: MoveDef = {
  kind: 'other',
  faf: 42,
  intangible: [1, 8],
  hits: [
    {
      frames: [5, 7],
      boxes: [{ id: 0, x: 9, y: 8, radius: 6, damage: 12.5, angle: 70, kbg: 105, bkb: 50 }],
    },
  ],
};

/** A test fighter until Bob's Shadow Step exists: Fireboy with a counter as his down special. */
function counterTester(id: string, downB: MoveDef, downBHit: MoveDef) {
  return defineFighter({
    ...fireboy,
    id,
    name: `Counter tester ${id}`,
    selectable: false,
    moves: { ...fireboy.moves, downB, downBHit },
  });
}

/** Marth's Counter on down special. */
export const counterTesterMarth = counterTester('test-counter', marthCounter, marthCounterattack);
/** The reappear-behind counter on down special. */
export const counterTesterBehind = counterTester('test-counter-behind', doubleTeam, doubleTeamKick);
/** Registered by `?harness` and the tests: `__smash.newMatch({ ports: [{ fighter: 'fireboy' }, { fighter: 'test-counter' }] })`. */
export const COUNTER_TEST_FIGHTERS = [counterTesterMarth, counterTesterBehind];
