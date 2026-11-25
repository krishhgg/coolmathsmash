/** Placing numerals for the results: gold with laurels for 1st, then silver, bronze and steel. */
const METALS: [top: string, mid: string, bottom: string][] = [
  ['#fff6b8', '#ffd21f', '#c98a06'],
  ['#ffffff', '#d5dbe6', '#8e97a8'],
  ['#ffe0c2', '#e0904a', '#8f4a17'],
  ['#e6e9ef', '#a3aab8', '#5c6372'],
];

const LEAF = 'M0 0 C5 -8 15 -9 22 -4 C15 1 6 3 0 0 Z';

function laurel(cx: number, cy: number, side: 1 | -1): string {
  const leaves: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (200 + i * 26) * (Math.PI / 180);
    const x = cx + side * Math.cos(a) * -58;
    const y = cy + Math.sin(a) * -64;
    const rot = side * (i * 26 - 60);
    leaves.push(
      `<path d="${LEAF}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(${side} 1)" fill="#3f7d2a" stroke="#132a0c" stroke-width="2.5"/>`,
    );
  }
  return leaves.join('');
}

/** SVG markup for a placing: the digit in metal with a black rim, and laurels for 1st place. */
export function placeSvg(place: number): string {
  const [a, b, c] = METALS[Math.min(place, 4) - 1] ?? METALS[3]!;
  const id = `place-${place}`;
  const digit = (attrs: string) =>
    `<text x="100" y="168" text-anchor="middle" font-family="'Lilita One', 'Arial Black', sans-serif" font-size="190" ${attrs}>${place}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="${id}" x1="0" y1="40" x2="0" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${a}"/><stop offset="0.5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
${place === 1 ? laurel(100, 112, 1) + laurel(100, 112, -1) : ''}
<g stroke-linejoin="round" transform="translate(16 0) skewX(-6)">
${digit('fill="#0b0d14" stroke="#0b0d14" stroke-width="26"')}
${digit(`fill="url(#${id})" stroke="${c}" stroke-width="4" paint-order="stroke"`)}
</g></svg>`;
}
