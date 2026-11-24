import type { Palette } from '../../../render/rig/types';

/** Duck Life's duckling: bright yellow, black ink, a white eye with a cyan iris and an orange beak. */
const yellow: Palette = {
  line: '#000000',
  body: '#ffff00',
  feather: '#ffff80',
  eye: '#ffffff',
  iris: '#00ccff',
  pupil: '#000000',
  beak: '#ffb300',
  mouth: '#a83200',
  leg: '#000000',
  web: '#ff9900',
  crown: '#ffe600',
  crownHi: '#ffffff',
  crownLo: '#a89a00',
  puff: '#ffffff',
  puffLine: '#c3ccd8',
  swoosh: '#ffffff',
  star: '#fff36b',
  starCore: '#ffffff',
};

/**
 * Costumes. `default` is the Duck Life 1 duckling. `evil` is the Champion Duck, DuckLife 3's dark final boss with
 * red eyes and a red beak. Three are Duck Life 1 shop paints (Crazy Red, Sky Blue, Midnight Black). `crown` is the
 * yellow duck wearing the champion's Crown hat, which the `hat` slot draws once costumes can show slots.
 */
export const palettes = {
  default: yellow,
  evil: {
    ...yellow,
    body: '#4a4a4a',
    feather: '#6e6e6e',
    iris: '#ff1f1f',
    beak: '#ff3048',
    mouth: '#4a0010',
    web: '#d0263c',
  },
  red: { ...yellow, body: '#ff1a00', feather: '#ff7a66' },
  blue: { ...yellow, body: '#0099ff', feather: '#7cc8ff' },
  black: { ...yellow, body: '#262626', feather: '#4d4d4d', beak: '#ff9900' },
  crown: yellow,
} satisfies Record<string, Palette>;
