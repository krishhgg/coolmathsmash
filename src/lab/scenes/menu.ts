import type { Flow, Route, ScreenFactory } from '../../ui/app';
import { loadUiFonts } from '../../ui/fonts';
import { UiLayer } from '../../ui/layer';
import { mainMenuScreen } from '../../ui/screens/mainMenu';
import { titleScreen } from '../../ui/screens/title';
import { defaultSettings } from '../../session/settings';
import type { LabScene } from '../types';
import '../../ui/theme.css';

const SCREENS: Partial<Record<Route, ScreenFactory>> = {
  title: titleScreen,
  main: mainMenuScreen,
};

let show: (route: Route) => void = () => {};

/**
 * One menu screen on its own, for development and captures: ?scene=menu&screen=title|main. Every route counts as
 * available; navigating to one without a lab screen does nothing. Screens with no match behind them get a plain backdrop.
 */
export const scene: LabScene = {
  title: 'Menus',
  async mount(app, params) {
    await loadUiFonts();
    const layer = new UiLayer(document.getElementById('app')!, app.canvas);
    let current: HTMLElement | null = null;
    const flow: Flow = {
      settings: defaultSettings(),
      saveSettings: () => {},
      has: () => true,
      go: (route) => show(route),
    };
    show = (route) => {
      const make = SCREENS[route];
      if (!make) return;
      current?.remove();
      current = make(flow).el;
      current.classList.add('screen');
      layer.root.append(current);
    };
    show((params.get('screen') as Route | null) ?? 'title');
  },
  api: {
    show: (route: Route) => show(route),
  },
};
