/**
 * A standard-mapping gamepad drawn after a Pro Controller, with a tag beside each button naming what it does (the
 * spirit of Ultimate's controls screen). Buttons use the W3C standard indices; face buttons follow the Xbox
 * letters (0 = bottom = A) in Coolmath's four colours.
 */

/** What to print beside each button index (10 and 11 are the sticks, -1 is the D-pad as a whole). */
export type PadTags = Partial<Record<number, string>>;

interface Anchor {
  /** Tag position: x is the tag's left edge (align 'start'), right edge ('end') or centre ('middle'). */
  x: number;
  y: number;
  align: 'start' | 'end' | 'middle';
  /** Where the leader line meets the button. */
  to: [number, number];
}

const ANCHORS: Record<number, Anchor> = {
  6: { x: 138, y: 38, align: 'end', to: [168, 60] },
  4: { x: 138, y: 90, align: 'end', to: [150, 90] },
  10: { x: 138, y: 160, align: 'end', to: [185, 160] },
  [-1]: { x: 138, y: 244, align: 'end', to: [232, 226] },
  7: { x: 502, y: 38, align: 'start', to: [472, 60] },
  5: { x: 502, y: 90, align: 'start', to: [490, 90] },
  3: { x: 502, y: 128, align: 'start', to: [440, 128] },
  1: { x: 502, y: 166, align: 'start', to: [472, 162] },
  0: { x: 502, y: 206, align: 'start', to: [438, 198] },
  11: { x: 502, y: 290, align: 'start', to: [398, 244] },
  8: { x: 250, y: 22, align: 'middle', to: [292, 135] },
  9: { x: 338, y: 22, align: 'middle', to: [346, 135] },
  2: { x: 414, y: 22, align: 'middle', to: [393, 145] },
  16: { x: 330, y: 372, align: 'middle', to: [330, 188] },
};

const FACE: [button: number, x: number, y: number, letter: string, color: string][] = [
  [0, 425, 192, 'A', '#3fcf3a'],
  [1, 457, 160, 'B', '#ee1c1c'],
  [2, 393, 160, 'X', '#2b8ff0'],
  [3, 425, 128, 'Y', '#ffc21a'],
];

const BODY =
  'M200 88 H440 C500 88 530 120 540 170 C552 230 560 300 528 330 C504 352 470 340 452 310 L420 262 H220 L188 310 C170 340 136 352 112 330 C80 300 88 230 100 170 C110 120 140 88 200 88 Z';

function tag(button: number, text: string, lit: boolean): string {
  const a = ANCHORS[button];
  if (!a) return '';
  const w = 20 + text.length * 9.4;
  const left = a.align === 'start' ? a.x : a.align === 'end' ? a.x - w : a.x - w / 2;
  const edge: [number, number] =
    a.align === 'start' ? [a.x, a.y] : a.align === 'end' ? [a.x, a.y] : [a.x, a.y + (a.y > 200 ? -14 : 14)];
  const cls = lit ? 'pad-tag is-lit' : 'pad-tag';
  return `<g class="${cls}"><path class="pad-lead" d="M${edge[0]} ${edge[1]} L${a.to[0]} ${a.to[1]}"/><circle class="pad-lead-dot" cx="${a.to[0]}" cy="${a.to[1]}" r="4"/><rect x="${left}" y="${a.y - 14}" width="${w}" height="28" rx="9"/><text x="${left + w / 2}" y="${a.y + 6}" text-anchor="middle">${text}</text></g>`;
}

/** The controller with `tags` beside their buttons; buttons in `lit` glow (the focused action's). */
export function controllerSvg(tags: PadTags, lit: readonly number[]): string {
  const on = (b: number) => (lit.includes(b) ? ' is-lit' : '');
  const dpad = [
    [12, 254, 192, 22, 26],
    [13, 254, 236, 22, 26],
    [14, 228, 214, 26, 22],
    [15, 276, 214, 26, 22],
  ]
    .map(
      ([b, x, y, w, hh]) =>
        `<rect class="pad-btn pad-dark${on(b!)}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="4"/>`,
    )
    .join('');
  const face = FACE.map(
    ([b, x, y, letter, color]) =>
      `<g class="pad-face${on(b)}"><circle class="pad-btn" cx="${x}" cy="${y}" r="15" style="--face:${color}"/><text x="${x}" y="${y + 6}" text-anchor="middle">${letter}</text></g>`,
  ).join('');
  const stick = (b: number, x: number, y: number) =>
    `<circle class="pad-well" cx="${x}" cy="${y}" r="30"/><circle class="pad-btn pad-stick${on(b)}" cx="${x}" cy="${y}" r="21"/><circle class="pad-stick-top" cx="${x}" cy="${y}" r="12"/>`;
  const tagged = Object.entries(tags)
    .map(([b, text]) => {
      const button = Number(b);
      const isLit = button === -1 ? [12, 13, 14, 15].some((d) => lit.includes(d)) : lit.includes(button);
      return text ? tag(button, text, isLit) : '';
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
<defs><linearGradient id="padBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="0.6" stop-color="#d9dee8"/><stop offset="1" stop-color="#a9b2c3"/></linearGradient></defs>
<rect class="pad-btn pad-shoulder${on(6)}" x="156" y="50" width="84" height="34" rx="12"/>
<rect class="pad-btn pad-shoulder${on(7)}" x="400" y="50" width="84" height="34" rx="12"/>
<rect class="pad-btn pad-bumper${on(4)}" x="140" y="74" width="122" height="30" rx="14"/>
<rect class="pad-btn pad-bumper${on(5)}" x="378" y="74" width="122" height="30" rx="14"/>
<path class="pad-body" d="${BODY}" fill="url(#padBody)"/>
<path class="pad-shine" d="M206 100 H434 C482 100 508 124 520 160" />
${stick(10, 215, 160)}
${stick(11, 375, 226)}
<circle class="pad-well" cx="265" cy="225" r="44"/>
<rect class="pad-dark" x="254" y="214" width="22" height="22"/>
${dpad}
<rect class="pad-btn pad-dark pad-small${on(8)}" x="281" y="134" width="24" height="12" rx="6"/>
<rect class="pad-btn pad-dark pad-small${on(9)}" x="335" y="134" width="24" height="12" rx="6"/>
<path class="pad-mark" d="M288 140 H298 M342 140 H352 M347 135 V145"/>
<circle class="pad-btn pad-dark pad-small${on(16)}" cx="330" cy="178" r="9"/>
${face}
${tagged}
</svg>`;
}
