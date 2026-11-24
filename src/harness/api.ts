import type { Game } from '../game';
import type { InputFrame } from '../input/types';
import { DEFAULT_MATCH, type MatchConfig, type MatchState } from '../sim/match';
import { decodeReplay } from '../sim/replay';
import { inputsAt, scriptLength, type ScriptStep } from './script';

/**
 * `window.__smash`: the deterministic control surface used by Playwright tests and the capture harness.
 * Everything crosses the page boundary as JSON.
 */
export interface HarnessApi {
  version: 1;
  /** Stop (true) or resume (false) real-time stepping. The harness always runs manual. */
  setManual(on: boolean): void;
  newMatch(config?: Partial<MatchConfig>): number;
  /** Advance `frames` frames holding `inputs` (one InputFrame per port; neutral when omitted). */
  step(frames?: number, inputs?: InputFrame[]): number;
  /** Advance until match frame `until` (default: the script's end) feeding scripted inputs. */
  runScript(steps: ScriptStep[], until?: number): number;
  loadReplay(text: string, untilFrame?: number): number;
  replay(): string;
  frame(): number;
  getState(): MatchState;
  hash(): string;
  setOverlay(name: 'inputs' | 'actions', on: boolean): void;
  /** Render the current frame and wait until it is on screen. */
  render(): Promise<void>;
}

declare global {
  interface Window {
    __smash?: HarnessApi;
  }
}

export function installHarness(game: Game): HarnessApi {
  const ports = () => game.state.players.length;
  const api: HarnessApi = {
    version: 1,
    setManual: (on) => {
      game.manual = on;
    },
    newMatch: (config) => {
      game.newMatch({ ...DEFAULT_MATCH, ...config });
      return game.state.frame;
    },
    step: (frames = 1, inputs) => {
      for (let i = 0; i < frames; i++)
        game.step(inputs ?? game.state.players.map(() => ({ x: 0, y: 0, cx: 0, cy: 0, buttons: 0 })));
      return game.state.frame;
    },
    runScript: (steps, until = scriptLength(steps)) => {
      while (game.state.frame < until) game.step(inputsAt(steps, game.state.frame, ports()));
      return game.state.frame;
    },
    loadReplay: (text, untilFrame) => {
      const replay = decodeReplay(text);
      game.newMatch(replay.config);
      const end = untilFrame ?? replay.frames.length;
      for (let f = 0; f < end; f++) game.step(replay.frames[f]);
      return game.state.frame;
    },
    replay: () => game.replay(),
    frame: () => game.state.frame,
    getState: () => structuredClone(game.state),
    hash: () => game.hash(),
    setOverlay: (name, on) => {
      game.renderer.overlays[name] = on;
    },
    render: () =>
      new Promise((resolve) => {
        game.renderer.render(game.state, 1);
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__smash = api;
  return api;
}
