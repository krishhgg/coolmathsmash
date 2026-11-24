import { Application, Graphics, Text } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from './config';

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const app = new Application();
  await app.init({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    background: '#4fb3ff',
    antialias: true,
    preference: 'webgl',
    preserveDrawingBuffer: true,
  });
  root.appendChild(app.canvas);

  const stage = new Graphics()
    .roundRect(340, 440, 600, 60, 18)
    .fill('#3d8f3a')
    .roundRect(340, 470, 600, 90, 18)
    .fill('#7a5230');
  for (const [x, y] of [
    [400, 340],
    [740, 340],
    [570, 250],
  ] as const) {
    stage.roundRect(x, y, 140, 14, 7).fill('#d9d2c0');
  }
  app.stage.addChild(stage);

  const title = new Text({
    text: 'Coolmath Smash',
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 64,
      fill: '#ffffff',
      stroke: { color: '#1b2a4a', width: 8 },
    },
  });
  title.anchor.set(0.5);
  title.position.set(VIEW_WIDTH / 2, 120);
  app.stage.addChild(title);

  document.body.dataset.ready = 'true';
}

void boot();
