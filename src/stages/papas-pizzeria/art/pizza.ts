import { Container, Graphics } from 'pixi.js';
import { hash01 } from '../../battlefield/art/util';

const TAU = Math.PI * 2;
const RADIUS = 226;
const CUT_START = 0.29;
const CUT_END = 1.06;

function rimRadius(a: number): number {
  return RADIUS + 2.9 * Math.sin(5 * a + 0.7) + 1.7 * Math.sin(9 * a - 1) + 1.15 * Math.sin(14 * a);
}

function arc(g: Graphics, start: number, end: number, inset: number, newPath = true): void {
  const segments = Math.ceil((end - start) * 14);
  for (let i = 0; i <= segments; i++) {
    const a = start + ((end - start) * i) / segments;
    const r = rimRadius(a) - inset;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0 && newPath) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
}

function sector(g: Graphics, start: number, end: number, inset: number, tip: number): Graphics {
  const mid = (start + end) / 2;
  g.moveTo(Math.cos(mid) * tip, Math.sin(mid) * tip);
  arc(g, start, end, inset, false);
  return g.closePath();
}

function pepperoni(g: Graphics, x: number, y: number, r: number) {
  g.ellipse(x + 1, y + 2.6, r, r * 0.97).fill(0xa1724b);
  g.ellipse(x, y, r, r * 0.97)
    .fill(0xa26046)
    .stroke({ color: 0x91604a, width: 2.15 });
  g.moveTo(x - 0.8 + r * 0.76 * Math.cos(3.64), y + 0.35 + r * 0.76 * Math.sin(3.64))
    .arc(x - 0.8, y + 0.35, r * 0.76, 3.64, 5.36)
    .stroke({ color: 0xba7855, width: 3, cap: 'round' });
  for (const [dx, dy, size] of [
    [-0.25, -0.2, 0.085],
    [0.26, -0.34, 0.07],
    [0.35, 0.25, 0.09],
    [-0.33, 0.38, 0.07],
    [-0.02, 0.48, 0.05],
  ] as const) {
    g.ellipse(x + r * dx, y + r * dy, size * r, size * r * 0.72).fill(0xc18157);
  }
}

function mushroom(g: Container, x: number, y: number, scale: number, rotation: number) {
  const m = new Graphics();
  m.moveTo(-4, 1)
    .quadraticCurveTo(-12, 3, -12, -1)
    .bezierCurveTo(-12.5, -11, 8, -14, 11, -3)
    .quadraticCurveTo(13.4, 2.3, 4, 1)
    .lineTo(4.8, 6.6)
    .quadraticCurveTo(0.1, 9.3, -4.8, 6.4)
    .closePath()
    .fill(0xb39b76)
    .stroke({ color: 0xa08362, width: 1.55, join: 'round' });
  m.moveTo(-9, -3).quadraticCurveTo(-4, -9, 4, -7).stroke({ color: 0xc6ad83, width: 1.75, cap: 'round' });
  m.moveTo(-11.3, 0.7).quadraticCurveTo(-0.4, 3.2, 10.7, 0.2).stroke({ color: 0xa08362, width: 1.25 });
  m.position.set(x, y);
  m.scale.set(scale);
  m.rotation = rotation;
  g.addChild(m);
}

function pepper(g: Container, x: number, y: number, scale: number, rotation: number) {
  const p = new Graphics();
  p.moveTo(-13, 0)
    .bezierCurveTo(-14, -8, -4, -10, 0, -7)
    .bezierCurveTo(3, -10, 12, -8, 13, -4)
    .quadraticCurveTo(15, 1, 10, 4)
    .quadraticCurveTo(9, 0, 5, -1.1)
    .quadraticCurveTo(2, -2.3, 0, 0)
    .quadraticCurveTo(-7, -6, -13, 0)
    .closePath()
    .fill(0x79804b)
    .stroke({ color: 0x726d45, width: 1.4, join: 'round' });
  p.moveTo(-10, -3.7)
    .quadraticCurveTo(-7, -7, -1, -5.3)
    .stroke({ color: 0x989354, width: 1.3, cap: 'round' });
  p.position.set(x, y);
  p.scale.set(scale);
  p.rotation = rotation;
  g.addChild(p);
}

function drawPizzaPart(start: number, end: number, slice: boolean): Container {
  const g = new Container({ label: slice ? 'pulled-slice' : 'pizza-round' });
  const cheese = 0xcab16f;
  const shadow = new Graphics();
  sector(shadow, start, end, -5, 0).fill({ color: 0x35412e, alpha: 0.36 });
  shadow.position.set(5, 12);
  const top = new Graphics();
  g.addChild(shadow, top);
  sector(top, start, end, 0, 0).fill(0xa8754b).stroke({ color: 0x7a6345, width: 3.1, join: 'round' });
  sector(top, start + 0.025, end - 0.025, 7, 4).fill(0xc49a62);
  sector(top, start + 0.037, end - 0.037, 24, 9).fill(0xa66c4e);
  sector(top, start + 0.053, end - 0.053, 31.5, 11).fill(cheese);
  arc(top, slice ? start + 0.13 : 3.56, slice ? end - 0.11 : 5.46, 12.2);
  top.stroke({ width: 5.2, color: 0xd3ad70, cap: 'round' });
  arc(top, slice ? start + 0.17 : 1.42, slice ? end - 0.12 : 2.38, 6);
  top.stroke({ width: 2.3, color: 0xad774d, cap: 'round' });
  if (!slice) {
    for (const a of [2.22, 3.12, 4.01, 4.92, 5.82]) {
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      top
        .moveTo(dx * 19, dy * 19)
        .quadraticCurveTo(dx * 100 + dy * 4, dy * 100 - dx * 4, dx * 197, dy * 197)
        .stroke({ width: 2, color: 0xba9b64, cap: 'round' });
    }
  }
  for (let i = 0; i < (slice ? 23 : 93); i++) {
    const h = 6 * i;
    const a = start + 0.08 + hash01(h + 2) * (end - start - 0.16);
    const edge = i % 5 === 0;
    const r = edge ? 197 + hash01(h + 1) * 16 : 35 + Math.sqrt(hash01(h + 1)) * 152;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const len = 2 + hash01(h + 3) * 5.6;
    const twist = i * 2.4;
    top
      .moveTo(x, y)
      .quadraticCurveTo(x + len * 0.42, y - 2, x + len * Math.cos(twist), y + len * Math.sin(twist))
      .stroke({
        color: edge ? 0x9d704b : i % 3 === 0 ? 0xd7bd7b : 0xbb9c5f,
        width: edge ? 2.5 : 1.8,
        cap: 'round',
      });
  }
  for (const [x, y, r] of slice
    ? [
        [97, 70, 17],
        [152, 84, 20],
      ]
    : [
        [-47, -150, 20],
        [52, -155, 19],
        [-133, -77, 23],
        [-39, -58, 22],
        [86, -56, 21],
        [156, -20, 19],
        [-162, 26, 20],
        [-82, 51, 23],
        [25, 35, 19],
        [-117, 120, 19],
        [-5, 144, 21],
      ]) {
    pepperoni(top, x!, y!, r!);
  }
  for (const [x, y, r, turn] of slice
    ? [[105, 122, 1.22, -0.42]]
    : [
        [-92, -104, 1.44, -0.34],
        [17, -102, 1.34, 0.4],
        [118, -99, 1.25, 0.32],
        [-124, 74, 1.44, 0.39],
        [-44, 108, 1.19, -0.65],
        [15, 86, 1.43, 0.49],
      ]) {
    mushroom(g, x!, y!, r!, turn!);
  }
  for (const [x, y, r, turn] of slice
    ? [[130, 106, 0.9, 0.6]]
    : [
        [-13, -169, 1.1, -0.22],
        [-166, -39, 1.12, -0.9],
        [133, -52, 1.2, 1.46],
        [-77, -11, 1.24, 0.9],
        [73, -10, 1.3, -0.75],
        [-33, 58, 1.16, 0.63],
        [-76, 150, 1.12, 0.26],
      ]) {
    pepper(g, x!, y!, r!, turn!);
  }
  for (const [x, y] of slice
    ? [[84, 91]]
    : [
        [-91, -141],
        [85, -131],
        [-153, -8],
        [25, -48],
        [-102, 13],
        [121, 25],
        [-139, 84],
        [-41, 160],
        [47, 133],
      ]) {
    top.ellipse(x!, y!, 6.2, 5.3).fill(0x7f754d);
    top.ellipse(x! - 0.25, y! - 0.4, 2.7, 2.1).fill(cheese);
  }
  return g;
}

export function createPizza(): Container {
  const pizza = new Container({ label: 'giant-pizza' });
  pizza.position.set(628, 247);
  const whole = drawPizzaPart(CUT_END, CUT_START + TAU, false);
  const slice = drawPizzaPart(CUT_START, CUT_END, true);
  slice.position.set(19, 13);
  slice.alpha = 0.73;
  pizza.addChild(whole, slice);
  return pizza;
}
