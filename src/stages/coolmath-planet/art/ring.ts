import { Graphics } from 'pixi.js';
import { flipY } from '../../battlefield/art/util';
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
  ring.poly(shape).fill(0x4c90cb);
  ring.moveTo(left, y + 2.5).quadraticCurveTo(0, y + 10.2, right, y + 2.5);
  for (const [x, py] of hull.slice(3)) ring.lineTo(x, -py);
  ring.closePath().fill(0x3f74ad);
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
