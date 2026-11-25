import { Container, Graphics, Text } from 'pixi.js';
import { flipY, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';

const INK = 0x25394a;
const LIGHT = 0xf4f6eb;

function drawWheel(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r)
    .fill(
      vGradient([
        [0, 0x344958],
        [0.57, 0x3d505b],
        [1, 0x4d6068],
      ]),
    )
    .stroke({ color: 0x3f515b, width: 0.48 })
    .circle(x, y, r * 0.76)
    .stroke({ color: 0x536770, width: 0.4 })
    .circle(x, y, r * 0.57)
    .fill(
      vGradient([
        [0, 0x829fac],
        [0.48, 0x698797],
        [1, 0x57717d],
      ]),
    )
    .stroke({ color: 0x3d5665, width: 0.55 })
    .circle(x, y, r * 0.26)
    .fill(0x91aab4)
    .stroke({ color: 0x627d89, width: 0.38 });
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 3;
    g.circle(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, 0.33).fill(0x557380);
  }
  g.moveTo(x - r * 0.64, y - r * 0.44)
    .quadraticCurveTo(x - r * 0.34, y - r * 0.74, x + r * 0.03, y - r * 0.76)
    .stroke({ color: 0x637782, width: 0.35, cap: 'round' });
}

function drawPlatform(g: Graphics, w: number, lift: boolean) {
  const [pale, paint, shade] = lift ? [0xe8bc93, 0xb77b57, 0x854d43] : [0xbddae6, 0x6799be, 0x486589];
  const beam = { color: lift ? 0x66483d : 0x435971, width: 0.55, join: 'round' } as const;
  if (lift) {
    g.roundRect(1, 1.8, w - 2, 3.7, 0.55)
      .fill(
        vGradient([
          [0, paint],
          [1, shade],
        ]),
      )
      .stroke(beam);
    const stripeEnd = w - 4.05;
    g.rect(4.05, 2.85, stripeEnd - 4.05, 1.8).fill(0x594743);
    for (let x = 4.05; x + 3.4 <= stripeEnd; x += 4.15) {
      g.poly([x, 4.65, x + 1.75, 2.85, x + 3.45, 2.85, x + 1.7, 4.65]).fill(0xd9ad62);
    }
    for (const x of [2.05, w - 4.05]) {
      g.roundRect(x, 1.7, 2, 5.35, 0.52).fill(0xa06e5e).stroke(beam);
      g.moveTo(x + 0.58, 3.15)
        .lineTo(x + 0.58, 5.3)
        .stroke({ color: pale, alpha: 0.62, width: 0.33 });
      g.circle(x + 1, 5.85, 0.34).fill(0xf0c495);
    }
  } else {
    g.poly([1.2, 1.8, w - 1.2, 1.8, w - 3.2, 5.35, 3.2, 5.35])
      .fill(
        vGradient([
          [0, paint],
          [1, shade],
        ]),
      )
      .stroke(beam);
    g.moveTo(4.2, 4.35)
      .lineTo(w - 4.2, 4.35)
      .stroke({ color: 0x96b8cb, width: 0.32, cap: 'round' });
    for (const x of [3.65, w - 3.65]) {
      g.poly([x - 1.85, 4.4, x, 2.15, x + 1.85, 4.4])
        .fill(0x7599af)
        .stroke(beam);
      g.circle(x, 3.65, 0.36).fill(pale);
    }
  }
  g.roundRect(0, 0, w, 2.55, 0.65)
    .fill(
      vGradient([
        [0, pale],
        [0.3, paint],
        [1, shade],
      ]),
    )
    .stroke({ color: INK, width: 0.7, alignment: 1 });
  g.moveTo(1.6, 0.7)
    .lineTo(w - 1.6, 0.7)
    .stroke({ color: pale, width: 0.38, cap: 'round' });
  for (const x of [1.5, w - 2.75]) g.roundRect(x, 1.25, 1.25, 0.55, 0.17).fill(0xffdb83);
}

function drawTrailer(g: Graphics, left: number, right: number) {
  const w = right - left;
  g.rect(left + 0.65, 0.65, w - 1.3, 16.4)
    .fill(
      vGradient([
        [0, 0xf7f8ee],
        [0.2, 0xe6eeea],
        [0.76, 0xc0d0d3],
        [1, 0x96aeb7],
      ]),
    )
    .stroke({ color: 0x526c7c, width: 0.65, alignment: 1 });

  for (let x = left + 5; x < right - 2; x += 4.4) {
    g.poly([x, 2.5, x + 1.5, 2.5, x + 0.95, 15.65, x - 0.6, 15.65]).fill(0xa8bfc5);
    g.poly([x - 0.6, 2.5, x, 2.5, x - 0.6, 15.65, x - 1.15, 15.65]).fill(0xf1f4eb);
  }
  for (const x of [left + 1.35, right - 2.8]) {
    g.roundRect(x, 1.7, 1.55, 14, 0.4).fill(0x748f9d).stroke({ color: 0x4a697b, width: 0.35 });
    for (const d of [3, 13.75]) g.circle(x + 0.76, d, 0.33).fill(LIGHT);
  }

  g.roundRect(left + 2.25, 15.85, w - 3.7, 2.6, 0.5)
    .fill(0x527887)
    .stroke({ color: INK, width: 0.55 });
  g.moveTo(left + 3.6, 16.45)
    .lineTo(right - 2.65, 16.45)
    .stroke({ color: 0x8caeb3, width: 0.4, cap: 'round' });
  for (let x = left + 11; x < right - 3; x += 16) {
    g.roundRect(x, 17.1, 3, 0.7, 0.3).fill(0xe6ae62);
  }
}

function drawCab(g: Graphics, right: number) {
  const x = right - 37;
  g.moveTo(x, 1.05)
    .lineTo(right - 0.65, 1.05)
    .lineTo(right - 0.65, 11.25)
    .quadraticCurveTo(right - 0.9, 13.9, right - 3.6, 17.7)
    .quadraticCurveTo(right - 5.3, 19.3, right - 8.5, 21.3)
    .lineTo(x + 1.2, 21.3)
    .quadraticCurveTo(x - 1, 21.3, x - 1, 18.1)
    .lineTo(x - 1, 3)
    .quadraticCurveTo(x - 1, 1.05, x, 1.05)
    .closePath()
    .fill(
      vGradient([
        [0, LIGHT],
        [0.45, 0xd8e4e6],
        [0.73, 0x99b2c2],
        [1, 0x7794a9],
      ]),
    )
    .stroke({ color: INK, width: 0.62 });

  g.roundRect(x + 1.6, 3.3, 11, 7.6, 1)
    .fill(
      vGradient([
        [0, 0x758eae],
        [1, 0xb5ccd7],
      ]),
    )
    .stroke({ color: 0x637f94, width: 0.48 });
  g.moveTo(x + 15.3, 4)
    .quadraticCurveTo(x + 15.7, 2.65, x + 17.1, 2.65)
    .lineTo(right - 2, 2.65)
    .lineTo(right - 1.6, 11.5)
    .lineTo(x + 15.3, 11.5)
    .closePath()
    .fill(
      vGradient([
        [0, 0x507eaa],
        [0.8, 0x91bcd9],
        [1, 0xc3dedf],
      ]),
    )
    .stroke({ color: INK, width: 0.55, join: 'round' });
  g.poly([x + 17.5, 3.2, x + 22.7, 3.2, x + 18.3, 10.9, x + 15.85, 10.9, x + 15.85, 5.9]).fill({
    color: LIGHT,
    alpha: 0.45,
  });
  g.moveTo(x + 14, 12)
    .lineTo(x + 14, 17.4)
    .quadraticCurveTo(x + 14, 19, x + 15.4, 19)
    .lineTo(x + 22, 19)
    .stroke({ color: 0x617e94, width: 0.5, cap: 'round' });
  g.roundRect(x + 15.4, 12.4, 3.3, 0.8, 0.35).fill(0x496679);
  g.roundRect(x + 1.3, 16.7, 8, 1.7, 0.5)
    .fill(0x748ea0)
    .stroke({ color: INK, width: 0.4 });

  for (const [dx, y, rx, ry] of [
    [9.8, 7.5, 3.7, 4.55],
    [3.9, 7.7, 2.5, 3.95],
  ] as const) {
    const ex = right - dx;
    g.ellipse(ex, y, rx, ry).fill(0xfff8e6).stroke({ color: INK, width: 0.5 });
    g.ellipse(ex + 0.7, y + 0.45, rx * 0.48, ry * 0.55).fill(0x66a2bc);
    g.ellipse(ex + 0.95, y + 0.6, rx * 0.29, ry * 0.43).fill(0x203849);
    g.circle(ex + 0.35, y - 0.5, 0.64).fill(0xffffff);
  }
  g.moveTo(right - 13.1, 2.7)
    .quadraticCurveTo(right - 10.3, 1.1, right - 7, 2.35)
    .moveTo(right - 5.35, 3.05)
    .quadraticCurveTo(right - 4, 1.85, right - 2.1, 2.85)
    .stroke({ color: INK, width: 0.68, cap: 'round' });
  g.moveTo(right - 10.6, 13.45)
    .quadraticCurveTo(right - 7.5, 15.5, right - 4.4, 12.95)
    .stroke({ color: 0x3b5567, width: 0.55, cap: 'round' });
  g.roundRect(right - 4.2, 11.65, 3.55, 1.75, 0.45)
    .fill(0xf5b758)
    .stroke({ color: INK, width: 0.45 });
  g.moveTo(right - 7.15, 15.35)
    .lineTo(right - 2.2, 15.35)
    .quadraticCurveTo(right - 2.6, 16.6, right - 3.45, 17.45)
    .lineTo(right - 7.15, 17.45)
    .quadraticCurveTo(right - 8.15, 16.4, right - 7.15, 15.35)
    .fill(
      vGradient([
        [0, 0x9bc4d6],
        [0.47, 0x659ebc],
        [1, 0x477da0],
      ]),
    )
    .stroke({ color: INK, width: 0.48, join: 'round' });
}

export function createPlayfield(): Container {
  const world = new Container({ label: 'truck-convoy-world' });
  const [solid] = stage.solids;
  const left = solid!.points[0]![0];
  const right = solid!.points[1]![0];
  for (const [i, { x1, x2, y }] of stage.platforms.entries()) {
    const lift = i === 1;
    const platform = new Graphics({ label: lift ? 'striped-lift' : 'loading-tray' });
    drawPlatform(platform, x2 - x1, lift);
    platform.position.set(x1, -y);
    world.addChild(platform);
  }

  const g = new Graphics({ label: 'stationary-trailer' });
  const wheelX = [left + 15, left + 33, right - 17.2];
  const outline = flipY(solid!.points);
  g.poly(outline).fill(
    vGradient([
      [0, 0x637f93],
      [0.68, 0x49687d],
      [1, 0x344857],
    ]),
  );
  g.roundRect(-28, 19, 35, 3.7, 1)
    .fill(
      vGradient([
        [0, 0xa36054],
        [1, 0x754844],
      ]),
    )
    .stroke({ color: INK, width: 0.5 });
  for (const x of [-23, -11, 2]) g.roundRect(x, 18.9, 1.05, 3.9, 0.35).fill(0x663f40);
  g.roundRect(13, 19, 20, 3.7, 1.25)
    .fill(
      vGradient([
        [0, 0xc7dade],
        [1, 0x7593a6],
      ]),
    )
    .stroke({ color: INK, width: 0.5 });
  for (const y of [19.7, 21.25]) g.roundRect(14.5, y, 17, 0.5, 0.25).fill(0x618295);
  drawTrailer(g, left, right - 40);
  drawCab(g, right);

  g.poly(outline).stroke({ color: INK, width: 0.8, alignment: 1, join: 'round' });
  for (const x of wheelX) {
    g.moveTo(x - 8.2, 23.65)
      .quadraticCurveTo(x - 7.25, 16.75, x, 16.75)
      .quadraticCurveTo(x + 7.25, 16.75, x + 8.2, 23.65)
      .fill(0x253645)
      .stroke({ color: 0x7b9cab, width: 0.62, cap: 'round' });
    drawWheel(g, x, 24.5, 6.5);
  }
  g.rect(left, 0, right - left, 1.95).fill(0x466574);
  g.moveTo(left, 0.35).lineTo(right, 0.35).stroke({ color: INK, width: 0.7 });
  g.moveTo(left + 1.1, 0.98)
    .lineTo(right - 1.1, 0.98)
    .stroke({ color: LIGHT, width: 0.38, cap: 'round' });
  for (const x of [left + 1, right - 4.4]) {
    g.roundRect(x, 1.65, 3.4, 1.65, 0.36).fill(0x5a5961).stroke({ color: INK, width: 0.35 });
    g.roundRect(x + 0.36, 1.94, 2.68, 0.85, 0.3).fill(0xfbd18b);
  }
  g.roundRect(left + 1, 12.25, 2.15, 2.8, 0.45)
    .fill(0xa85f57)
    .stroke({ color: INK, width: 0.45 });
  g.roundRect(left + 1.35, 12.65, 1.45, 0.8, 0.3).fill(0xf9aa79);

  g.roundRect(-47, 4, 56, 9.8, 1.3).fill(0xcbdad8).stroke({ color: 0x8eaaae, width: 0.55 });
  g.poly([-45.2, 9, -42.2, 5.65, -37.9, 5.65, -35, 9, -37.9, 12.25, -42.2, 12.25]).fill(0x39717a);
  g.poly([-43.5, 10.4, -41.05, 7.1, -39.75, 8.4, -38.65, 7.25, -36.7, 10.4]).fill(LIGHT);
  const decal = new Text({
    text: 'ALPINE FREIGHT',
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 4.2,
      fontWeight: '800',
      letterSpacing: 0.35,
      fill: 0x355f70,
    },
    resolution: 8,
  });
  decal.anchor.set(0, 0.5);
  decal.position.set(-33.1, 9.05);
  world.addChild(g, decal);
  return world;
}
