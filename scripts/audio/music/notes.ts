/**
 * Writing music as data: note names, a tiny step-sequencer pattern language, chords and drum grids. Times
 * are in beats from the start of the section, durations in beats.
 */

export interface Note {
  /** Start, in beats. */
  t: number;
  /** Length, in beats. */
  d: number;
  /** MIDI note number (60 = middle C). Drums ignore it or use it as a variant. */
  n: number;
  /** Velocity 0..1. */
  v: number;
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
    const m = /^(\[[^\]]+\]|[^:*]+)(?::([\d.]+))?(?:\*([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`bad token "${tok}"`);
    const names = m[1]!.startsWith('[') ? m[1]!.slice(1, -1).split(',') : [m[1]!];
    const len = Number(m[2] ?? 1);
    const v = Number(m[3] ?? opts.v ?? 0.8);
    last = names.map((name) => ({ t, d: len * step, n: midi(name) + (opts.transpose ?? 0), v }));
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

/** One chord per bar (or per `beats`), voiced as held notes. */
export function pads(
  symbols: string[],
  opts: { beats?: number; octave?: number; v?: number; start?: number } = {},
): Note[] {
  const beats = opts.beats ?? 4;
  return symbols.flatMap((s, i) =>
    chord(s, opts.octave ?? 4).map((n) => ({
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
