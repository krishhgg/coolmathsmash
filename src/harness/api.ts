import { registerFighter } from '../fighters/registry';
import type { Game } from '../game';
import type { InputFrame } from '../input/types';
import type { Overlays } from '../render/renderer';
import type { FighterState } from '../sim/fighter';
import { DEFAULT_MATCH, type MatchConfig, type MatchState } from '../sim/match';
import { decodeReplay } from '../sim/replay';
import { MOBILITY_TEST_FIGHTERS } from '../sim/testing/mobility';
import { registerStage } from '../stages/registry';
import { hazardTestbed } from '../stages/hazardTestbed';
import { testbed } from '../stages/testbed';
import { testCharger } from '../sim/testing/charge';
import {
  SCENARIOS,
  applyPatch,
  findScenario,
  isLabScenario,
  planScenario,
  scenarioConfig,
  scenarioInfo,
  scenarioInputs,
  startScenario,
  summarize,
  type FighterPatch,
  type FighterSummary,
  type GameScenario,
  type ScenarioInfo,
  type ScenarioResult,
} from './scenarios';
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
  /** Overwrite parts of a fighter's state (damage, position next to a ledge...). Vectors merge. */
  patch(port: number, state: FighterPatch): FighterState;
  setOverlay(name: keyof Overlays, on: boolean): void;
  /** Render the current frame and wait until it is on screen. */
  render(): Promise<void>;
  /** The named capture scenarios (src/harness/scenarios.ts), game and lab. */
  scenarios(): ScenarioInfo[];
  /**
   * Start a game scenario and run it to its capture frame (or to `frame`), then render. A scenario the game
   * cannot show yet returns status "pending" with the reason and leaves the match untouched.
   */
  runScenario(name: string, opts?: { frame?: number }): Promise<ScenarioResult>;
  /** Continue the scenario started by runScenario `frames` more frames (its script keeps playing). */
  stepScenario(frames?: number): Promise<{ frame: number; fighters: FighterSummary[]; hash: string }>;
}

declare global {
  interface Window {
    __smash?: HarnessApi;
  }
}

export function installHarness(game: Game): HarnessApi {
  for (const def of MOBILITY_TEST_FIGHTERS) registerFighter(def);
  registerStage(testbed);
  registerStage(hazardTestbed);
  registerFighter(testCharger);
  const ports = () => game.state.players.length;
  let active: GameScenario | null = null;
  const advance = (s: GameScenario) => game.step(scenarioInputs(s, game.state));
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
    patch: (port, state) => {
      const f = game.state.fighters[port];
      if (!f) throw new Error(`no fighter on port ${port}`);
      applyPatch(f, state);
      return structuredClone(f);
    },
    setOverlay: (name, on) => {
      game.renderer.overlays[name] = on;
    },
    render: () =>
      new Promise((resolve) => {
        game.renderer.render(game.state, 1);
        requestAnimationFrame(() => resolve());
      }),
    scenarios: () => SCENARIOS.map(scenarioInfo),
    runScenario: async (name, opts = {}) => {
      const s = findScenario(name);
      if (isLabScenario(s)) throw new Error(`${name} is a lab scenario: open lab.html?scene=${s.page.scene}`);
      const plan = planScenario(s, (req) => req === 'hud' && game.renderer.hud.children.length > 0);
      const target = opts.frame ?? plan.captureFrame;
      if (plan.status === 'pending' || target === undefined) {
        return { name, ...plan, frame: game.state.frame, fighters: summarize(game.state), hash: game.hash() };
      }
      game.newMatch(scenarioConfig(s));
      startScenario(game.state, s);
      active = s;
      while (game.state.frame < target) advance(s);
      await api.render();
      return { name, ...plan, frame: game.state.frame, fighters: summarize(game.state), hash: game.hash() };
    },
    stepScenario: async (frames = 1) => {
      if (!active) throw new Error('no scenario running: call runScenario first');
      for (let i = 0; i < frames; i++) advance(active);
      await api.render();
      return { frame: game.state.frame, fighters: summarize(game.state), hash: game.hash() };
    },
  };
  window.__smash = api;
  return api;
}
