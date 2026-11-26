import { flattenPath } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { moveClips } from './attacks';
import { LIE, STAND, type Form } from './bake';
import { actionClips, grip } from './clips';
import { finalSmashClips } from './finalSmash';
import { palettes } from './palettes';
import { rig } from './rig';
import { iconSymbols } from './symbols';

const ICON_LAYERS = ['tile', 'bevel', 'face'];

/**
 * The icon's viewBox: a square centred on the drawing with a 1-unit margin for the outline, so the HUD's portrait
 * and stock boxes (which fit the viewBox) show it whole and centred.
 */
function iconBox(): [number, number, number, number] {
  const points = ICON_LAYERS.flatMap((name) => {
    const sym = iconSymbols[name];
    return Array.isArray(sym) ? sym.flatMap((shape) => flattenPath(shape.d).flat()) : [];
  });
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = Math.max(x1 - x0, y1 - y0) + 2;
  return [(x0 + x1 - size) / 2, (y0 + y1 - size) / 2, size, size];
}

/** The standing block on a stone tile, for stock icons and the HUD portrait. */
const icon = symbolsToSvg(iconSymbols, ICON_LAYERS, palettes.default, iconBox());

function formArt(form: Form, height: number): FighterArt {
  return {
    height,
    rig,
    clips: { ...actionClips(form), ...moveClips(form), ...finalSmashClips(form) },
    palettes,
    icon,
    ledgeGrip: grip(form),
  };
}

/**
 * Bloxorz block (Bloxorz, Damien Clarke, 2007), drawn from scratch: one rig and palette set for both forms, with
 * clips per form because the simulation swaps `bloxorz` (Standing, 12 x 24) and `bloxorz-lying` (Lying, 24 x 12)
 * mid-tip. Plain data: no Pixi imports.
 */
export const art = formArt(STAND, 26);
export const lyingArt = formArt(LIE, 14);
