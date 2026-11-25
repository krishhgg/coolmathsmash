import { Container, Graphics } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, wrap, type StageCamera } from '../../battlefield/art/parallax';
import { cloud, hash01, mix, vGradient } from '../../battlefield/art/util';

/**
 * The Duck Life backdrop: a grassland race course that scrolls past the deck as if the camera ran with the racers.
 * Every layer is drawn in screen pixels at the reference camera and parallaxes by its depth; on top of that its
 * scenery slides left at COURSE_SPEED times its depth, so nearer layers pass faster, and wraps every `period` pixels.
 * The scroll is a pure function of the frame and never touches the playfield.
 */
export const COURSE_SPEED = 4.5;

/** How far a layer at `depth` has scrolled by `frame`, wrapped into [0, period). */
export function scrollAt(frame: number, depth: number, period: number): number {
  return wrap(frame * COURSE_SPEED * depth, 0, period);
}

const SKY_HAZE = 0xcdf2f2;

/** The far hills: a strip three periods wide so any scroll phase covers the screen. */
export const HILLS = { depth: 0.07, left: -700, period: 1600, right: -700 + 1600 * 3, bottom: 1150 } as const;

/** The meadow fills everything below the horizon at every camera; its scenery strip scrolls on top of it. */
export const MEADOW = { depth: 0.16, left: -900, right: 2180, top: 500, bottom: 2400, period: 2576 } as const;

const FENCE_STEP = 46;
const HURDLE_STEP = MEADOW.period / 8;
const TRACK = { top: 546, bottom: 586 } as const;
/** Where the background racer runs, in meadow pixels, and the first hurdle's place in the strip. */
export const RACER_X = 196;
const FIRST_HURDLE = 140;

const haze = (color: number, t = 0.18) => mix(color, SKY_HAZE, t);

function sky(): Graphics {
  const g = new Graphics({ label: 'sky' });
  g.rect(0, 0, VIEW_W, VIEW_H).fill(
    vGradient([
      [0, 0x2eaee9],
      [0.55, 0x86d6f3],
      [1, SKY_HAZE],
    ]),
  );
  for (const [a, b, alpha] of [
    [0.1, 0.17, 0.09],
    [0.25, 0.3, 0.07],
    [0.38, 0.47, 0.06],
  ] as const) {
    const reach = 1900;
    g.poly([
      -60,
      -60,
      -60 + reach * Math.cos(a),
      -60 + reach * Math.sin(a),
      -60 + reach * Math.cos(b),
      -60 + reach * Math.sin(b),
    ]).fill({ color: 0xffffff, alpha });
  }
  return g;
}

function clouds(): { node: Container; puffs: Graphics[] } {
  const node = new Container({ label: 'clouds' });
  const puffs = Array.from({ length: 7 }, (_, i) => {
    const g = new Graphics();
    const w = 150 + hash01(i + 3) * 130;
    cloud(g, 0, 0, w, w * 0.36, 0xffffff, 0xd6eef7, i + 9);
    g.y = 70 + (i % 3) * 62 + hash01(i + 40) * 30;
    node.addChild(g);
    return g;
  });
  return { node, puffs };
}

/** A rolling crest that repeats every `period` pixels (integer harmonics only). */
function crest(x: number, base: number, period: number, seed: number): number {
  const t = (2 * Math.PI * x) / period;
  return (
    base - 34 * Math.sin(2 * t + seed) - 18 * Math.sin(3 * t + seed * 2.3) - 9 * Math.sin(7 * t + seed * 0.7)
  );
}

function hills(): Container {
  const node = new Container({ label: 'far hills' });
  const g = new Graphics();
  const { left, right, period, bottom } = HILLS;
  for (const [base, seed, color, rim] of [
    [372, 0.4, haze(0x9fd98a, 0.38), haze(0xc3ecaa, 0.4)],
    [448, 2.1, haze(0x86d05a, 0.22), haze(0xb4ea80, 0.25)],
  ] as const) {
    const points: number[] = [left, bottom];
    for (let x = left; x <= right; x += 10) points.push(x, crest(x, base, period, seed));
    points.push(right, bottom);
    g.poly(points).fill(color);
    g.moveTo(left, crest(left, base, period, seed));
    for (let x = left; x <= right; x += 10) g.lineTo(x, crest(x, base, period, seed) + 2);
    g.stroke({ color: rim, width: 4, join: 'round' });
  }
  node.addChild(g);
  return node;
}

function windmill(g: Graphics, x: number): Graphics {
  const base = MEADOW.top;
  const top = base - 150;
  g.poly([x - 36, base, x - 24, top, x + 24, top, x + 36, base]).fill(haze(0xf2e0b3));
  g.poly([x + 8, top, x + 24, top, x + 36, base, x + 14, base]).fill(haze(0xdcc48e));
  g.roundRect(x - 11, base - 40, 22, 40, 11).fill(haze(0x8e5a32));
  for (const wy of [top + 40, top + 82]) g.roundRect(x - 6, wy, 12, 16, 6).fill(haze(0x6f8fa8));
  g.ellipse(x, top + 2, 31, 9).fill(haze(0xc98f1f));
  g.moveTo(x - 30, top + 2)
    .bezierCurveTo(x - 30, top - 40, x + 30, top - 40, x + 30, top + 2)
    .closePath()
    .fill(haze(0xf1b52b));
  g.ellipse(x - 10, top - 18, 9, 5).fill(haze(0xf8d76d));
  // A race badge on the cap.
  g.circle(x, top - 8, 10).fill(haze(0xfff2c6));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if ((r + c) % 2 === 0) g.rect(x - 6 + c * 4, top - 14 + r * 4, 4, 4).fill(haze(0x3b3226, 0.3));
  const sails = new Graphics({ label: 'sails' });
  for (let i = 0; i < 4; i++) {
    const blade = new Graphics();
    blade.rect(-2, -96, 4, 96).fill(haze(0xb99a62));
    blade.rect(3, -92, 16, 72).fill({ color: haze(0xfbf1d8), alpha: 0.88 });
    for (let y = -88; y < -20; y += 12) blade.rect(3, y, 16, 2).fill(haze(0xc9ad78));
    blade.rect(10, -92, 2, 72).fill(haze(0xc9ad78));
    blade.rotation = (i * Math.PI) / 2;
    sails.addChild(blade);
  }
  sails.addChild(new Graphics().circle(0, 0, 6).fill(haze(0x8e5a32)));
  sails.position.set(x, top - 2);
  return sails;
}

/** Hand-lettered SHOP in stroked capitals, origin at the top left of the S, letters 10 high. */
function shopLetters(g: Graphics, color: number): void {
  g.moveTo(8, 1.5)
    .bezierCurveTo(5, -1, 0, 0.5, 0.5, 3)
    .bezierCurveTo(1, 5.5, 8, 4.5, 8, 7.5)
    .bezierCurveTo(8, 10.5, 2, 11, 0, 8.5)
    .moveTo(12, 0)
    .lineTo(12, 10)
    .moveTo(19, 0)
    .lineTo(19, 10)
    .moveTo(12, 5)
    .lineTo(19, 5)
    .moveTo(27, 0)
    .bezierCurveTo(21.5, 0, 21.5, 10, 27, 10)
    .bezierCurveTo(32.5, 10, 32.5, 0, 27, 0)
    .moveTo(36, 10)
    .lineTo(36, 0)
    .bezierCurveTo(42, -0.5, 42, 5.5, 36, 5.2)
    .stroke({ color, width: 2.2, cap: 'round', join: 'round' });
}

function barn(g: Graphics, x: number): Graphics {
  const base = MEADOW.top;
  const red = haze(0xc23328);
  const trim = haze(0xe6dccb, 0.22);
  g.poly([
    x - 84,
    base - 78,
    x - 72,
    base - 118,
    x - 40,
    base - 146,
    x + 40,
    base - 146,
    x + 72,
    base - 118,
    x + 84,
    base - 78,
  ]).fill(haze(0x7d4b2d));
  g.poly([x - 72, base - 118, x - 40, base - 146, x + 40, base - 146, x + 72, base - 118]).fill(
    haze(0x95603a),
  );
  g.rect(x - 74, base - 80, 148, 80).fill(red);
  g.rect(x + 30, base - 80, 44, 80).fill(haze(0xa82a22));
  for (let px = x - 70; px < x + 74; px += 12) g.rect(px, base - 78, 1.5, 78).fill(haze(0x9e271f, 0.25));
  for (const px of [x - 74, x + 64]) g.rect(px, base - 80, 10, 80).fill(trim);
  g.rect(x - 74, base - 84, 148, 7).fill(trim);
  // Big cross-braced doors and the hayloft.
  g.rect(x - 26, base - 58, 52, 58).fill(haze(0xa42c22));
  g.rect(x - 26, base - 58, 52, 58).stroke({ color: trim, width: 5 });
  g.moveTo(x - 24, base - 56)
    .lineTo(x + 24, base - 2)
    .moveTo(x + 24, base - 56)
    .lineTo(x - 24, base - 2)
    .stroke({ color: trim, width: 4 });
  g.rect(x - 14, base - 132, 28, 26).fill(haze(0x4a3426));
  g.rect(x - 14, base - 132, 28, 26).stroke({ color: trim, width: 4 });
  const sign = new Graphics({ label: 'shop sign' });
  sign.roundRect(0, 0, 58, 22, 3).fill(haze(0xd9a35c));
  sign.rect(2, 7, 54, 1.4).fill(haze(0xb47a3e));
  const letters = new Graphics();
  shopLetters(letters, haze(0x5a3a20, 0.12));
  letters.position.set(9, 6);
  sign.addChild(letters);
  sign.position.set(x + 30, base - 104);
  sign.rotation = -0.09;
  return sign;
}

function tree(g: Graphics, x: number, s: number, seed: number): void {
  const base = MEADOW.top;
  g.rect(x - 4 * s, base - 34 * s, 8 * s, 34 * s).fill(haze(0x8a5a35));
  const leaf = haze(0x4aa33a);
  const lit = haze(0x6cc44c);
  for (const [dx, dy, r] of [
    [-16, -44, 20],
    [14, -46, 21],
    [0, -64, 24],
  ] as const) {
    const rr = r * s * (0.9 + 0.2 * hash01(seed + dx));
    g.circle(x + dx * s, base + dy * s, rr).fill(leaf);
    g.circle(x + dx * s - rr * 0.18, base + dy * s - rr * 0.2, rr * 0.62).fill(lit);
  }
}

function hurdle(g: Graphics, x: number): void {
  const foot = TRACK.bottom - 8;
  const bar = foot - 20;
  for (const lx of [x - 14, x + 12]) g.rect(lx, bar, 2.5, 20).fill(haze(0xf2efe2));
  for (let i = 0; i < 4; i++) g.rect(x - 16 + i * 8, bar, 8, 5).fill(haze(i % 2 ? 0xf6f2e6 : 0xd8382c, 0.2));
  g.rect(x - 18, foot, 8, 2)
    .rect(x + 10, foot, 8, 2)
    .fill(haze(0xc9c2b0));
}

/** One period of the scrolling strip, starting at x = ox. The sails and the shop sign come back as their own nodes. */
function scenery(g: Graphics, ox: number): { sails: Graphics; sign: Graphics } {
  tree(g, ox + 470, 1, 1);
  tree(g, ox + 540, 0.8, 2);
  const sails = windmill(g, ox + 300);
  tree(g, ox + 1380, 1.1, 3);
  const sign = barn(g, ox + 1150);
  tree(g, ox + 1880, 0.9, 4);
  tree(g, ox + 2290, 1.05, 5);
  tree(g, ox + 2350, 0.75, 6);
  // The fence between the horizon and the track.
  for (let x = ox; x < ox + MEADOW.period; x += FENCE_STEP) g.rect(x, 508, 6, 30).fill(haze(0xece9dc, 0.25));
  // Lane dashes, hurdles and checkpoint flags on the track.
  for (let x = ox; x < ox + MEADOW.period; x += FENCE_STEP)
    g.rect(x + 10, 565, 18, 2.5).fill(haze(0xfaf5e8, 0.25));
  for (let k = 0; k < 8; k++) hurdle(g, ox + FIRST_HURDLE + k * HURDLE_STEP);
  for (const fx of [ox + 820, ox + 2060]) {
    g.rect(fx, 512, 3, 40).fill(haze(0x6e5a44));
    g.rect(fx + 3, 512, 22, 15).fill(haze(0xfbf6ea));
    for (let r = 0; r < 3; r++)
      for (let c = r % 2; c < 4; c += 2)
        g.rect(fx + 3 + c * 5.5, 512 + r * 5, 5.5, 5).fill(haze(0x2e2a26, 0.3));
  }
  // A pond for the swim legs, and flowers in the near grass.
  g.ellipse(ox + 1640, 652, 120, 24).fill(haze(0x4f9e38));
  g.ellipse(ox + 1640, 650, 112, 19).fill(haze(0x58c2e4));
  g.ellipse(ox + 1610, 646, 60, 6).fill(haze(0x93dcf2));
  g.ellipse(ox + 1700, 655, 12, 4).fill(haze(0x5fb64a));
  for (let i = 0; i < 46; i++) {
    const fx = ox + (i + hash01(i + 600)) * (MEADOW.period / 46);
    const fy = 612 + hash01(i + 700) * 110;
    if (Math.abs(fx - ox - 1640) < 140 && fy < 690) continue;
    g.poly([fx - 5, fy, fx - 2, fy - 8, fx, fy - 2, fx + 3, fy - 9, fx + 5, fy]).fill(haze(0x4f9b33));
    const petal = [0xffffff, 0xffe066, 0xf6a3c0][Math.floor(hash01(i + 900) * 3)]!;
    if (i % 2 === 0) g.circle(fx + 8, fy - 3, 2.6).fill(haze(petal, 0.22));
  }
  return { sails, sign };
}

/** The racer: a small duck that runs on the spot while the course scrolls, and hops each hurdle as it passes. */
function racer(): { node: Container; legs: Graphics[] } {
  const node = new Container({ label: 'racer' });
  const body = new Graphics();
  const yellow = haze(0xf6d544, 0.28);
  body.ellipse(0, -13, 11, 8).fill(yellow);
  body.circle(8, -24, 6.5).fill(yellow);
  body.poly([13, -25, 20, -23, 13, -21]).fill(haze(0xf0962c, 0.28));
  body.circle(10, -25.5, 1.3).fill(haze(0x2b2219, 0.3));
  body.ellipse(-3, -14, 6, 3.5).fill(haze(0xe7bd2f, 0.28));
  body.poly([-11, -15, -16, -19, -12, -11]).fill(yellow);
  const legs = [0, 1].map((i) => {
    const leg = new Graphics();
    leg
      .moveTo(0, 0)
      .lineTo(0, 7)
      .lineTo(3.5, 7)
      .stroke({ color: haze(0xf0962c, 0.28), width: 1.8, cap: 'round' });
    leg.position.set(i ? 3 : -3, -7);
    return leg;
  });
  node.addChild(...legs, body);
  return { node, legs };
}

/** The racer's hop height (pixels, up) for a given strip scroll: an arc while a hurdle is within reach. */
export function racerHop(scroll: number): number {
  const reach = 26;
  const ahead = wrap(FIRST_HURDLE - scroll - RACER_X, -HURDLE_STEP / 2, HURDLE_STEP);
  if (Math.abs(ahead) >= reach) return 0;
  return 30 * Math.sin((Math.PI * (reach - ahead)) / (2 * reach));
}

function meadow() {
  const node = new Container({ label: 'meadow' });
  const ground = new Graphics();
  const { left, right, top, bottom } = MEADOW;
  ground.rect(left, top, right - left, bottom - top).fill(
    vGradient([
      [0, haze(0x9edc62, 0.1)],
      [0.05, 0x7cc746],
      [0.15, 0x62b03c],
      [1, 0x3d7c2c],
    ]),
  );
  ground
    .rect(left, 514, right - left, 4)
    .rect(left, 526, right - left, 4)
    .fill(haze(0xece9dc, 0.25));
  ground.rect(left, TRACK.top, right - left, TRACK.bottom - TRACK.top).fill(
    vGradient([
      [0, haze(0xe3c283)],
      [1, haze(0xc99d5e)],
    ]),
  );
  ground
    .rect(left, TRACK.top + 2, right - left, 2.5)
    .rect(left, TRACK.bottom - 5, right - left, 2.5)
    .fill(haze(0xfaf5e8, 0.25));
  const strip = new Container({ label: 'scrolling course' });
  const g = new Graphics();
  strip.addChild(g);
  const sails: Graphics[] = [];
  for (const ox of [-MEADOW.period, 0, MEADOW.period]) {
    const props = scenery(g, ox);
    sails.push(props.sails);
    strip.addChild(props.sails, props.sign);
  }
  const runner = racer();
  runner.node.position.set(RACER_X, TRACK.bottom - 6);
  node.addChild(ground, strip, runner.node);
  return { node, strip, sails, racer: runner };
}

export function createBackground() {
  const container = new Container({ label: 'duck-life-course-backdrop' });
  const skyLayer = sky();
  const cloudLayer = clouds();
  const hillLayer = hills();
  const meadowLayer = meadow();
  const layers = [
    [0, skyLayer],
    [0.04, cloudLayer.node],
    [HILLS.depth, hillLayer],
    [MEADOW.depth, meadowLayer.node],
  ] as const;
  for (const [, node] of layers) {
    node.pivot.set(VIEW_W / 2, VIEW_H / 2);
    container.addChild(node);
  }
  return {
    container,
    update(frame: number, camera: StageCamera) {
      cloudLayer.puffs.forEach((puff, i) => {
        puff.x = wrap(120 + i * 260 - frame * (0.04 * COURSE_SPEED + 0.05 * (i % 3)), -320, 1920);
      });
      hillLayer.children[0]!.x = -scrollAt(frame, HILLS.depth, HILLS.period);
      const scroll = scrollAt(frame, MEADOW.depth, MEADOW.period);
      meadowLayer.strip.x = -scroll;
      for (const sail of meadowLayer.sails) sail.rotation = frame * 0.006;
      const hop = racerHop(scroll);
      meadowLayer.racer.node.y = TRACK.bottom - 6 - hop;
      const stride = Math.floor(frame / 5) % 2;
      meadowLayer.racer.legs.forEach((leg, i) => {
        leg.rotation = hop > 0 ? -0.9 : i === stride ? 0.5 : -0.5;
      });
      for (const [depth, node] of layers) {
        const { x, y, scale } = layerTransform(depth, camera);
        node.position.set(x, y);
        node.scale.set(scale);
      }
    },
  };
}
