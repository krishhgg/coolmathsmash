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

/** Costumes: the same mannequin in other woods, so mirror matches stay readable. */
export const palettes = {
  default: wood,
  ash: {
    ...wood,
    skin: '#c9c4ba',
    skinHi: '#ebe7df',
    skinLo: '#948e83',
    fx: '#3a8cff',
    fxHot: '#7cc0ff',
    fxCore: '#e6f6ff',
    fxLine: '#123a7a',
  },
  walnut: {
    ...wood,
    skin: '#8a5a36',
    skinHi: '#b07c50',
    skinLo: '#5c3a20',
    line: '#1a120c',
    fx: '#ffcc1a',
    fxHot: '#ffe36a',
    fxCore: '#fffbe0',
    fxLine: '#7a5200',
  },
  cherry: {
    ...wood,
    skin: '#c46a5a',
    skinHi: '#e39a88',
    skinLo: '#8a3e32',
    fx: '#b04cff',
    fxHot: '#d494ff',
    fxCore: '#f6e8ff',
    fxLine: '#4a1080',
  },
} satisfies Record<string, Palette>;
