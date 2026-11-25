import { Container, Graphics, Text } from 'pixi.js';
import { flipY, hash01, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';
import { CREAM, GRASS, GRASS_LIGHT, GRASS_SHADE, INK, SOIL, SOIL_LIGHT, SOIL_SHADE } from './palette';

const outline = { width: 0.76, color: INK, join: 'round' } as const;
const laneDepth = 2.3;

function trackPlaque(root: Container): void {
  const sign = new Graphics({ label: 'green-valley-plaque' });
  sign
    .poly([-17.6, 13, 17.5, 12.6, 17.2, 22.3, -17.3, 22.7])
    .fill(0x754b34)
    .stroke({ width: 0.46, color: 0x64422f, join: 'round' });
  sign
    .poly([-16.5, 13.65, 16.5, 13.3, 16.2, 20.9, -16.2, 21.2])
    .fill(0xe8be7f)
    .stroke({ width: 0.28, color: 0x9a6941 });
  sign.circle(14.85, 17.2, 0.45).fill(0x946b4c);
  sign.moveTo(-14.9, 19.8).lineTo(-13.55, 14.9).stroke({ width: 0.42, color: 0x63482f });
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++)
      sign
        .rect(-13.6 + col * 1.06 - row * 0.27, 14.9 + row * 1.02 + col * 0.12, 1.09, 1.1)
        .fill((row + col) % 2 === 0 ? 0x63482f : CREAM);

  const title = new Text({
    text: 'GREEN VALLEY',
    style: { fontFamily: 'Arial, sans-serif', fontSize: 3.18, fontWeight: 'bold', fill: 0x5b412b },
    resolution: 8,
  });
  title.anchor.set(0.5);
  title.position.set(2.6, 17.3);
  title.rotation = -0.01;
  root.addChild(sign, title);
}

export function createPlayfield(): Container {
  const root = new Container({ label: 'duck-life-course-world' });
  const bank = new Graphics({ label: 'green-valley-track' });
  const points = stage.solids[0]!.points;
  const hull = flipY(points);
  const [left, right] = stage.ledges;
  const l = left!.x;
  const r = right!.x;
  const surface = -left!.y;

  bank.poly(hull).fill(SOIL);
  bank
    .moveTo(l, 8)
    .bezierCurveTo(-53, 12, -18, 8, 6, 10)
    .bezierCurveTo(33, 12.3, 57, 7.5, r, 8)
    .lineTo(74, 17)
    .bezierCurveTo(48, 20, 34, 14.7, 5, 16.1)
    .bezierCurveTo(-25, 17.4, -45, 20, -74, 17)
    .closePath()
    .fill(SOIL_LIGHT);
  bank
    .moveTo(-70, 20)
    .bezierCurveTo(-46, 25, -31, 18.5, -5, 22)
    .bezierCurveTo(27, 26.2, 46, 26.2, 69, 20.75)
    .lineTo(62, 26)
    .lineTo(41, 34)
    .lineTo(-41, 34)
    .lineTo(-62, 26)
    .closePath()
    .fill(SOIL_SHADE);
  bank
    .moveTo(-62, 26)
    .bezierCurveTo(-31, 31, -15, 25, 10, 26.6)
    .bezierCurveTo(29, 27.8, 43, 30.3, 62, 26)
    .lineTo(41, 34)
    .lineTo(-41, 34)
    .closePath()
    .fill(0x9e6545);

  for (let i = 0; i < 34; i++) {
    const x = -65 + i * 3.91 + hash01(i + 39) * 2.7;
    const bottom = Math.abs(x) < 38 ? 31.5 : 23.5 - Math.max(0, Math.abs(x) - 52) * 0.48;
    const y = 11.5 + hash01(i + 78) * (bottom - 11.5);
    const w = 0.46 + hash01(i + 16) * 1.45;
    bank
      .moveTo(x - w, y)
      .quadraticCurveTo(x - 0.3, y - w * 0.75, x + w, y - 0.15)
      .quadraticCurveTo(x + 0.1, y + w * 0.7, x - w, y)
      .fill(i % 3 === 0 ? 0xecc08a : 0x995d41);
  }

  bank
    .moveTo(l, surface)
    .lineTo(r, surface)
    .lineTo(r, 5.9)
    .bezierCurveTo(68, 6.4, 66, 7.9, 57, 7.6)
    .bezierCurveTo(53, 7.1, 49, 8.7, 45, 8)
    .bezierCurveTo(31, 7.2, 28, 9.5, 15, 8.5)
    .bezierCurveTo(2, 7.1, -10, 9.25, -21, 7.1)
    .bezierCurveTo(-33, 6, -35, 9.3, -46, 7.8)
    .bezierCurveTo(-57, 7, -65, 8.5, l, 6.2)
    .closePath()
    .fill(
      vGradient([
        [0, GRASS_LIGHT],
        [0.32, GRASS],
        [1, GRASS_SHADE],
      ]),
    );
  bank.rect(l, surface, r - l, 1.05).fill(0xc6e66a);

  for (let i = 0; i < 21; i++) {
    const x = -76 + i * 7.42 + hash01(i + 144) * 4.5;
    const y = 1.95 + hash01(i + 173) * 3.45;
    const s = 0.57 + hash01(i + 732) * 0.74;
    bank
      .moveTo(x - 0.55 * s, y + 0.95 * s)
      .quadraticCurveTo(x - s, y + 0.15 * s, x - 1.4 * s, y - 0.54 * s)
      .quadraticCurveTo(x - 0.24 * s, y - 0.25 * s, x + 0.15 * s, y + 0.36 * s)
      .quadraticCurveTo(x + 0.5 * s, y - 0.54 * s, x + 1.4 * s, y - 0.82 * s)
      .lineTo(x + 0.91 * s, y + 0.85 * s)
      .closePath()
      .fill(i % 3 === 0 ? 0xb0d959 : 0x639e30);
  }

  for (const x of [-70, 64]) {
    bank.rect(x - 0.3, 0.4, 6.6, 4.5).fill(0x557447);
    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 3; column++)
        bank.rect(x + column * 2, 0.65 + row * 2, 2, 2).fill((row + column) % 2 === 0 ? CREAM : 0x394f37);
  }

  bank.poly(hull).stroke(outline);
  root.addChild(bank);
  trackPlaque(root);

  const platforms = new Graphics({ label: 'green-valley-lane-platforms' });
  for (const { x1, x2, y } of stage.platforms) {
    const top = -y;
    const bottom = top + laneDepth;
    platforms
      .poly([x1, top, x2, top, x2 - 0.55, bottom, x1 + 0.55, bottom])
      .fill(0xb8814d)
      .stroke({ ...outline, width: 0.55 });
    platforms
      .moveTo(x1 + 0.42, top + 0.38)
      .lineTo(x2 - 0.42, top + 0.38)
      .stroke({
        width: 0.72,
        color: 0xeacc8c,
      });
    platforms
      .moveTo(x1 + 0.65, top + 1.04)
      .lineTo(x2 - 0.65, top + 1.04)
      .stroke({ width: 0.35, color: 0x9c633d });
    for (const x of [x1 + 1.55, x2 - 1.55]) platforms.circle(x, bottom - 0.42, 0.24).fill(0x634e35);
    for (const x of [x1 + 3, x1 + 4.1, x2 - 4.7, x2 - 3.6])
      platforms
        .poly([x, top + 0.4, x + 0.48, top + 0.4, x + 1.05, bottom - 0.27, x + 0.57, bottom - 0.27])
        .fill(0xf1d9a2);
    for (const x of [x1 + 8.1, x2 - 8.1])
      platforms
        .moveTo(x, top + 1.28)
        .lineTo(x + 0.17, bottom - 0.2)
        .stroke({
          width: 0.26,
          color: 0x845a3a,
        });
  }
  root.addChild(platforms);
  return root;
}
