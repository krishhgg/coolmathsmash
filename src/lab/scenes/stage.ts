import { Container, Graphics } from 'pixi.js';
import { REF_CAMERA, type StageCamera } from '../../stages/battlefield/art/parallax';
import type { StageView } from '../../stages/battlefield/view';
import { getStage } from '../../stages/registry';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import { MAX_ZOOM } from '../../render/camera';
import { placeholderStage } from '../../render/placeholderStage';
import { stageStateAt } from '../../sim/movingStage';
import type { StageGeometry } from '../../sim/stage';
import type { LabScene } from '../types';

const views = import.meta.glob<{ createStageView: () => StageView }>('../../stages/*/view.ts', {
  eager: true,
});

/** Lab-only stand-ins (port-coloured, Flash-outlined) to judge readability before real fighters exist. */
function dummies(stage: StageGeometry): Container {
  const root = new Container({ label: 'dummies' });
  const spots: [number, number][] =
    stage.id === 'battlefield'
      ? [
          [-40, 0],
          [40, 0],
          [-42, 24.12],
          [3, 47.19],
        ]
      : [
          ...stage.spawns.slice(0, 2).map(([x, y]): [number, number] => [x, y]),
          ...stage.platforms.map(({ x1, x2, y }): [number, number] => [(x1 + x2) / 2, y]),
        ];
  const colors = [0xf2333a, 0x2f84ff, 0xffc21a, 0x2fbf45];
  spots.forEach(([x, y], i) => {
    const color = colors[i % colors.length]!;
    const g = new Graphics();
    g.roundRect(-4.2, -15, 8.4, 15, 4).fill(color).stroke({ width: 0.7, color: 0x111111 });
    g.circle(0, -18.5, 4.6).fill(color).stroke({ width: 0.7, color: 0x111111 });
    g.circle(1.4, -19.2, 1.1).fill(0xffffff).circle(1.7, -19.1, 0.5).fill(0x111111);
    g.position.set(x, -y);
    root.addChild(g);
  });
  return root;
}

let setCamera: (x: number, y: number, zoom: number) => void = () => {};
let setFrame: (n: number) => void = () => {};
let setCollision: (on: boolean) => void = () => {};

/**
 * A registered stage at a given camera: ?scene=stage&stage=battlefield&x=0&y=20&zoom=4.5&frame=0, &collision=1 overlays the
 * collision geometry, ledges, camera bounds and blast zones, &play=1 animates from the ticker. Zoom stops at the
 * game's MAX_ZOOM, the closest the game's camera gets and the resolution stage art caches at.
 */
export const scene: LabScene = {
  title: 'Stage at a camera',
  mount(app, params) {
    const num = (key: string, fallback: number) => {
      const v = Number(params.get(key));
      return params.has(key) && Number.isFinite(v) ? v : fallback;
    };
    const stage = getStage(params.get('stage') ?? 'battlefield');
    // A stage without art is drawn as the game draws it (src/render/renderer.ts).
    const view: StageView = views[`../../stages/${stage.id}/view.ts`]?.createStageView() ?? {
      background: new Container(),
      world: placeholderStage(stage),
      update() {},
    };
    const worldRoot = new Container({ label: 'world-root' });
    const foregroundRoot = new Container({ label: 'foreground-root' });
    const overlay = new Graphics({ label: 'collision-overlay' });
    worldRoot.addChild(view.world, overlay);
    if (params.get('dummies') === '1') worldRoot.addChild(dummies(stage));
    if (view.foreground) foregroundRoot.addChild(view.foreground);
    app.stage.addChild(view.background, worldRoot, foregroundRoot);

    const camera: StageCamera = {
      x: num('x', REF_CAMERA.x),
      y: num('y', REF_CAMERA.y),
      zoom: Math.min(MAX_ZOOM, num('zoom', REF_CAMERA.zoom)),
    };
    let frame = num('frame', 0);
    let collision = params.get('collision') === '1';

    const drawOverlay = () => {
      overlay.clear();
      overlay.visible = collision;
      if (!collision) return;
      const px = 1 / camera.zoom;
      for (const solid of stage.solids) {
        const pts = solid.points.flatMap(([x, y]) => [x, -y]);
        overlay.poly(pts).fill({ color: 0xff00ff, alpha: 0.18 });
        overlay.poly(pts).stroke({ width: 2 * px, color: 0xff00ff });
      }
      for (const p of stage.platforms) {
        overlay
          .moveTo(p.x1, -p.y)
          .lineTo(p.x2, -p.y)
          .stroke({ width: 2 * px, color: 0x00ffff });
      }
      for (const ledge of stage.ledges) overlay.circle(ledge.x, -ledge.y, 4 * px).fill(0xffff00);
      const rect = (r: typeof stage.camera, color: number) =>
        overlay.rect(r.left, -r.top, r.right - r.left, r.top - r.bottom).stroke({ width: 2 * px, color });
      rect(stage.blastZones, 0xff3030);
      rect(stage.camera, 0xffe000);
    };

    const apply = () => {
      for (const root of [worldRoot, foregroundRoot]) {
        root.position.set(VIEW_WIDTH / 2 - camera.x * camera.zoom, VIEW_HEIGHT / 2 + camera.y * camera.zoom);
        root.scale.set(camera.zoom);
      }
      view.update(frame, camera);
      view.pieces?.(stageStateAt(stage, frame), 1);
      drawOverlay();
    };
    setCamera = (x, y, zoom) => {
      Object.assign(camera, { x, y, zoom: Math.min(MAX_ZOOM, zoom) });
      apply();
    };
    setFrame = (n) => {
      frame = n;
      apply();
    };
    setCollision = (on) => {
      collision = on;
      apply();
    };
    apply();
    if (params.get('play') === '1')
      app.ticker.add(() => {
        frame++;
        apply();
      });
  },
  api: {
    camera: (x: number, y: number, zoom: number) => setCamera(x, y, zoom),
    frame: (n: number) => setFrame(n),
    collision: (on: boolean) => setCollision(on),
  },
};
