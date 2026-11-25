import type { Palette } from '../../../render/rig/types';

/**
 * Watergirl's placeholder mannequin: cool ash wood with dark ink, and blue water for the attack effects. Her
 * costumes keep Fireboy's names, so a port keeps its costume through the down-special swap.
 */
const ash: Palette = {
  line: '#232a33',
  skin: '#bccad8',
  skinHi: '#e4ecf4',
  skinLo: '#8394a8',
  fx: '#2f8cff',
  fxHot: '#7cc4ff',
  fxCore: '#eef8ff',
  fxLine: '#0d3570',
};

export const palettes = {
  default: ash,
  light: {
    ...ash,
    skin: '#e8dcc0',
    skinHi: '#fbf3e0',
    skinLo: '#b8a57e',
    fx: '#ffc21a',
    fxHot: '#ffe27a',
    fxCore: '#fffbe6',
    fxLine: '#7a5200',
  },
  ice: {
    ...ash,
    skin: '#dbe9f0',
    skinHi: '#f6fbfd',
    skinLo: '#9db7c6',
    fx: '#5fd4ff',
    fxHot: '#b2ecff',
    fxCore: '#f4fdff',
    fxLine: '#0f4a6a',
  },
  crystal: {
    ...ash,
    skin: '#c4b4dc',
    skinHi: '#e6dcf4',
    skinLo: '#8a76a8',
    fx: '#9a4cff',
    fxHot: '#c894ff',
    fxCore: '#f6ecff',
    fxLine: '#3e1078',
  },
  twin: {
    ...ash,
    skin: '#d9bd91',
    skinHi: '#f2e0bf',
    skinLo: '#a9895f',
    line: '#2e2620',
    fx: '#ff6a1a',
    fxHot: '#ffa53a',
    fxCore: '#fff1a8',
    fxLine: '#8a2a0a',
  },
} satisfies Record<string, Palette>;
