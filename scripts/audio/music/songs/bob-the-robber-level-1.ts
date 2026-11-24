import { grid, midi, seq, type Note } from '../notes.ts';
import type { Song, Track } from '../render.ts';
import {
  brushSlap,
  brushSweep,
  compPiano,
  crash,
  dyn,
  falls,
  horn,
  hornFall,
  humanize,
  kick,
  meter,
  mutedTrumpet,
  pedalHat,
  phrase,
  ramp,
  ride,
  rim,
  snap,
  snare,
  swing,
  tenorSax,
  tom,
  twang,
  upright,
  vibes,
} from '../kits/action.ts';

/**
 * Bob the Robber, level 1: an original sneaky heist-jazz theme in E minor at 144 BPM, swung. A1 tiptoes (muted
 * trumpet, upright bass doubled by a twangy baritone guitar, brushes, finger snaps); A2 brings a tenor sax
 * counter-line, piano comping and sticks on the ride; the bridge turns to G major for a horn shout chorus; then
 * stop-time alarm hits and a chromatic pickup slip back to the top.
 */
const BAR = 4;
const SWING = 0.13;
const A = ['Em9', 'Em9', 'C9', 'C9', 'Em9', 'Em9', 'F13', 'B7b9'];
const BRIDGE = ['Am9', 'D13', 'Gmaj9', 'Cmaj9', 'F#m7b5', 'B7b9', 'F13', 'B7b9'];
const CHORDS = [...A, ...A, ...BRIDGE];
const BARS = CHORDS.length;

/** Rootless jazz voicings, voice-led around middle C. */
const VOICE: Record<string, string[]> = {
  Em9: ['G3', 'B3', 'D4', 'F#4'],
  C9: ['E3', 'Bb3', 'D4', 'G4'],
  F13: ['Eb3', 'A3', 'D4', 'G4'],
  B7b9: ['D#3', 'A3', 'C4', 'G4'],
  Am9: ['G3', 'B3', 'C4', 'E4'],
  D13: ['F#3', 'B3', 'C4', 'E4'],
  Gmaj9: ['F#3', 'A3', 'B3', 'D4'],
  Cmaj9: ['E3', 'G3', 'B3', 'D4'],
  'F#m7b5': ['E3', 'A3', 'C4', 'F#4'],
};
const at = (bar: number, beat: number, d: number, n: number, v: number): Note => ({
  t: bar * BAR + beat,
  d,
  n,
  v,
});
const chordAt = (bar: number, beat: number, d: number, v: number, up = 0) =>
  VOICE[CHORDS[bar]!]!.map((name) => at(bar, beat, d, midi(name) + up, v));
const feel = (notes: Note[], seed: number, time = 0.012, vel = 0.07) =>
  humanize(swing(notes, SWING), seed, time, vel);

// ---------------------------------------------------------------- melody (eighth-note steps)
const A1 = [
  'E4 . . G4 . A4 A#4 B4',
  '- . D5 C#5 C5 B4 . .',
  'E4 . . G4 . Bb4 B4 C5',
  '- . E5 Eb5 D5 C5 . .',
  'B4 . E5 . G5 . F#5 F5',
  'E5:2 D5 B4 . G4 A4 B4',
  'C5 . A4 . Eb5 . D5 C5',
  'B4:2 A4 F#4 D#4:2 . .',
];
const A2 = [
  ...A1.slice(0, 4),
  'B4 . E5 . G5 . A5 A#5',
  'B5:3 A5 G5 E5 D5 B4',
  'C5 . A4 . Eb5 D5 C5 A4',
  'B4:2 C5 B4 A4 F#4 D#4 .',
];
const SHOUT = [
  'A4 C5 E5 G5:3 . E5',
  'F#5:4 . E5 D5 C5',
  'B4:3 D5 F#5:3 .',
  'E5:4 . G5 F#5 E5',
  'A5:3 G5 F#5 . E5 C5',
  'D#5:4 F#5 A5 C6 B5',
];
const PICKUP = '. . . . . . . . | . . . . C4 C#4 D4 D#4';
const melody = seq([...A1, ...A2, ...SHOUT, PICKUP].join(' '), { step: 0.5, v: 0.8 });
const trumpet = feel(
  phrase(
    meter(
      dyn(melody, (t) => (t < 8 * BAR ? 0.82 : t < 16 * BAR ? 0.92 : t < 23 * BAR ? 1 : 1.2)),
      0.7,
    ),
    8,
    0.14,
  ),
  21,
);
/** The shout chorus doubled by a trombone an octave down, plus the stop-time hits. */
const shoutLow = seq(SHOUT.join(' '), { step: 0.5, start: 16 * BAR, v: 0.85, transpose: -12 });
const HIT_F = ['Eb4', 'A4', 'D5', 'G5'];
const HIT_B = ['D#4', 'A4', 'C5', 'G5'];
const hits: Note[] = [
  ...HIT_F.map((n, i) => at(22, 0.012 * i, 0.7, midi(n), 0.62)),
  ...HIT_F.map((n, i) => at(22, 1.5 + 0.012 * i, 0.4, midi(n), 0.58)),
  ...HIT_B.map((n, i) => at(23, 0.012 * i, 1.2, midi(n), 0.62)),
];
const [lowBody, lowEnds] = falls(feel(meter(shoutLow, 0.7), 22));
const trombone = [...lowBody, ...feel(hits, 28)];
/** An open trumpet doubles the shout at pitch on the other side, with fall-offs on its phrase endings. */
const [highBody, highEnds] = falls(
  feel(meter(seq(SHOUT.join(' '), { step: 0.5, start: 16 * BAR, v: 0.85 }), 0.7), 29),
);

/** Tenor sax: guide tones under A2, a tenth under the shout. */
const saxLine = seq(
  [
    'G3:8',
    'F#3:4 G3:4',
    'G3:8',
    'Bb3:4 A3:2 G3:2',
    'G3:4 B3:4',
    'D4:4 C#4:2 C4:2',
    'A3:8',
    'A3:4 C4:2 B3:2',
  ].join(' '),
  { step: 0.5, start: 8 * BAR, v: 0.7 },
);
const saxShout = seq(
  [
    'E4 A4 C5 E5:3 . C5',
    'D5:4 . C5 B4 A4',
    'G4:3 B4 D5:3 .',
    'C5:4 . E5 D5 C5',
    'F#5:3 E5 D5 . C5 A4',
    'B4:4 D#5 F#5 A5 G5',
  ].join(' '),
  { step: 0.5, start: 16 * BAR, v: 0.85, transpose: -12 },
);
const sax = feel(phrase([...dyn(saxLine, ramp(8 * BAR, 16 * BAR, 0.7, 1)), ...saxShout], 8, 0.2), 23);

// ---------------------------------------------------------------- comping
const COMP = [
  [
    [0, 1.2],
    [1.5, 0.4],
  ],
  [
    [0.5, 0.4],
    [2.5, 0.9],
  ],
  [
    [1.5, 0.4],
    [3, 0.6],
  ],
  [
    [0, 0.4],
    [2, 0.4],
    [3.5, 0.4],
  ],
];
const pianoNotes = CHORDS.flatMap((_, b) =>
  b < 8 || b >= 22
    ? []
    : COMP[(b + (b >= 16 ? 3 : 0)) % COMP.length]!.flatMap(([beat, d]) =>
        chordAt(b, beat!, d!, b >= 16 ? 0.45 : 0.55),
      ),
);
const piano = feel(pianoNotes, 24, 0.015, 0.1);
const vibesNotes = [
  ...CHORDS.slice(0, 8).flatMap((_, b) => chordAt(b, 0, 2.5, b % 2 ? 0.38 : 0.48, 12)),
  ...seq(SHOUT.join(' '), { step: 0.5, start: 16 * BAR, v: 0.6, transpose: 12 }),
];
const vibesPart = feel(vibesNotes, 25, 0.01, 0.1);

// ---------------------------------------------------------------- bass (walking quarters) and spy guitar
const WALK = [
  'E2 B1 D2 D#2',
  'E2 G2 A2 B2',
  'C3 G2 Bb2 G2',
  'C2 E2 G2 F2',
  'E2 G2 A2 A#2',
  'B2 A2 G2 F#2',
  'F2 A2 Eb3 C3',
  'B1 D#2 F#2 F2',
];
const WALK2 = [...WALK.slice(0, 7), 'B1 D#2 A2 G#2'];
const WALK_B = [
  'A2 B2 C3 C#3',
  'D3 C3 A2 Ab2',
  'G2 B2 D3 C#3',
  'C3 B2 A2 G2',
  'F#2 E2 D2 C2',
  'B1 D#2 F#2 A2',
];
const walk = seq([...WALK, ...WALK2, ...WALK_B].join(' '), { step: 1, v: 0.82 }).map((n) => ({
  ...n,
  d: 0.92,
}));
const bassHits: Note[] = [
  at(22, 0, 0.7, midi('F2'), 0.8),
  at(22, 1.5, 0.4, midi('F2'), 0.75),
  at(23, 0, 1.2, midi('B1'), 0.8),
  ...seq('C2 C#2 D2 D#2', { step: 0.5, start: 23 * BAR + 2, v: 0.75 }),
];
const bassLine = feel(meter([...walk, ...bassHits], 0.5), 26, 0.008, 0.08);
const guitar = feel(
  walk.filter((n) => n.t < 8 * BAR).map((n) => ({ ...n, n: n.n + 12, d: 0.8, v: 0.7 })),
  27,
  0.01,
  0.1,
);

// ---------------------------------------------------------------- drums
const beats = (from: number, to: number, which: number[], v: number) =>
  Array.from({ length: to - from }, (_, k) => which.map((beat) => at(from + k, beat, 0.25, 0, v))).flat();
const sweeps = humanize(
  Array.from({ length: 8 * 4 }, (_, i) => ({ t: i, d: 0.9, n: 0, v: i % 2 ? 0.8 : 0.55 })),
  31,
  0.012,
  0.15,
);
const trip = (bar: number, from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    t: bar * BAR + from + i / 3,
    d: 0.25,
    n: 0,
    v: 0.4 + (0.6 * i) / n,
  }));
/** Brushes: slaps on two and four, and a triplet crescendo that hands A1 over to A2. */
const slaps = humanize([...beats(0, 8, [1, 3], 0.6), ...trip(7, 2, 6)], 32, 0.008, 0.15);
const feather = humanize(beats(0, 16, [0, 1, 2, 3], 0.28), 33, 0.006, 0.15);
const chicks = humanize(beats(0, 22, [1, 3], 0.55), 34, 0.006, 0.1);
const snapsL = humanize(beats(0, 8, [1], 0.75), 35, 0.01, 0.1);
const snapsR = humanize(beats(0, 8, [3], 0.75), 36, 0.01, 0.1);
const rideNotes = feel(
  [
    ...beats(8, 22, [0, 1, 2, 3], 0.7).map((n) => ({ ...n, v: n.t % 2 ? 0.8 : 0.62 })),
    ...beats(8, 22, [1.5, 3.5], 0.5),
    ...beats(23, 24, [1, 2, 3], 0.45),
  ],
  37,
  0.006,
  0.1,
);
/** Snare chatter under A2: soft comping ghosts that answer the piano. */
const ghosts = feel(
  Array.from({ length: 7 }, (_, k) => 8 + k).flatMap((b) =>
    (b % 2 ? [1.5, 2.5, 3.5] : [0.5, 2.5]).map((beat) => at(b, beat, 0.25, 0, 0.22 + 0.06 * (beat % 2))),
  ),
  38,
);
const crossStick = humanize(beats(8, 16, [3], 0.6), 39);
const backbeat = humanize(beats(16, 22, [1, 3], 0.72), 40);
const stopTime: Note[] = [
  at(22, 0, 0.25, 0, 0.8),
  at(22, 1.5, 0.25, 0, 0.75),
  ...trip(22, 2, 6),
  at(23, 0, 0.25, 0, 0.8),
];
const pickupRoll = dyn(grid('..x.x.x.x.x.x.x.', { start: 23 * BAR }), ramp(23 * BAR, 24 * BAR, 0.25, 0.7));
const snareNotes = [...ghosts, ...backbeat, ...trip(15, 2, 6), ...stopTime, ...feel(pickupRoll, 43)];
const kicks = humanize(
  [
    ...feather,
    ...beats(16, 22, [0], 0.62),
    ...beats(16, 22, [2], 0.54),
    ...beats(8, 16, [1.5], 0.45).filter((n) => Math.floor(n.t / BAR) % 2 === 0),
    at(22, 0, 0.25, 0, 0.65),
    at(22, 1.5, 0.25, 0, 0.6),
    at(23, 0, 0.25, 0, 0.65),
  ],
  41,
  0.004,
  0.06,
);
const toms = humanize(
  [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      t: 21 * BAR + 2 + i / 3,
      d: 0.3,
      n: midi(['A3', 'A3', 'E3', 'E3', 'B2', 'B2'][i]!),
      v: 0.5 + 0.05 * i,
    })),
    ...[0, 1, 2].map((i) => ({
      t: 15 * BAR + 3 + i / 3,
      d: 0.3,
      n: midi(['A3', 'E3', 'B2'][i]!),
      v: 0.75 + 0.1 * i,
    })),
  ],
  42,
  0.004,
  0.05,
);
const crashes: Note[] = [
  at(0, 0, 1, 0, 0.6),
  at(8, 0, 1, 0, 0.5),
  at(16, 0, 1, 0, 1),
  at(20, 0, 1, 0, 0.6),
  at(22, 0, 1, 0, 0.85),
  at(23, 0, 1, 0, 0.85),
];

/** Mix gains, before a common trim that keeps the bus below the master compressor (transients stay intact). */
const HEADROOM = -12;
const tracks: Track[] = [
  { inst: mutedTrumpet, gain: 1, pan: 0.15, verb: 0.28, loop: trumpet },
  { inst: horn, gain: -5, pan: 0.55, verb: 0.35, loop: highBody },
  { inst: hornFall, gain: -5, pan: 0.55, verb: 0.35, loop: highEnds },
  { inst: horn, gain: -5, pan: -0.55, verb: 0.4, loop: trombone },
  { inst: hornFall, gain: -5, pan: -0.55, verb: 0.4, loop: lowEnds },
  { inst: tenorSax, gain: -7, pan: -0.35, verb: 0.3, loop: sax },
  { inst: compPiano, gain: -9, pan: -0.6, verb: 0.3, loop: piano },
  { inst: vibes, gain: -10, pan: 0.6, verb: 0.4, loop: vibesPart },
  { inst: twang, gain: -9, pan: 0.4, verb: 0.45, loop: guitar },
  { inst: upright, gain: -5, pan: 0, verb: 0.08, loop: bassLine },
  { inst: kick, gain: -3, pan: 0, verb: 0.05, loop: kicks },
  { inst: brushSweep, gain: -2, pan: -0.2, verb: 0.2, loop: sweeps },
  { inst: brushSlap, gain: -1, pan: 0.2, verb: 0.3, loop: slaps },
  { inst: snare, gain: -9, pan: 0.05, verb: 0.3, loop: snareNotes },
  { inst: rim, gain: -2, pan: 0.15, verb: 0.25, loop: crossStick },
  { inst: ride, gain: 0, pan: 0.45, verb: 0.2, loop: rideNotes },
  { inst: pedalHat, gain: 6, pan: -0.35, verb: 0.1, loop: chicks },
  { inst: snap, gain: 0, pan: -0.45, verb: 0.3, loop: snapsL },
  { inst: snap, gain: 0, pan: 0.45, verb: 0.3, loop: snapsR },
  { inst: tom, gain: -10, pan: -0.25, verb: 0.3, loop: toms },
  { inst: crash, gain: -5, pan: -0.4, verb: 0.35, loop: crashes },
];

export const song: Song = {
  id: 'bob-the-robber-level-1',
  title: "Bob's First Heist",
  evokes: 'Bob the Robber (Flazm): an original sneaky heist-jazz theme in the spirit of the game',
  bpm: 144,
  loopBeats: BARS * BAR,
  seed: 5,
  reverb: { room: 0.45, damp: 0.55, wet: 0.28 },
  tracks: tracks.map((t) => ({ ...t, gain: (t.gain ?? 0) + HEADROOM })),
};
