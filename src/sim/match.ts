import { neutralInput, type InputFrame } from '../input/types';
import { getStage } from '../stages/registry';
import { createControl, feedControl, type ControlState } from './control';
import { createFighter, type FighterState } from './fighter';
import { resolveHits } from './combat/hits';
import { emit, type SimEvent } from './events';
import { pushApart } from './movement';
import { advanceStage, posedStage, stageStateAt, type StageState } from './movingStage';
import { stepFighter } from './step';

export interface PortConfig {
  fighter: string;
  /** Flicking up jumps. On by default, like Smash. */
  tapJump?: boolean;
  /** Costume: a key of the fighter's `art.palettes` (`default` when absent). Presentation only. */
  costume?: string;
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
  fighters: FighterState[];
  /** What happened during the last frame (see SimEvent). */
  events: SimEvent[];
  /** Where each solid and platform is on this frame (moving and vanishing pieces, src/sim/movingStage.ts). */
  stage: StageState;
}

export const DEFAULT_MATCH: MatchConfig = {
  seed: 1,
  stage: 'battlefield',
  stocks: 3,
  ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
};

export function createMatch(config: MatchConfig = DEFAULT_MATCH): MatchState {
  const stage = getStage(config.stage);
  return {
    frame: 0,
    rng: config.seed | 0,
    config: structuredClone(config),
    players: config.ports.map((p, port) => ({ port, tapJump: p.tapJump ?? true, control: createControl() })),
    fighters: config.ports.map((p, port) =>
      createFighter(port, p.fighter, stage.spawns[port % stage.spawns.length]!, config.stocks),
    ),
    events: [],
    stage: stageStateAt(stage, 0),
  };
}

/** Advance the match by exactly one 1/60 s frame. `inputs[port]` is that port's controller this frame. */
export function stepMatch(state: MatchState, inputs: readonly InputFrame[]): void {
  state.events = [];
  const before = state.fighters.map((f) => f.action);
  for (const player of state.players) feedControl(player.control, inputs[player.port] ?? neutralInput());
  for (const f of state.fighters) stepFighter(state, f, state.players[f.port]!);
  pushApart(state, posedStage(state));
  advanceStage(state);
  resolveHits(state);
  state.fighters.forEach((f, i) => {
    if (f.action !== before[i]) emit(state, { type: 'action', port: f.port, from: before[i]!, to: f.action });
  });
  state.frame++;
}
