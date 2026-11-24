import { neutralInput, type InputFrame } from '../input/types';
import { createControl, feedControl, type ControlState } from './control';

export interface PortConfig {
  fighter: string;
  /** Flicking up jumps. On by default, like Smash. */
  tapJump?: boolean;
}

export interface MatchConfig {
  seed: number;
  stage: string;
  stocks: number;
  ports: PortConfig[];
}

export interface PlayerState {
  port: number;
  tapJump: boolean;
  control: ControlState;
}

/** The whole simulation. Plain data only: it can be hashed, cloned and replayed. */
export interface MatchState {
  frame: number;
  rng: number;
  config: MatchConfig;
  players: PlayerState[];
}

export const DEFAULT_MATCH: MatchConfig = {
  seed: 1,
  stage: 'battlefield',
  stocks: 3,
  ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
};

export function createMatch(config: MatchConfig = DEFAULT_MATCH): MatchState {
  return {
    frame: 0,
    rng: config.seed | 0,
    config: structuredClone(config),
    players: config.ports.map((p, port) => ({ port, tapJump: p.tapJump ?? true, control: createControl() })),
  };
}

/** Advance the match by exactly one 1/60 s frame. `inputs[port]` is that port's controller this frame. */
export function stepMatch(state: MatchState, inputs: readonly InputFrame[]): void {
  for (const player of state.players) feedControl(player.control, inputs[player.port] ?? neutralInput());
  state.frame++;
}
