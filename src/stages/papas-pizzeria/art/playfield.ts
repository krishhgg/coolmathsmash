import { Container, Graphics } from 'pixi.js';
import { flipY, hash01 } from '../../battlefield/art/util';
import { stage } from '../geometry';

const INK = 0x382e29;
const EDGE = { width: 0.52, color: INK, join: 'round' } as const;
const BOLT = { width: 0.28, color: 0x554439 } as const;

export function createConveyor(): Graphics {
  const points = stage.solids[0]!.points;
  const top = Math.max(...points.map(([, y]) => y));
  const [left, right] = stage.ledges.map(({ x }) => x).sort((a, b) => a - b);
  const half = (right! - left!) / 2;
  const center = (right! + left!) / 2;
  const bottom = -Math.min(...points.map(([, y]) => y)) + top;
  const outline = flipY(points.map(([x, y]) => [x - center, y - top] as const));
  const g = new Graphics({ label: 'pizza-peel-conveyor' });
  g.position.set(center, -top);
  g.poly(outline).fill(0xaf784b);
  g.moveTo(-half, 1)
    .lineTo(-half + 3, -0.92)
    .lineTo(half - 3, -0.92)
    .lineTo(half, 1)
    .closePath()
    .fill(0xae885a);
  g.poly([-half, 0, half, 0, half, 2.3, -half, 2.3]).fill(0xd6a06b);
  g.poly([-half + 9, bottom - 8, half - 9, bottom - 8, half - 17, bottom, -half + 17, bottom]).fill(0x925d42);
  g.moveTo(-half + 10, bottom - 8)
    .quadraticCurveTo(-23, bottom - 9.7, -3, bottom - 8.6)
    .quadraticCurveTo(30, bottom - 6.6, half - 10, bottom - 8)
    .stroke({ width: 0.45, color: 0xcc9561 });
  for (const [x, y, w, sway] of [
    [-54, 15.9, 45, 1.25],
    [-47, 19.4, 28, -1.4],
    [-55, 21.3, 48, 1],
    [5, 16.7, 51, -1.4],
    [13, 21.8, 39, -1],
    [34, 19.4, 22, 0.8],
  ] as const) {
    g.moveTo(x, y)
      .bezierCurveTo(x + w * 0.36, y + sway, x + w * 0.72, y - sway * 0.4, x + w, y)
      .stroke({ width: 0.37, color: 0x734c39, alpha: 0.52, cap: 'round' });
  }
  g.roundRect(-12, 17.7, 24, 4.9, 2.1).fill(0x553c30).stroke(BOLT);
  g.roundRect(-10.7, 18.4, 21.4, 3.2, 1.3).fill(0x7d5440);
  g.moveTo(-8, 21.4).lineTo(8, 21.4).stroke({ width: 0.3, color: 0xce965e, cap: 'round' });

  const belt = half - 5.3;
  g.roundRect(-belt, 0.95, belt * 2, 13.6, 6.15)
    .fill(0x393734)
    .stroke(EDGE);
  g.roundRect(-belt + 0.9, 1.6, (belt - 0.9) * 2, 11.45, 5.5).fill(0x69645a);
  g.moveTo(-belt + 1.4, 7.1)
    .quadraticCurveTo(-belt + 1.7, 2.05, -belt + 6.4, 2.05)
    .lineTo(belt - 6.4, 2.05)
    .quadraticCurveTo(belt - 1.7, 2.05, belt - 1.4, 7.1)
    .closePath()
    .fill(0x827d72);
  g.rect(-belt + 5.9, 7.1, (belt - 5.9) * 2, 4.65).fill(0x4a4a44);
  for (let x = -belt + 8; x < belt - 8; x += 4.55) {
    g.poly([x, 2.15, x + 0.85, 2.15, x + 3.0, 7.0, x + 2.2, 7.0]).fill(0x58564f);
    g.moveTo(x + 3, 7.2)
      .lineTo(x + 2.25, 11.65)
      .stroke({ width: 0.32, color: 0x353530 });
  }
  g.moveTo(-belt + 5, 1.95)
    .lineTo(belt - 5, 1.95)
    .stroke({ width: 0.28, color: 0xb2a290, cap: 'round' });
  g.moveTo(-belt + 5, 12.15)
    .lineTo(belt - 5, 12.15)
    .stroke({ width: 0.5, color: 0x9a8b76, cap: 'round' });
  for (const x of [-belt + 6, -belt * 0.55, -belt * 0.28, 0, belt * 0.28, belt * 0.55, belt - 6]) {
    const r = Math.abs(x) > belt * 0.8 ? 4.35 : 2.15;
    g.circle(x, 8, r).fill(0x8e7f6e).stroke(BOLT);
    g.moveTo(x + r * 0.76 * Math.cos(3.5), 8 + r * 0.76 * Math.sin(3.5))
      .arc(x, 8, r * 0.76, 3.5, 5.15)
      .stroke({ width: 0.46, color: 0xc4af92, cap: 'round' });
    g.circle(x, 8, r * 0.42)
      .fill(0x58524a)
      .stroke(BOLT);
    g.circle(x - 0.22, 7.82, 0.37).fill(0xaf9a81);
  }
  for (const side of [-1, 1]) {
    const x = half * side;
    g.poly([x, 0, x, 6.9, x - 3.8 * side, 11.5, x - 4.7 * side, 2.15]).fill(0xc08751);
    g.moveTo(x - 0.9 * side, 2.1)
      .lineTo(x - 0.9 * side, 6)
      .stroke({ width: 0.45, color: 0xe3ac70 });
    g.circle(x - 2.25 * side, 4.6, 0.83)
      .fill(0xbda58a)
      .stroke(BOLT);
  }
  g.poly(outline).stroke(EDGE);
  g.moveTo(-half + 1, 0.66)
    .lineTo(half - 1, 0.66)
    .stroke({ width: 0.34, color: 0xf2c286, cap: 'round' });
  return g;
}

function drawPepperoni(g: Graphics, w: number, seed: number) {
  g.moveTo(0, 0)
    .lineTo(w, 0)
    .bezierCurveTo(w - 0.1, 3.2, w * 0.78, 6.5, w * 0.53, 6.4)
    .bezierCurveTo(w * 0.28, 6.5, 0.1, 4, 0, 0)
    .closePath()
    .fill(0x922b24)
    .stroke(EDGE);
  g.moveTo(1.1, 0.6)
    .lineTo(w - 1.1, 0.6)
    .bezierCurveTo(w - 4.1, 3.75, w * 0.75, 4.7, w * 0.48, 4.7)
    .quadraticCurveTo(w * 0.21, 4.6, 1.1, 0.6)
    .closePath()
    .fill(0xd45537);
  g.moveTo(1.17, 0.86)
    .lineTo(w - 1.17, 0.86)
    .stroke({ width: 0.42, color: 0xf49160, cap: 'round' });
  for (let i = 0; i < 17; i++) {
    const x = 4.2 + (i * (w - 9)) / 17 + 0.8 * hash01(seed + i);
    const y = 1.7 + (1.55 + Math.sin((x / w) * Math.PI)) * hash01(seed - i * 3);
    const r = 0.28 + 0.41 * hash01(seed + i * 13);
    g.ellipse(x, y, r, r * 0.48).fill(i % 3 === 0 ? 0xffb778 : 0xb43d27);
  }
}

function drawMushroom(g: Graphics, w: number) {
  const c = w / 2;
  g.moveTo(c - 4.4, 4.14)
    .quadraticCurveTo(c - 3.74, 8.43, c - 5.35, 10.92)
    .bezierCurveTo(c - 6.51, 12.9, c - 3.82, 13.65, c - 0.6, 13.47)
    .bezierCurveTo(c + 3.13, 13.39, c + 6.95, 12.56, c + 5.38, 10.53)
    .quadraticCurveTo(c + 3.72, 7.74, c + 4.6, 4)
    .closePath()
    .fill(0xc99978)
    .stroke(EDGE);
  g.moveTo(c - 3.44, 6.05)
    .quadraticCurveTo(c - 2.55, 9.12, c - 4.25, 11.5)
    .quadraticCurveTo(c - 3.71, 13.03, c - 0.28, 12.67)
    .quadraticCurveTo(c + 0.4, 11.1, c + 0.88, 6.05)
    .closePath()
    .fill(0xe6b993);
  g.moveTo(0, 0)
    .lineTo(w, 0)
    .bezierCurveTo(w - 0.12, 3.75, w - 4.4, 7.24, c + 3.1, 7.33)
    .bezierCurveTo(c - 7.9, 7.56, 0, 4.27, 0, 0)
    .closePath()
    .fill(0xa87156)
    .stroke(EDGE);
  for (const x of [4.2, 6.6, 9.0, 11.55, w - 11.55, w - 9, w - 6.6, w - 4.2]) {
    const towardCenter = Math.sign(c - x);
    g.moveTo(x, 2.95)
      .quadraticCurveTo(x + towardCenter * 1.25, 5.2, x + towardCenter * 2.1, 5.85)
      .stroke({ width: 0.38, color: 0x805540, cap: 'round' });
  }
  g.moveTo(0, 0)
    .lineTo(w, 0)
    .bezierCurveTo(w - 0.29, 1.87, w - 5.2, 3.92, c + 1.37, 4.17)
    .bezierCurveTo(c - 6.9, 4.45, 0.4, 2.94, 0, 0)
    .closePath()
    .fill(0xf2cb97)
    .stroke({ ...EDGE, width: 0.38 });
  g.moveTo(1.6, 0.91)
    .quadraticCurveTo(w * 0.38, 2.17, w - 3.1, 0.85)
    .stroke({ width: 0.53, color: 0xf6d1a6, cap: 'round' });
  g.ellipse(w * 0.34, 2.28, 1.13, 0.25).fill(0xcd9d77);
  g.ellipse(w * 0.66, 2.74, 1.39, 0.27).fill(0xcd9d77);
}

export function createToppingPlatforms(): Container {
  const container = new Container({ label: 'topping-platforms' });
  const highest = Math.max(...stage.platforms.map(({ y }) => y));
  for (const { x1, x2, y } of stage.platforms) {
    const isMushroom = y === highest;
    const g = new Graphics({ label: isMushroom ? 'mushroom' : 'pepperoni-slice' });
    const w = x2 - x1;
    g.position.set(x1, -y);
    if (isMushroom) drawMushroom(g, w);
    else drawPepperoni(g, w, x1);
    container.addChild(g);
  }
  return container;
}
