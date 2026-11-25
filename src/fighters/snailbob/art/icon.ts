import { poseBounds, transformPath } from '../../../render/rig/geometry';
import { samplePose, type Affine } from '../../../render/rig/sample';
import { resolveColor } from '../../../render/rig/svg';
import type { FighterArt, Paint, Palette, PathShape } from '../../../render/rig/types';

const r = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * A standalone SVG of the whole fighter in one pose, framed in a square around it: the stock icon and portrait.
 * Snail Bob is recognised by his shell as much as his face, so the icon shows all of him rather than a head.
 *
 * Each slot's paths are written already mapped through its bone's matrix, with no `transform` attribute: the
 * HUD draws icons with Pixi's SVG reader, which ignores `transform` and would stack every part at the rig
 * origin. Gradient points and radii go through the same matrix, which is exact while the bones only rotate,
 * move and scale evenly, as in an idle pose.
 */
export function poseSvg(
  art: Omit<FighterArt, 'icon'>,
  clip: string,
  frame: number,
  palette: Palette,
): string {
  const full = { ...art, icon: '' };
  const pose = samplePose(full, clip, frame, 0);
  const defs: string[] = [];
  /** How much `m` scales lengths (stroke widths, radii). */
  const scale = (m: Affine) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  const paint = (p: Paint, m: Affine): string => {
    if (typeof p === 'string') return resolveColor(p, palette);
    const id = `g${defs.length}`;
    const at = (x: number, y: number) => [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty].map(r);
    const stops = p.stops
      .map(
        (s) =>
          `<stop offset="${r(s.offset)}" stop-color="${resolveColor(s.color, palette)}" stop-opacity="${r(s.alpha ?? 1)}"/>`,
      )
      .join('');
    if (p.type === 'radial') {
      const [cx, cy] = at(p.cx, p.cy);
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r(p.r * scale(m))}">${stops}</radialGradient>`,
      );
    } else {
      const [x1, y1] = at(p.x0, p.y0);
      const [x2, y2] = at(p.x1, p.y1);
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`,
      );
    }
    return `url(#${id})`;
  };
  const path = (s: PathShape, m: Affine) =>
    `<path d="${transformPath(s.d, m)}" fill="${s.fill === undefined ? 'none' : paint(s.fill, m)}" fill-rule="evenodd"${
      s.stroke
        ? ` stroke="${resolveColor(s.stroke.color, palette)}" stroke-width="${r(s.stroke.width * scale(m))}" stroke-linecap="round" stroke-linejoin="round"`
        : ''
    }/>`;
  const body = art.rig.slots
    .map((slot, i) => ({ slot, i, z: pose.z[slot.name] ?? i }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map(({ slot }) => {
      const name = pose.symbols[slot.name];
      const sym = name ? art.rig.symbols[name] : undefined;
      if (!Array.isArray(sym)) return '';
      const m = pose.world[slot.bone]!;
      return sym.map((s) => path(s, m)).join('');
    })
    .join('');
  const [x0, y0, x1, y1] = poseBounds(full, pose);
  const size = Math.max(x1 - x0, y1 - y0) + 1;
  const box = [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.map(r).join(' ')}"><defs>${defs.join('')}</defs>${body}</svg>`;
}
