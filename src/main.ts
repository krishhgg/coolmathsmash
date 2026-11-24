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
  game.keyboard.attach(window);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') renderer.overlays.inputs = !renderer.overlays.inputs;
  });
  if (harness || params.has('debug')) installHarness(game);
  game.loop.start();
  document.body.dataset.ready = 'true';
}

void boot();
