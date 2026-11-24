import { Application, Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { getFighter } from '../fighters/registry';
import type { MatchState } from '../sim/match';
import { getStage } from '../stages/registry';
import type { StageView } from '../stages/battlefield/view';
import type { StageGeometry } from '../sim/stage';
import { activeHitboxes, hurtbox } from '../sim/combat/hits';
import { Camera } from './camera';
import { EventLog } from './debug/eventLog';
import { InputDisplay } from './debug/inputDisplay';
import { FighterView } from './fighterView';

/** Stage art: src/stages/<id>/view.ts exports createStageView (docs/stages.md). Stages without one draw flat. */
const STAGE_VIEWS = import.meta.glob<{ createStageView: () => StageView }>('../stages/*/view.ts', {
  eager: true,
});

export interface Overlays {
  inputs: boolean;
  /** Action names over fighters. */
  actions: boolean;
  /** Hurtboxes (yellow) and active hitboxes (red). */
  hitboxes: boolean;
  /** The latest sim events. */
  events: boolean;
}

export class Renderer {
  /** Screen-space stage backdrop, drawn into `backdrop` rather than straight to the screen. */
  readonly background = new Container();
  readonly world = new Container();
  readonly hud = new Container();
  readonly debug = new Container();
  readonly overlays: Overlays = { inputs: false, actions: false, hitboxes: false, events: false };
  readonly eventLog = new EventLog();
  readonly camera = new Camera();
  private readonly inputDisplay = new InputDisplay();
  private readonly stageLayer = new Container();
  private readonly fighterLayer = new Container();
  private readonly foregroundLayer = new Container();
  private stageView: StageView | null = null;
  /**
   * The backdrop renders at half resolution: its layers are soft parallax scenery, and drawn at full size they
   * cost a software renderer (CI's SwiftShader, low-end Chromebooks) four times the fill for no visible gain.
   */
  private readonly backdrop = RenderTexture.create({ width: VIEW_WIDTH, height: VIEW_HEIGHT, resolution: 0.5 });
  private readonly boxes = new Graphics();
  private fighters: FighterView[] = [];
  private stageId = '';
  private stage: StageGeometry | null = null;
  private matchKey: unknown = null;

  private constructor(readonly app: Application) {
    this.world.addChild(this.stageLayer, this.fighterLayer, this.foregroundLayer, this.boxes);
    app.stage.addChild(new Sprite(this.backdrop), this.world, this.hud, this.debug);
    this.debug.addChild(this.inputDisplay.container, this.eventLog.container);
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
      for (const layer of [this.background, this.stageLayer, this.foregroundLayer])
        layer.removeChildren().forEach((c) => c.destroy({ children: true }));
      const create = STAGE_VIEWS[`../stages/${state.config.stage}/view.ts`]?.createStageView;
      this.stageView = create ? create() : null;
      if (this.stageView) {
        this.background.addChild(this.stageView.background);
        this.stageLayer.addChild(this.stageView.world);
        if (this.stageView.foreground) this.foregroundLayer.addChild(this.stageView.foreground);
      } else this.stageLayer.addChild(placeholderStage(this.stage));
    }
    if (this.matchKey !== state.config) {
      this.matchKey = state.config;
      this.fighterLayer.removeChildren();
      this.fighters = state.fighters.map((f) => new FighterView(getFighter(f.fighter), f.port));
      for (const v of this.fighters) this.fighterLayer.addChild(v.container);
    }
  }

  /** Advance the camera by the frame just simulated; Game.step calls this after every frame. */
  stepCamera(state: MatchState): void {
    this.camera.step(state, getStage(state.config.stage));
  }

  /** Draw `state`; `alpha` interpolates between the previous and current simulated frame. */
  render(state: MatchState, alpha: number): void {
    this.sync(state);
    const view = this.camera.viewFor(state, this.stage!);
    this.world.scale.set(view.zoom);
    this.world.position.set(VIEW_WIDTH / 2 - view.x * view.zoom, VIEW_HEIGHT / 2 + view.y * view.zoom);
    this.stageView?.update(state.frame, view);
    state.fighters.forEach((f, i) => this.fighters[i]?.update(f, alpha, state.frame, this.overlays.actions));
    this.drawBoxes(state);
    this.inputDisplay.container.visible = this.overlays.inputs;
    if (this.overlays.inputs) this.inputDisplay.update(state.players);
    this.eventLog.container.visible = this.overlays.events;
    if (this.overlays.events) this.eventLog.update();
    this.app.renderer.render({ container: this.background, target: this.backdrop, clear: true });
    this.app.render();
  }

  /** Hitbox overlay, in world units (y down inside the world container). */
  private drawBoxes(state: MatchState): void {
    const g = this.boxes;
    g.clear();
    if (!this.overlays.hitboxes) return;
    for (const f of state.fighters) {
      if (f.action === 'ko' || f.action === 'out') continue;
      const h = hurtbox(f, getFighter(f.fighter).stats);
      g.roundRect(h.x - h.r, -h.y2 - h.r, h.r * 2, h.y2 - h.y1 + h.r * 2, h.r).fill({
        color: '#ffe14a',
        alpha: 0.35,
      });
      for (const b of activeHitboxes(f))
        g.circle(b.x, -b.y, b.box.radius).fill({ color: '#ff2a2a', alpha: 0.55 });
    }
  }
}

/** Collision geometry drawn flat, for stages without art. */
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
