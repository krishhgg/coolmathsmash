/**
 * Timbres and arranging helpers for the action-group stage themes (Bob the Robber, The World's Hardest Game,
 * Raft Wars, Johnny Upgrade). Instruments follow the INSTRUMENTS contract: one mono note at full scale for
 * velocity 1, `dur` the held length in seconds, the returned buffer includes the release. Velocity shapes
 * timbre as well as level (harder notes are brighter), so phrase contours read as playing, not as a fader.
 */
import {
  Rng,
  SR,
  adsr,
  decay,
  drive,
  env,
  filter,
  layer,
  mul,
  noise,
  osc,
  partials,
  pluck,
} from '../../dsp.ts';
import type { Instrument } from '../instruments.ts';
import type { Note } from '../notes.ts';

type Hz = (t: number) => number;

/** A buffer read as a function of time, for time-varying filter cutoffs. */
const curve = (x: Float32Array, max = 16000): Hz => {
  return (t) => Math.min(max, x[Math.min(x.length - 1, Math.round(t * SR))]!);
};

/** Pitch with delayed vibrato and an attack scoop from `scoop` cents. */
const voice =
  (f: number, rate: number, depth: number, delay: number, scoop = 0): Hz =>
  (t) =>
    f *
    (1 + (t > delay ? depth * Math.min(1, (t - delay) * 3) * Math.sin(2 * Math.PI * rate * t) : 0)) *
    2 ** ((scoop * Math.exp(-t / 0.045)) / 1200);

/** Detuned oscillator stack (cents), phases spread so the stack never starts as one spike. */
const stack = (len: number, f: Hz, shape: 'saw' | 'square' | 'pulse', cents: number[], width = 0.5) =>
  layer(
    len,
    ...cents.map(
      (c, i) =>
        [
          osc(len, (t) => f(t) * 2 ** (c / 1200), shape, { width, phase: (i * 0.618) % 1 }),
          1 / cents.length,
        ] as const,
    ),
  );

/** A buffer of fn(t). */
const shape = (seconds: number, fn: (t: number) => number) => {
  const x = new Float32Array(Math.max(1, Math.round(seconds * SR)));
  for (let i = 0; i < x.length; i++) x[i] = fn(i / SR);
  return x;
};

// ---------------------------------------------------------------- drums

/** Kick with a pitch-swept body, a soft beater click and a little saturation; softer hits are rounder. */
export const kick: Instrument = (_f, _d, vel, rng) => {
  const len = 0.55;
  const body = mul(
    osc(len, (t) => 52 + 90 * Math.exp(-t / 0.03) + 70 * Math.exp(-t / 0.004)),
    decay(len, 0.2 + 0.1 * vel, 0.0015),
  );
  const click = mul(filter(noise(0.014, rng), 'bandpass', 3500, 1.1), decay(0.014, 0.003, 0.0004));
  const x = layer(len, [body, 1], [click, 0.25 + 0.3 * vel]);
  return mul(filter(drive(mul(x, 0.6 + 0.4 * vel), 1.6), 'lowpass', 8000), vel * 0.95);
};

/** Snare: a tuned shell (two modes) under wires; velocity opens the wires and the crack. */
export const snare: Instrument = (f, _d, vel, rng) => {
  const len = 0.45;
  const tune = f > 40 ? f / 196 : 1;
  const shell = mul(
    layer(
      len,
      [osc(len, (t) => 196 * tune * (1 + 0.28 * Math.exp(-t / 0.01))), 1],
      [osc(len, (t) => 342 * tune * (1 + 0.2 * Math.exp(-t / 0.008))), 0.4],
    ),
    decay(len, 0.08 + 0.03 * vel, 0.001),
  );
  const wires = mul(
    filter(filter(noise(len, rng), 'highpass', 900), 'lowpass', 5000 + 6000 * vel),
    decay(len, 0.1 + 0.08 * vel, 0.0015),
  );
  const snapNoise = mul(filter(noise(0.04, rng), 'bandpass', 4500, 1.2), decay(0.04, 0.012, 0.0004));
  const x = layer(len, [shell, 1], [wires, 0.5 + 0.25 * vel], [snapNoise, 0.35 + 0.35 * vel]);
  return mul(drive(x, 1.3), vel * 0.85);
};

/** Cross-stick / rim click: woody, short. */
export const rim: Instrument = (_f, _d, vel, rng) => {
  const len = 0.12;
  const wood = partials(len, 520, [
    [1, 1, 0.025],
    [2.62, 0.5, 0.015],
    [4.1, 0.25, 0.008],
  ]);
  const tick = mul(filter(noise(0.006, rng), 'highpass', 2500), decay(0.006, 0.0015, 0.0002));
  return mul(layer(len, [wood, 1], [tick, 0.4]), vel * 0.8);
};

/** Brush: a swish held for the note (circles) that ends in a soft tap. */
export const brushSweep: Instrument = (_f, dur, vel, rng) => {
  const len = dur + 0.12;
  const swish = filter(filter(noise(len, rng), 'bandpass', 2600 + 2600 * vel, 0.7), 'lowpass', 8000);
  const amp = env(len, [
    [0, 0],
    [Math.min(0.08, dur * 0.4), 0.6],
    [dur, 0.3],
    [len, 0],
  ]);
  return mul(swish, mul(amp, vel * 0.5));
};

/** Brush slap on the snare: a wide burst of wires with a short tail. */
export const brushSlap: Instrument = (_f, _d, vel, rng) => {
  const len = 0.3;
  const wires = mul(filter(noise(len, rng), 'bandpass', 3000, 0.6), decay(len, 0.07 + 0.04 * vel, 0.003));
  const body = mul(osc(len, 190), decay(len, 0.03, 0.002));
  return mul(layer(len, [wires, 1], [body, 0.25]), vel * 0.8);
};

/** Finger snap. */
export const snap: Instrument = (_f, _d, vel, rng) => {
  const len = 0.14;
  const burst = mul(filter(noise(len, rng), 'bandpass', 2600, 2), decay(len, 0.02, 0.0004));
  const pop = mul(osc(len, 1700), decay(len, 0.006, 0.0003));
  return mul(layer(len, [burst, 1], [pop, 0.15]), vel * 1.5);
};

/** 808-style inharmonic square cluster, the metal under hats and cymbals. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
const metal = (len: number, scale: number) =>
  layer(len, ...METAL.map((f, i) => [osc(len, f * scale, 'square', { phase: i * 0.37 }), 1 / 6] as const));

const cymbal = (len: number, rng: Rng, tau: number, hp: number, scale: number) => {
  const tone = filter(filter(metal(len, scale), 'bandpass', 8500, 0.8), 'highpass', hp);
  const air = filter(filter(noise(len, rng), 'highpass', hp), 'lowpass', 14000);
  return mul(layer(len, [tone, 0.7], [air, 0.55]), decay(len, tau, 0.0008));
};

export const hat: Instrument = (_f, _d, vel, rng) =>
  mul(cymbal(0.14, rng, 0.02 + 0.025 * vel, 6000, 1.7), vel * 0.5);

export const openHat: Instrument = (_f, _d, vel, rng) => mul(cymbal(0.6, rng, 0.17, 5500, 1.7), vel * 0.42);

/** Pedal hi-hat "chick". */
export const pedalHat: Instrument = (_f, _d, vel, rng) =>
  mul(filter(cymbal(0.1, rng, 0.015, 3500, 1.5), 'lowpass', 9000), vel * 0.5);

/** Jazz ride: a bell-ish ping over a long wash. */
export const ride: Instrument = (_f, _d, vel, rng) => {
  const len = 1.5;
  const ping = partials(len, 470, [
    [5.31, 0.3, 0.55],
    [7.13, 0.22, 0.45],
    [8.87, 0.16, 0.4],
    [11.42, 0.12, 0.3],
    [13.66, 0.08, 0.25],
  ]);
  const wash = mul(cymbal(len, rng, 0.5, 4500, 2.1), 0.7);
  const tick = mul(filter(noise(0.01, rng), 'bandpass', 5500, 1.2), decay(0.01, 0.002, 0.0002));
  return mul(layer(len, [ping, 0.45], [wash, 0.5], [tick, 0.35 * vel]), vel * 0.45);
};

/** Crash with a soft bloom. */
export const crash: Instrument = (_f, _d, vel, rng) => {
  const len = 2.4;
  const c = cymbal(len, rng, 0.75, 3200, 1.3);
  const bloom = env(len, [
    [0, 0],
    [0.004, 1],
    [0.05, 0.75],
    [len, 0.75],
  ]);
  return mul(filter(c, 'lowpass', 12000), mul(bloom, vel * 0.6));
};

/** A reversed cymbal: swells over the note and stops dead at its end (a lead-in to a downbeat). */
export const swell: Instrument = (_f, dur, vel, rng) => {
  const len = dur;
  const c = filter(filter(noise(len, rng), 'highpass', 3500), 'lowpass', (t) => 4000 + 9000 * (t / len));
  return mul(
    c,
    shape(len, (t) => vel * 0.5 * (t / len) ** 2.5 * Math.min(1, (len - t) / 0.004)),
  );
};

/** Noise riser: a band-pass sweep that climbs over the note. */
export const riser: Instrument = (_f, dur, vel, rng) => {
  const len = dur;
  const x = filter(noise(len, rng), 'bandpass', (t) => 400 * 25 ** Math.min(1, t / len), 1.8);
  return mul(
    x,
    shape(len, (t) => vel * 0.9 * (t / len) ** 1.6 * Math.min(1, (len - t) / 0.004)),
  );
};

/** Tom: pitched body with a stick attack; tune it with the note. */
export const tom: Instrument = (f, _d, vel, rng) => {
  const len = 0.7;
  const body = mul(
    osc(len, (t) => f * (1 + 0.45 * Math.exp(-t / 0.035))),
    decay(len, 0.22 + 0.1 * vel, 0.0015),
  );
  const over = mul(
    osc(len, (t) => f * 1.6 * (1 + 0.3 * Math.exp(-t / 0.03))),
    decay(len, 0.06, 0.001),
  );
  const stick = mul(filter(noise(0.015, rng), 'bandpass', f * 6, 1), decay(0.015, 0.004, 0.0004));
  return mul(drive(layer(len, [body, 1], [over, 0.25], [stick, 0.35]), 1.4), vel * 0.85);
};

/** Conga/bongo with a palm slap; tune it with the note. */
export const conga: Instrument = (f, _d, vel, rng) => {
  const len = 0.35;
  const head = mul(
    osc(len, (t) => f * (1 + 0.18 * Math.exp(-t / 0.012))),
    decay(len, 0.09, 0.001),
  );
  const ring = mul(osc(len, f * 1.52), decay(len, 0.04, 0.001));
  const slap = mul(filter(noise(0.02, rng), 'bandpass', f * 5, 1.2), decay(0.02, 0.005, 0.0004));
  return mul(layer(len, [head, 1], [ring, 0.2], [slap, 0.25 + 0.35 * vel]), vel * 0.8);
};

/** Timbale: bright metal shell ring. */
export const timbale: Instrument = (f, _d, vel, rng) => {
  const len = 0.6;
  const shell = partials(len, f, [
    [1, 1, 0.16],
    [1.59, 0.55, 0.11],
    [2.31, 0.35, 0.08],
    [3.14, 0.2, 0.05],
  ]);
  const crack = mul(filter(noise(0.01, rng), 'bandpass', 4200, 1), decay(0.01, 0.0025, 0.0003));
  return mul(layer(len, [shell, 1], [crack, 0.5]), vel * 0.6);
};

/** Cowbell / agogo: two detuned square partials through a band-pass. */
export const bell2: Instrument = (f, _d, vel) => {
  const len = 0.3;
  const x = layer(len, [osc(len, f, 'square'), 0.5], [osc(len, f * 1.48, 'square'), 0.5]);
  return mul(filter(x, 'bandpass', f * 2, 1.5), mul(decay(len, 0.07, 0.0008), vel * 0.5));
};

// ---------------------------------------------------------------- basses

/** Upright bass: a dark plucked string over its fundamental, with a finger thump. */
export const upright: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.12;
  const str = filter(pluck(len, f, rng, 0.25 + 0.3 * vel, 0.9975), 'lowpass', 650 + 900 * vel);
  const fund = mul(layer(len, [osc(len, f), 1], [osc(len, f * 2), 0.15]), decay(len, 0.6, 0.006));
  const thump = mul(filter(noise(0.05, rng), 'lowpass', 300), decay(0.05, 0.012, 0.001));
  const finger = mul(filter(noise(0.02, rng), 'bandpass', 1400, 1.5), decay(0.02, 0.004, 0.0005));
  const amp = env(len, [
    [0, 1],
    [Math.max(0.04, dur), 0.7],
    [len, 0],
  ]);
  const x = layer(len, [str, 0.8], [fund, 0.75], [thump, 0.35 * vel], [finger, 0.12 * vel]);
  return mul(filter(x, 'peak', 300, 1.2, -3), mul(amp, vel * 0.85));
};

/** Electric finger bass, round and bouncy. */
export const fingerBass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.06;
  const str = filter(pluck(len, f, rng, 0.4 + 0.3 * vel, 0.998), 'lowpass', 900 + 800 * vel);
  const body = layer(len, [osc(len, f), 0.7], [osc(len, f * 2), 0.12]);
  return mul(
    filter(layer(len, [str, 0.75], [body, 0.7]), 'peak', 140, 1, 2.5),
    mul(adsr(len, 0.004, 0.25, 0.75, 0.05), vel * 0.85),
  );
};

/** House bass: sub sine under a plucky saw. */
export const pumpBass: Instrument = (f, dur, vel) => {
  const len = dur + 0.04;
  const cut = env(len, [
    [0, f * (5 + 7 * vel)],
    [0.08, f * 2.4],
    [len, f * 2],
  ]);
  const saw = filter(
    stack(len, () => f, 'saw', [-7, 7]),
    'lowpass',
    curve(cut),
    1.8,
  );
  return mul(layer(len, [saw, 0.55], [osc(len, f), 0.85]), mul(adsr(len, 0.003, 0.1, 0.75, 0.03), vel * 0.8));
};

/** Picked rock bass: driven saw and square over a sub. */
export const pickBass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.05;
  const tone = filter(
    drive(layer(len, [osc(len, f, 'saw'), 0.6], [osc(len, f, 'square'), 0.3]), 2),
    'lowpass',
    (t) => f * 3 + 1400 * vel * Math.exp(-t / 0.07),
    0.9,
  );
  const pick = mul(filter(noise(0.01, rng), 'highpass', 2000), decay(0.01, 0.002));
  return mul(
    layer(len, [tone, 0.5], [osc(len, f), 0.65], [pick, 0.12]),
    mul(adsr(len, 0.002, 0.12, 0.8, 0.03), vel * 0.8),
  );
};

// ---------------------------------------------------------------- winds

/**
 * Harmon-muted trumpet: a thin, focused tone with the mute's resonance around 1.7 kHz. Long notes scoop up
 * further and take a slower, deeper vibrato, as a player leans into them; short notes stay straight.
 */
export const mutedTrumpet: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.1;
  const long = Math.min(1, dur / 0.6);
  const fr = voice(f, 5.2, 0.003 + 0.009 * long, 0.14 + 0.06 * long, -30 - 70 * long);
  const src = layer(
    len,
    [osc(len, fr, 'saw'), 0.55],
    [osc(len, fr, 'pulse', { width: 0.34 }), 0.25],
    [osc(len, fr), 0.3],
  );
  const cut = env(len, [
    [0, f * 2.2],
    [0.04, f * (3.5 + 4 * vel)],
    [len, f * (2.8 + 2 * vel)],
  ]);
  let x = filter(src, 'lowpass', curve(cut, 8000), 0.8);
  x = filter(x, 'highpass', 380, 0.7);
  x = filter(x, 'peak', 1700, 1.3, 4);
  x = filter(x, 'peak', 3300, 1.5, -2.5);
  x = filter(x, 'lowpass', 6000);
  const breath = mul(filter(noise(len, rng), 'bandpass', 1900, 0.9), 0.03 + 0.02 * vel);
  const puff = mul(filter(noise(0.06, rng), 'bandpass', 1500, 0.9), decay(0.06, 0.02, 0.002));
  const wobble = shape(len, (t) => 1 + 0.04 * Math.sin(2 * Math.PI * 2.7 * t + f));
  return mul(
    layer(len, [mul(x, wobble), 1], [breath, 1], [puff, 0.3 * vel]),
    mul(adsr(len, 0.02, 0.12, 0.8, 0.07), vel * 0.6),
  );
};

/** Tenor sax: reedy pulse/saw through vowel-ish formants, breath and a touch of growl when pushed; long notes scoop and sing. */
export const tenorSax: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.12;
  const long = Math.min(1, dur / 0.6);
  const fr = voice(f, 5, 0.005 + 0.01 * long, 0.18 + 0.07 * long, -25 - 60 * long);
  const src = layer(len, [osc(len, fr, 'saw'), 0.55], [osc(len, fr, 'pulse', { width: 0.43 }), 0.45]);
  const cut = env(len, [
    [0, f * 2],
    [0.05, f * (3 + 3.5 * vel)],
    [len, f * (2.5 + 1.5 * vel)],
  ]);
  let x = filter(src, 'lowpass', curve(cut, 5000), 0.9);
  x = filter(x, 'peak', 600, 1, 4.5);
  x = filter(x, 'peak', 1500, 2, 1.5);
  x = filter(x, 'peak', 2900, 1.6, -3.5);
  x = drive(x, 1 + 1.4 * vel);
  const breath = mul(filter(noise(len, rng), 'bandpass', 1300, 0.9), 0.065);
  const puff = mul(filter(noise(0.05, rng), 'bandpass', 900, 1), decay(0.05, 0.015, 0.002));
  return mul(
    filter(layer(len, [x, 1], [breath, 1], [puff, 0.3]), 'lowpass', 4800),
    mul(adsr(len, 0.03, 0.12, 0.82, 0.09), vel * 0.5),
  );
};

/** One brass voice; `fall` drops the pitch away over the end of the note. */
const brassVoice = (f: number, dur: number, vel: number, rng: Rng, fall: boolean) => {
  const len = dur + (fall ? 0.05 : 0.12);
  const drop = (t: number) => (fall ? 2 ** ((-5 * Math.max(0, (t - (dur - 0.14)) / 0.18) ** 2) / 12) : 1);
  const vib = voice(f, 5.4, 0.006, 0.25, -30);
  const fr: Hz = (t) => vib(t) * drop(t);
  const cut = env(len, [
    [0, f * 1.5],
    [0.025, f * (3.5 + 6 * vel)],
    [0.2, f * (3 + 2.5 * vel)],
    [len, f * 2.5],
  ]);
  let x = filter(stack(len, fr, 'saw', [-7, 0, 6]), 'lowpass', curve(cut, 9000), 1.1);
  x = filter(x, 'peak', 1200, 1, 2);
  x = filter(x, 'peak', 2800, 1.4, 2.5);
  const breath = mul(filter(noise(len, rng), 'bandpass', f * 3, 2), 0.03);
  const amp = fall
    ? env(len, [
        [0, 0],
        [0.012, 1],
        [0.1, 0.85],
        [Math.max(0.11, dur - 0.1), 0.8],
        [len, 0],
      ])
    : adsr(len, 0.014, 0.1, 0.8, 0.08);
  return mul(filter(layer(len, [x, 1], [breath, 1]), 'lowpass', 7500), mul(amp, vel * 0.55));
};

/** Open brass (trumpets/trombones): bright, snappy attacks on accents, darker when soft. */
export const horn: Instrument = (f, dur, vel, rng) => brassVoice(f, dur, vel, rng, false);

/** The same brass with a fall-off: the pitch drops away at the end of the note (phrase endings). */
export const hornFall: Instrument = (f, dur, vel, rng) => brassVoice(f, dur, vel, rng, true);

/** Slide whistle: glides up to the note over its first half, then wobbles. */
export const slideWhistle: Instrument = (f, dur, vel) => {
  const len = dur + 0.05;
  const glide = Math.max(0.05, dur * 0.5);
  const fr: Hz = (t) =>
    f * 2 ** -(Math.max(0, 1 - t / glide) ** 2) * (1 + 0.012 * Math.sin(2 * Math.PI * 6.5 * t));
  return mul(osc(len, fr), mul(adsr(len, 0.02, 0.05, 0.9, 0.05), vel * 0.4));
};

// ---------------------------------------------------------------- mallets, plucks, keys

/** Vibraphone: soft bar partials with the motor's tremolo, damped at note-off. */
export const vibes: Instrument = (f, dur, vel) => {
  const hold = Math.max(0.15, dur);
  const len = hold + 0.35;
  const bar = partials(len, f, [
    [1, 1, 1.8],
    [4, 0.12 + 0.12 * vel, 0.22],
    [10, 0.04 * vel, 0.05],
  ]);
  const amp = shape(len, (t) => {
    const trem = 1 - 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 5.2 * t));
    const damp = t < hold ? 1 : Math.max(0, 1 - (t - hold) / 0.35);
    return trem * damp * Math.min(1, t / 0.003);
  });
  return mul(bar, mul(amp, vel * 0.55));
};

/** Steel pan: tuned fundamental, octave and twelfth with a stick strike and a slight shimmer. */
export const steelPan: Instrument = (f, dur, vel, rng) => {
  const len = Math.min(1.6, Math.max(0.7, dur + 0.45));
  const fr: Hz = (t) => f * (1 + 0.004 * Math.exp(-t / 0.02));
  const part = (ratio: number, cents: number, gain: number, tau: number) =>
    mul(
      osc(len, (t) => fr(t) * ratio * 2 ** (cents / 1200)),
      mul(decay(len, tau, 0.003), gain),
    );
  const top = Math.min(1, 1400 / f);
  const tone = layer(
    len,
    [part(1, 0, 1, 0.6), 1],
    [part(1, 6, 0.3, 0.45), 1],
    [part(2, 2, (0.38 + 0.12 * vel) * top, 0.3), 1],
    [part(3, -3, (0.1 + 0.06 * vel) * top * top, 0.12), 1],
  );
  const strike = mul(
    filter(noise(0.02, rng), 'bandpass', Math.min(2500, f * 2), 1.2),
    decay(0.02, 0.004, 0.002),
  );
  const damp = env(len, [
    [0, 1],
    [Math.max(0.12, dur + 0.25), 1],
    [len, 0],
  ]);
  const body = filter(layer(len, [tone, 1], [strike, 0.12]), 'peak', 850, 0.8, 2.5);
  return mul(filter(body, 'peak', 4500, 1, -3), mul(damp, vel * 0.5));
};

/** Twangy single-coil guitar (surf/spy): a bright pluck, a little drive, a presence bump. */
export const twang: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.35, dur + 0.25);
  const s = pluck(len, f, rng, 0.7 + 0.25 * vel, 0.9975);
  const x = drive(filter(filter(s, 'highpass', 140), 'peak', 2200, 1.2, 5), 1.6);
  const amp = env(len, [
    [0, 1],
    [Math.max(0.06, dur), 0.85],
    [len, 0],
  ]);
  return mul(filter(x, 'lowpass', 6000), mul(amp, vel * 0.6));
};

/** Ska/reggae guitar skank: one string of a choked offbeat chord. */
export const skank: Instrument = (f, _d, vel, rng) => {
  const len = 0.16;
  const s = pluck(len, f, rng, 0.9, 0.99);
  const chk = mul(filter(noise(0.012, rng), 'bandpass', 3200, 1), decay(0.012, 0.003));
  let x = filter(layer(len, [s, 1], [chk, 0.3]), 'highpass', 280);
  x = filter(x, 'peak', 3000, 1, 3);
  return mul(x, mul(decay(len, 0.05, 0.001), vel * 0.8));
};

/** Percussive organ (ska "bubble"): drawbars with a fast decay to a low sustain. */
export const bubbleOrgan: Instrument = (f, dur, vel) => {
  const len = dur + 0.03;
  const x = layer(
    len,
    [osc(len, f), 0.55],
    [osc(len, f * 2), 0.35],
    [osc(len, f * 3), 0.25],
    [osc(len, f * 4), 0.1],
  );
  return mul(filter(x, 'lowpass', 5000), mul(adsr(len, 0.004, 0.08, 0.45, 0.03), vel * 0.45));
};

/** Mellow comping piano with a felt-hammer attack. */
export const compPiano: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.3;
  const B = 0.00035;
  const parts = [1, 2, 3, 4, 5, 6, 7].map(
    (k) =>
      [
        k * Math.sqrt(1 + B * k * k),
        (0.7 / k ** 1.3) * (k > 3 ? 0.4 + 0.6 * vel : 1),
        1.4 / (1 + k * 0.7) / Math.max(1, f / 350),
      ] as const,
  );
  const hammer = mul(filter(noise(0.015, rng), 'bandpass', f * 2.5, 1), decay(0.015, 0.003));
  const damp = env(len, [
    [0, 1],
    [dur, 1],
    [len, 0],
  ]);
  return mul(
    filter(layer(len, [partials(len, f, parts), 1], [hammer, 0.08]), 'lowpass', 2500 + 3500 * vel),
    mul(damp, vel * 0.6),
  );
};

// ---------------------------------------------------------------- synths

/** Supersaw pluck: a stack of seven saws with a snapping filter. */
export const sawPluck: Instrument = (f, dur, vel) => {
  const len = Math.max(0.3, dur + 0.25);
  const cut = env(len, [
    [0, f * (6 + 10 * vel)],
    [0.11, f * 2.6],
    [len, f * 1.6],
  ]);
  const x = filter(
    stack(len, () => f, 'saw', [-16, -9, -4, 0, 4, 9, 16]),
    'lowpass',
    curve(cut, 11000),
    1.3,
  );
  const amp = env(len, [
    [0, 0],
    [0.003, 1],
    [0.18, 0.5],
    [Math.max(0.19, dur), 0.35],
    [len, 0],
  ]);
  return mul(x, mul(amp, vel * 0.6));
};

/** Pulse-width-modulated chip lead with a soft top end. */
export const chipLead: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  const fr = voice(f, 6, 0.009, 0.18);
  const x = layer(
    len,
    [osc(len, fr, 'pulse', { width: (t) => 0.27 + 0.12 * Math.sin(2 * Math.PI * 0.9 * t) }), 0.75],
    [osc(len, (t) => fr(t) * 0.5 * 1.003, 'pulse', { width: 0.45 }), 0.3],
  );
  const y = filter(filter(x, 'lowpass', Math.min(5000, f * 7)), 'peak', 3000, 1, -3);
  return mul(y, mul(adsr(len, 0.005, 0.09, 0.72, 0.05), vel * 0.42));
};

/** Thin 12.5% pulse for fast arpeggios. */
export const chipArp: Instrument = (f, dur, vel) => {
  const len = dur + 0.02;
  return mul(
    filter(osc(len, f, 'pulse', { width: 0.125 }), 'lowpass', 7000),
    mul(adsr(len, 0.002, 0.05, 0.6, 0.015), vel * 0.4),
  );
};

/** Heroic lead: saw and pulse a hair apart, a sub-octave square, gently driven and tamed above 5 kHz. */
export const heroLead: Instrument = (f, dur, vel) => {
  const len = dur + 0.14;
  const fr = voice(f, 5.8, 0.012, 0.18, -40);
  const src = layer(
    len,
    [osc(len, fr, 'saw'), 0.5],
    [osc(len, (t) => fr(t) * 1.004, 'pulse', { width: 0.4 }), 0.35],
    [osc(len, (t) => fr(t) * 0.5, 'square'), 0.14],
  );
  const cut = env(len, [
    [0, f * 2],
    [0.03, f * (4 + 5 * vel)],
    [0.3, f * 4],
    [len, f * 3.5],
  ]);
  let x = drive(filter(src, 'lowpass', curve(cut, 8000), 1.1), 2);
  x = filter(x, 'peak', 2100, 1.2, -2.5);
  x = filter(x, 'peak', 4000, 1.2, 2);
  x = filter(x, 'lowpass', 6500);
  return mul(x, mul(adsr(len, 0.01, 0.2, 0.85, 0.12), vel * 0.45));
};

/**
 * Distorted power chord (root, fifth, octave) through an amp and a cabinet. Short notes are palm-muted chugs.
 * `side` picks the detune set, so a left and a right guitar are two different players.
 */
export const powerChord =
  (side: 0 | 1): Instrument =>
  (f, dur, vel) => {
    const len = dur + 0.07;
    const palm = dur < 0.22;
    const d = side === 0 ? [-5, 4, -3, 9] : [4, -6, 5, -8];
    // Run the amp at twice the sample rate (half the pitch over twice the time), then decimate: less fizz.
    const L = len * 2;
    const h = f / 2;
    const src = layer(
      L,
      [osc(L, h * 2 ** (d[0]! / 1200), 'saw', { phase: 0.1 + side * 0.3 }), 0.4],
      [osc(L, h * 2 ** (d[3]! / 1200), 'saw', { phase: 0.6 }), 0.25],
      [osc(L, h * 1.4983 * 2 ** (d[1]! / 1200), 'saw', { phase: 0.5 }), 0.35],
      [osc(L, h * 2 * 2 ** (d[2]! / 1200), 'saw', { phase: 0.8 - side * 0.2 }), 0.22],
    );
    let x = filter(src, 'lowpass', (palm ? 700 + 500 * vel : 2800) / 2);
    x = drive(mul(x, 1 + vel), 5);
    x = filter(x, 'highpass', 85 / 2);
    x = filter(x, 'peak', 240 / 2, 0.9, 3);
    x = filter(x, 'peak', 650 / 2, 1, -2.5);
    x = filter(x, 'peak', 2400 / 2, 1.2, 1.5);
    x = filter(filter(x, 'lowpass', (palm ? 2600 : 6000) / 2), 'lowpass', (palm ? 3200 : 6500) / 2);
    const y = new Float32Array(Math.round(len * SR));
    for (let i = 0; i < y.length; i++) y[i] = x[i * 2] ?? 0;
    return mul(y, mul(adsr(len, 0.003, palm ? 0.06 : 0.3, palm ? 0.35 : 0.85, 0.05), vel * 0.36));
  };

/** Sub drop: a deep sine falling from 70 to 30 Hz (impacts, boss slams). */
export const boom: Instrument = (_f, _d, vel) => {
  const len = 1.2;
  return mul(
    osc(len, (t) => 30 + 40 * Math.exp(-t / 0.25)),
    mul(decay(len, 0.45, 0.004), vel * 0.9),
  );
};

/** Downlifter: a band-pass noise sweep falling over the note, fading out. */
export const downlifter: Instrument = (_f, dur, vel, rng) => {
  const len = dur;
  const x = filter(noise(len, rng), 'bandpass', (t) => 9000 * (1 / 20) ** Math.min(1, t / len), 1.5);
  return mul(
    x,
    shape(len, (t) => vel * 0.8 * (1 - t / len) ** 1.5 * Math.min(1, t / 0.01)),
  );
};

/** Hook pluck: the supersaw pluck over a soft pulse an octave down, with the 3 kHz edge taken off. */
export const hookPluck: Instrument = (f, dur, vel, rng) => {
  const top = sawPluck(f, dur, vel, rng);
  const len = top.length / SR;
  const body = mul(
    filter(osc(len, f / 2, 'pulse', { width: 0.35 }), 'lowpass', Math.min(3000, f * 3)),
    env(len, [
      [0, 0],
      [0.004, 1],
      [0.25, 0.45],
      [Math.max(0.26, dur), 0.3],
      [len, 0],
    ]),
  );
  return filter(layer(len, [top, 1], [body, 0.3 * vel]), 'peak', 3200, 1, -3);
};

/**
 * Sidechain pump: duck an instrument on every beat from its note start (as a compressor keyed by a
 * four-on-the-floor kick would), `depth` 0..1. Notes should start on a beat.
 */
export const pumped =
  (inst: Instrument, bpm: number, depth = 0.6): Instrument =>
  (f, dur, vel, rng) => {
    const x = inst(f, dur, vel, rng);
    const beat = 60 / bpm;
    for (let i = 0; i < x.length; i++) {
      const ph = ((i / SR) % beat) / beat;
      x[i]! *= 1 - depth * Math.exp(-ph * 7);
    }
    return x;
  };

// ---------------------------------------------------------------- arranging helpers
/** Split phrase endings off (notes followed by `gap` beats of silence), for brass fall-offs: [body, endings]. */
export function falls(notes: Note[], gap = 0.75): [Note[], Note[]] {
  const ends = notes.filter(
    (n) => n.d <= 1.5 && !notes.some((m) => m !== n && m.t > n.t + 1e-6 && m.t < n.t + n.d + gap),
  );
  return [notes.filter((n) => !ends.includes(n)), ends];
}

/** Swing: delay off-beat eighths by `amount` beats (1/6 is triplet swing) and stretch on-beat eighths to meet them. */
export function swing(notes: Note[], amount: number): Note[] {
  return notes.map((n) => {
    const ph = ((n.t % 1) + 1) % 1;
    if (Math.abs(ph - 0.5) < 1e-6) return { ...n, t: n.t + amount, d: Math.max(0.05, n.d - amount) };
    if (ph < 1e-6 && Math.abs(n.d - 0.5) < 1e-6) return { ...n, d: n.d + amount };
    return n;
  });
}

/** Deterministic humanizing: start late by up to `time` beats, velocity ±`vel` (relative). */
export function humanize(notes: Note[], seed: number, time = 0.012, vel = 0.07): Note[] {
  const rng = new Rng(seed);
  return notes.map((n) => ({
    ...n,
    t: n.t + rng.next() * time,
    v: Math.max(0.05, Math.min(1, n.v * (1 + (rng.next() * 2 - 1) * vel))),
  }));
}

/** Metric accents: downbeats strongest, backbeats next, off-beats lighter. */
export function meter(notes: Note[], strength = 1): Note[] {
  return notes.map((n) => {
    const b = ((n.t % 4) + 4) % 4;
    const w = b < 1e-6 ? 1 : Math.abs(b - 2) < 1e-6 ? 0.94 : b % 1 < 1e-6 ? 0.88 : 0.8;
    return { ...n, v: n.v * (1 - strength + strength * w) };
  });
}

/** Phrase arcs: each `beats`-long phrase swells to its middle and relaxes, and higher notes lean louder. */
export function phrase(notes: Note[], beats: number, depth = 0.15): Note[] {
  const mean = notes.reduce((s, n) => s + n.n, 0) / Math.max(1, notes.length);
  return notes.map((n) => {
    const pos = (((n.t % beats) + beats) % beats) / beats;
    const arc = 1 - depth + depth * Math.sin(Math.PI * pos);
    const lift = 1 + Math.max(-0.12, Math.min(0.12, (n.n - mean) * 0.012));
    return { ...n, v: Math.min(1, n.v * arc * lift) };
  });
}

/** Scale velocities by a function of time in beats (crescendos, sections). */
export function dyn(notes: Note[], fn: (t: number) => number): Note[] {
  return notes.map((n) => ({ ...n, v: Math.min(1, n.v * fn(n.t)) }));
}

/** Keep only notes in [from, to) beats. */
export function within(notes: Note[], from: number, to: number): Note[] {
  return notes.filter((n) => n.t >= from - 1e-9 && n.t < to - 1e-9);
}

/** Tremolo rolls: notes at least `min` beats long become strikes every `rate` beats, the repeats softer. */
export function roll(notes: Note[], min: number, rate: number): Note[] {
  return notes.flatMap((n) => {
    if (n.d < min) return [n];
    const count = Math.max(1, Math.floor(n.d / rate + 1e-6));
    return Array.from({ length: count }, (_, i) => ({
      t: n.t + i * rate,
      d: rate,
      n: n.n,
      v: n.v * (i === 0 ? 1 : 0.6 + 0.08 * Math.sin(i * 1.7)),
    }));
  });
}

/** Move every note `steps` degrees along `scale` (pitch classes); notes outside it move `fallback` semitones. */
export function diatonic(notes: Note[], scale: number[], steps: number, fallback = -3): Note[] {
  const degrees = Array.from({ length: 128 }, (_, m) => m).filter((m) => scale.includes(m % 12));
  return notes.map((n) => {
    const i = degrees.indexOf(n.n);
    return { ...n, n: i < 0 ? n.n + fallback : (degrees[i + steps] ?? n.n) };
  });
}

/** A linear ramp from `a` at beat `t0` to `b` at beat `t1` (held outside). */
export const ramp =
  (t0: number, t1: number, a: number, b: number) =>
  (t: number): number =>
    a + (b - a) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
