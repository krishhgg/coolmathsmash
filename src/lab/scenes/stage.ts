import { Container, Graphics } from 'pixi.js';
import { MAIN_HULL, SOFT_PLATFORMS } from '../../stages/battlefield/art/outline';
import { CAMERA_LIMITS, REF_CAMERA, type StageCamera } from '../../stages/battlefield/art/parallax';
import { createStageView } from '../../stages/battlefield/view';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import type { LabScene } from '../types';

const BLAST = { left: -240, right: 240, top: 192, bottom: -140 };

let setCamera: (x: number, y: number, zoom: number) => void = () => {};
let setFrame: (n: number) => void = () => {};
let setCollision: (on: boolean) => void = () => {};

/**
 * Coolmath Battlefield at a given camera: ?scene=stage&x=0&y=20&zoom=4.5&frame=0, &collision=1 overlays the
 * collision geometry, ledges, camera bounds and blast zones, &play=1 animates from the ticker.
 */
export const scene: LabScene = {
  title: 'Coolmath Battlefield stage',
  mount(app, params) {
    const num = (key: string, fallback: number) => {
      const v = Number(params.get(key));
      return params.has(key) && Number.isFinite(v) ? v : fallback;
    };
    const view = createStageView();
    const worldRoot = new Container({ label: 'world-root' });
    const foregroundRoot = new Container({ label: 'foreground-root' });
    const overlay = new Graphics({ label: 'collision-overlay' });
    worldRoot.addChild(view.world, overlay);
    if (view.foreground) foregroundRoot.addChild(view.foreground);
    app.stage.addChild(view.background, worldRoot, foregroundRoot);

    const camera: StageCamera = {
      x: num('x', REF_CAMERA.x),
      y: num('y', REF_CAMERA.y),
      zoom: num('zoom', REF_CAMERA.zoom),
    };
    let frame = num('frame', 0);
    let collision = params.get('collision') === '1';

    const drawOverlay = () => {
      overlay.clear();
      overlay.visible = collision;
      if (!collision) return;
      const px = 1 / camera.zoom;
      overlay.poly(MAIN_HULL.flatMap(([x, y]) => [x, -y])).fill({ color: 0xff00ff, alpha: 0.18 });
      overlay.poly(MAIN_HULL.flatMap(([x, y]) => [x, -y])).stroke({ width: 2 * px, color: 0xff00ff });
      for (const p of SOFT_PLATFORMS) {
        overlay
          .moveTo(p.left, -p.y)
          .lineTo(p.right, -p.y)
          .stroke({ width: 2 * px, color: 0x00ffff });
      }
      for (const x of [-80, 80]) overlay.circle(x, 0, 4 * px).fill(0xffff00);
      const rect = (r: typeof BLAST, color: number) =>
        overlay.rect(r.left, -r.top, r.right - r.left, r.top - r.bottom).stroke({ width: 2 * px, color });
      rect(BLAST, 0xff3030);
      rect(CAMERA_LIMITS, 0xffe000);
    };

    const apply = () => {
      for (const root of [worldRoot, foregroundRoot]) {
        root.position.set(VIEW_WIDTH / 2 - camera.x * camera.zoom, VIEW_HEIGHT / 2 + camera.y * camera.zoom);
        root.scale.set(camera.zoom);
      }
      view.update(frame, camera);
      drawOverlay();
    };
    setCamera = (x, y, zoom) => {
      Object.assign(camera, { x, y, zoom });
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
