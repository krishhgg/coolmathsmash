import { Container, Graphics } from 'pixi.js';
import { layerTransform, REF_CAMERA, VIEW_H, VIEW_W, type StageCamera } from '../../battlefield/art/parallax';
import { flipY, vGradient, type Point } from '../../battlefield/art/util';

export const WATER_Y = -18;
const WATER_COLOR = 0x5d8f89;
export const WATER_DEPTH = 1;

export const SKY_RECT = { left: 0, top: 0, right: VIEW_W, bottom: VIEW_H };
export const WATER_RECT = {
  left: -3100,
  top: VIEW_H / 2 + (REF_CAMERA.y - WATER_Y) * REF_CAMERA.zoom,
  right: 4380,
  bottom: 3400,
};

function drawWaterline(g: Graphics, points: readonly Point[], waterY: number): void {
  const under: Point[] = [];
  let left = Infinity;
  let right = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    if (y1 < waterY) under.push([x1, y1]);
    if (y1 < waterY !== y2 < waterY) {
      const x = x1 + ((x2 - x1) * (waterY - y1)) / (y2 - y1);
      under.push([x, waterY]);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (under.length >= 3) g.poly(flipY(under)).fill({ color: WATER_COLOR, alpha: 0.65 });
  if (left >= right) return;
  g.moveTo(left - 2.4, -waterY + 0.5)
    .quadraticCurveTo(left + 0.4, -waterY - 0.3, left + 3.2, -waterY + 0.24)
    .moveTo(right - 3.2, -waterY + 0.35)
    .quadraticCurveTo(right - 0.4, -waterY - 0.4, right + 2.4, -waterY + 0.5)
    .stroke({ width: 0.65, color: 0xb1cbb0, alpha: 0.78, cap: 'round' });
}

export function createWaterline(points: readonly Point[]) {
  const graphics = new Graphics({ label: 'lagoon-waterline' });
  let localY = NaN;
  return {
    graphics,
    update(waterY: number, x: number, y: number) {
      graphics.position.set(x, -y);
      if (waterY - y === localY) return;
      localY = waterY - y;
      drawWaterline(graphics.clear(), points, localY);
    },
  };
}

function createCloud(x: number, y: number, scale: number): Graphics {
  const g = new Graphics();
  g.moveTo(-109, -1)
    .bezierCurveTo(-108, -13, -84, -24, -57, -25)
    .bezierCurveTo(-48, -39, -29, -47, -9, -45)
    .bezierCurveTo(7, -45, 22, -38, 28, -30)
    .bezierCurveTo(54, -35, 76, -22, 84, -17)
    .bezierCurveTo(105, -15, 119, -7, 117, 0)
    .bezierCurveTo(114, 14, 58, 14, 16, 12)
    .bezierCurveTo(-44, 16, -108, 13, -109, -1)
    .fill(0xd4e3e5);
  g.moveTo(-105, -4)
    .bezierCurveTo(-102, -13, -81, -24, -57, -25)
    .bezierCurveTo(-46, -40, -28, -47, -9, -45)
    .bezierCurveTo(8, -44, 22, -38, 28, -30)
    .bezierCurveTo(51, -34, 72, -25, 84, -17)
    .bezierCurveTo(103, -16, 117, -7, 115, -2)
    .bezierCurveTo(108, 6, 60, 7, 23, 5)
    .bezierCurveTo(-39, 10, -102, 6, -105, -4)
    .fill(0xe7efed);
  g.position.set(x, y);
  g.scale.set(scale);
  return g;
}

function createDunes(): Graphics {
  const g = new Graphics();
  g.moveTo(-1800, 456)
    .bezierCurveTo(-650, 408, -260, 447, -75, 400)
    .bezierCurveTo(95, 356, 171, 376, 303, 423)
    .bezierCurveTo(447, 474, 618, 440, 751, 397)
    .bezierCurveTo(888, 348, 947, 357, 1035, 396)
    .bezierCurveTo(1150, 446, 1278, 431, 1409, 390)
    .bezierCurveTo(1590, 349, 1960, 427, 3080, 401)
    .lineTo(3080, 1400)
    .lineTo(-1800, 1400)
    .closePath()
    .fill(0xaac396);
  g.moveTo(-1800, 500)
    .bezierCurveTo(-400, 469, -91, 478, 87, 440)
    .bezierCurveTo(220, 410, 328, 461, 459, 476)
    .bezierCurveTo(621, 496, 693, 451, 836, 445)
    .bezierCurveTo(1005, 433, 1061, 489, 1231, 462)
    .bezierCurveTo(1512, 407, 1738, 479, 3080, 452)
    .lineTo(3080, 1400)
    .lineTo(-1800, 1400)
    .closePath()
    .fill(0xded5a1);
  return g;
}

function createWater(): Graphics {
  const g = new Graphics({ label: 'lagoon-water' });
  const { left, top, right, bottom } = WATER_RECT;
  g.rect(left, top, right - left, bottom - top).fill(0x416e71);
  g.rect(left, top, right - left, 570).fill(
    vGradient([
      [0, WATER_COLOR],
      [0.24, 0x568786],
      [0.63, 0x497779],
      [1, 0x416e71],
    ]),
  );
  g.moveTo(left, top + 13)
    .bezierCurveTo(-70, top + 11, 286, top + 1, 620, top + 13)
    .bezierCurveTo(842, top + 19, 995, top + 5, right, top + 9)
    .lineTo(right, top + 23)
    .bezierCurveTo(1150, top + 20, 847, top + 29, 608, top + 24)
    .bezierCurveTo(311, top + 16, 167, top + 26, left, top + 26)
    .closePath()
    .fill({ color: 0x7da79b, alpha: 0.32 });
  for (const [x, y, w] of [
    [-145, 50, 135],
    [31, 87, 66],
    [172, 25, 52],
    [305, 66, 119],
    [410, 127, 54],
    [602, 58, 82],
    [731, 102, 128],
    [889, 39, 82],
    [1051, 95, 35],
    [1172, 51, 83],
    [1348, 31, 113],
  ] as const) {
    g.moveTo(x, top + y)
      .quadraticCurveTo(x + w * 0.42, top + y - 7, x + w, top + y - 1)
      .quadraticCurveTo(x + w * 0.53, top + y - 1, x, top + y + 1)
      .closePath()
      .fill({ color: 0xa5c6aa, alpha: 0.21 });
  }
  return g;
}

export function createLagoon() {
  const container = new Container({ label: 'lagoon-backdrop' });
  const sky = new Graphics()
    .rect(SKY_RECT.left, SKY_RECT.top, SKY_RECT.right - SKY_RECT.left, SKY_RECT.bottom - SKY_RECT.top)
    .fill(
      vGradient([
        [0, 0x8dacc5],
        [1, 0xb6cbd2],
      ]),
    );
  const clouds = new Container({ label: 'lagoon-clouds' });
  clouds.addChild(
    createCloud(65, 93, 1.26),
    createCloud(371, 152, 0.82),
    createCloud(709, 80, 1.32),
    createCloud(1132, 140, 1.06),
    createCloud(1481, 98, 0.9),
  );
  const water = createWater();
  const layers = [
    { view: clouds, depth: 0.055 },
    { view: createDunes(), depth: 0.1 },
    { view: water, depth: WATER_DEPTH },
  ];
  container.addChild(sky);
  for (const { view } of layers) {
    view.pivot.set(VIEW_W / 2, VIEW_H / 2);
    container.addChild(view);
  }
  return {
    container,
    update(camera: StageCamera, rise: number) {
      for (const { view, depth } of layers) {
        const { x, y, scale } = layerTransform(depth, camera);
        view.position.set(x, y);
        view.scale.set(scale);
      }
      water.y -= rise * camera.zoom;
    },
  };
}
