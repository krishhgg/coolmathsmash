import { Container, FillGradient, Graphics } from 'pixi.js';
import { CAP_BOTTOM, MAIN_HULL, hullHalfWidth } from './outline';
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
import { diamond, flipY, hash01, mix, sparkle, vGradient, type Point } from './util';

const BOTTOM = -40.1;
const OUTLINE = 0.55;

export interface IslandArt {
  container: Container;
  update(frame: number): void;
}

/**
 * The main platform in game units: a Forest Temple sandstone cap (the walkable top at y = 0, walls down to
 * y = -8.3) on a tapered brick underside carrying the Coolmath planet medallion and Fireboy & Watergirl's gems.
 */
export function createIsland(): IslandArt {
  const container = new Container({ label: 'main-platform' });
  const body = new Graphics();
  drawUnderside(body);
  drawCap(body);
  body.poly(flipY(MAIN_HULL)).stroke({ width: OUTLINE, color: INK, join: 'round' });
  drawLedgeGuards(body);

  const medallion = createMedallion(0, -24.4);
  const gems = [
    createGem(-57, -17.6, GEM_RED, GEM_RED_DARK, 0),
    createGem(57, -17.6, GEM_BLUE, GEM_BLUE_DARK, 97),
  ];
  const vines = (
    [
      [-74.5, -14.2, 10, 0],
      [-52.9, -32.6, 7.5, 1.3],
      [-27, BOTTOM, 6, 2.1],
      [17, BOTTOM, 11, 0.7],
      [57.5, -29.6, 7, 2.9],
      [70.6, -18.4, 12, 1.8],
    ] as const
  ).map(([x, y, len, phase], i) => createVine(x, y, len, phase, i));

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
  g.poly(flipY(MAIN_HULL.slice(2))).fill(
    vGradient([
      [0, BRICK_TOP],
      [1, BRICK_BOTTOM],
    ]),
  );
  const course = 4;
  for (let k = 0; CAP_BOTTOM - k * course > BOTTOM + 0.01; k++) {
    const top = CAP_BOTTOM - k * course;
    const bottom = Math.max(top - course, BOTTOM);
    const inner = hullHalfWidth(bottom) - 0.6;
    const brick = 9;
    const offset = k % 2 === 0 ? 0 : brick / 2;
    let prev = -inner;
    for (let x = -90 + offset; x <= inner + brick; x += brick) {
      const joint = Math.min(x, inner);
      if (joint <= prev) continue;
      const shadeT = hash01(k * 53 + Math.round(x * 10));
      if (shadeT > 0.55)
        g.rect(prev, -top, joint - prev, top - bottom).fill({
          color: shadeT > 0.8 ? 0xffffff : MORTAR,
          alpha: shadeT > 0.8 ? 0.07 : 0.1,
        });
      if (x < inner) g.moveTo(x, -top).lineTo(x, -bottom).stroke({ width: 0.28, color: MORTAR, alpha: 0.55 });
      prev = joint;
    }
    if (bottom > BOTTOM + 0.01) {
      const w = hullHalfWidth(bottom);
      g.moveTo(-w, -bottom).lineTo(w, -bottom).stroke({ width: 0.3, color: MORTAR, alpha: 0.6 });
      g.moveTo(-w + 0.4, -bottom + 0.35)
        .lineTo(w - 0.4, -bottom + 0.35)
        .stroke({ width: 0.25, color: STONE_LIGHT, alpha: 0.18 });
    }
  }
  g.poly(
    flipY([
      [26, CAP_BOTTOM],
      [80, CAP_BOTTOM],
      [64.4, -25.1],
      [41.4, BOTTOM],
      [12, BOTTOM],
    ]),
  ).fill({
    color: MORTAR,
    alpha: 0.2,
  });
  g.moveTo(-78.8, 9.4)
    .lineTo(-63.6, 25.6)
    .lineTo(-40.8, 39.3)
    .stroke({ width: 0.7, color: STONE_LIGHT, alpha: 0.35, join: 'round' });
  const lip = hullHalfWidth(CAP_BOTTOM - 1.8);
  g.poly([-80, -CAP_BOTTOM, 80, -CAP_BOTTOM, lip, -CAP_BOTTOM + 1.8, -lip, -CAP_BOTTOM + 1.8]).fill(
    vGradient([
      [0, 'rgba(40,33,18,0.45)'],
      [1, 'rgba(40,33,18,0)'],
    ]),
  );
  for (const [x, w, seed] of [
    [-68, 7, 1],
    [-36, 10, 2],
    [4, 8, 3],
    [37, 11, 4],
    [66, 7, 5],
  ] as const)
    mossDrip(g, x, w, seed);
}

function mossDrip(g: Graphics, x: number, w: number, seed: number): void {
  const pts: number[] = [x - w / 2, -CAP_BOTTOM - 0.4, x + w / 2, -CAP_BOTTOM - 0.4];
  const n = 4;
  for (let i = n; i >= 0; i--) {
    const px = x - w / 2 + (w * i) / n;
    const drop = i % 2 === 1 ? 1.4 + 1.8 * hash01(seed * 9 + i) : 0.5;
    pts.push(px, -CAP_BOTTOM + drop);
  }
  g.poly(pts).fill(MOSS);
  g.poly(pts).stroke({ width: 0.25, color: MOSS_DARK, join: 'round' });
  g.moveTo(x - w / 2 + 0.6, -CAP_BOTTOM + 0.3)
    .lineTo(x + w / 2 - 0.6, -CAP_BOTTOM + 0.3)
    .stroke({ width: 0.35, color: MOSS_LIGHT, alpha: 0.9 });
}

type Stroke = readonly (readonly [number, number])[];
const GLYPHS: Record<string, { lines: Stroke[]; dots?: Point[] }> = {
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
  const capH = -CAP_BOTTOM;
  g.rect(-80, 0, 160, capH).fill(
    vGradient([
      [0, STONE_LIGHT],
      [1, STONE],
    ]),
  );
  g.rect(-80, 0, 160, 1).fill(STONE_HIGHLIGHT);
  g.moveTo(-80, 1).lineTo(80, 1).stroke({ width: 0.22, color: STONE_DARK, alpha: 0.6 });
  for (const y of [2.3, 7]) {
    g.moveTo(-77.5, y).lineTo(77.5, y).stroke({ width: 0.25, color: MORTAR, alpha: 0.35 });
    g.moveTo(-77.5, y + 0.22)
      .lineTo(77.5, y + 0.22)
      .stroke({ width: 0.2, color: STONE_HIGHLIGHT, alpha: 0.6 });
  }
  for (const x of [-70, -50, -30, -10, 10, 30, 50, 70]) {
    g.moveTo(x, 1).lineTo(x, capH).stroke({ width: 0.3, color: MORTAR, alpha: 0.5 });
    g.moveTo(x + 0.3, 1.2)
      .lineTo(x + 0.3, capH)
      .stroke({ width: 0.2, color: STONE_HIGHLIGHT, alpha: 0.45 });
  }
  const frieze = ['+', '×', '÷', 'π', '÷', '×', '+'];
  frieze.forEach((glyph, i) => engrave(g, glyph, -60 + i * 20, 4.65, glyph === 'π' ? 1.45 : 1.25));
  for (const x of [-75, 75]) {
    g.circle(x, 4.65, 1.25).stroke({ width: 0.35, color: MORTAR, alpha: 0.5 });
    g.circle(x, 4.65, 0.35).fill({ color: MORTAR, alpha: 0.5 });
  }
  g.moveTo(-80, capH).lineTo(80, capH).stroke({ width: 0.4, color: INK, alpha: 0.9 });
}

/** Brass corner guards mark the two grabbable ledges. */
function drawLedgeGuards(g: Graphics): void {
  for (const side of [-1, 1]) {
    const outer = 80 * side;
    const inner = 77.4 * side;
    const pts = [outer, 0, inner, 0, inner, 2.6, outer - side * 0.9, 8.3, outer, 8.3];
    g.poly(pts).fill(
      vGradient([
        [0, mix(BRASS, 0xffffff, 0.3)],
        [1, BRASS_DARK],
      ]),
    );
    g.poly(pts).stroke({ width: 0.35, color: INK, join: 'round' });
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
      center: { x: 0.35, y: 0.3 },
      innerRadius: 0,
      outerCenter: { x: 0.45, y: 0.42 },
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
  ball.ellipse(-1.3, -1.6, 1.3, 0.7).fill({ color: 0xffffff, alpha: 0.55 });
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
  g.poly(socket(4.6)).stroke({ width: 0.4, color: INK, join: 'round' });
  g.poly(socket(3.5)).fill(0x2f2a1a);
  g.ellipse(0, 0.2, 2.6, 2.4).fill({ color, alpha: 0.25 });
  diamond(g, 0, 0, 2.3, color, dark, INK, 0.3);
  const glint = new Graphics();
  sparkle(glint, 0, 0, 1.6, 0xffffff);
  glint.position.set(-0.9, -1.1);
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

function leaf(g: Graphics, x: number, y: number, angle: number, size: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const p = (u: number, v: number) => [x + u * c - v * s, y + u * s + v * c];
  const pts = [...p(0, 0), ...p(size * 0.45, -size * 0.32), ...p(size, 0), ...p(size * 0.45, size * 0.32)];
  g.poly(pts).fill(MOSS);
  g.poly(pts).stroke({ width: 0.16, color: MOSS_DARK, join: 'round' });
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
    const vx = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * bend + t * t * bend * 0.4;
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
