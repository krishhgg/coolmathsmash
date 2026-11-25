import { Container, Graphics } from 'pixi.js';
import { flipY, hash01, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';

const INK = 0x423326;
const WARM_STEEL = 0xd08b36;

function pin(g: Graphics, x: number, y: number, r = 0.47): void {
  g.circle(x, y, r).fill(0xf1c984).stroke({ color: INK, width: 0.24 });
}

function caution(g: Graphics, l: number, r: number, y: number, h: number, step: number): void {
  g.rect(l, y, r - l, h).fill(INK);
  const slant = h * 0.58;
  for (let x = l + slant; x + step * 0.54 <= r; x += step) {
    g.poly([x, y, x + step * 0.54, y, x + step * 0.54 - slant, y + h, x - slant, y + h]).fill(0xeebf49);
  }
}

function mainBeam(): Graphics {
  const hull = stage.solids[0]!.points;
  const l = Math.min(...hull.map(([x]) => x));
  const r = Math.max(...hull.map(([x]) => x));
  const y = -Math.max(...hull.map(([, y]) => y));
  const shape = flipY(hull);
  const g = new Graphics({ label: 'girder' });
  g.poly(shape).fill(
    vGradient([
      [0, 0xf4be51],
      [0.44, WARM_STEEL],
      [1, 0x815128],
    ]),
  );
  g.poly([-76, 6.3, 76, 6.3, 70.8, 12.3, -70.8, 12.3]).fill(0x8c5b32);
  for (let i = 0; i < 52; i++) {
    const x = -68 + hash01(i + 453) * 136;
    const y = 6.8 + hash01(i + 515) * 5.2;
    g.ellipse(x, y, 0.25 + hash01(i + 657), 0.19).fill({ color: 0xf2c87f, alpha: 0.22 });
  }
  for (let x = -72; x < 64; x += 16) {
    g.moveTo(x, 7)
      .lineTo(x + 6.8, 12.1)
      .lineTo(x + 14.4, 7)
      .stroke({ color: 0xbb843e, width: 1.4, join: 'round' });
    pin(g, x + 6.8, 11.7);
  }
  g.rect(l, y, r - l, 2.2).fill(
    vGradient([
      [0, 0xece3cb],
      [1, 0x8f9291],
    ]),
  );
  g.rect(l + 0.4, y + 3, r - l - 0.8, 2.05).fill(0xa16a2d);
  for (const x of [-40, 40]) {
    g.roundRect(x - 12, y + 3.15, 24, 4.3, 0.44)
      .fill(0x9d753f)
      .stroke({ color: INK, width: 0.35 });
    caution(g, x - 11.65, x + 11.65, y + 3.5, 2.18, 3.35);
    g.rect(x - 3.5, y + 6.35, 7, 0.62).fill(0x684b2f);
  }
  for (const x of [l + 3, l + 8, -16, 16, r - 8, r - 3]) pin(g, x, 4.1);
  for (const x of [l + 0.25, r - 4.55]) {
    g.rect(x, y + 0.45, 4.3, 7)
      .fill(0xd49331)
      .stroke({ color: INK, width: 0.33 });
    g.rect(x + 0.5, y + 0.8, 1.1, 6.35).fill(0xe4ad4a);
    pin(g, x + 2.5, y + 2);
    pin(g, x + 2.5, y + 5.9);
  }
  g.poly(shape).stroke({ color: INK, width: 0.62, join: 'round' });
  return g;
}

function scaffold(p: StageGeometryPlatform): Graphics {
  const g = new Graphics({ label: 'scaffold' });
  const l = p.x1;
  const r = p.x2;
  const cx = (l + r) / 2;
  const y = -p.y;
  g.poly([l + 1, y + 1.6, cx - 3, y + 5.1, cx + 3, y + 5.1, r - 1, y + 1.6])
    .fill(0x96734d)
    .stroke({ color: INK, width: 0.4, join: 'round' });
  for (const d of [-10, -3, 4, 11]) {
    g.moveTo(cx + d, y + 2.2)
      .lineTo(cx + Math.sign(d) * 2.6, y + 4.55)
      .stroke({ color: 0xc7a071, width: 0.4 });
  }
  g.rect(l, y, r - l, 2)
    .fill(
      vGradient([
        [0, 0xdad5c5],
        [1, 0x9b958b],
      ]),
    )
    .stroke({ color: INK, width: 0.48 });
  caution(g, l + 0.3, l + 5.4, y + 0.55, 1.11, 1.45);
  caution(g, r - 5.4, r - 0.3, y + 0.55, 1.11, 1.45);
  for (const x of [l + 8, cx, r - 8]) pin(g, x, y + 1.14, 0.34);
  return g;
}

type StageGeometryPlatform = (typeof stage.platforms)[number];

export function createPlayfield() {
  const container = new Container({ label: 'construction-playfield' });
  container.addChild(mainBeam(), ...stage.platforms.map(scaffold));
  return container;
}
