import {
  brassHit,
  clap,
  clav,
  cowbell,
  crash,
  hat,
  horn,
  human,
  kick,
  rhodes,
  roll,
  shape,
  slapBass,
  snare,
  softLead,
  swing,
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
/** Brass: chorus hits on the pushes, trumpets on the top two chord tones and trombones an octave below. */
const brassHits = (pick: (keys: number[]) => number[]) =>
  spans
    .filter((s) => section(s.t) === 'B')
    .flatMap((s) =>
      [1.5, 2.75]
        .filter((b) => b < s.d)
        .flatMap((b) => pick(s.v.keys).map((n) => ({ t: s.t + b, d: 0.3, n, v: b === 2.75 ? 0.78 : 0.68 }))),
    );
const trumpets = brassHits((k) => k.slice(2).map((n) => n + 12));
const trombones = brassHits((k) => k.slice(0, 2));
/** Two "honk honk" car horns in the breakdown. */
const honks = [
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
  ...grid('....x..-..x.', { step: 0.25, start: 28 }),
  ...roll(31, 32, 4, 0.55, 0.9, 4),
  ...loop(grid(snareBar, { step: 0.25, start: 32 }), 7, bar),
  ...grid('....x..-.-..x.x.', { step: 0.25, start: 60 }),
  ...loop(grid('....x.......x...', { step: 0.25, start: 64 }), 3, bar),
  ...grid('....x...', { step: 0.25, start: 76 }),
  ...roll(78, 80, 4, 0.45, 1, 3),
];
const claps = loop(grid('....x.......x...', { step: 0.25 }), 19, bar);
/** Hats: sixteenths with a lilting accent, an open hat on the and of 4 every other bar (every bar in B). */
const openAt = (t: number) => t % 1 === 0.5 && t % 4 === 3.5 && (section(t) === 'B' || t % 8 === 7.5);
const hats = loop(grid('x-o-x-oox-o-x-o-', { step: 0.25, n: 40 }), 19, bar).map((n) =>
  openAt(n.t) ? { ...n, n: 64, v: 0.6 } : n,
);
const tambs = loop(grid('....x.......x...', { step: 0.25, start: 32 }), 8, bar);
const bells = loop(grid('x..o..x...o.x..-', { step: 0.25, start: 64 }), 4, bar);
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

const dyn = (t: number) => ({ A: 0.9, B: 1, C: 0.88 })[section(t)];
/** A light sixteenth-note pocket: every off-sixteenth sits a hair late. */
const pocket = (notes: Note[]) => swing(notes, 0.55, 0.5);

export const song: Song = {
  id: 'wheely-trucks',
  title: 'Wheely',
  evokes: 'Wheely (Pegas Games): an original feel-good funk-pop drive',
  bpm: 112,
  loopBeats: 20 * bar,
  seed: 41,
  reverb: { room: 0.48, damp: 0.5, wet: 0.3 },
  tracks: [
    { inst: softLead, gain: -2.5, pan: -0.05, verb: 0.32, loop: human(pocket(tuneShaped), 71, 0.1, 0.008) },
    { inst: vibes, gain: -11, pan: 0.42, verb: 0.38, loop: human(pocket(tuneShaped), 72, 0.12, 0.01) },
    {
      inst: slapBass,
      gain: -5,
      pan: 0,
      verb: 0.04,
      loop: human(pocket(shape(bassLine, dyn)), 73, 0.1, 0.005),
    },
    {
      inst: clav,
      gain: -6,
      pan: 0.6,
      verb: 0.18,
      loop: human(pocket(shape(clavLine, dyn)), 74, 0.16, 0.005),
    },
    { inst: rhodes, gain: -8, pan: -0.58, verb: 0.32, loop: human(pocket(rhodesLine), 75, 0.12, 0.008) },
    { inst: brassHit, gain: 1, pan: 0.35, verb: 0.32, loop: human(pocket(trumpets), 76, 0.08, 0.006) },
    { inst: brassHit, gain: 0, pan: -0.35, verb: 0.32, loop: human(pocket(trombones), 83, 0.08, 0.008) },
    { inst: horn, gain: -9, pan: 0.2, verb: 0.38, loop: honks },
    { inst: kick, gain: -7.5, pan: 0, verb: 0.05, loop: human(pocket(shape(kicks, dyn)), 77, 0.08, 0.004) },
    {
      inst: snare,
      gain: -4,
      pan: 0.05,
      verb: 0.24,
      loop: human(pocket(shape(snares, dyn)), 78, 0.14, 0.005),
    },
    { inst: clap, gain: 2, pan: -0.3, verb: 0.3, loop: human(pocket(shape(claps, dyn)), 79, 0.14, 0.008) },
    { inst: clap, gain: 1, pan: 0.3, verb: 0.3, loop: human(pocket(shape(claps, dyn)), 84, 0.14, 0.012) },
    { inst: hat, gain: -2, pan: 0.38, verb: 0.1, loop: human(pocket(shape(hats, dyn)), 80, 0.18, 0.005) },
    { inst: tamb, gain: 1, pan: 0.62, verb: 0.2, loop: human(pocket(tambs), 81, 0.14, 0.008) },
    { inst: cowbell, gain: -3.5, pan: -0.25, verb: 0.25, loop: human(pocket(bells), 82, 0.14, 0.006) },
    { inst: tom, gain: -6, pan: -0.1, verb: 0.2, loop: toms },
    { inst: crash, gain: -5, pan: -0.25, verb: 0.3, loop: crashes },
  ],
};
