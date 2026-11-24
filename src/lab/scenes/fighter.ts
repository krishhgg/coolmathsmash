import { Container, Graphics, Text, type Application } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import type { FighterArt } from '../../render/rig/types';
import { createPropView, createRigView, type RigView } from '../../render/rig/view';
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
  'neutralSpecial@14',
];

const LABEL = { fontFamily: 'monospace', fontSize: 14, fill: '#ffffff' } as const;

function parseState(state: string): [string, number] {
  const [clip, frame] = state.split('@');
  return [clip ?? 'idle', Number(frame ?? 0)];
}

/**
 * One fighter's rig, large: `?scene=fighter&fighter=fireboy&clip=run&frame=12&zoom=12`. `&sheet=1` shows a
 * contact sheet of the key states (`&states=idle@0,run@6` overrides them), `&palette=blaze` a costume,
 * `&hit=6,6,3.5` a hitbox circle (feet-relative, y up), `&play=1` plays the clip in real time.
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

    const show = (clip: string, frame: number, globalFrame = frame) => {
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
      if (clip === 'neutralSpecial' && art.projectiles?.fireball) {
        const ball = createPropView(art, 'fireball', palette);
        ball.update(globalFrame);
        ball.container.position.set(7 * zoom + Math.max(0, frame - 14) * 1.4 * zoom, -7 * zoom);
        ball.container.scale.set(zoom);
        ball.container.visible = frame >= 14;
        stage.addChild(ball.container);
      }
      const label = new Text({ text: `${name} · ${clip} · frame ${frame} · ${palette}`, style: LABEL });
      label.position.set(16, 12);
      root.addChild(label);
      return { clip, frame };
    };

    const sheet = (states: string[] = KEY_STATES) => {
      root.removeChildren().forEach((c) => c.destroy({ children: true }));
      const cols = Math.min(5, states.length);
      const rows = Math.ceil(states.length / cols);
      const w = VIEW_WIDTH / cols;
      const h = VIEW_HEIGHT / rows;
      const zoom = Number(params.get('zoom') ?? Math.min(w / 22, h / 19));
      states.forEach((state, i) => {
        const [clip, frame] = parseState(state);
        const cell = new Container();
        cell.position.set(w * (i % cols) + w / 2, h * Math.floor(i / cols) + h * 0.8);
        root.addChild(cell);
        if (!clip.startsWith('ledge')) cell.addChild(ground(new Graphics(), 0, 0, w * 0.8));
        const view = createRigView(art, palette);
        view.container.scale.set(zoom);
        view.pose(clip, frame, frame);
        cell.addChild(view.container);
        ledge(cell, clip, zoom);
        cell.mask = cell.addChild(new Graphics().rect(-w / 2, -h * 0.8, w, h).fill('#ffffff'));
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
        return Object.keys(art.palettes);
      },
      clips: () => Object.fromEntries(Object.entries(art.clips).map(([k, c]) => [k, c.length])),
    });

    const clip = params.get('clip') ?? 'idle';
    const frame = Number(params.get('frame') ?? 0);
    if (params.get('sheet')) sheet(params.get('states')?.split(','));
    else show(clip, frame);
    if (params.get('play')) {
      let f = frame;
      app.ticker.add(() => {
        f++;
        show(clip, f);
      });
    }
  },
};
