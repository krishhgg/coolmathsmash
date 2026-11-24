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
  VINE,
} from './palette';
import { layerTransform, SEA_LAYER, VIEW_H, VIEW_W, wrap, type StageCamera } from './parallax';
import { FAR_ISLANDS, MID_ROCKS, type IslandSpec } from './scenery';
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
    midRocks(),
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
      [0.3, SKY_HIGH],
      [0.5, SKY_LOW],
      [0.68, SKY_HORIZON],
      [1, SKY_HORIZON],
    ]),
  );
  return { depth: 0, node: g };
}

/** The Coolmath Games planet (green world, blue ring) hanging in the sky, with slow Flash-style sun rays. */
function planet(): Layer {
  const node = new Container({ label: 'planet' });
  const cx = 1150;
  const cy = 92;
  const r = 56;
  const rays = new Graphics();
  const count = 18;
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + (Math.PI / count) * 0.9;
    rays
      .poly([0, 0, Math.cos(a0) * 1500, Math.sin(a0) * 1500, Math.cos(a1) * 1500, Math.sin(a1) * 1500])
      .fill({
        color: 0xffffff,
        alpha: 0.03,
      });
  }
  rays.position.set(cx, cy);
  const glow = new Graphics().circle(cx, cy, r * 2.2).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,0.3)' },
        { offset: 0.45, color: 'rgba(230,255,240,0.1)' },
        { offset: 1, color: 'rgba(255,255,255,0)' },
      ],
      textureSpace: 'local',
    }),
  );
  const h = 0.5;
  const ringColor = haze(PLANET_BLUE, h);
  const ringDark = haze(PLANET_BLUE_DARK, h);
  const ringInk = haze(0x16406e, h);
  const tilt = -0.2;
  const rx = r * 2;
  const ry = r * 0.41;
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
    g.stroke({ width: 15, color: ringInk, cap: 'round' });
    ringPath(g, from, to);
    g.stroke({ width: 11, color: ringColor, cap: 'round' });
    ringPath(g, from, to, 1.02);
    g.stroke({ width: 3, color: mix(ringColor, 0xffffff, 0.45), cap: 'round' });
    ringPath(g, from, to, 0.97);
    g.stroke({ width: 2, color: ringDark, cap: 'round' });
  };
  const back = new Graphics();
  ring(back, Math.PI, Math.PI * 2);
  const ball = new Graphics();
  ball.circle(cx, cy, r + 2.5).fill(haze(0x135a2a, h));
  ball.circle(cx, cy, r).fill(
    new FillGradient({
      type: 'radial',
      center: { x: 0.64, y: 0.32 },
      innerRadius: 0,
      outerCenter: { x: 0.55, y: 0.42 },
      outerRadius: 0.62,
      colorStops: [
        { offset: 0, color: haze(0x9af59a, h) },
        { offset: 0.45, color: haze(PLANET_GREEN, h) },
        { offset: 1, color: haze(PLANET_GREEN_DARK, h) },
      ],
      textureSpace: 'local',
    }),
  );
  ball.ellipse(cx + r * 0.3, cy - r * 0.45, r * 0.34, r * 0.18).fill({ color: 0xffffff, alpha: 0.28 });
  for (const [dx, dy, w] of [
    [-13, 12, 27],
    [17, -5, 20],
    [5, 29, 23],
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
    hills(0xa4cdec, 0xd3ebfa, HORIZON_Y - 8, 112, 22, 4),
    hills(0xa2cce6, 0xcae6f4, HORIZON_Y + 2, 62, 10, 9),
  );
  return { depth: 0.06, node };
}

/** Flash-style floating island: grass cap, tapering temple-stone underside, cel shade away from the sun, roots. */
function floatingIsland(g: Graphics, spec: IslandSpec): void {
  const { x: cx, top, w, depth, haze: h, seed } = spec;
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
  const jitter = (i: number) => 1 + (hash01(seed * 13 + i) - 0.5) * 0.16;
  const toXY = ([u, v]: number[], i: number) => [cx + u! * half * jitter(i), top + v! * depth];
  const body = [...right.map(toXY), ...left.map((p, i) => toXY(p, i + 20))].flat();
  const ink = haze(mix(0x3a2f1a, 0x506684, 0.35), h * 0.85);
  for (let i = 0; i < 4; i++) {
    const rx = cx + (hash01(seed * 5 + i) - 0.5) * half * 0.9;
    const ry = top + depth * (0.55 + 0.1 * i);
    const len = 14 + hash01(seed * 9 + i) * 22;
    g.moveTo(rx, ry)
      .quadraticCurveTo(rx + 5, ry + len * 0.5, rx - 2, ry + len)
      .stroke({ width: 1.5, color: haze(0x5a4326, h), cap: 'round' });
  }
  g.poly(body).fill(
    vGradient([
      [0, haze(STONE_LIGHT, h)],
      [0.35, haze(STONE, h)],
      [1, haze(STONE_DARK, h)],
    ]),
  );
  const shade = [
    ...left.map((p, i) => toXY(p, i + 20)),
    ...left.map(([u, v], i) => toXY([u! * 0.45, v!], i + 20)).reverse(),
  ].flat();
  g.poly(shade).fill({ color: haze(0x4c4124, h), alpha: 0.3 });
  for (let k = 1; k <= 3; k++) {
    const y = top + depth * k * 0.22;
    const span = half * (1 - k * 0.22) * 0.8;
    g.moveTo(cx - span, y).quadraticCurveTo(cx, y + depth * 0.05, cx + span, y - depth * 0.02);
    g.stroke({ width: 1.5, color: ink, alpha: 0.35 });
  }
  g.poly(body).stroke({ width: 2, color: ink, join: 'round' });
  const grassTop = top - 6;
  const grass: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    grass.push(cx - half - 5 + (w + 10) * u, grassTop - Math.sin(u * Math.PI) * 7);
  }
  const drips = Math.max(4, Math.round(w / 22));
  for (let i = drips; i >= 0; i--) {
    const x = cx - half - 5 + ((w + 10) * i) / drips;
    const dy = 6 + 10 * hash01(seed * 7 + i);
    grass.push(x, top + (i % 2 === 0 ? dy : 3 + 3 * hash01(seed + i)));
  }
  g.poly(grass).fill(haze(MOSS, h));
  g.poly(grass).stroke({ width: 2, color: haze(MOSS_DARK, h * 0.8), join: 'round' });
  g.moveTo(cx - half - 2, grassTop + 2)
    .quadraticCurveTo(cx, grassTop - 12, cx + half + 2, grassTop + 2)
    .stroke({ width: 2.5, color: haze(MOSS_LIGHT, h), alpha: 0.8 });
}

/** A broken chunk of temple drifting below the playfield: jagged top, a stub of brick wall, hanging vines. */
function floatingRock(g: Graphics, spec: IslandSpec): void {
  const { x: cx, top, w, depth, haze: h, seed } = spec;
  const half = w / 2;
  const ink = haze(0x3a2f1a, h * 0.7);
  const outline: number[] = [];
  const peaks = 6;
  for (let i = 0; i <= peaks; i++) {
    const u = i / peaks;
    const y = top + (i % 2 === 0 ? 10 + 8 * hash01(seed * 3 + i) : -4 - 12 * hash01(seed * 7 + i));
    outline.push(cx - half + w * u, i === 0 || i === peaks ? top + 16 : y);
  }
  const under = [
    [0.92, 0.3],
    [0.7, 0.55],
    [0.42, 0.8],
    [0.1, 1],
    [-0.2, 0.86],
    [-0.5, 0.62],
    [-0.8, 0.36],
  ];
  for (const [u, v] of under) outline.push(cx + u! * half, top + 16 + v! * depth);
  for (let i = 0; i < 3; i++) {
    const vx = cx + (i - 1) * half * 0.45;
    const vy = top + 16 + depth * (0.55 + 0.15 * (i % 2));
    const len = 24 + hash01(seed * 11 + i) * 30;
    g.moveTo(vx, vy)
      .quadraticCurveTo(vx + 6, vy + len * 0.5, vx + 1, vy + len)
      .stroke({ width: 2, color: haze(VINE, h), cap: 'round' });
  }
  g.poly(outline).fill(
    vGradient([
      [0, haze(STONE, h)],
      [1, haze(STONE_DARK, h)],
    ]),
  );
  for (let row = 0; row < 3; row++) {
    const y = top + 26 + row * 14;
    const span = half * (0.8 - row * 0.2);
    g.moveTo(cx - span, y)
      .lineTo(cx + span, y)
      .stroke({ width: 1.2, color: ink, alpha: 0.4 });
    for (let k = -2; k <= 2; k++) {
      const x = cx + k * 22 + (row % 2) * 11;
      if (Math.abs(x - cx) < span - 4)
        g.moveTo(x, y)
          .lineTo(x, y + 14)
          .stroke({ width: 1.2, color: ink, alpha: 0.35 });
    }
  }
  g.poly(outline).stroke({ width: 2, color: ink, join: 'round' });
  const wallX = cx - half * 0.35;
  g.rect(wallX, top - 22, 30, 26).fill(haze(STONE_LIGHT, h));
  g.rect(wallX + 30, top - 10, 16, 14).fill(haze(STONE_LIGHT, h));
  g.moveTo(wallX, top - 9)
    .lineTo(wallX + 30, top - 9)
    .stroke({ width: 1, color: ink, alpha: 0.5 });
  g.moveTo(wallX + 15, top - 22)
    .lineTo(wallX + 15, top - 9)
    .stroke({ width: 1, color: ink, alpha: 0.5 });
  g.poly([
    wallX,
    top + 4,
    wallX,
    top - 22,
    wallX + 30,
    top - 22,
    wallX + 30,
    top - 10,
    wallX + 46,
    top - 10,
    wallX + 46,
    top + 4,
  ]).stroke({
    width: 1.6,
    color: ink,
    join: 'round',
  });
  const tuftX = cx + half * 0.3;
  const tuftY = top + 6;
  for (let i = 0; i < 4; i++)
    g.circle(tuftX - 12 + i * 8, tuftY - (i % 2) * 3, 6 - (i % 3)).fill(haze(MOSS, h));
  for (let i = 0; i < 4; i++)
    g.circle(tuftX - 12 + i * 8, tuftY - (i % 2) * 3, 6 - (i % 3)).stroke({
      width: 1.2,
      color: haze(MOSS_DARK, h),
      alpha: 0.7,
    });
  g.moveTo(tuftX - 14, tuftY - 4)
    .quadraticCurveTo(tuftX, tuftY - 10, tuftX + 14, tuftY - 5)
    .stroke({ width: 1.6, color: haze(MOSS_LIGHT, h), alpha: 0.7, cap: 'round' });
}

const rgba = (color: number, alpha: number) =>
  `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

/**
 * Animated Flash waterfall: a pale column that fades out as it falls (so it never ends in mid-air when the camera
 * pulls back), with streaks scrolling down, redrawn from the frame number.
 */
function waterfall(x: number, top: number, w: number, h: number) {
  const length = 1100;
  const base = new Graphics();
  const water = haze(0xe4f5ff, h);
  const edge = haze(0x86bde2, h);
  base.rect(x - w / 2, top, w, length).fill(
    vGradient([
      [0, rgba(water, 1)],
      [0.25, rgba(water, 0.85)],
      [1, rgba(water, 0)],
    ]),
  );
  for (const ex of [x - w / 2, x + w / 2 - 2])
    base.rect(ex, top, 2, length * 0.6).fill(
      vGradient([
        [0, rgba(edge, 0.8)],
        [1, rgba(edge, 0)],
      ]),
    );
  const streaks = new Graphics();
  const spacing = 26;
  const reach = length * 0.45;
  return {
    nodes: [base, streaks],
    tick: (frame: number) => {
      streaks.clear();
      const offset = (frame * 1.6) % spacing;
      for (let y = top - spacing + offset; y < top + reach; y += spacing) {
        for (let i = 0; i < 3; i++) {
          const sx = x - w / 2 + 3 + ((i + 0.5) * (w - 6)) / 3;
          const sy = y + ((i * 9) % spacing);
          if (sy < top) continue;
          const fade = 1 - (sy - top) / reach;
          streaks
            .roundRect(sx - 1, sy, 2, 12, 1)
            .fill({ color: haze(0x8ccbf0, h), alpha: 0.8 * Math.max(0, fade) });
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

function farIslands(): Layer {
  const node = new Container({ label: 'far-islands' });
  const bobbers: Container[] = [];
  const ticks: ((frame: number) => void)[] = [];
  for (const spec of FAR_ISLANDS.islands) {
    const holder = new Container();
    if (spec.fall) {
      const wf = waterfall(spec.x + spec.w * 0.22, spec.top + 4, 12, spec.haze);
      holder.addChild(...wf.nodes);
      ticks.push(wf.tick);
    }
    const g = new Graphics();
    floatingIsland(g, spec);
    if (spec.deco === 'pi') piArch(g, spec.x - 16, spec.top - 5, 1.2, spec.haze);
    if (spec.deco === 'doors') templeDoors(g, spec.x + 2, spec.top - 3, spec.haze, 0.82);
    holder.addChild(g);
    node.addChild(holder);
    bobbers.push(holder);
  }
  return {
    depth: FAR_ISLANDS.depth,
    node,
    tick(frame) {
      bobbers.forEach((b, i) => (b.y = Math.sin(frame * 0.01 + i * 2.1) * 3));
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
  for (let x = WIDE_LEFT; x <= WIDE_RIGHT; i++) {
    const size = hash01(41 + i);
    const w = 160 + size * 380;
    const ch = 18 + size * 34 + hash01(17 + i) * 8;
    cloud(g, x, fillTop + 4, w, ch, SEA_TOP, mix(SEA_TOP, SEA_DEEP, 0.4), 100 + i);
    x += w * (0.55 + hash01(77 + i) * 0.3);
  }
  return { depth: SEA_LAYER.depth, node: g };
}

/** Loose cloud banks drifting below the island, low contrast so the playfield stays calm. */
function lowClouds(): Layer {
  const node = new Container({ label: 'low-clouds' });
  const body = mix(SEA_TOP, SEA_DEEP, 0.3);
  const shade = mix(SEA_TOP, SEA_DEEP, 0.75);
  const specs = [
    { x: -200, y: 610, w: 380, h: 46, speed: 0.1 },
    { x: 420, y: 668, w: 460, h: 54, speed: 0.08 },
    { x: 1080, y: 630, w: 400, h: 48, speed: 0.12 },
    { x: 1700, y: 690, w: 520, h: 56, speed: 0.09 },
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

/** Fireboy & Watergirl's exit doors: dark stone doors, colour only on the red Mars and blue Venus signs and lintels. */
function templeDoors(g: Graphics, x: number, y: number, h: number, k: number): void {
  const ink = haze(0x2b2414, h * 0.7);
  const P = (dx: number, dy: number) => [x + dx * k, y + dy * k];
  const wall = [
    P(-46, 0),
    P(-46, -44),
    P(-38, -44),
    P(-38, -52),
    P(38, -52),
    P(38, -44),
    P(46, -44),
    P(46, 0),
  ].flat();
  g.poly(wall).fill(haze(0x6f6a3a, h));
  for (let row = 1; row < 5; row++) {
    g.moveTo(...(P(-44, -row * 9.5) as [number, number]))
      .lineTo(...(P(44, -row * 9.5) as [number, number]))
      .stroke({ width: 1, color: ink, alpha: 0.3 });
  }
  g.poly(wall).stroke({ width: 2, color: ink, join: 'round' });
  const door = (dx: number, sign: number, venus: boolean) => {
    const [fx, fy] = P(dx - 16, -40) as [number, number];
    g.rect(fx, fy, 32 * k, 40 * k).fill(haze(STONE_LIGHT, h));
    g.rect(fx, fy, 32 * k, 40 * k).stroke({ width: 1.5, color: ink });
    const [px, py] = P(dx - 13, -36) as [number, number];
    g.rect(px, py, 26 * k, 36 * k).fill(haze(0x3a3324, h * 0.8));
    g.rect(px, py, 26 * k, 36 * k).stroke({ width: 1.5, color: ink });
    g.rect(px, py, 26 * k, 3 * k).fill(haze(sign, h * 0.8));
    const [sx, sy] = P(dx, -19) as [number, number];
    const sym = haze(sign, h * 0.7);
    const r = 5.5 * k;
    const lw = 2.6 * k;
    g.circle(sx, sy, r).stroke({ width: lw, color: sym });
    if (venus) {
      g.moveTo(sx, sy + r)
        .lineTo(sx, sy + r + 7.5 * k)
        .stroke({ width: lw, color: sym });
      g.moveTo(sx - 3.5 * k, sy + r + 4 * k)
        .lineTo(sx + 3.5 * k, sy + r + 4 * k)
        .stroke({ width: lw, color: sym });
    } else {
      g.moveTo(sx + 3.8 * k, sy - 3.8 * k)
        .lineTo(sx + 9.5 * k, sy - 9.5 * k)
        .stroke({ width: lw, color: sym });
      g.moveTo(sx + 4.5 * k, sy - 9.5 * k)
        .lineTo(sx + 9.5 * k, sy - 9.5 * k)
        .lineTo(sx + 9.5 * k, sy - 4.5 * k)
        .stroke({ width: lw, color: sym, join: 'miter' });
    }
  };
  door(-17, GEM_RED, false);
  door(17, GEM_BLUE, true);
}

function midRocks(): Layer {
  const node = new Container({ label: 'mid-rocks' });
  const rocks = MID_ROCKS.islands.map((spec) => {
    const g = new Graphics();
    floatingRock(g, spec);
    node.addChild(g);
    return g;
  });
  return {
    depth: MID_ROCKS.depth,
    node,
    tick(frame) {
      rocks.forEach((r, i) => (r.y = Math.sin(frame * 0.012 + i * 2.4) * 4));
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
