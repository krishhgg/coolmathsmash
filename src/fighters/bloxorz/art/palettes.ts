import type { Palette } from '../../../render/rig/types';

/**
 * The rusty block from Bloxorz (2007): dark steel beneath copper-rust clouds, a lit top face
 * and a shaded side face. Picked by eye from the game's screenshots, not sampled from its files.
 */
const rusty: Palette = {
  line: '#271d1b',
  steel: '#503a32',
  steelDark: '#313439',
  steelLight: '#987360',
  rust: '#915637',
  rust2: '#aa6b48',
  rust3: '#5e3021',
  rim: '#432d29',
  top: '#7b6860',
  topRust: '#936e59',
  bevelEdge: '#99745e',
  side: '#4d3733',
  sideStain: '#45403e',
  dust: '#dccfbd',
  dustLine: '#5d4c3d',
  spark: '#fff1bd',
  star: '#ffd23f',
  trail: '#b9a487',
  chip: '#00000000',
  vein: '#00000000',
  sheen: '#00000000',
  tile: '#bfc3c9',
  tileTop: '#e3e5e9',
  tileSide: '#80858d',
};

/**
 * Costumes. `default` is the original; `fragile` is the game's smooth orange tile (no rust at all: the cloud tones
 * sit on the base and only the chipped corners darken), `stone` is the pale chalky floor tile with low-contrast
 * veining, and `monolith` is the video's 2001 joke, a quiet near-black slab carried by a cold rim light.
 */
function shaded(palette: Palette): Palette {
  const mix = (low: string, high: string, n: number) =>
    '#' +
    [1, 3, 5]
      .map((i) => {
        const a = parseInt(low.slice(i, i + 2), 16);
        const b = parseInt(high.slice(i, i + 2), 16);
        return Math.round(a + ((b - a) * n) / 16)
          .toString(16)
          .padStart(2, '0');
      })
      .join('');
  const colors = { ...palette };
  for (let i = 0; i <= 16; i++) {
    colors[`plane${i}`] = mix(palette.side!, palette.top!, i);
    colors[`stain${i}`] = mix(palette.sideStain!, palette.topRust!, i);
  }
  return colors;
}

export const palettes = {
  default: shaded(rusty),
  fragile: shaded({
    ...rusty,
    line: '#3a1405',
    steel: '#e07a36',
    steelDark: '#e07a36',
    steelLight: '#ec9250',
    rust: '#e07a36',
    rust2: '#e07a36',
    rust3: '#b95a1c',
    rim: '#a94c14',
    top: '#f7a862',
    topRust: '#f7a862',
    bevelEdge: '#ffd9a8',
    side: '#a8500f',
    sideStain: '#a8500f',
    chip: '#ad531d',
    sheen: '#ffb27695',
    tile: '#f0b277',
    tileTop: '#ffd7a6',
    tileSide: '#9b4313',
  }),
  stone: shaded({
    ...rusty,
    line: '#20232a',
    steel: '#a9aeb5',
    steelDark: '#a3a8af',
    steelLight: '#b7bcc2',
    rust: '#a9aeb5',
    rust2: '#a9aeb5',
    rust3: '#848a93',
    rim: '#666c75',
    top: '#d6d9dd',
    topRust: '#d6d9dd',
    bevelEdge: '#eceef0',
    side: '#7a8088',
    sideStain: '#7a8088',
    vein: '#777e88a0',
  }),
  monolith: shaded({
    ...rusty,
    line: '#000000',
    steel: '#23262f',
    steelDark: '#23262f',
    steelLight: '#2a2e38',
    rust: '#23262f',
    rust2: '#23262f',
    rust3: '#0f1116',
    rim: '#0a0b0f',
    top: '#3f4451',
    topRust: '#3f4451',
    bevelEdge: '#7d879e',
    side: '#191b22',
    sideStain: '#191b22',
    sheen: '#778ca5',
    trail: '#4a5268',
  }),
} satisfies Record<string, Palette>;
