import { Application, Text } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { LabScene } from './types';

const modules = import.meta.glob<{ scene: LabScene }>('./scenes/*.ts');
const sceneName = (path: string) => path.replace('./scenes/', '').replace(/\.ts$/, '');

declare global {
  interface Window {
    __lab?: { scenes: string[]; scene: string; call(name: string, ...args: unknown[]): Promise<unknown> };
  }
}

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  const params = new URLSearchParams(location.search);
  const app = new Application();
  await app.init({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    background: params.get('bg') ?? '#2a2f3a',
    antialias: true,
    preference: 'webgl',
    preserveDrawingBuffer: true,
  });
  root.appendChild(app.canvas);

  const names = Object.keys(modules).map(sceneName).sort();
  const name = params.get('scene') ?? '';
  const loader = modules[`./scenes/${name}.ts`];
  if (!loader) {
    const list = new Text({
      text: `Lab scenes (?scene=name):\n${names.join('\n')}`,
      style: { fontFamily: 'monospace', fontSize: 20, fill: '#ffffff' },
    });
    list.position.set(40, 40);
    app.stage.addChild(list);
  }
  const scene = loader ? (await loader()).scene : undefined;
  if (scene) await scene.mount(app, params);
  window.__lab = {
    scenes: names,
    scene: name,
    call: async (fn, ...args) => {
      const f = scene?.api?.[fn] as ((...a: unknown[]) => unknown) | undefined;
      if (!f) throw new Error(`scene ${name} has no api function ${fn}`);
      const result = await f(...args);
      await new Promise((r) => requestAnimationFrame(r));
      return result;
    },
  };
  document.body.dataset.ready = 'true';
}

void boot();
