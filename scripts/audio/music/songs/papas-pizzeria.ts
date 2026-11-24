import {
  accordion,
  clarinet,
  crash,
  hat,
  human,
  kick,
  mandolin,
  ride,
  rim,
  roll,
  shape,
  snare,
  swing,
  tamb,
  tom,
  upPiano,
  upright,
} from '../kits/cheerful.ts';
import { chord, grid, loop, root, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Papa's Pizzeria stage: an original café-swing romp in F major with an Italian accent. A1 is a shuffle with
 * a clarinet tune over accordion and upright bass; A2 hands the tune to the accordion with a bar-room piano
 * and a walking bass; B breaks into a D-minor tarantella (mandolin and accordion over tambourine) whose last
 * bar runs back into the top. 24 bars at 132 BPM.
 */
const bar = 4;
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
  [7, 0, 'F'],
  [7, 2, 'C7'],
  [8, 0, 'F6'],
  [9, 0, 'D7'],
  [10, 0, 'Gm7'],
  [11, 0, 'C7'],
  [12, 0, 'Am7'],
  [12, 2, 'D7'],
  [13, 0, 'Gm7'],
  [13, 2, 'C7'],
  [14, 0, 'F6'],
  [14, 2, 'D7'],
  [15, 0, 'Gm7'],
  [15, 2, 'A7'],
  [16, 0, 'Dm'],
  [17, 0, 'Dm'],
  [18, 0, 'A7'],
  [19, 0, 'Dm'],
  [20, 0, 'Gm'],
  [21, 0, 'Dm'],
  [22, 0, 'Bb'],
  [23, 0, 'C7'],
];
const spans = changes.map(([b, beat, sym], i) => {
  const t = b * bar + beat;
  const next = changes[i + 1];
  return { t, d: (next ? next[0] * bar + next[1] : 24 * bar) - t, sym };
});

/** Close voicing between E4 and F5. */
const voice = (sym: string) =>
  chord(sym.split('/')[0]!, 4)
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
    'A5:2 F5 C5 E5 G5 Bb5 C6',
  ].join(' '),
  { step: 0.5, v: 0.8 },
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
    'D6 C6 Bb5 G5 E5 C#5 D5 E5',
  ].join(' '),
  { step: 0.5, v: 0.85, start: 32 },
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
  { step: 1 / 3, v: 0.85, start: 64 },
);
/** Phrase arcs: each two-bar phrase swells to its middle; downbeats lean in. */
const arc = (base: number) => (t: number) => {
  const p = (t % 8) / 8;
  return base * (0.86 + 0.22 * Math.sin(Math.PI * p)) * (t % 1 < 0.01 ? 1.06 : 1);
};
const clarinetLine = [
  ...shape(swing(tuneA1), arc(0.85)),
  ...seq('F5:12 E5:12 E5:6 G5:6 F5:12 D5:6 G5:6 F5:6 A5:6 F5:6 D5:6 E5:6 G5:6', {
    step: 1 / 3,
    v: 0.4,
    start: 64,
  }),
];
const accordionLead = [
  ...shape(swing(tuneA2), arc(1)),
  ...shape(shift(tarantella, 0, -12), (t) => (t < 80 ? 0.85 : 1) * (t % 1 < 0.01 ? 1.08 : 0.92)),
];
const mandolinLine = [
  // A1: soft tremolo on chord thirds and sevenths, like a café mandolin player filling in.
  ...seq('A5:16 F#5:16 F5:16 E5:16 A5:16 Eb5:16 D5:8 Db5:8 C5:8 Bb4:8', { step: 0.25, v: 0.42 }),
  // A2: offbeat double-stops answering the accordion.
  ...swing(
    spans
      .filter((s) => s.t >= 32 && s.t < 64)
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
  ...shape(tarantella, (t) => (t < 80 ? 0.9 : 1) * (t % 1 < 0.01 ? 1.1 : 0.9)),
];

// ---------------------------------------------------------------- accompaniment

/** A sections: accordion "chick" on 2 and 4 with a swung push into the next bar. */
const accordionComp = swing(
  spans
    .filter((s) => s.t < 64)
    .flatMap((s) =>
      [1, 3, 3.5]
        .map((b) => s.t - (s.t % bar) + b)
        .filter((t) => t >= s.t && t < s.t + s.d)
        .flatMap((t) =>
          voice(s.sym).map((n) => ({ t, d: t % 1 ? 0.35 : 0.55, n, v: t % 1 ? 0.45 : t < 32 ? 0.55 : 0.62 })),
        ),
    ),
);
/** Tarantella: chords on the last two triplets of every beat, under the bass on the beat. */
const tarantellaComp = spans
  .filter((s) => s.t >= 64)
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
    .filter((s) => s.t < 64)
    .flatMap((s) =>
      [0, 2]
        .filter((b) => b < s.d)
        .flatMap((b) => {
          const v = s.t < 32 ? 0.42 : 0.55;
          return [
            { t: s.t + b, d: 0.45, n: root(s.sym, 3), v: v + 0.08 },
            ...voice(s.sym).map((n) => ({ t: s.t + b + 1, d: 0.35, n, v })),
          ];
        }),
    ),
);
/** A held A7 swell on the accordion that tips A2 into the D-minor tarantella. */
const swell = voice('A7').map((n) => ({ t: 62, d: 2, n: n - 12, v: 0.55 }));

/** Bass: walking quarters through the swing sections, a root-fifth gallop in the tarantella. */
const rootOf = (sym: string) => root(sym, 2);
const bassNotes: Note[] = spans.flatMap((s, i) => {
  const r = rootOf(s.sym);
  const next = rootOf(spans[(i + 1) % spans.length]!.sym);
  const third = /m/.test(s.sym.replace('maj', '')) ? 3 : 4;
  if (s.t < 64) {
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

const bassLine = [...swing(bassNotes.filter((n) => n.t < 64)), ...bassNotes.filter((n) => n.t >= 64)];

// ---------------------------------------------------------------- drums

const swingBars = (from: number, n: number, pattern: string, step = 0.5, nn = 60) =>
  swing(loop(grid(pattern, { step, n: nn }), n, bar).map((x) => ({ ...x, t: x.t + from * bar })));
const rideA = [...swingBars(0, 16, 'o.x-o.x-'), ...swingBars(15, 1, '........')];
const hatFoot = loop(grid('..x...x.', { step: 0.5, n: 40 }), 16, bar);
const kickA = [...loop(grid('o...-...', { step: 0.5 }), 8, bar), ...swingBars(8, 8, 'x....-o.')];
const rimA1 = loop(grid('..x...x.', { step: 0.5 }), 7, bar);
const snareA2 = swingBars(8, 7, '-.x..-x-');
const fillA1 = swing(grid('....o-xx', { step: 0.5, start: 7 * bar }));
const fillA2 = grid('......x-o-x-xox', { step: 1 / 3, start: 15 * bar }).slice(-8);
const tomsA2 = [
  { t: 15 * bar + 2, d: 0.3, n: 50, v: 0.7 },
  { t: 15 * bar + 2 + 1 / 3, d: 0.3, n: 47, v: 0.75 },
  { t: 15 * bar + 3, d: 0.3, n: 43, v: 0.85 },
  { t: 15 * bar + 3 + 1 / 3, d: 0.3, n: 40, v: 0.9 },
];
const kickB = loop(grid('x.....o.....', { step: 1 / 3, start: 64 }), 8, bar);
const snareB = [
  ...loop(grid('...x.-...x.-', { step: 1 / 3, start: 64 }), 7, bar),
  ...grid('...x.-', { step: 1 / 3, start: 23 * bar }),
  ...roll(23 * bar + 2, 24 * bar, 6, 0.35, 1, 5),
];
const tambB = shape(loop(grid('x-ox-ox-ox-o', { step: 1 / 3, start: 64 }), 7, bar), (t) =>
  t < 80 ? 0.85 : 1,
);
const tomsB = [
  { t: 23 * bar + 2, d: 0.3, n: 52, v: 0.75 },
  { t: 23 * bar + 2 + 2 / 3, d: 0.3, n: 47, v: 0.8 },
  { t: 23 * bar + 3 + 1 / 3, d: 0.3, n: 43, v: 0.9 },
];
const crashes = [
  { t: 0, d: 1, n: 60, v: 0.85 },
  { t: 32, d: 1, n: 60, v: 0.9 },
  { t: 64, d: 1, n: 60, v: 0.95 },
  { t: 80, d: 1, n: 60, v: 0.7 },
];

/** Section dynamics: A1 relaxed, A2 fuller, the tarantella at full tilt. */
const dyn = (t: number) => (t < 32 ? 0.8 : t < 64 ? 0.92 : 1);

export const song: Song = {
  id: 'papas-pizzeria',
  title: "Papa's Pizzeria",
  evokes: "Papa's Pizzeria (Flipline Studios): an original café swing and tarantella",
  bpm: 132,
  loopBeats: 24 * bar,
  seed: 7,
  reverb: { room: 0.5, damp: 0.55, wet: 0.32 },
  tracks: [
    { inst: clarinet, gain: -7.5, pan: -0.12, verb: 0.32, loop: human(clarinetLine, 11, 0.1, 0.012) },
    { inst: accordion, gain: -1.5, pan: 0.12, verb: 0.25, loop: human(accordionLead, 12, 0.06, 0.008) },
    {
      inst: accordion,
      gain: -4,
      pan: -0.62,
      verb: 0.25,
      loop: human(shape([...accordionComp, ...swell, ...tarantellaComp], dyn), 13, 0.12, 0.01),
    },
    { inst: mandolin, gain: 2, pan: 0.62, verb: 0.32, loop: human(shape(mandolinLine, dyn), 14, 0.14, 0.01) },
    { inst: upPiano, gain: -8, pan: -0.4, verb: 0.3, loop: human(pianoComp, 15, 0.14, 0.012) },
    { inst: upright, gain: -1.5, pan: 0, verb: 0.08, loop: human(shape(bassLine, dyn), 16, 0.06, 0.006) },
    {
      inst: kick,
      gain: -6,
      pan: 0,
      verb: 0.05,
      loop: human(shape([...kickA, ...kickB], dyn), 17, 0.06, 0.004),
    },
    {
      inst: snare,
      gain: -5,
      pan: 0.05,
      verb: 0.26,
      loop: human(shape([...snareA2, ...fillA1, ...fillA2, ...snareB], dyn), 18, 0.12, 0.006),
    },
    { inst: rim, gain: -3, pan: 0.1, verb: 0.2, loop: human(rimA1, 19, 0.14, 0.005) },
    { inst: ride, gain: -6, pan: -0.4, verb: 0.22, loop: human(shape(rideA, dyn), 20, 0.16, 0.005) },
    { inst: hat, gain: 0, pan: 0.4, verb: 0.1, loop: human(hatFoot, 21, 0.1, 0.004) },
    { inst: tamb, gain: -3, pan: 0.6, verb: 0.25, loop: human(tambB, 22, 0.18, 0.008) },
    { inst: tom, gain: -9, pan: -0.1, verb: 0.25, loop: [...tomsA2, ...tomsB] },
    { inst: crash, gain: -3, pan: -0.2, verb: 0.3, loop: crashes },
  ],
};
