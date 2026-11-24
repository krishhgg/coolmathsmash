import {
  acGuitar,
  banjo,
  celesta,
  clap,
  crash,
  hat,
  human,
  kick,
  quack,
  ride,
  shaker,
  shape,
  snare,
  strum,
  tom,
  upright,
  whistle,
} from '../kits/cheerful.ts';
import { arp, chord, grid, loop, root, seq, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Duck Life stage: an original sunny countryside two-step in A major. A1 is the whistled training tune over
 * strummed acoustic guitar, banjo rolls and a bouncing upright bass; A2 picks up handclaps, a shaker and a
 * busier banjo; B lifts into a half-time "take flight" bridge with soaring strings and celesta, then a
 * snare roll runs back into the top. 24 bars at 128 BPM.
 */
const bar = 4;
const changes: [number, number, string][] = [
  [0, 0, 'A'],
  [1, 0, 'A'],
  [2, 0, 'D'],
  [3, 0, 'A'],
  [4, 0, 'A'],
  [5, 0, 'F#m'],
  [6, 0, 'B7'],
  [7, 0, 'E7'],
  [8, 0, 'A'],
  [9, 0, 'A'],
  [10, 0, 'D'],
  [11, 0, 'A'],
  [12, 0, 'A'],
  [13, 0, 'D'],
  [14, 0, 'E7'],
  [15, 0, 'A'],
  [16, 0, 'D'],
  [17, 0, 'E'],
  [18, 0, 'C#m'],
  [19, 0, 'F#m'],
  [20, 0, 'D'],
  [21, 0, 'E'],
  [22, 0, 'Bm7'],
  [22, 2, 'E7'],
  [23, 0, 'E7'],
];
const spans = changes.map(([b, beat, sym], i) => {
  const t = b * bar + beat;
  const next = changes[i + 1];
  return { t, d: (next ? next[0] * bar + next[1] : 24 * bar) - t, sym };
});
const inB = (t: number) => t >= 64;

// ---------------------------------------------------------------- melody

const tune = seq(
  [
    'C#5 E5 A5:2 A5 B5 C#6 A5',
    'B5:2 A5 F#5 E5:4',
    'F#5 A5 D6:2 D6 C#6 B5 A5',
    'C#6:2 B5 A5 E5:4',
    'C#5 E5 A5:2 A5 B5 C#6 E6',
    'F#6:2 E6 C#6 A5:4',
    'D#6 C#6 B5 A5 F#5:2 A5 B5',
    'G#5:2 B5 D6 E6:2 . E5',
    'C#5 E5 A5:2 A5 B5 C#6 A5',
    'B5:2 A5 F#5 E5:4',
    'F#5 A5 D6:2 D6 C#6 B5 A5',
    'C#6:2 B5 A5 E5:4',
    'C#5 E5 A5:2 A5 B5 C#6 E6',
    'F#6:2 E6 D6 C#6:2 B5 A5',
    'B5:2 G#5 E5 D5:2 E5 G#5',
    'A5:4 . . . .',
    'F#5:4 A5:2 D6:2',
    'G#5:4 B5:2 E6:2',
    'E6:4 C#6:2 G#5:2',
    'A5:6 F#5 A5',
    'B5:4 A5:2 F#5:2',
    'G#5:4 B5:2 E6:2',
    'D6:2 C#6:2 B5:2 G#5:2',
    'E6:2 D6 B5 G#5 E5 D5 B4',
  ].join(' '),
  { step: 0.5, v: 0.8 },
);
/** Phrases swell to their middle; the bridge sings out a little more. */
const tuneShaped = shape(tune, (t) => {
  const p = (t % 8) / 8;
  return (
    (0.84 + 0.2 * Math.sin(Math.PI * p)) * (t < 32 ? 0.9 : inB(t) ? 1.05 : 1) * (t % 1 < 0.01 ? 1.05 : 0.97)
  );
});

// ---------------------------------------------------------------- accompaniment

/** Guitar voicing in the open-chord range (E3..E4). */
const gtr = (sym: string) =>
  chord(sym, 3)
    .map((n) => (n > 64 ? n - 12 : n < 52 ? n + 12 : n))
    .concat([root(sym, 3) + 12])
    .filter((n, i, a) => a.indexOf(n) === i)
    .sort((a, b) => a - b);

/** Boom-chick strums: down on 2 and 4, a light upstroke on the "and" of 4 (and of 2 in A2). */
const strums = spans.flatMap((s) => {
  const hitsAt = inB(s.t) ? [0, 2, 2.5, 3.5] : s.t >= 32 ? [1, 1.5, 3, 3.5] : [1, 3, 3.5];
  return hitsAt
    .map((b) => s.t - (s.t % bar) + b)
    .filter((t) => t >= s.t && t < s.t + s.d)
    .flatMap((t) => {
      const up = t % 1 > 0;
      return strum(
        gtr(s.sym).map((n) => ({ t, d: inB(s.t) && !up ? 1.8 : 0.42, n, v: up ? 0.42 : 0.7 })),
        0.018,
        up,
      );
    });
});

/** Banjo rolls: eighths in A1 and the bridge, a forward roll in sixteenths in A2. */
const rolls = spans.flatMap((s) => {
  const syms = [s.sym];
  if (s.t >= 32 && s.t < 64)
    return arp(syms, [0, 2, 4, 1, 3, 5, 2, 4], {
      step: 0.25,
      octave: 4,
      beats: s.d,
      start: s.t,
      v: 0.55,
      gate: 1,
    });
  return arp(syms, [0, 1, 2, 4, 3, 2, 4, 1], {
    step: 0.5,
    octave: 4,
    beats: s.d,
    start: s.t,
    v: 0.6,
    gate: 1,
  });
});
const banjoRun = seq('A4 C#5 E5 A5 C#6 E6 A6 E6', { step: 0.25, start: 15 * bar + 2, v: 0.7 });
const banjoLine = shape(
  [...rolls.filter((n) => !(n.t >= 15 * bar + 2 && n.t < 16 * bar)), ...banjoRun],
  (t) => (t % 1 < 0.01 ? 1.12 : 0.88) * (inB(t) ? 0.8 : 1),
);

/** Upright bass: root and fifth on 1 and 3, with a walk-up into each new chord. */
const bassLine: Note[] = spans.flatMap((s, i) => {
  const r = root(s.sym, 2);
  const next = root(spans[(i + 1) % spans.length]!.sym, 2);
  const low = r > 45 ? r - 12 : r;
  if (s.d === 2)
    return [
      { t: s.t, d: 0.9, n: low, v: 0.9 },
      { t: s.t + 1, d: 0.9, n: low + 7, v: 0.7 },
    ];
  if (inB(s.t) && s.t < 88)
    return [
      { t: s.t, d: 1.8, n: low, v: 0.9 },
      { t: s.t + 2, d: 1.4, n: low + 7, v: 0.75 },
      { t: s.t + 3.5, d: 0.45, n: next > low ? next - 1 : next + 1, v: 0.6 },
    ];
  const walk = next !== r && next !== low;
  return [
    { t: s.t, d: 0.9, n: low, v: 0.92 },
    { t: s.t + 2, d: walk ? 0.45 : 0.9, n: low + 7, v: 0.75 },
    ...(walk
      ? [
          { t: s.t + 3, d: 0.45, n: low + 9, v: 0.62 },
          { t: s.t + 3.5, d: 0.45, n: low + 11, v: 0.66 },
        ]
      : []),
  ];
});

/** Bridge: strings in two wide voicings and a celesta counter-melody, "taking flight". */
const pads = (oct: number, v: number) =>
  spans.filter((s) => inB(s.t)).flatMap((s) => chord(s.sym, oct).map((n) => ({ t: s.t, d: s.d, n, v })));
const sparkle = seq(
  'A6 . F#6 . D6 . A5 . | B6 . G#6 . E6 . B5 . | C#7 . G#6 . E6 . C#6 . | A6 . F#6 . C#6 . A5 . | ' +
    'F#6 D6 A5 D6 F#6 A6 F#6 D6 | G#6 E6 B5 E6 G#6 B6 G#6 E6 | F#6 D6 B5 D6 G#6 E6 D6 B5 | E6:8',
  { step: 0.5, start: 64, v: 0.5 },
);

// ---------------------------------------------------------------- drums

const kickA = loop(grid('x.......o.......', { step: 0.25 }), 16, bar);
const snareA = loop(grid('....x.......x...', { step: 0.25 }), 16, bar).filter(
  (n) => !(n.t >= 7 * bar + 2 && n.t < 8 * bar) && !(n.t >= 15 * bar + 2 && n.t < 16 * bar),
);
const fillA1 = grid('..........x-x-xx', { step: 0.25, start: 7 * bar });
const fillA2 = grid('........x.x.xxxx', { step: 0.25, start: 15 * bar });
const tomsA2 = [
  { t: 15 * bar + 3, d: 0.3, n: 52, v: 0.75 },
  { t: 15 * bar + 3.25, d: 0.3, n: 48, v: 0.8 },
  { t: 15 * bar + 3.5, d: 0.3, n: 45, v: 0.85 },
  { t: 15 * bar + 3.75, d: 0.3, n: 41, v: 0.9 },
];
const hatsA = [
  ...loop(grid('x.o.x.o.x.o.x.oo', { step: 0.25, n: 40 }), 8, bar),
  ...loop(grid('x-o-x-o-x-o-x-o-', { step: 0.25, n: 40 }), 8, bar).map((n) => ({ ...n, t: n.t + 32 })),
];
const clapsA2 = loop(grid('....x.......x...', { step: 0.25, start: 32 }), 7, bar);
const shakerA2 = loop(grid('-o-x-o-x-o-x-o-x', { step: 0.25, start: 32 }), 8, bar);
const kickB = [
  ...loop(grid('x.........o.....', { step: 0.25, start: 64 }), 6, bar),
  ...grid('x.......x...x...|x...x...x.x.x.xx', { step: 0.25, start: 88 }),
];
const snareB = [
  ...loop(grid('........x.......', { step: 0.25, start: 64 }), 5, bar),
  ...grid('........x.....-.', { step: 0.25, start: 84 }),
  ...grid('x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx', { step: 0.25, start: 88 }).map((n) => ({
    ...n,
    v: 0.35 + 0.65 * ((n.t - 88) / 8) ** 1.5,
  })),
];
const rideB = loop(grid('x.o.x.o.x.o.x.o.', { step: 0.25, n: 64 }), 6, bar).map((n) => ({
  ...n,
  t: n.t + 64,
}));
const crashes = [0, 32, 64, 80].map((t) => ({ t, d: 1, n: 60, v: t === 80 ? 0.6 : 0.9 }));
const quacks = [
  { t: 7 * bar + 3, d: 0.2, n: 62, v: 0.8 },
  { t: 7 * bar + 3.5, d: 0.2, n: 66, v: 0.85 },
  { t: 15 * bar + 1, d: 0.2, n: 64, v: 0.75 },
];

const dyn = (t: number) => (t < 32 ? 0.8 : t < 64 ? 0.92 : 1);

export const song: Song = {
  id: 'duck-life-world',
  title: 'Duck Life',
  evokes: 'Duck Life (Wix Games): an original sunny countryside training two-step',
  bpm: 128,
  loopBeats: 24 * bar,
  seed: 23,
  reverb: { room: 0.5, damp: 0.5, wet: 0.26 },
  tracks: [
    { inst: whistle, gain: -4, pan: 0.05, verb: 0.3, loop: human(tuneShaped, 31, 0.06, 0.008) },
    { inst: acGuitar, gain: 0, pan: -0.42, verb: 0.2, loop: human(shape(strums, dyn), 32, 0.08, 0.004) },
    { inst: banjo, gain: -1, pan: 0.45, verb: 0.2, loop: human(shape(banjoLine, dyn), 33, 0.1, 0.006) },
    { inst: upright, gain: -1, pan: 0, verb: 0.06, loop: human(shape(bassLine, dyn), 34, 0.06, 0.005) },
    { inst: 'strings', gain: -6, pan: -0.55, verb: 0.45, loop: pads(3, 0.5) },
    { inst: 'strings', gain: -7, pan: 0.55, verb: 0.45, loop: pads(4, 0.45) },
    { inst: celesta, gain: -9, pan: 0.3, verb: 0.4, loop: human(sparkle, 35, 0.12, 0.004) },
    {
      inst: kick,
      gain: -6,
      pan: 0,
      verb: 0.05,
      loop: human(shape([...kickA, ...kickB], dyn), 36, 0.06, 0.004),
    },
    {
      inst: snare,
      gain: -5,
      pan: 0.05,
      verb: 0.2,
      loop: human(shape([...snareA, ...fillA1, ...fillA2, ...snareB], dyn), 37, 0.07, 0.004),
    },
    { inst: hat, gain: 1, pan: 0.32, verb: 0.08, loop: human(shape(hatsA, dyn), 38, 0.12, 0.004) },
    { inst: ride, gain: -5, pan: -0.3, verb: 0.15, loop: human(rideB, 39, 0.1, 0.004) },
    { inst: clap, gain: 2, pan: -0.15, verb: 0.25, loop: human(clapsA2, 40, 0.1, 0.006) },
    { inst: shaker, gain: -6, pan: 0.5, verb: 0.1, loop: human(shakerA2, 41, 0.15, 0.006) },
    { inst: tom, gain: -5, pan: -0.1, verb: 0.2, loop: tomsA2 },
    { inst: crash, gain: -2, pan: -0.25, verb: 0.3, loop: crashes },
    { inst: quack, gain: 0, pan: 0.2, verb: 0.2, loop: quacks },
  ],
};
