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
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') renderer.overlays.inputs = !renderer.overlays.inputs;
    if (e.code === 'F3') renderer.overlays.actions = !renderer.overlays.actions;
    if (e.code === 'F4') renderer.overlays.hitboxes = !renderer.overlays.hitboxes;
    if (e.code === 'F5') renderer.overlays.events = !renderer.overlays.events;
  });
  if (harness || params.has('debug')) installHarness(game);
  game.loop.start();
  document.body.dataset.ready = 'true';
}

void boot();
