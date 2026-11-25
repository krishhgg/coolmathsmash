import { Graphics } from 'pixi.js';
import { flipY, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';

const INK = 0x1e335c;

export function createRing(): Graphics {
  const ring = new Graphics({ label: 'ring-playfield' });
  const hull = stage.solids[0]!.points;
  const { x: left, y: ledgeY } = stage.ledges[0]!;
  const { x: right } = stage.ledges[1]!;
  const y = -ledgeY;
  const shape = flipY(hull);
  ring
    .moveTo(left, y)
    .quadraticCurveTo(left + 19, y - 1.3, 0, y - 1.3)
    .quadraticCurveTo(right - 19, y - 1.3, right, y)
    .closePath()
    .fill(0x7fadd1);
  ring.poly(shape).fill(
    vGradient([
      [0, 0x57a5e4],
      [0.42, 0x3f84c1],
      [1, 0x37639b],
    ]),
  );
  ring
    .moveTo(left + 0.6, y + 0.95)
    .lineTo(right - 0.6, y + 0.95)
    .stroke({ width: 0.64, color: 0xa9ddf2, cap: 'round' })
    .moveTo(left + 3, y + 2.2)
    .quadraticCurveTo(0, y + 9.2, right - 3, y + 2.2)
    .stroke({ width: 0.68, color: 0x79b7e4, alpha: 0.82, cap: 'round' });
  ring.poly(shape).stroke({ width: 0.42, color: INK, join: 'round' });
  return ring;
}
