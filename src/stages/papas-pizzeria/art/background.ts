import { Container, Graphics } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, type StageCamera } from '../../battlefield/art/parallax';
import { hash01, mix } from '../../battlefield/art/util';
import { COUNTER_Y, createFixtures, createIngredients } from './kitchen';
import { createPizza } from './pizza';

export const ROOM_LAYER = {
  depth: 0.09,
  left: -330,
  right: VIEW_W + 330,
  top: -290,
  bottom: VIEW_H + 330,
} as const;

function drawRoom(): Graphics {
  const g = new Graphics({ label: 'tile-and-butcher-block' });
  const { left, top, right, bottom } = ROOM_LAYER;
  const w = right - left;
  const seam = COUNTER_Y;
  g.rect(left, top, w, bottom - top).fill(0x596d42);
  const tile = 84;
  for (let x = left, col = 0; x < right; x += tile, col++) {
    for (let y = seam + tile, row = 0; y + tile > top; y -= tile, row++) {
      const tw = Math.min(tile - 1.5, right - x);
      const softLight = Math.max(0, 1 - Math.hypot((x - 600) / 1160, (y - 118) / 1000));
      const pattern = (row + col) % 2 === 0 ? 0.14 : 0;
      const color = mix(0x536c3e, 0x7f9953, softLight * 0.77 + pattern + hash01(31 * col + row) * 0.08);
      g.rect(x, y, tw, tile - 1.5).fill(color);
      g.rect(x, y, tw, 2).fill(mix(color, 0xb1a66d, 0.22));
    }
  }
  const warmFrom = seam - 112;
  const warmTo = seam + 92;
  const bands = 48;
  const dy = (warmTo - warmFrom) / bands;
  for (let i = 0; i < bands; i++) {
    const t = (i + 1) / bands;
    g.rect(left, warmFrom + dy * i, w, dy + 0.1).fill({ color: 0xa27a56, alpha: t * t * (3 - 2 * t) });
  }
  g.rect(left, warmTo, w, bottom - warmTo).fill(0xa27a56);
  for (let i = -9; i <= 9; i++) {
    const a = VIEW_W / 2 + 137 * i - 74;
    const b = VIEW_W / 2 + 268 * i - 94;
    for (let j = 0; j < 3; j++) {
      const f = hash01(i * 12 + j + 74) * 0.8 + 0.1;
      const y = seam + 68 + 70 * j + hash01(i * 17 + j) * 62;
      const drift = (b - a + 131 * f) / (bottom - seam);
      const x = a + 137 * f + (y - seam) * drift;
      g.moveTo(x, y)
        .quadraticCurveTo(x + drift * 45 + 6, y + 45, x + drift * 75 + 4, y + 80)
        .stroke({ width: 2.6, color: 0x855c42, alpha: 0.24, cap: 'round' });
    }
  }
  return g;
}

export function createBackground() {
  const container = new Container({ label: 'pizzeria-background' });
  const base = new Graphics({ label: 'pizzeria-depth-zero' })
    .rect(-32, -32, VIEW_W + 64, VIEW_H + 64)
    .fill(0x596d42);
  container.addChild(base);

  const fixtures = createFixtures();
  const layers = [
    { depth: ROOM_LAYER.depth, art: [drawRoom(), fixtures.container] },
    { depth: 0.15, art: [createPizza()] },
    { depth: 0.12, art: [createIngredients()] },
  ].map(({ depth, art }) => {
    const layer = new Container();
    layer.pivot.set(VIEW_W / 2, VIEW_H / 2);
    layer.addChild(...art);
    container.addChild(layer);
    return { depth, layer };
  });

  return {
    container,
    update(frame: number, camera: StageCamera) {
      for (const { depth, layer } of layers) {
        const t = layerTransform(depth, camera);
        layer.position.set(t.x, t.y);
        layer.scale.set(t.scale);
      }
      fixtures.update(frame);
    },
  };
}
