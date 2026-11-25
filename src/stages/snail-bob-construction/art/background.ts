import { Container, FillGradient, Graphics } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, wrap, type StageCamera } from '../../battlefield/art/parallax';
import { hash01, vGradient } from '../../battlefield/art/util';

export const YARD = { depth: 0.18, left: -900, right: 2180, top: 638, bottom: 2400 } as const;
const EARTH_LINE = YARD.top;
const CRANE_INK = 0x85725e;

function gantry(g: Graphics, x: number, top: number, w: number, height: number, color: number): void {
  const beam = w / 9;
  const bottom = top + height;
  g.rect(x, top, beam, height)
    .rect(x + w - beam, top, beam, height)
    .fill(color);
  for (let y = top; y + 45 < bottom; y += 46) {
    g.moveTo(x + beam / 2, y)
      .lineTo(x + w - beam / 2, y + 46)
      .lineTo(x + beam / 2, y + 46)
      .stroke({ width: beam * 0.6, color });
  }
}

function crane(): Graphics {
  const g = new Graphics({ label: 'parked crane and wired controls' });
  g.moveTo(994, 156).lineTo(1186, 143).stroke({ color: 0xa6a6a9, width: 9, cap: 'round' });
  g.moveTo(1036, 111)
    .lineTo(1151, 147)
    .lineTo(1069, 153)
    .stroke({ color: 0x999eac, width: 4, join: 'round' });
  g.moveTo(1113, 157).lineTo(1113, 232).moveTo(1120, 157).lineTo(1120, 232).stroke({
    color: 0x96908b,
    width: 2.3,
  });
  g.roundRect(1101, 140, 29, 19, 5).fill(0xd3a74d).stroke({ color: CRANE_INK, width: 2 });
  g.rect(1105, 144, 20, 4).fill(0xeac766);
  for (const side of [-1, 1]) {
    g.moveTo(1116.5, 226)
      .quadraticCurveTo(1116.5 + side * 22, 232, 1116.5 + side * 23, 253)
      .quadraticCurveTo(1116.5 + side * 22, 268, 1116.5 + side * 5, 272)
      .lineTo(1116.5 + side * 6, 260)
      .quadraticCurveTo(1116.5 + side * 14, 256, 1116.5 + side * 11, 247)
      .lineTo(1116.5 + side * 1, 234)
      .closePath()
      .fill(
        vGradient([
          [0, 0xecca60],
          [1, 0xc8913c],
        ]),
      )
      .stroke({ color: CRANE_INK, width: 2 });
    g.circle(1116.5 + side * 18, 248, 4.4)
      .fill(0xc69c48)
      .stroke({ color: CRANE_INK, width: 1.3 });
  }
  g.circle(1116.5, 229, 8).fill(0xb1a8ac).stroke({ color: 0x8c818a, width: 2 });
  g.circle(1116.5, 229, 3.5).fill(0x8c818a);
  g.moveTo(1040, 224)
    .bezierCurveTo(1040, 246, 1068, 240, 1052, 259)
    .quadraticCurveTo(1040, 265, 1040, 276)
    .stroke({ color: 0x867f75, width: 4, cap: 'round' });
  g.roundRect(1017, 179, 43, 54, 5)
    .fill(
      vGradient([
        [0, 0xf7d96b],
        [0.49, 0xe9ae40],
        [1, 0xbb8241],
      ]),
    )
    .stroke({
      color: CRANE_INK,
      width: 2,
    });
  g.roundRect(1021, 183, 36, 3, 1).fill(0xf3d991);
  g.roundRect(1025, 204, 26, 19, 3).fill(0xa18d69);
  for (let x = 1030; x <= 1046; x += 4) g.rect(x, 208, 2, 11).fill(0xb0a184);
  g.roundRect(1024, 272, 31, 96, 7)
    .fill(
      vGradient([
        [0, 0xbab7aa],
        [1, 0x96938e],
      ]),
    )
    .stroke({
      color: 0x8d867a,
      width: 2,
    });
  for (const [i, y] of [290, 320, 350].entries()) {
    g.circle(1039.5, y, 10).fill(0xc6b9a8).stroke({ color: 0x9d9084, width: 1.5 });
    g.circle(1039.5, y, 6.25).fill(i === 1 ? 0xb77950 : 0xb26750);
    g.ellipse(1038, y - 2.5, 3.1, 1.5).fill(0xc99069);
  }
  for (const x of [1029, 1050]) {
    g.circle(x, 277, 1.4).fill(0x8d867a);
    g.circle(x, 363, 1.4).fill(0x8d867a);
  }
  return g;
}

function yardProps(g: Graphics): void {
  for (const [x, y, s] of [
    [134, 576, 46],
    [176, 588, 44],
    [153, 540, 36],
  ] as const) {
    g.rect(x, y, s, s).fill(0xc9aa71).stroke({ width: 2.4, color: 0xb0936a });
    g.rect(x + 4, y + 4, s - 8, s - 8)
      .fill(0xd7b97c)
      .stroke({ width: 1.3, color: 0xb69a6d });
    for (let line = 11; line < s - 6; line += 8)
      g.moveTo(x + line, y + 5)
        .lineTo(x + line + 0.8, y + s - 5)
        .stroke({ width: 1.2, color: 0xc6a670 });
    g.moveTo(x + 5, y + s - 5)
      .lineTo(x + s - 5, y + 5)
      .stroke({ width: 5.1, color: 0xe0c18a });
    g.circle(x + 4.8, y + s - 5.2, 1.6)
      .circle(x + s - 4.8, y + 4.8, 1.6)
      .fill(0xa68868);
  }
  const sign = new Graphics();
  sign.poly([0, 3, 70, 0, 73, 30, 3, 33]).fill(0xe4dcc4);
  sign.rect(-2, 2, 13, 5).rect(63, 25, 13, 5).fill({ color: 0xece3c7, alpha: 0.65 });
  sign
    .moveTo(19, 10)
    .lineTo(10, 10)
    .lineTo(10, 23)
    .lineTo(19, 23)
    .moveTo(10, 16)
    .lineTo(17, 16)
    .moveTo(23, 10)
    .lineTo(33, 23)
    .moveTo(33, 10)
    .lineTo(23, 23)
    .moveTo(38, 10)
    .lineTo(38, 23)
    .moveTo(43, 10)
    .lineTo(54, 10)
    .moveTo(48.5, 10)
    .lineTo(48.5, 23)
    .moveTo(58, 11)
    .lineTo(65, 16.5)
    .lineTo(58, 22)
    .stroke({ width: 2.4, color: 0x94715c, join: 'round' });
  sign.position.set(1028, 581);
  sign.rotation = -0.085;
  g.addChild(sign);
}

export function createBackground() {
  const container = new Container({ label: 'construction-skyline' });
  const sky = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(
    vGradient([
      [0, 0x7f9bd1],
      [0.48, 0xafc7e6],
      [1, 0xe7e8d6],
    ]),
  );
  sky.circle(865, 154, 59).fill(
    new FillGradient({
      type: 'radial',
      textureSpace: 'local',
      innerRadius: 0.2,
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 0xffefad },
        { offset: 0.52, color: 0xffefad },
        { offset: 0.56, color: 'rgba(255,239,173,0.42)' },
        { offset: 1, color: 'rgba(255,239,173,0)' },
      ],
    }),
  );

  const clouds = new Container({ label: 'clouds' });
  const puffs = Array.from({ length: 7 }, (_, i) => {
    const g = new Graphics()
      .moveTo(-160, 0)
      .bezierCurveTo(-122, -7, -119, -36, -75, -24)
      .bezierCurveTo(-52, -54, -9, -54, 15, -29)
      .bezierCurveTo(42, -49, 94, -34, 110, -14)
      .quadraticCurveTo(134, -12, 164, 0)
      .quadraticCurveTo(26, 17, -160, 0)
      .closePath()
      .fill(
        vGradient([
          [0, 'rgba(231,232,229,0.65)'],
          [1, 'rgba(225,231,238,0)'],
        ]),
      );
    g.scale.set(0.8 + hash01(i + 13) * 0.7, 0.7 + hash01(i) * 0.55);
    g.y = 232 + 68 * Math.sin(i * 1.74) + (i % 3) * 49;
    clouds.addChild(g);
    return g;
  });

  const gantries = new Graphics({ label: 'distant cranes' });
  gantry(gantries, 177, 80, 74, 514, 0x9eacbd);
  gantry(gantries, 1010, 17, 60, 587, 0x9daaba);
  gantry(gantries, -290, 181, 47, 375, 0xa2b2c4);
  gantries.moveTo(153, 86).lineTo(338, 86).lineTo(434, 149).stroke({ width: 13, color: 0xa0aec1 });
  gantries.moveTo(190, 45).lineTo(373, 123).moveTo(189, 44).lineTo(189, 86).stroke({
    width: 4,
    color: 0x96a3ba,
  });
  gantries.moveTo(371, 124).lineTo(371, 242).stroke({ width: 2.4, color: 0x98a9c0 });
  gantries
    .moveTo(371, 238)
    .quadraticCurveTo(372, 256, 362, 255)
    .quadraticCurveTo(352, 252, 357, 246)
    .stroke({ width: 4, color: 0xa1a9b3, cap: 'round' });
  const cranes = new Container({ label: 'yard cranes' });
  cranes.addChild(gantries, crane());

  const yard = new Graphics({ label: 'fence and ochre earth' });
  const span = YARD.right - YARD.left;
  yard.rect(YARD.left, EARTH_LINE, span, YARD.bottom - EARTH_LINE).fill(
    vGradient([
      [0, 0xb88b4e],
      [0.15, 0xb39370],
      [1, 0x79665d],
    ]),
  );
  for (let x: number = YARD.left, seed = 0; x < YARD.right; seed++) {
    const w = Math.min(22 + hash01(seed + 24) * 27, YARD.right - x);
    const h = 64 + 20 * hash01(seed) + Math.max(0, 33 * Math.sin(x / 86 + 1.9));
    const top = EARTH_LINE - h;
    yard
      .poly([x, EARTH_LINE, x, top + 4, x + w * 0.26, top, x + w, top + 2, x + w, EARTH_LINE])
      .fill([0xd1bc92, 0xc7b38e, 0xcfbf9b][Math.floor(hash01(seed + 51) * 3)]);
    yard.rect(x, top + 5, 1.6, h - 5).fill(0xb6a282);
    yard
      .moveTo(x + w * 0.46, top + 12)
      .quadraticCurveTo(x + w * 0.25, EARTH_LINE - 47, x + w * 0.45, EARTH_LINE - 13)
      .moveTo(x + w * 0.72, top + 25)
      .quadraticCurveTo(x + w * 0.78, EARTH_LINE - 42, x + w * 0.65, EARTH_LINE - 5)
      .stroke({ width: 1.4, color: 0xb9a687, alpha: 0.78 });
    if (w > 7.5) yard.circle(x + 6, top + 14, 1.6).fill(0xa38f70);
    x += w;
  }
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 115; col++) {
      const seed = row * 115 + col;
      const x = YARD.left + 12 + col * 27 + (row % 2) * 13 + hash01(seed + 16) * 8;
      const y = EARTH_LINE + 12 + row * 20 + hash01(seed + 901) * 6;
      const r = 7 + 7 * hash01(seed);
      const tilt = (hash01(seed + 201) - 0.5) * 7;
      yard
        .poly([
          x - r,
          y,
          x - r * 0.42,
          y - 7 - tilt,
          x + r * 0.55,
          y - 6,
          x + r,
          y,
          x + r * 0.65,
          y + 7,
          x - r * 0.4,
          y + 8 + tilt,
        ])
        .fill([0xc59d60, 0xab7d49, 0xbd914f, 0xc09b61][Math.floor(hash01(seed + 49) * 4)]);
    }
  for (const x of [-280, 53, 260, 1040, 1300, 1580]) {
    for (let i = 0; i < 6; i++) {
      const r = 22 + 18 * hash01(x + i);
      yard.ellipse(x + i * 19, EARTH_LINE - r * 0.36, r, r * 0.62).fill(i % 2 ? 0x9da675 : 0xa9ae80);
    }
  }
  const props = new Graphics();
  yardProps(props);
  for (let i = 0; i < 43; i++) {
    const x = -600 + i * 62 + hash01(i + 318) * 28;
    const y = EARTH_LINE + 2 + Math.sin(i) * 5;
    props.poly([x, y, x + 5, y - 8, x + 9, y - 3, x + 15, y - 9, x + 20, y]).fill(0x9eaa64);
  }
  yard.addChild(props);
  for (const [x, direction] of [
    [60, 1],
    [1225, -1],
  ] as const) {
    const pipe = new Graphics();
    pipe.rect(-310, -29, 312, 58).fill(
      vGradient([
        [0, 0xd7a552],
        [0.36, 0xeec16a],
        [1, 0xb1915e],
      ]),
    );
    pipe.roundRect(-20, -35, 19, 70, 5).fill(0xd4b47c).stroke({ color: 0xb39e7c, width: 3 });
    pipe.ellipse(0, 0, 10, 31).fill(0xa79983).stroke({ color: 0xd6b474, width: 4 });
    pipe.position.set(x, 607);
    pipe.scale.x = direction;
    yard.addChild(pipe);
  }

  yard.cacheAsTexture({ resolution: 0.8, antialias: true });
  const layers = [
    [0, sky],
    [0.06, clouds],
    [0.12, cranes],
    [YARD.depth, yard],
  ] as const;
  for (const [, node] of layers) {
    node.pivot.set(VIEW_W / 2, VIEW_H / 2);
    container.addChild(node);
  }
  return {
    container,
    update(frame: number, camera: StageCamera) {
      puffs.forEach(
        (puff, i) => (puff.x = wrap(64 + i * 214 - frame * (0.065 + (i % 3) * 0.03), -450, 2200)),
      );
      for (const [depth, node] of layers) {
        const { x, y, scale } = layerTransform(depth, camera);
        node.position.set(x, y);
        node.scale.set(scale);
      }
    },
  };
}
