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
import { drawEntities, drawEntityBoxes } from './entities';
import { InputDisplay } from './debug/inputDisplay';
import { FighterView, fighterArt, pickCostumes } from './fighterView';
import { MatchHud } from './hud';
import { drawMovingPieces, isMoving } from './stagePieces';

/** Stage art: src/stages/<id>/view.ts exports createStageView (docs/stages.md). Stages without one draw flat. */
const STAGE_VIEWS = import.meta.glob<{ createStageView: () => StageView }>('../stages/*/view.ts', {
  eager: true,
});

/**
 * `full` draws a stage's painted backdrop; `lite` leaves it flat (the clear colour) so tests and captures on software
 * GPUs stay fast. Everything in the world (stage, fighters, effects) and the HUD draw the same in both.
 */
export type RenderQuality = 'full' | 'lite';

export interface Overlays {
  inputs: boolean;
  /** Action names over fighters. */
  actions: boolean;
  /** Hurtboxes (yellow), active hitboxes (red) and grab boxes (purple). */
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
  readonly matchHud = new MatchHud();
  private readonly stageLayer = new Container();
  private readonly stagePieces = new Graphics();
  private readonly fighterLayer = new Container();
  private readonly foregroundLayer = new Container();
  private stageView: StageView | null = null;
  /**
   * The backdrop renders at half resolution: its layers are soft parallax scenery, and drawn at full size they
   * cost a software renderer (CI's SwiftShader, low-end Chromebooks) four times the fill for no visible gain.
   */
  private readonly backdrop = RenderTexture.create({
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    resolution: 0.5,
    antialias: true,
  });
  private readonly boxes = new Graphics();
  private readonly entities = new Graphics();
  private fighters: FighterView[] = [];
  /** Fighter id each view was built for; a transform swaps the view. */
  private fighterIds: string[] = [];
  /** Palette per port, picked when the match starts; a transformed fighter keeps its port's costume name. */
  private costumes: string[] = [];
  private stageId = '';
  private stage: StageGeometry | null = null;
  private matchKey: unknown = null;

  private constructor(
    readonly app: Application,
    readonly quality: RenderQuality,
  ) {
    this.world.addChild(
      this.stageLayer,
      this.stagePieces,
      this.fighterLayer,
      this.entities,
      this.foregroundLayer,
      this.boxes,
    );
    const backdrop = new Sprite(this.backdrop);
    backdrop.visible = quality === 'full';
    app.stage.addChild(backdrop, this.world, this.hud, this.debug);
    this.debug.addChild(this.inputDisplay.container, this.eventLog.container);
    this.hud.addChild(this.matchHud.hud.container);
  }

  static async create(parent: HTMLElement, quality: RenderQuality = 'full'): Promise<Renderer> {
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
    return new Renderer(app, quality);
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
      this.fighters = [];
      this.fighterIds = [];
      this.costumes = pickCostumes(state.config, (id) => fighterArt(getFighter(id)));
    }
    state.fighters.forEach((f, i) => {
      if (this.fighterIds[i] === f.fighter) return;
      const view = new FighterView(getFighter(f.fighter), f.port, this.costumes[f.port]);
      const old = this.fighters[i];
      if (old) this.fighterLayer.replaceChild(old.container, view.container);
      else this.fighterLayer.addChild(view.container);
      this.fighters[i] = view;
      this.fighterIds[i] = f.fighter;
    });
  }

  /**
   * Advance the camera, and the HUD's hit timing, by the frame just simulated; Game.step calls this after every
   * frame.
   */
  stepCamera(state: MatchState): void {
    this.camera.step(state, getStage(state.config.stage));
    this.matchHud.step(state);
  }

  /** Draw `state`; `alpha` interpolates between the previous and current simulated frame. */
  render(state: MatchState, alpha: number): void {
    this.sync(state);
    const view = this.camera.viewFor(state, this.stage!);
    this.world.scale.set(view.zoom);
    this.world.position.set(VIEW_WIDTH / 2 - view.x * view.zoom, VIEW_HEIGHT / 2 + view.y * view.zoom);
    this.stageView?.update(state.frame, view);
    drawMovingPieces(this.stagePieces, this.stage!, state.stage, state.frame, alpha);
    state.fighters.forEach((f, i) => this.fighters[i]?.update(f, alpha, state.frame, this.overlays.actions));
    drawEntities(this.entities, state, alpha);
    this.drawBoxes(state);
    this.matchHud.update(
      state,
      state.fighters.map((f) => ({
        x: VIEW_WIDTH / 2 + (f.pos.x - view.x) * view.zoom,
        y: VIEW_HEIGHT / 2 - (f.pos.y + getFighter(f.fighter).stats.height / 2 - view.y) * view.zoom,
      })),
    );
    this.inputDisplay.container.visible = this.overlays.inputs;
    if (this.overlays.inputs) this.inputDisplay.update(state.players);
    this.eventLog.container.visible = this.overlays.events;
    if (this.overlays.events) this.eventLog.update();
    if (this.quality === 'full')
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
      const hw = h.hw ?? 0;
      g.roundRect(h.x - hw - h.r, -h.y2 - h.r, (hw + h.r) * 2, h.y2 - h.y1 + h.r * 2, h.r).fill({
        color: '#ffe14a',
        alpha: 0.35,
      });
      for (const b of activeHitboxes(f))
        g.circle(b.x, -b.y, b.box.radius).fill({ color: b.box.grab ? '#a33cff' : '#ff2a2a', alpha: 0.55 });
    }
    drawEntityBoxes(g, state);
  }
}

/** Collision geometry drawn flat, for stages without art. */
function placeholderStage(stage: StageGeometry): Graphics {
  const g = new Graphics();
  for (const solid of stage.solids) {
    if (isMoving(solid)) continue;
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
  for (const p of stage.platforms)
    if (!isMoving(p)) g.roundRect(p.x1, -p.y, p.x2 - p.x1, 2.2, 1.1).fill('#d9d2c0');
  return g;
}
