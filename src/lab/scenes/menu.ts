import type { Flow, Route, ScreenFactory } from '../../ui/app';
import { loadUiFonts } from '../../ui/fonts';
import { UiLayer } from '../../ui/layer';
import { mainMenuScreen } from '../../ui/screens/mainMenu';
import { titleScreen } from '../../ui/screens/title';
import { defaultSettings } from '../../session/settings';
import { cpuSlot, defaultSetup, humanSlot, pickFighter, type MatchSetup } from '../../session/setup';
import { characterSelectScreen } from '../../ui/screens/characterSelect';
import type { LabScene } from '../types';
import '../../ui/theme.css';

const SCREENS: Partial<Record<Route, ScreenFactory>> = {
  title: titleScreen,
  main: mainMenuScreen,
  css: characterSelectScreen,
};

/** Character select line-ups for captures: `&preset=2p|4p`. */
const PRESETS: Record<string, (setup: MatchSetup) => void> = {
  '2p': (s) => {
    pickFighter(s, 0, 'fireboy');
    s.slots[1]!.level = 9;
  },
  '4p': (s) => {
    s.slots = [humanSlot('kb1'), humanSlot('pad1'), cpuSlot(5), cpuSlot(9)];
    pickFighter(s, 0, 'fireboy');
    pickFighter(s, 2, 'fireboy');
  },
};

let show: (route: Route) => void = () => {};

/**
 * One menu screen on its own, for development and captures: ?scene=menu&screen=title|main|css (&preset=2p|4p). Every route counts as
 * available; navigating to one without a lab screen does nothing. Screens with no match behind them get a plain backdrop.
 */
export const scene: LabScene = {
  title: 'Menus',
  async mount(app, params) {
    await loadUiFonts();
    const layer = new UiLayer(document.getElementById('app')!, app.canvas);
    let current: HTMLElement | null = null;
    const setup = defaultSetup();
    PRESETS[params.get('preset') ?? '']?.(setup);
    const flow: Flow = {
      settings: defaultSettings(),
      setup,
      saveSettings: () => {},
      has: () => true,
      go: (route) => show(route),
    };
    show = (route) => {
      const make = SCREENS[route];
      if (!make) return;
      current?.remove();
      const screen = make(flow);
      current = screen.el;
      current.classList.add('screen');
      layer.root.append(current);
      screen.enter?.();
    };
    show((params.get('screen') as Route | null) ?? 'title');
  },
  api: {
    show: (route: Route) => show(route),
  },
};
