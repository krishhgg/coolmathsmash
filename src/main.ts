import { Game } from './game';
import { installHarness } from './harness/api';
import { Renderer } from './render/renderer';

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const params = new URLSearchParams(location.search);
  const renderer = await Renderer.create(root);
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
  game.loop.start();
  document.body.dataset.ready = 'true';
}

void boot();
