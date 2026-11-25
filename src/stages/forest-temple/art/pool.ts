import { Container, Graphics } from 'pixi.js';
import { flipY, hash01, vGradient } from '../../battlefield/art/util';
import { GOO, POOL_FILL } from '../geometry';
import { INK } from './palette';

export function createPool() {
  const water = new Container({ label: 'goo' });
  const inset = (1 - GOO.y2 / GOO.y1) * 7;
  const l = -5 - inset;
  const r = 5 + inset;
  const y = -GOO.y2;
  const bottom = -GOO.y1;
  const basin = new Graphics()
    .moveTo(l, y)
    .quadraticCurveTo(-9, y + 0.85, -6, y + 0.24)
    .quadraticCurveTo(-2, y + 0.96, 1, y + 0.26)
    .quadraticCurveTo(4, y - 0.22, 7.5, y + 0.53)
    .quadraticCurveTo(9.5, y + 0.61, r, y)
    .lineTo(5, bottom)
    .lineTo(-5, bottom)
    .closePath()
    .fill(
      vGradient([
        [0, 0x5db544],
        [0.33, 0x338e31],
        [1, 0x185425],
      ]),
    )
    .stroke({ width: 0.44, color: 0x162a12, join: 'round' });
  const bubbles = Array.from({ length: 7 }, (_, i) => {
    const radius = 0.19 + hash01(i * 137 + 7) * 0.48;
    const g = new Graphics().circle(0, 0, radius).fill(0x4eae3a).stroke({ width: 0.14, color: 0x264f24 });
    g.circle(radius * -0.25, radius * -0.29, radius * 0.31).fill(0x95cd57);
    return g;
  });
  water.addChild(basin, ...bubbles);
  const stone = new Graphics();
  const hull = flipY(POOL_FILL.points);
  stone
    .poly(hull)
    .fill(
      vGradient([
        [0, 0xa39963],
        [1, 0x655c33],
      ]),
    )
    .stroke({ width: 0.5, color: INK, join: 'round' });
  stone
    .moveTo(GOO.x1 + 0.8, 0.56)
    .lineTo(GOO.x2 - 0.8, 0.56)
    .stroke({ width: 0.55, color: 0xc1b78a });
  for (const x of [-6, 0, 6]) {
    stone
      .moveTo(x, 1)
      .lineTo(x - 0.55, bottom - (x === 0 ? 0.45 : 0.9))
      .stroke({ width: 0.28, color: 0x514929 });
  }
  const container = new Container();
  container.addChild(water, stone);
  return {
    container,
    update(frame: number, hazards: boolean) {
      water.visible = hazards;
      stone.visible = !hazards;
      if (!hazards) return;
      for (const [i, g] of bubbles.entries()) {
        const progress = ((frame + 13 * i) % (61 + 3 * i)) / (61 + 3 * i);
        const x = -6.8 + 13.6 * hash01(i + 133);
        g.position.set(x + 0.24 * Math.sin(progress * 3.8 + i), 3.85 - 2.8 * progress);
        g.alpha = 0.75 * Math.sin(Math.PI * progress);
      }
    },
  };
}
