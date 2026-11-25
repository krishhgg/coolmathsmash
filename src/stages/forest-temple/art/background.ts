import { Container, Graphics } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, type StageCamera } from '../../battlefield/art/parallax';
import { hash01, mix, vGradient } from '../../battlefield/art/util';
import { WALL, WALL_DEPTH } from './palette';

function masonry(): Graphics {
  const g = new Graphics();
  const { left, top, right, bottom } = WALL;
  const mortar = 0x303016;
  g.rect(left, top, right - left, bottom - top).fill(mortar);
  let n = 0;
  for (let y = top, row = 0; y < bottom; row++) {
    const height = 24 + Math.floor(hash01(row + 594) * 13);
    const rowOffset = Math.floor(hash01(row + 20) * 70);
    for (let x = left - rowOffset; x < right;) {
      const s = n++;
      const patch = Math.sin((x + y) * 0.012) * Math.cos(y * 0.016);
      const tint = mix(0x313319, 0x444323, 0.43 + 0.31 * patch + 0.17 * hash01(s));
      const tilt = hash01(s + 941) * 4;
      const w = 37 + Math.floor(hash01(s + 1889) * 54);
      g.moveTo(x, y + tilt + 5)
        .quadraticCurveTo(x + 1, y + tilt, x + 5, y + tilt)
        .lineTo(x + w - 7, y + 1)
        .quadraticCurveTo(x + w, y + 2, x + w, y + 6)
        .lineTo(x + w - 2, y + height - 8)
        .quadraticCurveTo(x + w - 2, y + height - 3, x + w - 8, y + height - 2)
        .lineTo(x + 5, y + height - 2 - tilt)
        .quadraticCurveTo(x + 1, y + height - 3 - tilt, x + 1, y + height - 7 - tilt)
        .closePath()
        .fill(tint);
      x += w + 2;
    }
    y += height;
  }
  const shade = vGradient([
    [0, 'rgba(15,16,9,0.5)'],
    [0.34, 'rgba(23,25,10,0.1)'],
    [0.51, 'rgba(29,27,9,0)'],
    [1, 'rgba(16,19,9,0.65)'],
  ]);
  g.rect(left, top, right - left, bottom - top).fill(shade);
  return g;
}

function exitDoors(): Graphics {
  const g = new Graphics();
  const left = 772;
  const top = 154;
  g.poly([
    left - 39,
    top + 135,
    left - 30,
    top - 16,
    left + 21,
    top - 46,
    left + 139,
    top - 37,
    left + 197,
    top - 8,
    left + 198,
    top + 145,
    left + 151,
    top + 163,
    left - 3,
    top + 149,
  ]).fill({ color: 0x22250f, alpha: 0.55 });
  g.ellipse(left + 83, top + 116, 102, 44).fill({ color: 0x252611, alpha: 0.48 });
  g.poly([
    left - 17,
    top + 90,
    left + 18,
    top + 97,
    left + 140,
    top + 96,
    left + 183,
    top + 91,
    left + 171,
    top + 111,
    left + 101,
    top + 124,
    left + 26,
    top + 119,
    left - 23,
    top + 105,
  ]).fill(0x3c3f23);
  for (const [index, emblem] of [0xb44c39, 0x378799].entries()) {
    const x = left + index * 92;
    const center = x + 37;
    const y = top + 51;
    g.poly([
      x - 8,
      top + 102,
      x - 10,
      top + 13,
      x - 6,
      top - 5,
      x + 12,
      top - 9,
      x + 77,
      top - 7,
      x + 82,
      top + 3,
      x + 82,
      top + 47,
      x + 86,
      top + 101,
    ]).fill(0x242614);
    g.poly([
      x + 3,
      top + 97,
      x + 1,
      top + 68,
      x - 2,
      top + 5,
      x + 8,
      top + 1,
      x + 72,
      top + 3,
      x + 75,
      top + 60,
      x + 77,
      top + 95,
      x + 59,
      top + 100,
    ]).fill(0x716c43);
    g.poly([x + 11, top + 97, x + 10, top + 15, x + 64, top + 12, x + 66, top + 99])
      .fill(0x514d30)
      .stroke({ width: 3, color: 0x35331e, join: 'round' });
    g.circle(center, y, 19).fill({ color: emblem, alpha: 0.15 });
    g.circle(center, y, 13).fill({ color: emblem, alpha: 0.16 });
    g.circle(center - 2, y, 7).stroke({ width: 4, color: emblem });
    if (index === 0) {
      g.moveTo(center + 3, y - 6)
        .lineTo(center + 12, y - 15)
        .lineTo(center + 4, y - 15)
        .moveTo(center + 12, y - 15)
        .lineTo(center + 12, y - 8);
    } else {
      g.moveTo(center - 2, y + 8)
        .lineTo(center - 2, y + 21)
        .moveTo(center - 8, y + 15)
        .lineTo(center + 4, y + 15);
    }
    g.stroke({ width: 3.5, color: emblem, cap: 'round', join: 'round' });
    for (let n = 0; n < 8; n++) {
      const u = n % 2 === 0 ? x + 5 : x + 71;
      const v = top + (n % 3 === 0 ? 7 : 91) + hash01(n + index * 31) * 8;
      g.ellipse(u + hash01(n + 62) * 12 - 5, v, 4.5, 3.4).fill(mix(0x294322, 0x415329, hash01(n + 773)));
    }
  }
  return g;
}

function vines(): Graphics {
  const g = new Graphics();
  for (const [index, x] of [-66, 106, 1108, 1376].entries()) {
    const side = index < 2 ? 1 : -1;
    const length = [360, 234, 286, 480][index]!;
    const stem = (y: number) => x + side * (20 * Math.sin(y * 0.014 + index) + 0.08 * y);
    g.moveTo(stem(-360), -360);
    for (let y = -340; y <= length; y += 12) g.lineTo(stem(y), y);
    g.stroke({ color: 0x303b20, width: 3.5, alpha: 0.85, join: 'round' });
    for (let y = -333; y < length; y += 15) {
      const seed = index * 907 + y;
      const k = hash01(seed) > 0.5 ? 1 : -1;
      const size = 4 + hash01(seed + 2971) * 9;
      const sx = stem(y);
      const tip = sx + size * 1.7 * k;
      g.moveTo(sx, y)
        .quadraticCurveTo(sx + k * size * 0.6, y - size, tip, y - size * 0.4)
        .quadraticCurveTo(tip - k * size * 0.7, y + size, sx, y)
        .closePath()
        .fill(mix(0x303b20, 0x474b29, hash01(seed + 5997)));
    }
  }
  return g;
}

export function createBackground() {
  const container = new Container({ label: 'forest-temple-back' });
  const sky = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(0x30311b);
  const layers = [
    { depth: WALL_DEPTH, art: masonry() },
    { depth: 0.19, art: exitDoors() },
    { depth: 0.33, art: vines() },
  ].map(({ depth, art }) => {
    const layer = new Container({ pivot: { x: VIEW_W / 2, y: VIEW_H / 2 } });
    layer.addChild(art);
    return { depth, layer };
  });
  container.addChild(sky, ...layers.map(({ layer }) => layer));
  return {
    container,
    update(camera: StageCamera) {
      for (const { depth, layer } of layers) {
        const { x, y, scale } = layerTransform(depth, camera);
        layer.position.set(x, y);
        layer.scale.set(scale);
      }
    },
  };
}
