import type { Palette } from '../../../render/rig/types';

/** The placeholder mannequin: light wood with dark ink, and orange fire for the attack effects. */
const wood: Palette = {
  line: '#2e2620',
  skin: '#d9bd91',
  skinHi: '#f2e0bf',
  skinLo: '#a9895f',
  fx: '#ff6a1a',
  fxHot: '#ffa53a',
  fxCore: '#fff1a8',
  fxLine: '#8a2a0a',
};

/**
 * Costumes, named for the roster's temple palettes (Light, Ice and Crystal Temple) plus `twin`, Fireboy in his
 * twin's colours. Watergirl's palettes use the same names, so a port keeps its costume through the swap.
 */
export const palettes = {
  default: wood,
  light: {
    ...wood,
    skin: '#ecdcb4',
    skinHi: '#fcf4de',
    skinLo: '#bba377',
    fx: '#ffc21a',
    fxHot: '#ffe27a',
    fxCore: '#fffbe6',
    fxLine: '#7a5200',
  },
  ice: {
    ...wood,
    skin: '#dfe6ea',
    skinHi: '#f8fbfc',
    skinLo: '#a3b2bb',
    fx: '#4fc3ff',
    fxHot: '#a8e6ff',
    fxCore: '#f0fbff',
    fxLine: '#0f4a7a',
  },
  crystal: {
    ...wood,
    skin: '#c9b3d9',
    skinHi: '#e9dcf3',
    skinLo: '#8f76a6',
    fx: '#b04cff',
    fxHot: '#d494ff',
    fxCore: '#f6e8ff',
    fxLine: '#4a1080',
  },
  twin: {
    ...wood,
    line: '#232a33',
    skin: '#bccad8',
    skinHi: '#e4ecf4',
    skinLo: '#8394a8',
    fx: '#2f8cff',
    fxHot: '#7cc4ff',
    fxCore: '#eef8ff',
    fxLine: '#0d3570',
  },
} satisfies Record<string, Palette>;
