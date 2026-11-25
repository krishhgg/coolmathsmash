import { Container, Graphics } from 'pixi.js';
import { VIEW_H, VIEW_W, layerTransform, type StageCamera } from '../../battlefield/art/parallax';
import { hash01, vGradient } from '../../battlefield/art/util';
import { createFarm } from './farm';

export const SKY = { depth: 0, left: 0, right: VIEW_W, top: 0, bottom: VIEW_H } as const;
export const PASTURE = { depth: 0.12, left: -940, right: 2220, top: 490, bottom: 1720 } as const;

function drawCloud(g: Container, x: number, y: number, scale: number, crown: number): void {
  const puff = new Graphics({ x, y });
  puff.scale.set(scale);
  puff
    .moveTo(-85, 15)
    .bezierCurveTo(-92, -4, -75, -26, -51, -25)
    .bezierCurveTo(-47, -49 + crown, -16, -63 + crown, 9, -39 + crown * 0.5)
    .bezierCurveTo(32, -50 - crown, 61, -30 - crown * 0.5, 61, -13)
    .bezierCurveTo(92, -15, 103, 18, 75, 26)
    .bezierCurveTo(44, 34, -47, 33, -71, 29)
    .quadraticCurveTo(-81, 27, -85, 15)
    .closePath()
    .fill({ color: 0xe7f6f4, alpha: 0.83 });
  puff
    .moveTo(-84, 18)
    .bezierCurveTo(-38, 27, 38, 22, 85, 12)
    .quadraticCurveTo(95, 27, 62, 29)
    .quadraticCurveTo(-24, 34, -70, 29)
    .quadraticCurveTo(-82, 27, -84, 18)
    .closePath()
    .fill({ color: 0xb8ddeb, alpha: 0.32 });
  g.addChild(puff);
}

function hills(): Graphics {
  const { left, top, right, bottom } = PASTURE;
  const g = new Graphics({ label: 'rolling-pasture' });
  g.moveTo(left, top)
    .bezierCurveTo(-659, 317, -450, 383, -263, 431)
    .bezierCurveTo(-30, 489, 84, 327, 258, 368)
    .bezierCurveTo(412, 397, 475, 466, 657, 421)
    .bezierCurveTo(799, 385, 855, 339, 1023, 372)
    .bezierCurveTo(1161, 397, 1246, 472, 1411, 428)
    .bezierCurveTo(1709, 347, 1966, 320, right, top)
    .lineTo(right, bottom)
    .lineTo(left, bottom)
    .closePath()
    .fill(0xb1e052);
  g.moveTo(left, 542)
    .bezierCurveTo(-725, 602, -248, 400, -78, 440)
    .bezierCurveTo(68, 474, 152, 515, 311, 477)
    .bezierCurveTo(477, 436, 595, 444, 709, 491)
    .bezierCurveTo(832, 544, 982, 499, 1108, 463)
    .bezierCurveTo(1293, 409, 1445, 479, 1520, 493)
    .bezierCurveTo(1857, 548, 2019, 394, right, 478)
    .lineTo(right, bottom)
    .lineTo(left, bottom)
    .closePath()
    .fill(0x97ce4b);
  g.moveTo(left, 594)
    .bezierCurveTo(-573, 658, -213, 475, 20, 515)
    .bezierCurveTo(245, 556, 321, 516, 449, 557)
    .bezierCurveTo(628, 616, 783, 587, 947, 552)
    .bezierCurveTo(1140, 511, 1270, 557, 1401, 581)
    .bezierCurveTo(1670, 638, 1863, 487, right, 564)
    .lineTo(right, bottom)
    .lineTo(left, bottom)
    .closePath()
    .fill(0x89be46);
  return g;
}

function meadow(): Graphics {
  const g = new Graphics({ label: 'near-meadow' });
  g.moveTo(-1000, 678)
    .bezierCurveTo(-554, 735, -153, 547, 150, 578)
    .bezierCurveTo(338, 593, 455, 674, 669, 651)
    .bezierCurveTo(873, 629, 988, 545, 1219, 585)
    .bezierCurveTo(1500, 636, 1715, 650, 2280, 580)
    .lineTo(2280, 1230)
    .lineTo(-1000, 1230)
    .closePath()
    .fill(0x80b44b);
  g.moveTo(-640, 758)
    .bezierCurveTo(-325, 733, -127, 639, 119, 639)
    .bezierCurveTo(290, 639, 422, 720, 637, 702)
    .bezierCurveTo(925, 677, 990, 612, 1209, 641)
    .bezierCurveTo(1459, 671, 1657, 762, 2200, 671)
    .stroke({ width: 9, color: 0xa5c86d, alpha: 0.55 });
  for (let i = 0; i < 56; i++) {
    const x = -284 + i * 34 + 19 * hash01(i + 790);
    const y = 617 + 112 * hash01(i + 975);
    g.moveTo(x - 10, y)
      .quadraticCurveTo(x - 7, y - 5, x - 6, y - 10)
      .quadraticCurveTo(x - 1, y - 6, x, y - 3)
      .quadraticCurveTo(x + 4, y - 11, x + 11, y - 13)
      .lineTo(x + 7, y + 1)
      .closePath()
      .fill(i % 3 === 0 ? 0x78a749 : 0x9bc261);
    if (i % 3 === 1) {
      g.circle(x + 10, y - 10, 2.8).fill(0xdbe0a7);
      g.circle(x + 17, y - 15, 2.1).fill(0xcad893);
    }
  }
  return g;
}

export function createBackground(): { container: Container; update(camera: StageCamera): void } {
  const container = new Container({ label: 'green-valley-background' });
  const layers: { drawing: Container; depth: number }[] = [];
  const addLayer = (drawing: Container, depth: number) => {
    drawing.pivot.set(VIEW_W / 2, VIEW_H / 2);
    container.addChild(drawing);
    layers.push({ drawing, depth });
  };

  const sky = new Graphics({ label: 'grassland-sky' })
    .rect(SKY.left, SKY.top, SKY.right - SKY.left, SKY.bottom - SKY.top)
    .fill(
      vGradient([
        [0, 0x58c5cd],
        [0.55, 0xa1dae3],
        [1, 0xe0edcc],
      ]),
    );
  sky.poly([-150, -15, 89, -15, 627, 303, 553, 286]).fill({ color: 0xe4f6ed, alpha: 0.08 });
  sky.poly([115, -10, 204, -10, 652, 223, 537, 190]).fill({ color: 0xe4f6ed, alpha: 0.06 });
  addLayer(sky, SKY.depth);

  const clouds = new Container({ label: 'valley-clouds' });
  drawCloud(clouds, -34, 251, 1, 8);
  drawCloud(clouds, 196, 132, 1.37, -7);
  drawCloud(clouds, 562, 195, 0.66, 4);
  drawCloud(clouds, 951, 126, 1.1, 13);
  drawCloud(clouds, 1256, 197, 0.68, -5);
  addLayer(clouds, 0.045);
  addLayer(hills(), PASTURE.depth);
  addLayer(createFarm(), 0.19);
  addLayer(meadow(), 0.25);

  return {
    container,
    update(camera) {
      for (const { drawing, depth } of layers) {
        const { x, y, scale } = layerTransform(depth, camera);
        drawing.position.set(x, y);
        drawing.scale.set(scale);
      }
    },
  };
}
