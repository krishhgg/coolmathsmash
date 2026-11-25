import { createMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { runPorts } from '../../sim/testing/sim';

/** Red Ball (P1) against the Mario reference (P2) on Battlefield, both settled on the main stage. */
export function versusMario(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'redball' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  return { m, a, v };
}
