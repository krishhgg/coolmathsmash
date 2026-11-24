import { Container, FillGradient, Graphics } from 'pixi.js';
import { CAP_BOTTOM, HULL_BOTTOM, MAIN_HULL, TOP_Y, UNDERSIDE, hullSpan } from './outline';
import {
  BRASS,
  BRASS_DARK,
  BRICK_BOTTOM,
  BRICK_TOP,
  GEM_BLUE,
  GEM_BLUE_DARK,
  GEM_RED,
  GEM_RED_DARK,
  INK,
  MORTAR,
  MOSS,
  MOSS_DARK,
  MOSS_LIGHT,
  PLANET_BLUE,
  PLANET_BLUE_DARK,
  PLANET_GREEN,
  PLANET_GREEN_DARK,
  STONE,
  STONE_DARK,
  STONE_HIGHLIGHT,
  STONE_LIGHT,
  STONE_MID,
  VINE,
} from './palette';
import { diamond, flipY, hash01, mix, sparkle, vGradient } from './util';

const OUTLINE = 0.72;
const CAP_H = TOP_Y - CAP_BOTTOM;

export interface IslandArt {
  container: Container;
  update(frame: number): void;
}

/**
 * The main platform in game units: a Forest Temple sandstone cap (the walkable top and the side walls) on a tapered
 * brick underside carrying the Coolmath planet medallion and Fireboy & Watergirl's gems. Key light comes from the
 * upper right, where the sky's sun rays are.
 */
export function createIsland(): IslandArt {
  const container = new Container({ label: 'main-platform' });
  const body = new Graphics();
  drawUnderside(body);
  drawCap(body);
  body.poly(flipY(MAIN_HULL)).stroke({ width: OUTLINE, color: INK, join: 'round' });
  drawLedgeGuards(body);
  for (const [x, size, seed] of [
    [-67, 6.5, 1],
    [-34, 8, 2],
    [6, 6, 3],
    [37, 8.5, 4],
    [67, 5.5, 5],
  ] as const)
    mossTuft(body, x, -CAP_BOTTOM, size, seed);

  const medallion = createMedallion(0, -24.4);
  const gems = [
    createGem(-57, -17.6, GEM_RED, GEM_RED_DARK, 0),
    createGem(57, -17.6, GEM_BLUE, GEM_BLUE_DARK, 97),
  ];
  const vines = (
    [
      [-14.2, 0, 10, 0],
      [-32.6, 0, 7.5, 1.3],
      [HULL_BOTTOM, -27, 6, 2.1],
      [HULL_BOTTOM, 17, 11, 0.7],
      [-29.6, 1, 7, 2.9],
      [-18.4, 1, 12, 1.8],
    ] as const
  ).map(([y, where, len, phase], i) => {
    const span = hullSpan(y);
    const x = y === HULL_BOTTOM ? where : span[where === 0 ? 0 : 1];
    return createVine(x, y, len, phase, i);
  });

  container.addChild(body, medallion.node, ...gems.map((g) => g.node), ...vines.map((v) => v.node));
  return {
    container,
    update(frame) {
      medallion.update(frame);
      for (const g of gems) g.update(frame);
      for (const v of vines) v.update(frame);
    },
  };
}

function drawUnderside(g: Graphics): void {
  const shape = flipY(UNDERSIDE);
  g.poly(shape).fill(
    vGradient([
      [0, BRICK_TOP],
      [1, BRICK_BOTTOM],
    ]),
  );
  const course = 4;
  for (let k = 0; CAP_BOTTOM - k * course > HULL_BOTTOM + 0.05; k++) {
    const top = CAP_BOTTOM - k * course;
    const bottom = Math.max(top - course, HULL_BOTTOM);
    const [lt, rt] = hullSpan(top);
    const [lb, rb] = hullSpan(bottom);
    const left = Math.max(lt, lb) + 0.5;
    const right = Math.min(rt, rb) - 0.5;
    let x0 = left;
    let n = 0;
    let x1 = left + (k % 2 === 0 ? 4 : 8) + hash01(k * 7) * 3;
    while (x0 < right - 0.5) {
      x1 = Math.min(x1, right);
      brick(g, x0, x1, top, bottom, k * 101 + n);
      if (x1 < right)
        g.moveTo(x1, -top).lineTo(x1, -bottom).stroke({ width: 0.34, color: MORTAR, alpha: 0.85 });
      x0 = x1;
      x1 = x0 + 7.5 + hash01(k * 31 + n * 7) * 4.5;
      n++;
    }
    if (bottom > HULL_BOTTOM + 0.05) {
      const [l, r] = hullSpan(bottom);
      g.moveTo(l, -bottom).lineTo(r, -bottom).stroke({ width: 0.36, color: MORTAR, alpha: 0.85 });
    }
  }
  g.poly(shape).fill(
    vGradient([
      [0, 'rgba(25,20,8,0)'],
      [0.45, 'rgba(25,20,8,0)'],
      [1, 'rgba(25,20,8,0.38)'],
    ]),
  );
  const ys = [CAP_BOTTOM, -16, -22, -28, -34, HULL_BOTTOM];
  const band = [
    ...ys.map((y) => [hullSpan(y)[0], -y]),
    ...ys
      .slice()
      .reverse()
      .map((y) => [hullSpan(y)[0] + 9 + (CAP_BOTTOM - y) * 0.12, -y]),
  ].flat();
  g.poly(band).fill(
    new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0.5 },
      end: { x: 1, y: 0.5 },
      colorStops: [
        { offset: 0, color: 'rgba(25,20,8,0.42)' },
        { offset: 1, color: 'rgba(25,20,8,0)' },
      ],
      textureSpace: 'local',
    }),
  );
  ys.forEach((y, i) => {
    const x = hullSpan(y)[1] - 0.95;
    if (i === 0) g.moveTo(x, -y + 0.6);
    else g.lineTo(x, -y);
  });
  g.stroke({ width: 0.7, color: STONE_HIGHLIGHT, alpha: 0.5, join: 'round' });
  const [lipL, lipR] = hullSpan(CAP_BOTTOM - 2);
  g.poly([lipL - 1, -CAP_BOTTOM, lipR + 1, -CAP_BOTTOM, lipR, -CAP_BOTTOM + 2, lipL, -CAP_BOTTOM + 2]).fill(
    vGradient([
      [0, 'rgba(25,20,8,0.5)'],
      [1, 'rgba(25,20,8,0)'],
    ]),
  );
}

/** One Forest Temple brick: tinted face, light top-left bevel, dark bottom-right bevel, the odd crack. */
function brick(g: Graphics, x0: number, x1: number, top: number, bottom: number, seed: number): void {
  const v = hash01(seed);
  if (v > 0.5)
    g.rect(x0, -top, x1 - x0, top - bottom).fill({ color: v > 0.78 ? 0xfff3c0 : MORTAR, alpha: 0.09 });
  const i = 0.32;
  g.moveTo(x0 + i, -bottom - i)
    .lineTo(x0 + i, -top + i)
    .lineTo(x1 - i, -top + i)
    .stroke({ width: 0.3, color: STONE_LIGHT, alpha: 0.3, join: 'round' });
  g.moveTo(x1 - i, -top + i)
    .lineTo(x1 - i, -bottom - i)
    .lineTo(x0 + i, -bottom - i)
    .stroke({ width: 0.3, color: MORTAR, alpha: 0.4, join: 'round' });
  if (v > 0.93 && x1 - x0 > 5) {
    const cx = (x0 + x1) / 2;
    g.moveTo(cx - 1.6, -top + 0.4)
      .lineTo(cx - 0.4, -top + 1.6)
      .lineTo(cx - 1, -top + 2.5)
      .lineTo(cx + 0.6, -bottom - 0.4)
      .stroke({ width: 0.25, color: MORTAR, alpha: 0.7, join: 'round' });
  }
}

/**
 * A clump of moss hanging under the cap: a lobed blob with a lit top and a couple of leaves poking out.
 * (x, y) is the top centre in Pixi coordinates.
 */
function mossTuft(g: Graphics, x: number, y: number, size: number, seed: number): void {
  const lobes = 3 + Math.round(hash01(seed * 3) * 2);
  const half = size / 2;
  const pts: number[] = [x - half, y - 0.1, x + half, y - 0.1];
  for (let i = lobes; i >= 0; i--) {
    const px = x - half + (size * i) / lobes;
    pts.push(px, y + 0.35);
    if (i > 0) {
      const mid = px - size / lobes / 2;
      const drop = size * (0.16 + 0.2 * hash01(seed * 17 + i)) * (i === 1 || i === lobes ? 0.7 : 1);
      pts.push(mid + 0.25, y + drop, mid - 0.25, y + drop);
    }
  }
  leaf(g, x - half * 0.55, y + size * 0.18, Math.PI * 0.72, size * 0.34, mix(MOSS, MOSS_DARK, 0.25));
  leaf(g, x + half * 0.45, y + size * 0.2, Math.PI * 0.3, size * 0.3);
  g.poly(pts).fill(MOSS);
  g.poly(pts).stroke({ width: 0.22, color: MOSS_DARK, join: 'round' });
  g.moveTo(x - half + 0.5, y + 0.35)
    .lineTo(x + half - 0.5, y + 0.35)
    .stroke({ width: 0.4, color: MOSS_LIGHT, alpha: 0.9, cap: 'round' });
}

type Stroke = readonly (readonly [number, number])[];
const GLYPHS: Record<string, { lines: Stroke[]; dots?: Stroke }> = {
  '+': {
    lines: [
      [
        [-1, 0],
        [1, 0],
      ],
      [
        [0, -1],
        [0, 1],
      ],
    ],
  },
  '×': {
    lines: [
      [
        [-0.75, -0.75],
        [0.75, 0.75],
      ],
      [
        [-0.75, 0.75],
        [0.75, -0.75],
      ],
    ],
  },
  '÷': {
    lines: [
      [
        [-1, 0],
        [1, 0],
      ],
    ],
    dots: [
      [0, -0.62],
      [0, 0.62],
    ],
  },
  π: {
    lines: [
      [
        [-1.1, -0.75],
        [1.1, -0.8],
      ],
      [
        [-0.45, -0.75],
        [-0.55, 1],
      ],
      [
        [0.42, -0.78],
        [0.45, 0.72],
        [0.85, 1],
      ],
    ],
  },
};

/** An engraved glyph: dark cut with a lit lower lip, centred at Pixi (x, y). */
function engrave(g: Graphics, glyph: string, x: number, y: number, s: number): void {
  const def = GLYPHS[glyph];
  if (!def) return;
  const pass = (dy: number, color: number, alpha: number, width: number) => {
    for (const line of def.lines) {
      line.forEach(([u, v], i) =>
        i === 0 ? g.moveTo(x + u * s, y + v * s + dy) : g.lineTo(x + u * s, y + v * s + dy),
      );
      g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
    }
    for (const [u, v] of def.dots ?? [])
      g.circle(x + u * s, y + v * s + dy, width * 0.75).fill({ color, alpha });
  };
  pass(0.2, STONE_HIGHLIGHT, 0.75, 0.42);
  pass(0, MORTAR, 0.55, 0.42);
}

function drawCap(g: Graphics): void {
  g.rect(-80, -TOP_Y, 160, CAP_H).fill(
    vGradient([
      [0, STONE_LIGHT],
      [1, STONE],
    ]),
  );
  g.rect(-80, -TOP_Y, 160, 1).fill(STONE_HIGHLIGHT);
  g.moveTo(-80, 1).lineTo(80, 1).stroke({ width: 0.24, color: STONE_DARK, alpha: 0.7 });
  for (const y of [2.3, 7]) {
    g.moveTo(-77.5, y).lineTo(77.5, y).stroke({ width: 0.25, color: MORTAR, alpha: 0.35 });
    g.moveTo(-77.5, y + 0.22)
      .lineTo(77.5, y + 0.22)
      .stroke({ width: 0.2, color: STONE_HIGHLIGHT, alpha: 0.6 });
  }
  for (const x of [-70, -50, -30, -10, 10, 30, 50, 70]) {
    const jog = (hash01(Math.round(x) + 300) - 0.5) * 0.6;
    g.moveTo(x, 1)
      .lineTo(x + jog, 4.5)
      .lineTo(x, CAP_H)
      .stroke({ width: 0.32, color: MORTAR, alpha: 0.55 });
    g.moveTo(x + 0.32, 1.2)
      .lineTo(x + 0.32 + jog, 4.5)
      .lineTo(x + 0.32, CAP_H)
      .stroke({ width: 0.2, color: STONE_HIGHLIGHT, alpha: 0.45 });
  }
  const frieze = ['+', '×', '÷', 'π', '÷', '×', '+'];
  frieze.forEach((glyph, i) => engrave(g, glyph, -60 + i * 20, 4.65, glyph === 'π' ? 1.45 : 1.25));
  for (const x of [-75, 75]) {
    g.circle(x, 4.65, 1.25).stroke({ width: 0.35, color: MORTAR, alpha: 0.5 });
    g.circle(x, 4.65, 0.35).fill({ color: MORTAR, alpha: 0.5 });
  }
  g.rect(-80, CAP_H - 1.1, 160, 1.1).fill({ color: MORTAR, alpha: 0.16 });
  g.moveTo(-80, CAP_H).lineTo(80, CAP_H).stroke({ width: 0.45, color: INK, alpha: 0.95 });
}

/** Brass corner guards mark the two grabbable ledges. */
function drawLedgeGuards(g: Graphics): void {
  for (const side of [-1, 1]) {
    const outer = 80 * side;
    const inner = 77.4 * side;
    const pts = [outer, 0, inner, 0, inner, 2.6, outer - side * 0.9, CAP_H, outer, CAP_H];
    g.poly(pts).fill(
      vGradient([
        [0, mix(BRASS, 0xffffff, 0.3)],
        [1, BRASS_DARK],
      ]),
    );
    g.poly(pts).stroke({ width: 0.4, color: INK, join: 'round' });
    g.circle((outer + inner) / 2, 1.5, 0.45).fill(BRASS_DARK);
    g.moveTo(inner, 0.25).lineTo(outer, 0.25).stroke({ width: 0.3, color: 0xfff2b8, alpha: 0.9 });
  }
}

function createMedallion(x: number, y: number) {
  const node = new Container({ label: 'planet-medallion' });
  node.position.set(x, -y);
  const plate = new Graphics();
  plate.circle(0, 0, 11.2).fill(
    vGradient([
      [0, STONE_LIGHT],
      [1, STONE_MID],
    ]),
  );
  plate.circle(0, 0, 11.2).stroke({ width: OUTLINE, color: INK });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const long = i % 6 === 0;
    const r0 = long ? 8.6 : 9.3;
    plate
      .moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      .lineTo(Math.cos(a) * 10.3, Math.sin(a) * 10.3)
      .stroke({ width: long ? 0.45 : 0.25, color: MORTAR, alpha: 0.6 });
  }
  plate.circle(0, 0, 8.1).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.45 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 0x2a6f9a },
        { offset: 1, color: 0x123552 },
      ],
      textureSpace: 'local',
    }),
  );
  plate.circle(0, 0, 8.1).stroke({ width: 0.4, color: INK });
  const glow = new Graphics().circle(0, 0, 7.8).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(140,255,140,0.75)' },
        { offset: 0.6, color: 'rgba(80,220,120,0.25)' },
        { offset: 1, color: 'rgba(60,200,120,0)' },
      ],
      textureSpace: 'local',
    }),
  );
  const tilt = -0.22;
  const ring = (g: Graphics, from: number, to: number) => {
    const path = () => {
      for (let i = 0; i <= 24; i++) {
        const t = from + ((to - from) * i) / 24;
        const ex = Math.cos(t) * 7;
        const ey = Math.sin(t) * 1.9;
        const px = ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const py = ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
    };
    path();
    g.stroke({ width: 1.45, color: INK, cap: 'round' });
    path();
    g.stroke({ width: 0.9, color: from === 0 ? PLANET_BLUE : PLANET_BLUE_DARK, cap: 'round' });
  };
  const back = new Graphics();
  ring(back, Math.PI, Math.PI * 2);
  const ball = new Graphics();
  ball.circle(0, 0, 3.9).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.62, y: 0.3 },
      innerRadius: 0,
      outerCenter: { x: 0.55, y: 0.42 },
      outerRadius: 0.62,
      colorStops: [
        { offset: 0, color: 0xa4ffa4 },
        { offset: 0.5, color: PLANET_GREEN },
        { offset: 1, color: PLANET_GREEN_DARK },
      ],
      textureSpace: 'local',
    }),
  );
  ball.circle(0, 0, 3.9).stroke({ width: 0.4, color: INK });
  ball.ellipse(1.3, -1.6, 1.3, 0.7).fill({ color: 0xffffff, alpha: 0.55 });
  const front = new Graphics();
  ring(front, 0, Math.PI);
  node.addChild(plate, glow, back, ball, front);
  return {
    node,
    update(frame: number) {
      glow.alpha = 0.55 + 0.35 * Math.sin(frame * 0.035);
    },
  };
}

function createGem(x: number, y: number, color: number, dark: number, offset: number) {
  const node = new Container({ label: 'gem' });
  node.position.set(x, -y);
  const g = new Graphics();
  const socket = (r: number) => [0, -r, r, 0, 0, r, -r, 0];
  g.poly(socket(4.6)).fill(
    vGradient([
      [0, STONE_LIGHT],
      [1, STONE_MID],
    ]),
  );
  g.poly(socket(4.6)).stroke({ width: 0.45, color: INK, join: 'round' });
  g.poly(socket(3.5)).fill(0x2f2a1a);
  g.ellipse(0, 0.2, 2.6, 2.4).fill({ color, alpha: 0.25 });
  diamond(g, 0, 0, 2.3, color, dark, INK, 0.3);
  const glint = new Graphics();
  sparkle(glint, 0, 0, 1.6, 0xffffff);
  glint.position.set(0.9, -1.1);
  node.addChild(g, glint);
  return {
    node,
    update(frame: number) {
      const t = (frame + offset) % 210;
      const k = t < 26 ? Math.sin((Math.PI * t) / 26) : 0;
      glint.alpha = k;
      glint.scale.set(0.4 + 0.8 * k);
      glint.rotation = t * 0.04;
    },
  };
}

function leaf(g: Graphics, x: number, y: number, angle: number, size: number, color = MOSS): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const p = (u: number, v: number) => [x + u * c - v * s, y + u * s + v * c];
  const pts = [
    ...p(0, 0),
    ...p(size * 0.3, -size * 0.3),
    ...p(size * 0.7, -size * 0.24),
    ...p(size, 0),
    ...p(size * 0.62, size * 0.28),
    ...p(size * 0.25, size * 0.26),
  ];
  g.poly(pts).fill(color);
  g.poly(pts).stroke({ width: 0.18, color: MOSS_DARK, join: 'round' });
  g.moveTo(...(p(size * 0.1, 0) as [number, number]))
    .lineTo(...(p(size * 0.75, 0) as [number, number]))
    .stroke({ width: 0.12, color: MOSS_DARK, alpha: 0.7 });
}

function createVine(x: number, y: number, len: number, phase: number, seed: number) {
  const node = new Graphics({ label: 'vine' });
  node.position.set(x, -y);
  const bend = (hash01(seed + 40) - 0.5) * 2.4;
  node.moveTo(0, -0.3).quadraticCurveTo(bend, len * 0.5, bend * 0.4, len);
  node.stroke({ width: 0.42, color: VINE, cap: 'round' });
  const leaves = Math.max(2, Math.round(len / 2.4));
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 0.3);
    const vx = 2 * (1 - t) * t * bend + t * t * bend * 0.4;
    const vy = 2 * (1 - t) * t * len * 0.5 + t * t * len - 0.3 * (1 - t) * (1 - t);
    const side = i % 2 === 0 ? 1 : -1;
    leaf(node, vx, vy, side > 0 ? 0.5 : Math.PI - 0.5, 1.5 + hash01(seed * 5 + i) * 0.6);
  }
  node.circle(bend * 0.4, len, 0.35).fill(MOSS_DARK);
  return {
    node,
    update(frame: number) {
      node.rotation = 0.05 * Math.sin(frame * 0.028 + phase);
    },
  };
}
