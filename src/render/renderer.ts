import { Application, Container, Graphics } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { getFighter } from '../fighters/registry';
import type { MatchState } from '../sim/match';
import { getStage } from '../stages/registry';
import type { StageGeometry } from '../sim/stage';
import { Camera } from './camera';
import { InputDisplay } from './debug/inputDisplay';
import { FighterView } from './fighterView';

export interface Overlays {
  inputs: boolean;
  /** Action names over fighters. */
  actions: boolean;
}

export class Renderer {
  readonly world = new Container();
  readonly hud = new Container();
  readonly debug = new Container();
  readonly overlays: Overlays = { inputs: false, actions: false };
  readonly camera = new Camera();
  private readonly inputDisplay = new InputDisplay();
  private readonly stageLayer = new Container();
  private readonly fighterLayer = new Container();
  private fighters: FighterView[] = [];
  private stageId = '';
  private stage: StageGeometry | null = null;
  private matchKey: unknown = null;

  private constructor(readonly app: Application) {
    this.world.addChild(this.stageLayer, this.fighterLayer);
    app.stage.addChild(this.world, this.hud, this.debug);
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

  private sync(state: MatchState): void {
    if (this.stageId !== state.config.stage) {
      this.stageId = state.config.stage;
      this.stage = getStage(state.config.stage);
      this.stageLayer.removeChildren();
      this.stageLayer.addChild(placeholderStage(this.stage));
    }
    if (this.matchKey !== state.config) {
      this.matchKey = state.config;
      this.fighterLayer.removeChildren();
      this.fighters = state.fighters.map((f) => new FighterView(getFighter(f.fighter), f.port));
      for (const v of this.fighters) this.fighterLayer.addChild(v.container);
    }
  }

  /** Draw `state`; `alpha` interpolates between the previous and current simulated frame. */
  render(state: MatchState, alpha: number): void {
    this.sync(state);
    const view = this.camera.update(state, this.stage!);
    this.world.scale.set(view.zoom);
    this.world.position.set(VIEW_WIDTH / 2 - view.x * view.zoom, VIEW_HEIGHT / 2 + view.y * view.zoom);
    state.fighters.forEach((f, i) => this.fighters[i]?.update(f, alpha, state.frame, this.overlays.actions));
    this.inputDisplay.container.visible = this.overlays.inputs;
    if (this.overlays.inputs) this.inputDisplay.update(state.players);
    this.app.render();
  }
}

/** Collision geometry drawn flat, until the stage art lands. */
function placeholderStage(stage: StageGeometry): Graphics {
  const g = new Graphics();
  for (const solid of stage.solids) {
    g.poly(solid.points.flatMap(([x, y]) => [x, -y])).fill('#7a5230');
    const top = solid.points.filter(([, y]) => y === Math.max(...solid.points.map((p) => p[1])));
    const xs = top.map(([x]) => x);
    g.rect(
      Math.min(...xs),
      -Math.max(...solid.points.map((p) => p[1])),
      Math.max(...xs) - Math.min(...xs),
      3,
    ).fill('#3d8f3a');
  }
  for (const p of stage.platforms) g.roundRect(p.x1, -p.y, p.x2 - p.x1, 2.2, 1.1).fill('#d9d2c0');
  return g;
}
