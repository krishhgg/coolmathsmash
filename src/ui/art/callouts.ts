/** The big slanted announcements over the match: 3, 2, 1, GO!, GAME! and TIME!. */
export type CalloutStyle = 'steel' | 'count' | 'game' | 'time';

interface Look {
  stops: [offset: number, color: string][];
  rim: string;
  /** A thin line between the rim and the fill. */
  line: string;
  /** Darker blotches through the fill, like Ultimate's flame-marbled GO!. */
  marble?: [r: number, g: number, b: number];
}

const LOOKS: Record<CalloutStyle, Look> = {
  steel: {
    stops: [
      [0, '#ffffff'],
      [0.5, '#c9cfd8'],
      [0.56, '#8f98a6'],
      [1, '#eef1f4'],
    ],
    rim: '#0b0d12',
    line: '#0b0d12',
  },
  count: {
    stops: [
      [0, '#fff7b0'],
      [0.32, '#ffd51c'],
      [0.68, '#ff8a00'],
      [1, '#e3260d'],
    ],
    rim: '#160904',
    line: '#160904',
    marble: [0.93, 0.16, 0.04],
  },
  game: {
    stops: [
      [0, '#f6ffc4'],
      [0.38, '#c2f53e'],
      [0.72, '#4fc41d'],
      [1, '#167d13'],
    ],
    rim: '#0a1606',
    line: '#e8c24a',
  },
  time: {
    stops: [
      [0, '#fff3c4'],
      [0.38, '#ffcf3a'],
      [0.72, '#ff8d1c'],
      [1, '#c24a0a'],
    ],
    rim: '#170a03',
    line: '#e8c24a',
  },
};

const SIZE = 200;
const BASELINE = 230;
const HEIGHT = 300;
const SLANT = 0.18;

/** SVG markup for one callout; the text is drawn in the display face, slanted, with a black rim and a white halo. */
export function calloutSvg(text: string, style: CalloutStyle): string {
  const look = LOOKS[style];
  const width = Math.round(text.length * SIZE * 0.6 + 140);
  const id = `co-${style}`;
  const label = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const layer = (attrs: string) =>
    `<text x="${width / 2}" y="${BASELINE}" text-anchor="middle" textLength="${width - 140}" lengthAdjust="spacingAndGlyphs" ${attrs}>${label}</text>`;
  const stops = look.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const marble = look.marble
    ? `<filter id="${id}-marble" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.011 0.024" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 ${look.marble[0]} 0 0 0 0 ${look.marble[1]} 0 0 0 0 ${look.marble[2]} 3.4 0 0 0 -1.45"/><feComposite in2="SourceAlpha" operator="in"/></filter>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${HEIGHT}" class="callout-${style}">
<defs><linearGradient id="${id}-fill" x1="0" y1="${BASELINE - SIZE * 0.72}" x2="0" y2="${BASELINE}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>
<linearGradient id="${id}-shine" x1="0" y1="${BASELINE - SIZE * 0.75}" x2="0" y2="${BASELINE - SIZE * 0.2}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.7"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.56" stop-color="#fff" stop-opacity="0"/></linearGradient>${marble}</defs>
<g font-family="'Lilita One', 'Arial Black', sans-serif" font-size="${SIZE}" stroke-linejoin="round" transform="translate(${BASELINE * SLANT} 0) skewX(${-Math.round((Math.atan(SLANT) * 180) / Math.PI)})">
${layer('fill="#fff" stroke="#fff" stroke-width="46"')}
${layer(`fill="${look.rim}" stroke="${look.rim}" stroke-width="30"`)}
${layer(`fill="url(#${id}-fill)" stroke="${look.line}" stroke-width="7" paint-order="stroke"`)}
${look.marble ? layer(`fill="#fff" filter="url(#${id}-marble)"`) : ''}
${layer(`fill="url(#${id}-shine)"`)}
</g></svg>`;
}
