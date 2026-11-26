import { createCpu } from '../ai/index';
import { hashState } from '../engine/hash';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from '../sim/match';

/** A CPU-vs-CPU match played frame by frame, one CPU per port. */
export interface CpuMatch {
  name: string;
  config: MatchConfig;
  cpus: { level: number; seed: number }[];
  frames: number;
}

/**
 * The matches e2e/determinism.spec.ts plays in Node and in Chromium. Their state hashes must agree on every frame.
 * Seeds follow src/ai/bench.ts (port p's CPU gets seed * 7919 + p). The first is bench seed 8, the match a capture
 * first saw drift: level 9 Bloxorz against level 9 Red Ball on Battlefield. The second puts four level 9 CPUs on the
 * stage at once.
 */
export const DETERMINISM_MATCHES: CpuMatch[] = [
  {
    name: 'bench seed 8, level 9 Bloxorz against level 9 Red Ball',
    config: {
      seed: 8,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'bloxorz' }, { fighter: 'redball' }],
    },
    cpus: [
      { level: 9, seed: 8 * 7919 },
      { level: 9, seed: 8 * 7919 + 1 },
    ],
    frames: 3600,
  },
  {
    name: 'bench seed 23, four level 9 CPUs',
    config: {
      seed: 23,
      stage: 'battlefield',
      stocks: 3,
      ports: [
        { fighter: 'raftwars' },
        { fighter: 'fluffy' },
        { fighter: 'redball' },
        { fighter: 'bob-the-robber' },
      ],
    },
    cpus: [0, 1, 2, 3].map((port) => ({ level: 9, seed: 23 * 7919 + port })),
    frames: 900,
  },
];

/** Play `match` in this runtime: the state hash after each of its frames. */
export function frameHashes(match: CpuMatch): string[] {
  const hashes: string[] = [];
  play(match, match.frames, (state) => hashes.push(hashState(state)));
  return hashes;
}

/** The state of `match` after `frame` frames. */
export function stateAt(match: CpuMatch, frame: number): MatchState {
  return play(match, frame);
}

function play(match: CpuMatch, frames: number, onFrame?: (state: MatchState) => void): MatchState {
  const state = createMatch(match.config);
  const cpus = match.cpus.map((cpu, port) => createCpu({ port, ...cpu }));
  while (state.frame < frames) {
    stepMatch(
      state,
      cpus.map((cpu) => cpu.input(state)),
    );
    onFrame?.(state);
  }
  return state;
}
