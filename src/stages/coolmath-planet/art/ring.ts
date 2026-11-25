import { Graphics } from 'pixi.js';
import { flipY, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';

const INK = 0x171c39;

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
    .fill(0x4c87bb)
    .stroke({ width: 0.3, color: 0x315480, join: 'round' });
  ring.poly(shape).fill(
    vGradient([
      [0, 0x4598df],
      [0.27, 0x2c76be],
      [0.64, 0x254e97],
      [1, 0x24316b],
    ]),
  );
  ring
    .moveTo(left + 2, y + 1.2)
    .lineTo(right - 2, y + 1.2)
    .stroke({ width: 0.85, color: 0xa9dbf1, cap: 'round' })
    .moveTo(left + 4, y + 4)
    .quadraticCurveTo(0, y + 11.8, right - 4, y + 4)
    .stroke({ width: 0.72, color: 0x68b6ed, alpha: 0.8, cap: 'round' })
    .moveTo(left + 13, y + 9)
    .quadraticCurveTo(0, y + 19, right - 13, y + 9)
    .stroke({ width: 0.55, color: 0x5c8ac6, cap: 'round' });
  ring.poly(shape).stroke({ width: 0.7, color: INK, join: 'round' });
  for (const x of [left + 6, right - 6]) {
    ring
      .roundRect(x - 1.8, y + 2.5, 3.6, 1.4, 0.55)
      .fill(0xe9b754)
      .stroke({ width: 0.26, color: INK });
  }
  return ring;
}
