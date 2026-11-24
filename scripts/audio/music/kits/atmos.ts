/**
 * Instruments and note helpers for the atmos group of stage themes (forest-temple, run-tunnel,
 * bloxorz-platform, coolmath-planet). Each instrument renders one mono note like those in instruments.ts:
 * `f` in Hz, `dur` the held length in seconds, velocity 0..1. Instruments that take `rng` vary their
 * phases and detune per note, so the same part on two panned tracks comes out decorrelated (wide).
 */
import type { Rng, Shape } from '../../dsp.ts';
import {
  SR,
  adsr,
  decay,
  drive,
  env,
  filter,
  fm,
  layer,
  mul,
  noise,
  osc,
  partials,
  pluck,
  reverse,
} from '../../dsp.ts';
import type { Instrument } from '../instruments.ts';
import type { Note } from '../notes.ts';

const TAU = 2 * Math.PI;

/** Delayed, faded-in vibrato around `f`. */
const vibrato =
  (f: number, rate: number, depth: number, delay: number) =>
  (t: number): number =>
    f * (1 + depth * Math.min(1, Math.max(0, (t - delay) * 3)) * Math.sin(TAU * rate * t));

/** Mean of detuned oscillators; `rng` randomises phases and adds up to 2 cents of drift per voice. */
const ensemble = (
  len: number,
  f: (t: number) => number,
  shape: Shape,
  cents: number[],
  rng: Rng,
  width = 0.5,
): Float32Array => {
  const out = new Float32Array(Math.max(1, Math.round(len * SR)));
  for (const c of cents) {
    const ratio = 2 ** ((c + rng.range(-2, 2)) / 1200);
    const v = osc(len, (t) => f(t) * ratio, shape, { phase: rng.next(), width });
    for (let i = 0; i < out.length; i++) out[i]! += v[i]! / cents.length;
  }
  return out;
};

// ---------------------------------------------------------------- drums

/** Kick: a sub body that settles at 54 Hz after a punchy sweep, a knock an octave up and a beater click. */
export const kick: Instrument = (_f, _d, vel, rng) => {
  const len = 0.6;
  const pitch = (t: number) => 54 + 68 * Math.exp(-t / 0.045) + 150 * Math.exp(-t / 0.006);
  const body = mul(osc(len, pitch), decay(len, 0.27, 0.0015));
  const knock = mul(
    osc(len, (t) => 2 * pitch(t)),
    decay(len, 0.045, 0.001),
  );
  const click = mul(filter(noise(0.02, rng), 'bandpass', 3200, 0.7), decay(0.02, 0.0025, 0.0004));
  return mul(drive(layer(len, [body, 1], [knock, 0.3], [click, 0.22 * vel]), 2.2), vel * 0.9);
};

/** Snare: a tuned shell body, a velocity-length wire rattle and snap, in a small wooden room; each hit varies. */
export const snare: Instrument = (_f, _d, vel, rng) => {
  const len = 0.6;
  const tune = 1 + rng.range(-0.025, 0.025);
  const n = noise(len, rng);
  const shell = layer(
    len,
    [
      mul(
        osc(len, (t) => 195 * tune * (1 + 0.3 * Math.exp(-t / 0.012))),
        decay(len, 0.09, 0.001),
      ),
      1,
    ],
    [
      mul(
        osc(len, (t) => 340 * tune * (1 + 0.2 * Math.exp(-t / 0.01))),
        decay(len, 0.05, 0.001),
      ),
      0.4,
    ],
  );
  const wires = mul(
    filter(filter(n, 'highpass', 1400 * tune), 'lowpass', 7000 + 2500 * vel),
    decay(len, 0.07 + 0.11 * vel, 0.001),
  );
  const body = mul(filter(n, 'bandpass', 420, 0.8), decay(len, 0.06, 0.001));
  const snap = mul(filter(n, 'bandpass', 2400, 1.1), decay(len, 0.018, 0.0005));
  const dry = drive(layer(len, [shell, 1], [wires, 0.6], [body, 0.45], [snap, 0.4 * vel]), 1.6);
  const room = layer(
    len,
    [dry, 1],
    [filter(dry, 'lowpass', 3000), 0.22, 0.011],
    [filter(dry, 'lowpass', 2000), 0.15, 0.023],
  );
  return mul(room, vel * 0.8);
};

/** Side stick: a woody click with a short ring. */
export const rim: Instrument = (_f, _d, vel, rng) => {
  const len = 0.12;
  const ring = partials(len, 1650, [
    [1, 1, 0.018],
    [0.52, 0.5, 0.03],
    [2.4, 0.25, 0.008],
  ]);
  const click = mul(filter(noise(len, rng), 'bandpass', 4000, 1), decay(len, 0.004, 0.0003));
  return mul(layer(len, [ring, 0.8], [click, 0.5]), vel * 0.6);
};

/** Clap: three quick bursts and a short room. */
export const clap: Instrument = (_f, _d, vel, rng) => {
  const len = 0.35;
  const n = filter(filter(noise(len, rng), 'bandpass', 1250, 0.9), 'highpass', 500);
  const g = new Float32Array(n.length);
  for (const [t0, tau, a] of [
    [0, 0.006, 1],
    [0.009, 0.006, 0.9],
    [0.019, 0.007, 0.8],
    [0.028, 0.09, 0.75],
  ] as const) {
    const o = Math.round(t0 * SR);
    for (let i = o; i < g.length; i++) g[i]! += a * Math.exp(-(i - o) / SR / tau);
  }
  return mul(mul(n, g), vel * 0.7);
};

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
/** The six detuned squares of an analogue cymbal. */
const metal = (len: number, scale: number, rng: Rng) =>
  layer(len, ...METAL.map((fr) => [osc(len, fr * scale, 'square', { phase: rng.next() }), 1 / 6] as const));

/** Closed hi-hat: metallic squares through a high band, plus a little air. */
export const hat: Instrument = (_f, _d, vel, rng) => {
  const len = 0.14;
  const m = filter(filter(metal(len, 1, rng), 'bandpass', 8200, 1.1), 'highpass', 6000);
  const air = filter(filter(noise(len, rng), 'highpass', 7000), 'lowpass', 13000);
  return mul(layer(len, [m, 1], [air, 0.3]), mul(decay(len, 0.016 + 0.014 * vel, 0.0006), vel * 0.75));
};

/** Open hi-hat. */
export const openHat: Instrument = (_f, _d, vel, rng) => {
  const len = 0.7;
  const m = filter(filter(metal(len, 1, rng), 'bandpass', 9000, 0.9), 'highpass', 6000);
  const air = filter(noise(len, rng), 'highpass', 7500);
  return mul(layer(len, [m, 1], [air, 0.35]), mul(decay(len, 0.17, 0.002), vel * 0.6));
};

/** Ride: a bell ping over a long metallic wash. */
export const ride: Instrument = (_f, _d, vel, rng) => {
  const len = 1.6;
  const wash = filter(filter(metal(len, 0.93, rng), 'bandpass', 6500, 0.7), 'highpass', 3500);
  const bell = partials(len, 820, [
    [1, 1, 0.5],
    [2.62, 0.5, 0.35],
    [4.13, 0.3, 0.2],
  ]);
  return mul(layer(len, [mul(wash, decay(len, 0.45, 0.001)), 1], [bell, 0.12]), vel * 0.5);
};

/** Crash: metal and noise with a long tail. */
export const crash: Instrument = (_f, _d, vel, rng) => {
  const len = 2.8;
  const m = filter(metal(len, 1.37, rng), 'highpass', 3200);
  const n = filter(filter(noise(len, rng), 'highpass', 3800), 'lowpass', 13000);
  return mul(layer(len, [m, 0.7], [n, 0.6]), mul(decay(len, 0.85, 0.003), vel * 0.55));
};

/** A crash played backwards so it swells into the next downbeat; lasts exactly `dur`. */
export const swell: Instrument = (_f, dur, vel, rng) => {
  const len = Math.max(0.1, dur);
  const m = filter(metal(len, 1.37, rng), 'highpass', 3200);
  const n = filter(noise(len, rng), 'highpass', 3000);
  const x = reverse(mul(layer(len, [m, 0.6], [n, 0.7]), decay(len, len / 3, 0.002)));
  const tail = Math.min(x.length, Math.round(0.006 * SR));
  for (let i = 0; i < tail; i++) x[x.length - 1 - i]! *= i / tail;
  return mul(x, vel * 0.45);
};

/** Noise riser: a band sweeping up over the note, ending on its last sample. */
export const riser: Instrument = (_f, dur, vel, rng) => {
  const len = Math.max(0.1, dur);
  const x = filter(noise(len, rng), 'bandpass', (t) => 250 * 36 ** Math.min(1, t / len), 1.3);
  const g = env(
    len,
    [
      [0, 0],
      [len * 0.97, 1],
      [len, 0],
    ],
    2.2,
  );
  return mul(x, mul(g, vel * 0.9));
};

/** Low impact for big downbeats: a falling sine boom and a dark thump. */
export const boom: Instrument = (_f, _d, vel, rng) => {
  const len = 1.6;
  const body = mul(
    osc(len, (t) => 38 + 70 * Math.exp(-t / 0.08)),
    decay(len, 0.55, 0.002),
  );
  const thump = mul(filter(noise(len, rng), 'lowpass', 220), decay(len, 0.12, 0.002));
  return mul(drive(layer(len, [body, 1], [thump, 0.6]), 1.5), vel * 0.85);
};

/** Tom, pitched by the note: a head with its inharmonic modes, skin noise and the stick; each hit varies. */
export const tom: Instrument = (f, _d, vel, rng) => {
  const len = 0.9;
  const tune = f * (1 + rng.range(-0.015, 0.015));
  const tau = Math.min(0.5, 0.24 * Math.sqrt(140 / tune));
  const head = mul(
    osc(len, (t) => tune * (1 + 0.22 * Math.exp(-t / 0.03))),
    decay(len, tau, 0.001),
  );
  const modes = partials(len, tune, [
    [1.5, 0.3, tau * 0.4],
    [1.98, 0.18, tau * 0.3],
    [2.44, 0.1, tau * 0.2],
  ]);
  const skin = mul(filter(noise(len, rng), 'bandpass', tune * 4, 0.8), decay(len, 0.04, 0.0005));
  const stick = mul(filter(noise(0.03, rng), 'bandpass', 3000, 0.8), decay(0.03, 0.004, 0.0004));
  return mul(drive(layer(len, [head, 1], [modes, 1], [skin, 0.3], [stick, 0.3]), 1.8), vel * 0.85);
};

/** Timpani: the drum's inharmonic modes and a felt mallet. */
export const timpani: Instrument = (f, _d, vel, rng) => {
  const len = 2.4;
  const modes = partials(len, f, [
    [1, 1, 0.95],
    [1.504, 0.42, 0.55],
    [1.742, 0.26, 0.4],
    [2.0, 0.2, 0.32],
    [2.245, 0.1, 0.25],
  ]);
  const mallet = mul(filter(noise(0.08, rng), 'lowpass', 500 + 900 * vel), decay(0.08, 0.014, 0.001));
  return mul(drive(layer(len, [modes, 0.8], [mallet, 0.55]), 1.2), vel * 0.9);
};

/** Taiko: a huge low head with a skin thump. */
export const taiko: Instrument = (f, _d, vel, rng) => {
  const len = 1.3;
  const head = mul(
    osc(len, (t) => f * (1 + 0.7 * Math.exp(-t / 0.02))),
    decay(len, 0.38, 0.0015),
  );
  const skin = mul(filter(noise(len, rng), 'lowpass', 380), decay(len, 0.07, 0.001));
  const slap = mul(filter(noise(len, rng), 'bandpass', 1400, 1), decay(len, 0.012, 0.0005));
  return mul(drive(layer(len, [head, 1], [skin, 0.7], [slap, 0.25]), 1.6), vel * 0.9);
};

/** Djembe: bass (low notes), tone, or slap (high notes) by pitch, with the shell's wooden body. */
export const djembe: Instrument = (f, _d, vel, rng) => {
  const len = 0.5;
  const slap = Math.min(1, Math.max(0, (f - 260) / 400));
  const tau = f < 150 ? 0.18 : 0.085 - 0.045 * slap;
  const head = mul(
    osc(len, (t) => f * (1 + 0.18 * Math.exp(-t / 0.012))),
    decay(len, tau, 0.0008),
  );
  const mode = mul(osc(len, f * 1.62), decay(len, tau * 0.45, 0.0008));
  const wood = mul(osc(len, Math.min(240, f * 0.55)), decay(len, 0.07, 0.001));
  const skin = mul(
    filter(noise(len, rng), 'bandpass', 1700 + 1800 * slap, 1),
    decay(len, 0.008 + 0.03 * slap, 0.0004),
  );
  return mul(
    layer(len, [head, 1 - 0.45 * slap], [mode, 0.25], [wood, f < 150 ? 0 : 0.45], [skin, 0.25 + 0.9 * slap]),
    vel * 0.8,
  );
};

/** Frame drum (bendir): a soft low head with a buzzing snare string. */
export const frame: Instrument = (f, _d, vel, rng) => {
  const len = 0.7;
  const head = mul(
    osc(len, (t) => f * (1 + 0.12 * Math.exp(-t / 0.02))),
    decay(len, 0.22, 0.002),
  );
  const buzz = mul(filter(noise(len, rng), 'bandpass', 1300, 1.4), decay(len, 0.09, 0.002));
  return mul(layer(len, [head, 1], [buzz, 0.3]), vel * 0.8);
};

/** Shaker: a soft swish. */
export const shaker: Instrument = (_f, _d, vel, rng) => {
  const len = 0.13;
  const x = filter(filter(noise(len, rng), 'bandpass', 7200, 0.8), 'highpass', 4200);
  const g = env(
    len,
    [
      [0, 0],
      [0.014, 1],
      [len, 0],
    ],
    1.8,
  );
  return mul(x, mul(g, vel * 0.5));
};

/** Tambourine: jingles over a short shake. */
export const tambourine: Instrument = (_f, _d, vel, rng) => {
  const len = 0.32;
  const jingles = partials(len, 1, [
    [5150, 0.5, 0.09],
    [6930, 0.45, 0.08],
    [8320, 0.35, 0.07],
    [9710, 0.3, 0.06],
    [11870, 0.2, 0.05],
  ]);
  const shake = mul(filter(noise(len, rng), 'highpass', 6500), decay(len, 0.05, 0.002));
  return mul(layer(len, [jingles, 0.5], [shake, 0.5]), vel * 0.45);
};

/** Temple / wood block, pitched by the note. */
export const block: Instrument = (f, _d, vel, rng) => {
  const len = 0.15;
  const ring = partials(len, f, [
    [1, 1, 0.035],
    [2.71, 0.35, 0.012],
  ]);
  const click = mul(filter(noise(len, rng), 'bandpass', 3000, 1), decay(len, 0.003, 0.0003));
  return mul(layer(len, [ring, 1], [click, 0.3]), vel * 0.6);
};

// ---------------------------------------------------------------- winds

/** Concert flute: a warm, mostly-fundamental tone, breath in the 2-4 kHz band, a chiff on the attack, a slight
 * scoop, and gentle delayed vibrato in pitch and level; velocity sets the brightness. */
export const flute: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.18;
  const bright = 0.35 + 0.65 * vel;
  const depth = (t: number) => Math.min(1, Math.max(0, (t - 0.3) * 2));
  const p = (t: number) =>
    f * (1 - 0.008 * Math.exp(-t / 0.04)) * (1 + 0.0038 * depth(t) * Math.sin(TAU * 5 * t));
  const tone = layer(
    len,
    [osc(len, p), 1],
    [osc(len, (t) => 2 * p(t), 'sine', { phase: 0.25 }), 0.24 * bright],
    [osc(len, (t) => 3 * p(t)), 0.08 * bright],
    [osc(len, (t) => 4 * p(t), 'sine', { phase: 0.5 }), 0.025 * bright],
  );
  const n = noise(len, rng);
  const breath = layer(
    len,
    [filter(n, 'bandpass', Math.min(9000, f * 2), 1.2), 0.5],
    [filter(n, 'bandpass', 3000, 0.9), 0.5],
  );
  const chiff = mul(filter(n, 'bandpass', 2800, 1.2), decay(len, 0.04, 0.006));
  const amp = adsr(len, 0.05 + 0.05 * (1 - vel), 0.12, 0.85, 0.16);
  const out = filter(layer(len, [tone, 1], [breath, 0.07], [chiff, 0.35 * vel]), 'lowpass', 5000, 0.7);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i]! *= amp[i]! * (1 + 0.06 * depth(t) * Math.sin(TAU * 5 * t + 0.6)) * vel * 0.55;
  }
  return out;
};

/** Pan flute: hollow, breathier, with a strong puff on each note. */
export const panFlute: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.2;
  const p = (t: number) =>
    f *
    (1 - 0.018 * Math.exp(-t / 0.04)) *
    (1 + 0.004 * Math.min(1, Math.max(0, (t - 0.3) * 2)) * Math.sin(TAU * 4.6 * t));
  const tone = layer(
    len,
    [osc(len, p), 1],
    [osc(len, (t) => 2 * p(t)), 0.05],
    [osc(len, (t) => 3 * p(t)), 0.12],
    [osc(len, (t) => 5 * p(t)), 0.025],
  );
  const n = noise(len, rng);
  const breath = filter(n, 'bandpass', Math.min(9000, f * 1.5), 0.9);
  const puff = mul(filter(n, 'bandpass', Math.min(9000, f * 2.5), 1.5), decay(len, 0.05, 0.006));
  const amp = adsr(len, 0.035, 0.12, 0.8, 0.17);
  return mul(layer(len, [tone, 1], [breath, 0.12], [puff, 0.45 * vel]), mul(amp, vel * 0.55));
};

// ---------------------------------------------------------------- mallets and plucks

/** Marimba: a rosewood bar (fundamental, the tuned 4th and 10th partials) with a soft mallet. */
export const marimba: Instrument = (f, _dur, vel, rng) => {
  const tau = Math.min(1.1, Math.max(0.12, 0.5 * Math.sqrt(220 / f)));
  const len = Math.min(2.5, tau * 4.5);
  const hard = 0.3 + 0.7 * vel;
  const bar = partials(len, f, [
    [1, 1, tau],
    [3.98, 0.2 * hard, tau * 0.16],
    [9.9, 0.05 * hard, tau * 0.05],
  ]);
  const knock = mul(
    filter(noise(0.02, rng), 'bandpass', Math.min(8000, f * 5), 1.2),
    decay(0.02, 0.003, 0.0004),
  );
  const out = layer(len, [bar, 1], [knock, 0.1 * hard]);
  const a = Math.round(0.0015 * SR);
  for (let i = 0; i < a; i++) out[i]! *= i / a;
  return mul(out, vel * 0.75);
};

/** Kalimba: a bright tine with its inharmonic ring and a thumb click. */
export const kalimba: Instrument = (f, _dur, vel, rng) => {
  const tau = Math.min(1.2, 0.55 * Math.sqrt(440 / f));
  const len = Math.min(2.4, tau * 4);
  const tine = partials(len, f, [
    [1, 1, tau],
    [2.0, 0.08, tau * 0.4],
    [5.95, 0.2 * vel, 0.04],
  ]);
  const click = mul(filter(noise(0.015, rng), 'bandpass', 2500, 1), decay(0.015, 0.002, 0.0003));
  return mul(layer(len, [tine, 1], [click, 0.12]), vel * 0.6);
};

/** Vibraphone: metal bar partials, a mallet strike, the motor tremolo, damped by the pedal after the note. */
export const vibes: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.6, dur + 0.45);
  const bar = partials(len, f, [
    [1, 1, 2.2],
    [4.0, 0.22 * (0.5 + vel), 0.3],
    [10.0, 0.05, 0.05],
  ]);
  const strike = mul(
    filter(noise(0.02, rng), 'bandpass', Math.min(9000, f * 6), 1.5),
    decay(0.02, 0.003, 0.0003),
  );
  const ph = rng.next() * TAU;
  const out = new Float32Array(bar.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const damp = t < dur ? 1 : Math.exp(-(t - dur) / 0.12);
    const a = Math.min(1, t / 0.0015);
    out[i] =
      (bar[i]! * (1 - 0.32 * (0.5 - 0.5 * Math.cos(TAU * 5 * t + ph))) + 0.12 * vel * (strike[i] ?? 0)) *
      a *
      damp;
  }
  return mul(out, vel * 0.6);
};

/** Glass bell: warm partials, a slightly detuned twin for shimmer, and a soft FM sparkle on the attack. */
export const glass: Instrument = (f, dur, vel) => {
  const len = Math.max(1.4, dur + 1);
  const body = partials(len, f, [
    [1, 1, 1.5],
    [2.0, 0.3, 0.7],
    [3.0, 0.08, 0.35],
    [4.24, 0.03, 0.1],
  ]);
  const twin = partials(len, f * 1.003, [[1, 0.35, 1.2]]);
  const sparkle = mul(
    fm(len, f * 1.0015, 3, (t) => 0.9 * Math.exp(-t / 0.07)),
    decay(len, 0.25, 0.004),
  );
  const out = layer(len, [body, 1], [twin, 1], [sparkle, 0.2 * vel]);
  const a = Math.round(0.003 * SR);
  for (let i = 0; i < a; i++) out[i]! *= i / a;
  return mul(out, vel * 0.45);
};

/** Harp-like nylon pluck, warm. */
export const harp: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.8, dur + 0.6);
  const s = filter(pluck(len, f, rng, 0.35 + 0.3 * vel, 0.997), 'lowpass', Math.min(6000, f * 7));
  return mul(s, mul(decay(len, 0.9 * Math.sqrt(440 / f), 0.002), vel * 0.8));
};

/** Analogue pluck for arpeggios: two detuned saws through a snapping low-pass, with a sub. */
export const pluckSynth: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.35;
  const src = ensemble(len, () => f, 'saw', [-7, 7], rng);
  const cut = (t: number) => Math.min(6500, f * (1.3 + (2 + 7 * vel) * Math.exp(-t / 0.085)));
  const tone = filter(src, 'lowpass', cut, 1.5);
  const sub = osc(len, f / 2);
  return mul(layer(len, [tone, 1], [sub, 0.15]), mul(decay(len, 0.32, 0.003), vel * 0.7));
};

// ---------------------------------------------------------------- synths

/** Airy pad: five detuned saws, a slow breathing filter, long attack and release. */
export const airPad: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.9;
  const src = ensemble(len, () => f, 'saw', [-14, -6, 0, 6, 14], rng);
  const ph = rng.next() * TAU;
  const tone = filter(
    src,
    'lowpass',
    (t) => Math.min(5000, f * (2.4 + 0.9 * Math.sin(TAU * 0.2 * t + ph))),
    0.8,
  );
  return mul(tone, mul(adsr(len, 0.45, 0.4, 0.8, 0.85), vel * 0.5));
};

/** Pumping pad for side-chained beats: fast swell after each kick, short release. */
export const pumpPad: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.12;
  const src = ensemble(len, () => f, 'saw', [-12, -4, 4, 12], rng);
  const tone = filter(src, 'lowpass', Math.min(4500, f * 3), 0.8);
  const g = env(
    len,
    [
      [0, 0],
      [Math.min(dur * 0.55, 0.2), 1],
      [dur, 0.9],
      [len, 0],
    ],
    1.6,
  );
  return mul(tone, mul(g, vel * 0.5));
};

/** Supersaw lead: six saws under a gently closing low-pass with a 3 kHz dip, and a warm triangle core. */
export const superSaw: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.3;
  const p = vibrato(f, 5.2, 0.0035, 0.35);
  const src = ensemble(len, p, 'saw', [-15, -8, -3, 3, 8, 15], rng);
  const open = 1.4 + 1.8 * vel;
  const cut = (t: number) => Math.min(5500, f * (open + 1.2 * Math.exp(-t / 0.12)));
  const tone = filter(filter(filter(src, 'lowpass', cut, 0.7), 'highpass', 160), 'peak', 3200, 1, -4);
  const core = osc(len, p, 'triangle', { phase: rng.next() });
  return mul(layer(len, [tone, 1], [core, 0.35]), mul(adsr(len, 0.03, 0.3, 0.8, 0.28), vel * 0.65));
};

/** Soft lead: triangle with a little filtered saw and a sub octave, breathy vibrato. */
export const softLead: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.22;
  const p = vibrato(f, 5.2, 0.005, 0.25);
  const tri = osc(len, p, 'triangle', { phase: rng.next() });
  const saw = filter(osc(len, p, 'saw', { phase: rng.next() }), 'lowpass', Math.min(6000, f * 3), 0.7);
  const sub = osc(len, (t) => p(t) / 2);
  return mul(
    layer(len, [tri, 1], [saw, 0.22 + 0.15 * vel], [sub, 0.15]),
    mul(adsr(len, 0.025, 0.2, 0.8, 0.2), vel * 0.6),
  );
};

/** Sub bass: sine with a whisper of second harmonic. */
export const sub: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  return mul(
    drive(layer(len, [osc(len, f), 1], [osc(len, 2 * f), 0.14]), 1.3),
    mul(adsr(len, 0.006, 0.12, 0.85, 0.05), vel * 0.8),
  );
};

/** Round synth bass: saw and square with a plucky low-pass over a sine. */
export const roundBass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.08;
  const cut = (t: number) => f * (1.6 + (2.5 + 4 * vel) * Math.exp(-t / 0.07));
  const src = layer(len, [osc(len, f, 'saw', { phase: rng.next() }), 0.6], [osc(len, f, 'square'), 0.3]);
  const tone = filter(src, 'lowpass', cut, 1.2);
  return mul(
    layer(len, [tone, 0.75], [osc(len, f), 0.65]),
    mul(adsr(len, 0.004, 0.12, 0.75, 0.06), vel * 0.75),
  );
};

// ---------------------------------------------------------------- orchestra

/** Bowed string section: `cents` voices, vibrato, bow noise, a low-pass that blooms with the bow; `bright` scales it. */
const bowed =
  (cents: number[], bright: number, attack: number): Instrument =>
  (f, dur, vel, rng) => {
    const len = dur + 0.35;
    const p = vibrato(f, 5 + rng.next() * 0.6, 0.0045, 0.18);
    const src = ensemble(len, p, 'saw', cents, rng);
    const top = f * bright * (0.7 + 0.5 * vel);
    const a = attack * (1.3 - 0.6 * vel);
    const cut = (t: number) => Math.min(6000, top * (0.6 + 0.4 * Math.min(1, t / (a + 0.05))));
    const tone = filter(filter(src, 'lowpass', cut, 0.7), 'highpass', Math.min(180, f * 0.6));
    const bow = mul(filter(noise(len, rng), 'bandpass', Math.min(8000, f * 4), 1.5), 0.02);
    return mul(layer(len, [tone, 1], [bow, 1]), mul(adsr(len, a, 0.25, 0.9, 0.3), vel * 0.55));
  };

/** Violins and violas, legato. */
export const strings: Instrument = bowed([-10, -4, 3, 9], 4.2, 0.12);
/** Cellos and basses: darker, slower. */
export const lowStrings: Instrument = bowed([-8, -2, 4, 9], 2.8, 0.16);

/** Spiccato strings: short bowed notes with a bite that closes quickly. */
export const spiccato: Instrument = (f, dur, vel, rng) => {
  const len = Math.min(dur, 0.25) + 0.18;
  const src = ensemble(len, () => f, 'saw', [-8, 0, 8], rng);
  const cut = (t: number) => Math.min(5000, f * (1.6 + (2 + 2.5 * vel) * Math.exp(-t / 0.04)));
  const tone = filter(filter(src, 'lowpass', cut, 0.7), 'highpass', Math.min(150, f * 0.5));
  const bow = mul(filter(noise(len, rng), 'bandpass', Math.min(6000, f * 3), 1.2), decay(len, 0.015, 0.001));
  return mul(layer(len, [tone, 1], [bow, 0.08]), mul(decay(len, 0.09, 0.004), vel * 0.65));
};

/** Choir "ah": six voices through warm, broad vowel formants, with chest and breath. */
export const choir: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.7;
  const p = vibrato(f, 4.9 + rng.next() * 0.6, 0.005, 0.3);
  const src = ensemble(len, p, 'saw', [-12, -6, -2, 2, 6, 12], rng);
  const vowel = layer(
    len,
    [filter(src, 'bandpass', 650, 3.5), 1],
    [filter(src, 'bandpass', 1080, 4.5), 0.5],
    [filter(src, 'bandpass', 2450, 6), 0.18],
    [filter(src, 'bandpass', 3300, 8), 0.07],
  );
  const chest = filter(src, 'lowpass', Math.min(1000, f * 2.2), 0.7);
  const breath = filter(noise(len, rng), 'bandpass', 2200, 1);
  return mul(
    layer(len, [vowel, 1.8], [chest, 0.45], [breath, 0.02]),
    mul(adsr(len, 0.22, 0.25, 0.9, 0.55), vel * 0.75),
  );
};

/** Brass: a trumpet-like section that blooms open with velocity over a warm horn core, with breath on the attack. */
export const brass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.2;
  const v = vibrato(f, 5, 0.0035, 0.35);
  const p = (t: number) => v(t) * (1 - 0.018 * Math.exp(-t / 0.03));
  const src = ensemble(len, p, 'saw', [-6, 0, 5], rng);
  const open = 1.2 + 4 * vel;
  const cut = (t: number) =>
    Math.min(5000, f * (1 + open * Math.min(1, t / 0.06) * (0.7 + 0.3 * Math.exp(-t / 0.3))));
  const bright = drive(filter(filter(src, 'lowpass', cut, 0.7), 'peak', 3800, 1, -4), 1.3);
  const warm = filter(osc(len, p, 'triangle', { phase: rng.next() }), 'lowpass', Math.min(2000, f * 3), 0.7);
  const breath = mul(
    filter(noise(len, rng), 'bandpass', Math.min(6000, f * 3), 1.5),
    env(len, [
      [0, 0],
      [0.03, 1],
      [0.12, 0.2],
      [len, 0.1],
    ]),
  );
  return mul(
    layer(len, [bright, 1], [warm, 0.45], [breath, 0.03]),
    mul(adsr(len, 0.035, 0.15, 0.82, 0.16), vel * 0.55),
  );
};

/** French horns: rounder and darker than the brass section. */
export const horn: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.25;
  const p = vibrato(f, 4.8, 0.003, 0.35);
  const src = layer(
    len,
    [ensemble(len, p, 'saw', [-5, 5], rng), 0.6],
    [osc(len, p, 'triangle', { phase: rng.next() }), 0.6],
  );
  const tone = filter(src, 'lowpass', Math.min(3000, f * (1.6 + 1.6 * vel)), 0.7);
  return mul(tone, mul(adsr(len, 0.05, 0.2, 0.85, 0.22), vel * 0.65));
};

// ---------------------------------------------------------------- rock

/** Picked rock bass: a bright pluck over a sine, lightly driven. */
export const rockBass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.08;
  const s = filter(pluck(len, f, rng, 0.6, 0.998), 'lowpass', 1600);
  return mul(
    drive(layer(len, [s, 0.8], [osc(len, f), 0.7]), 1.8),
    mul(adsr(len, 0.003, 0.25, 0.75, 0.05), vel * 0.75),
  );
};

/** Distorted power chord (root, fifth, octave) with a pick click, through a cabinet with the box scooped out;
 * notes shorter than 0.3 s are palm-muted. */
export const powerChord: Instrument = (f, dur, vel, rng) => {
  const muted = dur < 0.3;
  const len = dur + (muted ? 0.04 : 0.15);
  const loss = muted ? 0.992 : 0.9995;
  const strings = layer(
    len,
    [pluck(len, f, rng, 0.85, loss), 1],
    [pluck(len, f * 1.4983, rng, 0.85, loss), 0.8],
    [pluck(len, f * 2, rng, 0.85, loss), 0.55],
  );
  const pick = mul(filter(noise(0.01, rng), 'bandpass', 2500, 1), decay(0.01, 0.002, 0.0003));
  const fuzz = drive(filter(layer(len, [strings, 1], [pick, 0.4]), 'highpass', 110), 5);
  const cab = filter(
    filter(
      filter(filter(fuzz, 'lowpass', muted ? 2200 : 3400, 0.7), 'lowpass', 5200, 0.7),
      'peak',
      450,
      1.2,
      -5,
    ),
    'peak',
    1500,
    0.9,
    3,
  );
  return mul(cab, mul(adsr(len, 0.002, 0.08, muted ? 0.45 : 0.85, muted ? 0.03 : 0.12), vel * 0.3));
};

// ---------------------------------------------------------------- note helpers

const hash = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Human feel: velocity jitter of ±`vel` (relative) and lateness up to `time` beats, seeded. */
export function human(notes: Note[], seed: number, vel = 0.08, time = 0.012): Note[] {
  return notes.map((n, i) => ({
    ...n,
    t: n.t + hash(seed, i) * time,
    v: Math.max(0.05, Math.min(1, n.v * (1 + (hash(i, seed + 0.5) - 0.5) * 2 * vel))),
  }));
}

/** Scale velocities by a function of time in beats (phrase arcs, crescendos). */
export function arc(notes: Note[], fn: (t: number) => number): Note[] {
  return notes.map((n) => ({ ...n, v: Math.max(0.03, Math.min(1, n.v * fn(n.t))) }));
}

/** Velocity accents by position in the beat grid: `weights[k]` for the k-th `step` of each `every` beats. */
export function accents(notes: Note[], weights: number[], step = 0.25, every = 1): Note[] {
  return notes.map((n) => {
    const k = Math.round((((n.t % every) + every) % every) / step) % weights.length;
    return { ...n, v: Math.max(0.03, Math.min(1, n.v * weights[k]!)) };
  });
}

/** Delay-line repeats of `notes` (for a panned echo track): `repeats` copies `delay` beats apart. */
export function echoes(notes: Note[], delay: number, repeats: number, feedback: number): Note[] {
  return Array.from({ length: repeats }, (_, k) =>
    notes.map((n) => ({ ...n, t: n.t + (k + 1) * delay, v: n.v * feedback ** (k + 1) })),
  ).flat();
}

/** A linear ramp in beats, for `arc`: `from` before `t0`, `to` after `t1`. */
export const ramp =
  (t0: number, t1: number, from: number, to: number) =>
  (t: number): number =>
    t <= t0 ? from : t >= t1 ? to : from + ((to - from) * (t - t0)) / (t1 - t0);

/** Phrase arc: notes swell towards the middle of each `len`-beat phrase by up to `amount`. */
export const phrase =
  (len: number, amount: number) =>
  (t: number): number =>
    1 - amount + amount * Math.sin((Math.PI * (((t % len) + len) % len)) / len);
