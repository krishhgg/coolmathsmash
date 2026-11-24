import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { attack, input, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';

/** Where the Mario reference (98) stands for a kill-percent check: at Battlefield's right ledge. */
const LEDGE_X = 76;

/** Johnny (P1) and the Mario reference (P2), settled on Battlefield. */
function duel(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'johnny' }, { fighter: 'reference-mario' }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [input(), input()]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  return { m, a, v };
}

function step(m: MatchState, holds: Hold[] = []): void {
  stepMatch(m, [input(holds[0]), input(holds[1])]);
}

/** Step until P2 is KO'd off the side or top (true), or has had 300 frames to fly (false). */
function koed(m: MatchState): boolean {
  for (let i = 0; i < 300; i++) {
    step(m);
    for (const e of m.events) if (e.type === 'ko' && e.port === 1) return e.side !== 'bottom';
  }
  return false;
}

function place(f: FighterState, x: number, y: number, ground: FighterState['ground'], action: string): void {
  Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground, action, actionFrame: 1 });
}

/**
 * Does Johnny's `move` KO the Mario reference at `percent` from Battlefield's ledge? Fresh move, no rage, no DI:
 * the roster's "kill ~N%" convention. Johnny faces the near blast zone (away from it for back hits); an aerial is
 * thrown from a hop timed so its first hitbox meets Mario's chest on its first active frame.
 */
export function kos(move: string, percent: number): boolean {
  const def = moves[move]!;
  const { m, a, v } = duel();
  v.damage = percent;
  v.intangible = 0;
  if (def.throw) {
    const back = def.throw.hit.direction === 'back';
    a.facing = back ? -1 : 1;
    place(a, back ? LEDGE_X - 4 : LEDGE_X - 12, 0, a.ground, 'idle');
    place(v, a.pos.x + 12 * a.facing, 0, a.ground, 'idle');
    v.facing = -a.facing as 1 | -1;
    step(m, [{ buttons: ['grab'] }]);
    for (let i = 0; i < 8; i++) step(m);
    if (v.action !== 'grabbed') throw new Error(`grab missed (${v.action})`);
    const dir = {
      fthrow: { x: 100 * a.facing },
      bthrow: { x: -100 * a.facing },
      uthrow: { y: 100 },
      dthrow: { y: -100 },
    };
    step(m, [dir[move as keyof typeof dir]]);
    if (a.move !== move) throw new Error(`expected ${move}, got ${a.move}`);
    return koed(m);
  }
  const first = def.hits[0]!;
  const hb = first.boxes[0]!;
  const back = hb.x < 0;
  a.facing = back ? -1 : 1;
  const ax = LEDGE_X - hb.x * a.facing;
  place(v, LEDGE_X, 0, a.ground, 'idle');
  v.facing = -1;
  if (def.kind === 'aerial') {
    const f = first.frames[0];
    const g = 0.12;
    place(a, ax, Math.max(1, 9 - hb.y), null, 'fall');
    a.vel.y = (g * (f + 1)) / 2;
  } else {
    place(a, ax, 0, a.ground, 'idle');
  }
  attack(m, 0, move);
  return koed(m);
}

/** The lowest percent (step 1) at which `move` KOs from the ledge, or null if it never does below `max`. */
export function killPercent(move: string, max = 250): number | null {
  for (let p = 0; p <= max; p++) if (kos(move, p)) return p;
  return null;
}
