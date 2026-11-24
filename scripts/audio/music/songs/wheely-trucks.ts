import {
  brassHit,
  clap,
  clav,
  cowbell,
  crash,
  hat,
  human,
  kick,
  rhodes,
  shape,
  slapBass,
  snare,
  softLead,
  tamb,
  tom,
  vibes,
} from '../kits/cheerful.ts';
import { grid, loop, seq, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Wheely stage: an original feel-good funk-pop cruise in E major for the little red car. A is the groove
 * (slap bass, clavinet sixteenths, rhodes, claps) under a sweet soft-synth tune doubled on vibes; B is the
 * chorus with brass hits and a higher tune; C breaks down to bass, clav and cowbell with two car-horn honks
 * before a drum fill rolls back into the top. 20 bars at 112 BPM.
 */
const bar = 4;
/** Hand voicings (MIDI) for rhodes, with the slap-bass root (MIDI) for each chord. */
const V: Record<string, { keys: number[]; root: number }> = {
  E9: { keys: [56, 62, 66, 71], root: 28 },
  A9: { keys: [55, 61, 64, 71], root: 33 },
  'C#m7': { keys: [59, 61, 64, 68], root: 37 },
  'F#9': { keys: [58, 61, 64, 68], root: 30 },
  Amaj7: { keys: [56, 61, 64, 69], root: 33 },
  B7sus4: { keys: [57, 59, 64, 66], root: 35 },
  B7: { keys: [57, 59, 63, 66], root: 35 },
  B: { keys: [59, 63, 66, 71], root: 35 },
  'G#m7': { keys: [56, 59, 63, 66], root: 32 },
  'E/G#': { keys: [56, 59, 64, 68], root: 32 },
};
const changes: [number, number, string][] = [
  [0, 0, 'E9'],
  [1, 0, 'A9'],
  [2, 0, 'E9'],
  [3, 0, 'A9'],
  [4, 0, 'C#m7'],
  [5, 0, 'F#9'],
  [6, 0, 'Amaj7'],
  [7, 0, 'B7sus4'],
  [7, 2, 'B7'],
  [8, 0, 'Amaj7'],
  [9, 0, 'B'],
  [10, 0, 'G#m7'],
  [11, 0, 'C#m7'],
  [12, 0, 'Amaj7'],
  [13, 0, 'B'],
  [14, 0, 'E/G#'],
  [14, 2, 'Amaj7'],
  [15, 0, 'B7'],
  [16, 0, 'E9'],
  [17, 0, 'E9'],
  [18, 0, 'A9'],
  [19, 0, 'B7'],
];
const spans = changes.map(([b, beat, sym], i) => {
  const t = b * bar + beat;
  const next = changes[i + 1];
  return { t, d: (next ? next[0] * bar + next[1] : 20 * bar) - t, v: V[sym]! };
});
const section = (t: number) => (t < 32 ? 'A' : t < 64 ? 'B' : 'C');

// ---------------------------------------------------------------- tune

const tune = seq(
  [
    'B4:2 E5:2 G#5:3 F#5 E5:2 . . B4:2 . .',
    'C#5:2 E5:2 A5:4 G#5:2 F#5:2 E5:4',
    'B4:2 E5:2 G#5:3 F#5 E5:2 . G#5:3 B5:2',
    'C#6:4 B5:2 A5:2 F#5:4 . . . .',
    'E5:2 G#5:2 B5:3 A5 G#5:2 E5:2 C#5:4',
    'F#5:2 A#5:2 C#6:3 B5 A#5:2 G#5:2 F#5:4',
    'A5:3 G#5 A5:2 C#6:4 B5:2 A5:2 G#5:2',
    'F#5:4 E5:4 D#5:2 E5:2 F#5:2 B5:2',
    'C#6:3 C#6 B5:2 A5:2 G#5:4 E5:4',
    'D#6:3 D#6 C#6:2 B5:2 F#5:8',
    'B5:3 B5 A#5:2 G#5:2 D#5:4 F#5:4',
    'E5:4 G#5:4 B5:4 C#6:4',
    'C#6:3 C#6 B5:2 A5:2 G#5:4 E6:4',
    'D#6:3 E6 F#6:4 D#6:4 B5:4',
    'G#5:4 B5:4 C#6:4 E6:4',
    'F#6:6 E6 D#6 C#6:2 B5:2 A5:2 F#5:2',
  ].join(' '),
  { step: 0.25, v: 0.8 },
);
const tuneShaped = shape(tune, (t) => {
  const p = (t % 8) / 8;
  return (
    (0.84 + 0.2 * Math.sin(Math.PI * p)) * (section(t) === 'B' ? 1.05 : 0.95) * (t % 1 < 0.01 ? 1.05 : 0.95)
  );
});

// ---------------------------------------------------------------- rhythm section

/** Slap bass, one bar of sixteenths: semitones above the root ('.' rests); 12s are popped, the rest thumbed. */
const slapBar: (number | '.')[] = [0, '.', 12, '.', '.', 0, 10, 12, '.', 0, '.', 7, 10, '.', 12, 0];
const slapHalf: (number | '.')[] = [0, '.', 12, '.', '.', 0, 10, 12];
const bassLine: Note[] = spans.flatMap((s) => {
  const pat = s.d === 2 ? slapHalf : slapBar;
  return pat.flatMap((x, k) =>
    x === '.'
      ? []
      : [
          {
            t: s.t + k * 0.25,
            d: x === 12 ? 0.18 : 0.22,
            n: s.v.root + x,
            v: x === 12 ? 0.95 : k % 4 === 0 ? 0.9 : 0.65,
          },
        ],
  );
});
/** Clavinet: a syncopated sixteenth figure on the top two chord tones. */
const clavRhythm = '..x.x..x..x.x..x';
const clavLine = spans.flatMap((s) =>
  [...clavRhythm]
    .map((ch, k) => (ch === 'x' ? s.t + k * 0.25 : -1))
    .filter((t) => t >= s.t && t < s.t + s.d)
    .flatMap((t) =>
      s.v.keys.slice(-2).map((n) => ({ t, d: 0.14, n: n < 64 ? n + 12 : n, v: (t * 4) % 2 ? 0.55 : 0.7 })),
    ),
);
/** Rhodes: held chords in A, pushed stabs in B, silent in the breakdown. */
const rhodesLine = spans.flatMap((s) => {
  if (section(s.t) === 'A') return s.v.keys.map((n) => ({ t: s.t, d: s.d - 0.1, n, v: 0.55 }));
  if (section(s.t) === 'B')
    return [0, 1.5, 2.75]
      .filter((b) => b < s.d)
      .flatMap((b) => s.v.keys.map((n) => ({ t: s.t + b, d: b === 2.75 ? 1 : 0.6, n, v: 0.62 })));
  return [];
});
/** Brass: chorus hits on the pushes, plus two "honk honk" car horns in the breakdown. */
const brassLine = [
  ...spans
    .filter((s) => section(s.t) === 'B')
    .flatMap((s) =>
      [1.5, 2.75]
        .filter((b) => b < s.d)
        .flatMap((b) => s.v.keys.slice(1).map((n) => ({ t: s.t + b, d: 0.3, n: n + 12, v: 0.7 }))),
    ),
  ...seq('[E5,G#5]:1 . [E5,G#5]:2', { step: 0.25, start: 17 * bar + 2, v: 0.75 }),
  ...seq('[D#5,A5]:1 . [D#5,A5]:1 . [F#5,B5]:4', { step: 0.25, start: 19 * bar + 1, v: 0.8 }),
];

// ---------------------------------------------------------------- drums

const kickBar = 'x.....x...x..x..';
const kicks = [
  ...loop(grid(kickBar, { step: 0.25 }), 19, bar),
  ...grid('x.....x.x.......', { step: 0.25, start: 76 }),
];
const snareBar = '....x..-.-..x..-';
const snares = [
  ...loop(grid(snareBar, { step: 0.25 }), 7, bar),
  ...grid('....x..-..x.xxxx', { step: 0.25, start: 28 }),
  ...loop(grid(snareBar, { step: 0.25, start: 32 }), 7, bar),
  ...grid('....x..-.-..x.x.', { step: 0.25, start: 60 }),
  ...loop(grid('....x.......x...', { step: 0.25, start: 64 }), 3, bar),
  ...grid('....x...xoxoxxxx', { step: 0.25, start: 76 }).map((n, k) => ({ ...n, v: n.v * (0.6 + 0.04 * k) })),
];
const claps = loop(grid('....x.......x...', { step: 0.25 }), 19, bar);
const hats = [
  ...loop(grid('x-o-x-o-x-o-x-o-', { step: 0.25, n: 40 }), 19, bar),
  ...loop([{ t: 3.5, d: 0.25, n: 64, v: 0.6 }], 8, 2 * bar).map((n) => ({ ...n, t: n.t + 32 })),
].filter((n) => !(n.n < 60 && n.t >= 32 && n.t < 64 && n.t % 8 === 7.5));
const tambs = loop(grid('....x.......x...', { step: 0.25, start: 32 }), 8, bar);
const bells = loop(grid('x..x..x...x.x...', { step: 0.25, start: 64 }), 4, bar);
const toms = [
  { t: 79, d: 0.3, n: 52, v: 0.8 },
  { t: 79.25, d: 0.3, n: 48, v: 0.85 },
  { t: 79.5, d: 0.3, n: 43, v: 0.9 },
  { t: 79.75, d: 0.3, n: 40, v: 0.95 },
];
const crashes = [
  { t: 0, d: 1, n: 60, v: 0.85 },
  { t: 32, d: 1, n: 60, v: 0.9 },
  { t: 48, d: 1, n: 60, v: 0.65 },
  { t: 64, d: 1, n: 60, v: 0.7 },
];

const dyn = (t: number) => ({ A: 0.88, B: 1, C: 0.8 })[section(t)];

export const song: Song = {
  id: 'wheely-trucks',
  title: 'Wheely',
  evokes: 'Wheely (Pegas Games): an original feel-good funk-pop drive',
  bpm: 112,
  loopBeats: 20 * bar,
  seed: 41,
  reverb: { room: 0.42, damp: 0.5, wet: 0.24 },
  tracks: [
    { inst: softLead, gain: -4, pan: -0.05, verb: 0.3, loop: human(tuneShaped, 71, 0.06, 0.006) },
    { inst: vibes, gain: -12, pan: 0.3, verb: 0.35, loop: human(tuneShaped, 72, 0.08, 0.008) },
    { inst: slapBass, gain: -5, pan: 0, verb: 0.04, loop: human(shape(bassLine, dyn), 73, 0.06, 0.004) },
    { inst: clav, gain: -6, pan: 0.45, verb: 0.15, loop: human(shape(clavLine, dyn), 74, 0.1, 0.004) },
    { inst: rhodes, gain: -8, pan: -0.42, verb: 0.3, loop: human(rhodesLine, 75, 0.08, 0.006) },
    { inst: brassHit, gain: -3, pan: -0.25, verb: 0.3, loop: human(brassLine, 76, 0.06, 0.004) },
    { inst: kick, gain: -7, pan: 0, verb: 0.04, loop: human(shape(kicks, dyn), 77, 0.06, 0.003) },
    { inst: snare, gain: -6, pan: 0.05, verb: 0.2, loop: human(shape(snares, dyn), 78, 0.08, 0.004) },
    { inst: clap, gain: 1, pan: -0.12, verb: 0.25, loop: human(shape(claps, dyn), 79, 0.1, 0.006) },
    { inst: hat, gain: -2, pan: 0.32, verb: 0.08, loop: human(shape(hats, dyn), 80, 0.12, 0.004) },
    { inst: tamb, gain: 2, pan: 0.5, verb: 0.15, loop: human(tambs, 81, 0.1, 0.006) },
    { inst: cowbell, gain: 0, pan: -0.4, verb: 0.2, loop: human(bells, 82, 0.1, 0.004) },
    { inst: tom, gain: -6, pan: -0.1, verb: 0.2, loop: toms },
    { inst: crash, gain: -5, pan: -0.25, verb: 0.3, loop: crashes },
  ],
};
