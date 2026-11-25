import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { moveClips } from './attacks';
import { LIE, STAND, type Form } from './bake';
import { actionClips, grip } from './clips';
import { palettes } from './palettes';
import { rig } from './rig';
import { iconSymbols } from './symbols';

/** The standing block on a stone tile, for stock icons and the HUD portrait. */
const icon = symbolsToSvg(iconSymbols, ['tile', 'bevel', 'face'], palettes.default, [-11, -28, 24, 32]);

function formArt(form: Form, height: number): FighterArt {
  return {
    height,
    rig,
    clips: { ...actionClips(form), ...moveClips(form) },
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
