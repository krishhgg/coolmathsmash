import { Graphics } from 'pixi.js';
import type { StageGeometry } from '../../../sim/stage';
import { flipY, hash01, mix, type Point } from '../../battlefield/art/util';
import { FRAGILE, INK, STONE } from './palette';

const TILE = 16;
export const DECK_REAR = 6;
export const BRIDGE_REAR = 3.5;
export const BRIDGE_THICKNESS = 2.4;

type Project = (x: number, depth: number) => Point;

function tileTop(
  g: Graphics,
  at: Project,
  left: number,
  right: number,
  depth: number,
  palette: typeof STONE | typeof FRAGILE,
  seed: number,
): void {
  const patch = (points: readonly Point[], color: number) =>
    g.poly(points.flatMap(([x, d]) => at(x, d))).fill(color);
  const w = right - left;
  const split = depth * 0.51;
  const offset = hash01(seed);
  const front = mix(palette.top, palette.back, offset * 0.25);
  const back = mix(palette.back, palette.top, (1 - offset) * 0.24);
  patch(
    [
      [left, 0],
      [right, 0],
      [right, depth],
      [left, depth],
    ],
    back,
  );
  patch(
    [
      [left, 0],
      [right, 0],
      [right, split],
      [left, split],
    ],
    front,
  );
  patch(
    [
      [left, split - 0.14],
      [right, split - 0.14],
      [right, split + 0.14],
      [left, split + 0.14],
    ],
    mix(back, INK, 0.23),
  );
  patch(
    [
      [left, depth - 0.21],
      [right, depth - 0.21],
      [right, depth],
      [left, depth],
    ],
    mix(back, palette.edge, 0.4),
  );
  patch(
    [
      [left, 0],
      [left + 0.36, 0],
      [left + 0.36, depth],
      [left, depth],
    ],
    mix(back, INK, 0.38),
  );
  const p = left + w * (0.22 + offset * 0.32);
  patch(
    [
      [p - w * 0.13, split * 0.22],
      [p + w * 0.12, split * 0.14],
      [p + w * 0.23, split * 0.65],
      [p, split * 0.84],
    ],
    mix(front, palette.edge, 0.23),
  );
  patch(
    [
      [p - w * 0.08, depth * 0.81],
      [p + w * 0.24, depth * 0.62],
      [p + w * 0.34, depth * 0.79],
      [p + w * 0.11, depth * 0.91],
    ],
    mix(back, palette.edge, 0.15),
  );
}

function projector(left: number, y: number): Project {
  return (x, depth) => [x - depth * 0.75 * Math.min((x - left) / TILE, 1), y - depth];
}

export function drawBank({ points }: StageGeometry['solids'][number]): Graphics {
  const left = Math.min(...points.map(([x]) => x));
  const right = Math.max(...points.map(([x]) => x));
  const top = -Math.max(...points.map(([, y]) => y));
  const bottom = -Math.min(...points.map(([, y]) => y));
  const g = new Graphics({ label: `bank-${left}` });
  g.poly(flipY(points)).fill(INK);

  const cuts = [left];
  for (let x = Math.ceil(left / TILE) * TILE; x < right; x += TILE) if (x > left) cuts.push(x);
  cuts.push(right);
  const project = projector(left, top);

  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]!;
    const b = cuts[i + 1]!;
    const w = b - a;
    const seed = a + 251;
    const palette = Math.abs((a + b) / 2) === 56 ? FRAGILE : STONE;
    const variation = hash01(seed);
    const wall = mix(palette.wall, INK, variation * 0.23);
    tileTop(g, project, a, b, DECK_REAR, palette, seed);

    g.rect(a, top, w, 0.59).fill(palette.edge);
    g.rect(a, top + 0.59, w, 2.3).fill(mix(palette.lip, INK, variation * 0.2));
    g.rect(a, top + 2.89, w, 0.94).fill(mix(palette.lip, INK, 0.7));
    g.rect(a + 0.58, top + 3.83, w - 1.1, bottom - top - 5.1).fill(wall);
    g.poly([
      a + 0.58,
      bottom - 6.1 - 1.8 * variation,
      a + w * (0.42 + 0.23 * variation),
      bottom - 5.1,
      b - 0.52,
      bottom - 8.3 + 1.8 * variation,
      b - 0.52,
      bottom - 1.27,
      a + 0.58,
      bottom - 1.27,
    ]).fill(mix(wall, INK, 0.27));
    g.poly([a + 0.58, top + 3.83, a + 1.7, top + 5.4, a + 1.7, bottom - 3.1, a + 0.58, bottom - 1.27]).fill(
      mix(wall, palette.lip, 0.22),
    );
    g.poly([
      a + 0.58,
      bottom - 1.27,
      a + 1.7,
      bottom - 3.1,
      b - 1.85,
      bottom - 3.1,
      b - 0.52,
      bottom - 1.27,
    ]).fill(mix(wall, INK, 0.5));
    g.poly([
      a + w * (0.26 + variation * 0.1),
      top + 5.5 + variation * 2.3,
      a + w * 0.65,
      top + 5.7,
      a + w * (0.79 - variation * 0.15),
      top + 9 + variation * 2.3,
      a + w * 0.53,
      top + 12.1 + variation * 2.8,
      a + w * 0.23,
      top + 12.3,
    ]).fill(mix(wall, palette.lip, 0.11));
    g.rect(a, top + 0.45, 0.25, 2.4).fill(mix(palette.lip, INK, 0.5));
    if (palette === FRAGILE) {
      const crackX = (x: number) => (a < 0 ? a + x : b - x);
      g.moveTo(...project(crackX(10.4), DECK_REAR * 0.91))
        .lineTo(...project(crackX(8.4), DECK_REAR * 0.62))
        .lineTo(...project(crackX(9.8), DECK_REAR * 0.46))
        .lineTo(...project(crackX(7.6), DECK_REAR * 0.17))
        .stroke({ width: 0.28, color: 0x8e4c33 });
    }
  }

  const near = left < 0 ? right : left;
  const inset = near + (left < 0 ? -2 : 2);
  g.poly([
    ...project(near, DECK_REAR),
    ...project(inset, DECK_REAR),
    ...project(inset, 0),
    ...project(near, 0),
  ]).fill(0x554d49);
  g.rect(Math.min(near, inset), top, 2, 2.89).fill(0x96877a);
  g.poly([near, top + 2.89, inset, top + 2.89, inset, bottom - 3.2, near, bottom]).fill(0x382f30);
  g.poly([near, top + 2.89, (near + inset) / 2, top + 2.89, near, bottom]).fill(0x31292a);
  return g;
}

export function drawBridge({ x1, x2, y }: StageGeometry['platforms'][number]): Graphics {
  const g = new Graphics({ label: `bridge-${x1}` });
  const top = -y;
  const project = projector(x1, top);
  for (let a = x1; a < x2; a += TILE) {
    const b = Math.min(a + TILE, x2);
    tileTop(g, project, a, b, BRIDGE_REAR, STONE, a + 306);
    g.rect(a, top, b - a, BRIDGE_THICKNESS).fill(INK);
    g.rect(a + 0.18, top, b - a - 0.36, 0.48).fill(0xbbbbb2);
    g.rect(a + 0.32, top + 0.48, b - a - 0.64, 1.36).fill(0x66615b);
    g.rect(a + 1.6, top + 1.05, 1.3, 0.34).fill(0x999080);
    g.rect(b - 2.9, top + 1.05, 1.3, 0.34).fill(0x999080);
  }

  const mark = (x1 + x2) / 2 + (x1 < 0 ? TILE / 2 : -TILE / 2);
  const [mx, my] = project(mark, BRIDGE_REAR * 0.5);
  if (x1 < 0) {
    const cross = [
      -2.2, -0.85, -1.1, -0.99, 0, -0.45, 1.18, -0.99, 2.2, -0.81, 1, 0, 2.25, 0.67, 1.23, 0.86, 0, 0.34,
      -1.18, 0.87, -2.25, 0.64, -1, 0,
    ];
    g.poly(cross.map((v, i) => v + (i % 2 ? my + 0.27 : mx))).fill(0x4d4440);
    g.poly(cross.map((v, i) => v + (i % 2 ? my : mx))).fill(0xb2a496);
  } else {
    g.poly([
      mx - 2.12,
      my - 0.48,
      mx - 1.22,
      my - 0.94,
      mx + 0.93,
      my - 0.94,
      mx + 1.96,
      my - 0.48,
      mx + 2.15,
      my + 0.43,
      mx + 1.33,
      my + 0.94,
      mx - 0.85,
      my + 0.94,
      mx - 1.91,
      my + 0.49,
    ]).fill(0x62524a);
    g.poly([
      mx - 1.55,
      my - 0.33,
      mx - 0.96,
      my - 0.68,
      mx + 0.75,
      my - 0.68,
      mx + 1.43,
      my - 0.33,
      mx + 1.54,
      my + 0.23,
      mx + 0.94,
      my + 0.57,
      mx - 0.76,
      my + 0.57,
      mx - 1.44,
      my + 0.23,
    ]).fill(0xbf9974);
  }
  return g;
}
