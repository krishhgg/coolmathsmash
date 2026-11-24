import {
  bassoon,
  clank,
  clarinet,
  crash,
  hat,
  human,
  kick,
  ratchet,
  rim,
  roll,
  shape,
  slideDown,
  slideUp,
  snare,
  tom,
  upright,
  woodblock,
  xylo,
} from '../kits/cheerful.ts';
import { chord, grid, loop, root, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Snail Bob stage: an original tiptoeing cartoon-caper in D minor. A creeping chromatic bassline (upright
 * doubled by bassoon) carries a sneaky clarinet tune over a tick-tock woodblock; B turns to F major for a
 * bouncy building-site romp (xylophone hammer taps, tuba oom-pah, pizzicato, girder clanks and a ratchet);
 * A' brings the tune back on xylophone with the full kit, and a slide whistle hops back into the loop.
 * 24 bars at 128 BPM.
 */
const bar = 4;
const changes: [number, number, string][] = [
  [0, 0, 'Dm'],
  [1, 0, 'Dm'],
  [2, 0, 'Gm'],
  [3, 0, 'A7'],
  [4, 0, 'Dm'],
  [5, 0, 'Bb7'],
  [6, 0, 'Gm6'],
  [6, 2, 'A7'],
  [7, 0, 'Dm'],
  [8, 0, 'F'],
  [9, 0, 'C7'],
  [10, 0, 'F'],
  [11, 0, 'Bb'],
  [11, 2, 'Bdim'],
  [12, 0, 'F/C'],
  [13, 0, 'D7'],
  [14, 0, 'Gm7'],
  [14, 2, 'C7'],
  [15, 0, 'F'],
  [15, 2, 'A7'],
];
const spans = [...changes, ...changes.slice(0, 9).map(([b, beat, sym]) => [b + 16, beat, sym] as const)].map(
  ([b, beat, sym], i, all) => {
    const t = b * bar + beat;
    const next = all[i + 1];
    return { t, d: (next ? next[0] * bar + next[1] : 24 * bar) - t, sym };
  },
);
const inB = (t: number) => t >= 32 && t < 64;

// ---------------------------------------------------------------- the creeping bassline (A sections)

const hook = (last: string) =>
  [
    'D2 . F2 F#2 G2 . G#2 A2',
    'D3 . A2 . F2 . E2 .',
    'G2 . Bb2 B2 C3 . C#3 D3',
    'A2 . E2 . A2 C#3 E3 .',
    'D2 . F2 F#2 G2 . G#2 A2',
    'Bb2 . D3 . Ab2 . F2 .',
    'G2 . Bb2 . A2 . C#3 .',
    last,
  ].join(' ');
const creepA1 = seq(hook('D3 . A2 . D2 . . .'), { step: 0.5, v: 0.85 });
const creepA2 = seq(hook('D3 . A2 . D2 D2 E2 F#2'), { step: 0.5, v: 0.9, start: 64 });
const staccato = (notes: Note[]) =>
  notes.map((n) => ({ ...n, d: Math.min(n.d, 0.3), v: n.v * (n.t % 1 < 0.01 ? 1.05 : 0.85) }));
const creep = staccato([...creepA1, ...creepA2]);

/** B: tuba oom-pah on the roots and fifths. */
const oom = spans
  .filter((s) => inB(s.t))
  .flatMap((s) => {
    const r = root(s.sym, 2);
    const low = r > 43 ? r - 12 : r;
    return s.d === 2
      ? [{ t: s.t, d: 0.6, n: low, v: 0.9 }]
      : [
          { t: s.t, d: 0.6, n: low, v: 0.92 },
          { t: s.t + 2, d: 0.6, n: low + 7, v: 0.78 },
        ];
  });

// ---------------------------------------------------------------- melodies

const sneak = (last: string) =>
  [
    'A4 . D5 . F5 E5 F5 .',
    'A5:2 G#5 A5 F5 . D5 .',
    'Bb4 . D5 . G5 F#5 G5 .',
    'C#6:2 Bb5 A5 G5 . E5 .',
    'A4 . D5 . F5 E5 F5 A5',
    'D6:2 C6 Bb5 Ab5 . F5 .',
    'E5 . G5 . C#5 . E5 .',
    last,
  ].join(' ');
const romp = [
  'C5 F5 F5 F5 A5 . F5 .',
  'Bb4 E5 E5 E5 G5 . E5 .',
  'A5 C6 C6 C6 A5 . F5 .',
  'D6:2 Bb5 F5 Ab5:2 F5 D5',
  'C6 A5 F5 A5 C6:2 . .',
  'D6 C6 A5 F#5 D5:2 . .',
  'Bb5 . G5 . E5 . C5 .',
  'F5:2 A4 C5 C#5 E5 G5 Bb5',
].join(' ');
/** Tiptoe phrasing: short notes, offbeats lighter, each two-bar phrase leaning toward its peak. */
const tiptoe = (notes: Note[], base: number) =>
  notes.map((n) => {
    const p = (n.t % 8) / 8;
    return {
      ...n,
      d: n.d > 0.5 ? n.d * 0.9 : Math.min(n.d, 0.32),
      v: n.v * base * (0.85 + 0.25 * Math.sin(Math.PI * p)) * (n.t % 1 < 0.01 ? 1.04 : 0.9),
    };
  });
const clarinetLine = [
  ...tiptoe(seq(sneak('D5:2 . . . . . .'), { step: 0.5, v: 0.8 }), 0.95),
  ...tiptoe(shift(seq(sneak('D5 . F5 . A5 . . .'), { step: 0.5, v: 0.6, start: 64 }), 0, -12), 0.9),
];
const marimbaLine = shift(
  tiptoe(seq(sneak('D6 . F6 . A6 . . .'), { step: 0.5, v: 0.8, start: 64 }), 1),
  0,
  -12,
);
const xyloLine = [
  ...tiptoe(seq(romp, { step: 0.5, v: 0.85, start: 32 }), 1),
  ...tiptoe(seq(sneak('D6 . F6 . A6 . . .'), { step: 0.5, v: 0.85, start: 64 }), 1),
];
const bassoonLine = staccato(shift(creepA1, 0, 12)).map((n) => ({ ...n, v: n.v * 0.75 }));
/** B: the clarinet sustains each chord's third under the xylophone romp. */
const clarinetPad = spans
  .filter((s) => inB(s.t))
  .map((s) => ({ t: s.t, d: s.d - 0.15, n: chord(s.sym, 4)[1]!, v: 0.42 }));

/** Pizzicato: tiptoe offbeats in the A sections, chords on 2 and 4 in B. */
const pizzChords = spans.flatMap((s) =>
  (inB(s.t) ? [1, 3] : [0.5, 1.5, 2.5, 3.5])
    .map((b) => s.t - (s.t % bar) + b)
    .filter((t) => t >= s.t && t < s.t + s.d)
    .flatMap((t) =>
      chord(s.sym, 4)
        .slice(0, 3)
        .map((n) => ({ t, d: 0.3, n, v: inB(s.t) ? 0.6 : t % 2 < 1 ? 0.42 : 0.5 })),
    ),
);

// ---------------------------------------------------------------- percussion

const tickTock = shape(
  loop(
    [
      { t: 0, d: 0.25, n: 84, v: 0.6 },
      { t: 1, d: 0.25, n: 77, v: 0.5 },
      { t: 2, d: 0.25, n: 84, v: 0.6 },
      { t: 3, d: 0.25, n: 77, v: 0.5 },
    ],
    24,
    bar,
  ).filter((n) => !inB(n.t)),
  (t) => (t < 32 ? 0.9 : 1),
);
const kicks = [
  ...loop(grid('x.......o.......', { step: 0.25 }), 7, bar),
  ...loop(grid('x.......x.......', { step: 0.25, start: 32 }), 8, bar),
  ...loop(grid('x.....o.x.......', { step: 0.25, start: 64 }), 7, bar),
  ...grid('x.......x.x.x.x.', { step: 0.25, start: 92 }),
];
const rims = loop(grid('....x.......x...', { step: 0.25 }), 7, bar);
const snares = [
  ...loop(grid('..-...-...-.-.-.', { step: 0.25 }), 7, bar).map((n) => ({ ...n, v: n.v * 0.8 })),
  ...grid('........x.o.', { step: 0.25, start: 28 }),
  ...roll(31, 32, 4, 0.5, 0.9, 3),
  ...loop(grid('....o.......o..-', { step: 0.25, start: 32 }), 7, bar),
  ...grid('....o...x.o.', { step: 0.25, start: 60 }),
  ...roll(63, 64, 4, 0.55, 0.95, 4),
  ...loop(grid('..-.x.-...-.x.-.', { step: 0.25, start: 64 }), 7, bar),
  ...grid('....x...', { step: 0.25, start: 92 }),
  ...roll(94, 96, 4, 0.35, 0.85, 5),
];
const hats = [
  ...loop(grid('x...o...x...o...', { step: 0.25, n: 40 }), 8, bar).map((n) => ({ ...n, v: n.v * 0.7 })),
  ...loop(grid('x.o.x.o.x.o.x.o.', { step: 0.25, n: 40 }), 8, bar).map((n) => ({ ...n, t: n.t + 32 })),
  ...loop(grid('x-o-x-o-x-o-x-o-', { step: 0.25, n: 40 }), 8, bar).map((n) => ({ ...n, t: n.t + 64 })),
];
/** Girder clanks, call (left) and response (right): on 3 of each B bar, answered on the and of 3; every
 * other bar of A'; and hits that punctuate the tune. */
const clanksLeft = [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({
    t: 32 + k * bar + 3,
    d: 0.3,
    n: [57, 60, 55, 62, 57, 60, 59, 64][k]!,
    v: k % 2 ? 0.75 : 0.9,
  })),
  ...[0, 2, 4].map((k) => ({ t: 64 + k * bar + 3, d: 0.3, n: 57, v: 0.8 })),
  { t: 28 + 2, d: 0.3, n: 52, v: 0.9 },
  { t: 92 + 2, d: 0.3, n: 60, v: 0.95 },
];
const clanksRight = [
  ...[1, 3, 5, 7].map((k) => ({ t: 32 + k * bar + 3.5, d: 0.3, n: [69, 67, 72, 71][(k - 1) / 2]!, v: 0.7 })),
  ...[1, 3, 5].map((k) => ({ t: 64 + k * bar + 3.5, d: 0.3, n: 69, v: 0.7 })),
  { t: 28 + 2.5, d: 0.3, n: 64, v: 0.85 },
];
/** Ratchet scrapes (a socket wrench) closing every other B bar and the B section. */
const ratchets = [9, 11, 13, 15].map((b) => ({
  t: b * bar + 2.5,
  d: b === 15 ? 1 : 0.5,
  n: 60,
  v: b === 15 ? 0.9 : 0.7,
}));
const toms = [
  { t: 23 * bar + 2, d: 0.3, n: 50, v: 0.8 },
  { t: 23 * bar + 2.5, d: 0.3, n: 45, v: 0.85 },
];
const crashes = [
  { t: 32, d: 1, n: 60, v: 0.85 },
  { t: 64, d: 1, n: 60, v: 0.9 },
  { t: 0, d: 1, n: 60, v: 0.85 },
];
/** Slide-whistle gags: an "oops" falling at the end of A, a hop up into the loop at the end of A'. */
const oops = [{ t: 7 * bar + 1, d: 0.9, n: 86, v: 0.8 }];
const hop = [{ t: 23 * bar + 3, d: 0.75, n: 74, v: 0.75 }];

const dyn = (t: number) => (t < 32 ? 0.92 : 1);

export const song: Song = {
  id: 'snail-bob-construction',
  title: 'Snail Bob',
  evokes: "Snail Bob's construction site (Hunter Hamster): an original tiptoeing cartoon caper",
  bpm: 128,
  loopBeats: 24 * bar,
  seed: 31,
  reverb: { room: 0.48, damp: 0.55, wet: 0.3 },
  tracks: [
    {
      inst: clarinet,
      gain: -4,
      pan: -0.2,
      verb: 0.3,
      loop: human([...clarinetLine, ...clarinetPad], 51, 0.1, 0.01),
    },
    { inst: xylo, gain: -7.5, pan: 0.25, verb: 0.3, loop: human(xyloLine, 52, 0.16, 0.006) },
    { inst: 'marimba', gain: -8, pan: -0.3, verb: 0.3, loop: human(marimbaLine, 63, 0.14, 0.006) },
    { inst: bassoon, gain: -4, pan: 0.48, verb: 0.2, loop: human(shape(bassoonLine, dyn), 53, 0.08, 0.006) },
    { inst: upright, gain: -1, pan: 0, verb: 0.08, loop: human(shape(creep, dyn), 54, 0.06, 0.005) },
    { inst: 'tuba', gain: -6, pan: 0, verb: 0.1, loop: human(oom, 55, 0.06, 0.006) },
    { inst: 'pizz', gain: 3, pan: 0.6, verb: 0.28, loop: human(shape(pizzChords, dyn), 56, 0.15, 0.01) },
    { inst: woodblock, gain: -4, pan: -0.6, verb: 0.2, loop: human(tickTock, 57, 0.14, 0.006) },
    { inst: kick, gain: -6, pan: 0, verb: 0.06, loop: human(shape(kicks, dyn), 58, 0.08, 0.004) },
    { inst: rim, gain: -2, pan: 0.1, verb: 0.22, loop: human(rims, 59, 0.14, 0.005) },
    { inst: snare, gain: -6, pan: 0.05, verb: 0.26, loop: human(shape(snares, dyn), 60, 0.14, 0.006) },
    { inst: hat, gain: -3, pan: 0.38, verb: 0.1, loop: human(shape(hats, dyn), 61, 0.18, 0.005) },
    { inst: clank, gain: -3, pan: -0.5, verb: 0.32, loop: human(clanksLeft, 62, 0.1, 0.004) },
    { inst: clank, gain: -3, pan: 0.5, verb: 0.32, loop: human(clanksRight, 64, 0.1, 0.004) },
    { inst: ratchet, gain: 14, pan: 0.45, verb: 0.25, loop: ratchets },
    { inst: tom, gain: -6, pan: -0.1, verb: 0.2, loop: toms },
    { inst: crash, gain: -4, pan: -0.25, verb: 0.3, loop: crashes },
    { inst: slideDown, gain: -3, pan: 0.3, verb: 0.38, loop: oops },
    { inst: slideUp, gain: -3, pan: -0.25, verb: 0.38, loop: hop },
  ],
};
