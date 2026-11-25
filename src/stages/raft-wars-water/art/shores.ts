import { Container, Graphics } from 'pixi.js';
import { flipY } from '../../battlefield/art/util';
import { stage } from '../geometry';

const SAND_INK = 0x55472b;

function palm(x: number, height: number, lean: number): Container {
  const tree = new Container();
  tree.position.x = x;
  const trunk = new Graphics();
  trunk
    .moveTo(-2.1, -0.8)
    .bezierCurveTo(-2, -height * 0.44, lean * 0.55 - 2, -height * 0.73, lean - 1.8, -height)
    .lineTo(lean + 1.8, -height + 0.4)
    .bezierCurveTo(lean * 0.54 + 1.9, -height * 0.71, 2, -height * 0.41, 2.4, -0.8)
    .closePath()
    .fill(0x896839)
    .stroke({ width: 0.38, color: 0x6e502d });
  trunk
    .moveTo(-1.1, -1)
    .bezierCurveTo(-0.9, -height * 0.47, lean * 0.5 - 0.9, -height * 0.72, lean - 0.5, -height + 0.8)
    .stroke({ width: 0.72, color: 0xb59055 });
  for (const t of [0.11, 0.23, 0.38, 0.54, 0.68, 0.82]) {
    const dx = lean * t ** 2;
    trunk
      .moveTo(dx - 1.5, -height * t)
      .quadraticCurveTo(dx, -height * t + 0.8, dx + 1.55, -height * t - 0.15)
      .stroke({ width: 0.45, color: 0x654c2b, alpha: 0.7 });
  }
  tree.addChild(trunk);
  for (const [angle, length, color] of [
    [161, 17, 0x2c6939],
    [195, 22, 0x296735],
    [223, 19, 0x408040],
    [278, 15, 0x3a7a38],
    [311, 20, 0x448448],
    [349, 23, 0x36763b],
    [22, 15, 0x255d33],
    [104, 10, 0x36743a],
  ] as const) {
    const leaf = new Graphics();
    leaf
      .moveTo(0, 0)
      .bezierCurveTo(3.6, -6.8, length * 0.68, -9.1, length, -0.8)
      .quadraticCurveTo(length * 0.88, -2.1, length * 0.78, 0.7)
      .lineTo(length * 0.79, -0.9)
      .quadraticCurveTo(length * 0.66, 1.3, length * 0.55, 3.1)
      .lineTo(length * 0.57, 0.7)
      .quadraticCurveTo(length * 0.45, 4.2, length * 0.3, 4.3)
      .lineTo(length * 0.3, 2.3)
      .quadraticCurveTo(1.8, 3.25, 0, 0)
      .fill(color);
    leaf
      .moveTo(1.3, 0)
      .quadraticCurveTo(length * 0.44, -4.3, length * 0.85, -2.5)
      .stroke({ width: 0.44, color: 0xa8bd70, alpha: 0.34 });
    leaf.position.set(lean, -height);
    leaf.angle = angle;
    tree.addChild(leaf);
  }
  const nuts = new Graphics();
  nuts.ellipse(lean - 1.1, -height + 1.6, 1.2, 1.7).fill(0x756641);
  nuts.ellipse(lean + 1.3, -height + 1.8, 1.25, 1.55).fill(0xa58a51);
  tree.addChild(nuts);
  return tree;
}

function drawNoSwimmingMark(g: Graphics, x: number, y: number): void {
  g.circle(x, y, 3.55).fill(0xeed799).stroke({ width: 0.42, color: 0xb67c4c });
  g.circle(x + 0.87, y - 0.92, 0.54).fill(0x68664a);
  g.moveTo(x - 1.75, y + 0.37)
    .lineTo(x - 0.45, y - 0.99)
    .lineTo(x + 0.03, y - 0.2)
    .moveTo(x - 2.05, y + 1.24)
    .quadraticCurveTo(x - 1.4, y + 0.8, x - 0.7, y + 1.14)
    .quadraticCurveTo(x - 0.05, y + 1.47, x + 0.61, y + 1.15)
    .quadraticCurveTo(x + 1.3, y + 0.81, x + 1.89, y + 1.14)
    .stroke({ width: 0.38, color: 0x68664a, cap: 'round', join: 'round' });
  g.moveTo(x - 2.38, y - 2.14)
    .lineTo(x + 2.27, y + 2.22)
    .stroke({ width: 0.54, color: 0xae7150, cap: 'round' });
}

export function createShores(): Container {
  const shores = new Container({ label: 'sandbars' });
  for (const [id, lean, height] of [
    [0, -7, 32],
    [2, 7, 38],
  ] as const) {
    const { points } = stage.solids[id]!;
    const a = points[0]![0];
    const b = points[1]![0];
    const center = (a + b) / 2;
    const side = Math.sign(center);
    const ornamentX = center + side * 11.5;
    shores.addChild(palm(ornamentX, height, lean));

    const g = new Graphics();
    const polygon = flipY(points);
    g.poly(polygon).fill(0xc69c5d);
    const [, wallA] = points[2]!;
    const [x1, y1] = points[3]!;
    const [x2, y2] = points.at(-2)!;
    const [x3, y3] = points.at(-1)!;
    g.moveTo(a, 0)
      .lineTo(b, 0)
      .lineTo(b, -wallA)
      .lineTo(x1, -y1)
      .bezierCurveTo(b + side * 5, 13.6, center - side * 13, 12.4, center - side * 7, 14.1)
      .bezierCurveTo(center + side * 5, 16.3, center + side * 13, 13.7, x2, -y2)
      .lineTo(x3, -y3)
      .closePath()
      .fill(0xf1d987);
    g.poly([
      center + side * 9,
      15,
      center + side * 25,
      10,
      center + side * 25,
      17,
      center + side * 13,
      31,
      center + side * 7,
      31,
    ]).fill(0xd2aa68);
    g.poly([
      center - side * 25,
      17,
      center - side * 11,
      14,
      center - side * 1,
      22,
      center - side * 5,
      34,
      center - side * 16,
      30,
    ]).fill(0xb88c50);
    g.moveTo(a, 0)
      .lineTo(b, 0)
      .lineTo(b, 1.75)
      .quadraticCurveTo(center + side * 6, 2.9, a, 1.7)
      .closePath()
      .fill(0xf8e5a5);
    g.poly(polygon).stroke({ color: SAND_INK, width: 0.68, join: 'round' });
    g.ellipse(ornamentX - 1.3, -0.75, 5, 1.15).fill({ color: 0xb59c5c, alpha: 0.66 });
    g.poly([
      ornamentX - 4.6,
      -0.7,
      ornamentX - 3.7,
      -3,
      ornamentX - 1.6,
      -3.75,
      ornamentX + 0.3,
      -2.2,
      ornamentX + 1.1,
      -0.7,
    ]).fill(0x9e9c82);
    g.poly([ornamentX - 4.6, -0.7, ornamentX - 3.7, -3, ornamentX - 1.6, -3.75, ornamentX - 2.3, -1.7]).fill(
      0xbcb99a,
    );
    g.ellipse(center - side * 12, 5.4, 1.12, 0.63)
      .ellipse(center - side * 9, 7.3, 0.62, 0.42)
      .ellipse(center + side * 19, 8, 1.6, 0.68)
      .ellipse(center + side * 21, 10.4, 0.65, 0.38)
      .fill({ color: 0xa98651, alpha: 0.55 });
    drawNoSwimmingMark(g, center - side * 21, 6.7);
    shores.addChild(g);
  }
  return shores;
}
