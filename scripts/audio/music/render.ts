/**
 * Render a Song (data: tempo, sections of notes per track) to a seamlessly looping stereo buffer.
 *
 * A song is an optional intro played once, then a loop body that repeats forever. Notes that ring past the
 * end of the loop wrap around onto its start, and the reverb runs over two passes of the loop so its tail
 * does too, so the seam is inaudible. The shipped file is intro + body + the first second of the body again
 * (so a decoder that shifts the start by its padding still finds identical audio at both loop points).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Rng, SR, reverb, samples, wav, type ReverbOptions } from '../dsp.ts';
import { INSTRUMENTS, type Instrument } from './instruments.ts';
import type { Note } from './notes.ts';

export interface Track {
  /** A key in INSTRUMENTS, or an instrument of the song's own. */
  inst: string | Instrument;
  /** Level in dB. */
  gain?: number;
  /** -1 left .. 1 right. */
  pan?: number;
  /** Reverb send 0..1. */
  verb?: number;
  /** Notes of the loop body (beats from the loop start). */
  loop: Note[];
  /** Notes of the intro (beats from the song start). */
  intro?: Note[];
  /** Transpose every note (semitones). */
  transpose?: number;
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
  reverb?: ReverbOptions;
  /** Integrated loudness target (LUFS); default -16. */
  lufs?: number;
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
    const x = fn(f, n.d * secPerBeat, n.v, rng);
    const o = Math.round(n.t * secPerBeat * SR);
    for (let i = 0; i < x.length; i++) {
      const j = o + i;
      if (j < out.length) out[j]! += x[i]!;
      else if (wrap) out[j % out.length]! += x[i]!;
    }
  }
}

/** Mono dry + send buses for one section, per track, already panned into stereo. */
function renderSection(song: Song, part: 'intro' | 'loop', len: number, wrap: boolean) {
  const spb = 60 / song.bpm;
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const send = new Float32Array(len);
  song.tracks.forEach((tr, k) => {
    const notes = part === 'loop' ? tr.loop : (tr.intro ?? []);
    if (notes.length === 0) return;
    const mono = new Float32Array(len);
    renderNotes(
      notes,
      tr.inst,
      spb,
      tr.transpose ?? 0,
      new Rng((song.seed ?? 1) * 7919 + k * 104729 + (part === 'loop' ? 1 : 2)),
      mono,
      wrap,
    );
    const g = 10 ** ((tr.gain ?? 0) / 20);
    const [gl, gr] = panGains(tr.pan ?? 0);
    const s = tr.verb ?? 0.2;
    for (let i = 0; i < len; i++) {
      const v = mono[i]! * g;
      L[i]! += v * gl;
      R[i]! += v * gr;
      send[i]! += v * s;
    }
  });
  return { L, R, send };
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

const twice = (x: Float32Array) => {
  const y = new Float32Array(x.length * 2);
  y.set(x);
  y.set(x, x.length);
  return y;
};

export function renderSong(song: Song): Rendered {
  const spb = 60 / song.bpm;
  const loopLen = samples(song.loopBeats * spb);
  const introLen = Math.round((song.introBeats ?? 0) * spb * SR);
  const verbOpts = { room: 0.6, damp: 0.5, ...song.reverb, wet: 1, dry: 0, tail: 0 };
  const wet = song.reverb?.wet ?? 0.35;

  // The loop body: notes wrap around, and the reverb and bus compressor run over two passes keeping the
  // second, so their state where the body ends matches where it starts.
  const loop = renderSection(song, 'loop', loopLen, true);
  const [vl, vr] = reverb(twice(loop.send), verbOpts);
  const L2 = twice(loop.L);
  const R2 = twice(loop.R);
  for (let i = 0; i < L2.length; i++) {
    L2[i]! += vl[i]! * wet;
    R2[i]! += vr[i]! * wet;
  }
  master(L2, R2);
  const bodyL = L2.subarray(loopLen);
  const bodyR = R2.subarray(loopLen);

  // The intro plays once, on its own; the body's first beats carry the loop's wrapped tails instead of its.
  const introL = new Float32Array(introLen);
  const introR = new Float32Array(introLen);
  if (introLen > 0) {
    const intro = renderSection(song, 'intro', introLen, false);
    const [il, ir] = reverb(intro.send, verbOpts);
    for (let i = 0; i < introLen; i++) {
      introL[i] = intro.L[i]! + il[i]! * wet;
      introR[i] = intro.R[i]! + ir[i]! * wet;
    }
    master(introL, introR);
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
