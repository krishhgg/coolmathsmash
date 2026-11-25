import { Container, Graphics } from 'pixi.js';
import { scheduledOn } from '../../../sim/movingStage';
import { flipY, hash01, vGradient } from '../../battlefield/art/util';
import type { StageViewFrame } from '../../battlefield/view';
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

function beam(solid: (typeof stage.solids)[number], index: number) {
  const hull = solid.points;
  const l = Math.min(...hull.map(([x]) => x));
  const r = Math.max(...hull.map(([x]) => x));
  const y = -Math.max(...hull.map(([, y]) => y));
  const width = r - l;
  const shape = flipY(hull);
  const g = new Graphics({ label: 'girder' });
  g.poly(shape).fill(
    vGradient([
      [0, 0xf4be51],
      [0.44, WARM_STEEL],
      [1, 0x815128],
    ]),
  );
  const leftInset = l === -80 ? 11 : 1.4;
  const rightInset = r === 80 ? 11 : 1.4;
  g.poly([l + 2, 6.3, r - 2, 6.3, r - rightInset, 12.3, l + leftInset, 12.3]).fill(0x8c5b32);
  for (let i = 0; i < width * 0.32; i++) {
    const key = index * 37 + i;
    const x = l + leftInset + hash01(key + 453) * (width - leftInset - rightInset);
    const spotY = 6.8 + hash01(key + 515) * 5.2;
    g.ellipse(x, spotY, 0.25 + hash01(key + 657), 0.19).fill({ color: 0xf2c87f, alpha: 0.22 });
  }
  for (let x = l + leftInset; x + 10 < r - rightInset; x += 13) {
    g.moveTo(x, 7.4)
      .lineTo(x + 4.9, 11.6)
      .lineTo(x + 10, 7.4)
      .stroke({ color: 0xbb843e, width: 1.4, join: 'round' });
    pin(g, x + 4.9, 11.3);
  }
  g.rect(l, y, r - l, 2.2).fill(
    vGradient([
      [0, 0xece3cb],
      [1, 0x8f9291],
    ]),
  );
  g.rect(l + 0.4, y + 3, r - l - 0.8, 2.05).fill(0xa16a2d);
  const warning = new Graphics();
  warning.visible = false;
  if (solid.schedule) {
    g.roundRect(l + 0.35, y + 3.15, width - 0.7, 4.3, 0.44)
      .fill(0x9d753f)
      .stroke({ color: INK, width: 0.35 });
    caution(g, l + 0.65, r - 0.65, y + 3.5, 2.18, 3.35);
    g.rect((l + r) / 2 - 3.5, y + 6.35, 7, 0.62).fill(0x684b2f);
    warning.rect(l + 0.45, y + 0.7, width - 0.9, 1.8).fill(0xff9a37);
    for (const x of [l + 1.8, r - 1.8]) warning.circle(x, 6.6, 0.83).fill(0xff561e);
    g.addChild(warning);
  } else {
    for (const x of [l + 5, r - 5]) pin(g, x, 4.1);
  }
  const caps = l === -80 ? [l + 0.25] : r === 80 ? [r - 4.55] : [];
  for (const x of caps) {
    g.rect(x, y + 0.45, 4.3, 7)
      .fill(0xd49331)
      .stroke({ color: INK, width: 0.33 });
    g.rect(x + 0.5, y + 0.8, 1.1, 6.35).fill(0xe4ad4a);
    pin(g, x + 2.5, y + 2);
    pin(g, x + 2.5, y + 5.9);
  }
  g.poly(shape).stroke({ color: INK, width: 0.62, join: 'round' });
  return { node: g, warning };
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
  const beams = stage.solids.map(beam);
  container.addChild(...beams.map((b) => b.node), ...stage.platforms.map(scaffold));
  return {
    container,
    update(frame: number, { pieces, hazards }: StageViewFrame) {
      beams.forEach(({ node, warning }, i) => {
        const piece = pieces.solids[i]!;
        node.visible = piece.on;
        warning.visible = hazards && piece.on && !scheduledOn(stage.solids[i]!.schedule, frame + 60);
        warning.alpha = 0.58 + 0.42 * Math.cos((frame * Math.PI) / 10);
      });
    },
  };
}
