import { Container, Graphics } from 'pixi.js';
import { wrap } from '../../battlefield/art/parallax';
import { hash01, mix } from '../../battlefield/art/util';

const OVEN_X = 182;
const ARCH_Y = 425;
export const COUNTER_Y = 594;
const HEARTH_Y = COUNTER_Y - 2;

function arch(g: Graphics, radius: number, foot = HEARTH_Y): Graphics {
  return g
    .moveTo(OVEN_X - radius, foot)
    .lineTo(OVEN_X - radius, ARCH_Y)
    .arc(OVEN_X, ARCH_Y, radius, Math.PI, Math.PI * 2)
    .lineTo(OVEN_X + radius, foot)
    .closePath();
}

function drawOven(g: Graphics) {
  arch(g, 147).fill({ color: 0x414e36, alpha: 0.25 });
  g.roundRect(125, 241, 114, 46, 15).fill(0x817454).stroke({ color: 0x606247, width: 3 });
  g.circle(182, 261, 17).fill(0xab956d).stroke({ color: 0x6e624a, width: 2.7 });
  for (const a of [3.15, 3.8, 4.4, 5.07, 5.71, 6.28]) {
    g.moveTo(182 + Math.cos(a) * 10, 263 + Math.sin(a) * 10)
      .lineTo(182 + Math.cos(a) * 13, 263 + Math.sin(a) * 13)
      .stroke({ color: 0x78654d, width: 1.8 });
  }
  g.moveTo(182, 263).lineTo(189, 255).stroke({ color: 0x90644c, width: 2.4, cap: 'round' });
  g.circle(182, 263, 2.3).fill(0x80634a);
  arch(g, 140).fill(0x866b4f).stroke({ color: 0x5b5d43, width: 4 });
  arch(g, 132).fill(0x7d674d);
  for (let i = 0; i < 10; i++) {
    const start = Math.PI + 0.023 + (i * Math.PI) / 10;
    const end = start + Math.PI / 10 - 0.046;
    const ri = 101;
    const ro = 129;
    g.moveTo(OVEN_X + ro * Math.cos(start), ARCH_Y + ro * Math.sin(start))
      .arc(OVEN_X, ARCH_Y, ro, start, end)
      .lineTo(OVEN_X + ri * Math.cos(end), ARCH_Y + ri * Math.sin(end))
      .arc(OVEN_X, ARCH_Y, ri, end, start, true)
      .closePath()
      .fill(mix(0x986d50, 0xb08560, hash01(i + 602)));
    g.moveTo(OVEN_X + (ro - 4) * Math.cos(start + 0.02), ARCH_Y + (ro - 4) * Math.sin(start + 0.02))
      .arc(OVEN_X, ARCH_Y, ro - 4, start + 0.02, end - 0.02)
      .stroke({ width: 2.6, color: 0xb38a63, cap: 'round' });
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? OVEN_X - 129 : OVEN_X + 101;
    for (let row = 0; row < 5; row++) {
      const y = ARCH_Y + row * 33.5 + 1.5;
      g.roundRect(x, y, 28, 29.5, 3.1).fill(mix(0x976f54, 0xb28862, hash01(row * 7 + side + 80)));
      g.moveTo(x + 4, y + 4)
        .lineTo(x + 20, y + 4)
        .stroke({ width: 2, color: 0xb38a63, cap: 'round' });
    }
  }
  arch(g, 97).fill(0x665143);
  arch(g, 85).fill(0x584b3e);
  g.moveTo(OVEN_X - 83, HEARTH_Y - 37)
    .bezierCurveTo(OVEN_X - 65, HEARTH_Y - 58, OVEN_X + 27, HEARTH_Y - 77, OVEN_X + 83, HEARTH_Y - 33)
    .lineTo(OVEN_X + 83, HEARTH_Y)
    .lineTo(OVEN_X - 83, HEARTH_Y)
    .closePath()
    .fill(0x75543f);
  g.moveTo(OVEN_X - 79, HEARTH_Y - 15)
    .quadraticCurveTo(OVEN_X - 2, HEARTH_Y - 42, OVEN_X + 82, HEARTH_Y - 16)
    .lineTo(OVEN_X + 82, HEARTH_Y)
    .lineTo(OVEN_X - 79, HEARTH_Y)
    .closePath()
    .fill(0x8c6247);
  g.roundRect(35, HEARTH_Y - 2, 294, 16, 5).fill(0x79654e);
  g.roundRect(40, HEARTH_Y - 3, 284, 6, 3).fill(0xa88b66);
}

function drawHangingTools(g: Graphics) {
  for (const x of [979, 1103]) {
    g.circle(x, 158, 13).fill(0x77815a).stroke({ color: 0x68724e, width: 2.2 });
    g.moveTo(x, 158)
      .quadraticCurveTo(x + 5, 166, x + 2, 174)
      .quadraticCurveTo(x - 1, 178, x - 4, 171)
      .stroke({ width: 3.5, color: 0x5a5745, cap: 'round' });
  }
  g.moveTo(971, 180)
    .quadraticCurveTo(972, 170, 980, 169)
    .quadraticCurveTo(989, 170, 988, 181)
    .lineTo(987, 227)
    .quadraticCurveTo(987, 241, 1002, 248)
    .bezierCurveTo(1028, 257, 1048, 277, 1044, 312)
    .bezierCurveTo(1039, 356, 925, 359, 918, 313)
    .bezierCurveTo(914, 279, 937, 257, 955, 250)
    .quadraticCurveTo(973, 246, 972, 227)
    .closePath()
    .fill(0xa18b60)
    .stroke({ color: 0x656247, width: 4, join: 'round' });
  g.moveTo(929, 313)
    .bezierCurveTo(925, 288, 943, 270, 960, 263)
    .quadraticCurveTo(975, 256, 977, 241)
    .stroke({ width: 4, color: 0xb19a69, cap: 'round' });
  for (const [x, y, dy] of [
    [945, 292, 38],
    [970, 276, 61],
    [994, 268, 61],
    [1015, 286, 32],
  ] as const) {
    g.moveTo(x, y)
      .quadraticCurveTo(x - dy * 0.12, y + dy * 0.6, x + 2, y + dy)
      .stroke({ width: 2, color: 0x937c53, cap: 'round' });
  }
  g.circle(980, 180, 3.1).fill(0x676044);

  const cutter = new Graphics();
  cutter.moveTo(0, 10).lineTo(0, 98).stroke({ color: 0x62604d, width: 7.5, cap: 'round' });
  cutter.roundRect(-8, 3, 16, 60, 7).fill(0x776655).stroke({ color: 0x5a5c49, width: 3.2 });
  cutter.circle(0, 13, 2.9).fill(0x565a47);
  cutter.roundRect(-16, 60, 32, 8, 3).fill(0x938f76).stroke({ color: 0x5a5c49, width: 2.5 });
  cutter.circle(0, 104, 29).fill(0xa4a184).stroke({ color: 0x5f6451, width: 3.2 });
  cutter
    .moveTo(23.5 * Math.cos(3.36), 104 + 23.5 * Math.sin(3.36))
    .arc(0, 104, 23.5, 3.36, 5.36)
    .stroke({ color: 0xb8b295, width: 3.3, cap: 'round' });
  cutter.circle(0, 104, 6.4).fill(0x767762).stroke({ color: 0x5f6451, width: 2 });
  cutter.position.set(1101, 164);
  cutter.rotation = -0.16;
  return cutter;
}

export function createFixtures() {
  const container = new Container({ label: 'oven-and-hanging-tools' });
  const fixtures = new Graphics();
  drawOven(fixtures);
  const cutter = drawHangingTools(fixtures);
  const embers = new Graphics();
  for (const [x, y, r] of [
    [142, HEARTH_Y - 21, 13],
    [164, HEARTH_Y - 16, 17],
    [194, HEARTH_Y - 18, 22],
    [221, HEARTH_Y - 17, 11],
  ] as const) {
    embers.ellipse(x, y, r, 4).fill(0x9f704c);
    embers
      .moveTo(x - r * 0.68, y)
      .lineTo(x + r * 0.61, y - 0.75)
      .stroke({
        width: 2.6,
        color: 0xc09059,
        cap: 'round',
      });
  }
  const steam = Array.from({ length: 2 }, () => {
    const curl = new Graphics();
    curl
      .moveTo(0, 34)
      .bezierCurveTo(-24, 27, 16, 18, 2, 6)
      .quadraticCurveTo(-3, 2, 0, -4)
      .stroke({ width: 6.5, color: 0xd3aa77, cap: 'round' });
    return curl;
  });
  container.addChild(fixtures, cutter, embers, ...steam);
  return {
    container,
    update(frame: number) {
      embers.alpha = 0.64 + 0.21 * Math.sin(frame * 0.051) + 0.08 * Math.sin(frame * 0.127 + 0.7);
      steam.forEach((curl, i) => {
        const phase = wrap(frame + i * 64, 0, 142) / 142;
        curl.position.set(160 + i * 45 + Math.sin(frame * 0.042 + i) * 11, HEARTH_Y - 66 - phase * 104);
        curl.scale.set(0.63 + phase * 0.55);
        curl.alpha = Math.sin(phase * Math.PI) ** 2 * 0.25;
      });
    },
  };
}

function drawBowl(g: Graphics, x: number, y: number, w: number, ingredient: number, seed: number) {
  g.ellipse(x + 9, y + 24, w + 6, w * 0.47).fill({ color: 0x604e3a, alpha: 0.22 });
  g.moveTo(x - w, y)
    .bezierCurveTo(x - w + 3, y + 53, x + w - 3, y + 53, x + w, y)
    .closePath()
    .fill(0x817b68)
    .stroke({ width: 3, color: 0x6a6150 });
  g.ellipse(x, y, w, w * 0.43)
    .fill(0xb2a187)
    .stroke({ width: 3, color: 0x706553 });
  g.ellipse(x, y - 0.5, w - 6, w * 0.34).fill(0x6e6552);
  g.ellipse(x, y + 0.55, w - 10, w * 0.26).fill(ingredient);
  for (let i = 0; i < 17; i++) {
    const a = i * 2.4;
    const size = Math.sqrt(hash01(seed + i * 3));
    const px = x + Math.cos(a) * size * (w - 14);
    const py = y + Math.sin(a) * size * w * 0.19;
    g.ellipse(px, py, 2.6 + hash01(seed + i) * 3, 1.5 + hash01(seed + i * 2) * 1.6).fill(
      mix(ingredient, i % 3 === 0 ? 0xd7b78a : 0x664f3d, 0.22),
    );
  }
}

export function createIngredients(): Graphics {
  const g = new Graphics({ label: 'prep-counter-ingredients' });
  g.y = 19;
  drawBowl(g, 1128, 580, 49, 0x958665, 26);
  drawBowl(g, 1203, 611, 57, 0x817d4e, 69);
  drawBowl(g, 1073, 632, 63, 0xa46e50, 92);

  g.ellipse(173, 655, 129, 26).fill({ color: 0x6b513e, alpha: 0.23 });
  g.ellipse(172, 640, 124, 26).fill(0x967452).stroke({ color: 0x7b6047, width: 4 });
  g.ellipse(168, 632, 124, 25).fill(0xac895e).stroke({ color: 0x7b6047, width: 3.5 });
  g.ellipse(168, 632, 111, 19).stroke({ color: 0xb7996b, width: 2.5 });
  g.moveTo(80, 623)
    .bezierCurveTo(76, 608, 73, 566, 92, 562)
    .quadraticCurveTo(106, 554, 117, 565)
    .quadraticCurveTo(137, 550, 151, 572)
    .bezierCurveTo(164, 592, 155, 618, 147, 628)
    .quadraticCurveTo(118, 635, 80, 623)
    .closePath()
    .fill(0x77844a)
    .stroke({ color: 0x626841, width: 3.8 });
  g.moveTo(116, 567)
    .quadraticCurveTo(115, 545, 102, 542)
    .lineTo(109, 537)
    .quadraticCurveTo(126, 542, 128, 565)
    .closePath()
    .fill(0x828452)
    .stroke({ color: 0x626841, width: 3 });
  g.moveTo(95, 615)
    .bezierCurveTo(89, 590, 94, 571, 108, 572)
    .quadraticCurveTo(117, 573, 124, 569)
    .quadraticCurveTo(137, 581, 131, 602)
    .lineTo(128, 624)
    .quadraticCurveTo(112, 628, 95, 615)
    .closePath()
    .fill(0x8b9554);
  g.moveTo(134, 621).quadraticCurveTo(148, 588, 135, 574).stroke({ color: 0x697645, width: 3, cap: 'round' });
  g.moveTo(158, 628)
    .lineTo(168, 608)
    .lineTo(231, 587)
    .quadraticCurveTo(245, 593, 253, 607)
    .lineTo(251, 631)
    .quadraticCurveTo(219, 644, 160, 639)
    .closePath()
    .fill(0xb18c50)
    .stroke({ color: 0x856e48, width: 3.7, join: 'round' });
  g.moveTo(161, 626)
    .lineTo(231, 590)
    .quadraticCurveTo(244, 594, 250, 608)
    .quadraticCurveTo(213, 629, 161, 626)
    .closePath()
    .fill(0xc4a363);
  for (const [x, y, w] of [
    [226, 606, 5],
    [205, 613, 6],
    [235, 625, 5],
    [210, 633, 3],
  ] as const) {
    g.ellipse(x, y, w, 2.4).fill(0x9f7e49);
  }
  for (const [x, y, w] of [
    [187, 637, 12],
    [209, 641, 11],
    [271, 629, 11],
  ] as const) {
    g.ellipse(x, y, w, 4.9).fill(0xa76b51).stroke({ color: 0x855740, width: 2 });
    g.ellipse(x - 1, y - 1.5, w * 0.62, 1.35).fill(0xc37c56);
  }
  return g;
}
