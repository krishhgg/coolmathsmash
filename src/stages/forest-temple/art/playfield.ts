import { Container, Graphics } from 'pixi.js';
import { compileStage } from '../../../sim/stage';
import { diamond, flipY, hash01, mix, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';
import { INK, IVY, MORTAR, STONES } from './palette';

function ivy(g: Graphics, x: number, y: number, size: number, seed: number): void {
  for (let i = 0; i < 5; i++) {
    const dir = i - 2;
    const s = size * (0.7 + hash01(seed + i * 107) * 0.55);
    const dx = dir * s * 0.65;
    const dy = (1.4 - Math.abs(dir) * 0.35) * s;
    g.moveTo(x + dx * 0.24, y + 0.1)
      .quadraticCurveTo(x + dx + s * 0.34, y - 0.2, x + dx, y + dy)
      .quadraticCurveTo(x + dx - s * 0.8, y + dy * 0.72, x + dx * 0.24, y + 0.1)
      .closePath()
      .fill(IVY[(i + seed) % IVY.length]!)
      .stroke({ width: 0.24, color: INK, alpha: 0.8 });
    g.moveTo(x + dx * 0.29, y + 0.2)
      .lineTo(x + dx * 0.83, y + dy * 0.66)
      .stroke({ width: 0.13, color: 0x81ac54, alpha: 0.6 });
  }
}

function stonework(g: Graphics): void {
  const stepX = 12;
  const stepY = 6.2;
  let i = 0;
  for (let y = -2; y < 30; y += stepY) {
    const row = Math.round((y + 2) / stepY);
    for (let x = -94 - (row % 2) * (stepX / 2); x < 90; x += stepX) {
      const tint = mix(STONES[i % STONES.length]!, MORTAR, 0.4 * Math.max(0, y / 28));
      const w = stepX - 0.55;
      const h = stepY - 0.5;
      const tilt = hash01(i++ + 9271) * 0.5;
      const a = x + 0.4 + tilt;
      const b = x + w;
      g.poly([
        a,
        y + 0.4,
        b - 0.5,
        y,
        b,
        y + 0.62,
        b - tilt,
        y + h - 0.5,
        b - 0.6,
        y + h,
        x + 0.46,
        y + h - tilt,
        x,
        y + h - 0.65,
      ]).fill(tint);
      g.poly([a, y + 0.4, b - 0.5, y, b - 1.1, y + 0.68, x + 0.7, y + 1.15]).fill(mix(tint, 0xc7be8e, 0.38));
      g.poly([
        b - 0.4,
        y + 0.9,
        b - tilt,
        y + h - 0.5,
        b - 0.6,
        y + h,
        x + 0.46,
        y + h - tilt,
        x + 1.3,
        y + h - 0.75,
      ]).fill(mix(tint, MORTAR, 0.25));
      if (i % 3 !== 0) {
        const cx = x + 2.8 + hash01(i + 173) * 5;
        const cy = y + 2.2 + hash01(i + 766) * 1.4;
        g.moveTo(cx, cy)
          .lineTo(cx + 1.4, cy + 0.5)
          .lineTo(cx + 2.3, cy - 0.1)
          .stroke({ width: 0.15, color: MORTAR, alpha: 0.7 });
      }
    }
  }
}

function mainFloor(): Container {
  const rock = new Container({ label: 'temple-floor' });
  const hull = flipY(stage.solids[0]!.points);
  const face = new Graphics();
  const mask = new Graphics().poly(hull).fill(0xffffff);
  rock.addChild(face, mask);
  face.mask = mask;
  face.rect(-85, 0, 170, 28).fill(
    vGradient([
      [0, 0x535132],
      [1, 0x363623],
    ]),
  );
  stonework(face);
  for (const [i, edge] of compileStage(stage).edges.entries()) {
    if (edge.kind !== 'floor') continue;
    const { a, b } = edge;
    face
      .moveTo(a.x, -a.y + 0.56)
      .lineTo(b.x, -b.y + 0.56)
      .stroke({ width: 0.75, color: 0xc1b78a, join: 'round' });
    if (Math.abs(a.x - b.x) < 30) continue;
    for (let k = 0; k < 5; k++) {
      const t = (k + 0.15 + hash01(i * 83 + k) * 0.68) / 5;
      ivy(face, a.x + t * (b.x - a.x), -a.y + 0.3, 1.9 + hash01(i * 251 + k) * 1.25, i * 11 + k);
    }
  }
  for (let i = 0; i < 13; i++) {
    const x = -80 + i * 13 + 3 * hash01(i + 472);
    const y = 7 + hash01(i + 119) * 17;
    ivy(face, x, y, 1.4 + hash01(i + 6376) * 0.9, i);
  }
  rock.addChild(new Graphics().poly(hull).stroke({ width: 0.55, color: INK, join: 'round' }));
  return rock;
}

function lever(g: Graphics, x: number, y: number): void {
  g.poly([x - 3, y, x + 3, y, x + 2.3, y + 1.6, x - 2.4, y + 1.6])
    .fill(0xbba24c)
    .stroke({ color: INK, width: 0.36 });
  g.moveTo(x - 0.5, y + 0.25)
    .lineTo(x + 1.5, y - 3.35)
    .stroke({ width: 1.1, color: INK, cap: 'round' });
  g.moveTo(x - 0.5, y + 0.25)
    .lineTo(x + 1.5, y - 3.35)
    .stroke({ width: 0.62, color: 0xddba4f, cap: 'round' });
  g.circle(x + 1.5, y - 3.35, 0.93)
    .fill(0xd2b54a)
    .stroke({ width: 0.3, color: INK });
  g.circle(x + 1.34, y - 3.51, 0.39).fill(0xf1da85);
}

function slabs(): Graphics {
  const g = new Graphics();
  for (const [i, { x1, x2, y }] of stage.platforms.entries()) {
    const t = -y;
    const cx = (x1 + x2) / 2;
    const slab = [x1, t, x2, t, x2 - 0.7, t + 1.5, x2 - 2, t + 2.3, x1 + 2.3, t + 2.3, x1, t + 1.3];
    g.poly(slab).fill(
      vGradient([
        [0, 0xa6a071],
        [1, 0x736f46],
      ]),
    );
    for (let j = 1; j < 5; j++) {
      const x = x1 + ((x2 - x1) * j) / 5;
      g.moveTo(x, t + 0.5)
        .lineTo(x - 0.22, t + 2.1)
        .stroke({ width: 0.24, color: MORTAR, alpha: 0.9 });
    }
    g.moveTo(x1 + 0.4, t + 0.51)
      .lineTo(x2 - 0.6, t + 0.51)
      .stroke({ width: 0.38, color: 0xbfb68a });
    g.poly(slab).stroke({ width: 0.46, color: INK, join: 'round' });
    ivy(g, x1 + 5.2, t + 1.2, 1.4, i * 113);
    ivy(g, x2 - 4.2, t + 1.45, 1.8, i * 61);
    if (i === 0) lever(g, x1 + 10, t + 0.35);
    const gem = [0xab3425, 0x577f45, 0x318ba2][i]!;
    g.poly([cx - 3.6, t + 2.3, cx + 3.6, t + 2.3, cx + 2.1, t + 4.3, cx - 2.1, t + 4.3])
      .fill(0x77734f)
      .stroke({ width: 0.36, color: INK, join: 'round' });
    diamond(g, cx, t + 3.35, 1.05, gem, mix(gem, INK, 0.4), INK, 0.24);
  }
  return g;
}

export function createPlayfield(): Container {
  const world = new Container({ label: 'forest-temple-world' });
  world.addChild(mainFloor(), slabs());
  return world;
}
