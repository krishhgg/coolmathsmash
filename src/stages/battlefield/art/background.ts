import { Container, FillGradient, Graphics } from 'pixi.js';
import {
  CLOUD,
  CLOUD_SHADE,
  GEM_BLUE,
  GEM_RED,
  MOSS,
  MOSS_DARK,
  MOSS_LIGHT,
  PLANET_BLUE,
  PLANET_BLUE_DARK,
  PLANET_GREEN,
  PLANET_GREEN_DARK,
  SEA_DEEP,
  SEA_TOP,
  SKY_HIGH,
  SKY_HORIZON,
  SKY_LOW,
  SKY_TOP,
  STONE,
  STONE_DARK,
  STONE_LIGHT,
} from './palette';
import { layerTransform, SEA_LAYER, VIEW_H, VIEW_W, wrap, type StageCamera } from './parallax';
import { cloud, hash01, mix, sparkle, vGradient } from './util';

/** Air colour distant things fade into. */
const HAZE = 0xb4e1fb;

const HORIZON_Y = SEA_LAYER.horizon;
const WIDE_LEFT = SEA_LAYER.left;
const WIDE_RIGHT = SEA_LAYER.right;
const SEA_BOTTOM = SEA_LAYER.bottom;

interface Layer {
  depth: number;
  node: Container;
  tick?(frame: number): void;
}

export interface Background {
  container: Container;
  update(frame: number, camera: StageCamera): void;
}

const haze = (color: number, t: number) => mix(color, HAZE, t);

export function createBackground(): Background {
  const container = new Container({ label: 'battlefield-background' });
  const layers: Layer[] = [
    sky(),
    planet(),
    sparkles(),
    highClouds(),
    mountains(),
    farIslands(),
    cloudSea(),
    lowClouds(),
    midIslands(),
    nearClouds(),
  ];
  for (const l of layers) {
    l.node.pivot.set(VIEW_W / 2, VIEW_H / 2);
    container.addChild(l.node);
  }
  return {
    container,
    update(frame, camera) {
      for (const l of layers) {
        const t = layerTransform(l.depth, camera);
        l.node.position.set(t.x, t.y);
        l.node.scale.set(t.scale);
        l.tick?.(frame);
      }
    },
  };
}

function sky(): Layer {
  const g = new Graphics({ label: 'sky' });
  g.rect(0, 0, VIEW_W, VIEW_H).fill(
    vGradient([
      [0, SKY_TOP],
      [0.28, SKY_HIGH],
      [0.42, SKY_LOW],
      [0.52, SKY_HORIZON],
      [1, SKY_HORIZON],
    ]),
  );
  return { depth: 0, node: g };
}

/** The Coolmath Games planet (green world, blue ring) hanging in the sky, with slow Flash-style sun rays. */
function planet(): Layer {
  const node = new Container({ label: 'planet' });
  const cx = 1020;
  const cy = 132;
  const rays = new Graphics();
  const count = 18;
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + (Math.PI / count) * 0.9;
    rays
      .poly([0, 0, Math.cos(a0) * 1500, Math.sin(a0) * 1500, Math.cos(a1) * 1500, Math.sin(a1) * 1500])
      .fill({
        color: 0xffffff,
        alpha: 0.055,
      });
  }
  rays.position.set(cx, cy);
  const glow = new Graphics().circle(cx, cy, 190).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,0.4)' },
        { offset: 0.45, color: 'rgba(230,255,240,0.16)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
      textureSpace: 'local',
    }),
  );
  const h = 0.36;
  const ringColor = haze(PLANET_BLUE, h);
  const ringDark = haze(PLANET_BLUE_DARK, h);
  const ringInk = haze(0x16406e, h);
  const tilt = -0.2;
  const rx = 168;
  const ry = 34;
  const ringPath = (g: Graphics, from: number, to: number, scale = 1) => {
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const ex = Math.cos(t) * rx * scale;
      const ey = Math.sin(t) * ry * scale;
      const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
      const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  };
  const ring = (g: Graphics, from: number, to: number) => {
    ringPath(g, from, to);
    g.stroke({ width: 22, color: ringInk, cap: 'round' });
    ringPath(g, from, to);
    g.stroke({ width: 17, color: ringColor, cap: 'round' });
    ringPath(g, from, to, 1.02);
    g.stroke({ width: 4, color: mix(ringColor, 0xffffff, 0.45), cap: 'round' });
    ringPath(g, from, to, 0.97);
    g.stroke({ width: 3, color: ringDark, cap: 'round' });
  };
  const back = new Graphics();
  ring(back, Math.PI, Math.PI * 2);
  const ball = new Graphics();
  const r = 84;
  ball.circle(cx, cy, r + 3).fill(haze(0x135a2a, h));
  ball.circle(cx, cy, r).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.36, y: 0.32 },
      innerRadius: 0,
      outerCenter: { x: 0.45, y: 0.42 },
      outerRadius: 0.62,
      colorStops: [
        { offset: 0, color: haze(0x9af59a, h) },
        { offset: 0.45, color: haze(PLANET_GREEN, h) },
        { offset: 1, color: haze(PLANET_GREEN_DARK, h) },
      ],
      textureSpace: 'local',
    }),
  );
  ball.ellipse(cx - 30, cy - 38, 30, 16).fill({ color: 0xffffff, alpha: 0.28 });
  for (const [dx, dy, w] of [
    [-20, 18, 40],
    [26, -8, 30],
    [8, 44, 34],
  ] as const) {
    ball
      .ellipse(cx + dx, cy + dy, w, w * 0.32)
      .fill({ color: haze(PLANET_GREEN_DARK, h + 0.1), alpha: 0.35 });
  }
  const front = new Graphics();
  ring(front, 0, Math.PI);
  node.addChild(rays, glow, back, ball, front);
  return {
    depth: 0.02,
    node,
    tick(frame) {
      rays.rotation = frame * 0.0005;
    },
  };
}

function sparkles(): Layer {
  const node = new Container({ label: 'sparkles' });
  const stars: Graphics[] = [];
  const spots = [
    [90, 70],
    [260, 40],
    [420, 120],
    [560, 54],
    [700, 150],
    [800, 34],
    [1220, 60],
    [1180, 250],
    [130, 200],
    [880, 230],
  ] as const;
  spots.forEach(([x, y], i) => {
    const s = new Graphics();
    const size = 3.5 + hash01(i + 3) * 3.5;
    if (i % 3 === 0) sparkle(s, 0, 0, size, 0xffffff);
    else
      s.rect(-size, -size * 0.22, size * 2, size * 0.44)
        .rect(-size * 0.22, -size, size * 0.44, size * 2)
        .fill(0xffffff);
    s.position.set(x, y);
    stars.push(s);
    node.addChild(s);
  });
  return {
    depth: 0.03,
    node,
    tick(frame) {
      stars.forEach((s, i) => {
        const tw = 0.5 + 0.5 * Math.sin(frame * 0.045 + i * 1.7);
        s.alpha = 0.12 + 0.38 * tw * tw;
        s.rotation = i % 3 === 0 ? 0 : Math.PI / 4;
      });
    },
  };
}

function highClouds(): Layer {
  const node = new Container({ label: 'high-clouds' });
  const specs = [
    { x: 110, y: 96, w: 230, h: 56, speed: 0.05 },
    { x: 610, y: 48, w: 170, h: 40, speed: 0.035 },
    { x: 1280, y: 210, w: 200, h: 48, speed: 0.06 },
    { x: 1750, y: 120, w: 240, h: 58, speed: 0.045 },
  ];
  const clouds = specs.map((s, i) => {
    const g = new Graphics();
    cloud(g, 0, 0, s.w, s.h, mix(CLOUD, SKY_HIGH, 0.12), mix(CLOUD_SHADE, SKY_HIGH, 0.3), i + 11);
    node.addChild(g);
    return g;
  });
  return {
    depth: 0.04,
    node,
    tick(frame) {
      specs.forEach((s, i) => clouds[i]!.position.set(wrap(s.x + frame * s.speed, -500, 2300), s.y));
    },
  };
}

function hillPath(g: Graphics, left: number, right: number, base: number, heights: number[]): void {
  const step = (right - left) / (heights.length - 1);
  const pt = (i: number) => [left + i * step, base - heights[i]!] as const;
  const [x0, y0] = pt(0);
  g.moveTo(x0, y0);
  for (let i = 1; i < heights.length - 1; i++) {
    const [cx, cy] = pt(i);
    const [nx, ny] = pt(i + 1);
    g.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
  }
  const [lx, ly] = pt(heights.length - 1);
  g.lineTo(lx, ly);
}

function hills(color: number, rim: number, base: number, amp: number, floor: number, seed: number): Graphics {
  const g = new Graphics();
  const count = 34;
  const heights = Array.from({ length: count }, (_, i) => floor + amp * hash01(seed * 97 + i) ** 1.6);
  hillPath(g, WIDE_LEFT, WIDE_RIGHT, base, heights);
  g.lineTo(WIDE_RIGHT, SEA_BOTTOM).lineTo(WIDE_LEFT, SEA_BOTTOM).closePath().fill(color);
  hillPath(g, WIDE_LEFT, WIDE_RIGHT, base, heights);
  g.stroke({ width: 3, color: rim, alpha: 0.7 });
  return g;
}

function mountains(): Layer {
  const node = new Container({ label: 'mountains' });
  node.addChild(
    hills(0x8fc0e8, 0xcfe9fb, HORIZON_Y - 8, 92, 14, 4),
    hills(0x79b2d6, 0xbfe2f3, HORIZON_Y + 2, 52, 8, 9),
  );
  return { depth: 0.06, node };
}

/** Flash-style floating rock: grass cap, tapering temple-stone underside, cel shade on the right. */
function floatingIsland(
  g: Graphics,
  cx: number,
  top: number,
  w: number,
  depth: number,
  h: number,
  seed: number,
): void {
  const half = w / 2;
  const right = [
    [1, 0],
    [0.97, 0.14],
    [0.82, 0.3],
    [0.74, 0.44],
    [0.52, 0.62],
    [0.38, 0.78],
    [0.15, 0.93],
    [0.03, 1],
  ];
  const left = [
    [-0.12, 0.96],
    [-0.3, 0.83],
    [-0.5, 0.68],
    [-0.64, 0.5],
    [-0.86, 0.3],
    [-0.95, 0.15],
    [-1, 0],
  ];
  const jitter = (i: number) => 1 + (hash01(seed * 13 + i) - 0.5) * 0.12;
  const toXY = ([u, v]: number[], i: number) => [cx + u! * half * jitter(i), top + v! * depth];
  const body = [...right.map(toXY), ...left.map((p, i) => toXY(p, i + 20))].flat();
  const ink = haze(0x3a2f1a, h);
  g.poly(body).fill(
    vGradient([
      [0, haze(STONE_LIGHT, h)],
      [0.35, haze(STONE, h)],
      [1, haze(STONE_DARK, h)],
    ]),
  );
  const shade = [...right.map(toXY), ...right.map(([u, v], i) => toXY([u! * 0.45, v!], i)).reverse()].flat();
  g.poly(shade).fill({ color: haze(0x4c4124, h), alpha: 0.3 });
  for (let k = 1; k <= 3; k++) {
    const y = top + depth * k * 0.22;
    const span = half * (1 - k * 0.22) * 0.8;
    g.moveTo(cx - span, y).quadraticCurveTo(cx, y + depth * 0.05, cx + span, y - depth * 0.02);
    g.stroke({ width: 1.5, color: ink, alpha: 0.35 });
  }
  g.poly(body).stroke({ width: 2, color: ink, alpha: 0.85, join: 'round' });
  const grassTop = top - 6;
  const grass: number[] = [cx - half - 5, grassTop, cx + half + 5, grassTop];
  const drips = Math.max(4, Math.round(w / 26));
  for (let i = drips; i >= 0; i--) {
    const x = cx - half - 5 + ((w + 10) * i) / drips;
    const dy = 7 + 9 * hash01(seed * 7 + i);
    grass.push(x, top + (i % 2 === 0 ? dy : 4));
  }
  g.poly(grass).fill(haze(MOSS, h));
  g.poly(grass).stroke({ width: 2, color: haze(MOSS_DARK, h), alpha: 0.9, join: 'round' });
  g.moveTo(cx - half - 2, grassTop + 2)
    .lineTo(cx + half + 2, grassTop + 2)
    .stroke({ width: 2.5, color: haze(MOSS_LIGHT, h), alpha: 0.8 });
}

/** Animated Flash waterfall: pale column with streaks scrolling down, redrawn from the frame number. */
function waterfall(x: number, top: number, bottom: number, w: number, h: number) {
  const base = new Graphics();
  base.rect(x - w / 2, top, w, bottom - top).fill(
    vGradient([
      [0, haze(0xe9f8ff, h)],
      [1, haze(0xbfe4fb, h)],
    ]),
  );
  base.rect(x - w / 2, top, 2, bottom - top).fill({ color: haze(0x7fb8de, h), alpha: 0.7 });
  base.rect(x + w / 2 - 2, top, 2, bottom - top).fill({ color: haze(0x7fb8de, h), alpha: 0.7 });
  cloud(base, x, bottom + 6, w * 2.6, w * 1.1, haze(0xffffff, h), haze(0xd2ecfb, h), Math.round(x));
  const streaks = new Graphics();
  const spacing = 26;
  return {
    nodes: [base, streaks],
    tick: (frame: number) => {
      streaks.clear();
      const offset = (frame * 1.6) % spacing;
      for (let y = top - spacing + offset; y < bottom - 10; y += spacing) {
        for (let i = 0; i < 3; i++) {
          const sx = x - w / 2 + 3 + ((i + 0.5) * (w - 6)) / 3;
          const sy = y + ((i * 9) % spacing);
          if (sy < top || sy > bottom - 14) continue;
          streaks.roundRect(sx - 1, sy, 2, 12, 1).fill({ color: haze(0x8ccbf0, h), alpha: 0.8 });
        }
      }
    },
  };
}

function piArch(g: Graphics, x: number, y: number, s: number, h: number): void {
  const ink = haze(0x3a2f1a, h);
  const stone = haze(STONE_LIGHT, h);
  const dark = haze(STONE, h);
  const shape = (pts: number[]) => {
    g.poly(pts.map((v, i) => (i % 2 === 0 ? x + v * s : y + v * s))).fill(stone);
    g.poly(pts.map((v, i) => (i % 2 === 0 ? x + v * s : y + v * s))).stroke({
      width: 1.5,
      color: ink,
      join: 'round',
    });
  };
  shape([-15, -22, -10, -22, -10, 0, -15, 0]);
  shape([6, -22, 11, -22, 10, -6, 13, -2, 16, -1, 15, 1, 9, 0, 6, -4]);
  shape([-19, -27, 19, -27, 19, -22, -15, -22, -17, -19, -20, -21]);
  g.rect(x + 2 * s, y - 26 * s, 6 * s, 1.5 * s).fill({ color: dark, alpha: 0.7 });
}

function columns(g: Graphics, x: number, y: number, s: number, h: number): void {
  const ink = haze(0x3a2f1a, h);
  const stone = haze(STONE_LIGHT, h);
  for (const [dx, tall] of [
    [-14, 26],
    [0, 16],
    [14, 22],
  ] as const) {
    const left = x + (dx - 3.5) * s;
    g.rect(left, y - tall * s, 7 * s, tall * s).fill(stone);
    g.rect(left - 1.5 * s, y - tall * s - 2.5 * s, 10 * s, 2.5 * s).fill(stone);
    g.rect(left, y - tall * s, 7 * s, tall * s).stroke({ width: 1.2, color: ink });
    g.rect(left - 1.5 * s, y - tall * s - 2.5 * s, 10 * s, 2.5 * s).stroke({ width: 1.2, color: ink });
    g.moveTo(left + 3.5 * s, y - tall * s + 2 * s)
      .lineTo(left + 3.5 * s, y - 2 * s)
      .stroke({ width: 1, color: ink, alpha: 0.4 });
  }
}

function farIslands(): Layer {
  const node = new Container({ label: 'far-islands' });
  const h = 0.55;
  const specs = [
    { x: 160, top: 262, w: 150, depth: 90, seed: 1, deco: 'pi', fall: true },
    { x: 1150, top: 292, w: 120, depth: 70, seed: 2, deco: 'columns', fall: false },
    { x: 430, top: 150, w: 78, depth: 50, seed: 3, deco: 'tree', fall: false },
  ] as const;
  const bobbers: { node: Container; phase: number }[] = [];
  const ticks: ((frame: number) => void)[] = [];
  specs.forEach((s, i) => {
    const holder = new Container();
    if (s.fall) {
      const wf = waterfall(s.x + s.w * 0.22, s.top + 4, HORIZON_Y + 10, 12, h);
      holder.addChild(...wf.nodes);
      ticks.push(wf.tick);
    }
    const g = new Graphics();
    floatingIsland(g, s.x, s.top, s.w, s.depth, h, s.seed);
    if (s.deco === 'pi') piArch(g, s.x - 18, s.top - 5, 1.25, h);
    if (s.deco === 'columns') columns(g, s.x + 6, s.top - 5, 1, h);
    if (s.deco === 'tree') tree(g, s.x - 6, s.top - 4, 0.55, h);
    holder.addChild(g);
    node.addChild(holder);
    bobbers.push({ node: holder, phase: i * 2.1 });
  });
  return {
    depth: 0.1,
    node,
    tick(frame) {
      for (const b of bobbers) b.node.y = Math.sin(frame * 0.01 + b.phase) * 3;
      for (const t of ticks) t(frame);
    },
  };
}

function cloudSea(): Layer {
  const g = new Graphics({ label: 'cloud-sea' });
  const fillTop = HORIZON_Y + 10;
  g.rect(WIDE_LEFT, fillTop, WIDE_RIGHT - WIDE_LEFT, SEA_BOTTOM - fillTop).fill(
    vGradient([
      [0, SEA_TOP],
      [0.025, mix(SEA_TOP, SEA_DEEP, 0.45)],
      [0.08, SEA_DEEP],
      [1, mix(SEA_DEEP, 0x4f86c0, 0.6)],
    ]),
  );
  let i = 0;
  for (let x = WIDE_LEFT; x <= WIDE_RIGHT; x += 230) {
    const w = 300 + hash01(41 + i) * 160;
    const ch = 26 + hash01(17 + i) * 18;
    cloud(g, x, fillTop + 4, w, ch, SEA_TOP, mix(SEA_TOP, SEA_DEEP, 0.38), 100 + i);
    i++;
  }
  return { depth: SEA_LAYER.depth, node: g };
}

/** Loose cloud banks drifting below the island, low contrast so the playfield stays calm. */
function lowClouds(): Layer {
  const node = new Container({ label: 'low-clouds' });
  const body = mix(SEA_TOP, SEA_DEEP, 0.3);
  const shade = mix(SEA_TOP, SEA_DEEP, 0.75);
  const specs = [
    { x: -200, y: 560, w: 380, h: 50, speed: 0.1 },
    { x: 420, y: 610, w: 460, h: 58, speed: 0.08 },
    { x: 1080, y: 575, w: 400, h: 52, speed: 0.12 },
    { x: 1700, y: 630, w: 520, h: 60, speed: 0.09 },
  ];
  const clouds = specs.map((s, i) => {
    const g = new Graphics();
    cloud(g, 0, 0, s.w, s.h, body, shade, i + 51);
    node.addChild(g);
    return g;
  });
  return {
    depth: 0.2,
    node,
    tick(frame) {
      specs.forEach((s, i) => clouds[i]!.position.set(wrap(s.x + frame * s.speed, -800, 2900), s.y));
    },
  };
}

function tree(g: Graphics, x: number, y: number, s: number, h: number): void {
  const ink = haze(0x23401a, h);
  g.poly([x - 4 * s, y, x - 2.5 * s, y - 34 * s, x + 2.5 * s, y - 34 * s, x + 5 * s, y]).fill(
    haze(0x7a5531, h),
  );
  g.poly([x - 4 * s, y, x - 2.5 * s, y - 34 * s, x + 2.5 * s, y - 34 * s, x + 5 * s, y]).stroke({
    width: 1.5,
    color: ink,
  });
  const blobs = [
    [-16, -40, 17],
    [14, -42, 16],
    [0, -56, 20],
    [-6, -34, 14],
    [10, -30, 13],
  ] as const;
  for (const [dx, dy, r] of blobs) g.circle(x + dx * s, y + dy * s, (r + 2) * s).fill(ink);
  for (const [dx, dy, r] of blobs) g.circle(x + dx * s, y + dy * s, r * s).fill(haze(MOSS_DARK, h));
  for (const [dx, dy, r] of blobs)
    g.circle(x + (dx - 3) * s, y + (dy - 4) * s, r * 0.72 * s).fill(haze(MOSS, h));
  for (const [dx, dy, r] of blobs)
    g.circle(x + (dx - 6) * s, y + (dy - 7) * s, r * 0.3 * s).fill(haze(MOSS_LIGHT, h));
}

/** Fireboy & Watergirl's exit doors (red with the Mars sign, blue with the Venus sign) set in a temple block. */
function templeDoors(g: Graphics, x: number, y: number, h: number): void {
  const ink = haze(0x2b2414, h);
  const wall = haze(0x6f6a3a, h);
  g.poly([
    x - 58,
    y,
    x - 58,
    y - 52,
    x - 46,
    y - 52,
    x - 46,
    y - 62,
    x + 46,
    y - 62,
    x + 46,
    y - 52,
    x + 58,
    y - 52,
    x + 58,
    y,
  ]).fill(wall);
  for (let row = 0; row < 5; row++) {
    const yy = y - 10 - row * 10;
    g.moveTo(x - 56, yy)
      .lineTo(x + 56, yy)
      .stroke({ width: 1, color: ink, alpha: 0.35 });
  }
  g.poly([
    x - 58,
    y,
    x - 58,
    y - 52,
    x - 46,
    y - 52,
    x - 46,
    y - 62,
    x + 46,
    y - 62,
    x + 46,
    y - 52,
    x + 58,
    y - 52,
    x + 58,
    y,
  ]).stroke({
    width: 2,
    color: ink,
    join: 'round',
  });
  const door = (dx: number, color: number, venus: boolean) => {
    const left = x + dx - 15;
    g.rect(left - 3, y - 46, 36, 46).fill(haze(0x9a8f58, h));
    g.rect(left - 3, y - 46, 36, 46).stroke({ width: 1.5, color: ink });
    g.rect(left, y - 42, 30, 42).fill(haze(color, h));
    g.rect(left, y - 42, 30, 42).stroke({ width: 1.5, color: ink });
    const sx = left + 15;
    const sy = y - 24;
    const sym = haze(0xffe9c8, h);
    g.circle(sx, sy, 6.5).stroke({ width: 3, color: sym });
    if (venus) {
      g.moveTo(sx, sy + 6.5)
        .lineTo(sx, sy + 15)
        .stroke({ width: 3, color: sym });
      g.moveTo(sx - 4, sy + 11)
        .lineTo(sx + 4, sy + 11)
        .stroke({ width: 3, color: sym });
    } else {
      g.moveTo(sx + 4.5, sy - 4.5)
        .lineTo(sx + 11, sy - 11)
        .stroke({ width: 3, color: sym });
      g.moveTo(sx + 5, sy - 11)
        .lineTo(sx + 11, sy - 11)
        .lineTo(sx + 11, sy - 5)
        .stroke({ width: 3, color: sym, join: 'miter' });
    }
  };
  door(-20, mix(GEM_RED, 0x7a2a18, 0.35), false);
  door(20, mix(GEM_BLUE, 0x1a4a7a, 0.35), true);
}

function midIslands(): Layer {
  const node = new Container({ label: 'mid-islands' });
  const h = 0.3;
  const leftFall = waterfall(150, 520, 760, 16, h);
  const rightFall = waterfall(1150, 470, 760, 14, h);
  const left = new Container();
  const right = new Container();
  const gl = new Graphics();
  floatingIsland(gl, 30, 512, 300, 150, h, 7);
  tree(gl, -40, 508, 1, h);
  tree(gl, 70, 508, 0.7, h);
  left.addChild(...leftFall.nodes, gl);
  const gr = new Graphics();
  floatingIsland(gr, 1250, 470, 270, 130, h, 8);
  templeDoors(gr, 1255, 466, h);
  right.addChild(...rightFall.nodes, gr);
  node.addChild(left, right);
  return {
    depth: 0.3,
    node,
    tick(frame) {
      left.y = Math.sin(frame * 0.012) * 4;
      right.y = Math.sin(frame * 0.012 + 2.4) * 4;
      leftFall.tick(frame);
      rightFall.tick(frame);
    },
  };
}

function nearClouds(): Layer {
  const node = new Container({ label: 'near-clouds' });
  const specs = [
    { x: 200, y: 716, w: 460, h: 70, speed: 0.22 },
    { x: 980, y: 740, w: 560, h: 78, speed: 0.18 },
    { x: 1700, y: 722, w: 500, h: 74, speed: 0.2 },
  ];
  const clouds = specs.map((s, i) => {
    const g = new Graphics();
    cloud(g, 0, 0, s.w, s.h, mix(SEA_TOP, SEA_DEEP, 0.15), mix(SEA_TOP, SEA_DEEP, 0.6), i + 71);
    node.addChild(g);
    return g;
  });
  return {
    depth: 0.5,
    node,
    tick(frame) {
      specs.forEach((s, i) => clouds[i]!.position.set(wrap(s.x - frame * s.speed, -700, 2700), s.y));
    },
  };
}
