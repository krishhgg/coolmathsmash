import {
  acGuitar,
  banjo,
  celesta,
  deHarsh,
  drumRoom,
  harmonica,
  human,
  lowMid,
  master,
  quack,
  roll,
  shape,
  strum,
  tame,
  upright,
  whistle,
} from '../kits/cheerful.ts';
import { arp, chord, grid, loop, root, seq, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Duck Life stage: an original sunny countryside two-step in A major. A1 is the whistled training tune over
 * strummed acoustic guitar, banjo rolls and a bouncing upright bass; B lifts into a "take flight" bridge
 * with soaring strings, celesta and driving strums that builds into A2, where a harmonica takes the tune
 * over handclaps, a shaker and a busier banjo before a fill turns back to the top. 24 bars at 132 BPM.
 */
const bar = 4;
const isA1 = (t: number) => t < 32;
const isB = (t: number) => t >= 32 && t < 64;
const changes: [number, number, string][] = [
  [0, 0, 'A'],
  [1, 0, 'A'],
  [2, 0, 'D'],
  [3, 0, 'A'],
  [4, 0, 'A'],
  [5, 0, 'F#m'],
  [6, 0, 'B7'],
  [7, 0, 'E7'],
  [8, 0, 'D'],
  [9, 0, 'E'],
  [10, 0, 'C#m'],
  [11, 0, 'F#m'],
  [12, 0, 'D'],
  [13, 0, 'E'],
  [14, 0, 'Bm7'],
  [14, 2, 'E7'],
  [15, 0, 'E7'],
  [16, 0, 'A'],
  [17, 0, 'A'],
  [18, 0, 'D'],
  [19, 0, 'A'],
  [20, 0, 'A'],
  [21, 0, 'D'],
  [22, 0, 'E7'],
  [23, 0, 'A'],
];
const spans = changes.map(([b, beat, sym], i) => {
  const t = b * bar + beat;
  const next = changes[i + 1];
  return { t, d: (next ? next[0] * bar + next[1] : 24 * bar) - t, sym };
});

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
    'F#5:4 A5:2 D6:2',
    'G#5:4 B5:2 E6:2',
    'E6:4 C#6:2 G#5:2',
    'A5:6 F#5 A5',
    'B5:4 A5:2 F#5:2',
    'G#5:4 B5:2 E6:2',
    'D6:2 C#6:2 B5:2 G#5:2',
    'E6:2 D6 B5 G#5 E5 D5 B4',
    'C#5 E5 A5:2 A5 B5 C#6 A5',
    'B5:2 A5 F#5 E5:4',
    'F#5 A5 D6:2 D6 C#6 B5 A5',
    'C#6:2 B5 A5 E5:4',
    'C#5 E5 A5:2 A5 B5 C#6 E6',
    'F#6:2 E6 D6 C#6:2 B5 A5',
    'B5:2 G#5 E5 D5:2 E5 G#5',
    'A5:4 . . . .',
  ].join(' '),
  { step: 0.5, v: 0.8 },
);
/** Phrases swell to their middle; the bridge sings out a little more. */
const tuneShaped = shape(tune, (t) => {
  const p = (t % 8) / 8;
  return (
    (0.82 + 0.24 * Math.sin(Math.PI * p)) *
    (isA1(t) ? 0.92 : isB(t) ? 1.05 : 1) *
    (t % 1 < 0.01 ? 1.05 : 0.96)
  );
});
/** The whistle sings A1 and the bridge; a harmonica takes the tune in A2. */
const whistleTune = tuneShaped.filter((n) => n.t < 64);
const harpTune = tuneShaped.filter((n) => n.t >= 64);

// ---------------------------------------------------------------- accompaniment

/** Guitar voicing in the open-chord range (E3..E4). */
const gtr = (sym: string) =>
  chord(sym, 3)
    .map((n) => (n > 64 ? n - 12 : n < 52 ? n + 12 : n))
    .concat([root(sym, 3) + 12])
    .filter((n, i, a) => a.indexOf(n) === i)
    .sort((a, b) => a - b);

/** Strums: boom-chick (down on 2 and 4, up on the and of 4) in A1, a driving down-up eighth pattern under
 * the bridge, and boom-chick with muted ghost strokes in A2. */
const strums = spans.flatMap((s) => {
  const hitsAt = isB(s.t)
    ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
    : isA1(s.t)
      ? [1, 3, 3.5]
      : [1, 1.5, 1.75, 3, 3.5, 3.75];
  return hitsAt
    .map((b) => s.t - (s.t % bar) + b)
    .filter((t) => t >= s.t && t < s.t + s.d)
    .flatMap((t) => {
      const up = t % 1 > 0;
      const ghost = t % 0.5 > 0;
      const v = ghost ? 0.22 : up ? 0.42 : isB(s.t) && t % 2 ? 0.55 : 0.7;
      return strum(
        gtr(s.sym).map((n) => ({ t, d: ghost ? 0.05 : up ? 0.3 : 0.42, n, v })),
        ghost ? 0.012 : 0.032,
        up,
      );
    });
});

/** Banjo rolls: eighths in A1 and the bridge, a forward roll in sixteenths in A2, and a run into the top. */
const rolls = spans.flatMap((s) =>
  s.t >= 64
    ? arp([s.sym], [0, 2, 4, 1, 3, 5, 2, 4], {
        step: 0.25,
        octave: 4,
        beats: s.d,
        start: s.t,
        v: 0.55,
        gate: 1,
      })
    : arp([s.sym], [0, 1, 2, 4, 3, 2, 4, 1], {
        step: 0.5,
        octave: 4,
        beats: s.d,
        start: s.t,
        v: 0.6,
        gate: 1,
      }),
);
const banjoRun = seq('A4 C#5 E5 A5 C#6 E6 A6 E6', { step: 0.25, start: 23 * bar + 2, v: 0.7 });
const banjoLine = shape(
  [...rolls.filter((n) => n.t < 23 * bar + 2), ...banjoRun],
  (t) => (t % 1 < 0.01 ? 1.12 : 0.88) * (isB(t) ? 0.8 : 1),
);

/** Upright bass: root and fifth on 1 and 3 with walk-ups into new chords; long tones in the bridge. */
const bassLine: Note[] = spans.flatMap((s, i) => {
  const r = root(s.sym, 2);
  const next = root(spans[(i + 1) % spans.length]!.sym, 2);
  const low = r > 45 ? r - 12 : r;
  if (s.d === 2)
    return [
      { t: s.t, d: 0.9, n: low, v: 0.9 },
      { t: s.t + 1, d: 0.9, n: low + 7, v: 0.7 },
    ];
  if (isB(s.t) && s.t < 56)
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

/** Bridge: strings in two voicings (root position left, first inversion right) and a celesta line. */
const strings = (invert: boolean, v: number) =>
  spans
    .filter((s) => isB(s.t))
    .flatMap((s) => {
      const c = chord(s.sym, 4).slice(0, 3);
      return (invert ? [...c.slice(1), c[0]! + 12] : c).map((n) => ({ t: s.t, d: s.d, n, v }));
    });
const sparkle = seq(
  'A6 . F#6 . D6 . A5 . | B6 . G#6 . E6 . B5 . | C#7 . G#6 . E6 . C#6 . | A6 . F#6 . C#6 . A5 . | ' +
    'F#6 D6 A5 D6 F#6 A6 F#6 D6 | G#6 E6 B5 E6 G#6 B6 G#6 E6 | F#6 D6 B5 D6 G#6 E6 D6 B5 | E6:8',
  { step: 0.5, start: 32, v: 0.5 },
);

// ---------------------------------------------------------------- drums

const at = (from: number, notes: Note[]) => notes.map((n) => ({ ...n, t: n.t + from * bar }));
const kicks = [
  ...loop(grid('x.......o.......', { step: 0.25 }), 8, bar),
  ...at(8, loop(grid('x.........o.....', { step: 0.25 }), 6, bar)),
  ...at(14, grid('x...x...x...x...|x...x...x.x.x.xx', { step: 0.25 })),
  ...at(16, loop(grid('x.......o.......', { step: 0.25 }), 8, bar)),
];
const backbeat = (from: number, bars: number) =>
  at(from, loop(grid('....x.......x...', { step: 0.25 }), bars, bar));
const snares = [
  ...at(0, loop(grid('....x..-....x.-.', { step: 0.25 }), 7, bar)),
  ...at(7, grid('....x...x.o.', { step: 0.25 })),
  ...at(8, loop(grid('........x.......', { step: 0.25 }), 5, bar)),
  ...at(13, grid('........x.....-.', { step: 0.25 })),
  // The bridge builds: eighths, then sixteenths for two beats before the toms take over.
  ...at(
    14,
    grid('x-o-x-o-x-o-x-ox', { step: 0.5 / 2 }).filter((_, k) => k % 2 === 0),
  ).map((n, k) => ({
    ...n,
    v: (0.35 + 0.03 * k) * (k % 2 ? 0.85 : 1),
  })),
  ...roll(60, 62, 4, 0.55, 0.8, 9),
  ...backbeat(16, 7),
  ...at(23, grid('....x...x.o.', { step: 0.25 })),
];
const toms = [
  ...at(7, [
    { t: 3, d: 0.3, n: 50, v: 0.75 },
    { t: 3.5, d: 0.3, n: 45, v: 0.85 },
  ]),
  ...[52, 52, 48, 48, 45, 45, 41, 41].map((n, k) => ({ t: 62 + k * 0.25, d: 0.3, n, v: 0.7 + 0.035 * k })),
  ...at(23, [
    { t: 3, d: 0.3, n: 52, v: 0.75 },
    { t: 3.25, d: 0.3, n: 48, v: 0.8 },
    { t: 3.5, d: 0.3, n: 45, v: 0.85 },
    { t: 3.75, d: 0.3, n: 41, v: 0.9 },
  ]),
  // Floor-tom pulses under the bridge.
  ...at(
    8,
    loop(
      [
        { t: 0, d: 0.5, n: 43, v: 0.4 },
        { t: 2, d: 0.5, n: 43, v: 0.32 },
      ],
      6,
      bar,
    ),
  ),
];
const hats = [
  ...loop(grid('x.o.x.o.x.o.x.oo', { step: 0.25, n: 40 }), 8, bar),
  ...at(16, loop(grid('x-o-x-o-x-o-x-o-', { step: 0.25, n: 40 }), 8, bar)),
];
const rideB = at(8, loop(grid('x.o.x.o.x.o.x.o.', { step: 0.25, n: 64 }), 6, bar));
const claps = [
  ...loop(grid('....x.......x...', { step: 0.25 }), 7, bar).map((n) => ({ ...n, v: n.v * 0.55 })),
  ...at(16, loop(grid('....x.......x...', { step: 0.25 }), 7, bar)),
];
const shakers = [
  ...loop(grid('..o...x...o...x.', { step: 0.25 }), 8, bar).map((n) => ({ ...n, v: n.v * 0.6 })),
  ...at(16, loop(grid('-o-x-o-x-o-x-o-x', { step: 0.25 }), 8, bar)),
];
/** A soft cymbal swell under the last fill that rings across the loop point. */
const swellIn = [{ t: 94, d: 2.02, n: 60, v: 0.8 }];
const crashes = [
  { t: 0, d: 1, n: 60, v: 0.9 },
  { t: 32, d: 1, n: 60, v: 0.9 },
  { t: 48, d: 1, n: 60, v: 0.6 },
  { t: 64, d: 1, n: 60, v: 0.95 },
];
const quacks = [
  { t: 7 * bar + 3, d: 0.2, n: 62, v: 0.8 },
  { t: 7 * bar + 3.5, d: 0.2, n: 66, v: 0.85 },
  { t: 23 * bar + 1, d: 0.2, n: 64, v: 0.75 },
];

/** Section dynamics: A1 bright but light, the bridge at its peak, A2 just below. */
const dyn = (t: number) => (isA1(t) ? 1 : isB(t) ? 1 : 0.96);

export const song: Song = {
  id: 'duck-life-world',
  title: 'Duck Life',
  evokes: 'Duck Life (Wix Games): an original sunny countryside training two-step',
  bpm: 132,
  loopBeats: 24 * bar,
  seed: 23,
  reverb: { room: 0.52, damp: 0.5, wet: 0.3 },
  room: drumRoom,
  master,
  tracks: [
    {
      inst: whistle,
      gain: -6.5,
      pan: 0.05,
      verb: 0.36,
      hp: 300,
      eq: [deHarsh],
      loop: human(whistleTune, 31, 0.1, 0.01),
    },
    {
      inst: harmonica,
      gain: -4,
      pan: -0.08,
      verb: 0.3,
      hp: 200,
      eq: [deHarsh],
      loop: human(harpTune, 43, 0.12, 0.01),
    },
    {
      inst: acGuitar,
      gain: -4,
      pan: -0.7,
      verb: 0.22,
      hp: 90,
      loop: human(shape(strums, dyn), 32, 0.14, 0.006),
    },
    {
      inst: acGuitar,
      gain: -4.5,
      pan: 0.7,
      verb: 0.22,
      hp: 90,
      loop: human(shape(strums, dyn), 42, 0.14, 0.008),
    },
    {
      inst: banjo,
      gain: -1,
      pan: -0.4,
      width: 0.3,
      verb: 0.24,
      hp: 150,
      loop: human(shape(banjoLine, dyn), 33, 0.15, 0.008),
    },
    { inst: upright, gain: -1, verb: 0.06, room: 0.1, loop: human(shape(bassLine, dyn), 34, 0.08, 0.005) },
    {
      inst: 'strings',
      gain: -6,
      pan: -0.45,
      width: 0.6,
      verb: 0.5,
      hp: 220,
      eq: [lowMid],
      loop: strings(false, 0.55),
    },
    {
      inst: 'strings',
      gain: -7,
      pan: 0.45,
      width: 0.6,
      verb: 0.5,
      hp: 220,
      eq: [lowMid],
      loop: strings(true, 0.5),
    },
    { inst: celesta, gain: -9, pan: 0.4, verb: 0.5, hp: 400, loop: human(sparkle, 35, 0.12, 0.004) },
    { inst: 'kick', gain: -4.5, verb: 0, room: 0.1, loop: human(shape(kicks, dyn), 36, 0.08, 0.004) },
    {
      inst: 'snare',
      gain: -2.5,
      pan: 0.05,
      verb: 0.14,
      room: 0.45,
      loop: human(shape(snares, dyn), 37, 0.14, 0.006),
    },
    {
      inst: 'hat',
      gain: -7,
      pan: 0.38,
      verb: 0.03,
      room: 0.15,
      eq: [tame],
      loop: human(shape(hats, dyn), 38, 0.18, 0.005),
    },
    {
      inst: 'ride',
      gain: -11,
      pan: -0.38,
      verb: 0.08,
      room: 0.15,
      eq: [tame],
      loop: human(rideB, 39, 0.14, 0.005),
    },
    { inst: 'clap', gain: -6, pan: -0.25, verb: 0.15, room: 0.4, loop: human(claps, 40, 0.16, 0.008) },
    {
      inst: 'clap',
      gain: -8,
      pan: 0.3,
      verb: 0.15,
      room: 0.4,
      loop: human(
        claps.map((n) => ({ ...n, t: n.t + 0.03 })),
        44,
        0.16,
        0.01,
      ),
    },
    { inst: 'shaker', gain: -12, pan: 0.6, verb: 0.08, room: 0.1, loop: human(shakers, 41, 0.22, 0.01) },
    { inst: 'tom', gain: -9, pan: -0.1, verb: 0.12, room: 0.4, loop: human(toms, 45, 0.08, 0.004) },
    { inst: 'crash', gain: -8, pan: -0.25, width: 0.7, verb: 0.2, room: 0.1, eq: [tame], loop: crashes },
    { inst: 'revCrash', gain: -11, pan: 0.25, width: 0.7, verb: 0.25, eq: [tame], loop: swellIn },
    { inst: quack, gain: -5.5, pan: 0.2, verb: 0.3, room: 0.3, loop: quacks },
  ],
};
