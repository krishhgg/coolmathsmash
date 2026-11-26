import type { PathShape } from './types';
import { toLocal, type Affine, type RigPose } from './sample';
import type { FighterArt } from './types';

const PATH_TOKENS = /[MLHVQCZmlhvqcz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;

/**
 * Flattens SVG path data (M L H V Q C Z, absolute or relative) into polygons, one per subpath. Curves are
 * sampled, which is plenty for hit tests, bounds and coverage checks.
 */
export function flattenPath(d: string, steps = 8): number[][] {
  const tokens = d.match(PATH_TOKENS) ?? [];
  const polys: number[][] = [];
  let poly: number[] = [];
  let cmd = 'M';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M':
        if (poly.length) polys.push(poly);
        x = ox + num();
        y = oy + num();
        sx = x;
        sy = y;
        poly = [x, y];
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        x = ox + num();
        y = oy + num();
        poly.push(x, y);
        break;
      case 'H':
        x = ox + num();
        poly.push(x, y);
        break;
      case 'V':
        y = oy + num();
        poly.push(x, y);
        break;
      case 'Q': {
        const cx = ox + num();
        const cy = oy + num();
        const ex = ox + num();
        const ey = oy + num();
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const m = 1 - t;
          poly.push(m * m * x + 2 * m * t * cx + t * t * ex, m * m * y + 2 * m * t * cy + t * t * ey);
        }
        x = ex;
        y = ey;
        break;
      }
      case 'C': {
        const c1x = ox + num();
        const c1y = oy + num();
        const c2x = ox + num();
        const c2y = oy + num();
        const ex = ox + num();
        const ey = oy + num();
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const m = 1 - t;
          poly.push(
            m * m * m * x + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * ex,
            m * m * m * y + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * ey,
          );
        }
        x = ex;
        y = ey;
        break;
      }
      case 'Z':
        x = sx;
        y = sy;
        if (poly.length) polys.push(poly);
        poly = [];
        break;
      default:
        throw new Error(`unsupported path command ${cmd}`);
    }
  }
  if (poly.length) polys.push(poly);
  return polys;
}

/**
 * Path data (M L H V Q C Z, absolute or relative) with every point mapped through `m`, as absolute M L Q C Z
 * commands rounded to 0.001. Curves stay curves: an affine map of a Bézier's control points is exact.
 */
export function transformPath(d: string, m: Affine): string {
  const tokens = d.match(PATH_TOKENS) ?? [];
  const r = (v: number) => String(Math.round(v * 1000) / 1000);
  const pt = (px: number, py: number) => `${r(m.a * px + m.c * py + m.tx)} ${r(m.b * px + m.d * py + m.ty)}`;
  const out: string[] = [];
  let cmd = 'M';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M':
        x = sx = ox + num();
        y = sy = oy + num();
        out.push(`M${pt(x, y)}`);
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
      case 'H':
      case 'V':
        if (cmd.toUpperCase() !== 'V') x = ox + num();
        if (cmd.toUpperCase() !== 'H') y = oy + num();
        out.push(`L${pt(x, y)}`);
        break;
      case 'Q': {
        const c = pt(ox + num(), oy + num());
        x = ox + num();
        y = oy + num();
        out.push(`Q${c} ${pt(x, y)}`);
        break;
      }
      case 'C': {
        const c1 = pt(ox + num(), oy + num());
        const c2 = pt(ox + num(), oy + num());
        x = ox + num();
        y = oy + num();
        out.push(`C${c1} ${c2} ${pt(x, y)}`);
        break;
      }
      case 'Z':
        x = sx;
        y = sy;
        out.push('Z');
        break;
      default:
        throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return out.join('');
}

/** Even-odd point-in-shape test over every subpath of every filled path. */
export function shapesContain(shapes: PathShape[], x: number, y: number): boolean {
  return shapes.some((shape) => {
    if (shape.fill === undefined) return false;
    let inside = false;
    for (const p of flattenPath(shape.d)) {
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const xi = p[i]!;
        const yi = p[i + 1]!;
        const xj = p[j]!;
        const yj = p[j + 1]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

/** [minX, minY, maxX, maxY] of the given shapes. */
export function shapesBounds(shapes: PathShape[]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const shape of shapes)
    for (const p of flattenPath(shape.d))
      for (let i = 0; i < p.length; i += 2) {
        b[0] = Math.min(b[0], p[i]!);
        b[1] = Math.min(b[1], p[i + 1]!);
        b[2] = Math.max(b[2], p[i]!);
        b[3] = Math.max(b[3], p[i + 1]!);
      }
  return b;
}

/** Names of the visible slots (decorations aside) whose drawn symbol covers rig-space point (x, y) (y down). */
export function slotsCovering(art: FighterArt, pose: RigPose, x: number, y: number): string[] {
  return art.rig.slots
    .filter((slot) => {
      if (slot.decor) return false;
      const name = pose.symbols[slot.name];
      const sym = name ? art.rig.symbols[name] : undefined;
      if (!Array.isArray(sym)) return false;
      const [lx, ly] = toLocal(pose.world[slot.bone]!, x, y);
      return shapesContain(sym, lx, ly);
    })
    .map((slot) => slot.name);
}

/**
 * Rig-space [minX, minY, maxX, maxY] of every slot drawn in `pose`, decorations included: the renderer draws
 * those too, so a glow or a hat below the floor shows on screen like any other part.
 */
export function poseBounds(art: FighterArt, pose: RigPose): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const slot of art.rig.slots) {
    const name = pose.symbols[slot.name];
    const sym = name ? art.rig.symbols[name] : undefined;
    if (!Array.isArray(sym)) continue;
    const m = pose.world[slot.bone]!;
    for (const shape of sym)
      for (const p of flattenPath(shape.d, 4))
        for (let i = 0; i < p.length; i += 2) {
          const x = m.a * p[i]! + m.c * p[i + 1]! + m.tx;
          const y = m.b * p[i]! + m.d * p[i + 1]! + m.ty;
          b[0] = Math.min(b[0], x);
          b[1] = Math.min(b[1], y);
          b[2] = Math.max(b[2], x);
          b[3] = Math.max(b[3], y);
        }
  }
  return b;
}
