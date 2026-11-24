import type { Palette } from '../../../render/rig/types';

/** Fireboy's colours, chosen by eye: a red flame with an orange heart, yellow eyes and a red stick body. */
const fire: Palette = {
  line: '#160606',
  fire: '#ff2a12',
  fireLo: '#d80f08',
  fireMid: '#ff6a18',
  fireHot: '#ffa228',
  fireCore: '#ffe066',
  fxLine: '#7a0e05',
  eye: '#fff45c',
  eyeRim: '#ffa81c',
  mouth: '#5a0805',
  tongue: '#e0402a',
  teeth: '#fff6d8',
  skin: '#e8180c',
  skinHi: '#ff5a30',
  skinLo: '#a00a06',
  aura: '#ff9a40',
};

/**
 * Costumes, from the roster's temple alts: Crystal Temple violet, Ice Temple pale blue and Light Temple gold.
 * Watergirl has costumes of the same names, so a port keeps its costume across a swap. In a mirror match the
 * second port takes the first alternate, so the most distinct one comes first.
 */
export const palettes = {
  default: fire,
  crystal: {
    ...fire,
    fire: '#b23cff',
    fireLo: '#7a14d8',
    fireMid: '#e070ff',
    fireHot: '#ffa8f4',
    fireCore: '#fff0ff',
    fxLine: '#3c0a6e',
    eye: '#fff0ff',
    eyeRim: '#ff9cf0',
    mouth: '#2e0656',
    tongue: '#c04ad8',
    skin: '#8a22d8',
    skinHi: '#b862ff',
    skinLo: '#520e8a',
    aura: '#d090ff',
  },
  ice: {
    ...fire,
    fire: '#7fd6ff',
    fireLo: '#3c9ae8',
    fireMid: '#c4f0ff',
    fireHot: '#eefbff',
    fireCore: '#ffffff',
    fxLine: '#123a6e',
    line: '#0c1a2e',
    eye: '#ffffff',
    eyeRim: '#9fe0ff',
    mouth: '#0e2a52',
    tongue: '#5a9ad8',
    skin: '#4aa8ec',
    skinHi: '#9ad8ff',
    skinLo: '#1c62a8',
    aura: '#a8e4ff',
  },
  light: {
    ...fire,
    fire: '#ffc21a',
    fireLo: '#f08a00',
    fireMid: '#ffe066',
    fireHot: '#fff3b0',
    fireCore: '#ffffff',
    fxLine: '#6e4200',
    eye: '#ffffff',
    eyeRim: '#ffd84a',
    mouth: '#5a3000',
    tongue: '#e08a1a',
    skin: '#f0a000',
    skinHi: '#ffd04a',
    skinLo: '#a86400',
    aura: '#fff0a0',
  },
} satisfies Record<string, Palette>;
