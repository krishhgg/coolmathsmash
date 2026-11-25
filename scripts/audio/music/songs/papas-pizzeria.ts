import {
  accordion,
  clarinet,
  deHarsh,
  drumRoom,
  human,
  lowMid,
  mandolin,
  master,
  rim,
  shape,
  swing,
  tamb,
  tame,
  upPiano,
  upright,
} from '../kits/cheerful.ts';
import { chord, grid, loop, root, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Papa's Pizzeria stage: an original café-swing romp in F major with an Italian accent. A1 is a shuffle with
 * a clarinet tune over a walking bass, piano and accordion; an A7 swell tips it into B, a D-minor tarantella
 * (mandolin and accordion over tambourine); A2 swings back in with the accordion on the tune and a snare
 * backbeat, and its last bar turns around into the top. 24 bars at 132 BPM.
 */
const bar = 4;
const isA1 = (t: number) => t < 32;
const isB = (t: number) => t >= 32 && t < 64;
// One or two chords per bar: [bar, beat, symbol].
const changes: [number, number, string][] = [
  [0, 0, 'F6'],
  [1, 0, 'D7'],
  [2, 0, 'Gm7'],
  [3, 0, 'C7'],
  [4, 0, 'F6'],
  [5, 0, 'F7'],
  [6, 0, 'Bb'],
  [6, 2, 'Bbm6'],
  [7, 0, 'Gm7'],
  [7, 2, 'A7'],
  [8, 0, 'Dm'],
  [9, 0, 'Dm'],
  [10, 0, 'A7'],
  [11, 0, 'Dm'],
  [12, 0, 'Gm'],
  [13, 0, 'Dm'],
  [14, 0, 'Bb'],
  [15, 0, 'C7'],
  [16, 0, 'F6'],
  [17, 0, 'D7'],
  [18, 0, 'Gm7'],
  [19, 0, 'C7'],
  [20, 0, 'Am7'],
  [20, 2, 'D7'],
  [21, 0, 'Gm7'],
  [21, 2, 'C7'],
  [22, 0, 'F6'],
  [22, 2, 'D7'],
  [23, 0, 'F'],
  [23, 2, 'C7'],
];
const spans = changes.map(([b, beat, sym], i) => {
  const t = b * bar + beat;
  const next = changes[i + 1];
  return { t, d: (next ? next[0] * bar + next[1] : 24 * bar) - t, sym };
});

/** Close voicing between E4 and F5. */
const voice = (sym: string) =>
  chord(sym, 4)
    .map((n) => (n > 77 ? n - 12 : n < 64 ? n + 12 : n))
    .sort((a, b) => a - b);

// ---------------------------------------------------------------- melody

const tuneA1 = seq(
  [
    'C5 C5 F5:2 A5 G5 F5 D5',
    'F#5:2 A5 C6:3 A5 F#5',
    'Bb5 A5 G5 F5 D5:2 Bb4 D5',
    'E5:3 G5 Bb5:2 A5 G5',
    'C5 C5 F5:2 A5 C6 D6 C6',
    'A5:2 F5 Eb5:3 D5 C5',
    'D5:2 F5 Bb5 Db5:2 F5 G5',
    'D6 C6 Bb5 G5 E5 C#5 D5 E5',
  ].join(' '),
  { step: 0.5, v: 0.8 },
);
const tarantella = seq(
  [
    'A5:2 F5 D5:2 F5 A5:2 D6 C#6:2 D6',
    'E6:2 D6 C#6:2 D6 A5:3 F5:3',
    'E5:2 G5 C#6:2 E6 G6:2 F6 E6:2 C#6',
    'D6:2 A5 F5:2 A5 D6:6',
    'G5:2 Bb5 D6:2 Bb5 G5:2 Bb5 D6:2 G6',
    'F6:2 E6 D6:2 C#6 D6:2 A5 F5:2 D5',
    'D5:2 F5 Bb5:2 D6 F6:2 D6 Bb5:2 F5',
    'G5:2 Bb5 C6:2 Bb5 A5 G5 F5 E5 D5 E5',
  ].join(' '),
  { step: 1 / 3, v: 0.85, start: 32 },
);
const tuneA2 = seq(
  [
    'C6 C6 F6:2 D6 C6 A5 F5',
    'F#5 A5 D6 F#6 E6:2 D6 C6',
    'Bb5:2 D6 Bb5 G5:2 F5 G5',
    'E5 G5 C6 E6 D6:2 C6 Bb5',
    'C6:2 A5 E5 F#5:2 A5 C6',
    'Bb5:2 G5 D5 E5:2 G5 Bb5',
    'A5:3 F5 F#5:2 A5 D6',
    'F5:2 A5 C6 Bb5 G5 E5 D5',
  ].join(' '),
  { step: 0.5, v: 0.85, start: 64 },
);
/** Phrase arcs: each two-bar phrase swells to its middle; downbeats lean in. */
const arc = (base: number) => (t: number) => {
  const p = (t % 8) / 8;
  return base * (0.82 + 0.26 * Math.sin(Math.PI * p)) * (t % 1 < 0.01 ? 1.06 : 0.97);
};
const clarinetLine = [
  ...shape(swing(tuneA1), arc(0.9)),
  ...seq('F5:12 E5:12 E5:6 G5:6 F5:12 D5:6 G5:6 F5:6 A5:6 F5:6 D5:6 E5:6 G5:6', {
    step: 1 / 3,
    v: 0.4,
    start: 32,
  }),
];
const accordionLead = [
  ...shape(shift(tarantella, 0, -12), (t) => (t < 48 ? 0.85 : 1) * (t % 1 < 0.01 ? 1.08 : 0.92)),
  ...shape(swing(tuneA2), arc(1)),
];
const mandolinLine = [
  // A1: soft tremolo on chord thirds and sevenths, like a café mandolin player filling in.
  ...seq('A5:16 F#5:16 F5:16 E5:16 A5:16 Eb5:16 D5:8 Db5:8 Bb4:8 C#5:8', { step: 0.25, v: 0.42 }),
  ...shape(tarantella, (t) => (t < 48 ? 0.9 : 1) * (t % 1 < 0.01 ? 1.1 : 0.88)),
  // A2: offbeat double-stops answering the accordion.
  ...swing(
    spans
      .filter((s) => s.t >= 64)
      .flatMap((s) =>
        [1.5, 3.5]
          .filter((b) => b < s.d)
          .flatMap((b) =>
            voice(s.sym)
              .slice(-2)
              .map((n) => ({ t: s.t + b, d: 0.4, n: n + 12, v: 0.5 })),
          ),
      ),
  ),
];

// ---------------------------------------------------------------- accompaniment

/** Swing sections: accordion "chick" on 2 and 4 with a swung push into the next bar. */
const accordionComp = swing(
  spans
    .filter((s) => !isB(s.t))
    .flatMap((s) =>
      [1, 3, 3.5]
        .map((b) => s.t - (s.t % bar) + b)
        .filter((t) => t >= s.t && t < s.t + s.d)
        .flatMap((t) =>
          voice(s.sym).map((n) => ({
            t,
            d: t % 1 ? 0.35 : 0.55,
            n,
            v: t % 1 ? 0.45 : isA1(t) ? 0.55 : 0.62,
          })),
        ),
    ),
);
/** Tarantella: chords on the last two triplets of every beat, under the bass on the beat. */
const tarantellaComp = spans
  .filter((s) => isB(s.t))
  .flatMap((s) =>
    Array.from({ length: s.d }, (_, b) => s.t + b).flatMap((t) =>
      voice(s.sym).flatMap((n) => [
        { t: t + 1 / 3, d: 0.22, n: n - 12, v: 0.4 },
        { t: t + 2 / 3, d: 0.22, n: n - 12, v: 0.55 },
      ]),
    ),
  );
const pianoComp = swing(
  spans
    .filter((s) => !isB(s.t))
    .flatMap((s) =>
      [0, 2]
        .filter((b) => b < s.d)
        .flatMap((b) => {
          const v = isA1(s.t) ? 0.45 : 0.55;
          return [
            { t: s.t + b, d: 0.45, n: root(s.sym, 3), v: v + 0.08 },
            ...voice(s.sym).map((n) => ({ t: s.t + b + 1, d: 0.35, n, v })),
          ];
        }),
    ),
);
/** A held A7 swell on the accordion that tips A1 into the D-minor tarantella. */
const swell = voice('A7').map((n) => ({ t: 30, d: 2, n: n - 12, v: 0.55 }));

/** Bass: walking quarters through the swing sections, a root-fifth gallop in the tarantella. */
const bassNotes: Note[] = spans.flatMap((s, i) => {
  const r = root(s.sym, 2);
  const next = root(spans[(i + 1) % spans.length]!.sym, 2);
  const third = /m/.test(s.sym) ? 3 : 4;
  if (!isB(s.t)) {
    const approach = next > r ? next - 1 : next + 1;
    const walk = s.d === 2 ? [r, approach] : [r, r + third, r + 7, approach];
    return walk.map((n, k) => ({ t: s.t + k, d: 0.85, n, v: k === 0 ? 0.92 : k % 2 ? 0.68 : 0.76 }));
  }
  return Array.from({ length: s.d }, (_, b) => ({
    t: s.t + b,
    d: 0.5,
    n: b % 2 ? r + 7 - 12 : r,
    v: b % 2 ? 0.75 : 0.92,
  }));
});
const bassLine = [...swing(bassNotes.filter((n) => !isB(n.t))), ...bassNotes.filter((n) => isB(n.t))];

// ---------------------------------------------------------------- drums

const swingBars = (from: number, n: number, pattern: string, step = 0.5, nn = 60) =>
  swing(loop(grid(pattern, { step, n: nn }), n, bar).map((x) => ({ ...x, t: x.t + from * bar })));
const at = (from: number, notes: Note[]) => notes.map((n) => ({ ...n, t: n.t + from * bar }));

const rideA = [...swingBars(0, 8, 'o.x-o.x-'), ...swingBars(16, 8, 'x.x-o.x-')];
const hatFoot = [
  ...loop(grid('..x...x.', { step: 0.5, n: 40 }), 8, bar),
  ...at(16, loop(grid('..x...x.', { step: 0.5, n: 40 }), 8, bar)),
];
const kicks = [
  ...loop(grid('x...-.o.', { step: 0.5 }), 7, bar),
  ...at(8, loop(grid('x.....o.....', { step: 1 / 3 }), 8, bar)),
  ...swingBars(16, 8, 'x....-o.'),
  ...swing([{ t: 95.5, d: 0.3, n: 60, v: 0.8 }]),
];
const rims = loop(grid('..x...x.', { step: 0.5 }), 7, bar);
const snares = [
  // A1: a light swung backbeat with ghosts under the cross-stick.
  ...swingBars(0, 7, '-.o..-o-'),
  ...swing(at(7, grid('-.o.', { step: 0.5 }))),
  // A1 -> B: a triplet fill over snare and toms.
  ...at(7, [
    { t: 2, d: 0.3, n: 60, v: 0.75 },
    { t: 2 + 2 / 3, d: 0.3, n: 60, v: 0.6 },
    { t: 3 + 1 / 3, d: 0.3, n: 60, v: 0.85 },
    { t: 3 + 2 / 3, d: 0.3, n: 60, v: 0.95 },
  ]),
  // B: tarantella backbeat on the 2nd and 4th dotted beats with ghosts.
  ...at(8, loop(grid('...x.-...x.-', { step: 1 / 3 }), 7, bar)),
  // B -> A2: snare and toms trading triplets.
  ...at(15, [...grid('...x.-x..o..', { step: 1 / 3 }), { t: 3 + 2 / 3, d: 0.3, n: 60, v: 0.9 }]),
  // A2: swung backbeat with ghost notes; a light swing fill turns around into the top.
  ...swingBars(16, 7, '-.x..-x-'),
  ...swing(at(23, grid('-.x..o-x', { step: 0.5 }))),
];
const toms = [
  ...at(7, [
    { t: 2 + 1 / 3, d: 0.3, n: 50, v: 0.7 },
    { t: 3, d: 0.3, n: 45, v: 0.8 },
  ]),
  ...at(15, [
    { t: 2 + 1 / 3, d: 0.3, n: 52, v: 0.75 },
    { t: 2 + 2 / 3, d: 0.3, n: 50, v: 0.7 },
    { t: 3 + 1 / 3, d: 0.3, n: 45, v: 0.85 },
  ]),
  ...swing(at(23, [{ t: 3, d: 0.3, n: 45, v: 0.6 }])),
];
const tambs = shape(at(8, loop(grid('x-ox-ox-ox-o', { step: 1 / 3 }), 8, bar)), (t) => (t < 48 ? 0.85 : 1));
const crashes = [
  ...swing([{ t: 95.5, d: 1, n: 60, v: 0.85 }]),
  { t: 32, d: 1, n: 60, v: 0.95 },
  { t: 48, d: 1, n: 60, v: 0.65 },
  { t: 64, d: 1, n: 60, v: 0.9 },
];

/** Section dynamics: A1 relaxed, the tarantella at full tilt, A2 swinging hard but a notch below. */
const dyn = (t: number) => (isA1(t) ? 0.9 : isB(t) ? 1 : 0.94);

export const song: Song = {
  id: 'papas-pizzeria',
  title: "Papa's Pizzeria",
  evokes: "Papa's Pizzeria (Flipline Studios): an original café swing and tarantella",
  bpm: 132,
  loopBeats: 24 * bar,
  seed: 7,
  reverb: { room: 0.52, damp: 0.55, wet: 0.32 },
  room: drumRoom,
  master,
  tracks: [
    {
      inst: clarinet,
      gain: -7.5,
      pan: 0.15,
      verb: 0.32,
      hp: 150,
      eq: [deHarsh],
      loop: human(clarinetLine, 11, 0.1, 0.012),
    },
    {
      inst: accordion,
      gain: 0,
      pan: -0.22,
      verb: 0.26,
      hp: 150,
      eq: [deHarsh],
      loop: human(accordionLead, 12, 0.08, 0.008),
    },
    {
      inst: accordion,
      gain: -4,
      pan: -0.55,
      width: 0.4,
      verb: 0.26,
      hp: 120,
      eq: [lowMid],
      loop: human(shape([...accordionComp, ...swell, ...tarantellaComp], dyn), 13, 0.12, 0.01),
    },
    {
      inst: mandolin,
      gain: 5,
      pan: 0.55,
      width: 0.3,
      verb: 0.34,
      hp: 200,
      eq: [deHarsh],
      loop: human(shape(mandolinLine, dyn), 14, 0.14, 0.01),
    },
    {
      inst: upPiano,
      gain: -8,
      pan: -0.35,
      width: 0.4,
      verb: 0.3,
      hp: 100,
      loop: human(shape(pianoComp, dyn), 15, 0.14, 0.012),
    },
    { inst: upright, gain: -3, verb: 0.06, room: 0.1, loop: human(shape(bassLine, dyn), 16, 0.08, 0.006) },
    { inst: 'kick', gain: -4.5, verb: 0, room: 0.1, loop: human(shape(kicks, dyn), 17, 0.08, 0.004) },
    {
      inst: 'snare',
      gain: -2.5,
      pan: 0.05,
      verb: 0.14,
      room: 0.45,
      loop: human(shape(snares, dyn), 18, 0.14, 0.006),
    },
    { inst: rim, gain: -3, pan: 0.1, verb: 0.1, room: 0.4, loop: human(rims, 19, 0.14, 0.005) },
    {
      inst: 'ride',
      gain: -11,
      pan: 0.36,
      verb: 0.08,
      room: 0.15,
      eq: [tame],
      loop: human(shape(rideA, dyn), 20, 0.16, 0.005),
    },
    {
      inst: 'hat',
      gain: -7,
      pan: -0.32,
      verb: 0.03,
      room: 0.15,
      eq: [tame],
      loop: human(hatFoot, 21, 0.12, 0.004),
    },
    { inst: tamb, gain: -4, pan: 0.5, verb: 0.15, room: 0.3, loop: human(tambs, 22, 0.18, 0.008) },
    { inst: 'tom', gain: -9, pan: -0.12, verb: 0.12, room: 0.4, loop: human(toms, 23, 0.08, 0.004) },
    { inst: 'crash', gain: -8, pan: -0.22, width: 0.7, verb: 0.2, room: 0.1, eq: [tame], loop: crashes },
  ],
};
