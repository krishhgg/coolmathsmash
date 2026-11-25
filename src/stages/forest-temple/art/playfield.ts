import { Container, Graphics } from 'pixi.js';
import { compileStage } from '../../../sim/stage';
import { diamond, flipY, hash01, mix, vGradient } from '../../battlefield/art/util';
import { stage, TEMPLE_HULL } from '../geometry';
import { INK, IVY, MORTAR, STONES } from './palette';

function ivy(g: Graphics, x: number, y: number, size: number, seed: number): void {
  const count = 4 + Math.floor(hash01(seed + 504) * 5);
  const lean = hash01(seed + 123) - 0.5;
  g.ellipse(x, y + size * 0.36, size * 1.85, size * 0.77).fill({ color: 0x203c21, alpha: 0.68 });
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const k = seed * 415 + i * 107;
    const s = size * (0.55 + hash01(k) * 0.64);
    const sx = x + (t - 0.5) * size * 2.25;
    const sy = y + hash01(k + 436) * size * 0.55;
    const dx = (t - 0.5 + lean) * size * 2.5;
    const dy = s * (0.22 + hash01(k + 987) * 1.5);
    g.moveTo(sx - s * 0.28, sy - 0.36)
      .quadraticCurveTo(sx + dx * 0.63 + s * 0.57, sy - s * 0.58, sx + dx, sy + dy)
      .lineTo(sx + dx * 0.84 - s * 0.27, sy + dy * 0.86)
      .quadraticCurveTo(sx + dx * 0.29 - s * 0.85, sy + dy * 0.42, sx - s * 0.28, sy - 0.36)
      .closePath()
      .fill(IVY[(i + seed) % IVY.length])
      .stroke({ width: 0.23, color: INK, alpha: 0.78 });
    g.moveTo(sx, sy + 0.1)
      .lineTo(sx + dx * 0.71, sy + dy * 0.7)
      .stroke({ width: 0.13, color: 0x81ac54, alpha: 0.6 });
  }
}

function ivyPatch(g: Graphics, x: number, y: number, side: number, seed: number): void {
  const px = (dx: number) => x + dx * side;
  for (const [width, color] of [
    [0.98, 0x202f18],
    [0.45, 0x536330],
  ] as const) {
    g.moveTo(x, y)
      .bezierCurveTo(px(1), y + 5, px(12), y - 2, px(11), y + 5.3)
      .quadraticCurveTo(px(9.5), y + 10.4, px(16.1), y + 12)
      .stroke({ width, color, cap: 'round' });
  }
  const leaves = [
    [0, 0, 3.1],
    [3, 2.05, 2.2],
    [6, 1.7, 1.4],
    [11.2, 4.8, 1.75],
    [10.8, 7.6, 1.32],
    [13, 10.8, 1],
  ] as const;
  for (const [i, [dx, dy, s]] of leaves.entries()) ivy(g, px(dx), y + dy, s, seed + i * 326);
}

function stonework(g: Graphics): void {
  const stepX = 12;
  const stepY = 6.2;
  let i = 0;
  for (let y = -2; y < 30; y += stepY) {
    const row = Math.round((y + 2) / stepY);
    for (let x = -94 - (row % 2) * (stepX / 2); x < 90; x += stepX) {
      const tint = mix(STONES[i % STONES.length]!, MORTAR, 0.34 * Math.max(0, y / 28));
      const w = stepX - 0.55;
      const h = stepY - 0.5;
      const tilt = hash01(i++ + 9271) * 1.1;
      const a = x + 0.4 + tilt;
      const b = x + w;
      g.poly([
        a,
        y + 0.4,
        b - 0.5,
        y,
        b,
        y + 0.59 + tilt,
        b - tilt,
        y + h - 0.5,
        b - 0.5 - tilt,
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
        const z = hash01(i + 1121) - 0.5;
        g.moveTo(cx, cy)
          .lineTo(cx + 0.74, cy + 1.1 * z)
          .lineTo(cx + 1.6 + z, cy + 0.5)
          .lineTo(cx + 2.42, cy + z)
          .stroke({ width: 0.16, color: MORTAR, alpha: 0.8 });
        g.ellipse(cx - 1.3, cy + 0.7, 1.1 + z, 0.4).fill({ color: 0x596030, alpha: 0.3 });
      }
    }
  }
}

function mainFloor(): Container {
  const rock = new Container({ label: 'temple-floor' });
  const hull = flipY(TEMPLE_HULL.points);
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
    if (edge.kind !== 'floor' || stage.solids[edge.solid] !== TEMPLE_HULL) continue;
    const { a, b } = edge;
    face
      .moveTo(a.x, -a.y + 0.56)
      .lineTo(b.x, -b.y + 0.56)
      .stroke({ width: 0.75, color: 0xc1b78a, join: 'round' });
    if (Math.abs(a.x - b.x) < 30) continue;
    const left = a.x + b.x < 0;
    ivyPatch(face, left ? -63 : 63, -a.y + 1.15, left ? 1 : -1, i * 548);
    const t = 0.57 + hash01(i * 87) * 0.34;
    ivy(face, a.x + t * (b.x - a.x), -a.y + 1.15, 2.75, i * 11);
  }
  ivyPatch(face, -32, 15.4, 1, 772);
  ivyPatch(face, 37, 13.8, -1, 654);
  rock.addChild(new Graphics().poly(hull).stroke({ width: 0.55, color: INK, join: 'round' }));
  return rock;
}

function lever(g: Graphics, x: number, y: number): void {
  g.poly([x - 3.8, y, x + 3.7, y, x + 2.8, y + 1.6, x - 2.95, y + 1.6])
    .fill(0xcbae46)
    .stroke({ color: INK, width: 0.36 });
  g.poly([x - 2.7, y + 0.26, x + 2.68, y + 0.26, x + 1.97, y + 0.92, x - 2.2, y + 0.92]).fill(0xe7cd64);
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
