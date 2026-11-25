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
  rootIn,
  seq,
  swell,
  voice,
  type Note,
} from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Battlefield: a heroic rock-orchestral stage theme in E minor at 168 BPM, a march in spirit. Form A B A' C,
 * 32 bars. A: a dotted brass fanfare over palm-muted power chords (double-tracked guitars hard left and
 * right), march snare and strings. B: the guitar takes a soaring lead over open chords, spiccato strings and
 * a ride groove. A': the fanfare as an orchestral tutti, with brass harmony a third below and choir. C: a
 * half-time bridge of war drums, timpani and horns through bII and V, building back to the top.
 */
const bar = 4;
const A = ['Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B'];
const B = ['C', 'D', 'Bm', 'Em', 'Am', 'D', 'G', 'B'];
const C = ['Am', 'Em', 'F', 'D', 'C', 'G', 'B', 'B'];
const chords = [...A, ...B, ...A, ...C];
/** The beat where section k starts (0 A, 1 B, 2 A', 3 C; 4 is the loop's end). */
const sec = (k: number) => k * 8 * bar;
const section = (k: number) => chords.slice(k * 8, k * 8 + 8);
/** A one-bar drum grid repeated over bars [from, to). */
const bars = (from: number, to: number, pattern: string, n = 0) =>
  loop(grid(pattern, { start: from * bar, n }), to - from, bar);
const hit = (t: number, v: number, n = 60): Note[] => [{ t, d: 1, n, v }];
const drum = (notes: Note[], seed: number) => humanize(notes, { seed, time: 0.008, vel: 0.08 });
/** Cymbal swells end just past the downbeat, so their fade hides under the crash. */
const land = (k: number, beats: number, v: number) => swell(sec(k) + 0.02, beats + 0.02, v);
const sing = (notes: Note[], seed: number) =>
  humanize(portamento(legato(notes, { maxGap: 0.26 }), 5), { seed, time: 0.01, vel: 0.05 });

// ---------------------------------------------------------------- melody

const fanfare = [
  'E5:3 B4 E5:2 G5:2',
  'G5:3 F#5 E5:2 C5:2',
  'F#5:3 E5 D5:2 F#5:2',
  'B5:6 A5 G5',
  'E5:3 B4 E5:2 G5:2',
  'C6:3 B5 A5:2 G5:2',
  'A5:3 G5 F#5:2 A5:2',
  'B5:4 D#5:2 F#5:2',
].join(' ');
const soar = [
  'E5:2 G5:2 C6:4',
  'D6:3 C6 B5:2 A5:2',
  'B5:4 F#5:2 D5:2',
  'E5:6 . .',
  'C6:2 B5:2 A5:2 E5:2',
  'F#5:3 G5 A5:2 D6:2',
  'B5:3 A5 G5:2 D5:2',
  'D#5:4 F#5:2 B5:2',
].join(' ');
const bridge = [
  'A4:4 C5:4',
  'B4:4 G4:4',
  'A4:4 C5:4',
  'D5:8',
  'E5:4 G5:4',
  'D5:4 B4:4',
  'D#5:4 F#5:4',
  'B4:2 D#5:2 F#5:2 B5:2',
].join(' ');

const themeA = seq(fanfare, { v: 0.85 });
const themeA2 = seq(fanfare, { start: sec(2), v: 0.95 });
const brassLead = sing(accent([...themeA, ...themeA2], { beat: 0.92, half: 0.85, off: 0.8 }), 3);
const hornsLow = sing(seq(fanfare, { v: 0.7, transpose: -12 }), 4);
const guitarLead = sing(seq(soar, { start: sec(1), v: 0.9 }), 5);
const thirds = sing(harmony(themeA2, 'E', -2, 'minor'), 6).map((n) => ({ ...n, v: n.v * 0.8 }));
const violins = sing(seq(fanfare, { start: sec(2), v: 0.7, transpose: 12 }), 7);
const hornBridge = sing(seq(bridge, { start: sec(3), v: 0.8 }), 8);

// ---------------------------------------------------------------- band

/** Power-chord root folded into the guitar's low register (E2..D#3). */
const low = (s: string) => rootIn(s, 40);
const chug = (k: number, v = 0.85) =>
  section(k).flatMap((s, i) => {
    const t = sec(k) + i * bar;
    return [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) => {
      const open = b === 0 || b === 1.5;
      return { t: t + b, d: open ? 1.4 : 0.25, n: low(s), v: v * (open ? 1 : 0.75) };
    });
  });
const ring = (k: number, from: number, to: number, beats: number, v: number) =>
  section(k)
    .slice(from, to)
    .flatMap((s, i) =>
      Array.from({ length: bar / beats }, (_, j) => ({
        t: sec(k) + (from + i) * bar + j * beats,
        d: beats - 0.1,
        n: low(s),
        v,
      })),
    );
/** A' ends on a stop-time hit on beat 3 of its last bar, leaving the toms alone before the bridge. */
const stop = 23 * bar + 2;
const guitars = [
  ...chug(0),
  ...ring(1, 0, 8, 2, 0.6),
  ...chug(2, 0.95).filter((n) => n.t < stop),
  { t: stop, d: 0.5, n: low('B'), v: 1 },
  ...ring(3, 0, 4, 4, 0.6),
  ...cresc(chug(3).slice(4 * 8), 0.6, 1),
];

const bassLine = humanize(
  accent([
    ...bass(A, [0, 0, 0, 0, 0, 0, 0, 0], { step: 0.5, gate: 0.8, v: 0.9 }),
    ...bass(B, [0, '.', '.', 0, 0, '.', 7, 12], { step: 0.5, gate: 0.85, v: 0.85, start: sec(1) }),
    ...bass(A, [0, 0, 0, 0, 0, 0, 0, 0], { step: 0.5, gate: 0.8, v: 0.95, start: sec(2) }),
    ...bass(C.slice(0, 4), [0], { step: 4, gate: 0.95, v: 0.8, start: sec(3) }),
    ...cresc(bass(C.slice(4), [0, 0, 0, 0, 0, 0, 0, 0], { step: 0.5, gate: 0.8, start: 28 * bar }), 0.65, 1),
  ]),
  { seed: 9, time: 0.006, vel: 0.05 },
);

const highStrings = [
  ...pads(A, { low: 59, v: 0.5 }),
  ...pads(B, { low: 64, v: 0.5, start: sec(1) }),
  ...pads(A, { low: 59, v: 0.55, start: sec(2) }),
  ...pads(C, { low: 64, v: 0.6, start: sec(3) }),
];
const lowStrings = [
  ...pads(A, { low: 47, v: 0.5 }),
  ...pads(B, { low: 47, v: 0.45, start: sec(1) }),
  ...pads(A, { low: 47, v: 0.55, start: sec(2) }),
  ...pads(C, { low: 47, v: 0.7, start: sec(3) }),
];
/** Trombones and tubas on the roots of the half-time bridge. */
const lowBrass = humanize(
  C.slice(0, 4).flatMap((s, i) => [
    { t: sec(3) + i * bar, d: 2.4, n: rootIn(s, 40), v: 0.9 },
    { t: sec(3) + i * bar + 2.5, d: 1.3, n: rootIn(s, 40), v: 0.7 },
  ]),
  { seed: 12, time: 0.008, vel: 0.05 },
);
const ostinato = humanize(
  accent([
    ...arp(B, [0, 1, 2, 1, 3, 1, 2, 1], { octave: 4, step: 0.25, v: 0.55, gate: 0.6, start: sec(1) }),
    ...arp(A, [0, 2, 1, 2], { octave: 4, step: 0.5, v: 0.7, gate: 0.5, start: sec(2) }),
  ]),
  { seed: 10, time: 0.006, vel: 0.06 },
);
const stabs = [
  ...section(1).flatMap((s, i) =>
    [0, 1.5].flatMap((b, j) =>
      voice(s, 57).map((n) => ({ t: sec(1) + i * bar + b, d: 0.45, n, v: j ? 0.7 : 0.85 })),
    ),
  ),
  ...voice('B', 57).map((n) => ({ t: stop, d: 0.5, n, v: 1 })),
];
const choir = [
  ...pads(A, { low: 57, v: 0.55, start: sec(2) }),
  ...pads(C, { low: 55, v: 0.65, start: sec(3) }),
];

// ---------------------------------------------------------------- drums

const kick = [
  ...bars(0, 7, 'x..x..x.x.....x.'),
  ...bars(7, 8, 'x..x..x.x.x.x.x.'),
  ...bars(8, 16, 'x.......x.x.....'),
  ...bars(16, 23, 'x..x..x.x.....x.'),
  ...bars(23, 24, 'x.......x.......'),
  ...bars(28, 31, 'x...x...x...x...'),
  ...bars(31, 32, 'x.x.x.x.x.x.x.x.'),
];
const snare = [
  ...bars(0, 7, '..-.x..-..-.x.--'),
  ...bars(7, 8, '....x...'),
  ...roll(7 * bar + 2, 2, { from: 0.4, to: 0.95 }),
  ...bars(8, 15, '....x.......x...'),
  ...bars(15, 16, '....x...'),
  ...roll(15 * bar + 2, 2, { step: 0.125, from: 0.35, to: 1 }),
  ...bars(16, 23, '..-.x..-..-.x.--'),
  ...bars(23, 24, '....x...x.......'),
  ...bars(24, 28, '........x.......'),
  ...roll(28 * bar, 8, { step: 0.5, from: 0.3, to: 0.6 }),
  ...roll(30 * bar, 8, { step: 0.25, from: 0.45, to: 1 }),
];
const toms = [
  ...bars(24, 28, 'x..x..x.x.x.x...', 45),
  ...bars(24, 28, '..........x.x.x.', 52),
  ...seq('G3 E3 C3 A2', { step: 0.25, start: 23 * bar + 3, v: 0.95 }),
].map((n) => (n.n === 0 ? { ...n, n: 45 } : n));
const hats = accent([...bars(0, 8, 'x.o.x.o.x.o.x.o.'), ...bars(28, 32, 'x.o.x.o.x.o.x.o.')]);
const ride = accent([...bars(8, 16, 'x.o.x.o.x.o.x.o.'), ...bars(16, 24, 'x.o.x.o.x.o.x.o.')]);
const openHat = bars(16, 24, '..o...o...o...o.');
const crash = [
  ...hit(0, 1),
  ...hit(4 * bar, 0.7),
  ...hit(sec(1), 0.9),
  ...hit(12 * bar, 0.6),
  ...hit(sec(2), 1),
  ...hit(20 * bar, 0.75),
  ...hit(stop, 0.9),
  ...hit(sec(3), 0.8),
  ...hit(28 * bar, 0.7),
];
const boom = [...hit(0, 0.9), ...hit(sec(2), 0.9), ...hit(sec(3), 0.8)];
const swells = [...land(1, 2, 0.7), ...land(2, 4, 0.85), ...land(3, 4, 0.85), ...land(4, 4, 0.9)];
const risers = [...land(2, 8, 0.75), ...land(4, 8, 0.85)];
const lowMid = { f: 350, gain: -3, q: 0.9 };
const air = { type: 'highshelf' as const, f: 9000, gain: 2.5 };
const tame = { type: 'highshelf' as const, f: 8000, gain: -2 };
const stabTrack = (pan: number, seed: number) => ({
  inst: 'brassStab',
  gain: -9,
  pan,
  width: 0.3,
  verb: 0.3,
  hp: 180,
  eq: [lowMid, { f: 2500, gain: -3 }],
  loop: humanize(stabs, { seed, time: 0.008, vel: 0.06 }),
});
const timpRoot = (s: string) => rootIn(s, 40);
const timps = [
  ...section(3).flatMap((s, i) => [
    { t: sec(3) + i * bar, d: 1, n: timpRoot(s), v: 0.95 },
    { t: sec(3) + i * bar + 2.5, d: 1, n: timpRoot(s), v: 0.65 },
  ]),
  ...roll(31 * bar, 4, { from: 0.3, to: 0.95, n: 47 }),
];

export const song: Song = {
  id: 'battlefield',
  title: 'Battlefield',
  evokes: 'a Smash-style Battlefield stage theme',
  bpm: 168,
  loopBeats: sec(4),
  seed: 23,
  reverb: { room: 0.78, damp: 0.45, wet: 0.28, predelay: 0.02, hp: 220, lp: 9000 },
  room: { room: 0.1, damp: 0.5, wet: 0.45 },
  echo: { beats: 0.75, feedback: 0.3, wet: 0.4, lp: 3500 },
  master: {
    eq: [{ f: 300, gain: -1.5, q: 0.8 }],
    threshold: 3,
    ratio: 2,
    ceiling: -1.2,
  },
  tracks: [
    {
      inst: 'brass',
      gain: -3,
      pan: 0.05,
      verb: 0.3,
      hp: 150,
      eq: [{ f: 3000, gain: -3, q: 1.5 }],
      loop: brassLead,
    },
    { inst: 'horns', gain: -6, pan: 0.3, verb: 0.4, hp: 100, loop: hornsLow },
    { inst: 'guitar', gain: -4, pan: 0.1, verb: 0.22, echo: 0.25, hp: 120, loop: guitarLead },
    { inst: 'brass', gain: -9, pan: -0.3, verb: 0.35, hp: 180, loop: thirds },
    {
      inst: 'strings',
      gain: -7,
      pan: -0.35,
      width: 0.6,
      verb: 0.45,
      hp: 300,
      eq: [{ f: 3000, gain: -2.5, q: 1.2 }],
      loop: violins,
    },
    { inst: 'horns', gain: -2, pan: 0.15, verb: 0.45, hp: 100, loop: hornBridge },
    { inst: 'brass', gain: -4, pan: 0.2, width: 0.3, verb: 0.4, hp: 50, loop: lowBrass },
    ...[-0.85, 0.85].map((pan, k) => ({
      inst: 'power',
      gain: -4,
      pan,
      transpose: k ? 0.06 : -0.06,
      verb: 0.08,
      room: 0.1,
      hp: 110,
      eq: [
        { f: 550, gain: -3 },
        { f: k ? 1600 : 1100, gain: 1.5 },
        { f: 2200, gain: -2.5 },
      ],
      duck: 1.5,
      loop: humanize(guitars, { seed: 1 + k, time: 0.03, vel: 0.08 }),
    })),
    { inst: 'bassGuitar', gain: -4.5, verb: 0, hp: 35, duck: 3, loop: bassLine },
    {
      inst: 'strings',
      gain: -4,
      pan: -0.5,
      width: 0.6,
      verb: 0.55,
      hp: 250,
      eq: [lowMid, { f: 2000, gain: -3, q: 0.8 }, air],
      duck: 2,
      loop: highStrings,
    },
    {
      inst: 'strings',
      gain: -4,
      pan: 0.45,
      width: 0.6,
      verb: 0.5,
      hp: 100,
      eq: [lowMid],
      duck: 2,
      loop: lowStrings,
    },
    { inst: 'spicc', gain: -4, pan: 0.5, width: 0.4, verb: 0.3, hp: 150, loop: ostinato },
    stabTrack(-0.35, 11),
    stabTrack(0.35, 12),
    { inst: 'choir', gain: -10, width: 1, verb: 0.6, hp: 250, eq: [lowMid], loop: choir },
    { inst: 'kick', gain: -6, verb: 0, room: 0.1, loop: drum(kick, 21) },
    { inst: 'snare', gain: -1.5, pan: 0.04, verb: 0.14, room: 0.4, loop: drum(snare, 22) },
    { inst: 'tom', gain: -11, pan: -0.25, verb: 0.15, room: 0.4, loop: drum(toms, 23) },
    {
      inst: 'hat',
      gain: -7,
      pan: 0.35,
      verb: 0.03,
      room: 0.15,
      loop: humanize(hats, { seed: 24, time: 0.015, vel: 0.12 }),
    },
    {
      inst: 'ride',
      gain: -11,
      pan: -0.4,
      verb: 0.08,
      room: 0.15,
      loop: humanize(ride, { seed: 26, time: 0.015, vel: 0.12 }),
    },
    { inst: 'openHat', gain: -11, pan: 0.35, verb: 0.05, room: 0.15, eq: [tame], loop: drum(openHat, 27) },
    { inst: 'crash', gain: -8, pan: -0.25, width: 0.7, verb: 0.2, room: 0.1, eq: [tame], loop: crash },
    { inst: 'revCrash', gain: -11, pan: 0.25, width: 0.7, verb: 0.25, eq: [tame], loop: swells },
    { inst: 'riser', gain: -14, width: 0.8, verb: 0.3, loop: risers },
    { inst: 'boom', gain: -9, verb: 0.25, hp: 25, loop: boom },
    { inst: 'timpani', gain: -12, verb: 0.45, hp: 40, loop: drum(timps, 28) },
  ],
};
