import { Graphics } from 'pixi.js';
import { flipY } from '../../battlefield/art/util';
import { stage } from '../geometry';
import { drawWaterline } from './lagoon';

const INK = 0x254731;
const STENCIL = 0xd7e6a1;

const LETTERS = {
  T: [
    [0, 0, 3, 0],
    [1.6, 0, 1.3, 4.2],
  ],
  U: [[0.2, 0, 0, 3.1, 0.8, 4.1, 2, 4.1, 2.8, 3.2, 3, 0]],
  R: [
    [0, 4.2, 0.3, 0, 2.3, 0, 3, 0.8, 2.7, 1.7, 0.3, 2],
    [1.6, 2, 2.8, 4.15],
  ],
  L: [[0.25, 0, 0, 4.15, 2.7, 4]],
  E: [
    [2.8, 0, 0.25, 0, 0, 4.1, 2.75, 4],
    [0.2, 2, 2.3, 1.9],
  ],
  P: [[0, 4.2, 0.3, 0, 2.3, 0, 3, 0.8, 2.7, 1.7, 0.3, 2]],
  O: [[0.35, 0.9, 1.15, 0, 2.4, 0, 3, 0.8, 2.9, 3.25, 2, 4.15, 0.7, 4.15, 0, 3.2, 0.35, 0.9]],
  W: [[0, 0, 0.38, 4.2, 1.6, 2, 2.7, 4.1, 3.3, 0]],
};

function drawBoatName(g: Graphics, x: number, name: readonly (keyof typeof LETTERS)[]): void {
  for (const letter of name) {
    for (const line of LETTERS[letter]) {
      g.moveTo(x + line[0]!, 9.5 + line[1]!);
      for (let i = 2; i < line.length; i += 2) g.lineTo(x + line[i]!, 9.5 + line[i + 1]!);
      g.stroke({ width: 0.74, color: STENCIL, cap: 'round', join: 'round' });
    }
    x += 4.1;
  }
}

function drawTurtle(g: Graphics): void {
  g.moveTo(-5.8, 9.6)
    .quadraticCurveTo(-8.4, 7.05, -10.4, 8.15)
    .quadraticCurveTo(-9.4, 9.4, -8.5, 11.05)
    .lineTo(-10.8, 12.7)
    .lineTo(-8.45, 12.75)
    .quadraticCurveTo(-9, 14.6, -10.4, 15.85)
    .quadraticCurveTo(-7.75, 16.3, -5.15, 14.4)
    .quadraticCurveTo(0.2, 15.95, 4.45, 13.2)
    .quadraticCurveTo(6.25, 14.85, 9.25, 14.5)
    .quadraticCurveTo(7.4, 13.1, 6.65, 11.75)
    .quadraticCurveTo(8.45, 11.65, 9.9, 10.15)
    .quadraticCurveTo(10.15, 8.55, 8.35, 8.2)
    .quadraticCurveTo(7.05, 7.95, 5.5, 9.9)
    .quadraticCurveTo(4.85, 8.05, 6.45, 6.9)
    .quadraticCurveTo(4.65, 6.4, 2.4, 8.75)
    .quadraticCurveTo(-1.1, 7.5, -5.8, 9.6)
    .fill(STENCIL);
  g.ellipse(-1.25, 11.65, 6.2, 3.35).fill(0x6b9e4f);
  g.moveTo(-3.25, 9.75)
    .lineTo(0.45, 9.25)
    .lineTo(2.42, 11.45)
    .lineTo(0.65, 13.85)
    .lineTo(-3.3, 13.15)
    .lineTo(-4.5, 11.4)
    .closePath()
    .fill(0xa5c46f);
  g.moveTo(-4.5, 11.4)
    .lineTo(-7.05, 11.25)
    .moveTo(2.42, 11.45)
    .lineTo(4.72, 11.28)
    .stroke({ width: 0.45, color: STENCIL });
  g.circle(8.3, 9.59, 0.36).fill(INK);
}

export function createBoat(): Graphics {
  const g = new Graphics({ label: 'lagoon-skiff' });
  const { points } = stage.solids[1]!;
  const polygon = flipY(points);
  const [left, top] = points[0]!;
  const [right] = points[1]!;
  const [, gunwale] = points[2]!;
  const { x1, x2, y } = stage.platforms[0]!;
  const deckY = -top;
  const roofY = -y;

  g.moveTo(x1 + 1.3, roofY + 2)
    .lineTo(x1 + 4, deckY - 0.5)
    .moveTo(x2 - 1.3, roofY + 2)
    .lineTo(x2 - 4, deckY - 0.5)
    .stroke({ width: 0.53, color: 0xd1d8c8, alpha: 0.88 });

  g.poly([left, deckY, left + 3, deckY - 1.15, right - 3, deckY - 1.15, right, deckY]).fill(0x9b945c);
  g.poly(polygon).fill(0x4b9649);
  const [ribX, ribY] = points[3]!;
  const [keelX, keelY] = points[4]!;
  g.moveTo(-ribX, -ribY)
    .quadraticCurveTo(0, 19, ribX, -ribY)
    .lineTo(keelX, -keelY)
    .lineTo(-keelX, -keelY)
    .closePath()
    .fill(0x2e643b);
  g.moveTo(left + 1.8, 6.3)
    .quadraticCurveTo(0, 8, right - 1.8, 6.3)
    .stroke({ width: 0.62, color: 0x79b261, cap: 'round' });
  g.moveTo(-35.5, 15.15)
    .quadraticCurveTo(0, 19.1, 35.5, 15.15)
    .stroke({ width: 0.43, color: 0x467f46, cap: 'round' });
  g.poly([left, deckY, right, deckY, right, -gunwale, left, -gunwale]).fill(0x296a3d);
  g.rect(left + 0.5, deckY + 0.5, right - left - 1, 1.25).fill(0x80ba61);
  g.moveTo(left + 0.1, -gunwale)
    .lineTo(right - 0.1, -gunwale)
    .stroke({ width: 0.54, color: INK });
  g.poly(polygon).stroke({ width: 0.73, color: INK, join: 'round' });

  for (const x of [left + 3.4, left + 7.4, right - 7.4, right - 3.4]) g.circle(x, 3.4, 0.48).fill(0xc4c18a);
  drawBoatName(g, -35.5, ['T', 'U', 'R', 'T', 'L', 'E']);
  drawTurtle(g);
  drawBoatName(g, 13.5, ['P', 'O', 'W', 'E', 'R']);

  g.roundRect(x1, roofY, x2 - x1, 2.35, 0.45)
    .fill(0x40844a)
    .stroke({ width: 0.62, color: INK });
  g.moveTo(x1 + 0.35, roofY + 0.42)
    .lineTo(x2 - 0.35, roofY + 0.42)
    .stroke({ width: 0.53, color: 0x8bbd6d, cap: 'round' });
  for (let x = x1 + 0.5; x + 4.2 < x2; x += 4.2)
    g.moveTo(x, roofY + 1.78)
      .quadraticCurveTo(x + 2.02, roofY + 2.86, x + 4.2, roofY + 1.78)
      .fill(0x6ca45a);

  drawWaterline(g, points);
  return g;
}
