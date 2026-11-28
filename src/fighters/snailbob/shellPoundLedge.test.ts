import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { placeInAir, run, testMatch, type Hold } from '../../sim/testing/sim';

/**
 * Shell Pound's drop catches a ledge behind Snail Bob as well as one in front of him. Its Ultimate move, Bowser Bomb,
 * "can be used to snap to ledge, regardless if Bowser is facing the ledge", and "Bowser can grab ledges as soon as he
 * starts to fall" (SmashWiki, "Bowser (SSBU)/Down special": Overview and Timing).
 *
 * Out of a run toward the ledge the grounded move slides on his run speed for its first 10 frames, then hops about 6
 * units further, so pressed within about 14 units of the ledge it carries him past it, facing out. The drop then
 * falls beside the stage's wall, which holds his body 6.6 units out from the ledge. A fighter catches a ledge behind
 * it only within 0.6 of its reach (6 units for Snail Bob), so before he missed it and fell to a KO.
 */

const DOWN_B: Hold = { y: -100, buttons: ['special'] };
/** Battlefield's ledges are at x -80 and 80, y 0. */
const LEDGE = 80;

/** Step until Snail Bob catches a ledge, lands or is KO'd; which one, and the ledge's side when he catches one. */
function end(m: MatchState, f: FighterState): string {
  for (let i = 0; i < 300; i++) {
    run(m, 1);
    if (f.action === 'ledgeCatch') return `ledge ${Math.sign(f.pos.x)}`;
    if (f.action === 'ko' || f.stocks < 3) return 'ko';
    if (f.ground !== null && f.move !== 'downB') return 'landed';
  }
  return f.action;
}

/** Snail Bob runs from the middle toward the `side` ledge and presses down special `gap` units from it. */
function outOfRun(side: 1 | -1, gap: number): string {
  const m = testMatch({ fighter: 'snailbob' });
  const f = m.fighters[0]!;
  for (let i = 0; i < 300 && side * f.pos.x < LEDGE - gap; i++) run(m, 1, { x: 100 * side });
  run(m, 1, DOWN_B);
  expect(f.move).toBe('downB');
  expect(f.facing).toBe(side);
  return end(m, f);
}

/** Snail Bob in the air beside the `side` ledge, facing `facing`, presses down special. */
function besideLedge(side: 1 | -1, facing: 1 | -1, x = 86, y = 20): string {
  const m = testMatch({ fighter: 'snailbob' });
  const f = placeInAir(m, side * x, y, facing);
  run(m, 1, DOWN_B);
  expect(f.move).toBe('downBAir');
  return end(m, f);
}

describe('Snail Bob: Shell Pound catches a ledge whichever way he faces', () => {
  it.each([
    [1, 10],
    [1, 6],
    [-1, 10],
    [-1, 6],
  ] as const)(
    'out of a run toward the %d ledge, pressed %d units from it, the drop catches the ledge behind him',
    (side, gap) => {
      expect(outOfRun(side, gap)).toBe(`ledge ${side}`);
    },
  );

  it.each([1, -1] as const)(
    'in the air beside the %d ledge facing away from it, the drop catches it',
    (side) => {
      expect(besideLedge(side, side)).toBe(`ledge ${side}`);
    },
  );

  it.each([1, -1] as const)(
    'in the air beside the %d ledge facing it, the drop catches it as before',
    (side) => {
      expect(besideLedge(side, -side as 1 | -1)).toBe(`ledge ${side}`);
    },
  );

  it('pressed 30 units from the ledge out of a run, he lands on the stage as before', () => {
    expect(outOfRun(1, 30)).toBe('landed');
    expect(outOfRun(-1, 30)).toBe('landed');
  });
});
