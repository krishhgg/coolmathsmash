/**
 * Writing music as data: note names, a tiny step-sequencer pattern language, chords and drum grids, and
 * phrasing helpers (accents, humanising, legato, portamento, harmony, fills). Times are in beats from the
 * start of the section, durations in beats.
 */
import { Rng } from '../dsp.ts';

export interface Note {
  /** Start, in beats. */
  t: number;
  /** Length, in beats. */
  d: number;
  /** MIDI note number (60 = middle C). Drums ignore it or use it as a variant. */
  n: number;
  /** Velocity 0..1. */
  v: number;
  /** Slide into this note from this many semitones away (portamento); unpitched instruments ignore it. */
  glide?: number;
}

const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "C4" -> 60, "F#3" -> 54, "Bb2" -> 46. */
export function midi(name: string): number {
  const m = /^([a-gA-G])([#b]*)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`bad note name "${name}"`);
  const acc = [...m[2]!].reduce((s, ch) => s + (ch === '#' ? 1 : -1), 0);
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]!.toLowerCase()]! + acc;
}

/**
 * A step sequence: space-separated tokens, one per step of `step` beats.
 * - `C5` a note; `C5:3` lasts 3 steps; `C5*0.6` velocity 0.6 (combine: `C5:2*0.7`)
 * - `[C4,E4,G4]` a chord on one step (also takes `:n` and `*v`)
 * - `-` holds the previous note one more step; `.` is a rest
 * - `~A5` slides into A5 from the previous note (portamento)
 * - `|` is ignored (use it to mark bars)
 */
export function seq(
  pattern: string,
  opts: { step?: number; start?: number; v?: number; transpose?: number } = {},
): Note[] {
  const step = opts.step ?? 0.5;
  const out: Note[] = [];
  let t = opts.start ?? 0;
  let last: Note[] = [];
  let prev: number | undefined;
  for (const tok of pattern.split(/\s+/).filter((x) => x && x !== '|')) {
    if (tok === '.') {
      last = [];
      t += step;
      continue;
    }
    if (tok === '-') {
      for (const n of last) n.d += step;
      t += step;
      continue;
    }
    const m = /^(~?)(\[[^\]]+\]|[^:*~]+)(?::([\d.]+))?(?:\*([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`bad token "${tok}"`);
    const names = m[2]!.startsWith('[') ? m[2]!.slice(1, -1).split(',') : [m[2]!];
    const len = Number(m[3] ?? 1);
    const v = Number(m[4] ?? opts.v ?? 0.8);
    last = names.map((name) => ({ t, d: len * step, n: midi(name) + (opts.transpose ?? 0), v }));
    if (m[1] && prev !== undefined) for (const n of last) n.glide = prev - n.n;
    prev = last.at(-1)!.n;
    out.push(...last);
    t += len * step;
  }
  return out;
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  '5': [0, 7, 12],
};

/** Chord symbol to MIDI notes rooted in `octave`: "Am", "F#m7", "Bbmaj7", "G/B" (slash bass goes below). */
export function chord(symbol: string, octave = 4): number[] {
  const [body, bass] = symbol.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(body!);
  if (!m) throw new Error(`bad chord "${symbol}"`);
  const q = QUALITY[m[2]!];
  if (!q) throw new Error(`unknown chord quality "${m[2]}" in ${symbol}`);
  const root = midi(`${m[1]}${octave}`);
  const notes = q.map((i) => root + i);
  if (bass) {
    let b = midi(`${bass}${octave}`);
    while (b >= notes[0]!) b -= 12;
    notes.unshift(b);
  }
  return notes;
}

/** The root of a chord symbol (or its slash bass) in `octave`. */
export function root(symbol: string, octave = 2): number {
  const [body, bass] = symbol.split('/');
  const name = bass ?? /^([A-G][#b]?)/.exec(body!)![1]!;
  return midi(`${name}${octave}`);
}

/**
 * A drum grid: one char per step. `x` full hit, `o` medium, `-` ghost note, anything else a rest.
 * Returns notes with n = `n` (use it to pick a drum variant).
 */
export function grid(pattern: string, opts: { step?: number; start?: number; n?: number } = {}): Note[] {
  const step = opts.step ?? 0.25;
  const vel: Record<string, number> = { x: 1, o: 0.65, '-': 0.35 };
  return [...pattern.replace(/[\s|]/g, '')].flatMap((ch, i) =>
    vel[ch] ? [{ t: (opts.start ?? 0) + i * step, d: step, n: opts.n ?? 0, v: vel[ch] }] : [],
  );
}

/** Repeat notes `times` times, `every` beats apart. */
export function loop(notes: Note[], times: number, every: number): Note[] {
  return Array.from({ length: times }, (_, k) => notes.map((n) => ({ ...n, t: n.t + k * every }))).flat();
}

/** Shift notes in time (beats) and pitch (semitones). */
export function shift(notes: Note[], beats: number, semis = 0): Note[] {
  return notes.map((n) => ({ ...n, t: n.t + beats, n: n.n + semis }));
}

/**
 * A chord's tones folded into the octave starting at MIDI note `low`, so a progression voice-leads in one
 * register instead of jumping with each root (a slash bass stays below).
 */
export function voice(symbol: string, low: number): number[] {
  const [body, bass] = symbol.split('/');
  const tones = [...new Set(chord(body!, 4).map((n) => low + ((((n - low) % 12) + 12) % 12)))].sort(
    (a, b) => a - b,
  );
  if (bass) {
    let b = midi(`${bass}4`);
    while (b >= tones[0]!) b -= 12;
    tones.unshift(b);
  }
  return tones;
}

/** One chord per bar (or per `beats`), voiced as held notes; `low` folds each into one octave (see voice). */
export function pads(
  symbols: string[],
  opts: { beats?: number; octave?: number; v?: number; start?: number; low?: number } = {},
): Note[] {
  const beats = opts.beats ?? 4;
  return symbols.flatMap((s, i) =>
    (opts.low === undefined ? chord(s, opts.octave ?? 4) : voice(s, opts.low)).map((n) => ({
      t: (opts.start ?? 0) + i * beats,
      d: beats,
      n,
      v: opts.v ?? 0.6,
    })),
  );
}

/** Arpeggiate each chord over its bar with a pattern of chord-tone indexes (e.g. [0,1,2,1]) at `step` beats. */
export function arp(
  symbols: string[],
  pattern: number[],
  opts: { beats?: number; step?: number; octave?: number; v?: number; start?: number; gate?: number } = {},
): Note[] {
  const beats = opts.beats ?? 4;
  const step = opts.step ?? 0.25;
  return symbols.flatMap((s, i) => {
    const tones = chord(s, opts.octave ?? 4);
    const ext = [...tones, ...tones.map((n) => n + 12), ...tones.map((n) => n + 24)];
    return Array.from({ length: Math.round(beats / step) }, (_, k) => ({
      t: (opts.start ?? 0) + i * beats + k * step,
      d: step * (opts.gate ?? 0.9),
      n: ext[pattern[k % pattern.length]! % ext.length]!,
      v: opts.v ?? 0.7,
    }));
  });
}

/** A bass line from chord roots: `rhythm` is a step pattern of offsets in semitones (or "." rests) per bar. */
export function bass(
  symbols: string[],
  rhythm: (number | '.')[],
  opts: { beats?: number; step?: number; octave?: number; v?: number; start?: number; gate?: number } = {},
): Note[] {
  const beats = opts.beats ?? 4;
  const step = opts.step ?? beats / rhythm.length;
  return symbols.flatMap((s, i) =>
    rhythm.flatMap((r, k) =>
      r === '.'
        ? []
        : [
            {
              t: (opts.start ?? 0) + i * beats + k * step,
              d: step * (opts.gate ?? 0.85),
              n: root(s, opts.octave ?? 2) + r,
              v: opts.v ?? 0.85,
            },
          ],
    ),
  );
}

// ---------------------------------------------------------------- phrasing

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const byTime = (notes: Note[]) => [...notes].sort((a, b) => a.t - b.t);

/**
 * Weight velocities by where each note falls in the bar: the downbeat strongest, then the other beats, the
 * offbeat eighths, then everything else, so grooves pulse instead of hitting flat.
 */
export function accent(
  notes: Note[],
  opts: { bar?: number; down?: number; beat?: number; half?: number; off?: number } = {},
): Note[] {
  const bar = opts.bar ?? 4;
  return notes.map((n) => {
    const pos = ((n.t % bar) + bar) % bar;
    const frac = pos % 1;
    const w = near(pos, 0)
      ? (opts.down ?? 1)
      : near(frac, 0) || near(frac, 1)
        ? (opts.beat ?? 0.88)
        : near(frac, 0.5)
          ? (opts.half ?? 0.74)
          : (opts.off ?? 0.6);
    return { ...n, v: Math.min(1, n.v * w) };
  });
}

/** Scale velocities along a line from `from` to `to` across the notes' time span: a crescendo or diminuendo. */
export function cresc(notes: Note[], from: number, to: number): Note[] {
  const t0 = Math.min(...notes.map((n) => n.t));
  const span = Math.max(...notes.map((n) => n.t)) - t0 || 1;
  return notes.map((n) => ({ ...n, v: Math.min(1, n.v * (from + ((to - from) * (n.t - t0)) / span)) }));
}

/** Seeded jitter of up to `time` beats and `vel` velocity, so parts stop sounding machine-quantised. */
export function humanize(notes: Note[], opts: { seed?: number; time?: number; vel?: number } = {}): Note[] {
  const rng = new Rng(opts.seed ?? 1);
  const time = opts.time ?? 0.01;
  const vel = opts.vel ?? 0.08;
  return notes.map((n) => ({
    ...n,
    t: n.t + rng.range(-time, time),
    v: Math.min(1, Math.max(0.05, n.v * (1 + rng.range(-vel, vel)))),
  }));
}

/** Shorten every note to `gate` of its length (staccato). */
export function staccato(notes: Note[], gate = 0.5): Note[] {
  return notes.map((n) => ({ ...n, d: n.d * gate }));
}

/**
 * Tie each note of a single line into the next one (plus `overlap` beats) when the gap between them is at
 * most `maxGap` beats, so phrases sing; longer rests stay rests.
 */
export function legato(notes: Note[], opts: { overlap?: number; maxGap?: number } = {}): Note[] {
  const out = byTime(notes).map((n) => ({ ...n }));
  out.forEach((n, i) => {
    const next = out.slice(i + 1).find((m) => m.t > n.t + 1e-6);
    if (next && next.t - (n.t + n.d) <= (opts.maxGap ?? 0.5)) n.d = next.t - n.t + (opts.overlap ?? 0.04);
  });
  return out;
}

/** Slide into every note of a line that leaps `minLeap` semitones or more from the note just before it. */
export function portamento(notes: Note[], minLeap = 5, maxGap = 0.5): Note[] {
  const out = byTime(notes).map((n) => ({ ...n }));
  out.forEach((n, i) => {
    const p = out[i - 1];
    if (p && Math.abs(n.n - p.n) >= minLeap && n.t - (p.t + p.d) <= maxGap && n.glide === undefined)
      n.glide = p.n - n.n;
  });
  return out;
}

/**
 * A quick grace note `semis` semitones from each note that leaps up `minLeap` or more, played `len` beats
 * before it (the note before is shortened to make room).
 */
export function graces(notes: Note[], opts: { minLeap?: number; semis?: number; len?: number } = {}): Note[] {
  const len = opts.len ?? 0.125;
  const out = byTime(notes).map((n) => ({ ...n }));
  const extra: Note[] = [];
  out.forEach((n, i) => {
    const p = out[i - 1];
    if (!p || n.n - p.n < (opts.minLeap ?? 4) || n.t - p.t <= len * 2) return;
    p.d = Math.min(p.d, n.t - len - p.t);
    extra.push({ t: n.t - len, d: len, n: n.n + (opts.semis ?? -2), v: n.v * 0.7 });
  });
  return byTime([...out, ...extra]);
}

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

/**
 * Harmonise a line in a key: each note moves `steps` degrees along the scale (-2 is a third below, -5 a sixth
 * below, 2 a third above); notes outside the scale keep their offset from the degree below them.
 */
export function harmony(
  notes: Note[],
  key: string,
  steps: number,
  scale: keyof typeof SCALES = 'major',
): Note[] {
  const deg = SCALES[scale];
  const tonic = midi(`${key}0`);
  return notes.map((note) => {
    const rel = note.n - tonic;
    const within = ((rel % 12) + 12) % 12;
    let i = deg.length - 1;
    while (deg[i]! > within) i--;
    const d = Math.floor(rel / 12) * 7 + i + steps;
    const oct = Math.floor(d / 7);
    return { ...note, n: tonic + oct * 12 + deg[d - oct * 7]! + (within - deg[i]!) };
  });
}

/** A drum roll from `start` for `beats`, one hit every `step`, velocity rising from `from` to `to`. */
export function roll(
  start: number,
  beats: number,
  opts: { step?: number; from?: number; to?: number; n?: number } = {},
): Note[] {
  const step = opts.step ?? 0.25;
  const count = Math.round(beats / step);
  return Array.from({ length: count }, (_, k) => ({
    t: start + k * step,
    d: step,
    n: opts.n ?? 0,
    v: (opts.from ?? 0.35) + (((opts.to ?? 1) - (opts.from ?? 0.35)) * k) / Math.max(1, count - 1),
  }));
}

/** One note `beats` long that ends exactly at `end`: for risers and reverse cymbals that land on a downbeat. */
export function swell(end: number, beats: number, v = 0.8): Note[] {
  return [{ t: end - beats, d: beats, n: 60, v }];
}
