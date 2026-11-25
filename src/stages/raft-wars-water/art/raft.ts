import { Container, Graphics } from 'pixi.js';
import { flipY, hash01, mix, vGradient } from '../../battlefield/art/util';
import { RAFT, stage } from '../geometry';
import * as C from './palette';

/** Pixi y (down) of the drawing's parts: the plank band, the log under it and the mast top. */
export const PLANK_DEPTH = 2.2;
export const LOG_RADIUS = 3.9;
const LOG_Y = PLANK_DEPTH + LOG_RADIUS;
/** The log's cut ends are ellipses centred this far in from the raft's ends; their outer edge is the hull. */
const LOG_END = RAFT.right - 2.2;
const MAST_TOP = -70;

type Platform = (typeof stage.platforms)[number];

/** A rope lashing seen from the front: `turns` slanted wraps between `top` and `bottom` (pixi y). */
function lashing(g: Graphics, x: number, top: number, bottom: number, w: number, turns = 3): void {
  const step = (bottom - top) / turns;
  for (let i = 0; i < turns; i++) {
    const y0 = top + step * i + 0.25;
    const y1 = top + step * (i + 1) - 0.25;
    g.moveTo(x - w / 2, y0)
      .lineTo(x + w / 2, y1)
      .stroke({ color: C.INK, width: 1.05, cap: 'round' });
    g.moveTo(x - w / 2, y0)
      .lineTo(x + w / 2, y1)
      .stroke({ color: C.ROPE, width: 0.6, cap: 'round' });
  }
}

/** A row of plank ends from `l` to `r` with its walkable top at pixi `y`, `depth` thick, outlined. */
function planks(
  g: Graphics,
  l: number,
  r: number,
  y: number,
  depth: number,
  width: number,
  seed: number,
): void {
  const n = Math.max(1, Math.round((r - l) / width));
  const w = (r - l) / n;
  for (let i = 0; i < n; i++) {
    const x = l + i * w;
    g.rect(x, y, w, depth).fill(mix(C.PLANK, C.PLANK_DARK, hash01(seed + i) * 0.4));
    g.rect(x, y, w, Math.min(0.5, depth / 3)).fill(C.PLANK_TOP);
    g.circle(x + w / 2, y + depth * 0.62, 0.2).fill(C.PLANK_DARK);
    if (i > 0)
      g.moveTo(x, y)
        .lineTo(x, y + depth)
        .stroke({ color: C.INK, width: 0.2 });
  }
  g.rect(l, y, r - l, depth).stroke({ color: C.INK, width: 0.45, join: 'round' });
}

/** An arc that starts its own path, so it is not joined to wherever the pen last stopped. */
function arc(g: Graphics, x: number, y: number, r: number, from: number, to: number): Graphics {
  return g.moveTo(x + r * Math.cos(from), y + r * Math.sin(from)).arc(x, y, r, from, to);
}

/** A round pole from (x1, y1) to (x2, y2), outlined. */
function pole(g: Graphics, x1: number, y1: number, x2: number, y2: number, w: number, color: number): void {
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({ color: C.INK, width: w + 0.6, cap: 'round' });
  g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width: w, cap: 'round' });
}

/** The raft itself: plank deck on one long log, lashed with rope; its outline is the collision hull. */
function hull(): Graphics {
  const g = new Graphics({ label: 'raft-hull' });
  const shape = flipY(stage.solids[0]!.points);
  const { left: l, right: r } = RAFT;
  g.rect(l + 1.2, -1.3, r - l - 2.4, 1.3).fill(C.PLANK_REAR);
  for (let x = l + 7.5; x < r - 3; x += 7.5)
    g.moveTo(x - 0.4, -1.3)
      .lineTo(x, 0)
      .stroke({ color: mix(C.PLANK_REAR, C.INK, 0.3), width: 0.18 });
  g.poly(shape).fill(C.GAP);
  g.rect(-LOG_END, PLANK_DEPTH, LOG_END * 2, LOG_RADIUS * 2).fill(
    vGradient([
      [0, C.LOG_LIGHT],
      [0.4, C.LOG],
      [1, C.LOG_DARK],
    ]),
  );
  for (let i = 0; i < 70; i++) {
    const x = -LOG_END + 2 + hash01(i + 101) * (LOG_END * 2 - 4);
    const y = PLANK_DEPTH + 1 + hash01(i + 211) * (LOG_RADIUS * 2 - 2);
    const len = 2.5 + hash01(i + 307) * 6;
    g.moveTo(x, y)
      .lineTo(x + len, y + (hash01(i + 401) - 0.5) * 0.4)
      .stroke({ color: C.LOG_DARK, width: 0.24, alpha: 0.55, cap: 'round' });
  }
  for (const [i, x] of [-47, -12, 21, 63].entries()) {
    const y = LOG_Y - 1.2 + hash01(i + 503) * 2.4;
    g.ellipse(x, y, 1.1, 0.7).fill(C.LOG_DARK);
    g.ellipse(x, y, 0.5, 0.3).fill(C.LOG);
  }
  for (const side of [-1, 1]) {
    const x = side * LOG_END;
    g.ellipse(x, LOG_Y, 2.2, LOG_RADIUS).fill(C.LOG_CUT).stroke({ color: C.INK, width: 0.4 });
    g.ellipse(x + side * 0.15, LOG_Y, 1.5, 2.65).stroke({ color: C.LOG_RING, width: 0.24 });
    g.ellipse(x + side * 0.3, LOG_Y, 0.75, 1.35).stroke({ color: C.LOG_RING, width: 0.24 });
  }
  planks(g, l, r, 0, PLANK_DEPTH, 7.5, 31);
  for (const x of [-56, -28, 0, 28, 56]) lashing(g, x, 0.3, PLANK_DEPTH + LOG_RADIUS * 2 - 0.4, 2.4, 4);
  g.poly(shape).stroke({ color: C.INK, width: 0.6, join: 'round' });
  return g;
}

/** A lookout deck: a plank slab on two stilts that stand on the raft, braced with rope. */
function lookout(p: Platform, seed: number): Graphics {
  const g = new Graphics({ label: 'lookout-deck' });
  const y = -p.y;
  const posts = [p.x1 + 4, p.x2 - 4] as const;
  const post = mix(C.LOG, C.HAZE, 0.12);
  for (const x of posts) {
    g.rect(x - 0.75, y + 2, 1.5, -y - 2.6)
      .fill(post)
      .stroke({ color: C.INK, width: 0.3 });
    g.rect(x - 0.45, y + 2.4, 0.4, -y - 3.4).fill(mix(C.LOG_LIGHT, C.HAZE, 0.12));
  }
  const [a, b] = posts;
  const brace = { color: mix(C.ROPE_DARK, C.HAZE, 0.2), width: 0.4 };
  g.moveTo(a + 0.75, y + 5)
    .lineTo(b - 0.75, -4)
    .moveTo(a + 0.75, -4)
    .lineTo(b - 0.75, y + 5)
    .stroke(brace);
  g.rect(p.x1 + 1.5, y + 2, p.x2 - p.x1 - 3, 1.3)
    .fill(C.LOG_DARK)
    .stroke({ color: C.INK, width: 0.3 });
  planks(g, p.x1, p.x2, y, 2, 4, seed);
  for (const x of posts) lashing(g, x, y + 0.3, y + 3.2, 1.7, 2);
  return g;
}

/** The mast, the crow's nest on its braces and the swim ring hung on a stilt. */
function rigging(nest: Platform): Graphics {
  const g = new Graphics({ label: 'mast-and-nest' });
  const y = -nest.y;
  g.rect(-1.1, MAST_TOP, 2.2, -MAST_TOP - 0.6)
    .fill(C.LOG)
    .stroke({ color: C.INK, width: 0.35 });
  g.rect(-0.75, MAST_TOP + 0.5, 0.55, -MAST_TOP - 1.6).fill(C.LOG_LIGHT);
  for (const side of [-1, 1]) pole(g, side * 0.8, y + 12, side * (nest.x2 - 3), y + 1.8, 0.9, C.LOG);
  planks(g, nest.x1, nest.x2, y, 2, 4, 71);
  for (const h of [-3, y + 12, y + 3]) lashing(g, 0, h - 1.2, h + 1.2, 2.2, 2);
  g.circle(0, MAST_TOP - 0.6, 1.25)
    .fill(C.LOG_CUT)
    .stroke({ color: C.INK, width: 0.3 });
  return g;
}

/** An inflatable swim ring hung on the left lookout's outer stilt, red and white quarters. */
function swimRing(x: number, y: number): Graphics {
  const g = new Graphics({ label: 'swim-ring' });
  const r = 2.35;
  for (let i = 0; i < 4; i++)
    arc(g, x, y, r, (i * Math.PI) / 2 + 0.3, ((i + 1) * Math.PI) / 2 + 0.3).stroke({
      color: i % 2 === 0 ? C.RING_RED : C.RING_WHITE,
      width: 1.5,
    });
  g.circle(x, y, r + 0.75).stroke({ color: C.INK, width: 0.3 });
  g.circle(x, y, r - 0.75).stroke({ color: C.INK, width: 0.3 });
  g.moveTo(x, y - r - 0.75)
    .lineTo(x + 0.4, y - r - 2)
    .stroke({ color: C.ROPE_DARK, width: 0.35 });
  return g;
}

/** The kids' flag on the mast top, waving: a stripe and a tennis ball. Redrawn every frame. */
function drawFlag(g: Graphics, frame: number): void {
  g.clear();
  const x0 = 1.1;
  const top = MAST_TOP + 0.6;
  const h = 6.4;
  const len = 11;
  const n = 10;
  const wave = (t: number) => Math.sin(frame * 0.1 - t * 4.4) * 0.85 * t;
  const edge = (yy: number, k: number): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [x0 + t * len * k, yy + wave(t)];
    });
  const upper = edge(top, 1);
  const lower = edge(top + h, 0.97).reverse();
  g.poly([...upper, ...lower].flat()).fill(C.FLAG);
  const band = [...edge(top + h * 0.66, 0.99), ...edge(top + h * 0.86, 0.975).reverse()];
  g.poly(band.flat()).fill(C.FLAG_STRIPE);
  g.poly([...upper, ...lower].flat()).stroke({ color: C.INK, width: 0.35, join: 'round' });
  const bx = x0 + len * 0.42;
  const by = top + h * 0.34 + wave(0.42);
  g.circle(bx, by, 1.45).fill(C.BALL).stroke({ color: C.INK, width: 0.25 });
  arc(g, bx - 1.6, by, 1.2, -0.9, 0.9).stroke({ color: C.BALL_SEAM, width: 0.25 });
  arc(g, bx + 1.6, by, 1.2, Math.PI - 0.9, Math.PI + 0.9).stroke({ color: C.BALL_SEAM, width: 0.25 });
}

/**
 * Everything that floats: the hull (solid 0), the lookout decks (platforms 0 and 1) and the crow's nest (platform
 * 2) in one container, since the swell moves them as one piece (geometry.test.ts pins that).
 */
export function createRaft(): { container: Container; update(frame: number): void } {
  const container = new Container({ label: 'raft' });
  const [left, right, nest] = stage.platforms as [Platform, Platform, Platform];
  const flag = new Graphics({ label: 'flag' });
  container.addChild(
    rigging(nest),
    flag,
    lookout(left, 11),
    lookout(right, 47),
    swimRing(left.x1 + 4, -11),
    hull(),
  );
  drawFlag(flag, 0);
  return {
    container,
    update(frame) {
      drawFlag(flag, frame);
    },
  };
}
