import { midi, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';
import {
  accents,
  airPad,
  arc,
  clap,
  crash,
  echoes,
  glass,
  hat,
  human,
  kick,
  openHat,
  phrase,
  pluckSynth,
  pumpPad,
  ramp,
  ride,
  riser,
  roundBass,
  shaker,
  snare,
  softLead,
  sub,
  superSaw,
  swell,
} from '../kits/atmos.ts';

/**
 * Run Tunnel: an original stage theme in the spirit of Run and Run 3's spacey ambient electronica. D major /
 * B minor at 128 BPM over a four-on-the-floor pulse: a sixteenth-note pluck arpeggio with a dotted-eighth
 * echo, pumping pads, an off-beat bass and starfield bells. Form A (bars 1-8, the soft-lead theme), B (9-16,
 * a climbing E-F#-G-A bass under a supersaw melody), and a breakdown (17-20) that filters the beat away
 * and builds back into the top.
 */
const BAR = 4;
const at = (bar: number) => bar * BAR;

/** A chord: its pad voicing, its arpeggio tones (low to high) and its bass root. */
interface Chord {
  pad: string[];
  arp: string[];
  bass: string;
}
const C = (pad: string, arp: string, bass: string): Chord => ({
  pad: pad.split(' '),
  arp: arp.split(' '),
  bass,
});
const Dmaj9 = C('A3 C#4 E4 F#4', 'D4 F#4 A4 C#5 E5', 'D2');
const Bm11 = C('A3 D4 E4 F#4', 'B3 D4 F#4 A4 E5', 'B1');
const Gmaj7s11 = C('B3 D4 F#4 C#5', 'G3 B3 D4 F#4 C#5', 'G1');
const Em9 = C('G3 B3 D4 F#4', 'E4 G4 B4 D5 F#5', 'E2');
const Fs7sus = C('B3 C#4 E4', 'F#3 B3 C#4 E4 B4', 'F#1');
const Fs7 = C('A#3 C#4 E4', 'F#3 A#3 C#4 E4 A#4', 'F#1');
const Fsm9 = C('A3 C#4 E4 G#4', 'F#4 A4 C#5 E5 A5', 'F#2');
const Gmaj9 = C('B3 D4 F#4 A4', 'G4 B4 D5 F#5 A5', 'G1');
const A6 = C('A3 C#4 E4 F#4', 'A4 C#5 E5 F#5 A5', 'A1');
const G6 = C('B3 D4 E4 G4', 'G4 B4 D5 E5 G5', 'G1');
const Amaj = C('A3 C#4 E4', 'A4 C#5 E5 A5 C#6', 'A1');
const Bm9 = C('A3 D4 F#4 C#5', 'B3 D4 F#4 A4 C#5', 'B1');

/** Half-bar slots, two per bar. */
const A = [
  Dmaj9,
  Dmaj9,
  Dmaj9,
  Dmaj9,
  Bm11,
  Bm11,
  Bm11,
  Bm11,
  Gmaj7s11,
  Gmaj7s11,
  Gmaj7s11,
  Gmaj7s11,
  Em9,
  Em9,
  Fs7sus,
  Fs7,
];
const B = [Em9, Em9, Fsm9, Fsm9, Gmaj9, Gmaj9, A6, A6, Em9, Em9, Fsm9, Fsm9, G6, G6, Amaj, Amaj];
const D = [Bm9, Bm9, Gmaj9, Gmaj9, Em9, Em9, Fs7sus, Fs7];
const slots = [...A, ...B, ...D];

/** Run `fn` for every half-bar slot from `from` to `to` (bars), returning its notes. */
const each = (from: number, to: number, fn: (c: Chord, t: number) => Note[]) =>
  slots.slice(from * 2, to * 2).flatMap((c, i) => fn(c, at(from) + i * 2));

// ---------------------------------------------------------------- arpeggio, pads and bass

const ARP = [0, 2, 3, 4, 2, 3, 1, 3];
const arpeggio = (from: number, to: number, v: number) =>
  each(from, to, (c, t) =>
    ARP.map((k, i) => ({
      t: t + i * 0.25,
      d: 0.2,
      n: midi(c.arp[k]!),
      v: v * (i % 4 === 0 ? 1 : i % 2 ? 0.72 : 0.85),
    })),
  );
const arps = human(
  [
    ...arpeggio(0, 8, 0.7),
    ...arpeggio(8, 16, 0.85),
    ...arc(arpeggio(16, 20, 0.85), ramp(at(16), at(20), 0.35, 0.95)),
  ],
  31,
  0.05,
  0.004,
);

/** Pads re-struck on every beat with a fast swell: the pumping of a side-chained pad. */
const pump = (from: number, to: number, v: number) =>
  each(from, to, (c, t) =>
    [0, 1].flatMap((b) => c.pad.map((name) => ({ t: t + b, d: 0.95, n: midi(name), v }))),
  );
const pumping = arc([...pump(0, 8, 0.55), ...pump(8, 16, 0.65)], phrase(16, 0.2));
const breakPad = each(16, 20, (c, t) => c.pad.map((name) => ({ t, d: 2, n: midi(name), v: 0.6 })));

const offbeats = (from: number, to: number, v: number) =>
  each(from, to, (c, t) => [0.5, 1.5].map((b) => ({ t: t + b, d: 0.4, n: midi(c.bass), v })));
const downs = (from: number, to: number, v: number) =>
  each(from, to, (c, t) => [{ t, d: 0.4, n: midi(c.bass), v }]);
const lows = human(
  [...offbeats(0, 16, 0.85), ...downs(0, 16, 0.45), ...offbeats(18, 20, 0.7)],
  32,
  0.04,
  0.003,
);

// ---------------------------------------------------------------- melodies

const themeA = [
  'F#5:6 E5:2 A5:8',
  'E5:4 F#5:4 C#6:6 B5:2',
  'B5:6 A5:2 F#5:8',
  'E5:4 D5:4 E5:6 F#5:2',
  'C#6:6 B5:2 F#5:8',
  'A5:4 B5:4 D6:6 C#6:2',
  'B5:6 A5:2 G5:4 F#5:4',
  'E5:8 C#5:4 D5:2 E5:2',
];
const themeB = [
  'G5:2 B5:2 E6:4 D6:2 B5:2 A5:4',
  'A5:2 C#6:2 F#6:4 E6:2 C#6:2 B5:4',
  'B5:2 D6:2 F#6:6 E6:2 D6:4',
  'C#6:8 E6:4 C#6:2 A5:2',
  'G5:2 B5:2 E6:4 D6:2 B5:2 A5:4',
  'A5:2 C#6:2 F#6:4 E6:2 C#6:2 B5:4',
  'B5:2 D6:2 G6:6 F#6:2 E6:4',
  'E6:8 D6:2 C#6:2 B5:2 A5:2',
];
const leadA = arc(seq(themeA.join(' '), { step: 0.25, v: 0.78 }), phrase(8, 0.2));
const leadB = arc(seq(themeB.join(' '), { step: 0.25, start: at(8), v: 0.8 }), phrase(8, 0.2));
const bellMotif = seq('F#6:6 E6:2 A6:8 . . . . . . . . . . . . . . . . E6:4 F#6:4 C#7:6 B6:2', {
  step: 0.25,
  start: at(16),
  v: 0.55,
});

/** Starfield: sparse high bells on a fixed scatter of sixteenths. */
const STARS = [3, 11, 22, 29, 38, 45, 54, 59];
const SCALE = ['F#6', 'A6', 'B6', 'C#7', 'E7', 'F#7'];
const stars = Array.from({ length: 20 }, (_, bar) =>
  STARS.filter((_, i) => (i + bar) % 3 !== 0).map((k, i) => ({
    t: at(bar) + (k % 16) * 0.25,
    d: 0.25,
    n: midi(SCALE[(bar * 2 + i * 3) % SCALE.length]!),
    v: 0.25 + 0.15 * ((bar + i) % 3),
  })),
).flat();

// ---------------------------------------------------------------- drums

const bars = (pattern: string, from: number, count: number) =>
  Array.from({ length: count }, (_, k) =>
    [...pattern].flatMap((ch, i) => {
      const v = { x: 1, o: 0.65, '-': 0.35 }[ch];
      return v ? [{ t: at(from + k) + i * 0.25, d: 0.25, n: 0, v }] : [];
    }),
  ).flat();

const kicks = [...bars('x...x...x...x...', 0, 16), ...bars('x...x...x...x...', 18, 2)];
const claps = [...bars('....x.......x...', 0, 16), ...bars('....x.......x...', 19, 1)];
const roll = arc(bars('x.x.x.x.xxxxxxxx', 19, 1), ramp(at(19), at(20), 0.3, 0.9));
const hats = accents(
  [...bars('..x...x...x...x.', 0, 8), ...bars('x-x-x-x-x-x-x-xo', 8, 8), ...bars('..x...x...x...x.', 16, 4)],
  [0.7, 0.5, 1, 0.5],
  0.25,
  1,
);
const opens = bars('..x...x...x...x.', 8, 8);
const rides = bars('x.o.x.o.x.o.x.o.', 12, 4);
const shakes = accents(bars('xxxxxxxxxxxxxxxx', 0, 20), [0.35, 0.25, 0.7, 0.3], 0.25, 1);
const crashes = [
  { t: 0, d: 1, n: 0, v: 1 },
  { t: at(8), d: 1, n: 0, v: 0.85 },
  { t: at(16), d: 1, n: 0, v: 0.6 },
];

export const song: Song = {
  id: 'run-tunnel',
  title: 'Run Tunnel',
  evokes: "an original theme in the spirit of Run and Run 3's spacey electronica",
  bpm: 128,
  loopBeats: 20 * BAR,
  seed: 33,
  reverb: { room: 0.8, damp: 0.35, wet: 0.4 },
  tracks: [
    { inst: softLead, gain: -6, pan: 0.05, verb: 0.3, loop: human(leadA, 34, 0.05, 0.006) },
    { inst: softLead, gain: -17, pan: -0.6, verb: 0.5, loop: echoes(leadA, 0.75, 3, 0.5) },
    { inst: superSaw, gain: 3, pan: -0.05, verb: 0.3, loop: human(leadB, 35, 0.05, 0.006) },
    { inst: superSaw, gain: -9, pan: 0.6, verb: 0.5, loop: echoes(leadB, 0.75, 3, 0.5) },
    { inst: glass, gain: -14, pan: 0.35, verb: 0.45, loop: shift(themeAHigh(leadA), 0) },
    { inst: glass, gain: -8, pan: 0.2, verb: 0.55, loop: bellMotif },
    { inst: glass, gain: -16, pan: -0.5, verb: 0.6, loop: stars },
    { inst: pluckSynth, gain: -8, pan: -0.3, verb: 0.25, loop: arps },
    { inst: pluckSynth, gain: -15, pan: 0.5, verb: 0.4, loop: echoes(arps, 0.75, 1, 0.6) },
    { inst: pumpPad, gain: -9, pan: -0.5, verb: 0.35, loop: pumping },
    {
      inst: pumpPad,
      gain: -9,
      pan: 0.5,
      verb: 0.35,
      loop: shift(pumping, 0.01, 12).map((n) => ({ ...n, v: n.v * 0.6 })),
    },
    { inst: airPad, gain: -6, pan: 0, verb: 0.5, loop: breakPad },
    { inst: sub, gain: -12, pan: 0, verb: 0, loop: lows },
    { inst: roundBass, gain: -14, pan: 0, verb: 0.05, loop: shift(lows, 0, 12) },
    { inst: kick, gain: -13, pan: 0, verb: 0.05, loop: human(kicks, 36, 0.04, 0) },
    { inst: clap, gain: 2, pan: 0.08, verb: 0.3, loop: human(claps, 37, 0.06, 0.004) },
    { inst: snare, gain: -9, pan: -0.05, verb: 0.3, loop: roll },
    { inst: hat, gain: 1, pan: 0.35, verb: 0.1, loop: human(hats, 38, 0.08, 0.004) },
    { inst: openHat, gain: -5, pan: -0.3, verb: 0.15, loop: human(opens, 39, 0.08, 0.004) },
    { inst: ride, gain: -3, pan: -0.45, verb: 0.2, loop: human(rides, 40, 0.08, 0.004) },
    { inst: shaker, gain: -6, pan: 0.6, verb: 0.15, loop: human(shakes, 41, 0.1, 0.006) },
    { inst: crash, gain: -4, pan: -0.35, verb: 0.35, loop: crashes },
    { inst: swell, gain: -3, pan: 0.35, verb: 0.35, loop: [{ t: at(19), d: 4, n: 0, v: 0.8 }] },
    { inst: riser, gain: -8, pan: 0, verb: 0.4, loop: [{ t: at(16), d: 16, n: 0, v: 0.7 }] },
  ],
};

/** The theme an octave up from bar 5, a ghostly glass double. */
function themeAHigh(lead: Note[]): Note[] {
  return shift(
    lead.filter((n) => n.t >= at(4)),
    0,
    12,
  ).map((n) => ({ ...n, v: n.v * 0.7 }));
}
