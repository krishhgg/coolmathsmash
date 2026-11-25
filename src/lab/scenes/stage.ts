import { Container, Graphics } from 'pixi.js';
import { REF_CAMERA, type StageCamera } from '../../stages/battlefield/art/parallax';
import type { StageView, StageViewFrame } from '../../stages/battlefield/view';
import { getStage } from '../../stages/registry';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import { stageStateAt } from '../../sim/movingStage';
import {
  compileStage,
  edgeMaxX,
  edgeMinX,
  floorY,
  type CompiledStage,
  type StageGeometry,
} from '../../sim/stage';
import type { LabScene } from '../types';

const views = import.meta.glob<{ createStageView: () => StageView }>('../../stages/*/view.ts', {
  eager: true,
});

function flatStage(stage: StageGeometry): StageView {
  const world = new Container();
  const solids = stage.solids.map(({ points }) =>
    new Graphics().poly(points.flatMap(([x, y]) => [x, -y])).fill(0x69738c),
  );
  const platforms = stage.platforms.map((p) =>
    new Graphics().rect(p.x1, -p.y, p.x2 - p.x1, 2).fill(0xa0b4d1),
  );
  world.addChild(...solids, ...platforms);
  return {
    background: new Container(),
    world,
    update(_frame, _camera, { pieces }) {
      for (const set of ['solids', 'platforms'] as const)
        (set === 'solids' ? solids : platforms).forEach((node, i) => {
          const p = pieces[set][i]!;
          node.position.set(p.x, -p.y);
          node.visible = p.on;
        });
    },
  };
}

/** Lab-only stand-ins (port-coloured, Flash-outlined) to judge readability before real fighters exist. */
function dummies({ geo: stage, edges }: CompiledStage) {
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
  const standIns = spots.map(([x, y], i) => {
    const color = colors[i % colors.length]!;
    const g = new Graphics();
    g.roundRect(-4.2, -15, 8.4, 15, 4).fill(color).stroke({ width: 0.7, color: 0x111111 });
    g.circle(0, -18.5, 4.6).fill(color).stroke({ width: 0.7, color: 0x111111 });
    g.circle(1.4, -19.2, 1.1).fill(0xffffff).circle(1.7, -19.1, 0.5).fill(0x111111);
    root.addChild(g);
    const platform = stage.platforms.findIndex((p) => p.y === y && p.x1 <= x && x <= p.x2);
    const floor = edges.find(
      (e) => e.kind === 'floor' && edgeMinX(e) <= x && x <= edgeMaxX(e) && Math.abs(floorY(e, x) - y) < 0.01,
    );
    return { g, x, y, platform, solid: floor?.solid ?? -1 };
  });
  return {
    root,
    update(pieces: StageViewFrame['pieces']) {
      for (const { g, x, y, platform, solid } of standIns) {
        const p = platform >= 0 ? pieces.platforms[platform] : pieces.solids[solid];
        g.position.set(x + (p?.x ?? 0), -y - (p?.y ?? 0));
        g.visible = p?.on !== false;
      }
    },
  };
}

let setCamera: (x: number, y: number, zoom: number) => void = () => {};
let setFrame: (n: number) => void = () => {};
let setCollision: (on: boolean) => void = () => {};

/**
 * A registered stage at a given camera: ?scene=stage&stage=battlefield&x=0&y=20&zoom=4.5&frame=0, &collision=1 overlays the
 * collision geometry, ledges, camera bounds and blast zones, &play=1 animates from the ticker.
 */
export const scene: LabScene = {
  title: 'Stage at a camera',
  mount(app, params) {
    const num = (key: string, fallback: number) => {
      const v = Number(params.get(key));
      return params.has(key) && Number.isFinite(v) ? v : fallback;
    };
    const stage = getStage(params.get('stage') ?? 'battlefield');
    const compiled = compileStage(stage);
    const view = views[`../../stages/${stage.id}/view.ts`]?.createStageView() ?? flatStage(stage);
    const worldRoot = new Container({ label: 'world-root' });
    const foregroundRoot = new Container({ label: 'foreground-root' });
    const overlay = new Graphics({ label: 'collision-overlay' });
    worldRoot.addChild(view.world, overlay);
    const standIns = params.get('dummies') === '1' ? dummies(compiled) : null;
    if (standIns) worldRoot.addChild(standIns.root);
    if (view.foreground) foregroundRoot.addChild(view.foreground);
    app.stage.addChild(view.background, worldRoot, foregroundRoot);

    const camera: StageCamera = {
      x: num('x', REF_CAMERA.x),
      y: num('y', REF_CAMERA.y),
      zoom: num('zoom', REF_CAMERA.zoom),
    };
    let frame = num('frame', 0);
    let collision = params.get('collision') === '1';
    const hazards = params.get('hazards') !== '0';

    const drawOverlay = (pieces: StageViewFrame['pieces']) => {
      overlay.clear();
      overlay.visible = collision;
      if (!collision) return;
      const px = 1 / camera.zoom;
      stage.solids.forEach((solid, i) => {
        const p = pieces.solids[i]!;
        if (!p.on) return;
        const pts = solid.points.flatMap(([x, y]) => [x + p.x, -(y + p.y)]);
        overlay.poly(pts).fill({ color: 0xff00ff, alpha: 0.18 });
        overlay.poly(pts).stroke({ width: 2 * px, color: 0xff00ff });
      });
      stage.platforms.forEach((p, i) => {
        const at = pieces.platforms[i]!;
        if (!at.on) return;
        overlay
          .moveTo(p.x1 + at.x, -p.y - at.y)
          .lineTo(p.x2 + at.x, -p.y - at.y)
          .stroke({ width: 2 * px, color: 0x00ffff });
      });
      stage.ledges.forEach((ledge, i) => {
        const p = pieces.solids[compiled.ledgeSolid[i]!];
        if (p?.on === false) return;
        overlay.circle(ledge.x + (p?.x ?? 0), -ledge.y - (p?.y ?? 0), 4 * px).fill(0xffff00);
      });
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
      const pieces = stageStateAt(stage, frame, undefined, hazards);
      view.update(frame, camera, { pieces, hazards, alpha: 1 });
      standIns?.update(pieces);
      drawOverlay(pieces);
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
