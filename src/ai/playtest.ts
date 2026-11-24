import { Game } from '../game';
import { loadHudFont } from '../render/hud';
import { Renderer } from '../render/renderer';
import { DEFAULT_MATCH } from '../sim/match';
import { createCpu, type CpuPlayer } from './index';

/**
 * Dev page for playing a CPU before the menus wire CPUs in. Run `npm run dev` and open
 * /src/ai/playtest.html?level=9: you are port 1 on the keyboard (WASD, F attack, G special, H jump, R shield,
 * T grab) and port 2 is the CPU. `cpus=9,5` puts CPUs on the listed ports instead (an empty entry is a person),
 * `fighters=johnny,fireboy` and `seed=` pick the fighters and the CPU seed. Backspace restarts the match.
 */
async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const [renderer] = await Promise.all([Renderer.create(root), loadHudFont()]);
  const game = new Game(renderer);
  const fighters = (params.get('fighters') ?? 'fireboy,fireboy').split(',');
  const levels = (params.get('cpus') ?? `,${params.get('level') ?? '9'}`).split(',');
  const seed = Number(params.get('seed') ?? '1');
  let cpus: (CpuPlayer | null)[] = [];
  const restart = () => {
    game.newMatch({ ...DEFAULT_MATCH, seed, ports: fighters.map((fighter) => ({ fighter })) });
    cpus = fighters.map((_, port) =>
      levels[port] ? createCpu({ port, level: Number(levels[port]), seed: seed + port }) : null,
    );
  };
  restart();
  game.inputSource = () => game.readDeviceInputs().map((i, port) => cpus[port]?.input(game.state) ?? i);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backspace') restart();
  });
  game.keyboard.attach(window);
  game.loop.start();
  document.body.dataset.ready = 'true';
}

void boot();
