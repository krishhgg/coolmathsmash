import { registerFighter } from '../../fighters/registry';
import { buttonBit, neutralInput, type ButtonName, type InputFrame } from '../../input/types';
import { createMatch, stepMatch, type MatchState } from '../match';
import { compiledStage } from '../step';
import type { FighterState } from '../fighter';
import { marioReference } from './reference';

registerFighter(marioReference);

export type Hold = Partial<Omit<InputFrame, 'buttons'>> & { buttons?: ButtonName[] };

export function input(h: Hold = {}): InputFrame {
  const i = neutralInput();
  if (h.x !== undefined) i.x = h.x;
  if (h.y !== undefined) i.y = h.y;
  if (h.cx !== undefined) i.cx = h.cx;
  if (h.cy !== undefined) i.cy = h.cy;
  for (const b of h.buttons ?? []) i.buttons |= buttonBit(b);
  return i;
}

/** A 1-player (or n-player) match on Battlefield with the Mario reference fighter, settled on the ground. */
export function testMatch(opts: { fighter?: string; players?: number; x?: number } = {}): MatchState {
  const fighter = opts.fighter ?? marioReference.id;
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: Array.from({ length: opts.players ?? 1 }, () => ({ fighter })),
  });
  if (opts.x !== undefined) m.fighters[0]!.pos.x = opts.x;
  run(m, 10);
  return m;
}

/** Step `frames` frames; `hold` is port 0's input (or a function of the step index). */
export function run(m: MatchState, frames: number, hold: Hold | ((i: number) => Hold) = {}): void {
  for (let i = 0; i < frames; i++) {
    const h = typeof hold === 'function' ? hold(i) : hold;
    stepMatch(m, [input(h), ...m.players.slice(1).map(() => neutralInput())]);
  }
}

/** Step until `pred` holds (max `limit` frames); returns frames stepped. */
export function until(
  m: MatchState,
  pred: (f: FighterState) => boolean,
  hold: Hold = {},
  limit = 600,
): number {
  for (let i = 0; i < limit; i++) {
    if (pred(m.fighters[0]!)) return i;
    run(m, 1, hold);
  }
  throw new Error(`condition not reached in ${limit} frames (action ${m.fighters[0]!.action})`);
}

/** Put fighter 0 airborne at (x, y), falling, with fresh air options. */
export function placeInAir(m: MatchState, x: number, y: number, facing: 1 | -1 = 1): FighterState {
  const f = m.fighters[0]!;
  Object.assign(f, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    actionFrame: 1,
    jumpsUsed: 1,
    facing,
    airDodgeUsed: false,
    fastFalling: false,
  });
  return f;
}

/** Put fighter `port` into `move`; its frame 1 is the next simulated frame. */
export function attack(m: MatchState, port: number, move: string): FighterState {
  const f = m.fighters[port]!;
  Object.assign(f, { action: f.ground ? 'attack' : 'aerial', actionFrame: 0, move, hitVictims: [] });
  return f;
}

/** Step with one input per port. */
export function runPorts(m: MatchState, frames: number, holds: Hold[]): void {
  for (let i = 0; i < frames; i++)
    stepMatch(
      m,
      m.players.map((p) => input(holds[p.port])),
    );
}

export const stage = () => compiledStage('battlefield');
