import { audio } from '../audio';
import type { Game } from '../game';
import { padSlots } from '../input/gamepad';
import { loadSettings, saveSettings, type Settings } from '../session/settings';
import type { FinishedMatch } from '../session/match';
import { defaultSetup, type MatchSetup } from '../session/setup';
import { MenuInput, type MenuEvent } from './input';
import type { UiLayer } from './layer';

/** One full-screen page of the UI (title, menus, character select...) or the match overlay. */
export interface Screen {
  readonly el: HTMLElement;
  input(e: MenuEvent): void;
  /** Every animation frame while shown. */
  update?(now: number): void;
  enter?(): void;
  leave?(): void;
}

export type Route = 'title' | 'main' | 'css' | 'stages' | 'match' | 'results' | 'controls' | 'options';

/** How deep each screen sits, so going to a shallower one sounds like "back". */
const DEPTH: Record<Route, number> = {
  title: 0,
  main: 1,
  controls: 2,
  options: 2,
  css: 2,
  stages: 3,
  match: 4,
  results: 5,
};

/** What a screen can do to the rest of the game. */
export interface Flow {
  readonly settings: Settings;
  /** Players, stage and rules, kept across screens and rematches. */
  readonly setup: MatchSetup;
  /** The match that just ended, for the results screen. */
  lastMatch: FinishedMatch | null;
  saveSettings(): void;
  go(route: Route): void;
  /** Whether that screen exists yet. */
  has(route: Route): boolean;
  /** The game the match screens drive; null in the lab, which shows screens on their own. */
  readonly game: Game | null;
}

/**
 * A screen module: every `src/ui/screens/*.ts` exports `screen: ScreenDef` and is found automatically, so adding a
 * screen edits no shared file.
 */
export interface ScreenDef {
  route: Route;
  create(flow: Flow): Screen;
  /** Needs the running game (the match), so the lab cannot show it. */
  needsGame?: boolean;
  /**
   * Named line-ups for the lab and captures (`lab.html?scene=menu&screen=<route>&preset=<name>`): each sets up the
   * flow (players, results...) before the screen opens.
   */
  presets?: Record<string, (flow: Flow) => void>;
}

/** Every screen module, by route. `modules` is the result of an eager `import.meta.glob` of the screens folder. */
export function screensByRoute(
  modules: Record<string, { screen?: ScreenDef }>,
): Partial<Record<Route, ScreenDef>> {
  return Object.fromEntries(
    Object.values(modules).flatMap((m) => (m.screen ? [[m.screen.route, m.screen] as const] : [])),
  );
}

/** Owns the current screen, feeds it menu input every animation frame, and switches screens by route. */
export class App implements Flow {
  readonly settings: Settings = loadSettings();
  readonly setup: MatchSetup = defaultSetup();
  lastMatch: FinishedMatch | null = null;
  readonly input = new MenuInput(
    () => this.settings.keyboard,
    () => (this.route === 'match' ? this.settings.gamepad.start : null),
  );
  private screen: Screen | null = null;
  route: Route | null = null;

  constructor(
    readonly layer: UiLayer,
    private readonly screens: Partial<Record<Route, ScreenDef>>,
    readonly game: Game | null = null,
  ) {}

  has(route: Route): boolean {
    return route in this.screens;
  }

  go(route: Route): void {
    const def = this.screens[route];
    if (!def) return;
    if (this.route)
      audio.ui(route === 'match' ? 'start' : DEPTH[route] < DEPTH[this.route] ? 'back' : 'select');
    if (route !== 'match') audio.music('menu');
    this.screen?.leave?.();
    this.screen?.el.remove();
    this.input.clear();
    this.route = route;
    const next = def.create(this);
    this.screen = next;
    next.el.classList.add('screen');
    this.layer.root.append(next.el);
    next.enter?.();
  }

  saveSettings(): void {
    saveSettings(this.settings);
  }

  /** Deliver input to the current screen; events left over after a screen change are dropped. */
  tick(now: number): void {
    const screen = this.screen;
    for (const e of this.input.poll(now, padSlots())) {
      if (this.screen !== screen) break;
      screen?.input(e);
    }
    this.screen?.update?.(now);
  }

  start(target: Window): void {
    this.input.attach(target);
    const frame = (now: number) => {
      this.tick(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
