import { defaultSettings } from '../../session/settings';
import { defaultSetup } from '../../session/setup';
import { screensByRoute, type Flow, type Route, type ScreenDef } from '../../ui/app';
import { loadUiFonts } from '../../ui/fonts';
import { UiLayer } from '../../ui/layer';
import type { LabScene } from '../types';
import '../../ui/theme.css';

const SCREENS = screensByRoute(
  import.meta.glob<{ screen?: ScreenDef }>(['../../ui/screens/*.ts', '!../../ui/screens/*.test.ts'], {
    eager: true,
  }),
);

let show: (route: Route) => void = () => {};

/**
 * One menu screen on its own, for development and captures: `?scene=menu&screen=<route>&preset=<name>`, where the
 * preset is one of that screen's `presets`. Navigating between screens works, except into the match (it needs the
 * game).
 */
export const scene: LabScene = {
  title: 'Menus',
  async mount(app, params) {
    await loadUiFonts();
    const layer = new UiLayer(document.getElementById('app')!, app.canvas);
    let current: HTMLElement | null = null;
    const flow: Flow = {
      settings: defaultSettings(),
      setup: defaultSetup(),
      game: null,
      saveSettings: () => {},
      has: (route) => route in SCREENS && !SCREENS[route]!.needsGame,
      go: (route) => show(route),
    };
    show = (route) => {
      const def = SCREENS[route];
      if (!def || def.needsGame) return;
      current?.remove();
      const screen = def.create(flow);
      current = screen.el;
      current.classList.add('screen');
      layer.root.append(current);
      screen.enter?.();
    };
    const route = (params.get('screen') as Route | null) ?? 'title';
    SCREENS[route]?.presets?.[params.get('preset') ?? '']?.(flow);
    show(route);
  },
  api: {
    show: (route: Route) => show(route),
  },
};
