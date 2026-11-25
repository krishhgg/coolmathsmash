import type { Palette } from '../../../render/rig/types';

/**
 * Costumes. `default` is the grey Runner of Run 3; the others are Run 3's other runners as alternates: the Skater
 * (white sneakers), the Lizard (green, with a crest instead of antennae), the Bunny (tan, ears instead of
 * antennae, a black eye) and the Pastafarian (colander and walking stick). Keys a costume does not use keep
 * neutral values, so every palette has the same keys.
 */
const base: Palette = {
  line: '#333333',
  skin: '#999999',
  skinLo: '#7d7d7d',
  skinHi: '#a9a9a9',
  shoe: '#999999',
  shoeFar: '#7d7d7d',
  sole: '#868686',
  soleFar: '#6f6f6f',
  ant: '#999999',
  antHi: '#b3b3b3',
  antLine: '#333333',
  eye: '#85ff78',
  pupil: '#315f2c',
  mouth: '#1a1a1a',
  tongue: '#c75a5a',
  earIn: '#e0afa6',
  crest: '#006600',
  col: '#8c8c8c',
  colHi: '#a6a6a6',
  colHole: '#5a5a5a',
  cane: '#c49a62',
  map: '#c8b788',
  mapLo: '#b4a375',
  mapLine: '#8c7d52',
  fx: '#ffffff',
  tile: '#9fcde8',
  tileLo: '#7aaed0',
  tileLine: '#3d5f78',
};

export const palettes: { default: Palette } & Record<string, Palette> = {
  default: base,
  skater: { ...base, shoe: '#e8e8e8', shoeFar: '#c9c9c9', sole: '#d23a2a', soleFar: '#a82c20' },
  lizard: {
    ...base,
    line: '#003300',
    skin: '#009900',
    skinLo: '#007a00',
    skinHi: '#1aad1a',
    shoe: '#009900',
    shoeFar: '#007a00',
    sole: '#008200',
    soleFar: '#006a00',
    eye: '#8caa23',
    pupil: '#1d2600',
    mouth: '#002200',
  },
  bunny: {
    ...base,
    line: '#876544',
    skin: '#d5a06b',
    skinLo: '#bf8a57',
    skinHi: '#e3b582',
    shoe: '#d5a06b',
    shoeFar: '#bf8a57',
    sole: '#c99660',
    soleFar: '#ae7f4f',
    eye: '#000000',
    pupil: '#000000',
    mouth: '#5c4026',
  },
  pastafarian: { ...base, skinLo: '#6e6e6e', shoeFar: '#6e6e6e' },
};

/** What each costume wears instead of (or as well as) the antennae. */
export const costumeSwaps: Record<string, Record<string, string | null>> = {
  lizard: { antB: null, antF: null, crest: 'crest' },
  bunny: { antB: 'ear', antF: 'ear' },
  pastafarian: { antB: null, antF: null, hat: 'colander', cane: 'cane' },
};
