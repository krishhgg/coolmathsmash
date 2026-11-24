import { neutralInput, type InputFrame } from '../input/types';
import type { MatchState } from '../sim/match';

/** A computer player: called once per frame, before the frame is simulated, for its port's controller. */
export interface CpuPlayer {
  input(state: Readonly<MatchState>): InputFrame;
}

export interface CpuOptions {
  port: number;
  /** 1-9, as on the character select. */
  level: number;
  /** For the CPU's own seeded randomness; never Math.random, so matches replay exactly. */
  seed: number;
}

export type CpuFactory = (opts: CpuOptions) => CpuPlayer;

/**
 * The one seam between the match and the CPU AI: `src/ai/index.ts` (the CPU AI thread) exports `createCpu: CpuFactory`.
 * Until that file exists, CPUs stand still.
 */
const ai = Object.values(import.meta.glob<{ createCpu?: CpuFactory }>('../ai/index.ts', { eager: true }))[0];

export function createCpu(opts: CpuOptions): CpuPlayer {
  return ai?.createCpu?.(opts) ?? { input: () => neutralInput() };
}
