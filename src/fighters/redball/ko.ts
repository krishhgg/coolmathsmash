import { createMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { attack, runPorts, type Hold } from '../../sim/testing/sim';

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

function put(f: FighterState, x: number, y: number, ground: FighterState['ground'], facing: 1 | -1) {
  Object.assign(f, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground,
    action: ground ? 'idle' : 'fall',
    actionFrame: 1,
    facing,
  });
}

/** Steps until P2 is KO'd or settles; true when the launch carries him through the side or top blast zone. */
function koed(m: MatchState, v: FighterState): boolean {
  for (let i = 0; i < 400; i++) {
    runPorts(m, 1, [{}, {}]);
    for (const e of m.events) if (e.type === 'ko' && e.port === v.port) return e.side !== 'bottom';
  }
  return false;
}

/** Mario's spot for the kill tests: standing at the right ledge of Battlefield. */
export const LEDGE_X = 74;

/**
 * Whether `move` KOs Mario standing at the right ledge of Battlefield from `percent`: fresh, no rage, no DI.
 * Red Ball stands `offset` units left of Mario facing `facing`, or hovers `air` units up.
 */
export function kills(move: string, percent: number, offset: number, facing: 1 | -1 = 1, air = 0): boolean {
  const { m, a, v } = versusMario();
  const ground = v.ground;
  put(v, LEDGE_X, 0, ground, -1);
  put(a, LEDGE_X - offset, air, air ? null : ground, facing);
  if (air) a.jumpsUsed = 1;
  v.damage = percent;
  v.intangible = 0;
  attack(m, 0, move);
  return koed(m, v);
}

/** Whether a throw KOs Mario at `percent`, thrown toward the right ledge from just inside it. */
export function throwKills(move: string, percent: number, hold: Hold): boolean {
  const { m, a, v } = versusMario();
  const ground = a.ground;
  const back = move === 'bthrow';
  put(a, back ? LEDGE_X : LEDGE_X - 12, 0, ground, back ? -1 : 1);
  put(v, a.pos.x + 10 * a.facing, 0, ground, -a.facing as 1 | -1);
  v.damage = percent;
  v.intangible = 0;
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  for (let i = 0; i < 20 && v.action !== 'grabbed'; i++) runPorts(m, 1, [{}, {}]);
  if (v.action !== 'grabbed') throw new Error('grab missed');
  runPorts(m, 1, [hold, {}]);
  if (a.move !== move) throw new Error(`expected ${move}, got ${a.move}`);
  return koed(m, v);
}

/** Lowest % (to 1%) at which `ko(percent)` holds, searching 0-300; 999 if it never KOs. */
export function koPercent(ko: (percent: number) => boolean): number {
  if (!ko(300)) return 999;
  let lo = 0;
  let hi = 300;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ko(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
