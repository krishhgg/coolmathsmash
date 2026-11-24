import type { Game } from '../game';
import { App } from './app';
import { loadUiFonts } from './fonts';
import { UiLayer } from './layer';
import { characterSelectScreen } from './screens/characterSelect';
import { mainMenuScreen } from './screens/mainMenu';
import { matchScreen } from './screens/match';
import { titleScreen } from './screens/title';
import './theme.css';

/** Mount the menus over the game canvas and show the title screen. */
export async function startUi(host: HTMLElement, canvas: HTMLElement, game: Game): Promise<App> {
  await loadUiFonts();
  const app = new App(new UiLayer(host, canvas), {
    title: titleScreen,
    main: mainMenuScreen,
    css: characterSelectScreen,
    stages: (flow) => matchScreen(flow, game),
    match: (flow) => matchScreen(flow, game),
  });
  app.start(window);
  app.go('title');
  return app;
}
