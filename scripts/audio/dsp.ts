/**
 * A tiny offline synthesis toolkit for the game's sound effects and music (scripts/audio/*). Everything is
 * plain Float32Array mono buffers at SR, seeded so every render is byte-identical. Nothing here ships to the
 * browser: the build scripts render WAV files and encode them to public/audio with ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const SR = 44100;

/** A value fixed for the whole buffer or a function of time in seconds. */
export type Param = number | ((t: number) => number);
const at = (p: Param, t: number) => (typeof p === 'number' ? p : p(t));

export const samples = (seconds: number) => Math.max(1, Math.round(seconds * SR));
export const buffer = (seconds: number) => new Float32Array(samples(seconds));
export const duration = (x: Float32Array) => x.length / SR;
export const midiHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
export const dbGain = (db: number) => 10 ** (db / 20);

/** xorshift32: seeded, so renders are reproducible. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let s = this.s;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.s = s >>> 0;
    return this.s / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}

// ---------------------------------------------------------------- generators

export type NoiseColor = 'white' | 'pink' | 'brown';

export function noise(seconds: number, rng: Rng, color: NoiseColor = 'white'): Float32Array {
  const x = buffer(seconds);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let brown = 0;
  for (let i = 0; i < x.length; i++) {
    const w = rng.next() * 2 - 1;
    if (color === 'white') x[i] = w;
    else if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else {
      brown = (brown + 0.02 * w) / 1.02;
      x[i] = brown * 3.5;
    }
  }
  return x;
}

export type Shape = 'sine' | 'triangle' | 'saw' | 'square' | 'pulse';

function blep(t: number, dt: number): number {
  if (dt <= 0) return 0;
  if (t < dt) {
    const u = t / dt;
    return u + u - u * u - 1;
  }
  if (t > 1 - dt) {
    const u = (t - 1) / dt;
    return u * u + u + u + 1;
  }
  return 0;
}

/** Phase-accumulating oscillator with PolyBLEP edges on saw/square/pulse, so high notes alias less. */
export function osc(
  seconds: number,
  freq: Param,
  shape: Shape = 'sine',
  opts: { phase?: number; width?: Param } = {},
): Float32Array {
  const x = buffer(seconds);
  let ph = (((opts.phase ?? 0) % 1) + 1) % 1;
  const width = opts.width ?? 0.5;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const dt = Math.min(0.5, Math.max(0, at(freq, t)) / SR);
    let v: number;
    if (shape === 'sine') v = Math.sin(2 * Math.PI * ph);
    else if (shape === 'triangle') v = 1 - 4 * Math.abs(ph - 0.5);
    else if (shape === 'saw') v = 2 * ph - 1 - blep(ph, dt);
    else {
      const w = shape === 'square' ? 0.5 : Math.min(0.95, Math.max(0.05, at(width, t)));
      v = (ph < w ? 1 : -1) + blep(ph, dt) - blep((ph - w + 1) % 1, dt);
    }
    x[i] = v;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return x;
}

/** Sum of decaying sine partials, each [ratio, gain, decay seconds] relative to `freq`: bells, mallets, metal. */
export function partials(
  seconds: number,
  freq: number,
  parts: readonly (readonly [number, number, number])[],
): Float32Array {
  const x = buffer(seconds);
  for (const [ratio, gain, tau] of parts) {
    if (freq * ratio >= SR / 2) continue;
    const w = (2 * Math.PI * freq * ratio) / SR;
    for (let i = 0; i < x.length; i++) x[i]! += gain * Math.sin(w * i) * Math.exp(-i / SR / tau);
  }
  return x;
}

/** Karplus-Strong plucked string. `bright` 0..1 sets the excitation's brightness, `loss` the loop decay. */
export function pluck(seconds: number, freq: number, rng: Rng, bright = 0.6, loss = 0.996): Float32Array {
  const x = buffer(seconds);
  const n = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    prev += bright * (rng.next() * 2 - 1 - prev);
    line[i] = prev;
  }
  let idx = 0;
  for (let i = 0; i < x.length; i++) {
    const cur = line[idx]!;
    const next = line[(idx + 1) % n]!;
    line[idx] = loss * 0.5 * (cur + next);
    x[i] = cur;
    idx = (idx + 1) % n;
  }
  return x;
}

/** Two-operator FM: carrier at `freq`, modulator at freq * ratio with modulation index `index(t)`. */
export function fm(seconds: number, freq: Param, ratio: number, index: Param): Float32Array {
  const x = buffer(seconds);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = at(freq, t);
    x[i] = Math.sin(2 * Math.PI * pc + at(index, t) * Math.sin(2 * Math.PI * pm));
    pc = (pc + f / SR) % 1;
    pm = (pm + (f * ratio) / SR) % 1;
  }
  return x;
}

// ---------------------------------------------------------------- envelopes

/** Piecewise envelope through [time, value] points; `curve` > 1 bends each segment exponentially. */
export function env(
  seconds: number,
  points: readonly (readonly [number, number])[],
  curve = 1,
): Float32Array {
  const x = buffer(seconds);
  let k = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    while (k < points.length - 2 && t >= points[k + 1]![0]) k++;
    const [t0, v0] = points[k]!;
    const [t1, v1] = points[Math.min(k + 1, points.length - 1)]!;
    const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
    const shaped = v1 < v0 ? 1 - (1 - u) ** (1 / curve) : u ** curve;
    x[i] = t < t0 ? v0 : v0 + (v1 - v0) * shaped;
  }
  return x;
}

/** Linear attack over `attack` seconds, then exponential decay with time constant `tau`. */
export function decay(seconds: number, tau: number, attack = 0.001): Float32Array {
  const x = buffer(seconds);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = (t < attack ? t / attack : 1) * Math.exp(-Math.max(0, t - attack) / tau);
  }
  return x;
}

export function adsr(seconds: number, a: number, d: number, s: number, r: number): Float32Array {
  const hold = Math.max(a + d, seconds - r);
  return env(seconds, [
    [0, 0],
    [a, 1],
    [a + d, s],
    [hold, s],
    [hold + r, 0],
  ]);
}

// ---------------------------------------------------------------- processing

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peak' | 'lowshelf' | 'highshelf';

/** RBJ biquad. Frequency, Q and gain may vary over time (coefficients update every 16 samples). */
export function filter(
  x: Float32Array,
  type: FilterType,
  freq: Param,
  q: Param = Math.SQRT1_2,
  gainDb: Param = 0,
): Float32Array {
  const y = new Float32Array(x.length);
  const dynamic = typeof freq !== 'number' || typeof q !== 'number' || typeof gainDb !== 'number';
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const coeffs = (t: number) => {
    const f = Math.min(SR * 0.45, Math.max(10, at(freq, t)));
    const Q = Math.max(0.05, at(q, t));
    const A = 10 ** (at(gainDb, t) / 40);
    const w0 = (2 * Math.PI * f) / SR;
    const cs = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Q);
    let a0 = 1 + alpha;
    a1 = -2 * cs;
    a2 = 1 - alpha;
    if (type === 'lowpass') [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === 'highpass') [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else if (type === 'bandpass') [b0, b1, b2] = [alpha, 0, -alpha];
    else if (type === 'notch') [b0, b1, b2] = [1, -2 * cs, 1];
    else if (type === 'peak') {
      [b0, b1, b2] = [1 + alpha * A, -2 * cs, 1 - alpha * A];
      a0 = 1 + alpha / A;
      a2 = 1 - alpha / A;
    } else {
      const s2 = 2 * Math.sqrt(A) * alpha;
      const sign = type === 'lowshelf' ? 1 : -1;
      b0 = A * (A + 1 - sign * (A - 1) * cs + s2);
      b1 = sign * 2 * A * (A - 1 - sign * (A + 1) * cs);
      b2 = A * (A + 1 - sign * (A - 1) * cs - s2);
      a0 = A + 1 + sign * (A - 1) * cs + s2;
      a1 = -sign * 2 * (A - 1 + sign * (A + 1) * cs);
      a2 = A + 1 + sign * (A - 1) * cs - s2;
    }
    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    a1 /= a0;
    a2 /= a0;
  };
  coeffs(0);
  for (let i = 0; i < x.length; i++) {
    if (dynamic && i % 16 === 0) coeffs(i / SR);
    const xi = x[i]!;
    const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

/** Multiply sample by sample (the result has `a`'s length; `b` reads as 0 past its end). */
export function mul(a: Float32Array, b: Float32Array | number): Float32Array {
  const y = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) y[i] = a[i]! * (typeof b === 'number' ? b : (b[i] ?? 0));
  return y;
}

/** Add `src` into `dst` at `offset` seconds with `gain`, in place; samples past dst's end are dropped. */
export function add(dst: Float32Array, src: Float32Array, offset = 0, gain = 1): Float32Array {
  const o = Math.round(offset * SR);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i]! += src[i]! * gain;
  return dst;
}

/** Mix [buffer, gain, offset seconds] layers into a new buffer `seconds` long. */
export function layer(seconds: number, ...parts: (readonly [Float32Array, number, number?])[]): Float32Array {
  const out = buffer(seconds);
  for (const [x, g, o] of parts) add(out, x, o ?? 0, g);
  return out;
}

/** Soft clip: tanh drive, normalised so a full-scale input stays at full scale. */
export function drive(x: Float32Array, amount: number): Float32Array {
  const norm = Math.tanh(amount);
  return x.map((v) => Math.tanh(v * amount) / norm);
}

/** Bit-crush and sample-and-hold, for chiptune grit. */
export function crush(x: Float32Array, bits: number, hold = 1): Float32Array {
  const steps = 2 ** (bits - 1);
  const y = new Float32Array(x.length);
  let held = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % hold === 0) held = Math.round(x[i]! * steps) / steps;
    y[i] = held;
  }
  return y;
}

export function peak(x: Float32Array): number {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  return p;
}

export function rms(x: Float32Array): number {
  let s = 0;
  for (const v of x) s += v * v;
  return Math.sqrt(s / Math.max(1, x.length));
}

/**
 * Integrated loudness in LUFS (ITU-R BS.1770: K-weighting, 400 ms blocks every 100 ms, absolute gate at
 * -70 LUFS and relative gate 10 LU below), summed over the channels.
 */
export function loudness(channels: readonly Float32Array[]): number {
  const k = channels.map((x) =>
    filter(filter(x, 'highshelf', 1681.97, 0.7072, 4), 'highpass', 38.135, 0.5003),
  );
  const n = Math.min(...k.map((c) => c.length));
  const sums = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of k) s += c[i]! * c[i]!;
    sums[i + 1] = sums[i]! + s;
  }
  const block = samples(0.4);
  const blocks: number[] = [];
  for (let s = 0; s + block <= n; s += samples(0.1)) blocks.push((sums[s + block]! - sums[s]!) / block);
  const lufs = (ms: number) => -0.691 + 10 * Math.log10(ms);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const loud = blocks.filter((ms) => lufs(ms) > -70);
  if (loud.length === 0) return -Infinity;
  const gate = lufs(mean(loud)) - 10;
  return lufs(mean(loud.filter((ms) => lufs(ms) > gate)));
}

export function normalize(x: Float32Array, target = 0.9): Float32Array {
  const p = peak(x);
  return p > 0 ? mul(x, target / p) : x;
}

/** Raised-cosine fade over the first `fadeIn` and last `fadeOut` seconds, in place. */
export function fade(x: Float32Array, fadeIn: number, fadeOut: number): Float32Array {
  const a = Math.round(fadeIn * SR);
  const b = Math.round(fadeOut * SR);
  for (let i = 0; i < a && i < x.length; i++) x[i]! *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
  for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i]! *= 0.5 - 0.5 * Math.cos((Math.PI * i) / b);
  return x;
}

/** Drop the tail once it stays `floorDb` below the peak, ending on a 10 ms fade. */
export function trim(x: Float32Array, floorDb = -60): Float32Array {
  const floor = peak(x) * dbGain(floorDb);
  let end = x.length;
  while (end > 1 && Math.abs(x[end - 1]!) < floor) end--;
  return fade(x.slice(0, Math.min(x.length, end + samples(0.01))), 0, 0.01);
}

export function reverse(x: Float32Array): Float32Array {
  return x.slice().reverse();
}

/** Read through a variable delay line, `delay(t)` in seconds: chorus, vibrato, doppler. */
export function modDelay(x: Float32Array, delay: (t: number) => number): Float32Array {
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const p = i - delay(i / SR) * SR;
    const j = Math.floor(p);
    const f = p - j;
    const a = x[j] ?? 0;
    const b = x[j + 1] ?? 0;
    y[i] = a + (b - a) * f;
  }
  return y;
}

/** Feedback echo, `tail` seconds longer than the input. */
export function echo(x: Float32Array, time: number, feedback: number, mix: number, tail = 0): Float32Array {
  const d = Math.round(time * SR);
  const y = new Float32Array(x.length + samples(tail));
  const line = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) {
    const dry = x[i] ?? 0;
    const wet = i >= d ? line[i - d]! : 0;
    line[i] = dry + wet * feedback;
    y[i] = dry + wet * mix;
  }
  return y;
}

export interface ReverbOptions {
  /** 0..1 */
  room?: number;
  /** 0..1, high-frequency damping */
  damp?: number;
  wet?: number;
  dry?: number;
  width?: number;
  /** Extra seconds rendered after the input ends. */
  tail?: number;
  predelay?: number;
}

/**
 * Freeverb (Jezar's public-domain design): 8 damped combs and 4 allpasses per channel. Returns [left, right]
 * with the dry signal mixed in, `tail` seconds longer than the input.
 */
export function reverb(x: Float32Array, opts: ReverbOptions = {}): [Float32Array, Float32Array] {
  const room = 0.7 + 0.28 * (opts.room ?? 0.5);
  const damp = 0.4 * (opts.damp ?? 0.5);
  const wet = opts.wet ?? 0.3;
  const dry = opts.dry ?? 1;
  const width = opts.width ?? 1;
  const len = x.length + samples(opts.tail ?? 1.5);
  const pre = samples(opts.predelay ?? 0.01);
  const channel = (spread: number) => {
    const out = new Float32Array(len);
    const cb = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => ({
      buf: new Float32Array(n + spread),
      i: 0,
      store: 0,
    }));
    const ap = [556, 441, 341, 225].map((n) => ({ buf: new Float32Array(n + spread), i: 0 }));
    for (let i = 0; i < len; i++) {
      const input = (x[i - pre] ?? 0) * 0.015;
      let s = 0;
      for (const c of cb) {
        const o = c.buf[c.i]!;
        c.store = o * (1 - damp) + c.store * damp;
        c.buf[c.i] = input + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        s += o;
      }
      for (const a of ap) {
        const b = a.buf[a.i]!;
        a.buf[a.i] = s + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        s = b - s;
      }
      out[i] = s;
    }
    return out;
  };
  const l = channel(0);
  const r = channel(23);
  const w1 = wet * (width / 2 + 0.5);
  const w2 = wet * ((1 - width) / 2);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const d = (x[i] ?? 0) * dry;
    L[i] = l[i]! * w1 + r[i]! * w2 + d;
    R[i] = r[i]! * w1 + l[i]! * w2 + d;
  }
  return [L, R];
}

/** The reverb folded to mono (sound effects are mono; the game pans them). */
export function reverbMono(x: Float32Array, opts: ReverbOptions = {}): Float32Array {
  const [l, r] = reverb(x, opts);
  return l.map((v, i) => (v + r[i]!) / 2);
}

// ---------------------------------------------------------------- output

/** 16-bit PCM WAV, one Float32Array per channel. */
export function wav(channels: readonly Float32Array[], sr = SR): Buffer {
  const n = Math.max(...channels.map((c) => c.length));
  const ch = channels.length;
  const data = Buffer.alloc(n * ch * 2);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      data.writeInt16LE(Math.round(v * 32767), (i * ch + c) * 2);
    }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * ch * 2, 28);
  h.writeUInt16LE(ch * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Encode channels to MP3 with LAME, VBR quality `q` (0 best .. 9 smallest); `keepWav` also writes the WAV. */
export function encodeMp3(out: string, channels: readonly Float32Array[], q = 4, keepWav?: string): void {
  mkdirSync(dirname(out), { recursive: true });
  const tmp = keepWav ?? `${out}.wav`;
  if (keepWav) mkdirSync(dirname(keepWav), { recursive: true });
  writeFileSync(tmp, wav(channels));
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    tmp,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    String(q),
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    out,
  ]);
  if (!keepWav) rmSync(tmp);
}
