import { Game } from '../../game';
import { loadHudFont } from '../../render/hud';
import { Renderer } from '../../render/renderer';
import { stageIds } from '../../session/roster';
import { defaultSettings } from '../../session/settings';
import { cpuSlot, defaultSetup, humanSlot } from '../../session/setup';
import type { Flow } from '../../ui/app';
import { loadUiFonts } from '../../ui/fonts';
import { UiLayer } from '../../ui/layer';
import { matchScreen } from '../../ui/screens/match';
import type { LabScene } from '../types';
import '../../ui/theme.css';

/** Frames to simulate before each moment, and what to do there. */
const MOMENTS = {
  countdown: 70,
  go: 186,
  pause: 420,
  game: 300,
} as const;

type Moment = keyof typeof MOMENTS;

/**
 * The real match screen over the real renderer at a chosen moment, for captures:
 * `?scene=match&at=countdown|go|pause|game|<frame>&players=2|4`, where a number steps to that match frame. Frames are
 * stepped by hand with a fixed seed, so every run draws the same picture.
 */
export const scene: LabScene = {
  title: 'Match overlays',
  async mount(app, params) {
    const root = document.getElementById('app')!;
    app.canvas.remove();
    const [renderer] = await Promise.all([Renderer.create(root), loadHudFont(), loadUiFonts()]);
    const game = new Game(renderer, true);
    const ids = ['johnny', 'fluffy', 'fireboy', 'wheely'];
    const players = params.get('players') === '4' ? 4 : 2;
    const setup = defaultSetup();
    setup.stage = stageIds()[0]!;
    setup.slots = Array.from({ length: players }, (_, i) => ({
      ...(i === 0 ? humanSlot('kb1') : cpuSlot(3 + i)),
      fighter: ids[i % ids.length]!,
    }));
    const flow: Flow = {
      settings: defaultSettings(),
      setup,
      lastMatch: null,
      game,
      saveSettings: () => {},
      has: () => false,
      go: () => {},
    };
    const layer = new UiLayer(root, renderer.app.canvas);
    const screen = matchScreen(flow, game, 1);
    screen.el.classList.add('screen');
    layer.root.append(screen.el);
    screen.enter?.();
    game.loop.stop();
    game.manual = true;
    const at = (params.get('at') ?? 'countdown') as Moment;
    const step = (frames: number) => {
      for (let i = 0; i < frames; i++) game.step(game.inputSource?.());
    };
    step(/^\d+$/.test(at) ? Number(at) : (MOMENTS[at] ?? MOMENTS.countdown));
    if (at === 'pause') screen.input({ device: 'kb1', action: 'start' });
    if (at === 'game') {
      const loser = game.state.fighters[1]!;
      Object.assign(loser, {
        stocks: 1,
        ground: null,
        action: 'fall',
        pos: { x: 30, y: -300 },
        vel: { x: 0, y: -5 },
      });
      for (let i = 0; i < 240 && game.state.fighters[1]!.action !== 'out'; i++) step(1);
      step(40);
    }
    screen.update?.(0);
    renderer.render(game.state, 1);
  },
};
