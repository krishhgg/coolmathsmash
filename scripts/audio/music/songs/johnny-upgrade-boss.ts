import { arp, grid, loop, midi, seq, type Note } from '../notes.ts';
import type { Song } from '../render.ts';
import {
  chipArp,
  crash,
  dyn,
  hat,
  heroLead,
  horn,
  humanize,
  kick,
  meter,
  phrase,
  pickBass,
  powerChord,
  ramp,
  ride,
  riser,
  snare,
  tom,
} from '../kits/action.ts';

/**
 * Johnny Upgrade boss level: an original driving action-rock boss theme in E minor at 176 BPM, in the spirit of
 * the game's shooter showdown. A: a chugging double-tracked power-chord riff under a heroic lead. B: an open,
 * soaring chorus with a harmony lead, strings and crash-ride. C: the robot boss: half-time chugs, Phrygian
 * brass, a chiptune arpeggio and bullet-volley snares, rising into a build. D: the riff alone with a tom fill
 * and a pickup back to the top.
 */
const BAR = 4;
const A = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'];
const B = ['C', 'D', 'Bm', 'Em', 'C', 'D', 'B', 'B'];
const C = ['Em', 'F', 'Em', 'F', 'Em', 'F', 'G', 'B'];
const D = ['Em', 'C', 'D', 'B'];
const CHORDS = [...A, ...B, ...C, ...D];
const BARS = CHORDS.length;
const ROOT: Record<string, string> = { Em: 'E2', C: 'C3', D: 'D3', B: 'B2', Bm: 'B2', F: 'F2', G: 'G2' };
const at = (bar: number, beat: number, d: number, n: number, v: number): Note => ({
  t: bar * BAR + beat,
  d,
  n,
  v,
});
const root = (bar: number) => midi(ROOT[CHORDS[bar]!]!);

// ---------------------------------------------------------------- guitars
/** Riff bars in eighths; `R` is the bar's root, `+n` a power chord n semitones above it. */
const RIFF: Record<string, string[]> = {
  Em: ['R R R R +3:2 R +5', 'R R R R +6:2 +5 +3'],
  C: ['R R R R R:2 +2 R'],
  D: ['R R R R R:2 +2 +4'],
  B: ['R:3 R R:2 -2 R'],
};
const riffBar = (bar: number, pattern: string) =>
  pattern.split(' ').map((tok, i, all) => {
    const [deg, len] = tok.split(':');
    const step = all.slice(0, i).reduce((s, x) => s + Number(x.split(':')[1] ?? 1), 0);
    const semis = deg === 'R' ? 0 : Number(deg);
    const d = 0.5 * Number(len ?? 1);
    return at(bar, step * 0.5, d * 0.92, root(bar) + semis, d > 0.5 ? 0.95 : step % 2 ? 0.72 : 0.85);
  });
const riff = (bars: number[]) =>
  bars.flatMap((b, k) => {
    const options = RIFF[CHORDS[b]!]!;
    return riffBar(b, options[k % options.length]!);
  });
/** The chorus: ringing chords with eighth-note pushes. */
const chorusGtr = Array.from({ length: 8 }, (_, k) => 8 + k).flatMap((b) =>
  [
    [0, 1.5],
    [1.5, 0.5],
    [2, 1],
    [3, 0.5],
    [3.5, 0.5],
  ].map(([beat, d]) => at(b, beat!, d! * 0.95, root(b), beat === 0 ? 1 : 0.8)),
);
/** The boss: sixteenth palm-mutes on E with flat-two stabs, then the climb. */
const bossGtr = [
  ...Array.from({ length: 6 }, (_, k) => 16 + k).flatMap((b) =>
    Array.from({ length: 16 }, (_, s) => s).flatMap((s) => {
      if (CHORDS[b] === 'F')
        return s % 4 === 0 ? [at(b, s / 4, s === 0 ? 0.9 : 0.2, midi('F2'), s === 0 ? 1 : 0.8)] : [];
      return [at(b, s / 4, 0.2, midi('E2'), s % 4 === 0 ? 0.9 : s % 2 ? 0.55 : 0.7)];
    }),
  ),
  at(22, 0, 1.9, midi('G2'), 0.95),
  at(22, 2, 1.9, midi('A2'), 0.95),
  at(23, 0, 3.8, midi('B2'), 1),
];
/** Section dynamics: the chorus and the climb push harder than the riff and the boss chugs. */
const lift = (t: number) =>
  t < 8 * BAR ? 0.85 : t < 16 * BAR ? 1 : t < 22 * BAR ? 0.85 : t < 24 * BAR ? 1 : 0.88;
const guitar = dyn(
  [...riff([0, 1, 2, 3, 4, 5, 6, 7]), ...chorusGtr, ...bossGtr, ...riff([24, 25, 26, 27])],
  lift,
);
const gtrL = humanize(guitar, 71, 0.006, 0.05);
const gtrR = humanize(guitar, 72, 0.006, 0.05).map((n) => ({ ...n, t: n.t + 0.012 }));

// ---------------------------------------------------------------- bass
const bassNotes: Note[] = CHORDS.flatMap((s, b) => {
  const r = root(b) - 12;
  if (b >= 16 && b < 22)
    return Array.from({ length: 8 }, (_, e) => at(b, e * 0.5, 0.4, r, e === 0 ? 0.95 : 0.75));
  if (s === 'B' && b === 23) return [at(b, 0, 3.8, r, 1)];
  return Array.from({ length: 8 }, (_, e) => at(b, e * 0.5, 0.42, r, e % 2 ? 0.72 : 0.88));
});
const bassLine = humanize(bassNotes, 73, 0.004, 0.05);

// ---------------------------------------------------------------- leads
const LEAD_A = [
  'E5:2 . B4 E5 F#5 G5 A5',
  'B5:4 A5 G5 F#5 G5',
  'E5:3 G5 C6:2 B5 A5',
  'F#5:4 . D5 E5 F#5',
  'G5:2 . E5 G5 A5 B5 C6',
  'D6:4 C6 B5 A5 B5',
  'G5:3 E5 C5:2 E5 G5',
  'F#5:6 D#5 F#5',
];
const LEAD_B = [
  'E5:3 G5:3 C6:2',
  'B5:3 A5:3 F#5:2',
  'D5:3 F#5:3 B5:2',
  'G5:6 F#5 E5',
  'E5:3 G5:3 C6:2',
  'D6:3 C6:3 A5:2',
  'B5:4 A5:2 F#5:2',
  'D#5:4 F#5:2 B5:2',
];
const HARM_B = [
  'C5:3 E5:3 G5:2',
  'G5:3 F#5:3 D5:2',
  'B4:3 D5:3 F#5:2',
  'E5:6 D5 B4',
  'C5:3 E5:3 G5:2',
  'B5:3 A5:3 F#5:2',
  'F#5:4 F#5:2 D#5:2',
  'B4:4 D#5:2 F#5:2',
];
const REST = '. . . . . . . .';
const leadNotes = seq(
  [
    ...LEAD_A,
    ...LEAD_B,
    ...Array<string>(6).fill(REST),
    'B4:4 C#5:4',
    'D#5:8',
    REST,
    REST,
    REST,
    '. . . . B4 C5 D5 D#5',
  ].join(' '),
  { step: 0.5, v: 0.85 },
);
const lead = humanize(
  phrase(
    meter(
      dyn(leadNotes, (t) => (t < 8 * BAR ? 0.9 : 1)),
      0.6,
    ),
    8,
    0.14,
  ),
  74,
  0.006,
  0.05,
);
const harmony = humanize(
  phrase(seq(HARM_B.join(' '), { step: 0.5, start: 8 * BAR, v: 0.7 }), 8, 0.14),
  75,
  0.008,
  0.06,
);
/** Boss brass: a slow Phrygian line under the chugs. */
const BOSS = ['B3:4 C4:4', 'A3:4 G3:2 F3:2', 'E3:6 F3 G3', 'A3:4 C4:4', 'B3:8', 'C4:4 A3:4'];
const brass = humanize(seq(BOSS.join(' '), { step: 0.5, start: 16 * BAR, v: 0.8 }), 76, 0.008, 0.08);
const brassHigh = brass.map((n) => ({ ...n, n: n.n + 12, v: n.v * 0.75 }));
const strings = humanize(
  Array.from({ length: 8 }, (_, k) => 8 + k).flatMap((b) =>
    ({
      C: ['G4', 'C5', 'E5'],
      D: ['A4', 'D5', 'F#5'],
      Bm: ['B4', 'D5', 'F#5'],
      Em: ['B4', 'E5', 'G5'],
      B: ['B4', 'D#5', 'F#5'],
    })[CHORDS[b] as 'C'].map((name) => at(b, 0, BAR, midi(name) - 12, 0.6)),
  ),
  77,
  0.004,
  0.05,
);
const robot = humanize(
  arp(C.slice(0, 6), [0, 1, 2, 3, 2, 1, 2, 4], {
    octave: 4,
    step: 0.25,
    v: 0.55,
    gate: 0.5,
    start: 16 * BAR,
  }),
  78,
  0.003,
  0.1,
);

// ---------------------------------------------------------------- drums
const rock = (from: number, to: number) => ({
  k: loop(grid('x.....x.x.....x.', { start: from * BAR }), to - from, BAR),
  s: loop(grid('....x.......x...', { start: from * BAR }), to - from, BAR),
  h: loop(grid('x.o.x.o.x.o.x.o.', { start: from * BAR }), to - from, BAR),
});
const a = rock(0, 8);
const d = rock(24, 28);
const chorusKick = loop(grid('x.x.x.x.x.x.x.x.', { start: 8 * BAR }), 8, BAR);
const chorusSnare = loop(grid('....x.......x...', { start: 8 * BAR }), 8, BAR);
const bossKick = loop(grid('x.....x...x...x.', { start: 16 * BAR }), 6, BAR);
const bossSnare = loop(grid('........x.......', { start: 16 * BAR }), 6, BAR);
const volleys = [17, 19, 21]
  .flatMap((b) => grid('xoxoxxxx', { start: b * BAR + 2 }))
  .map((n) => ({ ...n, v: n.v * 0.7 }));
const build = dyn(
  [...grid('x.x.x.x.x.x.x.x.', { start: 22 * BAR }), ...grid('xxxxxxxxxxxxxxxx', { start: 23 * BAR })],
  ramp(22 * BAR, 24 * BAR, 0.35, 1),
);
const fills = [...grid('....xoxoxxxxxxxx', { start: 15 * BAR }).map((n) => ({ ...n, v: n.v * 0.85 }))];
const kicks = humanize(
  dyn(
    [
      ...a.k,
      ...chorusKick,
      ...bossKick,
      ...loop(grid('x...x...x...x...', { start: 22 * BAR }), 2, BAR),
      ...d.k,
    ],
    lift,
  ),
  81,
  0.003,
  0.06,
);
const snares = humanize(
  dyn(meter([...a.s, ...chorusSnare, ...bossSnare, ...volleys, ...build, ...fills, ...d.s], 0.3), lift),
  82,
  0.003,
  0.05,
);
const hats = humanize(
  [...a.h, ...loop(grid('x.o.x.o.x.o.x.o.', { start: 16 * BAR }), 6, BAR), ...d.h],
  83,
  0.004,
  0.08,
);
const rides = humanize(loop(grid('x.o.x.o.x.o.x.o.', { start: 8 * BAR }), 8, BAR), 84, 0.004, 0.08);
const tomFill = (bar: number, from: number, names: string[]) =>
  names.map((name, i) => ({
    t: bar * BAR + from + i * 0.25,
    d: 0.25,
    n: midi(name),
    v: 0.7 + (0.3 * i) / names.length,
  }));
const toms = humanize(
  [
    ...tomFill(7, 3, ['A3', 'A3', 'E3', 'E3']),
    ...tomFill(27, 2, ['A3', 'A3', 'E3', 'E3', 'B2', 'B2', 'G2', 'G2']),
    ...[18, 20].flatMap((b) => tomFill(b, 3, ['E3', 'B2', 'G2', 'G2'])),
  ],
  85,
  0.003,
  0.05,
);
const crashes: Note[] = [0, 8, 12, 16, 22, 24].map((b) => at(b, 0, 1, 0, b === 22 ? 0.75 : 0.95));
const rise: Note[] = [at(22, 0, 2 * BAR, 0, 0.8)];

export const song: Song = {
  id: 'johnny-upgrade-boss',
  title: "Johnny's Level: Boss",
  evokes: 'Johnny Upgrade (Gameshot): an original driving action-rock boss theme in the spirit of the game',
  bpm: 176,
  loopBeats: BARS * BAR,
  seed: 3,
  reverb: { room: 0.45, damp: 0.5, wet: 0.2 },
  tracks: [
    { inst: heroLead, gain: -4, pan: 0.04, verb: 0.25, loop: lead },
    { inst: heroLead, gain: -7, pan: 0.35, verb: 0.3, loop: harmony },
    { inst: powerChord(0), gain: -3, pan: -0.75, verb: 0.12, loop: gtrL },
    { inst: powerChord(1), gain: -3, pan: 0.75, verb: 0.12, loop: gtrR },
    { inst: pickBass, gain: -4, pan: 0, verb: 0.04, loop: bassLine },
    { inst: horn, gain: -6, pan: -0.25, verb: 0.35, loop: brass },
    { inst: horn, gain: -11, pan: 0.3, verb: 0.35, loop: brassHigh },
    { inst: 'strings', gain: -8, pan: -0.45, verb: 0.45, loop: strings },
    { inst: chipArp, gain: -7, pan: 0.5, verb: 0.25, loop: robot },
    { inst: kick, gain: -7, pan: 0, verb: 0.04, loop: kicks },
    { inst: snare, gain: -8, pan: 0.05, verb: 0.22, loop: snares },
    { inst: hat, gain: -1, pan: 0.35, verb: 0.08, loop: hats },
    { inst: ride, gain: -6, pan: -0.35, verb: 0.15, loop: rides },
    { inst: tom, gain: -9, pan: -0.2, verb: 0.2, loop: toms },
    { inst: crash, gain: -2, pan: 0.3, verb: 0.25, loop: crashes },
    { inst: riser, gain: -12, pan: 0, verb: 0.4, loop: rise },
  ],
};
