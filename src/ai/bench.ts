import type { InputFrame } from '../input/types';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from '../sim/match';
import type { Replay } from '../sim/replay';
import { createCpu } from './index';
import { staticStage } from './stage';

/**
 * Headless CPU-vs-CPU matches for the benchmark (scripts/ai-bench.ts) and tests: fixed seeds, no renderer, every
 * port driven by a CPU through the same input path a person uses.
 */

export interface CpuMatchOptions {
  seed: number;
  levels: number[];
  fighters?: string[];
  stage?: string;
  stocks?: number;
  /** Time limit in frames (default 8 minutes). */
  maxFrames?: number;
  /** Keep every frame's inputs as a replay. */
  record?: boolean;
}

export interface KoEvent {
  port: number;
  frame: number;
  /**
   * A self-destruct: the fighter had landed (or grabbed a ledge, or respawned) since it was last hit, so nobody
   * knocked it out; it fell or flew off on its own.
   */
  selfDestruct: boolean;
  zone: 'left' | 'right' | 'top' | 'bottom';
}

export interface CpuMatchResult {
  /** Winning port: last one standing, or at time out most stocks then least damage. null on a full tie. */
  winner: number | null;
  frames: number;
  timeout: boolean;
  stocks: number[];
  damage: number[];
  kos: KoEvent[];
  replay?: Replay;
}

export function runCpuMatch(o: CpuMatchOptions): CpuMatchResult {
  const n = o.levels.length;
  const config: MatchConfig = {
    seed: o.seed,
    stage: o.stage ?? 'battlefield',
    stocks: o.stocks ?? 3,
    ports: Array.from({ length: n }, (_, i) => ({ fighter: o.fighters?.[i] ?? 'fireboy' })),
  };
  const state = createMatch(config);
  const cpus = o.levels.map((level, port) => createCpu({ port, level, seed: o.seed * 7919 + port }));
  const maxFrames = o.maxFrames ?? 8 * 60 * 60;
  const safe = new Array<boolean>(n).fill(true);
  const kos: KoEvent[] = [];
  const frames: InputFrame[][] = [];
  while (state.frame < maxFrames && alive(state) > 1) {
    const inputs = cpus.map((c) => c.input(state));
    if (o.record) frames.push(inputs);
    const before = state.fighters.map((f) => f.action);
    stepMatch(state, inputs);
    state.fighters.forEach((f, p) => {
      if (f.launch || f.action === 'hitstun' || f.action === 'tumble') safe[p] = false;
      else if (f.ground !== null || f.action.startsWith('ledge') || f.action === 'respawn') safe[p] = true;
      if (f.action === 'ko' && before[p] !== 'ko') {
        kos.push({ port: p, frame: state.frame, selfDestruct: safe[p]!, zone: zone(state, p) });
      }
    });
  }
  const stocks = state.fighters.map((f) => f.stocks);
  const damage = state.fighters.map((f) => f.damage);
  return {
    winner: winner(state),
    frames: state.frame,
    timeout: alive(state) > 1,
    stocks,
    damage,
    kos,
    replay: o.record ? { version: 1, config, frames } : undefined,
  };
}

function alive(state: MatchState): number {
  return state.fighters.filter((f) => f.stocks > 0).length;
}

function winner(state: MatchState): number | null {
  const ranked = [...state.fighters].sort((a, b) => b.stocks - a.stocks || a.damage - b.damage);
  const [a, b] = ranked;
  if (!a) return null;
  if (b && b.stocks === a.stocks && b.damage === a.damage) return null;
  return a.port;
}

function zone(state: MatchState, port: number): KoEvent['zone'] {
  const { x, y } = state.fighters[port]!.pos;
  const b = staticStage(state.config.stage).blast;
  const gaps = { left: x - b.left, right: b.right - x, top: b.top - y, bottom: y - b.bottom };
  return (Object.keys(gaps) as KoEvent['zone'][]).reduce((a, k) => (gaps[k] < gaps[a] ? k : a));
}
