import { resolveSymbol } from './sample';
import type { ArtSymbol, Paint, Palette, PathShape } from './types';

/** A palette key resolved through `palette`; literal '#...' colours pass through. Unknown keys are magenta. */
export function resolveColor(ref: string, palette: Palette): string {
  return ref.startsWith('#') ? ref : (palette[ref] ?? '#ff00ff');
}

const r = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * Standalone SVG markup for symbols drawn on top of each other (first is backmost), e.g. a head icon. Movie-clip
 * symbols show their first frame.
 */
export function symbolsToSvg(
  symbols: Record<string, ArtSymbol>,
  layers: string[],
  palette: Palette,
  viewBox: [number, number, number, number],
): string {
  const defs: string[] = [];
  const paint = (p: Paint): string => {
    if (typeof p === 'string') return resolveColor(p, palette);
    const id = `g${defs.length}`;
    const stops = p.stops
      .map(
        (s) =>
          `<stop offset="${r(s.offset)}" stop-color="${resolveColor(s.color, palette)}"${s.alpha === undefined ? '' : ` stop-opacity="${r(s.alpha)}"`}/>`,
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
  const body = layers
    .map((name) => {
      const leaf = resolveSymbol(symbols, name, 0);
      const sym = leaf ? symbols[leaf] : undefined;
      return Array.isArray(sym) ? sym.map(path).join('') : '';
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.map(r).join(' ')}"><defs>${defs.join('')}</defs>${body}</svg>`;
}
