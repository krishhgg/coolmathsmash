import { Container, Graphics } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, wrap, type StageCamera } from '../../battlefield/art/parallax';
import { cloud, hash01, mix, vGradient } from '../../battlefield/art/util';
import * as C from './palette';

/**
 * The far lagoon in screen pixels at the reference camera: the open sea from the horizon down, with two palm
 * islands and the rival raft sitting on it. It is the layer that must cover the bottom of the screen at every
 * camera (art/parallax.test.ts), so its extent lives here.
 */
export const SEA = { depth: 0.1, horizon: 404, left: -1900, right: VIEW_W + 1900, bottom: 3200 } as const;

const haze = (color: number, t: number) => mix(color, C.HAZE, t);

interface Layer {
  container: Container;
  depth: number;
}

function layer(label: string, depth: number, ...children: Container[]): Layer {
  const container = new Container({ label });
  container.pivot.set(VIEW_W / 2, VIEW_H / 2);
  container.addChild(...children);
  return { container, depth };
}

function sky(): Graphics {
  return new Graphics({ label: 'sky' }).rect(0, 0, VIEW_W, VIEW_H).fill(
    vGradient([
      [0, C.SKY_TOP],
      [0.34, C.SKY_MID],
      [0.56, C.SKY_HORIZON],
      [1, C.SKY_HORIZON],
    ]),
  );
}

function sun(): Graphics {
  const g = new Graphics({ label: 'sun' });
  g.circle(1012, 116, 96).fill({ color: C.SUN, alpha: 0.16 });
  g.circle(1012, 116, 66).fill({ color: C.SUN, alpha: 0.28 });
  g.circle(1012, 116, 40).fill(C.SUN);
  return g;
}

const CLOUDS: [x: number, y: number, w: number, h: number, speed: number][] = [
  [150, 120, 210, 58, 0.05],
  [520, 74, 150, 42, 0.035],
  [800, 200, 250, 62, 0.045],
  [1180, 150, 170, 46, 0.03],
  [-260, 236, 200, 50, 0.04],
];

function clouds(): Graphics[] {
  return CLOUDS.map(([, , w, h], i) => {
    const g = new Graphics({ label: 'cloud' });
    cloud(g, 0, 0, w, h, haze(C.CLOUD, 0.08), haze(C.CLOUD_SHADE, 0.2), 40 + i);
    return g;
  });
}

function palm(g: Graphics, x: number, y: number, lean: number, height: number, t: number): void {
  const topX = x + lean;
  const topY = y - height;
  g.moveTo(x, y)
    .quadraticCurveTo(x + lean * 0.2, y - height * 0.55, topX, topY)
    .stroke({ color: haze(C.TRUNK, t), width: 4.2, cap: 'round' });
  const leaf = haze(C.PALM, t);
  const dark = haze(C.PALM_DARK, t);
  for (const [i, a] of [-2.7, -2.1, -1.35, -0.75, -0.2, 0.35].entries()) {
    const len = 30 + hash01(i + Math.round(x)) * 10;
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + 14;
    const mx = topX + Math.cos(a) * len * 0.5;
    const my = topY + Math.sin(a) * len * 0.5 - 6;
    g.moveTo(topX, topY)
      .quadraticCurveTo(mx, my - 5, ex, ey)
      .quadraticCurveTo(mx, my + 3, topX, topY)
      .fill(i % 2 === 0 ? leaf : dark);
  }
  g.circle(topX + 2, topY + 3, 3).fill(haze(0x6b5232, t));
}

function islands(): Graphics {
  const g = new Graphics({ label: 'islands' });
  const h = SEA.horizon;
  const t = 0.42;
  g.moveTo(-40, h + 1)
    .quadraticCurveTo(70, h - 30, 150, h - 26)
    .quadraticCurveTo(230, h - 22, 286, h + 1)
    .closePath()
    .fill(haze(C.SAND, t));
  g.moveTo(-20, h + 1)
    .quadraticCurveTo(90, h - 12, 270, h + 1)
    .closePath()
    .fill(haze(C.SAND_DARK, t));
  palm(g, 118, h - 22, -16, 64, t);
  palm(g, 176, h - 22, 20, 52, t);
  g.moveTo(1104, h + 1)
    .quadraticCurveTo(1170, h - 22, 1236, h - 14)
    .quadraticCurveTo(1290, h - 10, 1330, h + 1)
    .closePath()
    .fill(haze(C.SAND, t + 0.06));
  palm(g, 1196, h - 16, 14, 50, t + 0.06);
  g.roundRect(1236, h - 30, 22, 14, 2).fill(haze(0xb48c57, t + 0.06));
  g.poly([1232, h - 30, 1247, h - 42, 1262, h - 30]).fill(haze(0x9a6a3e, t + 0.06));
  return g;
}

function sea(): Graphics {
  const { left, right, horizon, bottom } = SEA;
  const span = bottom - horizon;
  const g = new Graphics({ label: 'sea' });
  g.rect(left, horizon, right - left, span).fill(
    vGradient([
      [0, C.SEA_FAR],
      [80 / span, mix(C.SEA_FAR, C.SEA_NEAR, 0.6)],
      [200 / span, C.SEA_NEAR],
      [1, C.SEA_NEAR],
    ]),
  );
  g.rect(left, horizon - 1.5, right - left, 3).fill({ color: 0xffffff, alpha: 0.35 });
  for (let i = 0; i < 46; i++) {
    const d = hash01(i + 1300);
    const x = -200 + hash01(i + 1317) * (VIEW_W + 400);
    const y = horizon + 6 + d * d * 150;
    const len = 8 + d * 40;
    g.moveTo(x, y)
      .lineTo(x + len, y)
      .stroke({ color: C.FOAM, width: 1 + d * 1.5, alpha: 0.35 });
  }
  return g;
}

/** The rival raft out on the lagoon: a small plank raft with a red pennant, hazed. Bobs in `update`. */
function rivalRaft(): Graphics {
  const g = new Graphics({ label: 'rival-raft' });
  const t = 0.38;
  const ink = haze(C.INK, 0.55);
  g.rect(-1.2, -40, 2.4, 36).fill(haze(C.LOG, t));
  g.poly([1.2, -40, 16, -35, 1.2, -30]).fill(haze(0xd8432f, t));
  g.rect(-14, -22, 6, 1.6).fill(haze(C.PLANK, t));
  g.rect(-12.6, -20.4, 1.2, 16).fill(haze(C.LOG, t));
  g.roundRect(-30, -5, 60, 4, 1).fill(haze(C.PLANK, t)).stroke({ color: ink, width: 1 });
  g.roundRect(-28, -1, 56, 6, 3).fill(haze(C.LOG, t)).stroke({ color: ink, width: 1 });
  g.ellipse(0, 5, 34, 2.2).fill({ color: C.FOAM, alpha: 0.4 });
  return g;
}

function gull(): Graphics {
  const g = new Graphics({ label: 'gull' });
  g.moveTo(-9, 0)
    .quadraticCurveTo(-4, -5, 0, 1)
    .quadraticCurveTo(4, -5, 9, 0)
    .stroke({ color: haze(0x4f6270, 0.35), width: 2, cap: 'round', join: 'round' });
  return g;
}

/** Screen-space backdrop: sky and sun, drifting clouds and gulls, and the far sea with its islands and the rival raft. */
export function createBackground(): {
  container: Container;
  update(frame: number, camera: StageCamera): void;
} {
  const cloudShapes = clouds();
  const gulls = [gull(), gull(), gull()];
  const rival = rivalRaft();
  rival.position.set(1052, SEA.horizon + 26);
  const layers = [
    layer('sky', 0, sky()),
    layer('sun', 0.02, sun()),
    layer('clouds', 0.04, ...cloudShapes),
    layer('gulls', 0.05, ...gulls),
    layer('sea', SEA.depth, sea(), islands(), rival),
  ];
  const container = new Container({ label: 'raft-wars-water-background' });
  container.addChild(...layers.map((l) => l.container));

  const update = (frame: number, camera: StageCamera) => {
    for (const l of layers) {
      const t = layerTransform(l.depth, camera);
      l.container.position.set(t.x, t.y);
      l.container.scale.set(t.scale);
    }
    cloudShapes.forEach((g, i) => {
      const [x, y, , , speed] = CLOUDS[i]!;
      g.position.set(wrap(x + frame * speed, -320, VIEW_W + 640), y);
    });
    gulls.forEach((g, i) => {
      g.position.set(
        wrap(300 + i * 140 + frame * (0.12 + i * 0.02), -120, VIEW_W + 240),
        236 + i * 22 + Math.sin(frame * 0.02 + i * 2) * 6,
      );
      g.scale.set(0.8 + i * 0.12, 0.8 + i * 0.12 + Math.sin(frame * 0.15 + i) * 0.25);
    });
    rival.position.y = SEA.horizon + 26 + Math.sin(frame * 0.035) * 1.5;
  };
  update(0, { x: 0, y: 20, zoom: 4.5 });
  return { container, update };
}
