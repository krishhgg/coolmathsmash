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
 * 32 bars at 150 BPM. A states the theme on a warm hero lead over rock drums, synth-brass stabs, spiccato and
 * wide strings. B pulls back to horns, held strings, sparkling arps and half-time drums, then builds with a
 * snare roll and riser. A' lifts: the lead harmonised in sixths by brass and doubled by strings, a ride
 * groove and fuller backing. C climbs through bVI-bVII-I with choir and timpani, and fills back into the top,
 * where a reverse cymbal lands on the loop's opening crash.
 */
const bar = 4;
const A = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A'];
const B = ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Bm', 'A'];
const C = ['Bb', 'C', 'D', 'D', 'Bb', 'C', 'Asus4', 'A'];
const chords = [...A, ...B, ...A, ...C];
/** The beat where section k starts (0 A, 1 B, 2 A', 3 C; 4 is the loop's end). */
const sec = (k: number) => k * 8 * bar;
/** A one-bar drum grid repeated over bars [from, to). */
const bars = (from: number, to: number, pattern: string, n = 0) =>
  loop(grid(pattern, { start: from * bar, n }), to - from, bar);
/** One hit at a beat. */
const hit = (t: number, v: number, n = 60): Note[] => [{ t, d: 1, n, v }];

// ---------------------------------------------------------------- melody

/** Louder as the line climbs, so phrases arch toward their peaks. */
const arch = (notes: Note[], amount = 0.15) => {
  const lo = Math.min(...notes.map((n) => n.n));
  const hi = Math.max(...notes.map((n) => n.n));
  return notes.map((n) => ({
    ...n,
    v: Math.min(1, n.v * (1 - amount + (2 * amount * (n.n - lo)) / (hi - lo))),
  }));
};
/** Sung phrasing: arched dynamics, tied notes, slides into leaps, and a little human timing. */
const sing = (notes: Note[], seed: number) =>
  humanize(portamento(legato(arch(notes), { maxGap: 0.26 }), 5), { seed, time: 0.012, vel: 0.05 });

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

const themeA = seq(melodyA('A5:4 . A4 C#5 E5'), { v: 0.82 });
const themeA2 = seq(melodyA('A5:4 . C#5 D5 E5'), { start: sec(2), v: 0.9 });
const themeC = seq(melodyC, { start: sec(3), v: 0.92 });
const pickupB = seq('A4 B4 C#5 E5', { start: sec(2) - 2, v: 0.78 });
const lead = sing([...themeA, ...pickupB, ...themeA2, ...themeC], 3);
const hornLine = sing(seq(melodyB, { start: sec(1), v: 0.72 }), 5);
/** A' harmonised a sixth below by the brass, and doubled by the strings through A' and C. */
const sixths = sing(harmony(themeA2, 'D', -5), 7).map((n) => ({ ...n, v: n.v * 0.85 }));
const violins = sing([...themeA2, ...themeC], 9).map((n) => ({ ...n, v: n.v * 0.75 }));

// ---------------------------------------------------------------- harmony

const section = (k: number) => chords.slice(k * 8, k * 8 + 8);
const strings = [
  ...pads(A, { low: 55, v: 0.45 }),
  ...pads(B, { low: 55, v: 0.6, start: sec(1) }),
  ...pads(B, { low: 67, v: 0.5, start: sec(1) }),
  ...pads(A, { low: 55, v: 0.55, start: sec(2) }),
  ...pads(C, { low: 55, v: 0.62, start: sec(3) }),
];
const choir = pads(C, { low: 57, v: 0.6, start: sec(3) });

/** Synth-brass stabs: the dotted push of a fanfare, busier in A' and on every downbeat of C. */
const stab = (k: number, beats: number[], vs: number[]) =>
  section(k).flatMap((s, i) =>
    beats.flatMap((b, j) =>
      voice(s, 57).map((n) => ({ t: sec(k) + i * bar + b, d: 0.45, n, v: vs[j] ?? 0.7 })),
    ),
  );
const stabs = humanize(
  [
    ...stab(0, [0, 1.5, 3], [0.85, 0.7, 0.75]),
    ...stab(2, [0, 1.5, 3, 3.5], [0.9, 0.72, 0.78, 0.7]),
    ...stab(3, [0, 0.75, 1.5], [0.95, 0.7, 0.8]),
  ],
  { seed: 11, time: 0.006, vel: 0.05 },
);

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
  { seed: 13, time: 0.008, vel: 0.06 },
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
  { seed: 17, time: 0.006, vel: 0.05 },
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
  { seed: 19, time: 0.005, vel: 0.06 },
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
const toms = [
  ...seq('G3 E3 C3 A2', { step: 0.25, start: 23 * bar + 3, v: 0.9 }),
  ...seq('G3 G3 E3 C3', { step: 0.25, start: 27 * bar + 3, v: 0.85 }),
];
const hats = accent([
  ...bars(0, 8, 'x.o.x.o.x.o.x.o.'),
  ...bars(14, 16, 'x.o.x.o.x.o.x.o.'),
  ...bars(24, 32, 'x.o.x.o.x.o.x.o.'),
]);
const shaker = accent(bars(8, 14, 'x-o-x-o-x-o-x-o-'));
const ride = accent(bars(16, 24, 'x.o.x.o.x.o.x.o.'));
const openHat = [...bars(0, 8, '..............o.'), ...bars(16, 24, '......o.......o.')];
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
const swells = [...swell(sec(2), 4, 0.85), ...swell(sec(3), 4, 0.8), ...swell(sec(4), 4, 0.9)];
const risers = [...swell(sec(2), 8, 0.8), ...swell(sec(4), 8, 0.85)];
const timps = [
  ...section(3).flatMap((s, i) => [
    { t: sec(3) + i * bar, d: 1, n: s.startsWith('A') ? 45 : s === 'Bb' ? 46 : s === 'C' ? 48 : 50, v: 0.9 },
    {
      t: sec(3) + i * bar + 2,
      d: 1,
      n: s.startsWith('A') ? 45 : s === 'Bb' ? 46 : s === 'C' ? 48 : 50,
      v: 0.6,
    },
  ]),
  ...roll(15 * bar + 1, 3, { from: 0.25, to: 0.8, n: 45 }),
  ...roll(31 * bar, 4, { from: 0.3, to: 0.9, n: 45 }),
];
const drum = (notes: Note[], seed: number) => humanize(notes, { seed, time: 0.006, vel: 0.06 });

export const song: Song = {
  id: 'menu',
  title: 'Main Menu',
  evokes: 'a Smash Ultimate-style menu theme',
  bpm: 150,
  loopBeats: sec(4),
  seed: 11,
  reverb: { room: 0.82, damp: 0.45, wet: 0.3, predelay: 0.025, hp: 220, lp: 9000 },
  room: { room: 0.1, damp: 0.5, wet: 0.45 },
  echo: { beats: 0.75, feedback: 0.3, wet: 0.45, lp: 3500 },
  master: { threshold: 3, ratio: 2, ceiling: -1.2 },
  tracks: [
    { inst: 'heroLead', gain: -4, verb: 0.22, echo: 0.15, hp: 150, loop: lead },
    { inst: 'horns', gain: -1, pan: 0.05, verb: 0.4, hp: 120, loop: hornLine },
    { inst: 'brass', gain: -8, pan: -0.15, verb: 0.35, hp: 180, loop: sixths },
    { inst: 'strings', gain: -8, pan: 0.15, width: 0.6, verb: 0.45, hp: 250, loop: violins },
    {
      inst: 'brassStab',
      gain: -7,
      width: 0.4,
      verb: 0.3,
      hp: 180,
      eq: [{ f: 2500, gain: -3 }],
      duck: 1.5,
      loop: stabs,
    },
    {
      inst: 'strings',
      gain: -5,
      width: 0.9,
      verb: 0.6,
      hp: 200,
      eq: [{ f: 2000, gain: -3, q: 0.8 }],
      duck: 2,
      loop: strings,
    },
    { inst: 'spicc', gain: -7, pan: -0.3, width: 0.3, verb: 0.3, hp: 100, duck: 2, loop: spiccato },
    { inst: 'choir', gain: -10, width: 0.8, verb: 0.6, hp: 250, loop: choir },
    { inst: 'synthBass', gain: -2, verb: 0, hp: 30, duck: 4, loop: low },
    { inst: 'synthPluck', gain: -8, pan: -0.45, verb: 0.3, echo: 0.25, hp: 400, loop: plucks },
    { inst: 'glock', gain: -21, pan: 0.45, verb: 0.4, hp: 600, loop: sparkle },
    { inst: 'kick', gain: -5, verb: 0, room: 0.08, loop: drum(kick, 21) },
    { inst: 'snare', gain: -3, pan: 0.04, verb: 0.12, room: 0.35, loop: drum(snare, 22) },
    { inst: 'tom', gain: -9, pan: -0.1, verb: 0.12, room: 0.35, loop: drum(toms, 23) },
    { inst: 'hat', gain: -7, pan: 0.28, verb: 0.03, room: 0.1, loop: drum(hats, 24) },
    { inst: 'shaker', gain: -12, pan: 0.32, verb: 0.08, room: 0.1, loop: drum(shaker, 25) },
    { inst: 'ride', gain: -11, pan: -0.3, verb: 0.08, room: 0.15, loop: drum(ride, 26) },
    { inst: 'openHat', gain: -10, pan: 0.3, verb: 0.05, room: 0.15, loop: drum(openHat, 27) },
    { inst: 'crash', gain: -8, pan: -0.2, width: 0.5, verb: 0.2, room: 0.1, loop: crash },
    { inst: 'revCrash', gain: -11, pan: 0.2, width: 0.5, verb: 0.25, loop: swells },
    { inst: 'riser', gain: -14, width: 0.6, verb: 0.3, loop: risers },
    { inst: 'boom', gain: -9, verb: 0.25, hp: 25, loop: boom },
    { inst: 'timpani', gain: -14, verb: 0.45, hp: 40, loop: drum(timps, 28) },
  ],
};
