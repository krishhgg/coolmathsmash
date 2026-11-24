import { createMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { attack, runPorts, type Hold } from '../../sim/testing/sim';

/**
 * Kill-% probes for tests: the roster's "kill ~N%" means the move KOs Mario at Battlefield's ledge, fresh, with no
 * rage and no DI. The Duck stands at the right ledge facing it, the Mario reference stands `reach` units in front
 * (behind for back hits), both at rest; `air` lifts both off the floor for aerials.
 */
export interface KoSetup {
  move: string;
  /** Horizontal distance from the Duck to Mario, positive in front. */
  reach: number;
  /** Duck's height above the floor (aerials) and Mario's. */
  duckY?: number;
  victimY?: number;
  /** Throws: the input that picks the throw from a standing grab. */
  throwInput?: (facing: number) => Hold;
  /** Stage x of the victim (default: at the right ledge). */
  at?: number;
}

function duel(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'duck' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  return { m, a, v };
}

function place(f: FighterState, x: number, y: number, ground: FighterState['ground'], facing: 1 | -1) {
  Object.assign(f, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground: y > 0 ? null : ground,
    action: y > 0 ? 'fall' : 'idle',
    actionFrame: 1,
    facing,
    intangible: 0,
    jumpsUsed: y > 0 ? 1 : 0,
  });
}

/** True when `s` KOs the victim from `percent`. */
export function kos(s: KoSetup, percent: number): boolean {
  const { m, a, v } = duel();
  const ground = a.ground;
  const victimX = s.at ?? 78;
  const facing: 1 | -1 = s.reach >= 0 ? 1 : -1;
  if (s.throwInput) {
    place(a, victimX - 11, 0, ground, 1);
    const back = s.move === 'bthrow';
    if (back) place(a, victimX - 11, 0, ground, 1);
    place(v, victimX, 0, ground, -1);
    if (back) {
      place(a, victimX, 0, ground, -1);
      place(v, victimX - 11, 0, ground, 1);
    }
    v.damage = percent;
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 7, [{}, {}]);
    if (v.action !== 'grabbed') throw new Error('grab missed');
    runPorts(m, 1, [s.throwInput(a.facing), {}]);
    if (a.move !== s.move) throw new Error(`expected ${s.move}, got ${a.move}`);
  } else {
    place(a, victimX - Math.abs(s.reach), s.duckY ?? 0, ground, facing);
    place(v, victimX, s.victimY ?? 0, ground, -1);
    v.damage = percent;
    attack(m, 0, s.move);
  }
  for (let i = 0; i < 400; i++) {
    runPorts(m, 1, [{}, {}]);
    if (v.action === 'ko') return true;
    if (v.launch === null && v.hitstun <= 0 && v.kb.x === 0 && v.kb.y === 0 && i > 60) return false;
  }
  return false;
}

/** The lowest whole percent at which `s` KOs (binary search over 0-400). */
export function koPercent(s: KoSetup): number {
  let lo = 0;
  let hi = 400;
  if (!kos(s, hi)) return Infinity;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kos(s, mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
