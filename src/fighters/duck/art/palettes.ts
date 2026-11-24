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
  beakLo: '#ec8a00',
  mouth: '#000000',
  leg: '#000000',
  crest: '#262626',
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
 * Costumes. `default` is the Duck Life 1 duckling. `crown` is the same duckling wearing the champion's Crown hat
 * (its `hat` slot is switched on in `costumeSwaps`). `evil` is the Champion Duck, DuckLife 3's dark final boss
 * with red eyes, a red beak and a spiked crest (`costumeSwaps` again). The rest are Duck Life 1 shop paints:
 * Crazy Red, Sky Blue and Midnight Black.
 */
export const palettes = {
  default: yellow,
  crown: yellow,
  evil: {
    ...yellow,
    body: '#4a4a4a',
    feather: '#6e6e6e',
    iris: '#ff1f1f',
    beak: '#ff3048',
    beakLo: '#c8102e',
    mouth: '#1a0006',
    crest: '#2a2a2a',
  },
  red: { ...yellow, body: '#ff1a00', feather: '#ff7a66' },
  blue: { ...yellow, body: '#0099ff', feather: '#7cc8ff' },
  black: {
    ...yellow,
    line: '#6a6a78',
    leg: '#6a6a78',
    body: '#26262c',
    feather: '#4a4a55',
    beak: '#ff9900',
    beakLo: '#d67600',
  },
} satisfies Record<string, Palette>;
