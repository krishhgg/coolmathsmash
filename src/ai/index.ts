import type { InputFrame } from '../input/types';
import type { MatchState } from '../sim/match';
import { Cpu } from './cpu';

export { CPU_LEVELS, MAX_LEVEL, MIN_LEVEL, cpuLevel, type CpuLevel } from './levels';
export type { CpuHints } from './hints';

/**
 * A computer player for one port. Call `input` once per frame, before `stepMatch`, with the current match; it
 * returns that port's controller input for the frame, exactly like a person's, so replays of CPU matches are exact.
 * Deterministic for a given seed and match.
 */
export interface CpuPlayer {
  input(state: Readonly<MatchState>): InputFrame;
}

export function createCpu(opts: { port: number; level: number; seed: number }): CpuPlayer {
  return new Cpu(opts.port, opts.level, opts.seed);
}
