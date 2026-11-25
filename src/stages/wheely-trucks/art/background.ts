import { Container, Graphics, Text } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, type StageCamera } from '../../battlefield/art/parallax';
import { hash01, vGradient } from '../../battlefield/art/util';

export const SKY = { depth: 0, left: 0, right: VIEW_W, top: 0, bottom: VIEW_H };
const OVERSCAN = { left: -2200, right: VIEW_W + 2200, bottom: 3400 };
export const VERGE = { depth: 0.17, ...OVERSCAN, top: 565 };
export const HIGHWAY = { depth: 0.2, ...OVERSCAN, top: 674 };

function cloud(g: Graphics, x: number, y: number, w: number, h: number) {
  g.moveTo(x - w * 0.5, y)
    .quadraticCurveTo(x - w * 0.57, y - h * 0.21, x - w * 0.39, y - h * 0.38)
    .quadraticCurveTo(x - w * 0.35, y - h * 0.64, x - w * 0.19, y - h * 0.58)
    .quadraticCurveTo(x - w * 0.05, y - h * 1.1, x + w * 0.095, y - h * 0.7)
    .quadraticCurveTo(x + w * 0.195, y - h * 0.76, x + w * 0.27, y - h * 0.46)
    .quadraticCurveTo(x + w * 0.44, y - h * 0.53, x + w * 0.48, y - h * 0.3)
    .quadraticCurveTo(x + w * 0.57, y - h * 0.12, x + w * 0.36, y)
    .quadraticCurveTo(x + w * 0.11, y + h * 0.22, x - w * 0.5, y)
    .fill(
      vGradient([
        [0, 0xe1eee5],
        [0.72, 0xd8eae3],
        [1, 0xc4e1df],
      ]),
    );
}

function mountain(g: Graphics, x: number, y: number, w: number, h: number, far: boolean) {
  g.moveTo(x - w * 0.65, y + h)
    .bezierCurveTo(x - w * 0.39, y + h * 0.82, x - w * 0.2, y + h * 0.31, x - w * 0.04, y + h * 0.07)
    .quadraticCurveTo(x + w * 0.015, y - h * 0.045, x + w * 0.085, y + h * 0.065)
    .bezierCurveTo(x + w * 0.29, y + h * 0.25, x + w * 0.4, y + h * 0.8, x + w * 0.77, y + h)
    .lineTo(x + w * 0.77, HIGHWAY.top + 90)
    .lineTo(x - w * 0.65, HIGHWAY.top + 90)
    .closePath()
    .fill(far ? 0xc9cdcb : 0xb8b5a9);
  g.moveTo(x + w * 0.022, y + h * 0.055)
    .bezierCurveTo(x + w * 0.19, y + h * 0.15, x + w * 0.39, y + h * 0.79, x + w * 0.77, y + h)
    .lineTo(x + w * 0.41, y + h)
    .quadraticCurveTo(x + w * 0.205, y + h * 0.56, x + w * 0.1, y + h * 0.59)
    .quadraticCurveTo(x + w * 0.08, y + h * 0.46, x + w * 0.022, y + h * 0.055)
    .fill(far ? 0xbfc8c8 : 0xa9a69a);
  g.moveTo(x - w * 0.28, y + h * 0.46)
    .quadraticCurveTo(x - w * 0.13, y + h * 0.19, x - w * 0.04, y + h * 0.07)
    .quadraticCurveTo(x + w * 0.015, y - h * 0.045, x + w * 0.085, y + h * 0.065)
    .quadraticCurveTo(x + w * 0.21, y + h * 0.19, x + w * 0.337, y + h * 0.46)
    .quadraticCurveTo(x + w * 0.25, y + h * 0.485, x + w * 0.195, y + h * 0.39)
    .quadraticCurveTo(x + w * 0.167, y + h * 0.34, x + w * 0.148, y + h * 0.39)
    .quadraticCurveTo(x + w * 0.125, y + h * 0.55, x + w * 0.07, y + h * 0.48)
    .quadraticCurveTo(x + w * 0.005, y + h * 0.32, x - w * 0.035, y + h * 0.395)
    .quadraticCurveTo(x - w * 0.115, y + h * 0.54, x - w * 0.148, y + h * 0.45)
    .quadraticCurveTo(x - w * 0.166, y + h * 0.4, x - w * 0.2, y + h * 0.446)
    .quadraticCurveTo(x - w * 0.238, y + h * 0.49, x - w * 0.28, y + h * 0.46)
    .fill(far ? 0xe6e7dc : 0xecebdd);
  g.ellipse(x - w * 0.103, y + h * 0.459, w * 0.013, h * 0.024)
    .ellipse(x + w * 0.21, y + h * 0.477, w * 0.014, h * 0.018)
    .fill(far ? 0xe6e7dc : 0xecebdd);
}

function drawVerge(g: Graphics) {
  const { left, right, top, bottom } = VERGE;
  const width = right - left;
  g.moveTo(left, top - 18);
  for (let x = left, i = 0; x < right; x += 160, i++) {
    const y = top - 26 - hash01(i + 823) * 23;
    g.bezierCurveTo(x + 35, y - 20, x + 65, y - 24, x + 110, y);
    g.quadraticCurveTo(x + 135, y + 11, x + 160, top - 18);
  }
  g.lineTo(right + 160, bottom)
    .lineTo(left, bottom)
    .closePath()
    .fill(0x9cb299);
  for (let x = left + 10, i = 0; x < right; x += 25 + hash01(i + 93) * 29, i++) {
    const h = 13 + hash01(i + 301) * 37;
    const y = top - hash01(i + 700) * 10;
    g.poly([
      x,
      y - h,
      x + h * 0.14,
      y - h * 0.57,
      x + h * 0.07,
      y - h * 0.57,
      x + h * 0.27,
      y - h * 0.11,
      x + h * 0.04,
      y,
      x - h * 0.27,
      y - h * 0.08,
      x - h * 0.075,
      y - h * 0.56,
      x - h * 0.13,
      y - h * 0.54,
    ]).fill(i % 3 === 0 ? 0x839f84 : 0x8ea98d);
  }
  g.rect(left, top, width, bottom - top).fill(0x8ca887);
  g.rect(left, top, width, 170).fill(
    vGradient([
      [0, 0x8ea889],
      [0.21, 0xa5ba93],
      [0.55, 0xc2c79e],
      [1, 0xb3b78d],
    ]),
  );
  for (let x = left + 11, i = 0; x < right; x += 66, i++) {
    const y = top + 15 + hash01(i + 802) * 38;
    const w = 13 + hash01(i + 43) * 38;
    g.moveTo(x, y)
      .quadraticCurveTo(x + w * 0.44, y - 2, x + w, y + 0.1)
      .stroke({ color: 0x789579, alpha: 0.42, width: 1.5, cap: 'round' });
  }
}

function drawHighway(g: Graphics) {
  const { left, right, top, bottom } = HIGHWAY;
  const width = right - left;
  g.rect(left, top, width, bottom - top).fill(0x899a9d);
  g.rect(left, top - 14, width, 118).fill(
    vGradient([
      [0, 0xbcc49e],
      [0.13, 0xb0b9a0],
      [0.33, 0x9da9a2],
      [1, 0x899a9d],
    ]),
  );
  for (let x = left + 20; x < right - 156; x += 218) {
    g.poly([x, top + 25, x + 138, top + 25, x + 156, top + 27.6, x + 17, top + 27.6]).fill({
      color: 0xdddcc0,
      alpha: 0.33,
    });
    g.roundRect(x + 28, top + 22.7, 106, 0.85, 0.4).fill({ color: 0xd3d7be, alpha: 0.27 });
  }
  for (let x = left + 36; x < right - 68; x += 147) {
    g.roundRect(x, top - 9, 62, 2.4, 0.8).fill({ color: 0x869f9a, alpha: 0.42 });
    for (const post of [x + 3, x + 58]) {
      g.rect(post, top - 10, 2.6, 8.5).fill({ color: 0x859c92, alpha: 0.45 });
      g.roundRect(post, top - 11, 2.8, 2.1, 0.6).fill({ color: 0xd3c89f, alpha: 0.48 });
    }
  }
}

export function createBackground() {
  const container = new Container({ label: 'mountain-highway' });
  const layers: { depth: number; root: Container }[] = [];
  const layer = (label: string, depth: number) => {
    const root = new Container({ label });
    root.pivot.set(VIEW_W / 2, VIEW_H / 2);
    const g = new Graphics();
    root.addChild(g);
    container.addChild(root);
    layers.push({ depth, root });
    return { root, g };
  };
  const sky = layer('sky', SKY.depth).g;
  sky.rect(SKY.left, SKY.top, SKY.right - SKY.left, SKY.bottom - SKY.top).fill(
    vGradient([
      [0, 0x82cadd],
      [0.37, 0xb6dce1],
      [0.68, 0xf1edcd],
      [1, 0xf4e3bf],
    ]),
  );

  const clouds = layer('wisps', 0.035).g;
  for (const [x, y, w, h] of [
    [-170, 144, 198, 28],
    [162, 112, 223, 27],
    [439, 211, 135, 21],
    [785, 86, 182, 25],
    [1099, 147, 248, 30],
    [1433, 196, 140, 20],
  ] as const) {
    cloud(clouds, x, y, w, h);
  }

  const far = layer('far-ridge', 0.055).g;
  const near = layer('near-ridge', 0.1).g;
  for (let i = -8; i <= 8; i++) {
    const h = 130 + 135 * hash01(i + 521);
    mountain(far, i * 268 + 55, 496 - h, 385, h, true);
  }
  for (const [x, y, w, h] of [
    [-1040, 280, 420, 243],
    [-674, 234, 445, 298],
    [-322, 288, 358, 255],
    [42, 279, 384, 280],
    [289, 219, 395, 332],
    [611, 352, 308, 208],
    [941, 215, 424, 338],
    [1275, 287, 411, 258],
    [1630, 246, 460, 303],
    [2005, 308, 397, 229],
    [2350, 270, 452, 290],
  ] as const) {
    mountain(near, x, y, w, h, false);
  }

  drawVerge(layer('slopes-and-pines', VERGE.depth).g);
  const road = layer('road-and-guardrail', HIGHWAY.depth);
  drawHighway(road.g);
  const sign = new Graphics({ label: 'pass-marker' });
  sign.roundRect(164, 582, 6, 47, 2).fill(0x829a97);
  sign.roundRect(139, 567, 56, 29, 5).fill(0x8aad9a).stroke({ color: 0xbdc9ad, width: 2.25 });
  sign.poly([147, 585, 153, 576, 157, 581, 159, 579, 164, 585]).fill(0xdce0ba);
  const signText = new Text({
    text: 'PASS\n02',
    style: {
      fontFamily: 'Arial, sans-serif',
      align: 'center',
      fontSize: 8.5,
      fontWeight: 'bold',
      fill: 0xe7e5bf,
    },
  });
  signText.anchor.set(0.5);
  signText.position.set(179, 582);
  road.root.addChild(sign, signText);

  return {
    container,
    update(camera: StageCamera) {
      for (const { depth, root } of layers) {
        const { x, y, scale } = layerTransform(depth, camera);
        root.position.set(x, y);
        root.scale.set(scale);
      }
    },
  };
}
