import { arp, bass, grid, loop, pads, seq, shift, type Note } from '../notes.ts';
import type { Song } from '../render.ts';

/**
 * Main menu: a bright, heroic rock-orchestral theme in D major in the spirit of a Smash menu: driving drums,
 * octave bass, brass stabs, strings and a saw lead. Form A B A' C, 32 bars at 150 BPM.
 */
const A = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A'];
const B = ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'Bm', 'A'];
const C = ['Bb', 'C', 'D', 'D', 'Bb', 'C', 'Asus4', 'A'];
const chords = [...A, ...B, ...A, ...C];

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
  'C#5:4 E5:2 A5:2',
].join(' ');
const melodyC = [
  'F5:3 D5 F5:2 Bb5:2',
  'G5:3 E5 G5:2 C6:2',
  'A5:8',
  'A5:2 B5:2 C#6:2 D6:2',
  'D6:3 C6 Bb5:2 F5:2',
  'E6:3 D6 C6:2 G5:2',
  'D6:4 . . . .',
  'C#6:4 E5 F#5 G5 G#5',
].join(' ');
const lead = seq(
  [melodyA('A5:4 . A4 C#5 E5'), melodyB, melodyA('A5:2 G5 F#5 E5:2 C#5 A4'), melodyC].join(' '),
  { step: 0.5, v: 0.85 },
);

/** Brass stabs on 1, the "and" of 2, and 4: the dotted push of a fanfare. */
const stabs: Note[] = chords.flatMap((s, bar) =>
  [0, 1.5, 3].flatMap((b) => pads([s], { octave: 4, beats: 0.6, v: 0.75, start: bar * 4 + b })),
);
const strings = pads(chords, { octave: 4, v: 0.55 });
const low = bass(chords, [0, 0, 12, 0, 0, 12, 0, 12], { step: 0.5, octave: 2, v: 0.9 });
const sparkle = shift(
  arp([...B], [0, 1, 2, 3, 2, 1, 2, 3], { octave: 5, step: 0.25, v: 0.5, gate: 0.6 }),
  32,
);

const bar = 4;
const kick = loop(grid('x.......x.x.....'), 32, bar);
const snare = loop(grid('....x.......x...'), 32, bar);
const hats = loop(grid('x-o-x-o-x-o-x-ox'), 32, bar);
const fills = [7, 15, 23, 31].flatMap((b) => grid('....x.......xoxx', { start: b * bar }));
const crashes = [0, 8, 16, 24].map((b) => ({ t: b * bar, d: 1, n: 0, v: 0.9 }));
const timps = shift(grid('x...x...x.x.xxxx', { n: 50 }), 31 * bar).map((n) => ({ ...n, n: 38 }));

export const song: Song = {
  id: 'menu',
  title: 'Main Menu',
  evokes: 'a Smash Ultimate-style menu theme',
  bpm: 150,
  loopBeats: 32 * bar,
  seed: 11,
  reverb: { room: 0.55, wet: 0.3 },
  tracks: [
    { inst: 'sawLead', gain: -5, pan: 0, verb: 0.25, loop: lead },
    { inst: 'brass', gain: -9, pan: -0.25, verb: 0.3, loop: stabs },
    { inst: 'strings', gain: -10, pan: 0.3, verb: 0.45, loop: strings },
    { inst: 'synthBass', gain: -5, pan: 0, verb: 0.05, loop: low },
    { inst: 'glock', gain: -14, pan: 0.4, verb: 0.4, loop: sparkle },
    { inst: 'kick', gain: -3, pan: 0, verb: 0.05, loop: kick },
    { inst: 'snare', gain: -7, pan: 0.05, verb: 0.25, loop: [...snare, ...fills] },
    { inst: 'hat', gain: -12, pan: 0.2, verb: 0.1, loop: hats },
    { inst: 'crash', gain: -10, pan: -0.2, verb: 0.3, loop: crashes },
    { inst: 'timpani', gain: -8, pan: 0, verb: 0.4, loop: timps },
  ],
};
