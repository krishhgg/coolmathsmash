import { Application, Container, Graphics } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { MatchState } from '../sim/match';
import { InputDisplay } from './debug/inputDisplay';

/** World units (Smash units, y up) to screen pixels for the fixed framing used until the dynamic camera lands. */
const PX_PER_UNIT = VIEW_WIDTH / 240;
const ORIGIN_Y = VIEW_HEIGHT * 0.62;

export interface Overlays {
  inputs: boolean;
}

export class Renderer {
  readonly world = new Container();
  readonly hud = new Container();
  readonly debug = new Container();
  readonly overlays: Overlays = { inputs: false };
  private readonly inputDisplay = new InputDisplay();

  private constructor(readonly app: Application) {
    this.world.position.set(VIEW_WIDTH / 2, ORIGIN_Y);
    this.world.scale.set(PX_PER_UNIT);
    app.stage.addChild(this.world, this.hud, this.debug);
    this.world.addChild(placeholderStage());
    this.debug.addChild(this.inputDisplay.container);
  }

  static async create(parent: HTMLElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      background: '#4fb3ff',
      antialias: true,
      preference: 'webgl',
      preserveDrawingBuffer: true,
      autoStart: false,
    });
    parent.appendChild(app.canvas);
    return new Renderer(app);
  }

  /** Draw `state`; `alpha` interpolates between the previous and current simulated frame. */
  render(state: MatchState, _alpha: number): void {
    this.inputDisplay.container.visible = this.overlays.inputs;
    if (this.overlays.inputs) this.inputDisplay.update(state.players);
    this.app.render();
  }
}

/** Battlefield's collision outline (Smash Ultimate units) until the real stage art arrives. */
function placeholderStage(): Graphics {
  const g = new Graphics();
  const hull: [number, number][] = [
    [-80, 0],
    [80, 0],
    [80, -8.3],
    [64.4, -25.1],
    [41.4, -40.1],
    [-41.4, -40.1],
    [-64.4, -25.1],
    [-80, -8.3],
  ];
  g.poly(hull.flatMap(([x, y]) => [x, -y])).fill('#7a5230');
  g.rect(-80, 0, 160, 3).fill('#3d8f3a');
  for (const [x1, x2, y] of [
    [-59.4, -24.8, 24.1],
    [-17.3, 17.3, 47.2],
    [24.8, 59.4, 24.1],
  ] as const) {
    g.roundRect(x1, -y, x2 - x1, 2.2, 1.1).fill('#d9d2c0');
  }
  return g;
}
