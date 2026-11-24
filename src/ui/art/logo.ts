/**
 * Coolmath Smash branding as SVG markup: the Coolmath planet (green world, blue ring, after the 2009-2014 Coolmath
 * Games logo) standing in for the Smash Ball, and the game logo built on it. Text uses the page's Lilita One face.
 */

let uid = 0;

/** The planet emblem in a 200x200 box: back half of the ring, the world, then the front half over it. */
export function planetSvg(
  opts: { world?: string; ring?: string; outline?: string; glow?: boolean } = {},
): string {
  const id = `pl${++uid}`;
  const world = opts.world ?? '#3fcf3a';
  const ring = opts.ring ?? '#2b8ff0';
  const ink = opts.outline ?? '#0b1a33';
  const ringPath = (front: boolean) =>
    `<path d="${front ? 'M10 104 A92 26 -14 0 0 190 96' : 'M10 104 A92 26 -14 0 1 190 96'}" fill="none" stroke="${ink}" stroke-width="24" stroke-linecap="round"/>` +
    `<path d="${front ? 'M10 104 A92 26 -14 0 0 190 96' : 'M10 104 A92 26 -14 0 1 190 96'}" fill="none" stroke="${ring}" stroke-width="14" stroke-linecap="round"/>` +
    (front
      ? `<path d="M30 116 A92 26 -14 0 0 120 122" fill="none" stroke="#bfe3ff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`
      : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
<radialGradient id="${id}g" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#b9ff9a"/><stop offset="0.35" stop-color="${world}"/><stop offset="1" stop-color="#127a22"/></radialGradient>
<radialGradient id="${id}h" cx="0.5" cy="0.5" r="0.5"><stop offset="0.6" stop-color="#9fdcff" stop-opacity="0.55"/><stop offset="1" stop-color="#9fdcff" stop-opacity="0"/></radialGradient>
</defs>
${opts.glow ? `<circle cx="100" cy="100" r="99" fill="url(#${id}h)"/>` : ''}
${ringPath(false)}
<circle cx="100" cy="100" r="64" fill="url(#${id}g)" stroke="${ink}" stroke-width="7"/>
<path d="M62 78 Q78 52 108 46" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.55"/>
<path d="M58 118 Q70 104 92 112 Q104 118 120 108 Q132 100 150 108" fill="none" stroke="#1f9a2a" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
${ringPath(true)}
</svg>`;
}

/** "COOLMATH" in Coolmath's red-and-yellow bubble lettering over "SMASH" in Smash's white and black, on the planet. */
export function logoSvg(): string {
  const id = `lg${++uid}`;
  const word = (
    text: string,
    y: number,
    size: number,
    fill: string,
    inner: string,
    outer: number,
    spacing: number,
  ) =>
    [
      `<text x="450" y="${y}" font-size="${size}" letter-spacing="${spacing}" stroke="#0b0f1c" stroke-width="${outer}" stroke-linejoin="round" fill="#0b0f1c">${text}</text>`,
      `<text x="450" y="${y}" font-size="${size}" letter-spacing="${spacing}" stroke="${inner}" stroke-width="${outer * 0.45}" stroke-linejoin="round" fill="${fill}">${text}</text>`,
    ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 460">
<defs>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f1f3f6"/><stop offset="0.56" stop-color="#cfd5de"/><stop offset="1" stop-color="#9aa4b4"/></linearGradient>
<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a4a"/><stop offset="0.5" stop-color="#ee1c1c"/><stop offset="1" stop-color="#b80d12"/></linearGradient>
<radialGradient id="${id}w" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#b9ff9a"/><stop offset="0.35" stop-color="#3fcf3a"/><stop offset="1" stop-color="#127a22"/></radialGradient>
<radialGradient id="${id}h" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="#7fc8ff" stop-opacity="0.5"/><stop offset="1" stop-color="#7fc8ff" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="450" cy="214" r="250" fill="url(#${id}h)"/>
<g transform="rotate(-9 450 236)" fill="none" stroke-linecap="round">
<path d="M28 236 A422 74 0 0 1 872 236" stroke="#0b0f1c" stroke-width="44"/>
<path d="M28 236 A422 74 0 0 1 872 236" stroke="#2b8ff0" stroke-width="28"/>
</g>
<circle cx="450" cy="214" r="168" fill="url(#${id}w)" stroke="#0b0f1c" stroke-width="12"/>
<path d="M352 150 Q392 86 470 72" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity="0.5"/>
<g transform="rotate(-9 450 236)" fill="none" stroke-linecap="round">
<path d="M28 236 A422 74 0 0 0 872 236" stroke="#0b0f1c" stroke-width="44"/>
<path d="M28 236 A422 74 0 0 0 872 236" stroke="#2b8ff0" stroke-width="28"/>
<path d="M70 262 A422 74 0 0 0 420 310" stroke="#bfe3ff" stroke-width="6" opacity="0.7"/>
</g>
<g font-family="'Lilita One', 'Arial Black', sans-serif" text-anchor="middle" paint-order="stroke">
${word('COOLMATH', 196, 118, `url(#${id}r)`, '#ffe40f', 26, 4)}
${word('SMASH', 372, 196, `url(#${id}s)`, '#ffffff', 30, 8)}
</g>
</svg>`;
}
