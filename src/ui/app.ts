import { padSlots } from '../input/gamepad';
import { loadSettings, saveSettings, type Settings } from '../session/settings';
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

/** What a screen can do to the rest of the game. */
export interface Flow {
  readonly settings: Settings;
  /** Players, stage and rules, kept across screens and rematches. */
  readonly setup: MatchSetup;
  saveSettings(): void;
  go(route: Route): void;
  /** Whether that screen exists yet. */
  has(route: Route): boolean;
}

export type ScreenFactory = (flow: Flow) => Screen;

/** Owns the current screen, feeds it menu input every animation frame, and switches screens by route. */
export class App implements Flow {
  readonly settings: Settings = loadSettings();
  readonly setup: MatchSetup = defaultSetup();
  readonly input = new MenuInput(() => this.settings.keyboard);
  private screen: Screen | null = null;
  route: Route | null = null;

  constructor(
    readonly layer: UiLayer,
    private readonly screens: Partial<Record<Route, ScreenFactory>>,
  ) {}

  has(route: Route): boolean {
    return route in this.screens;
  }

  go(route: Route): void {
    const make = this.screens[route];
    if (!make) return;
    this.screen?.leave?.();
    this.screen?.el.remove();
    this.input.clear();
    this.route = route;
    const next = make(this);
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
