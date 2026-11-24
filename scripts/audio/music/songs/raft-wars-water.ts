import { grid, loop, midi, seq, type Note } from '../notes.ts';
import type { Song, Track } from '../render.ts';
import {
  bell2,
  bubbleOrgan,
  conga,
  crash,
  diatonic,
  dyn,
  falls,
  fingerBass,
  hat,
  horn,
  hornFall,
  humanize,
  kick,
  meter,
  openHat,
  phrase,
  ramp,
  rim,
  roll,
  skank,
  slideWhistle,
  snare,
  steelPan,
  swell,
  tenorSax,
  timbale,
} from '../kits/action.ts';

/**
 * Raft Wars lagoon: an original sunny calypso-ska romp in F major at 158 BPM, in the spirit of the game's
 * cheeky water fights. A: steel pans over a ska skank, bubbling organ and a walking bass. B: brass calls,
 * steel-pan answers. C: a soca bridge in D minor with a marimba run, cowbell and four-on-the-floor kick, ending
 * on a brass hit, a slide whistle and a timbale fill back to the top.
 */
const BAR = 4;
const A = ['F', 'Dm', 'Bb', 'C7', 'F', 'Dm', 'G7', 'C7'];
const B = ['Bb', 'F', 'Gm7', 'C7', 'Bb', 'F', 'Gm7', 'C7'];
const C = ['Dm', 'Am', 'Bb', 'C', 'Dm', 'Am', 'Bb', 'C7'];
const CHORDS = [...A, ...B, ...C];
const BARS = CHORDS.length;
const F_MAJOR = [5, 7, 9, 10, 0, 2, 4];

const VOICE: Record<string, string[]> = {
  F: ['F4', 'A4', 'C5'],
  Dm: ['F4', 'A4', 'D5'],
  Bb: ['F4', 'Bb4', 'D5'],
  C7: ['E4', 'Bb4', 'C5'],
  C: ['E4', 'G4', 'C5'],
  G7: ['F4', 'B4', 'D5'],
  Gm7: ['F4', 'Bb4', 'D5'],
  Am: ['E4', 'A4', 'C5'],
};
const at = (bar: number, beat: number, d: number, n: number, v: number): Note => ({
  t: bar * BAR + beat,
  d,
  n,
  v,
});
const chordAt = (bar: number, beat: number, d: number, v: number, up = 0) =>
  VOICE[CHORDS[bar]!]!.map((name) => at(bar, beat, d, midi(name) + up, v));
const bars = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => from + k);

// ---------------------------------------------------------------- melodies (eighth-note steps)
const PAN_A = [
  'C5 D5 F5:2 . A5:2 G5',
  'F5:3 D5:3 C5:2',
  'D5 F5 Bb5:2 . D6:2 C6',
  'Bb5:3 G5:3 E5:2',
  'C5 D5 F5:2 . A5:2 G5',
  'F5:3 A5:3 D6:2',
  'C6 B5 . G5 . F5 D5 B4',
  'C5:2 E5 G5 Bb5 A5 G5 E5',
];
const REST = '. . . . . . . .';
const PAN_B = [
  REST,
  'A5 C6 A5 F5 . C5 . .',
  REST,
  'E5 G5 Bb5 C6 . Bb5 . G5',
  REST,
  'A5 . F5 . C6:2 A5 .',
  REST,
  'Bb5:2 G5 E5 C5 . . .',
];
const HORN_B = [
  'F4 . Bb4 . D5:2 C5 Bb4',
  REST,
  'G4 . Bb4 . D5:2 F5 D5',
  REST,
  'F4 . Bb4 . D5:2 F5 G5',
  REST,
  'Bb4 . D5 . F5 . G5 A5',
  'Bb5:2 G5 E5 C5 . . .',
];
const MARIMBA = [
  'A4 D5 F5 A5 . G5 F5 E5',
  'E5:2 C5 A4 . C5 E5 A5',
  'D6:2 Bb5 F5 . D5 F5 Bb5',
  'C6:3 G5 E5 G5 C6 E6',
  'F6 E6 D6 A5 F5 . D5 F5',
  'E5 . A5 . C6 . E6 .',
  'D6 C6 Bb5 A5 G5 F5 E5 D5',
  'C5:2 . . . . . .',
];
const panMelody = seq([...PAN_A, ...PAN_B].join(' '), { step: 0.5, v: 0.82 });
const pans = humanize(
  roll(
    phrase(
      meter(
        dyn(panMelody, (t) => (t < 8 * BAR ? 0.88 : 1)),
        0.7,
      ),
      8,
      0.15,
    ),
    1,
    1 / 6,
  ),
  51,
  0.008,
  0.06,
);
const panHarmony = humanize(
  roll(diatonic(within(panMelody, 0, 8 * BAR), F_MAJOR, -2), 1, 1 / 6).map((n) => ({ ...n, v: n.v * 0.62 })),
  52,
  0.01,
  0.08,
);
/** The brass calls, played short and punchy (long notes keep their length). */
const hornLine = seq(HORN_B.join(' '), { step: 0.5, start: 8 * BAR, v: 0.9 }).map((n) => ({
  ...n,
  d: n.d >= 1 ? n.d : n.d * 0.7,
}));
const late = (notes: Note[], beats: number) => notes.map((n) => ({ ...n, t: n.t + beats }));
/** Short brass pushes on the "and" of four, every other bar of A. */
const pushes = [1, 3, 5, 7].flatMap((b) => chordAt(b, 3.5, 0.4, 0.7, -12));
const hitC7 = [...chordAt(23, 0, 0.6, 1, -12), ...chordAt(23, 0, 0.6, 0.9)];
const [trumpetCalls, trumpetFalls] = falls(humanize(meter(hornLine, 0.7), 53, 0.006, 0.06));
const brassHits = humanize([...pushes, ...hitC7], 59, 0.006, 0.06);
const altoSax = late(humanize(meter(hornLine, 0.7), 60, 0.008, 0.08), 0.015);
const [tromboneCalls, tromboneFalls] = falls(
  late(
    humanize(
      diatonic(hornLine, F_MAJOR, -2).map((n) => ({ ...n, n: n.n - 12, v: n.v * 0.9 })),
      54,
      0.008,
      0.06,
    ),
    0.025,
  ),
);
const marimba = humanize(
  phrase(seq(MARIMBA.join(' '), { step: 0.5, start: 16 * BAR, v: 0.85 }), 8, 0.2),
  55,
  0.006,
  0.08,
);
const whistle: Note[] = [at(23, 1, 1.4, midi('C6'), 0.8)];

function within(notes: Note[], from: number, to: number): Note[] {
  return notes.filter((n) => n.t >= from && n.t < to);
}

// ---------------------------------------------------------------- rhythm section
const offbeats = (from: number, to: number, d: number, v: number, up = 0) =>
  bars(from, to).flatMap((b) => [0.5, 1.5, 2.5, 3.5].flatMap((beat) => chordAt(b, beat, d, v, up)));
/** Section dynamics: A sits back, B leans in, C opens lean (no kick or skank) and swells into the turnaround. */
const lift = (t: number) =>
  t < 8 * BAR ? 0.75 : t < 16 * BAR ? 1 : t < 20 * BAR ? 0.7 : ramp(20 * BAR, 24 * BAR, 0.85, 1.05)(t);
const lean = (b: number) => b >= 16 && b < 20;
const skanks = humanize(
  dyn(meter([...offbeats(0, 16, 0.2, 0.8), ...offbeats(20, 24, 0.2, 0.8)], 0.6), lift),
  56,
  0.006,
  0.1,
);
const bubbles = humanize(
  [...offbeats(0, 16, 0.3, 0.6, -12), ...bars(20, 23).flatMap((b) => chordAt(b, 0, 3.8, 0.55, -12))],
  57,
  0.008,
  0.1,
);
const WALK = [
  'F2 A2 C3 A2',
  'D2 F2 A2 C3',
  'Bb1 D2 F2 D2',
  'C2 E2 G2 Bb2',
  'F2 A2 C3 E3',
  'D3 C3 A2 F2',
  'G2 B2 D3 B2',
  'C3 Bb2 G2 E2',
  'Bb1 D2 F2 A2',
  'F2 E2 D2 C2',
  'G2 A2 Bb2 B2',
  'C3 G2 E2 C2',
  'Bb1 D2 F2 D2',
  'F2 A2 C3 A2',
  'G2 Bb2 D3 Db3',
  'C3 G2 E2 C#2',
];
const CALYPSO = [
  'D2:3 A2 D2:3 C#2',
  'A1:3 E2 A1:3 A1',
  'Bb1:3 F2 Bb1:3 B1',
  'C2:3 G2 C2:3 C#2',
  'D2:3 A2 D2:3 G#1',
  'A1:3 E2 A1:3 A1',
  'Bb1:3 F2 Bb1:3 B1',
  'C2:2 . . . . D2*1 E2*1',
];
const walk = seq(WALK.join(' '), { step: 1, v: 0.85 }).map((n) => ({ ...n, d: 0.8 }));
const calypso = seq(CALYPSO.join(' '), { step: 0.5, start: 16 * BAR, v: 0.85 });
const bassLine = humanize(meter([...walk, ...calypso], 0.5), 58, 0.006, 0.07);

// ---------------------------------------------------------------- drums and percussion
const kicks = humanize(
  [
    ...loop(grid('x.......x.....x.'), 16, BAR),
    ...[16, 17, 18, 19].map((b) => at(b, 0, 0.25, 0, 0.7)),
    ...loop(grid('x...x...x...x...', { start: 20 * BAR }), 3, BAR),
    at(23, 0, 0.25, 0, 1),
  ].map((n) => ({ ...n, v: n.v * lift(n.t) })),
  61,
  0.003,
  0.06,
);
const rims = humanize(loop(grid('....x.......x...'), 8, BAR), 62, 0.004, 0.08);
const snares = humanize(
  [
    ...loop(grid('....x.......x...', { start: 8 * BAR }), 15, BAR).map((n) => ({ ...n, v: 0.8 })),
    at(23, 0, 0.25, 0, 1),
    ...[7, 15].flatMap((b) => grid('............-oxx', { start: b * BAR })),
  ],
  63,
  0.004,
  0.06,
);
const hats = humanize(
  [
    ...loop(grid('x...x...x...x...'), 16, BAR).map((n) => ({ ...n, v: 0.55 })),
    ...loop(grid('x-o-x-o-x-o-x-o-', { start: 16 * BAR }), 7, BAR).map((n) => ({
      ...n,
      v: n.v * (lean(Math.floor(n.t / BAR)) ? 0.5 : 0.8),
    })),
  ],
  64,
  0.004,
  0.1,
);
const opens = humanize(loop(grid('..x...x...x...x.'), 16, BAR), 65, 0.004, 0.1).map((n) => ({
  ...n,
  v: n.v * 0.7,
}));
const shakes = humanize(loop(grid('o-x-o-x-o-x-o-x-'), BARS - 1, BAR), 66, 0.006, 0.12);
const congas = humanize(
  loop(
    [
      { t: 0.5, d: 0.25, n: midi('B3'), v: 0.7 },
      { t: 1.5, d: 0.25, n: midi('E4'), v: 0.85 },
      { t: 1.75, d: 0.25, n: midi('E4'), v: 0.6 },
      { t: 2.5, d: 0.25, n: midi('B3'), v: 0.75 },
      { t: 3.5, d: 0.25, n: midi('E4'), v: 0.85 },
      { t: 3.75, d: 0.25, n: midi('E4'), v: 0.65 },
    ],
    BARS - 1,
    BAR,
  ),
  67,
  0.006,
  0.1,
);
const timbales = humanize(
  [
    ...dyn(grid('xoxoxxxx', { start: 7 * BAR + 2, n: midi('A4') }), ramp(7 * BAR + 2, 8 * BAR, 0.6, 1)),
    ...dyn(grid('x.o.x.o.xoxoxxxx', { start: 15 * BAR, n: midi('A4') }), ramp(15 * BAR, 16 * BAR, 0.5, 1)),
    ...dyn(grid('xxxxxxxx', { start: 23 * BAR + 2, n: midi('A4') }), ramp(23 * BAR + 2, 24 * BAR, 0.6, 1)),
  ].map((n, i) => ({ ...n, n: i % 2 ? midi('E4') : midi('A4') })),
  68,
  0.004,
  0.05,
);
const cowbell = humanize(
  loop(
    [0, 1, 2, 2.5, 3.5].map((t, i) => ({ t, d: 0.25, n: midi(i % 2 ? 'E5' : 'A5'), v: i === 0 ? 0.8 : 0.6 })),
    7,
    BAR,
  ).map((n) => ({ ...n, t: n.t + 16 * BAR, v: n.v * lift(n.t + 16 * BAR) })),
  69,
  0.004,
  0.1,
);
const crashes: Note[] = [
  at(0, 0, 1, 0, 0.85),
  at(8, 0, 1, 0, 0.75),
  at(16, 0, 1, 0, 0.9),
  at(23, 0, 1, 0, 0.9),
];
const swells: Note[] = [at(15, 2, 2, 0, 0.6)];

/** Mix gains, before a common trim that keeps the bus below the master compressor (transients stay intact). */
const HEADROOM = -12;
const tracks: Track[] = [
  { inst: steelPan, gain: -6, pan: -0.2, verb: 0.28, loop: pans },
  { inst: steelPan, gain: -10, pan: 0.6, verb: 0.32, loop: panHarmony },
  { inst: horn, gain: 4, pan: 0.45, verb: 0.28, loop: trumpetCalls },
  { inst: hornFall, gain: 4, pan: 0.45, verb: 0.3, loop: trumpetFalls },
  { inst: horn, gain: -1, pan: 0.1, verb: 0.28, loop: brassHits },
  { inst: tenorSax, gain: -4, pan: -0.1, verb: 0.28, loop: altoSax },
  { inst: horn, gain: 0, pan: -0.5, verb: 0.3, loop: tromboneCalls },
  { inst: hornFall, gain: 0, pan: -0.5, verb: 0.3, loop: tromboneFalls },
  { inst: 'marimba', gain: -6, pan: -0.25, verb: 0.28, loop: marimba },
  { inst: 'marimba', gain: -12, pan: 0.55, verb: 0.3, loop: late(marimba, 0.04) },
  { inst: slideWhistle, gain: -6, pan: 0.3, verb: 0.35, loop: whistle },
  { inst: skank, gain: 0, pan: 0.65, verb: 0.15, loop: skanks },
  { inst: bubbleOrgan, gain: -6, pan: -0.65, verb: 0.2, loop: dyn(bubbles, lift) },
  { inst: fingerBass, gain: -3, pan: 0, verb: 0.05, loop: bassLine },
  { inst: kick, gain: -3, pan: 0, verb: 0.04, loop: kicks },
  { inst: rim, gain: -6, pan: 0.1, verb: 0.2, loop: rims },
  { inst: snare, gain: -11, pan: 0.05, verb: 0.22, loop: snares },
  { inst: hat, gain: 4, pan: 0.35, verb: 0.08, loop: dyn(hats, lift) },
  { inst: openHat, gain: 0, pan: -0.3, verb: 0.1, loop: dyn(opens, lift) },
  { inst: 'shaker', gain: -5, pan: 0.6, verb: 0.1, loop: shakes },
  { inst: conga, gain: -9, pan: -0.55, verb: 0.15, loop: congas },
  { inst: timbale, gain: -5, pan: 0.5, verb: 0.25, loop: timbales },
  { inst: bell2, gain: 0, pan: -0.45, verb: 0.15, loop: cowbell },
  { inst: crash, gain: -3, pan: -0.4, verb: 0.3, loop: crashes },
  { inst: swell, gain: -12, pan: 0.3, verb: 0.2, loop: swells },
];

export const song: Song = {
  id: 'raft-wars-water',
  title: 'Raft War Lagoon',
  evokes:
    "Raft Wars (Martijn Kunst): an original sunny calypso-ska water fight in the spirit of the game's music",
  bpm: 158,
  loopBeats: BARS * BAR,
  seed: 9,
  reverb: { room: 0.42, damp: 0.5, wet: 0.26 },
  tracks: tracks.map((t) => ({ ...t, gain: (t.gain ?? 0) + HEADROOM })),
};
