import { Game } from './game';
import { installHarness } from './harness/api';
import { loadHudFont } from './render/hud';
import { Renderer } from './render/renderer';
import { startUi } from './ui';

/**
 * Boots the renderer and game. Normally the menus come up first; `?harness` (the capture harness and Playwright) and
 * `?match` go straight into the default match.
 */
async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const params = new URLSearchParams(location.search);
  const [renderer] = await Promise.all([Renderer.create(root), loadHudFont()]);
  const harness = params.has('harness');
  const game = new Game(renderer, harness);
  renderer.overlays.inputs = params.has('inputs');
  renderer.overlays.actions = params.has('actions');
  renderer.overlays.hitboxes = params.has('hitboxes');
  renderer.overlays.events = params.has('events');
  game.onEvents((events, state) => renderer.eventLog.record(events, state.frame));
  game.keyboard.attach(window);
  const toggles: Record<string, keyof typeof renderer.overlays> = {
    F2: 'inputs',
    F3: 'actions',
    F4: 'hitboxes',
    F5: 'events',
  };
  window.addEventListener('keydown', (e) => {
    const overlay = toggles[e.code];
    if (!overlay) return;
    e.preventDefault();
    renderer.overlays[overlay] = !renderer.overlays[overlay];
  });
  if (harness || params.has('debug')) installHarness(game);
  if (harness || params.has('match')) game.loop.start();
  else await startUi(root, renderer.app.canvas, game);
  document.body.dataset.ready = 'true';
}

void boot();
