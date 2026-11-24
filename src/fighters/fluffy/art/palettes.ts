import type { Palette } from '../../../render/rig/types';

/** IQ Ball (Coolmath, 2011): the dark purple Fluffy with black pupils and a purple line. */
const iqBall: Palette = {
  line: '#1c0b36',
  furDark: '#3c1a7c',
  fur: '#5a2db0',
  furLight: '#7650d4',
  furHi: '#a585f0',
  eye: '#ffffff',
  eyeShade: '#c9cde6',
  iris: '#17132a',
  pupil: '#000000',
  glint: '#ffffff',
  mouth: '#2b0a24',
  tongue: '#e23a56',
  grab: '#6a3cc4',
  grabDark: '#3c1a7c',
  grabHi: '#b597ff',
  candy: '#e5232d',
  candyHi: '#ffffff',
  reticle: '#7046f0',
  dust: '#efe6d2',
  dustLine: '#8c7a5a',
};

/**
 * Costumes: `default` is IQ Ball's purple; `candy` the royal blue of Catch the Candy (teal irises, as on its
 * title art); `xmas` and `halloween` dress him for Catch the Candy's two holiday editions; `lime` is a fifth
 * colour so four players never clash.
 */
export const palettes = {
  default: iqBall,
  candy: {
    ...iqBall,
    line: '#0e1446',
    furDark: '#22309a',
    fur: '#3549c8',
    furLight: '#5370e6',
    furHi: '#8fa8ff',
    iris: '#1c8c99',
    pupil: '#071a24',
    grab: '#3e57d6',
    grabDark: '#22309a',
    grabHi: '#9db2ff',
    reticle: '#2f7fe8',
  },
  xmas: {
    ...iqBall,
    line: '#3a0610',
    furDark: '#8c0d1e',
    fur: '#c51f2e',
    furLight: '#e8464c',
    furHi: '#ffffff',
    iris: '#0f5a2a',
    grab: '#1f8a3a',
    grabDark: '#0d4a1e',
    grabHi: '#ffffff',
    reticle: '#e8b923',
  },
  halloween: {
    ...iqBall,
    line: '#1e0c00',
    furDark: '#a14400',
    fur: '#e2690a',
    furLight: '#ff9224',
    furHi: '#ffd27a',
    iris: '#6c1fc4',
    grab: '#3a2346',
    grabDark: '#170c1e',
    grabHi: '#8a63a8',
    candy: '#ff7a00',
    candyHi: '#2a1a10',
    reticle: '#62e03c',
  },
  lime: {
    ...iqBall,
    line: '#0b2412',
    furDark: '#1f6b34',
    fur: '#2f9e4c',
    furLight: '#55c46c',
    furHi: '#a6f0a8',
    iris: '#3a2a10',
    grab: '#2c8a44',
    grabDark: '#174d26',
    grabHi: '#9be8a4',
    reticle: '#2fae56',
  },
} satisfies Record<string, Palette>;
