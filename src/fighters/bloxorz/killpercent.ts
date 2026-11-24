import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { attack, placeInAir, runPorts, testMatch, type Hold } from '../../sim/testing/sim';

/** Where Mario stands for a kill-% measurement: the right ledge of Battlefield is at x = 80. */
export const LEDGE_X = 76;

/** A 1v1 on Battlefield: the block (P1) against the Mario reference (P2) standing at the right ledge at `percent`. */
function atLedge(percent: number): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ fighter: 'bloxorz', players: 2 });
  m.config.ports[1]!.fighter = 'reference-mario';
  const [a, v] = m.fighters as [FighterState, FighterState];
  v.fighter = 'reference-mario';
  Object.assign(v, {
    pos: { x: LEDGE_X, y: 0 },
    prevPos: { x: LEDGE_X, y: 0 },
    ground: a.ground,
    action: 'idle',
    actionFrame: 1,
    vel: { x: 0, y: 0 },
    facing: -1,
    damage: percent,
    intangible: 0,
  });
  runPorts(m, 2, [{}, {}]);
  Object.assign(v, { damage: percent, pos: { x: LEDGE_X, y: v.pos.y }, prevPos: { x: LEDGE_X, y: v.pos.y } });
  return { m, a, v };
}

/**
 * Step until the victim is KO'd; true when it crosses the side or top blast zone. Falling out of the bottom after
 * drifting off the ledge doesn't count: Mario stands still and never recovers.
 */
function launchedOut(m: MatchState, v: FighterState): boolean {
  for (let i = 0; i < 400; i++) {
    runPorts(m, 1, [{}, {}]);
    const ko = m.events.find((e) => e.type === 'ko' && e.port === v.port);
    if (ko) return ko.type === 'ko' && ko.side !== 'bottom';
  }
  return false;
}

export interface KillSetup {
  /** The block's offset from Mario (negative: the block stands left of him). */
  dx: number;
  /** Height above the stage for an aerial (omit for a grounded move). */
  air?: number;
  facing: 1 | -1;
}

/** True when `move` at `percent` KOs Mario at the ledge (fresh, no rage, no DI). Throws if the move never hits. */
export function kosAt(move: string, percent: number, setup: KillSetup): boolean {
  const { m, a, v } = atLedge(percent);
  const x = LEDGE_X + setup.dx;
  if (setup.air !== undefined) placeInAir(m, x, setup.air, setup.facing);
  else Object.assign(a, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing: setup.facing, action: 'idle' });
  attack(m, 0, move);
  const ko = launchedOut(m, v);
  if (v.damage <= percent) throw new Error(`${move} never hit`);
  return ko;
}

/** True when `throwMove` (picked by `hold`) at `percent` KOs Mario, the block standing `dx` from the ledge. */
export function throwKosAt(hold: Hold, percent: number, facing: 1 | -1): boolean {
  const { m, a, v } = atLedge(percent);
  const x = facing === 1 ? LEDGE_X - 9 : LEDGE_X;
  const vx = x + 9 * facing;
  Object.assign(a, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing, action: 'idle' });
  Object.assign(v, { pos: { x: vx, y: 0 }, prevPos: { x: vx, y: 0 } });
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  runPorts(m, 10, [{}, {}]);
  if (v.action !== 'grabbed') throw new Error(`grab missed (${v.action})`);
  runPorts(m, 1, [hold, {}]);
  return launchedOut(m, v);
}

/** The lowest whole % at which `ko(percent)` holds, by bisection over 0-300 (300 when it never does). */
export function lowestKo(ko: (percent: number) => boolean): number {
  let lo = 0;
  let hi = 300;
  if (!ko(hi)) return hi;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ko(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
