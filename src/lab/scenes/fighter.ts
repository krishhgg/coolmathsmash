import { Container, Graphics, Text, type Application } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import { sheetLayout } from '../sheet';
import type { FighterArt } from '../../render/rig/types';
import { createRigView, propView, type RigView } from '../../render/rig/view';
import { createTetherLine } from '../../render/tetherLine';
import type { LabScene } from '../types';

const fighters = import.meta.glob<{ art: FighterArt }>('../../fighters/*/art/index.ts');

/** The states judges compare against the original, as `clip@frame`. */
export const KEY_STATES = [
  'idle@0',
  'run@6',
  'jump@40',
  'fall@8',
  'ftilt@7',
  'fsmash@16',
  'tumble@8',
  'shield@10',
  'ledgeHang@0',
  'neutralB@16',
];

const LABEL = { fontFamily: 'monospace', fontSize: 14, fill: '#ffffff' } as const;

function parseState(state: string): [string, number] {
  const [clip, frame] = state.split('@');
  return [clip ?? 'idle', Number(frame ?? 0)];
}

/**
 * One fighter's rig, large: `?scene=fighter&fighter=fireboy&clip=run&frame=12&zoom=12`. `&sheet=1` shows a
 * contact sheet of the key states (`&states=idle@0,run@6` overrides them), `&palette=blaze` a costume,
 * `&hit=6,6,3.5` a hitbox circle (feet-relative, y up), `&play=1` plays the clip in real time. Sheet cells
 * show the heads' first flicker drawing; `&flicker=1` ties the flicker to each cell's frame instead.
 */
export const scene: LabScene = {
  title: 'Fighter rig',
  api: {},
  async mount(app: Application, params: URLSearchParams) {
    const name = params.get('fighter') ?? 'fireboy';
    const load = fighters[`../../fighters/${name}/art/index.ts`];
    if (!load) throw new Error(`no art for fighter ${name}`);
    const { art } = await load();
    let palette = params.get('palette') ?? 'default';
    const root = new Container();
    app.stage.addChild(root);

    const ground = (g: Graphics, x: number, y: number, w: number) =>
      g.rect(x - w / 2, y, w, 2).fill('#8a8f9c');

    /** Draws a ledge block whose top corner is the art's ledge grip point, for ledge clips. */
    const ledge = (parent: Container, clip: string, zoom: number) => {
      if (!clip.startsWith('ledge') || !art.ledgeGrip) return;
      const [gx, gy] = art.ledgeGrip;
      const g = new Graphics().rect(gx, gy, 14, 30).fill('#6b5a3a').rect(gx, gy, 14, 0.6).fill('#3d8f3a');
      g.scale.set(zoom);
      parent.addChildAt(g, 0);
    };

    const overlay = (view: RigView, zoom: number) => {
      const hit = params.get('hit');
      if (!hit) return;
      const g = new Graphics();
      for (const circle of hit.split(';')) {
        const [x = 0, y = 0, r = 1] = circle.split(',').map(Number);
        g.circle(x, -y, r).fill({ color: '#ff2050', alpha: 0.25 }).stroke({ width: 0.12, color: '#ff2050' });
        g.circle(x, -y, 0.25).fill('#ffffff');
      }
      g.scale.set(zoom);
      view.container.parent?.addChild(g);
    };

    /**
     * Projectiles over the clips that fire them, and the reticle over the clip that aims it (their previews); in game
     * the engine spawns and moves the projectiles, and the renderer draws the reticle at the real aim.
     */
    const projectiles = (
      parent: Container,
      clip: string,
      frame: number,
      globalFrame: number,
      zoom: number,
    ) => {
      for (const prop of [...Object.values(art.projectiles ?? {}), ...(art.reticle ? [art.reticle] : [])]) {
        const at = prop.preview?.[clip];
        if (!at || frame < at.frame || frame > (at.to ?? Infinity)) continue;
        const view = propView(art, prop, palette);
        view.update(globalFrame);
        const t = frame - at.frame;
        view.container.position.set((at.x + t * (at.vx ?? 0)) * zoom, -(at.y + t * (at.vy ?? 0)) * zoom);
        view.container.scale.set(zoom);
        parent.addChild(view.container);
      }
    };

    /**
     * The tether line over the clip that fires it (art.tetherLine's preview): it grows from the hand to its end over
     * `travel` frames, behind the rig with the tip in front. In game it runs from the hand to the real line's end.
     */
    const tetherLine = (parent: Container, rig: Container, clip: string, frame: number, zoom: number) => {
      const at = art.tetherLine?.preview?.[clip];
      if (!at || frame < at.frame || frame > at.to) return;
      const k = Math.min(1, (frame - at.frame + 1) / (at.travel ?? 1));
      const [x0, y0] = at.from;
      const end = { x: x0 + (at.end[0] - x0) * k, y: -(y0 + (at.end[1] - y0) * k) };
      const drawing = createTetherLine(art, palette);
      drawing.place({ x: x0, y: -y0 }, end, 1, frame);
      const behind = new Container();
      const front = new Container();
      behind.scale.set(zoom);
      front.scale.set(zoom);
      behind.addChild(drawing.line);
      front.addChild(drawing.tip);
      parent.addChildAt(behind, parent.getChildIndex(rig));
      parent.addChild(front);
    };

    const show = (clip: string, frame: number, globalFrame = frame) => {
      redraw = () => show(clip, frame, globalFrame);
      root.removeChildren().forEach((c) => c.destroy({ children: true }));
      const zoom = Number(params.get('zoom') ?? 12);
      const stage = new Container();
      stage.position.set(VIEW_WIDTH / 2, VIEW_HEIGHT * 0.82);
      root.addChild(stage);
      if (!clip.startsWith('ledge')) stage.addChild(ground(new Graphics(), 0, 0, VIEW_WIDTH));
      const view = createRigView(art, palette);
      view.container.scale.set(zoom);
      stage.addChild(view.container);
      view.pose(clip, frame, globalFrame);
      ledge(stage, clip, zoom);
      overlay(view, zoom);
      projectiles(stage, clip, frame, globalFrame, zoom);
      tetherLine(stage, view.container, clip, frame, zoom);
      const label = new Text({ text: `${name} · ${clip} · frame ${frame} · ${palette}`, style: LABEL });
      label.position.set(16, 12);
      root.addChild(label);
      return { clip, frame };
    };

    let redraw = () => {};
    const flicker = params.has('flicker');
    const sheet = (states: string[] = KEY_STATES) => {
      redraw = () => sheet(states);
      root.removeChildren().forEach((c) => c.destroy({ children: true }));
      const { cols, w, h, zoom: fit } = sheetLayout(states.length);
      const zoom = Number(params.get('zoom') ?? fit);
      states.forEach((state, i) => {
        const [clip, frame] = parseState(state);
        const cell = new Container();
        cell.position.set(w * (i % cols) + w * 0.4, h * Math.floor(i / cols) + h * 0.8);
        root.addChild(cell);
        if (!clip.startsWith('ledge')) cell.addChild(ground(new Graphics(), 0, 0, w * 0.8));
        const view = createRigView(art, palette);
        view.container.scale.set(zoom);
        view.pose(clip, frame, flicker ? frame : 0);
        cell.addChild(view.container);
        ledge(cell, clip, zoom);
        projectiles(cell, clip, frame, flicker ? frame : 0, zoom);
        tetherLine(cell, view.container, clip, frame, zoom);
        cell.mask = cell.addChild(new Graphics().rect(-w * 0.4, -h * 0.8, w, h).fill('#ffffff'));
        const label = new Text({ text: state, style: LABEL });
        label.position.set(w * (i % cols) + 8, h * Math.floor(i / cols) + 6);
        root.addChild(label);
      });
      return states;
    };

    const api = scene.api!;
    Object.assign(api, {
      show: (clip: string, frame: number, globalFrame?: number) => show(clip, frame, globalFrame),
      sheet: (states?: string[]) => sheet(states),
      palette: (p: string) => {
        palette = p;
        redraw();
        return Object.keys(art.palettes);
      },
      clips: () => Object.fromEntries(Object.entries(art.clips).map(([k, c]) => [k, c.length])),
    });

    const clip = params.get('clip') ?? 'idle';
    const frame = Number(params.get('frame') ?? 0);
    if (params.get('sheet')) sheet(params.get('states')?.split(','));
    else show(clip, frame);
    if (params.get('play')) {
      let elapsed = 0;
      app.ticker.add((ticker) => {
        elapsed += ticker.deltaMS;
        const f = frame + Math.floor((elapsed * 60) / 1000);
        show(clip, f);
      });
    }
  },
};
