import type { PathShape } from '../../../render/rig/types';
import { ANKLE } from './parts';
import { ellipse, poly, smooth, star, type P } from './shapes';

/**
 * Max Upgrade's effects (the Final Smash, src/fighters/johnny/finalSmash.ts), drawn by hand in the game's flat Flash
 * look: a coin-gold upgrade aura that flares behind him as he buys every upgrade at once, and the flame jets his
 * fully upgraded boots fire from their soles.
 */

const inked = (d: string, fill: string, line: string, width: number): PathShape => ({
  d,
  fill,
  stroke: { color: line, width },
});

/** The aura's outer radius at scale 1, about his half-height: fx4 sits on his middle. */
export const AURA_RADIUS = 10;

/** An up-arrow chevron (the shop's upgrade mark) centred on (x, y), `s` wide. */
function chevron(x: number, y: number, s: number): PathShape {
  const h = s * 0.5;
  return inked(
    poly([
      [x, y - h],
      [x + s * 0.5, y],
      [x + s * 0.28, y],
      [x, y - h * 0.48],
      [x - s * 0.28, y],
      [x - s * 0.5, y],
    ]),
    'coinHi',
    'coinLine',
    0.1,
  );
}

/**
 * Drawing `k` of the aura: a soft gold glow, twelve rays alternating long and short that turn a step each drawing,
 * sparkles round the rim, and upgrade chevrons rising past him.
 */
function aura(k: number): PathShape[] {
  const R = AURA_RADIUS;
  const turn = k * 10;
  const shapes: PathShape[] = [
    {
      d: ellipse(0, 0, R),
      fill: {
        type: 'radial',
        cx: 0,
        cy: 0,
        r: R,
        stops: [
          { offset: 0, color: 'coinHi', alpha: 0.75 },
          { offset: 0.55, color: 'coin', alpha: 0.4 },
          { offset: 1, color: 'coin', alpha: 0 },
        ],
      },
    },
  ];
  for (let i = 0; i < 12; i++) {
    const a = ((turn + i * 30) * Math.PI) / 180;
    const len = (i % 2 ? 0.7 : 0.97) * R * (1 + 0.04 * ((i + k) % 3));
    const w = i % 2 ? 0.08 : 0.11;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const at = (r: number, off: number): P => [c * r - s * off * r, s * r + c * off * r];
    shapes.push(inked(poly([at(0.38 * R, -w), at(len, 0), at(0.38 * R, w)]), 'coin', 'coinLo', 0.1));
  }
  for (let i = 0; i < 4; i++) {
    const a = ((turn * 2 + 45 + i * 90 + k * 23) * Math.PI) / 180;
    const r = R * (0.78 + 0.08 * ((i + k) % 2));
    const size = 0.9 + 0.3 * ((i + k) % 2);
    shapes.push(
      inked(star(Math.cos(a) * r, Math.sin(a) * r, size, size * 0.3, 4, -90), 'coinHi', 'coinLo', 0.06),
    );
  }
  // Chevrons drift up through the glow, two units a drawing, wrapping round.
  for (const [x, y0] of [
    [-5.2, 4],
    [5.4, 1],
    [-1.6, -2],
  ] as const) {
    const y = ((((y0 - k * 2 + 9) % 18) + 18) % 18) - 9;
    shapes.push(chevron(x, y, 2.2 - Math.abs(y) / 9));
  }
  return shapes;
}

export const AURA_DRAWINGS = 3;

/**
 * A boot's flame jet, in foot space: the sole at y = ANKLE under the ankle, the flame pouring out of it down +y,
 * `len` long. Three tones, orange outside, yellow, a white core, with a dark ink line round the outside.
 */
function jet(len: number, wide: number): PathShape[] {
  const y = ANKLE;
  const cx = 0.3;
  const outer: P[] = [
    [cx - 0.95 * wide, y, 0],
    [cx + 0.95 * wide, y, 0],
    [cx + 0.75 * wide, y + len * 0.35],
    [cx + 0.25 * wide, y + len * 0.75],
    [cx, y + len, 0],
    [cx - 0.3 * wide, y + len * 0.7],
    [cx - 0.75 * wide, y + len * 0.3],
  ];
  const mid: P[] = [
    [cx - 0.62 * wide, y, 0],
    [cx + 0.62 * wide, y, 0],
    [cx + 0.45 * wide, y + len * 0.3],
    [cx, y + len * 0.68, 0],
    [cx - 0.45 * wide, y + len * 0.3],
  ];
  return [
    inked(smooth(outer), 'hitLine', 'coinLine', 0.09),
    { d: smooth(mid), fill: 'hitHi' },
    { d: ellipse(cx, y + len * 0.16, 0.32 * wide, len * 0.16), fill: 'hit' },
  ];
}

/** Each drawing's length and width: three flickering flames, big and small. */
const JETS = [
  [1, 1],
  [0.82, 0.92],
  [1.12, 1.05],
] as const;

export const upgradeFxSymbols: Record<string, PathShape[]> = {
  ...Object.fromEntries(Array.from({ length: AURA_DRAWINGS }, (_, k) => [`upgradeAura${k}`, aura(k)])),
  ...Object.fromEntries(JETS.map(([l, w], k) => [`bootJet${k}`, jet(3.4 * l, w)])),
  ...Object.fromEntries(JETS.map(([l, w], k) => [`bootJetSmall${k}`, jet(1.7 * l, 0.8 * w)])),
};

export const upgradeFxLoops = {
  upgradeAura: { loop: Array.from({ length: AURA_DRAWINGS }, (_, k) => `upgradeAura${k}`), fps: 15 },
  bootJet: { loop: JETS.map((_, k) => `bootJet${k}`), fps: 30 },
  bootJetSmall: { loop: JETS.map((_, k) => `bootJetSmall${k}`), fps: 30 },
};
