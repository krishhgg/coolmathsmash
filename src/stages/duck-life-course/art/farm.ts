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
    .fill(0xd6a553);
  g.moveTo(-62, -147)
    .quadraticCurveTo(-49, -158, -41, -181)
    .quadraticCurveTo(-32, -203, -5, -204)
    .quadraticCurveTo(7, -204, 13, -201)
    .quadraticCurveTo(-17, -195, -21, -178)
    .quadraticCurveTo(-28, -155, -42, -145)
    .closePath()
    .fill(0xefd38c);
  g.moveTo(-62, -146).quadraticCurveTo(-2, -134, 57, -150).stroke({ width: 4, color: 0xb38d58 });
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
  root.addChild(g, sails, axle);
  return root;
}

function barn(): Graphics {
  const g = new Graphics({ label: 'red-barn', x: 1118, y: 512 });
  g.scale.set(0.94);
  g.ellipse(21, 5, 157, 17).fill(0x90b56a);
  g.poly([-113, -104, 75, -101, 75, 7, -112, 8]).fill(0xc86555);
  g.poly([75, -101, 158, -120, 154, -16, 75, 7]).fill(0xae584c);
  g.poly([-120, -102, -68, -163, 4, -187, 83, -103, 75, -98, -111, -98]).fill(0xd36a56);
  for (let x = -102; x < 74; x += 21) g.moveTo(x, -100).lineTo(x, 5).stroke({ width: 1.8, color: 0xbb5d51 });
  for (let x = 90; x < 155; x += 19)
    g.moveTo(x, -105)
      .lineTo(x, 7 - (x - 75) * 0.29)
      .stroke({ width: 1.7, color: 0xa25348 });
  g.poly([3, -187, 94, -200, 134, -166, 167, -116, 83, -97, 51, -145]).fill(0x7a8373);
  g.poly([51, -145, 134, -166, 167, -116, 83, -97]).fill(0x68786d);
  g.moveTo(-123, -100)
    .lineTo(-68, -163)
    .lineTo(4, -187)
    .lineTo(52, -144)
    .lineTo(83, -101)
    .stroke({ width: 5.7, color: 0xdbca9f, join: 'round' });
  g.moveTo(83, -101).lineTo(167, -119).stroke({ width: 4.4, color: 0x999a81 });
  g.poly([54, -190, 54, -221, 77, -224, 79, -195]).fill(0xc5826e);
  g.poly([77, -224, 95, -214, 95, -194, 79, -195]).fill(0xaf7566);
  g.poly([49, -218, 71, -243, 101, -217, 78, -226]).fill(0x6f7e72);
  g.rect(-36, -137, 31, 28).fill(0x806957).stroke({ width: 4, color: 0xe6d3ad });
  g.moveTo(-20.5, -137).lineTo(-20.5, -109).stroke({ width: 2.6, color: 0xe6d3ad });
  g.rect(-66, -77, 99, 84).fill(0xa56759).stroke({ width: 5.4, color: 0xe5d1ac });
  g.moveTo(-66, -74)
    .lineTo(-17, -10)
    .lineTo(33, -74)
    .moveTo(-17, -77)
    .lineTo(-17, 7)
    .stroke({ width: 4.4, color: 0xe5d1ac });
  g.rect(-111, -101, 5, 109).fill(0xe4c9a5);
  g.rect(70, -103, 5, 110).fill(0xe4c9a5);
  return g;
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
  fence(details, 1135, 533, 8, -3.3);
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
