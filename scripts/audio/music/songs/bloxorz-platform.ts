import { midi, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';
import {
  accents,
  airPad,
  arc,
  block,
  crash,
  glass,
  hat,
  human,
  kick,
  openHat,
  phrase,
  ramp,
  rim,
  roundBass,
  shaker,
  snare,
  sub,
  swell,
  vibes,
} from '../kits/atmos.ts';

/**
 * Bloxorz Board: an original stage theme in the spirit of Bloxorz's calm, cerebral puzzle music. G Dorian
 * with quartal (stacked-fourth) voicings at 126 BPM: a glass ostinato in threes that turns against the 4/4
 * beat like a block tipping end over end, vibraphone comping, a round syncopated bass and a dry, swung
 * kit. Form A (bars 1-8, the glass-bell theme), B (9-16, a Lydian lift with a lyrical vibes melody over a
 * warm pad), and C (17-20, the board collapsing: a falling glass cascade and a fill back to the top).
 */
const BAR = 4;
const at = (bar: number) => bar * BAR;

interface Chord {
  voicing: number[];
  root: number;
}
const C = (voicing: string, bass: string): Chord => ({
  voicing: voicing.split(' ').map(midi),
  root: midi(bass),
});
const Gm11 = C('F3 Bb3 C4 F4 A4', 'G1');
const Ebmaj9 = C('G3 D4 F4 A4 D5', 'Eb2');
const C13 = C('Bb3 E4 A4 D5', 'C2');
const D7sus = C('C4 G4 A4 D5', 'D2');
const D7b9 = C('C4 F#4 A4 Eb5', 'D2');
const Eblyd = C('G3 Bb3 D4 A4', 'Eb2');
const F69 = C('A3 D4 G4 C5', 'F1');
const Dm9 = C('F3 A3 C4 E4', 'D2');
const Gm9 = C('F3 A3 Bb3 D4', 'G1');
const Am7b5 = C('G3 C4 Eb4 A4', 'A1');

/** One chord per bar. */
const A = [Gm11, Gm11, Ebmaj9, Ebmaj9, C13, C13, D7sus, D7b9];
const B = [Eblyd, F69, Dm9, Gm9, Eblyd, F69, Am7b5, D7b9];
const Cc = [Gm11, Ebmaj9, C13, D7sus];
const bars = [...A, ...B, ...Cc];

// ---------------------------------------------------------------- glass ostinato in threes

/** Eighth notes cycling through three chord tones; the cycle restarts whenever the chord changes. */
const threes = (from: number, to: number, cell: number[], v: number): Note[] => {
  const out: Note[] = [];
  let e = 0;
  for (let bar = from; bar < to; bar++) {
    if (bar > from && bars[bar] !== bars[bar - 1]) e = 0;
    const tones = bars[bar]!.voicing;
    for (let k = 0; k < 8; k++, e++) {
      out.push({
        t: at(bar) + k * 0.5,
        d: 0.45,
        n: tones[cell[e % 3]! % tones.length]! + 12,
        v: e % 3 === 0 ? v : v * 0.68,
      });
    }
  }
  return out;
};
const ostinato = human(
  [
    ...arc(threes(0, 8, [0, 2, 3], 0.7), phrase(8, 0.2)),
    ...threes(8, 16, [1, 3, 2], 0.6),
    ...arc(threes(16, 20, [0, 2, 3], 0.75), ramp(at(16), at(20), 0.8, 1.1)),
  ],
  51,
  0.06,
  0.006,
);

/** Falling glass in C: the tiles dropping away, one sixteenth at a time. */
const cascade = Cc.flatMap((c, i) =>
  [...c.voicing, ...c.voicing.map((n) => n + 12)]
    .sort((a, b) => b - a)
    .flatMap((n, k) => [{ t: at(16 + i) + 2 + k * 0.25, d: 0.25, n: n + 12, v: 0.55 - k * 0.04 }]),
);

// ---------------------------------------------------------------- vibes comping, pad, bass

const comp = (from: number, to: number, v: number) =>
  bars.slice(from, to).flatMap((c, i) =>
    [
      [0, 1.4, 1],
      [1.5, 0.4, 0.7],
      [3.5, 0.45, 0.6],
    ].flatMap(([b, d, a]) => c.voicing.map((n) => ({ t: at(from + i) + b!, d: d!, n, v: v * a! }))),
  );
const vibesComp = human([...comp(0, 8, 0.5), ...comp(16, 20, 0.55)], 52, 0.06, 0.008);
const pad = B.flatMap((c, i) => c.voicing.map((n) => ({ t: at(8 + i), d: BAR, n, v: 0.55 })));

const GROOVE = [
  [0, 2, 0, 1],
  [3, 1, 0, 0.55],
  [6, 2, 12, 0.8],
  [10, 2, 0, 0.9],
  [13, 1, 7, 0.65],
  [14, 2, 10, 0.75],
] as const;
const groove = bars.flatMap((c, bar) =>
  GROOVE.map(([k, len, off, a]) => ({
    t: at(bar) + k * 0.25,
    d: len * 0.25 * 0.85,
    n: c.root + 12 + off,
    v: 0.85 * a,
  })),
);
const bassLine = human(groove, 53, 0.05, 0.004);
const subs = bars.flatMap((c, bar) => [
  { t: at(bar), d: 1.4, n: c.root, v: 0.8 },
  { t: at(bar) + 2.5, d: 1, n: c.root, v: 0.65 },
]);

// ---------------------------------------------------------------- melodies

const themeA = [
  'D5:4 G5:4 C6:6 Bb5:2',
  'A5:4 F5:4 G5:8',
  'D5:4 G5:4 A5:6 G5:2',
  'F5:4 D5:4 Bb4:8',
  'E5:4 A5:4 D6:6 C6:2',
  'Bb5:4 G5:4 A5:8',
  'G5:4 A5:4 C6:4 D6:4',
  'C6:6 A5:2 F#5:4 D5:4',
];
const themeB = [
  'Bb5:6 A5:2 G5:8',
  'A5:6 G5:2 F5:4 D5:4',
  'E5:6 F5:2 A5:8',
  'G5:4 F5:4 D5:8',
  'Bb5:6 A5:2 D6:8',
  'C6:6 Bb5:2 A5:4 G5:4',
  'C6:6 Bb5:2 G5:4 Eb5:4',
  'F#5:6 G5:2 A5:4 C6:4',
];
const bells = arc(seq(themeA.join(' '), { step: 0.25, v: 0.8 }), phrase(8, 0.2));
const vibesLead = arc(seq(themeB.join(' '), { step: 0.25, start: at(8), v: 0.8 }), phrase(8, 0.25));

// ---------------------------------------------------------------- drums

const grid16 = (pattern: string, from: number, count: number, n = 0) =>
  Array.from({ length: count }, (_, k) =>
    [...pattern].flatMap((ch, i) => {
      const v = { x: 1, o: 0.65, '-': 0.35 }[ch];
      return v ? [{ t: at(from + k) + i * 0.25, d: 0.25, n, v }] : [];
    }),
  ).flat();
/** Push every off-sixteenth late for a light swing. */
const swing = (notes: Note[], amount: number) =>
  notes.map((n) => (Math.round(n.t / 0.25) % 2 ? { ...n, t: n.t + amount } : n));

const kicks = [
  ...grid16('x.....x...x.....', 0, 8),
  ...grid16('x.....x...x..o..', 8, 8),
  ...grid16('x.....x...x.....', 16, 2),
  ...grid16('x.x...x.x.x.x...', 18, 1),
  ...grid16('x...x...x.x.x.x.', 19, 1),
];
const rims = [...grid16('....x.......x..-', 0, 8), ...grid16('....x.......x...', 16, 2)];
const snares = [
  ...grid16('....x.......x...', 8, 8),
  ...arc(grid16('..x...x.xxxxxxxx', 18, 2), ramp(at(18), at(20), 0.35, 1)),
];
const hats = swing(
  accents(
    [...grid16('xxxxxxxxxxxxxxxx', 0, 16), ...grid16('x.x.x.x.x.x.x.x.', 16, 2)],
    [1, 0.4, 0.7, 0.45],
    0.25,
    1,
  ),
  0.05,
);
const opens = grid16('..............x.', 8, 8);
const shakes = swing(accents(grid16('xxxxxxxxxxxxxxxx', 0, 20), [0.3, 0.25, 0.6, 0.3], 0.25, 1), 0.05);
const ticks = [
  ...grid16('............x...', 1, 1, 96),
  ...grid16('............x.x.', 3, 1, 96),
  ...grid16('............x...', 5, 1, 96),
  ...grid16('............x.xx', 7, 1, 96),
];

export const song: Song = {
  id: 'bloxorz-platform',
  title: 'Bloxorz Board',
  evokes: "an original theme in the spirit of Bloxorz's calm, cerebral puzzle music",
  bpm: 126,
  loopBeats: 20 * BAR,
  seed: 51,
  reverb: { room: 0.68, damp: 0.4, wet: 0.36 },
  tracks: [
    { inst: glass, gain: -2, pan: 0.1, verb: 0.35, loop: human(bells, 54, 0.05, 0.006) },
    {
      inst: glass,
      gain: -14,
      pan: -0.55,
      verb: 0.5,
      loop: shift(bells, 0.75).map((n) => ({ ...n, v: n.v * 0.5 })),
    },
    { inst: vibes, gain: -2, pan: -0.1, verb: 0.35, loop: human(vibesLead, 55, 0.05, 0.008) },
    { inst: glass, gain: -12, pan: -0.4, verb: 0.3, loop: ostinato },
    { inst: glass, gain: -11, pan: 0.5, verb: 0.55, loop: cascade },
    { inst: vibes, gain: -10, pan: 0.4, verb: 0.3, loop: vibesComp },
    { inst: airPad, gain: -7, pan: -0.45, verb: 0.45, loop: pad },
    { inst: airPad, gain: -7, pan: 0.45, verb: 0.45, loop: shift(pad, 0.02) },
    { inst: roundBass, gain: -6, pan: 0, verb: 0.05, loop: bassLine },
    { inst: sub, gain: -13, pan: 0, verb: 0, loop: subs },
    { inst: kick, gain: -10, pan: 0, verb: 0.05, loop: human(kicks, 56, 0.05, 0) },
    { inst: rim, gain: 3, pan: 0.15, verb: 0.25, loop: human(rims, 57, 0.08, 0.004) },
    { inst: snare, gain: -8, pan: 0.05, verb: 0.25, loop: human(snares, 58, 0.06, 0.004) },
    { inst: hat, gain: 4, pan: 0.4, verb: 0.08, loop: human(hats, 59, 0.08, 0.004) },
    { inst: openHat, gain: -1, pan: 0.3, verb: 0.15, loop: opens },
    { inst: shaker, gain: -6, pan: -0.5, verb: 0.15, loop: human(shakes, 60, 0.1, 0.006) },
    { inst: block, gain: -6, pan: 0.65, verb: 0.35, loop: ticks },
    {
      inst: crash,
      gain: -1,
      pan: -0.35,
      verb: 0.35,
      loop: [
        { t: 0, d: 1, n: 0, v: 0.9 },
        { t: at(8), d: 1, n: 0, v: 0.75 },
      ],
    },
    { inst: swell, gain: -4, pan: 0.3, verb: 0.35, loop: [{ t: at(19) + 2, d: 2, n: 0, v: 0.8 }] },
  ],
};
