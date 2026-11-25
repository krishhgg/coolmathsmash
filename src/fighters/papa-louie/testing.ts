import { createMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { attack, runPorts } from '../../sim/testing/sim';
import { moves } from './moves';

/** Papa Louie (P1) against the Mario reference (P2) on Battlefield, both settled on the stage. */
export function versus(): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'papa-louie' }, { fighter: 'reference-mario' }],
  });
  runPorts(m, 10, [{}, {}]);
  return m;
}

export const firstActive = (move: string) => Math.min(...moves[move]!.hits.map((w) => w.frames[0]));

/**
 * Papa starts \`move\` facing right at (x, y): on the stage when y is 0, else in the air. On the frame before its
 * first hitbox comes out, Mario (at \`percent\`) is put at \`offset\` from Papa, standing or airborne to match.
 * Returns the match, both fighters, and whether the hit KO'd Mario.
 */
export function strike(
  move: string,
  offset: { x: number; y?: number },
  percent: number,
  at: { x?: number; y?: number } = {},
  frames = 400,
) {
  const m = versus();
  const [a, v] = m.fighters as [FighterState, FighterState];
  const x = at.x ?? 0;
  const y = at.y ?? 0;
  const air = y !== 0;
  if (air)
    Object.assign(a, { pos: { x, y }, prevPos: { x, y }, ground: null, action: 'fall', vel: { x: 0, y: 0 } });
  else {
    Object.assign(a, { pos: { x, y: a.pos.y }, prevPos: { x, y: a.pos.y } });
    runPorts(m, 2, [{}, {}]);
  }
  a.facing = 1;
  attack(m, 0, move);
  const ready = firstActive(move) - 1;
  for (let i = 0; i < ready; i++) runPorts(m, 1, [{}, {}]);
  const vy = a.pos.y + (offset.y ?? 0);
  const vx = a.pos.x + offset.x;
  Object.assign(v, {
    pos: { x: vx, y: vy },
    prevPos: { x: vx, y: vy },
    vel: { x: 0, y: 0 },
    ground: air || offset.y ? null : a.ground,
    action: air || offset.y ? 'fall' : 'idle',
    actionFrame: 1,
    damage: percent,
    facing: -1,
  });
  v.intangible = 0;
  return { m, a, v, ko: launchKills(m, a, v, percent, frames) };
}

/**
 * Steps until Mario is KO'd (true) or, once hit and the move is over, his hitstun ends with him still in play
 * (false): a launch that kills crosses a blast zone before he can act, as kill-percent calculators count it.
 */
function launchKills(
  m: MatchState,
  a: FighterState,
  v: FighterState,
  percent: number,
  frames: number,
): boolean {
  for (let i = 0; i < frames; i++) {
    runPorts(m, 1, [{}, {}]);
    if (v.action === 'ko') return true;
    const hit = v.damage > percent;
    if (hit && a.move === null && v.hitlag === 0 && v.launch === null && v.hitstun <= 0) return false;
  }
  return false;
}

/** Papa holding Mario at \`percent\`, Papa at x facing \`facing\`. */
export function holding(percent: number, x = 0, facing: 1 | -1 = 1) {
  const m = versus();
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, { pos: { x, y: 0.5 }, prevPos: { x, y: 0.5 }, ground: null, action: 'fall' });
  runPorts(m, 10, [{}, {}]);
  a.facing = facing;
  const vx = a.pos.x + 11 * facing;
  Object.assign(v, {
    pos: { x: vx, y: a.pos.y },
    prevPos: { x: vx, y: a.pos.y },
    ground: a.ground,
    action: 'idle',
  });
  Object.assign(v, { intangible: 0, damage: percent, facing: -facing });
  runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
  for (let i = 0; i < 12 && v.action !== 'grabbed'; i++) runPorts(m, 1, [{}, {}]);
  return { m, a, v };
}
