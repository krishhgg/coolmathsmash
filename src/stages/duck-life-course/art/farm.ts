import { Container, Graphics, Text } from 'pixi.js';

function windowArch(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.moveTo(x, y)
    .lineTo(x, y - h + w / 2)
    .quadraticCurveTo(x + w / 2, y - h - w / 2, x + w, y - h + w / 2)
    .lineTo(x + w, y)
    .closePath()
    .fill(color);
}

function windmill(): Container {
  const root = new Container({ label: 'windmill', x: 164, y: 490 });
  const g = new Graphics();
  g.ellipse(5, 4, 95, 13).fill(0x92b66d);
  g.moveTo(-68, 0)
    .quadraticCurveTo(-45, -65, -37, -158)
    .lineTo(41, -158)
    .quadraticCurveTo(45, -77, 68, -2)
    .quadraticCurveTo(8, 15, -68, 0)
    .closePath()
    .fill(0xe3c07d);
  g.moveTo(16, -157)
    .lineTo(41, -158)
    .quadraticCurveTo(45, -77, 68, -2)
    .quadraticCurveTo(42, 7, 29, 7)
    .quadraticCurveTo(22, -49, 16, -157)
    .closePath()
    .fill(0xcba76e);
  g.moveTo(-64, -146)
    .quadraticCurveTo(-51, -159, -40, -181)
    .quadraticCurveTo(-33, -202, -5, -204)
    .quadraticCurveTo(23, -204, 36, -185)
    .quadraticCurveTo(49, -164, 57, -150)
    .quadraticCurveTo(-4, -134, -64, -146)
    .closePath()
    .fill(0xe7b221);
  g.moveTo(-62, -147)
    .quadraticCurveTo(-49, -158, -41, -181)
    .quadraticCurveTo(-32, -203, -5, -204)
    .quadraticCurveTo(7, -204, 13, -201)
    .quadraticCurveTo(-17, -195, -21, -178)
    .quadraticCurveTo(-28, -155, -42, -145)
    .closePath()
    .fill(0xf6d359);
  g.moveTo(-62, -146).quadraticCurveTo(-2, -134, 57, -150).stroke({ width: 4, color: 0xb28848 });
  windowArch(g, -29, -86, 16, 25, 0xa47f5f);
  windowArch(g, 12, -86, 16, 25, 0xa47f5f);
  windowArch(g, -20, 5.5, 37, 59, 0xa88664);
  windowArch(g, -15, 5.5, 28, 51, 0x92755a);
  g.circle(7, -13, 2.3).fill(0xe2bc79);

  const sails = new Container({ x: -3, y: -168, rotation: 0.62 });
  for (let i = 0; i < 4; i++) {
    const blade = new Graphics();
    blade.rotation = (i * Math.PI) / 2;
    blade.poly([2, -38, 19, -49, 25, -136, 1, -140]).fill({ color: 0xf1e1b6, alpha: 0.65 });
    blade.moveTo(0, 4).lineTo(1, -140).lineTo(25, -136).lineTo(19, -49).stroke({
      width: 3.6,
      color: 0x9a795d,
      join: 'round',
    });
    for (let y = -58; y >= -128; y -= 14)
      blade
        .moveTo(1, y)
        .lineTo(19 + (-y - 49) * 0.068, y + 1.5)
        .stroke({
          width: 1.9,
          color: 0xa88a69,
        });
    blade.moveTo(11, -44).lineTo(13, -138).stroke({ width: 1.7, color: 0xae8e68 });
    sails.addChild(blade);
  }
  g.moveTo(-66, -10).quadraticCurveTo(1, 2, 65, -13).stroke({ width: 3.8, color: 0xb59564 });
  const axle = new Graphics()
    .circle(-3, -168, 10)
    .fill(0xc09a69)
    .stroke({ color: 0x976f56, width: 2.8 })
    .circle(-3, -168, 4.1)
    .fill(0x966e58);
  const race = new Graphics({ label: 'windmill-race-sign', x: 78, y: -68, rotation: -0.14 });
  race.moveTo(-38, -5).lineTo(-13, -4).stroke({ width: 4.2, color: 0x96794b });
  race
    .moveTo(-16, -6)
    .quadraticCurveTo(-15, -22, 4, -21)
    .quadraticCurveTo(23, -20, 23, -2)
    .quadraticCurveTo(22, 17, 4, 19)
    .quadraticCurveTo(-11, 20, -16, 8)
    .lineTo(-24, 1)
    .closePath()
    .fill(0xf6da69)
    .stroke({ width: 2.4, color: 0xa48448, join: 'round' });
  race.moveTo(-6, 12).lineTo(-1, -11).stroke({ width: 2.2, color: 0x775f45 });
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++) {
      const x = -1 + 5.6 * col - 1.3 * row;
      const y = -11 + 5.6 * row + col * 1.1;
      race
        .poly([x, y, x + 5.6, y + 1.1, x + 4.3, y + 6.7, x - 1.3, y + 5.6])
        .fill((row + col) % 2 === 0 ? 0x775f45 : 0xffefb1);
    }
  root.addChild(g, sails, axle, race);
  return root;
}

function barn(): Container {
  const root = new Container({ label: 'barn-shop', x: 1143, y: 557 });
  root.scale.set(0.88);
  const g = new Graphics();
  g.ellipse(21, 5, 157, 17).fill(0x90b56a);
  g.poly([-113, -104, 75, -101, 75, 7, -112, 8]).fill(0xc84436);
  g.poly([75, -101, 158, -120, 154, -16, 75, 7]).fill(0xa63831);
  g.poly([-120, -102, -68, -163, 4, -187, 83, -103, 75, -98, -111, -98]).fill(0xd54d3b);
  for (let x = -102; x < 74; x += 21) g.moveTo(x, -100).lineTo(x, 5).stroke({ width: 1.8, color: 0xb84336 });
  for (let x = 90; x < 155; x += 19)
    g.moveTo(x, -105)
      .lineTo(x, 7 - (x - 75) * 0.29)
      .stroke({ width: 1.7, color: 0x91332e });
  g.poly([3, -187, 94, -200, 134, -166, 167, -116, 83, -97, 51, -145]).fill(0x826d59);
  g.poly([51, -145, 134, -166, 167, -116, 83, -97]).fill(0x695c55);
  g.moveTo(-123, -100)
    .lineTo(-68, -163)
    .lineTo(4, -187)
    .lineTo(52, -144)
    .lineTo(83, -101)
    .stroke({ width: 6.9, color: 0xfff3da, join: 'round' });
  g.moveTo(83, -101).lineTo(167, -119).stroke({ width: 4.4, color: 0xc4ae91 });
  g.poly([54, -190, 54, -221, 77, -224, 79, -195]).fill(0xc64c3f);
  g.poly([77, -224, 95, -214, 95, -194, 79, -195]).fill(0xa34236);
  g.poly([49, -218, 71, -243, 101, -217, 78, -226]).fill(0x6d6257);
  g.rect(-66, -77, 99, 84).fill(0x893b32).stroke({ width: 5.6, color: 0xf6e7d1 });
  g.moveTo(-66, -74)
    .lineTo(-17, -10)
    .lineTo(33, -74)
    .moveTo(-17, -77)
    .lineTo(-17, 7)
    .stroke({ width: 4.4, color: 0xf6e7d1 });
  g.rect(-112, -105, 7, 113).fill(0xfff3da);
  g.rect(68, -106, 7, 113).fill(0xfff3da);
  g.poly([151, -116, 157, -121, 154, -16, 148, -14]).fill(0xe7cfb0);

  const sign = new Container({ label: 'shop-sign', x: -20, y: -143, rotation: -0.1 });
  sign.scale.set(0.94);
  const board = new Graphics()
    .poly([-42, -16, 39, -19, 43, 16, -41, 18])
    .fill(0xb58b71)
    .poly([-44, -18, 39, -20, 40, -4, 32, -1, 41, 2, 41, 14, -42, 16])
    .fill(0xfff2d6);
  const label = new Text({
    text: 'SHOP',
    style: { fontFamily: 'Arial, sans-serif', fontSize: 23, fontWeight: '900', fill: 0x912e28 },
  });
  label.anchor.set(0.5);
  label.position.set(-2, -1);
  sign.addChild(board, label);
  root.addChild(g, sign);
  return root;
}

function fence(g: Graphics, x: number, y: number, count: number, rise: number): void {
  const spacing = 43;
  for (let i = 0; i < count; i++) {
    const p = x + i * spacing;
    const q = y + i * rise;
    const top = q - 44 + (i % 2) * 5;
    if (i + 1 < count) {
      for (const rail of [16, 30])
        g.poly([
          p,
          q - rail,
          p + spacing,
          q + rise - rail,
          p + spacing,
          q + rise - rail + 5,
          p,
          q - rail + 5,
        ]).fill(0xc9cca0);
    }
    g.poly([p - 4, q + 1, p - 5, top + 5, p + 0.5, top, p + 5, top + 5, p + 4, q + 1]).fill(0xdcdbad);
  }
}

export function createFarm(): Container {
  const root = new Container({ label: 'valley-farm' });
  const details = new Graphics({ label: 'fences-and-training-sign' });
  fence(details, -81, 520, 6, -4);
  fence(details, 1218, 573, 7, -3.3);
  details.poly([166, 580, 174, 580, 181, 507, 171, 507]).fill(0x9c7c59);
  details.poly([122, 504, 209, 505, 228, 525, 209, 545, 120, 542]).fill(0xbd9c71);
  details.poly([127, 507, 209, 508, 224, 525, 208, 541, 124, 538]).fill(0xe6cd98);
  details.circle(133, 522, 2.2).fill(0xb4996e);
  const sign = new Text({
    text: 'TRAINING',
    style: { fontFamily: 'Arial, sans-serif', fontSize: 14, fontWeight: 'bold', fill: 0x8b674c },
  });
  sign.anchor.set(0.5);
  sign.position.set(173, 523);
  sign.rotation = 0.025;
  root.addChild(windmill(), barn(), details, sign);
  return root;
}
