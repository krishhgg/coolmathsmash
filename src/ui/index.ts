import type { Game } from '../game';
import { App, screensByRoute, type ScreenDef } from './app';
import { loadUiFonts } from './fonts';
import { UiLayer } from './layer';
import './theme.css';

const SCREENS = screensByRoute(
  import.meta.glob<{ screen?: ScreenDef }>(['./screens/*.ts', '!./screens/*.test.ts'], { eager: true }),
);

/** Mount the menus over the game canvas and show the title screen. */
export async function startUi(host: HTMLElement, canvas: HTMLElement, game: Game): Promise<App> {
  await loadUiFonts();
  const app = new App(new UiLayer(host, canvas), SCREENS, game);
  app.start(window);
  app.go('title');
  return app;
}
