import {
  accent,
  arp,
  bass,
  cresc,
  grid,
  harmony,
  humanize,
  legato,
  loop,
  pads,
  portamento,
  roll,
  seq,
  swell,
  voice,
  type Note,
} from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Main menu: a bright, heroic rock-orchestral theme in D major in the spirit of a Smash menu. Form A B A' C,
 * 32 bars at 150 BPM. A states the theme on a hero lead over rock drums, double-tracked guitars, synth-brass
 * stabs and strings split violins left, lower strings right. B pulls back: violins sing the second theme over
 * horns an octave down, held strings, sparkling arps and half-time drums, then build with a snare roll, a
 * riser and a violin run. A' lifts: the lead harmonised in sixths by brass, doubled by violins and answered by
 * a horn counter-line, over a ride and open-hat groove. C climbs through bVI-bVII-I with choir and timpani
 * and fills back into the top, where a reverse cymbal lands on the loop's opening crash.
 */
const bar = 4;
const A = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A'];
const B = ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Bm', 'A'];
const C = ['Bb', 'C', 'D', 'D', 'Bb', 'C', 'Asus4', 'A'];
const chords = [...A, ...B, ...A, ...C];
/** The beat where section k starts (0 A, 1 B, 2 A', 3 C; 4 is the loop's end). */
const sec = (k: number) => k * 8 * bar;
const section = (k: number) => chords.slice(k * 8, k * 8 + 8);
/** A one-bar drum grid repeated over bars [from, to). */
const bars = (from: number, to: number, pattern: string, n = 0) =>
  loop(grid(pattern, { start: from * bar, n }), to - from, bar);
/** One hit at a beat. */
const hit = (t: number, v: number, n = 60): Note[] => [{ t, d: 1, n, v }];
const drum = (notes: Note[], seed: number) => humanize(notes, { seed, time: 0.008, vel: 0.08 });
/** Cymbal swells end just past the downbeat, so their fade hides under the crash. */
const land = (k: number, beats: number, v: number) => swell(sec(k) + 0.02, beats + 0.02, v);

// ---------------------------------------------------------------- melody

/** Louder as the line climbs, so phrases arch toward their peaks. */
const arch = (notes: Note[], amount = 0.25) => {
  const lo = Math.min(...notes.map((n) => n.n));
  const hi = Math.max(...notes.map((n) => n.n));
  return notes.map((n) => ({
    ...n,
    v: Math.min(1, n.v * (1 - amount + (2 * amount * (n.n - lo)) / (hi - lo))),
  }));
};
/** Sung phrasing: arched dynamics, tied notes, slides into leaps, and a little human timing. */
const sing = (notes: Note[], seed: number) =>
  humanize(portamento(legato(arch(notes), { maxGap: 0.26 }), 5), { seed, time: 0.012, vel: 0.06 });

const melodyA = (end: string) =>
  [
    'F#5:3 E5 D5 E5 F#5 A5',
    'B5:4 A5:2 F#5:2',
    'G5:3 F#5 E5 D5 E5 G5',
    'A5:6 . .',
    'F#5:3 E5 D5 E5 F#5 A5',
    'D6:4 C#6:2 B5:2',
    'B5:3 A5 G5 F#5 E5 G5',
    end,
  ].join(' ');
const melodyB = [
  'D5:3 B4 D5:2 G5:2',
  'E5:3 C#5 E5:2 A5:2',
  'F#5:3 E5 C#5:2 A4:2',
  'B4:4 D5:2 F#5:2',
  'G5:3 F#5 G5:2 B5:2',
  'A5:3 G5 F#5:2 E5:2',
  'F#5:3 E5 D5:2 B4:2',
  'C#5:4 . . . .',
].join(' ');
const melodyC = [
  'F5:3 D5 F5:2 Bb5:2',
  'G5:3 E5 G5:2 C6:2',
  'A5:8',
  'A5:2 B5:2 C#6:2 D6:2',
  'D6:3 C6 Bb5:2 F5:2',
  'E6:3 D6 C6:2 G5:2',
  'D6:4 E6:2 D6:2',
  'C#6:3 A5 B5 A5 G5 E5',
].join(' ');
/** The horns' answer under A': half notes moving against the lead's long notes. */
const counterA2 = [
  'A4:4 B4:4',
  'D5:4 C#5:4',
  'B4:4 D5:4',
  'C#5:4 E5:4',
  'D5:4 A4:4',
  'B4:4 D5:4',
  'E5:4 G5:4',
  'A4:4 C#5:4',
].join(' ');

const themeA = seq(melodyA('A5:4 . A4 C#5 E5'), { v: 0.8 });
const themeA2 = seq(melodyA('A5:4 . C#5 D5 E5'), { start: sec(2), v: 0.92 });
const themeC = seq(melodyC, { start: sec(3), v: 0.95 });
const pickupB = seq('A4 B4 C#5 E5', { start: sec(2) - 2, v: 0.78 });
const lead = sing([...themeA, ...pickupB, ...themeA2, ...themeC], 3);
const themeB = seq(melodyB, { start: sec(1), v: 0.68 });
/** B's tune on the violins, with horns an octave below. */
const violinsB = sing(themeB, 5);
const hornsB = sing(
  themeB.map((n) => ({ ...n, n: n.n - 12, v: n.v * 0.85 })),
  6,
);
const hornsA2 = sing(seq(counterA2, { start: sec(2), v: 0.7 }), 8);
/** A' harmonised a sixth below by the brass, and doubled by the violins through A' and C. */
const sixths = sing(harmony(themeA2, 'D', -5), 7).map((n) => ({ ...n, v: n.v * 0.85 }));
const violins = sing([...themeA2, ...themeC], 9).map((n) => ({ ...n, v: n.v * 0.75 }));
/** Violin runs up into A' and into the top of the loop. */
const runs = [
  ...seq('D5 E5 F#5 G5 A5 B5 C#6 D6', { step: 0.125, start: sec(2) - 1, v: 0.75 }),
  ...seq('A4 B4 C#5 D5 E5 F#5 G#5 A5', { step: 0.125, start: sec(4) - 1, v: 0.8 }),
];

// ---------------------------------------------------------------- harmony

const highStrings = [
  ...pads(A, { low: 62, v: 0.45 }),
  ...pads(B, { low: 67, v: 0.5, start: sec(1) }),
  ...pads(A, { low: 62, v: 0.55, start: sec(2) }),
  ...pads(C, { low: 62, v: 0.62, start: sec(3) }),
];
const lowStrings = [
  ...pads(A, { low: 50, v: 0.5 }),
  ...pads(B, { low: 50, v: 0.55, start: sec(1) }),
  ...pads(A, { low: 50, v: 0.55, start: sec(2) }),
  ...pads(C, { low: 50, v: 0.65, start: sec(3) }),
];
const choir = pads(C, { low: 57, v: 0.6, start: sec(3) });

/** Synth-brass stabs: the dotted push of a fanfare, busier in A' and on every downbeat of C. */
const stab = (k: number, beats: number[], vs: number[]) =>
  section(k).flatMap((s, i) =>
    beats.flatMap((b, j) =>
      voice(s, 57).map((n) => ({ t: sec(k) + i * bar + b, d: 0.45, n, v: vs[j] ?? 0.7 })),
    ),
  );
const stabNotes = [
  ...stab(0, [0, 1.5, 3], [0.85, 0.7, 0.75]),
  ...stab(2, [0, 1.5, 3, 3.5], [0.9, 0.72, 0.78, 0.7]),
  ...stab(3, [0, 0.75, 1.5], [0.95, 0.7, 0.8]),
];

/** Palm-muted eighths with open accents on 1 and the and of 2, roots folded into the guitar's low strings. */
const chug = (symbols: string[], start: number, v: number) =>
  symbols.flatMap((s, i) =>
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) => {
      const open = b === 0 || b === 1.5;
      return { t: start + i * bar + b, d: open ? 1.4 : 0.25, n: voice(s, 40)[0]!, v: v * (open ? 1 : 0.75) };
    }),
  );
const guitars = [
  ...chug(A, 0, 0.8),
  ...cresc(chug(B.slice(6), sec(1) + 6 * bar, 0.8), 0.5, 1),
  ...chug(A, sec(2), 0.9),
  ...chug(C, sec(3), 0.95),
];

const spiccato = humanize(
  accent(
    [0, 2, 3].flatMap((k) =>
      bass(section(k), [0, 0, 7, 0, 12, 0, 7, 0], {
        octave: 3,
        step: 0.5,
        gate: 0.5,
        v: 0.75,
        start: sec(k),
      }),
    ),
  ),
  { seed: 13, time: 0.01, vel: 0.08 },
);

const low = humanize(
  accent([
    ...bass(A, [0, 0, 12, 0, 0, 12, 0, 12], { step: 0.5, gate: 0.8, v: 0.9 }),
    ...bass(B.slice(0, 6), [0, 0], { step: 2, gate: 0.95, v: 0.75, start: sec(1) }),
    ...cresc(
      bass(B.slice(6), [0, 0, 0, 0, 0, 0, 0, 0], { step: 0.5, gate: 0.7, start: sec(1) + 6 * bar }),
      0.6,
      1,
    ),
    ...bass(A, [0, 0, 12, 0, 0, 12, 0, 12], { step: 0.5, gate: 0.8, v: 0.92, start: sec(2) }),
    ...bass(C, [0, 0, 0, 12, 0, 0, 12, 0], { step: 0.5, gate: 0.8, v: 0.95, start: sec(3) }),
  ]),
  { seed: 17, time: 0.006, vel: 0.06 },
);

const sparkle = arp([...B, ...A], [0, 1, 2, 3, 2, 1, 2, 3], {
  octave: 5,
  step: 0.25,
  v: 0.5,
  gate: 0.6,
  start: sec(1),
});
const plucks = humanize(
  accent([
    ...arp(B, [0, 2, 1, 2], { octave: 4, step: 0.5, v: 0.45, gate: 0.5, start: sec(1) }),
    ...arp([...A, ...C], [0, 1, 2, 3, 4, 3, 2, 1], {
      octave: 4,
      step: 0.25,
      v: 0.6,
      gate: 0.5,
      start: sec(2),
    }),
  ]),
  { seed: 19, time: 0.008, vel: 0.08 },
);

// ---------------------------------------------------------------- drums

const kick = [
  ...bars(0, 7, 'x.......x.x.....'),
  ...bars(7, 8, 'x.......x.x.x...'),
  ...bars(8, 14, 'x.........x.....'),
  ...bars(14, 15, 'x...x...x...x...'),
  ...bars(15, 16, 'x...x...x.x.x.x.'),
  ...bars(16, 23, 'x.....x.x.x.....'),
  ...bars(23, 24, 'x.......x.......'),
  ...bars(24, 31, 'x.......x.x...x.'),
  ...bars(31, 32, 'x.......x.......'),
];
const snare = [
  ...bars(0, 7, '....x.....-.x..-'),
  ...bars(7, 8, '....x...'),
  ...roll(7 * bar + 2, 2, { from: 0.35, to: 0.85 }),
  ...bars(8, 14, '........o.......'),
  ...roll(14 * bar, 4, { step: 0.5, from: 0.3, to: 0.55 }),
  ...roll(15 * bar, 4, { from: 0.45, to: 1 }),
  ...bars(16, 23, '....x.....-.x..-'),
  ...bars(23, 24, '....x...xxxx....'),
  ...bars(24, 31, '....x.....-.x..-'),
  ...bars(31, 32, '....x...'),
  ...roll(31 * bar + 2, 2, { step: 0.125, from: 0.4, to: 1 }),
];
const highToms = [
  ...seq('G3 E3', { step: 0.25, start: 23 * bar + 3, v: 0.9 }),
  ...seq('G3 G3 E3', { step: 0.25, start: 27 * bar + 3, v: 0.85 }),
];
const lowToms = [
  ...seq('C3 A2', { step: 0.25, start: 23 * bar + 3.5, v: 0.95 }),
  ...seq('C3', { step: 0.25, start: 27 * bar + 3.75, v: 0.9 }),
];
const hats = accent([
  ...bars(0, 8, 'x.o.x.o.x.o.x.o.'),
  ...bars(14, 16, 'x.o.x.o.x.o.x.o.'),
  ...bars(24, 32, 'x.o.x.o.x.o.x.o.'),
]);
const shaker = accent(bars(8, 14, 'x-o-x-o-x-o-x-o-'));
const ride = accent(bars(16, 24, 'x.o.x.o.x.o.x.o.'));
const openHat = [...bars(0, 8, '..............o.'), ...bars(16, 24, '..o...o...o...o.')];
const crash = [
  ...hit(0, 1),
  ...hit(4 * bar, 0.7),
  ...hit(sec(1), 0.6),
  ...hit(sec(2), 1),
  ...hit(20 * bar, 0.75),
  ...hit(sec(3), 1),
  ...hit(26 * bar, 0.6),
  ...hit(28 * bar, 0.9),
];
const boom = [...hit(0, 0.8), ...hit(sec(2), 0.9), ...hit(sec(3), 1)];
const swells = [...land(2, 4, 0.85), ...land(3, 4, 0.8), ...land(4, 4, 0.9)];
const risers = [...land(2, 8, 0.8), ...land(4, 8, 0.85)];
const timps = [
  ...section(3).flatMap((s, i) => {
    const n = voice(s.replace('sus4', ''), 45)[0]!;
    return [
      { t: sec(3) + i * bar, d: 1, n, v: 0.9 },
      { t: sec(3) + i * bar + 2, d: 1, n, v: 0.6 },
    ];
  }),
  ...roll(15 * bar + 1, 3, { from: 0.25, to: 0.8, n: 45 }),
  ...roll(23 * bar + 2, 2, { from: 0.3, to: 0.8, n: 45 }),
  ...roll(31 * bar, 4, { from: 0.3, to: 0.9, n: 45 }),
];
const lowMid = { f: 350, gain: -3, q: 0.9 };
const air = { type: 'highshelf' as const, f: 9000, gain: 2.5 };

export const song: Song = {
  id: 'menu',
  title: 'Main Menu',
  evokes: 'a Smash Ultimate-style menu theme',
  bpm: 150,
  loopBeats: sec(4),
  seed: 11,
  reverb: { room: 0.84, damp: 0.4, wet: 0.32, predelay: 0.028, hp: 220, lp: 10000 },
  room: { room: 0.12, damp: 0.45, wet: 0.5 },
  echo: { beats: 0.75, feedback: 0.3, wet: 0.45, lp: 3500 },
  master: {
    eq: [
      { f: 300, gain: -1.5, q: 0.8 },
      { type: 'highshelf', f: 9000, gain: 2 },
    ],
    threshold: 3,
    ratio: 2,
    ceiling: -1.2,
  },
  tracks: [
    { inst: 'heroLead', gain: -2.5, verb: 0.24, echo: 0.15, hp: 150, loop: lead },
    { inst: 'strings', gain: 0, pan: -0.25, width: 0.5, verb: 0.45, hp: 200, eq: [air], loop: violinsB },
    { inst: 'horns', gain: -6, pan: 0.3, verb: 0.45, hp: 100, loop: hornsB },
    { inst: 'horns', gain: -7, pan: 0.35, verb: 0.45, hp: 100, loop: hornsA2 },
    { inst: 'brass', gain: -8, pan: -0.2, verb: 0.35, hp: 180, loop: sixths },
    {
      inst: 'strings',
      gain: -8,
      pan: -0.3,
      width: 0.6,
      verb: 0.45,
      hp: 250,
      eq: [air],
      loop: [...violins, ...runs],
    },
    {
      inst: 'brassStab',
      gain: -10,
      pan: -0.35,
      width: 0.3,
      verb: 0.3,
      hp: 180,
      eq: [lowMid, { f: 2500, gain: -3 }],
      duck: 1.5,
      loop: humanize(stabNotes, { seed: 11, time: 0.008, vel: 0.06 }),
    },
    {
      inst: 'brassStab',
      gain: -10,
      pan: 0.35,
      width: 0.3,
      verb: 0.3,
      hp: 180,
      eq: [lowMid, { f: 2500, gain: -3 }],
      duck: 1.5,
      loop: humanize(stabNotes, { seed: 12, time: 0.008, vel: 0.06 }),
    },
    {
      inst: 'power',
      gain: -6,
      pan: -0.85,
      verb: 0.08,
      room: 0.1,
      hp: 110,
      eq: [{ f: 2000, gain: -2 }],
      duck: 1.5,
      loop: humanize(guitars, { seed: 1, time: 0.01, vel: 0.06 }),
    },
    {
      inst: 'power',
      gain: -6,
      pan: 0.85,
      verb: 0.08,
      room: 0.1,
      hp: 110,
      eq: [{ f: 2000, gain: -2 }],
      duck: 1.5,
      loop: humanize(guitars, { seed: 2, time: 0.01, vel: 0.06 }),
    },
    {
      inst: 'strings',
      gain: -6,
      pan: -0.5,
      width: 0.6,
      verb: 0.6,
      hp: 250,
      eq: [lowMid, { f: 2000, gain: -3, q: 0.8 }, air],
      duck: 2,
      loop: highStrings,
    },
    {
      inst: 'strings',
      gain: -6,
      pan: 0.45,
      width: 0.6,
      verb: 0.55,
      hp: 120,
      eq: [lowMid],
      duck: 2,
      loop: lowStrings,
    },
    { inst: 'spicc', gain: -7, pan: 0.35, width: 0.3, verb: 0.3, hp: 100, duck: 2, loop: spiccato },
    { inst: 'choir', gain: -10, width: 1, verb: 0.6, hp: 250, eq: [lowMid], loop: choir },
    { inst: 'synthBass', gain: -2, verb: 0, hp: 30, duck: 4, loop: low },
    { inst: 'synthPluck', gain: -8, pan: -0.6, verb: 0.3, echo: 0.25, hp: 400, loop: plucks },
    { inst: 'glock', gain: -21, pan: 0.6, verb: 0.4, hp: 600, loop: sparkle },
    { inst: 'kick', gain: -6, verb: 0, room: 0.1, loop: drum(kick, 21) },
    { inst: 'snare', gain: -3, pan: 0.04, verb: 0.14, room: 0.4, loop: drum(snare, 22) },
    { inst: 'tom', gain: -9, pan: -0.35, verb: 0.12, room: 0.4, loop: drum(highToms, 23) },
    { inst: 'tom', gain: -9, pan: 0.35, verb: 0.12, room: 0.4, loop: drum(lowToms, 29) },
    {
      inst: 'hat',
      gain: -7,
      pan: 0.35,
      verb: 0.03,
      room: 0.15,
      loop: humanize(hats, { seed: 24, time: 0.015, vel: 0.12 }),
    },
    {
      inst: 'shaker',
      gain: -12,
      pan: 0.4,
      verb: 0.08,
      room: 0.1,
      loop: humanize(shaker, { seed: 25, time: 0.015, vel: 0.12 }),
    },
    {
      inst: 'ride',
      gain: -11,
      pan: -0.4,
      verb: 0.08,
      room: 0.15,
      loop: humanize(ride, { seed: 26, time: 0.015, vel: 0.12 }),
    },
    { inst: 'openHat', gain: -10, pan: 0.35, verb: 0.05, room: 0.15, loop: drum(openHat, 27) },
    { inst: 'crash', gain: -8, pan: -0.25, width: 0.7, verb: 0.2, room: 0.1, loop: crash },
    { inst: 'revCrash', gain: -11, pan: 0.25, width: 0.7, verb: 0.25, loop: swells },
    { inst: 'riser', gain: -14, width: 0.8, verb: 0.3, loop: risers },
    { inst: 'boom', gain: -9, verb: 0.25, hp: 25, loop: boom },
    { inst: 'timpani', gain: -14, verb: 0.45, hp: 40, loop: drum(timps, 28) },
  ],
};
