import { chord, grid, loop, pads, root, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';
import {
  accents,
  arc,
  block,
  choir,
  crash,
  djembe,
  echoes,
  flute,
  frame,
  human,
  kalimba,
  kick,
  lowStrings,
  marimba,
  panFlute,
  phrase,
  ramp,
  riser,
  shaker,
  snare,
  spiccato,
  strings,
  sub,
  swell,
  tambourine,
  timpani,
  tom,
} from '../kits/atmos.ts';

/**
 * Forest Temple: an original Smash-style stage theme in the spirit of Fireboy and Watergirl in the Forest
 * Temple. E Phrygian (the flat second, F, gives the ancient-temple colour) at 140 BPM: a tribal 3+3+2
 * marimba riff, hand drums and a flute melody over ominous low strings. Form A (bars 1-8), B (9-16, a
 * galloping chase with pan flute and choir), A' (17-24, the theme doubled by strings with a higher climax),
 * then a tom fill back to the top.
 */
const BAR = 4;
const A = ['Em', 'F', 'Em', 'D', 'C', 'D', 'Em', 'B'];
const B = ['C', 'C', 'Am', 'Am', 'F', 'F', 'Bsus4', 'B'];
const at = (bar: number) => bar * BAR;

/** A 16-step pattern over each bar's chord: digits index its tones upwards (0 = root), `.` rests. */
const riff = (symbols: string[], pattern: string, octave: number, v: number, start: number): Note[] =>
  symbols.flatMap((s, bar) => {
    const tones = chord(s, octave);
    const ext = [...tones, ...tones.map((n) => n + 12), ...tones.map((n) => n + 24)];
    return [...pattern.replace(/\s/g, '')].flatMap((ch, k) =>
      ch === '.' ? [] : [{ t: start + bar * BAR + k * 0.25, d: 0.25, n: ext[Number(ch)]!, v }],
    );
  });

/** 3+3+2 grouping: accents on the 1st, 4th, 7th, 9th, 12th and 15th sixteenths of the bar. */
const TRIBAL = [1, 0.45, 0.6, 0.95, 0.45, 0.6, 0.92, 0.45, 1, 0.45, 0.6, 0.95, 0.5, 0.45, 0.9, 0.55];

/** Section A sits back so A' lands as the climax. */
const softA = (t: number) => (t < at(8) ? 0.86 : 1);

/** A roll that accelerates in level: quiet, then a steep rise into the downbeat. */
const swellRoll = (t0: number, t1: number, from: number, to: number) => (t: number) =>
  from + (to - from) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) ** 2;

// ---------------------------------------------------------------- melody

const themeA = [
  'B4:2 E5:4 F#5:2 G5:4 F#5:2 E5:2',
  'F5:6 E5:2 C5:4 A4:4',
  'B4:4 E5:2 G5:2 B5:6 A5 G5',
  'A5:6 F#5:2 D5:4 . . F#5:2',
];
const answerA = [
  'G5:4 E5:2 G5:2 C6:6 B5 A5',
  'B5:4 A5:2 F#5:2 D5:4 E5:2 F#5:2',
  'G5:6 F#5:2 E5:4 F5:2 E5:2',
  'D#5:10 . . B4 D#5 F#5 A5',
];
const answerA2 = [
  'G5:4 E5:2 G5:2 C6:6 D6 E6',
  'F#6:4 E6:2 D6:2 A5:4 B5:2 C6:2',
  'B5:6 G5:2 F#5:4 F5:2 E5:2',
  'D#5:10 . . F#5 E5 D#5 C#5',
];
const themeB = [
  'G5:12 E5:2 G5:2',
  'A5:8 G5:4 E5:4',
  'C5:12 B4:2 C5:2',
  'E5:8 D5:4 C5:4',
  'A5:12 G5:2 A5:2',
  'C6:8 B5:4 A5:4',
  'B5:12 A5:2 G5:2',
  'F#5:6 G5:2 F#5:2 E5:2 D#5:4',
];
const melody = (bars: string[], start: number, v: number) =>
  arc(seq(bars.join(' '), { step: 0.25, start, v }), phrase(16, 0.18));

const fluteA = melody([...themeA, ...answerA], 0, 0.68);
const fluteA2 = melody([...themeA, ...answerA2], at(16), 0.85);
const panB = melody(themeB, at(8), 0.75);
const lead = human([...fluteA, ...fluteA2], 3, 0.06, 0.01);
const violins = human(shift(fluteA2, 0, -12), 4, 0.05, 0.015).map((n) => ({ ...n, v: n.v * 0.8 }));

// ---------------------------------------------------------------- harmony and riffs

const marimbaA = accents(riff(A, '0.23.24.3.254.32', 4, 0.74, 0), TRIBAL, 0.25, 4);
const marimbaA2 = accents(riff(A, '0.23.24.3.254.32', 4, 0.88, at(16)), TRIBAL, 0.25, 4);
const marimbaB = arc(riff(B, '..3...4...3...5.', 4, 0.55, at(8)), ramp(at(8), at(16), 0.7, 1.1));
const mallets = human([...marimbaA, ...marimbaB, ...marimbaA2], 5, 0.07, 0.008);

const sparkle = human(arc(riff(A, '..5...3...4...5.', 5, 0.5, at(16)), phrase(8, 0.3)), 6, 0.1, 0.01);

/** Cellos and basses: a swelling root and fifth per bar in A, octaves in A'. */
const lowA = (start: number, v: number) =>
  A.flatMap((s, bar) => [
    { t: start + bar * BAR, d: BAR, n: root(s, 2), v },
    { t: start + bar * BAR, d: BAR, n: root(s, 2) + 7, v: v * 0.8 },
    { t: start + bar * BAR, d: BAR, n: root(s, 3), v: v * 0.7 },
  ]);
const cellos = arc([...lowA(0, 0.6), ...lowA(at(16), 0.75)], phrase(8, 0.25));

/** A dark, bowed tresillo ostinato under A and A' (E2-B2), weighting the bottom. */
const darkA = (start: number, v: number): Note[] =>
  A.flatMap((s, bar) =>
    (
      [
        [0, 0, 1],
        [3, 0, 0.7],
        [6, 7, 0.8],
        [8, 0, 0.95],
        [11, 0, 0.7],
        [14, 7, 0.8],
      ] as const
    ).map(([k, off, a]) => ({ t: start + bar * BAR + k * 0.25, d: 0.5, n: root(s, 2) + off, v: v * a })),
  );
const darkStrings = human([...darkA(0, 0.7), ...darkA(at(16), 0.85)], 17, 0.06, 0.006);
const pickup = seq('F#2:2 G2:2 A2:2 B2:2', { step: 0.25, start: at(7) + 2, v: 0.8 });

/** The B section's galloping spiccato. */
const gallop = arc(
  accents(riff(B, '0.00 0.00 0.00 2.11', 3, 0.75, at(8)), [1, 0.5, 0.6, 0.7], 0.25, 1),
  ramp(at(8), at(16), 0.75, 1.15),
);

const choirB = pads(B, { octave: 4, v: 0.6, start: at(8) });
const choirA2 = pads(A.slice(0, 7), { octave: 4, v: 0.45, start: at(16) });
/** The last bar's chord swells and rings across the loop point into the top. */
const choirWrap = pads(['B'], { octave: 4, v: 0.6, beats: 5, start: at(23) });
const voices = arc([...choirB, ...choirA2, ...choirWrap], phrase(8, 0.3));

// ---------------------------------------------------------------- bass

const tresillo = (symbols: string[], start: number, v: number): Note[] =>
  symbols.flatMap((s, bar) =>
    (
      [
        [0, 3, 0, 1],
        [3, 3, 0, 0.72],
        [6, 2, 12, 0.78],
        [8, 3, 0, 0.92],
        [11, 3, 0, 0.72],
        [14, 2, 7, 0.8],
      ] as const
    ).map(([k, len, off, a]) => ({
      t: start + bar * BAR + k * 0.25,
      d: len * 0.25 * 0.9,
      n: root(s, 1) + off,
      v: v * a,
    })),
  );
const bassB = B.flatMap((s, bar) => [
  { t: at(8 + bar), d: 2.4, n: root(s, 1), v: 0.85 },
  { t: at(8 + bar) + 2.5, d: 0.45, n: root(s, 1), v: 0.65 },
  { t: at(8 + bar) + 3, d: 0.9, n: root(s, 1) + 7, v: 0.75 },
]);
const bassLine = human([...tresillo(A, 0, 0.85), ...bassB, ...tresillo(A, at(16), 0.95)], 7, 0.04, 0.004);

// ---------------------------------------------------------------- drums

const bars = (pattern: string, from: number, count: number, n = 0) =>
  loop(grid(pattern, { n, start: at(from) }), count, BAR);

const kicks = [
  ...bars('x.....x.x..o....', 0, 7),
  ...bars('x.....x.x.......', 7, 1),
  ...bars('x.........x.....', 8, 6),
  ...bars('x.........x.x.x.', 14, 1),
  ...bars('x...x...x...x...', 15, 1),
  ...bars('x.....x.x..o....', 16, 7),
  ...bars('x.....x.x.....x.', 23, 1),
];
const snareRoll = arc(grid('xxxxxxxxxxxxxxxx', { start: at(15) }), swellRoll(at(15), at(16), 0.18, 0.95));
const snares = [
  ...bars('....x..-....x..-', 0, 7),
  ...bars('....x.......x...', 7, 1),
  ...bars('........x.......', 8, 6),
  ...bars('........x...x.x.', 14, 1),
  ...snareRoll,
  ...bars('....x..-....x..-', 16, 7),
  ...bars('....x.......', 23, 1),
];

/** Djembe: bass (B), tone (T) and slap (S) strokes on a 16-step grid. */
const hand = (pattern: string, from: number, count: number) =>
  loop(
    [...pattern].flatMap((ch, k) => {
      const stroke = { B: [40, 0.85], T: [64, 0.6], S: [76, 0.75], t: [64, 0.35], s: [76, 0.4] }[ch];
      return stroke ? [{ t: at(from) + k * 0.25, d: 0.25, n: stroke[0]!, v: stroke[1]! }] : [];
    }),
    count,
    BAR,
  );
const djembes = [
  ...hand('B.tTS.tsB.tTS.TS', 0, 8),
  ...hand('B..tS.t.B.tsS.tt', 8, 8),
  ...hand('B.tTS.tsB.tTS.TS', 16, 8),
];

const shakers = accents(bars('xxxxxxxxxxxxxxxx', 0, 24), [0.4, 0.28, 0.8, 0.32], 0.25, 1);
const tambs = bars('....x.......x...', 16, 8);
const frames = arc(bars('x..x..x...x.....', 8, 8, 43), ramp(at(8), at(16), 0.7, 1));
const blocks = [
  ...seq('B5 . E6 . B5 B5 E6 .', { step: 0.25, start: at(3) + 2, v: 0.6 }),
  ...seq('B5 . E6 . B5 B5 E6 .', { step: 0.25, start: at(19) + 2, v: 0.6 }),
];

const toms = [
  ...arc(
    seq('E3 . E3 C3 C3 A2 A2 E2', { step: 0.25, start: at(7) + 2, v: 0.8 }),
    ramp(at(7) + 2, at(8), 0.6, 1),
  ),
  ...arc(
    seq('A2 . A2 . E3 . A2 E3 A2 . A2 . E3 E3 C3 A2', { step: 0.25, start: at(14), v: 0.8 }),
    ramp(at(14), at(15), 0.6, 1),
  ),
  ...seq('E3 E3 C3 C3 A2 A2 E2 E2', { step: 0.25, start: at(23) + 2, v: 0.85 }).map((n, i) => ({
    ...n,
    v: 0.6 + i * 0.05,
  })),
];
const timps = [
  { t: at(8), d: 1, n: 40, v: 0.9 },
  ...arc(grid('xxxxxxxxxxxxxxxx', { start: at(15), n: 40 }), swellRoll(at(15), at(16), 0.15, 0.8)),
  { t: at(16), d: 1, n: 40, v: 1 },
];
const crashes = [
  { t: 0, d: 1, n: 0, v: 0.9 },
  { t: at(8), d: 1, n: 0, v: 0.7 },
  { t: at(16), d: 1, n: 0, v: 1 },
];
const swells = [
  { t: at(7) + 2, d: 2, n: 0, v: 0.6 },
  { t: at(15), d: 4, n: 0, v: 0.8 },
  { t: at(23) + 2, d: 2, n: 0, v: 0.6 },
];

export const song: Song = {
  id: 'forest-temple',
  title: 'Forest Temple',
  evokes: 'an original theme in the spirit of Fireboy and Watergirl in the Forest Temple',
  bpm: 140,
  loopBeats: 24 * BAR,
  seed: 21,
  reverb: { room: 0.72, damp: 0.45, wet: 0.38 },
  tracks: [
    { inst: flute, gain: -4, pan: 0.08, verb: 0.3, loop: lead },
    { inst: flute, gain: -16, pan: -0.55, verb: 0.5, loop: echoes(lead, 0.75, 2, 0.45) },
    { inst: panFlute, gain: -4, pan: -0.08, verb: 0.35, loop: human(panB, 8, 0.06, 0.01) },
    { inst: panFlute, gain: -16, pan: 0.55, verb: 0.5, loop: echoes(panB, 0.75, 2, 0.45) },
    { inst: strings, gain: -7, pan: 0.35, verb: 0.35, loop: violins },
    { inst: marimba, gain: -10, pan: -0.5, verb: 0.25, loop: mallets },
    { inst: kalimba, gain: -6, pan: 0.5, verb: 0.35, loop: sparkle },
    { inst: lowStrings, gain: -6, pan: -0.45, verb: 0.3, loop: cellos },
    { inst: lowStrings, gain: -6, pan: 0.45, verb: 0.3, loop: shift(cellos, 0.01) },
    { inst: spiccato, gain: 0, pan: -0.25, verb: 0.2, loop: human(gallop, 9, 0.05, 0.006) },
    { inst: spiccato, gain: -2, pan: 0.25, verb: 0.2, loop: human(shift(gallop, 0, 12), 10, 0.05, 0.006) },
    { inst: choir, gain: -5, pan: -0.6, verb: 0.55, loop: voices },
    { inst: choir, gain: -5, pan: 0.6, verb: 0.55, loop: shift(voices, 0.02) },
    { inst: spiccato, gain: -3, pan: -0.15, verb: 0.15, loop: darkStrings },
    { inst: lowStrings, gain: -4, pan: 0.15, verb: 0.3, loop: pickup },
    { inst: sub, gain: -11, pan: 0, verb: 0, loop: bassLine },
    { inst: kick, gain: -9, pan: 0, verb: 0.05, loop: arc(human(kicks, 11, 0.05, 0), softA) },
    { inst: snare, gain: -7, pan: 0.06, verb: 0.25, loop: arc(human(snares, 12, 0.08, 0.004), softA) },
    { inst: djembe, gain: -8, pan: 0.35, verb: 0.18, loop: arc(human(djembes, 13, 0.1, 0.008), softA) },
    { inst: frame, gain: -7, pan: -0.2, verb: 0.25, loop: human(frames, 14, 0.08, 0.004) },
    { inst: shaker, gain: -3, pan: 0.55, verb: 0.1, loop: human(shakers, 15, 0.12, 0.006) },
    { inst: tambourine, gain: -4, pan: -0.5, verb: 0.15, loop: human(tambs, 16, 0.1, 0.004) },
    { inst: block, gain: -4, pan: 0.6, verb: 0.3, loop: blocks },
    { inst: tom, gain: -6, pan: -0.15, verb: 0.25, loop: toms },
    { inst: timpani, gain: -3, pan: 0, verb: 0.35, loop: timps },
    { inst: crash, gain: -3, pan: -0.3, verb: 0.3, loop: crashes },
    { inst: swell, gain: -2, pan: 0.3, verb: 0.3, loop: swells },
    { inst: riser, gain: -8, pan: 0, verb: 0.3, loop: [{ t: at(15), d: 4, n: 0, v: 0.6 }] },
  ],
};
