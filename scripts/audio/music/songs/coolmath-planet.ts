import { chord, grid, loop, root, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';
import {
  accents,
  arc,
  boom,
  brass,
  choir,
  crash,
  hat,
  horn,
  human,
  kick,
  lowStrings,
  phrase,
  powerChord,
  ramp,
  ride,
  rockBass,
  snare,
  spiccato,
  strings,
  swell,
  taiko,
  timpani,
  tom,
} from '../kits/atmos.ts';

/**
 * Coolmath Planet: the original Final Destination theme. An epic, dark orchestral-rock piece in D minor at
 * 150 BPM, the main menu's opening motif (F#-E-D-E-F#-A in D major) recast in the minor. Form: Riff
 * (bars 1-4, chugging guitars, taiko and choir hits), A (5-12, the brass theme), B (13-20, the choir carries
 * a broad heroic line over running strings) and a bridge (21-24) that turns to D major, the menu's key,
 * before falling back into the riff.
 */
const BAR = 4;
const at = (bar: number) => bar * BAR;

const RIFF = ['Dm', 'Bb', 'Gm', 'A'];
const A = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'];
const B = ['F', 'C', 'Dm', 'Bb', 'Gm', 'Bb', 'C', 'A'];
const BRIDGE = ['Bb', 'C', 'D', 'A'];
const chords = [...RIFF, ...A, ...B, ...BRIDGE];

// ---------------------------------------------------------------- melody

const themeA = seq(
  [
    'F5:3 E5 D5 E5 F5 A5',
    'Bb5:4 A5:2 F5:2',
    'G5:3 F5 E5 D5 E5 G5',
    'A5:6 E5 G5',
    'F5:3 E5 D5 E5 F5 A5',
    'D6:4 C6:2 Bb5:2',
    'Bb5:3 A5 G5 F5 E5 G5',
    'A5:4 E5 F5 G5 A5',
  ].join(' '),
  { step: 0.5, start: at(4), v: 0.82 },
);
const themeB = seq(
  [
    'A5:4 C6:4',
    'G5:6 E5:2',
    'F5:4 A5:4',
    'D6:8',
    'Bb5:4 D6:4',
    'C6:6 Bb5:2',
    'G5:4 C6:2 D6:2',
    'D6:4 C#6:4',
  ].join(' '),
  { step: 0.5, start: at(12), v: 0.8 },
);
const themeBridge = seq(
  ['D5:3 F5 Bb5:4', 'E5:3 G5 C6:4', 'F#5:3 A5 D6:4', 'C#6:2 E6:2 G6:2 A6:2'].join(' '),
  {
    step: 0.5,
    start: at(20),
    v: 0.9,
  },
);
const lead = human(arc([...themeA, ...themeBridge], phrase(8, 0.15)), 71, 0.05, 0.006);
const choirLine = arc(themeB, ramp(at(12), at(20), 0.85, 1.05));

// ---------------------------------------------------------------- orchestra and guitars

const triads = (
  symbols: string[],
  from: number,
  octave: number,
  beats: number[],
  d: number,
  v: number,
): Note[] =>
  symbols.flatMap((s, i) =>
    beats.flatMap((b) => chord(s, octave).map((n) => ({ t: at(from + i) + b, d, n, v }))),
  );

/** Choir: hits in the riff, held chords under the A theme, the melody in B (with a chord bed), bridge chords. */
const choirHits = triads(RIFF, 0, 4, [0], 1.2, 0.85);
const choirBed = arc(triads(A, 4, 4, [0], BAR, 0.5), phrase(16, 0.3));
const choirBridge = triads(BRIDGE, 20, 4, [0], BAR, 0.75);
/** The last bar's A major swells and rings across the loop point into the riff. */
const choirWrap = triads(['A'], 23, 4, [0], 5, 0.7);
const choirs = [...choirHits, ...choirBed, ...choirBridge, ...choirWrap];
/** Basses and tenors an octave under the B melody. */
const choirLow = shift(choirLine, 0, -12).map((n) => ({ ...n, v: n.v * 0.8 }));

/** Brass stabs: the fanfare push (1, the and of 2, 4) in the riff and bridge. */
const stabs = [
  ...triads(RIFF, 0, 4, [0, 1.5, 3], 0.55, 0.8),
  ...triads(BRIDGE, 20, 3, [0, 1.5, 3], 0.55, 0.75),
];

/** Violins: sustained in A, a running sixteenth figure in B. */
const violinsA = arc(triads(A, 4, 5, [0], BAR, 0.5), phrase(8, 0.3));
const run = (symbols: string[], from: number, v: number): Note[] =>
  symbols.flatMap((s, i) => {
    const [a, b, c] = chord(s, 5);
    return [a!, b!, c!, a! + 12, c!, b!, a!, b!, c!, a! + 12, b! + 12, c!, a! + 12, c!, b!, c!].map(
      (n, k) => ({
        t: at(from + i) + k * 0.25,
        d: 0.22,
        n,
        v: v * (k % 4 === 0 ? 1 : 0.7),
      }),
    );
  });
const violinsB = arc(run(B, 12, 0.75), ramp(at(12), at(20), 0.7, 1.1));
/** An ascending pickup run into B. */
const pickup = seq('A4 B4 C#5 D5 E5 F5 G5 A5', { step: 0.25, start: at(11) + 2, v: 0.8 }).map((n, i) => ({
  ...n,
  v: 0.55 + i * 0.05,
}));

/** Cellos and basses chug eighths on the root; spiccato doubles them an octave up. */
const chug = (symbols: string[], from: number, v: number) =>
  accents(
    symbols.flatMap((s, i) =>
      Array.from({ length: 8 }, (_, k) => ({ t: at(from + i) + k * 0.5, d: 0.45, n: root(s, 2), v })),
    ),
    [1, 0.6, 0.75, 0.6],
    0.5,
    2,
  );
const celloChug = [
  ...chug(RIFF, 0, 0.8),
  ...chug(A, 4, 0.75),
  ...chug(B, 12, 0.7),
  ...chug(BRIDGE, 20, 0.85),
];
const cellos = human(celloChug, 72, 0.05, 0.004);
const horns = [
  ...shift(lead, 0, -12).map((n) => ({ ...n, v: n.v * 0.85 })),
  ...arc(shift(themeB, 0, -12), ramp(at(12), at(20), 0.75, 0.95)),
];
/** B pulls back at its start and swells into the bridge. */
const buildB = (t: number) => (t >= at(12) && t < at(20) ? 0.72 + (0.28 * (t - at(12))) / at(8) : 1);

/** Guitars: palm-muted eighths with open accents on 1 and the and of 2, double-tracked. */
const guitar = (symbols: string[], from: number, v: number) =>
  symbols.flatMap((s, i) =>
    Array.from({ length: 8 }, (_, k) => {
      const open = k === 0 || k === 3;
      return { t: at(from + i) + k * 0.5, d: open ? 1.4 : 0.2, n: root(s, 2), v: open ? v : v * 0.7 };
    }).filter((n, k) => k !== 1 && k !== 4),
  );
const guitars = [
  ...guitar(RIFF, 0, 0.9),
  ...guitar(A, 4, 0.75),
  ...guitar(B, 12, 0.7),
  ...guitar(BRIDGE, 20, 0.9),
];
const bassLine = human(
  chords.flatMap((s, i) =>
    [0, 1, 1.5, 2, 3, 3.5].map((b, k) => ({
      t: at(i) + b,
      d: 0.45,
      n: root(s, 1) + (k === 3 ? 12 : 0),
      v: k % 2 ? 0.7 : 0.9,
    })),
  ),
  73,
  0.04,
  0.003,
);

// ---------------------------------------------------------------- percussion

const bars = (pattern: string, from: number, count: number, n = 0) =>
  loop(grid(pattern, { n, start: at(from) }), count, BAR);

const kicks = [
  ...bars('x..x..x...x.....', 0, 4),
  ...bars('x.....x.x.......', 4, 7),
  ...bars('x.....x.x...x.x.', 11, 1),
  ...bars('x...x...x...x...', 12, 7),
  ...bars('x...x...x.x.x.x.', 19, 1),
  ...bars('x.....x.x.....x.', 20, 3),
  ...bars('x.x.x.x.x.x.xxxx', 23, 1),
];
const snares = [
  ...bars('........x.......', 0, 3),
  ...bars('........x...x.xx', 3, 1),
  ...bars('....x.......x...', 4, 7),
  ...bars('....x.......xoxx', 11, 1),
  ...bars('....x.......x...', 12, 7),
  ...bars('....x...x.x.xxxx', 19, 1),
  ...bars('....x.......x...', 20, 3),
];
const fill = arc(
  seq('D3 D3 A2 A2 F2 F2 D2 D2', { step: 0.25, start: at(23) + 2, v: 0.8 }),
  ramp(at(23) + 2, at(24), 0.7, 1),
);
const fillTaiko = [
  ...grid('x.x.x.xx', { start: at(23) + 2, n: 33 }),
  ...grid('x.x.x.x.', { start: at(11) + 2, n: 33 }).map((n) => ({ ...n, v: n.v * 0.7 })),
];
const hats = accents(bars('x.x.x.x.x.x.x.x.', 4, 8), [1, 0.6], 0.5, 1);
const rides = accents(bars('x.x.x.x.x.x.x.x.', 12, 8), [1, 0.55], 0.5, 1);
const taikos = [...bars('x.......x.......', 0, 4, 33), ...bars('x...x...x...x...', 20, 3, 33)];
const timps = [
  ...RIFF.map((s, i) => ({ t: at(i), d: 1, n: root(s, 2), v: 0.85 })),
  ...seq('A2 . A2 . D3 D3 A2 A2', { step: 0.25, start: at(11) + 2, v: 0.6 }),
  { t: at(12), d: 1, n: 41, v: 1 },
  ...BRIDGE.map((s, i) => ({ t: at(20 + i), d: 1, n: root(s, 2), v: 0.9 })),
];
const crashes = [0, 4, 12, 16, 20].map((b) => ({ t: at(b), d: 1, n: 0, v: b === 0 || b === 12 ? 1 : 0.8 }));
const booms = [0, 12].map((b) => ({ t: at(b), d: 1, n: 0, v: 0.9 }));

export const song: Song = {
  id: 'coolmath-planet',
  title: 'Coolmath Planet',
  evokes: "an original Final Destination theme with a nod to the main menu's motif",
  bpm: 150,
  loopBeats: 24 * BAR,
  seed: 71,
  reverb: { room: 0.82, damp: 0.4, wet: 0.36 },
  tracks: [
    { inst: brass, gain: 4, pan: -0.08, verb: 0.3, loop: lead },
    { inst: horn, gain: -5, pan: 0.25, verb: 0.35, loop: horns },
    { inst: brass, gain: -8, pan: 0.25, verb: 0.3, loop: human(stabs, 74, 0.06, 0.006) },
    { inst: choir, gain: -3, pan: -0.55, verb: 0.55, loop: [...choirs, ...choirLine] },
    { inst: choir, gain: -6, pan: 0, verb: 0.55, loop: choirLow },
    { inst: choir, gain: -3, pan: 0.55, verb: 0.55, loop: shift([...choirs, ...choirLine], 0.015) },
    { inst: strings, gain: -3, pan: -0.4, verb: 0.4, loop: violinsA },
    { inst: strings, gain: -3, pan: 0.4, verb: 0.4, loop: shift(violinsA, 0.01, -12) },
    { inst: spiccato, gain: 0, pan: 0.55, verb: 0.3, loop: human(violinsB, 75, 0.05, 0.004) },
    { inst: spiccato, gain: -2, pan: -0.3, verb: 0.3, loop: pickup },
    {
      inst: spiccato,
      gain: -2,
      pan: -0.35,
      verb: 0.3,
      loop: human(shift(violinsB, 0, -12), 76, 0.05, 0.004),
    },
    { inst: lowStrings, gain: -8, pan: -0.2, verb: 0.25, loop: arc(cellos, buildB) },
    { inst: spiccato, gain: -6, pan: 0.2, verb: 0.2, loop: arc(shift(cellos, 0.005, 12), buildB) },
    {
      inst: powerChord,
      gain: -6,
      pan: -0.85,
      verb: 0.12,
      loop: arc(human(guitars, 77, 0.05, 0.005), buildB),
    },
    { inst: powerChord, gain: -6, pan: 0.85, verb: 0.12, loop: arc(human(guitars, 78, 0.05, 0.01), buildB) },
    { inst: rockBass, gain: -7, pan: 0, verb: 0.05, loop: bassLine },
    { inst: kick, gain: -11, pan: 0, verb: 0.05, loop: human(kicks, 79, 0.05, 0) },
    { inst: snare, gain: -5, pan: 0.05, verb: 0.3, loop: human(snares, 80, 0.06, 0.003) },
    { inst: tom, gain: -9, pan: -0.2, verb: 0.3, loop: fill },
    { inst: hat, gain: 6, pan: 0.35, verb: 0.1, loop: human(hats, 81, 0.08, 0.004) },
    { inst: ride, gain: -3, pan: -0.4, verb: 0.2, loop: arc(human(rides, 82, 0.14, 0.006), buildB) },
    { inst: taiko, gain: -11, pan: 0, verb: 0.45, loop: human([...taikos, ...fillTaiko], 83, 0.06, 0) },
    { inst: timpani, gain: -8, pan: 0.1, verb: 0.4, loop: timps },
    { inst: crash, gain: -2, pan: -0.4, verb: 0.35, loop: crashes },
    { inst: crash, gain: -5, pan: 0.45, verb: 0.35, loop: shift(crashes.slice(1), 0.01) },
    { inst: boom, gain: -6, pan: 0, verb: 0.3, loop: booms },
    {
      inst: swell,
      gain: -3,
      pan: 0.2,
      verb: 0.35,
      loop: [
        { t: at(11), d: 4, n: 0, v: 0.8 },
        { t: at(23), d: 4, n: 0, v: 0.9 },
      ],
    },
  ],
};
