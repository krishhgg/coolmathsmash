import { Color, Container, FillGradient, Graphics, GraphicsContext, GraphicsPath, Matrix } from 'pixi.js';
import { flattenPath } from './geometry';
import { resolveColor } from './svg';
import { resolveSymbol, samplePose } from './sample';
import type { ArtSymbol, FighterArt, Paint, Palette, PropArt } from './types';

/**
 * Built geometry, shared by every view: one GraphicsContext per (symbols table, palette, symbol), so several
 * fighters (and their projectiles) reuse the same tessellated paths.
 */
const cache = new WeakMap<Record<string, ArtSymbol>, WeakMap<Palette, Map<string, GraphicsContext>>>();

function toFill(paint: Paint, palette: Palette): string | FillGradient {
  if (typeof paint === 'string') return resolveColor(paint, palette);
  const colorStops = paint.stops.map((s) => ({
    offset: s.offset,
    color: new Color(resolveColor(s.color, palette)).setAlpha(s.alpha ?? 1).toRgbaString(),
  }));
  return paint.type === 'radial'
    ? new FillGradient({
        type: 'radial',
        center: { x: paint.cx, y: paint.cy },
        innerRadius: 0,
        outerCenter: { x: paint.cx, y: paint.cy },
        outerRadius: paint.r,
        colorStops,
        textureSpace: 'global',
      })
    : new FillGradient({
        type: 'linear',
        start: { x: paint.x0, y: paint.y0 },
        end: { x: paint.x1, y: paint.y1 },
        colorStops,
        textureSpace: 'global',
      });
}

/** The shared GraphicsContext drawing `name` (a path symbol) in `palette`. */
export function symbolContext(
  symbols: Record<string, ArtSymbol>,
  name: string,
  palette: Palette,
): GraphicsContext {
  let byPalette = cache.get(symbols);
  if (!byPalette) cache.set(symbols, (byPalette = new WeakMap<Palette, Map<string, GraphicsContext>>()));
  let contexts = byPalette.get(palette);
  if (!contexts) byPalette.set(palette, (contexts = new Map<string, GraphicsContext>()));
  let ctx = contexts.get(name);
  if (ctx) return ctx;
  ctx = new GraphicsContext();
  const sym = symbols[name];
  if (!Array.isArray(sym)) throw new Error(`symbol ${name} is not a path symbol`);
  for (const shape of sym) {
    if (shape.fill !== undefined) {
      const fill = toFill(shape.fill, palette);
      for (const [outer = '', ...holes] of evenOdd(shape.d)) {
        ctx.beginPath().path(new GraphicsPath(outer)).fill(fill);
        if (holes.length)
          ctx
            .beginPath()
            .path(new GraphicsPath(holes.join('')))
            .cut();
      }
    }
    if (shape.stroke)
      ctx.path(new GraphicsPath(shape.d)).stroke({
        width: shape.stroke.width,
        color: resolveColor(shape.stroke.color, palette),
        cap: 'round',
        join: 'round',
      });
  }
  contexts.set(name, ctx);
  return ctx;
}

/**
 * Splits path data into fill groups with even-odd semantics, which Pixi does not apply on its own: each
 * subpath nested an even number of times is an outline, followed by the subpaths directly inside it (holes).
 */
function evenOdd(d: string): string[][] {
  const subs = d.split(/(?=M)/).filter((s) => (flattenPath(s, 1)[0]?.length ?? 0) >= 6);
  if (subs.length < 2 || /m/.test(d)) return [[d]];
  const polys = subs.map((s) => flattenPath(s, 8)[0] ?? []);
  const inside = (p: number[], x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const yi = p[i + 1]!;
      const yj = p[j + 1]!;
      if (yi > y !== yj > y && x < ((p[j]! - p[i]!) * (y - yi)) / (yj - yi) + p[i]!) hit = !hit;
    }
    return hit;
  };
  const within = (p: number[], q: number[]) => {
    const n = p.length / 2;
    const votes = [0, Math.floor(n / 3), Math.floor((2 * n) / 3)].filter((v) =>
      inside(q, p[2 * v]!, p[2 * v + 1]!),
    );
    return votes.length >= 2;
  };
  const containers = polys.map((p, i) => polys.flatMap((q, j) => (j !== i && within(p, q) ? [j] : [])));
  const depth = containers.map((c) => c.length);
  const parent = containers.map((c) =>
    c.reduce((best, j) => (best < 0 || depth[j]! > depth[best]! ? j : best), -1),
  );
  return subs.flatMap((s, i) =>
    depth[i]! % 2 ? [] : [[s, ...subs.filter((_, k) => parent[k] === i && depth[k]! % 2)]],
  );
}

const EMPTY = new GraphicsContext();

export interface RigView {
  /** Rig space: origin at the feet, y down, facing right. The renderer positions, scales and mirrors it. */
  container: Container;
  /** Shows `clip` at `frame` (frames since the action began) with flicker driven by `globalFrame`. */
  pose(clip: string, frame: number, globalFrame: number): void;
  /** Switches costume; unknown names fall back to `default`. */
  setPalette(name: string): void;
}

export function createRigView(art: FighterArt, palette = 'default'): RigView {
  const container = new Container({ sortableChildren: true });
  const graphics = art.rig.slots.map((_, i) => {
    const g = new Graphics(EMPTY);
    g.zIndex = i;
    g.visible = false;
    return container.addChild(g);
  });
  const matrix = new Matrix();
  let costume = art.palettes[palette] ? palette : 'default';
  let colors = art.palettes[costume] ?? art.palettes.default;
  let last: [string, number, number] = ['idle', 0, 0];
  const pose = (clip: string, frame: number, globalFrame: number) => {
    last = [clip, frame, globalFrame];
    const p = samplePose(art, clip, frame, globalFrame, costume);
    art.rig.slots.forEach((slot, i) => {
      const g = graphics[i]!;
      const name = p.symbols[slot.name];
      g.visible = name !== null && name !== undefined;
      if (!g.visible) return;
      g.context = symbolContext(art.rig.symbols, name!, colors);
      const w = p.world[slot.bone]!;
      g.setFromMatrix(matrix.set(w.a, w.b, w.c, w.d, w.tx, w.ty));
      g.zIndex = p.z[slot.name]!;
    });
  };
  pose('idle', 0, 0);
  return {
    container,
    pose,
    setPalette(name) {
      costume = art.palettes[name] ? name : 'default';
      colors = art.palettes[costume] ?? art.palettes.default;
      pose(...last);
    },
  };
}

export interface PropView {
  container: Container;
  /** Advances the prop's flicker on the match clock. */
  update(globalFrame: number): void;
}

/** A projectile or prop from `art.projectiles`, drawn with the fighter's costume, facing right. */
export function createPropView(art: FighterArt, name: string, palette = 'default'): PropView {
  const prop = art.projectiles?.[name];
  if (!prop) throw new Error(`fighter has no projectile art ${name}`);
  return propView(art, prop, palette);
}

/** One of the fighter's prop drawings (a projectile, its reticle), drawn with the fighter's costume, facing right. */
export function propView(art: FighterArt, prop: PropArt, palette = 'default'): PropView {
  const colors = art.palettes[palette] ?? art.palettes.default;
  const g = new Graphics(EMPTY);
  g.scale.set(prop.scale);
  const container = new Container();
  container.addChild(g);
  const update = (globalFrame: number) => {
    const leaf = resolveSymbol(prop.symbols, prop.symbol, globalFrame);
    g.visible = leaf !== null;
    if (leaf) g.context = symbolContext(prop.symbols, leaf, colors);
  };
  update(0);
  return { container, update };
}
