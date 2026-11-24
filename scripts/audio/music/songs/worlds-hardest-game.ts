import { arp, grid, loop, midi, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';
import {
  chipArp,
  chipLead,
  crash,
  dyn,
  hat,
  humanize,
  kick,
  meter,
  openHat,
  phrase,
  pumpBass,
  ramp,
  riser,
  rim,
  sawPluck,
  snare,
  swell,
} from '../kits/action.ts';

/**
 * The World's Hardest Game stage: an original tense, catchy electro-house loop in C minor at 142 BPM, in the
 * spirit of the game's four-on-the-floor Flash soundtrack. A: a 3-3-2 supersaw pluck hook over offbeat stabs
 * and a pumping bass. B: a pulse-wave chip melody over ticking arpeggios (the blue dots) with coin dings.
 * C: a kick-less breakdown, then a four-bar snare-roll build that lands back on the hook.
 */
const BAR = 4;
const A = ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Bb', 'G7'];
const B = ['Fm', 'Cm', 'Ab', 'G', 'Fm', 'Cm', 'Db', 'G'];
const C = ['Abmaj7', 'Bb', 'Cm', 'Cm'];
const D = ['Ab', 'Bb', 'G', 'G7'];
const CHORDS = [...A, ...B, ...C, ...D];
const BARS = CHORDS.length;

/** Close voicings around middle C, voice-led. */
const VOICE: Record<string, string[]> = {
  Cm: ['G3', 'C4', 'Eb4'],
  Ab: ['Ab3', 'C4', 'Eb4'],
  Abmaj7: ['G3', 'Ab3', 'C4', 'Eb4'],
  Bb: ['F3', 'Bb3', 'D4'],
  G: ['G3', 'B3', 'D4'],
  G7: ['F3', 'B3', 'D4'],
  Fm: ['F3', 'Ab3', 'C4'],
  Db: ['F3', 'Ab3', 'Db4'],
};
const ROOT: Record<string, string> = {
  Cm: 'C2',
  Ab: 'Ab1',
  Abmaj7: 'Ab1',
  Bb: 'Bb1',
  G: 'G1',
  G7: 'G1',
  Fm: 'F1',
  Db: 'Db2',
};
const at = (bar: number, beat: number, d: number, n: number, v: number): Note => ({
  t: bar * BAR + beat,
  d,
  n,
  v,
});
const voicing = (bar: number, beat: number, d: number, v: number, up = 0) =>
  VOICE[CHORDS[bar]!]!.map((name) => at(bar, beat, d, midi(name) + up, v));

// ---------------------------------------------------------------- A: the hook (16th steps, 3+3+2 accents)
const HOOK = [
  'Eb5:3 D5:3 C5:2 G5:2 F5:2 Eb5:2 D5:2',
  'C5:3 Eb5:3 Ab5:2 G5:3 Eb5:3 F5:2',
  'D5:3 F5:3 Bb5:2 Ab5:3 F5:3 G5:2',
  'B4:3 D5:3 G5:2 F5:2 Eb5:2 D5:2 B4:2',
];
const hook = phrase(
  meter(
    seq([...HOOK, ...HOOK.slice(0, 3), 'B4:3 D5:3 F5:2 Ab5:3 G5:3 F5:2'].join(' '), { step: 0.25, v: 0.86 }),
  ),
  8,
  0.12,
);
/** The hook comes back in the last two bars of the build, rising. */
const hookReturn = seq('G4:2 B4:2 D5:2 F5:2 G5:2 B5:2 D6:2 F6:2 | G5:1 Ab5 G5 F5 D5 Eb5 D5 B4 G4:4 . . . .', {
  step: 0.25,
  start: 22 * BAR,
  v: 0.7,
});
const lead = humanize([...hook, ...dyn(hookReturn, ramp(22 * BAR, 24 * BAR, 0.55, 0.95))], 11, 0.006, 0.05);
/** A dotted-eighth echo of the lead, panned away from it. */
const echo = (notes: Note[], beats: number, v: number) =>
  notes.map((n) => ({ ...n, t: (n.t + beats) % (BARS * BAR), v: n.v * v }));

// ---------------------------------------------------------------- B: chip melody over the dots
const chipMelody = seq(
  [
    'C5:2 F5:2 Ab5:3 G5',
    'G5:4 Eb5:2 C5:2',
    'Eb5:2 Ab5:2 C6:3 Bb5',
    'B5:4 . G5 F5 D5',
    'C5:2 F5:2 Ab5:3 G5',
    'G5:3 Ab5 G5:2 Eb5:2',
    'F5:2 Ab5:2 Db6:3 C6',
    'B5:6 D6 B5',
  ].join(' '),
  { step: 0.5, start: 8 * BAR, v: 0.8 },
);
const chip = humanize(phrase(meter(chipMelody, 0.6), 8, 0.15), 12, 0.006, 0.05);
const dots = humanize(
  shift(arp(B, [0, 2, 1, 2, 3, 2, 1, 2], { octave: 4, step: 0.25, v: 0.5, gate: 0.5 }), 8 * BAR),
  13,
  0.004,
  0.12,
);
const coins = [8, 10, 12, 14].flatMap((b) => [
  at(b, 0, 0.25, midi('G6'), 0.55),
  at(b, 0.25, 0.5, midi('C7'), 0.7),
]);

// ---------------------------------------------------------------- harmony
/** Offbeat supersaw stabs in A and in the last two bars of the build. */
const stabBars = [...Array.from({ length: 8 }, (_, b) => b), 22, 23];
const stabs = humanize(
  stabBars.flatMap((b) =>
    [0.5, 1.5, 2.5, 3.5].flatMap((beat) => voicing(b, beat, 0.3, beat === 3.5 ? 0.7 : 0.6)),
  ),
  14,
  0.004,
  0.08,
);
const stabsHigh = stabs.map((n) => ({ ...n, n: n.n + 12, v: n.v * 0.8 }));
/** Pads: quiet glue under A and B, opening up in the breakdown. */
const padNotes = CHORDS.flatMap((_, b) => voicing(b, 0, BAR, b >= 16 && b < 20 ? 0.75 : 0.42));
const padHigh = CHORDS.flatMap((_, b) =>
  b >= 8 && b < 20 ? voicing(b, 0, BAR, b >= 16 ? 0.6 : 0.35, 12) : [],
);
/** The hook's first cell, dark and soft, floating over the breakdown. */
const ghostHook = seq(
  'Eb5:3 D5:3 C5:2 . . . . . . . . | . . . . . . . . . . . . . . . . | Eb5:3 D5:3 C5:2 G5:2 F5:2 Eb5:2 D5:2',
  {
    step: 0.25,
    start: 16 * BAR,
    v: 0.42,
  },
);

// ---------------------------------------------------------------- bass
const bassNotes: Note[] = CHORDS.flatMap((s, b) => {
  const r = midi(ROOT[s]!);
  if (b < 8)
    return [0.5, 1.5, 2.5, 3.5].map((beat) =>
      at(b, beat, 0.38, beat === 3.5 && b % 2 === 1 ? r + 12 : r, 0.85),
    );
  if (b < 16)
    return [0, 1, 2, 3].flatMap((beat) => [
      at(b, beat + 0.25, 0.2, r, 0.55),
      at(b, beat + 0.5, 0.2, r, 0.85),
      at(b, beat + 0.75, 0.2, beat === 3 ? r + 12 : r, 0.65),
    ]);
  if (b < 20) return [at(b, 0, BAR * 0.95, r, 0.6)];
  return [0.5, 1.5, 2.5, 3.5].map((beat) => at(b, beat, 0.38, r, 0.6 + 0.1 * (b - 20)));
});
const bassLine = humanize(bassNotes, 15, 0.003, 0.05);

// ---------------------------------------------------------------- drums
const four = (from: number, to: number) =>
  loop(grid('x...x...x...x...', { start: from * BAR }), to - from, BAR);
const kicks = humanize([...four(0, 16), ...four(20, 24)], 16, 0.002, 0.04);
const backbeat = loop(grid('....x.......x...'), 16, BAR);
const fills = [7, 15].flatMap((b) => grid('............xoxx', { start: b * BAR }));
const roll = [
  ...grid('x...x...x...x...', { start: 20 * BAR }),
  ...grid('x.x.x.x.x.x.x.x.', { start: 21 * BAR }),
  ...grid('xxxxxxxxxxxxxxxx', { start: 22 * BAR }),
  ...grid('xxxxxxxxxxxxxxxx', { start: 23 * BAR }),
  ...grid('xxxxxxxx', { start: 23 * BAR + 2, step: 0.125 }),
];
const snares = humanize(
  [
    ...backbeat.map((n) => ({ ...n, v: 0.85 })),
    ...fills.map((n) => ({ ...n, v: n.v * 0.7 })),
    ...dyn(roll, ramp(20 * BAR, 24 * BAR, 0.3, 1)),
  ],
  17,
  0.003,
  0.06,
);
const hats = humanize(
  [
    ...loop(grid('xo.-xo.-xo.-xo.o'), 16, BAR).map((n) => ({ ...n, v: n.v * 0.7 })),
    ...loop(grid('x.o.x.o.x.o.x.o.', { start: 16 * BAR }), 4, BAR).map((n) => ({ ...n, v: n.v * 0.45 })),
    ...dyn(loop(grid('xoxoxoxoxoxoxoxo', { start: 20 * BAR }), 4, BAR), ramp(20 * BAR, 24 * BAR, 0.35, 0.85)),
  ],
  18,
  0.004,
  0.1,
);
const opens = humanize(loop(grid('..x...x...x...x.'), 16, BAR), 19, 0.004, 0.08).map((n) => ({
  ...n,
  v: n.v * 0.6,
}));
const ticks = humanize(loop(grid('..x...x...x...x.', { start: 16 * BAR }), 4, BAR), 20, 0.004, 0.1);
const crashes: Note[] = [
  at(0, 0, 1, 0, 0.95),
  at(8, 0, 1, 0, 0.8),
  at(16, 0, 1, 0, 0.55),
  at(20, 0, 1, 0, 0.5),
];
const swells: Note[] = [at(7, 2, 2, 0, 0.6), at(15, 2, 2, 0, 0.7)];
const rise: Note[] = [at(20, 0, 4 * BAR, 0, 0.8)];

export const song: Song = {
  id: 'worlds-hardest-game',
  title: "World's Hardest Stage",
  evokes:
    "The World's Hardest Game (Snubby Land): an original tense electro-house loop in the spirit of its Flash soundtrack",
  bpm: 142,
  loopBeats: BARS * BAR,
  seed: 7,
  reverb: { room: 0.5, damp: 0.45, wet: 0.24 },
  tracks: [
    { inst: sawPluck, gain: 0, pan: -0.12, verb: 0.22, loop: lead },
    { inst: sawPluck, gain: -8, pan: 0.6, verb: 0.35, loop: echo(lead, 0.75, 0.6) },
    { inst: sawPluck, gain: 3, pan: 0.2, verb: 0.55, loop: ghostHook },
    { inst: chipLead, gain: -10, pan: 0.05, verb: 0.22, loop: chip },
    { inst: chipLead, gain: -19, pan: -0.6, verb: 0.35, loop: echo(chip, 0.75, 0.6) },
    { inst: chipArp, gain: -12, pan: 0.5, verb: 0.2, loop: dots },
    { inst: 'glock', gain: -13, pan: -0.45, verb: 0.4, loop: coins },
    { inst: sawPluck, gain: -3, pan: -0.65, verb: 0.25, loop: stabs },
    { inst: sawPluck, gain: -6, pan: 0.65, verb: 0.3, loop: stabsHigh },
    { inst: 'pad', gain: -11, pan: -0.55, verb: 0.45, loop: padNotes },
    { inst: 'strings', gain: -12, pan: 0.55, verb: 0.5, loop: padHigh },
    { inst: pumpBass, gain: -3, pan: 0, verb: 0.03, loop: bassLine },
    { inst: kick, gain: -7, pan: 0, verb: 0.03, loop: kicks },
    { inst: snare, gain: -12, pan: 0.04, verb: 0.2, loop: snares },
    { inst: 'clap', gain: 1, pan: -0.06, verb: 0.25, loop: backbeat.map((n) => ({ ...n, v: 0.8 })) },
    { inst: hat, gain: -3, pan: 0.35, verb: 0.08, loop: hats },
    { inst: openHat, gain: -6, pan: -0.3, verb: 0.12, loop: opens },
    { inst: rim, gain: -12, pan: 0.45, verb: 0.3, loop: ticks },
    { inst: crash, gain: -6, pan: -0.3, verb: 0.3, loop: crashes },
    { inst: swell, gain: -12, pan: 0.3, verb: 0.2, loop: swells },
    { inst: riser, gain: -10, pan: 0, verb: 0.4, loop: rise },
  ],
};
