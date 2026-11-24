/**
 * Render a Song (data: tempo, sections of notes per track) to a seamlessly looping stereo buffer.
 *
 * A song is an optional intro played once, then a loop body that repeats forever. Notes that ring past the
 * end of the loop wrap around onto its start (and notes before its start, like pickups, onto its end), and
 * every effect with memory (track filters, the widener, reverbs, delay, sidechain, bus compression and the
 * limiter) runs over two passes of the loop, so its tail does too and the seam is inaudible. The shipped file
 * is intro + body + the first second of the body again (so a decoder that shifts the start by its padding
 * still finds identical audio at both loop points).
 *
 * The mixer: each track has a level, pan, optional high-pass, low-pass and EQ bands, stereo width, sidechain
 * ducking from the kick, and sends to a hall reverb, a short room reverb and a tempo-synced ping-pong delay.
 * The master bus is either the original gentle compressor and soft ceiling, or (with `master`) glue
 * compression, loudness normalisation and a look-ahead limiter.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  Rng,
  SR,
  dbGain,
  filter,
  loudness,
  modDelay,
  reverb,
  samples,
  wav,
  type ReverbOptions,
} from '../dsp.ts';
import { INSTRUMENTS, type Instrument } from './instruments.ts';
import type { Note } from './notes.ts';

/** One EQ band. */
export interface EqBand {
  /** Default 'peak'. */
  type?: 'peak' | 'lowshelf' | 'highshelf';
  /** Centre (peak) or corner (shelf) frequency in Hz. */
  f: number;
  /** dB: positive boosts, negative cuts. */
  gain: number;
  /** Default 1 for a peak, 0.7 for a shelf. */
  q?: number;
}

/** A reverb bus: Freeverb settings plus filters on what is sent into it. */
export interface Bus extends ReverbOptions {
  /** High-pass on the send (Hz), so lows stay dry and centred. */
  hp?: number;
  /** Low-pass on the send (Hz), for a darker tail. */
  lp?: number;
}

/** The ping-pong delay that tracks' `echo` sends feed. */
export interface Echo {
  /** Delay time in beats (default 0.75, a dotted eighth). */
  beats?: number;
  /** 0..1 (default 0.35). */
  feedback?: number;
  /** Return level (default 0.5). */
  wet?: number;
  /** High-pass on the send, Hz (default 300). */
  hp?: number;
  /** Low-pass inside the feedback loop, so repeats darken, Hz (default 4000). */
  lp?: number;
}

/** Master bus: EQ, glue compression, the static gain to the song's loudness, then a look-ahead limiter. */
export interface Master {
  /** EQ bands on the whole mix, before the glue (default none): an air shelf, a low-mid cut. */
  eq?: EqBand[];
  /** Glue threshold in dB above the loop's RMS level (default 3), so only the loudest passages squeeze. */
  threshold?: number;
  /** Glue ratio (default 2). */
  ratio?: number;
  /** Limiter ceiling in dBFS (default -1.2). */
  ceiling?: number;
}

export interface Track {
  /** A key in INSTRUMENTS, or an instrument of the song's own. */
  inst: string | Instrument;
  /** Level in dB. */
  gain?: number;
  /** -1 left .. 1 right. */
  pan?: number;
  /** Hall reverb send 0..1 (default 0.2). */
  verb?: number;
  /** Notes of the loop body (beats from the loop start). */
  loop: Note[];
  /** Notes of the intro (beats from the song start). */
  intro?: Note[];
  /** Transpose every note (semitones). */
  transpose?: number;
  /** Room reverb send 0..1 (default 0): a short, tight space for drums next to the hall. */
  room?: number;
  /** Ping-pong delay send 0..1 (default 0). */
  echo?: number;
  /** High-pass corner in Hz (12 dB/octave), before the fader and sends (default none). */
  hp?: number;
  /** Low-pass corner in Hz (12 dB/octave) (default none). */
  lp?: number;
  /** EQ bands, after the filters (default none). */
  eq?: EqBand[];
  /** Stereo width 0..1 (default 0, mono): a mono-compatible widener that keeps everything below ~300 Hz centred. */
  width?: number;
  /** Sidechain: duck this track by up to this many dB on every key-track hit (default 0). */
  duck?: number;
  /** Whether this track's notes trigger the sidechain duck (default: tracks playing 'kick'). */
  key?: boolean;
}

export interface Song {
  id: string;
  title: string;
  /** What it evokes, for the credits list. */
  evokes: string;
  bpm: number;
  /** Intro length in beats (0 = none). */
  introBeats?: number;
  /** Loop body length in beats. */
  loopBeats: number;
  tracks: Track[];
  /** The hall reverb that `verb` sends feed. */
  reverb?: Bus;
  /** The room reverb that `room` sends feed (default: a small bright room, wet 0.4, send high-passed at 150 Hz). */
  room?: Bus;
  /** The delay that `echo` sends feed. */
  echo?: Echo;
  /** Seconds a ducked track takes to recover after each key hit (default 0.14). */
  duckRelease?: number;
  /** Master bus chain (default: the original gentle compressor and soft ceiling). */
  master?: Master;
  /** Integrated loudness target (LUFS); default -16. */
  lufs?: number;
  /** MP3 VBR quality, 0 best .. 9 smallest (default 6). */
  quality?: number;
  /** Random seed for noise and plucks. */
  seed?: number;
}

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  /** Loop region in seconds within the file. */
  loopStart: number;
  loopEnd: number;
}

/** Equal-power pan gains. */
const panGains = (pan: number) => {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)] as const;
};

const twice = (x: Float32Array) => {
  const y = new Float32Array(x.length * 2);
  y.set(x);
  y.set(x, x.length);
  return y;
};

/** Run `fn` as if `x` repeated forever when `wrap` (two passes, keeping the second), else once. */
const periodic = (x: Float32Array, wrap: boolean, fn: (x: Float32Array) => Float32Array) =>
  wrap ? fn(twice(x)).slice(x.length) : fn(x);

/** Index into a section, wrapping out-of-range positions around a loop; -1 when it falls outside an intro. */
const place = (j: number, len: number, wrap: boolean) =>
  j >= 0 && j < len ? j : wrap ? ((j % len) + len) % len : -1;

function renderNotes(
  notes: Note[],
  inst: string | Instrument,
  secPerBeat: number,
  transpose: number,
  rng: Rng,
  out: Float32Array,
  wrap: boolean,
): void {
  const fn = typeof inst === 'string' ? INSTRUMENTS[inst] : inst;
  if (!fn) throw new Error(`unknown instrument "${String(inst)}"`);
  for (const n of notes) {
    const f = 440 * 2 ** ((n.n + transpose - 69) / 12);
    const x = fn(f, n.d * secPerBeat, n.v, rng, n.glide ? { glide: n.glide } : undefined);
    const o = Math.round(n.t * secPerBeat * SR);
    for (let i = 0; i < x.length; i++) {
      const j = place(o + i, out.length, wrap);
      if (j >= 0) out[j]! += x[i]!;
    }
  }
}

/** Per-sample sidechain amount 0..1 from the key tracks' hits (velocity-scaled), or null when nothing ducks. */
function sidechain(song: Song, notesOf: (tr: Track) => Note[], len: number, wrap: boolean) {
  if (!song.tracks.some((tr) => tr.duck)) return null;
  const spb = 60 / song.bpm;
  const env = new Float32Array(len);
  const attack = samples(0.004);
  const release = (song.duckRelease ?? 0.14) * SR;
  const span = attack + Math.round(release * 5);
  for (const tr of song.tracks) {
    if (!(tr.key ?? tr.inst === 'kick')) continue;
    for (const n of notesOf(tr)) {
      const o = Math.round(n.t * spb * SR);
      for (let i = 0; i < span; i++) {
        const j = place(o + i, len, wrap);
        const a = n.v * (i < attack ? i / attack : Math.exp(-(i - attack) / release));
        if (j >= 0 && a > env[j]!) env[j] = a;
      }
    }
  }
  return env;
}

const equalize = (x: Float32Array, bands: EqBand[]) =>
  bands.reduce((y, b) => filter(y, b.type ?? 'peak', b.f, b.q ?? (b.type ? 0.7 : 1), b.gain), x);

/** A track's filters and EQ. */
function channel(x: Float32Array, tr: Track): Float32Array {
  let y = x;
  if (tr.hp) y = filter(y, 'highpass', tr.hp);
  if (tr.lp) y = filter(y, 'lowpass', tr.lp);
  return equalize(y, tr.eq ?? []);
}

/** The widener's side signal: a slowly modulated ~14 ms copy, high-passed so the lows stay mono. */
const side = (x: Float32Array) =>
  filter(
    modDelay(x, (t) => 0.014 + 0.0025 * Math.sin(2 * Math.PI * 0.31 * t)),
    'highpass',
    300,
  );

/** Dry stereo and mono sends (hall, room, delay) for one section, per track, already panned. */
function renderSection(song: Song, part: 'intro' | 'loop', len: number, wrap: boolean) {
  const spb = 60 / song.bpm;
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const hall = new Float32Array(len);
  const room = new Float32Array(len);
  const echo = new Float32Array(len);
  const notesOf = (tr: Track) => (part === 'loop' ? tr.loop : (tr.intro ?? []));
  const keys = sidechain(song, notesOf, len, wrap);
  song.tracks.forEach((tr, k) => {
    const notes = notesOf(tr);
    if (notes.length === 0) return;
    let mono: Float32Array = new Float32Array(len);
    renderNotes(
      notes,
      tr.inst,
      spb,
      tr.transpose ?? 0,
      new Rng((song.seed ?? 1) * 7919 + k * 104729 + (part === 'loop' ? 1 : 2)),
      mono,
      wrap,
    );
    if (tr.hp || tr.lp || tr.eq?.length) mono = periodic(mono, wrap, (x) => channel(x, tr));
    const s = tr.width ? periodic(mono, wrap, side) : null;
    const w = (tr.width ?? 0) * 0.7;
    const g = dbGain(tr.gain ?? 0);
    const [gl, gr] = panGains(tr.pan ?? 0);
    const sv = tr.verb ?? 0.2;
    const sr = tr.room ?? 0;
    const se = tr.echo ?? 0;
    for (let i = 0; i < len; i++) {
      const gi = tr.duck && keys ? g * dbGain(-tr.duck * keys[i]!) : g;
      const v = mono[i]! * gi;
      const d = s ? s[i]! * gi * w : 0;
      L[i]! += (v + d) * gl;
      R[i]! += (v - d) * gr;
      hall[i]! += v * sv;
      if (sr) room[i]! += v * sr;
      if (se) echo[i]! += v * se;
    }
  });
  return { L, R, hall, room, echo };
}

/** Ping-pong delay: left repeat after one delay, right after two, and so on, each darker. */
function pingPong(x: Float32Array, d: number, fb: number, lp: number): [Float32Array, Float32Array] {
  const L = new Float32Array(x.length);
  const R = new Float32Array(x.length);
  const a = 1 - Math.exp((-2 * Math.PI * lp) / SR);
  let sl = 0;
  let sr = 0;
  for (let i = d; i < x.length; i++) {
    sl += a * (x[i - d]! + fb * R[i - d]! - sl);
    sr += a * (fb * L[i - d]! - sr);
    L[i] = sl;
    R[i] = sr;
  }
  return [L, R];
}

/** The section's dry mix plus every effect return, twice as long when it loops (see renderSong). */
function mix(song: Song, sec: ReturnType<typeof renderSection>, wrap: boolean): [Float32Array, Float32Array] {
  const prep = (x: Float32Array) => (wrap ? twice(x) : x);
  const L = prep(sec.L);
  const R = prep(sec.R);
  const addReverb = (send: Float32Array, bus: Bus, wet: number) => {
    let x = prep(send);
    if (bus.hp) x = filter(x, 'highpass', bus.hp);
    if (bus.lp) x = filter(x, 'lowpass', bus.lp);
    const [vl, vr] = reverb(x, {
      room: bus.room,
      damp: bus.damp,
      width: bus.width,
      predelay: bus.predelay,
      wet: 1,
      dry: 0,
      tail: 0,
    });
    for (let i = 0; i < L.length; i++) {
      L[i]! += vl[i]! * wet;
      R[i]! += vr[i]! * wet;
    }
  };
  addReverb(sec.hall, { room: 0.6, damp: 0.5, ...song.reverb }, song.reverb?.wet ?? 0.35);
  if (song.tracks.some((tr) => tr.room)) {
    const room = { room: 0.12, damp: 0.55, width: 0.9, predelay: 0.003, hp: 150, ...song.room };
    addReverb(sec.room, room, song.room?.wet ?? 0.4);
  }
  if (song.tracks.some((tr) => tr.echo)) {
    const e = song.echo ?? {};
    const [el, er] = pingPong(
      filter(prep(sec.echo), 'highpass', e.hp ?? 300),
      samples(((e.beats ?? 0.75) * 60) / song.bpm),
      e.feedback ?? 0.35,
      e.lp ?? 4000,
    );
    const wet = e.wet ?? 0.5;
    for (let i = 0; i < L.length; i++) {
      L[i]! += el[i]! * wet;
      R[i]! += er[i]! * wet;
    }
  }
  return [L, R];
}

/** Gentle bus compressor (stereo-linked, feed-forward), then a soft-knee ceiling. */
function master(L: Float32Array, R: Float32Array, ceiling = 0.97): void {
  const thr = 0.5;
  const ratio = 3;
  const att = Math.exp(-1 / (0.01 * SR));
  const rel = Math.exp(-1 / (0.15 * SR));
  let envl = 0;
  for (let i = 0; i < L.length; i++) {
    const lvl = Math.max(Math.abs(L[i]!), Math.abs(R[i]!));
    envl = lvl > envl ? att * envl + (1 - att) * lvl : rel * envl + (1 - rel) * lvl;
    const g = envl > thr ? (thr + (envl - thr) / ratio) / envl : 1;
    L[i]! *= g;
    R[i]! *= g;
  }
  for (const ch of [L, R])
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i]!;
      ch[i] =
        Math.abs(v) < 0.8 * ceiling
          ? v
          : Math.sign(v) *
            (0.8 * ceiling + 0.2 * ceiling * Math.tanh((Math.abs(v) - 0.8 * ceiling) / (0.2 * ceiling)));
    }
}

const rmsOf = (L: Float32Array, R: Float32Array) => {
  let s = 0;
  for (let i = 0; i < L.length; i++) s += (L[i]! * L[i]! + R[i]! * R[i]!) / 2;
  return Math.sqrt(s / Math.max(1, L.length));
};

/** Glue compression: stereo-linked RMS detection, soft knee, slow attack and release, in place. */
function glue(L: Float32Array, R: Float32Array, threshold: number, ratio: number): void {
  const det = Math.exp(-1 / (0.005 * SR));
  const att = Math.exp(-1 / (0.025 * SR));
  const rel = Math.exp(-1 / (0.25 * SR));
  const thr = 20 * Math.log10(threshold);
  const knee = 6;
  const slope = 1 - 1 / ratio;
  let ms = 0;
  let level = -120;
  for (let i = 0; i < L.length; i++) {
    ms = det * ms + (1 - det) * ((L[i]! * L[i]! + R[i]! * R[i]!) / 2);
    const db = 10 * Math.log10(ms + 1e-12);
    level = db > level ? att * level + (1 - att) * db : rel * level + (1 - rel) * db;
    const over = level - thr;
    const gr =
      over <= -knee / 2 ? 0 : over >= knee / 2 ? over * slope : (slope * (over + knee / 2) ** 2) / (2 * knee);
    const g = dbGain(-gr);
    L[i]! *= g;
    R[i]! *= g;
  }
}

/**
 * Look-ahead limiter, in place: no sample leaves above `ceiling`. Gain drops ahead of each peak over 5 ms and
 * recovers over about 120 ms. A `circular` buffer is treated as a loop: it runs twice so the gain where it
 * ends leads into where it starts.
 */
function limit(L: Float32Array, R: Float32Array, ceiling: number, circular: boolean): void {
  const n = L.length;
  const look = samples(0.005);
  const rel = 1 - Math.exp(-1 / (0.12 * SR));
  const N = circular ? 2 * n : n;
  const target = (i: number) => {
    if (!circular && i >= n) return 1;
    const p = Math.max(Math.abs(L[i % n]!), Math.abs(R[i % n]!));
    return p > ceiling ? ceiling / p : 1;
  };
  const m = new Float32Array(N);
  const dq = new Int32Array(N + look + 1);
  const val = new Float32Array(N + look + 1);
  let head = 0;
  let tail = 0;
  for (let j = 0; j < N + look; j++) {
    const g = target(j);
    while (tail > head && val[tail - 1]! >= g) tail--;
    dq[tail] = j;
    val[tail++] = g;
    const i = j - look;
    if (i < 0) continue;
    while (dq[head]! < i) head++;
    m[i] = val[head]!;
  }
  let s = 1;
  for (let i = 0; i < N; i++) {
    s = Math.min(m[i]!, s + (1 - s) * rel);
    m[i] = s;
  }
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += m[i]!;
    if (i > look) acc -= m[i - look - 1]!;
    if (circular && i < n) continue;
    const g = acc / Math.min(i + 1, look + 1);
    L[i % n]! *= g;
    R[i % n]! *= g;
  }
}

/** The master chain on the intro: EQ, glue at the loop's threshold, the loop's static gain, then the limiter. */
function finish(L: Float32Array, R: Float32Array, m: Master, threshold: number, gain: number) {
  L.set(equalize(L, m.eq ?? []));
  R.set(equalize(R, m.eq ?? []));
  glue(L, R, threshold, m.ratio ?? 2);
  for (let i = 0; i < L.length; i++) {
    L[i]! *= gain;
    R[i]! *= gain;
  }
  limit(L, R, dbGain(m.ceiling ?? -1.2), false);
}

export function renderSong(song: Song): Rendered {
  const spb = 60 / song.bpm;
  const loopLen = samples(song.loopBeats * spb);
  const introLen = Math.round((song.introBeats ?? 0) * spb * SR);

  // The loop body: notes wrap around, and the effects and bus compressor run over two passes keeping the
  // second, so their state where the body ends matches where it starts.
  let [L2, R2] = mix(song, renderSection(song, 'loop', loopLen, true), true);
  let bodyL: Float32Array;
  let bodyR: Float32Array;
  let threshold = 0;
  let gain = 1;
  if (!song.master) {
    master(L2, R2);
    bodyL = L2.subarray(loopLen);
    bodyR = R2.subarray(loopLen);
  } else {
    // EQ and glue over both passes, then aim the static gain at the target loudness, measured after limiting.
    const m = song.master;
    L2 = equalize(L2, m.eq ?? []);
    R2 = equalize(R2, m.eq ?? []);
    threshold = rmsOf(L2.subarray(loopLen), R2.subarray(loopLen)) * dbGain(m.threshold ?? 3);
    glue(L2, R2, threshold, m.ratio ?? 2);
    const glued = [L2.slice(loopLen), R2.slice(loopLen)] as const;
    let db = (song.lufs ?? -16) - loudness(glued);
    for (let pass = 0; ; pass++) {
      bodyL = glued[0].slice();
      bodyR = glued[1].slice();
      gain = dbGain(db);
      for (let i = 0; i < loopLen; i++) {
        bodyL[i]! *= gain;
        bodyR[i]! *= gain;
      }
      limit(bodyL, bodyR, dbGain(m.ceiling ?? -1.2), true);
      const miss = (song.lufs ?? -16) - loudness([bodyL, bodyR]);
      if (pass === 2 || Math.abs(miss) < 0.05) break;
      db += miss;
    }
  }

  // The intro plays once, on its own; the body's first beats carry the loop's wrapped tails instead of its.
  let introL: Float32Array = new Float32Array(introLen);
  let introR: Float32Array = new Float32Array(introLen);
  if (introLen > 0) {
    [introL, introR] = mix(song, renderSection(song, 'intro', introLen, false), false);
    if (song.master) finish(introL, introR, song.master, threshold, gain);
    else master(introL, introR);
  }

  const guard = Math.min(loopLen, samples(1));
  const left = new Float32Array(introLen + loopLen + guard);
  const right = new Float32Array(introLen + loopLen + guard);
  left.set(introL);
  right.set(introR);
  left.set(bodyL, introLen);
  right.set(bodyR, introLen);
  left.set(bodyL.subarray(0, guard), introLen + loopLen);
  right.set(bodyR.subarray(0, guard), introLen + loopLen);
  return { left, right, loopStart: introLen / SR, loopEnd: (introLen + loopLen) / SR };
}

/** Measure with ffmpeg (stderr), returning integrated LUFS. */
export function measureLufs(path: string): number {
  const r = execFileSync(
    'sh',
    ['-c', `ffmpeg -hide_banner -nostats -i "${path}" -af ebur128=framelog=quiet -f null - 2>&1`],
    { encoding: 'utf8' },
  );
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(r.split('Summary:').pop() ?? '');
  if (!m) throw new Error('could not measure loudness');
  return Number(m[1]);
}

/** Static gain to reach `target` LUFS (static, so the loop seam is untouched), capped so peaks stay ≤ -1 dBFS. */
export function normalizeLoudness(
  r: Rendered,
  target: number,
  tmp: string,
): { lufs: number; gainDb: number } {
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, wav([r.left, r.right]));
  const lufs = measureLufs(tmp);
  rmSync(tmp);
  let peak = 0;
  for (const ch of [r.left, r.right]) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const want = target - lufs;
  const maxGain = 20 * Math.log10(0.89 / Math.max(peak, 1e-6));
  const gainDb = Math.min(want, maxGain);
  const g = 10 ** (gainDb / 20);
  for (const ch of [r.left, r.right]) for (let i = 0; i < ch.length; i++) ch[i]! *= g;
  return { lufs: lufs + gainDb, gainDb };
}
