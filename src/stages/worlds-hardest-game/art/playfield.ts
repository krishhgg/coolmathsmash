import { Graphics } from 'pixi.js';
import { flipY } from '../../battlefield/art/util';
import { DECK, stage } from '../geometry';

const INK = 0x15121c;
const TILE_LIGHT = 0xf5f2fa;
const TILE_LAVENDER = 0xddd7f1;
const SAFE_GREEN = 0xa4ed93;
const PLATFORM_THICKNESS = 2.2;

export function createPlayfield(): { deck: Graphics; platforms: Graphics[] } {
  const g = new Graphics({ label: 'worlds-hardest-game-playfield' });
  const { left, right, top, laneDepth, safeDepth, safeWidth } = DECK;
  const laneLeft = left + safeWidth;
  const laneWidth = right - left - 2 * safeWidth;
  const columns = 15;
  const rows = 3;
  const tileWidth = laneWidth / columns;
  const tileHeight = laneDepth / rows;
  const hull = flipY(stage.solids[0]!.points);

  g.poly(hull).fill(TILE_LIGHT);
  for (let row = 0; row < rows; row++)
    for (let col = row % 2; col < columns; col += 2)
      g.rect(laneLeft + col * tileWidth, -top + row * tileHeight, tileWidth, tileHeight).fill(TILE_LAVENDER);
  g.rect(left, -top, safeWidth, safeDepth).fill(SAFE_GREEN);
  g.rect(right - safeWidth, -top, safeWidth, safeDepth).fill(SAFE_GREEN);
  g.poly(hull).stroke({ width: 0.9, color: INK });

  const platforms = stage.platforms.map(({ x1, x2, y }, index) => {
    const g = new Graphics({ label: `soft-platform-${index}` });
    const bottom = -y + PLATFORM_THICKNESS;
    g.rect(x1, -y, x2 - x1, PLATFORM_THICKNESS).fill(TILE_LIGHT);
    for (let col = 0; col < columns; col += 2) {
      const tileX = laneLeft + col * tileWidth;
      const from = Math.max(x1, tileX);
      const to = Math.min(x2, tileX + tileWidth);
      if (to > from) g.rect(from, -y, to - from, PLATFORM_THICKNESS).fill(TILE_LAVENDER);
    }
    g.moveTo(x1, -y)
      .lineTo(x1, bottom)
      .lineTo(x2, bottom)
      .lineTo(x2, -y)
      .stroke({ width: 0.35, color: INK, alpha: 0.45 });
    g.moveTo(x1, -y).lineTo(x2, -y).stroke({ width: 0.65, color: INK });
    return g;
  });

  return { deck: g, platforms };
}
