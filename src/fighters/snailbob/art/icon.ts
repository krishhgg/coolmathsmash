import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { resolveColor } from '../../../render/rig/svg';
import type { FighterArt, Paint, Palette, PathShape } from '../../../render/rig/types';

const r = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * A standalone SVG of the whole fighter in one pose (each slot's symbol under its bone's matrix), framed in a
 * square around it: the stock icon and portrait. Snail Bob is recognised by his shell as much as his face, so the
 * icon shows all of him rather than a head.
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
  const paint = (p: Paint): string => {
    if (typeof p === 'string') return resolveColor(p, palette);
    const id = `g${defs.length}`;
    const stops = p.stops
      .map(
        (s) =>
          `<stop offset="${r(s.offset)}" stop-color="${resolveColor(s.color, palette)}" stop-opacity="${r(s.alpha ?? 1)}"/>`,
      )
      .join('');
    defs.push(
      p.type === 'radial'
        ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${r(p.cx)}" cy="${r(p.cy)}" r="${r(p.r)}">${stops}</radialGradient>`
        : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r(p.x0)}" y1="${r(p.y0)}" x2="${r(p.x1)}" y2="${r(p.y1)}">${stops}</linearGradient>`,
    );
    return `url(#${id})`;
  };
  const path = (s: PathShape) =>
    `<path d="${s.d}" fill="${s.fill === undefined ? 'none' : paint(s.fill)}" fill-rule="evenodd"${
      s.stroke
        ? ` stroke="${resolveColor(s.stroke.color, palette)}" stroke-width="${r(s.stroke.width)}" stroke-linecap="round" stroke-linejoin="round"`
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
      return `<g transform="matrix(${[m.a, m.b, m.c, m.d, m.tx, m.ty].map(r).join(' ')})">${sym.map(path).join('')}</g>`;
    })
    .join('');
  const [x0, y0, x1, y1] = poseBounds(full, pose);
  const size = Math.max(x1 - x0, y1 - y0) + 1;
  const box = [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.map(r).join(' ')}"><defs>${defs.join('')}</defs>${body}</svg>`;
}
