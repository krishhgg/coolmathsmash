/**
 * Instruments for the music renderer. Each renders one note, mono, at full scale for velocity 1: `f` in Hz,
 * `dur` the held length in seconds (the returned buffer also holds the release). Add new ones freely; a
 * song names them by key in INSTRUMENTS.
 */
import type { Rng } from '../dsp.ts';
import {
  SR,
  adsr,
  buffer,
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
} from '../dsp.ts';

/** What a note may ask of its instrument beyond pitch, length and velocity; instruments ignore what they lack. */
export interface NoteOpts {
  /** Slide into the note from this many semitones away (portamento). */
  glide?: number;
}

export type Instrument = (f: number, dur: number, vel: number, rng: Rng, opts?: NoteOpts) => Float32Array;

const vib =
  (f: number, rate: number, depth: number, delay = 0.15) =>
  (t: number) =>
    f * (1 + (t > delay ? depth * Math.min(1, (t - delay) * 4) * Math.sin(2 * Math.PI * rate * t) : 0));

/**
 * Pitch over time for played parts: a portamento from `glide` semitones away, a quick `scoop` (semitones,
 * negative from below) like a horn player's attack, then vibrato fading in after `delay` seconds.
 */
const expressive =
  (f: number, o: { glide?: number; scoop?: number; rate?: number; depth?: number; delay?: number } = {}) =>
  (t: number) => {
    const slide = (o.glide ?? 0) * Math.exp(-t / 0.035) + (o.scoop ?? 0) * Math.exp(-t / 0.018);
    const d = o.delay ?? 0.25;
    const v =
      t > d
        ? (o.depth ?? 0.006) * Math.min(1, (t - d) * 3) * Math.sin(2 * Math.PI * (o.rate ?? 5.5) * (t - d))
        : 0;
    return f * 2 ** (slide / 12) * (1 + v);
  };

/**
 * Expression across a held note, like a player's breath or bow: notes longer than a third of a second swell
 * by about 1.5 dB into their middle and ease off toward the release. Returns a gain around 1.
 */
const swellOf = (dur: number) => (t: number) =>
  dur < 0.35 ? 1 : 1 + 0.2 * Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5;

/** An envelope buffer read as a function of time, for time-varying filter cutoffs. */
const follow = (e: Float32Array) => (t: number) => e[Math.min(e.length - 1, Math.round(t * SR))]!;

/** Sum of detuned oscillators (cents). */
const unison = (
  len: number,
  f: (t: number) => number,
  shape: 'saw' | 'square' | 'pulse' | 'triangle',
  cents: number[],
  width = 0.5,
) =>
  layer(
    len,
    ...cents.map(
      (c) =>
        [
          osc(len, (t) => f(t) * 2 ** (c / 1200), shape, { width, phase: (c * 0.137) % 1 }),
          1 / cents.length,
        ] as const,
    ),
  );

/** An ensemble: detuned saws that each drift slowly on their own, so the section breathes like players. */
const ensemble = (len: number, f: (t: number) => number, cents: number[], drift = 0.0025) =>
  layer(
    len,
    ...cents.map(
      (c, k) =>
        [
          osc(
            len,
            (t) => f(t) * 2 ** (c / 1200) * (1 + drift * Math.sin(2 * Math.PI * (0.19 + 0.067 * k) * t + k)),
            'saw',
            { phase: (k * 0.379) % 1 },
          ),
          1 / cents.length,
        ] as const,
    ),
  );

/** Six square oscillators at the inharmonic ratios of an analog cymbal (TR-808), scaled by `k`. */
const metal = (len: number, k = 1) =>
  layer(
    len,
    ...[205.3, 304.4, 369.6, 522.7, 540, 800].map(
      (hz, i) => [osc(len, hz * k, 'square', { phase: i * 0.23 }), 1 / 6] as const,
    ),
  );

/** An amplitude envelope from a function of time. */
const shape = (len: number, fn: (t: number) => number) => {
  const x = buffer(len);
  for (let i = 0; i < x.length; i++) x[i] = fn(i / SR);
  return x;
};

// ---------------------------------------------------------------- leads

/** Chiptune pulse lead (NES-like), 25% duty, light vibrato. */
const chip: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  return mul(
    osc(len, vib(f, 6, 0.006, 0.2), 'pulse', { width: 0.25 }),
    mul(adsr(len, 0.004, 0.08, 0.75, 0.05), vel * 0.5),
  );
};

/** Square lead, rounder: 50% duty through a low-pass. */
const square: Instrument = (f, dur, vel) => {
  const len = dur + 0.08;
  return mul(
    filter(osc(len, vib(f, 5.5, 0.007), 'square'), 'lowpass', Math.min(9000, f * 8)),
    mul(adsr(len, 0.005, 0.1, 0.7, 0.07), vel * 0.5),
  );
};

/**
 * Bright synth lead: four detuned saws and a quiet octave-down saw through a filter envelope that opens on
 * the attack and settles, a small dip in the harsh 3 kHz band, delayed vibrato, and portamento.
 */
const sawLead: Instrument = (f, dur, vel, _rng, o) => {
  const len = dur + 0.14;
  const pitch = expressive(f, { glide: o?.glide, depth: 0.007, delay: 0.22 });
  const settle = Math.min(6000, Math.max(2200, f * 4));
  const cut = env(len, [
    [0, Math.min(12000, settle * (1.6 + 0.8 * vel))],
    [0.2, settle],
    [len, settle * 0.9],
  ]);
  const tone = layer(
    len,
    [unison(len, pitch, 'saw', [-11, -4, 4, 11]), 0.85],
    [osc(len, (t) => pitch(t) / 2, 'saw'), 0.25],
  );
  return mul(
    filter(filter(tone, 'lowpass', follow(cut), 0.9), 'peak', 3200, 0.9, -2.5),
    mul(adsr(len, 0.008, 0.18, 0.78, 0.1), vel * 0.78),
  );
};

/**
 * Hero lead: a brass-synth hybrid for big melodies. Four detuned saws and a quiet octave-down saw through a
 * smooth 24 dB low-pass that blooms with velocity (up to about 6 kHz) and settles near 2.2-3 kHz, a brass
 * formant at 1.25 kHz with the nasal 2.9 kHz band tamed, a breathy blat on the attack, a scoop into each
 * note, portamento, delayed 5.5 Hz vibrato, a swell across long notes, a little saturation, and small
 * per-note differences in tuning and attack, like takes of a real player.
 */
const heroLead: Instrument = (f, dur, vel, rng, o) => {
  const len = dur + 0.18;
  const take = f * 2 ** (rng.range(-4, 4) / 1200);
  const pitch = expressive(take, {
    glide: o?.glide,
    scoop: -0.25,
    depth: 0.0065,
    delay: 0.24 + 0.06 * rng.next(),
  });
  const swell = swellOf(dur);
  const floor = Math.max(2200, f * 3);
  const top = Math.max(floor * 1.2, 2600 + 3400 * vel);
  const cut = follow(
    env(len, [
      [0, top * 0.6],
      [0.025, top],
      [0.4, floor],
      [len, floor],
    ]),
  );
  const tone = layer(
    len,
    [unison(len, pitch, 'saw', [-9, -3, 3, 9]), 0.85],
    [osc(len, (t) => pitch(t) / 2, 'saw'), 0.15],
  );
  const lp = filter(
    filter(tone, 'lowpass', (t) => cut(t) * swell(t), 0.55),
    'lowpass',
    (t) => cut(t) * swell(t) * 1.7,
    0.6,
  );
  const voiced = filter(filter(lp, 'peak', 1250, 1, 2), 'peak', 2900, 1.5, -2);
  const blat = mul(filter(noise(len, rng), 'bandpass', 1800, 0.8), decay(len, 0.05, 0.003));
  return mul(
    drive(layer(len, [voiced, 1], [blat, 0.12 * vel]), 1.3),
    mul(mul(adsr(len, 0.012 + 0.01 * rng.next(), 0.25, 0.8, 0.14), shape(len, swell)), vel * 0.5),
  );
};

/**
 * Brass section: detuned saws scooping up into pitch, a filter that swells open with velocity then settles,
 * a horn formant around 1.1 kHz, breath, and a little saturation.
 */
const brass: Instrument = (f, dur, vel, rng, o) => {
  const len = dur + 0.16;
  const take = f * 2 ** (rng.range(-4, 4) / 1200);
  const pitch = expressive(take, { glide: o?.glide, scoop: -0.3, rate: 5, depth: 0.005, delay: 0.3 });
  const swell = swellOf(dur);
  const settle = Math.max(900, f * 3.5);
  const cut = follow(
    env(len, [
      [0, f * 1.3],
      [0.05 + 0.04 * (1 - vel), Math.min(6000, f * (3 + 4 * vel))],
      [0.35, settle],
      [len, settle * 0.85],
    ]),
  );
  const tone = filter(
    filter(unison(len, pitch, 'saw', [-8, -2, 4, 9]), 'lowpass', (t) => cut(t) * swell(t), 0.6),
    'peak',
    1100,
    1.2,
    2.5,
  );
  const breath = mul(filter(noise(len, rng), 'bandpass', f * 3, 2), 0.04);
  return mul(
    drive(layer(len, [tone, 1], [breath, 1]), 1.4),
    mul(mul(adsr(len, 0.025, 0.14, 0.82, 0.13), shape(len, swell)), vel * 0.42),
  );
};

/** Synth-brass stab: wide saws plus an octave on top, a fast filter snap, a horn formant and drive. */
const brassStab: Instrument = (f, dur, vel, _rng, o) => {
  const len = dur + 0.12;
  const pitch = expressive(f, { glide: o?.glide, scoop: -0.4, depth: 0 });
  const settle = Math.max(1100, f * 2.6);
  const cut = env(len, [
    [0, f * 2],
    [0.012, Math.min(9000, f * (6 + 6 * vel))],
    [0.16, settle],
    [len, settle * 0.9],
  ]);
  const tone = layer(
    len,
    [unison(len, pitch, 'saw', [-13, -5, 0, 5, 13]), 0.8],
    [osc(len, (t) => pitch(t) * 2, 'saw'), 0.2],
  );
  return mul(
    drive(filter(filter(tone, 'lowpass', follow(cut), 1.1), 'peak', 1400, 1, 3), 2),
    mul(adsr(len, 0.005, 0.1, 0.6, 0.09), vel * 0.5),
  );
};

/**
 * French horns: mellow saws with a slow swell, a round body around 500 Hz and gentle vibrato, for soft
 * melodies, counter-lines and pads. Most at home from about G3 to E5.
 */
const horns: Instrument = (f, dur, vel, _rng, o) => {
  const len = dur + 0.25;
  const pitch = expressive(f, { glide: o?.glide, scoop: -0.2, rate: 4.8, depth: 0.004, delay: 0.35 });
  const settle = Math.min(3000, 500 + f * (1.6 + 1.2 * vel));
  const cut = follow(
    env(len, [
      [0, settle * 0.5],
      [0.1, settle * 1.25],
      [len, settle],
    ]),
  );
  const tone = filter(
    filter(unison(len, pitch, 'saw', [-6, 0, 6]), 'lowpass', cut, 0.7),
    'lowpass',
    (t) => cut(t) * 1.5,
    0.6,
  );
  return mul(filter(tone, 'peak', 500, 0.9, 2), mul(adsr(len, 0.06, 0.2, 0.85, 0.22), vel * 0.6));
};

/** Flute: sine with breath noise and delayed vibrato. */
const flute: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.1;
  const tone = layer(len, [osc(len, vib(f, 5, 0.01, 0.2)), 1], [osc(len, vib(f * 2, 5, 0.01, 0.2)), 0.12]);
  const breath = filter(noise(len, rng), 'bandpass', f * 2, 3);
  return mul(layer(len, [tone, 1], [breath, 0.08]), mul(adsr(len, 0.05, 0.06, 0.85, 0.08), vel * 0.6));
};

/** Whistle: almost pure sine, quick vibrato. */
const whistle: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  return mul(osc(len, vib(f, 6.5, 0.012, 0.12)), mul(adsr(len, 0.02, 0.05, 0.9, 0.05), vel * 0.55));
};

/** Accordion: two detuned reed pulses (the musette beating) through a mellow filter. */
const accordion: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  const reeds = layer(
    len,
    [osc(len, f, 'pulse', { width: 0.3 }), 0.5],
    [osc(len, f * 1.006, 'pulse', { width: 0.32 }), 0.5],
    [osc(len, f * 2, 'saw'), 0.15],
  );
  return mul(
    filter(reeds, 'lowpass', Math.min(6000, f * 6), 0.8),
    mul(adsr(len, 0.02, 0.05, 0.9, 0.05), vel * 0.45),
  );
};

/** Organ: drawbar sines (8', 4', 2 2/3', 2') with a little key click. */
const organ: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.04;
  const bars = layer(
    len,
    [osc(len, f), 0.5],
    [osc(len, f * 2), 0.3],
    [osc(len, f * 3), 0.2],
    [osc(len, f * 4), 0.15],
  );
  const clickNoise = mul(filter(noise(0.01, rng), 'highpass', 2000), decay(0.01, 0.002));
  return mul(layer(len, [bars, 1], [clickNoise, 0.2]), mul(adsr(len, 0.005, 0.02, 1, 0.03), vel * 0.5));
};

// ---------------------------------------------------------------- plucked and struck

/** Nylon/harp pluck (Karplus-Strong). */
const pluckI: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.4, dur + 0.3);
  return mul(
    filter(pluck(len, f, rng, 0.5 + 0.3 * vel, 0.996), 'lowpass', 5000),
    mul(
      env(len, [
        [0, 1],
        [Math.max(0.05, dur), 1],
        [len, 0],
      ]),
      vel * 0.8,
    ),
  );
};

/** Bright banjo-like pluck with a metallic edge. */
const banjo: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.3, dur + 0.2);
  const s = pluck(len, f, rng, 0.95, 0.99);
  return mul(layer(len, [s, 1], [filter(s, 'highpass', 2500), 0.6]), mul(decay(len, 0.25, 0.001), vel * 0.8));
};

/** Pizzicato strings: short pluck, warm. */
const pizz: Instrument = (f, dur, vel, rng) => {
  const len = 0.35;
  return mul(filter(pluck(len, f, rng, 0.4, 0.985), 'lowpass', 2500), mul(decay(len, 0.08, 0.002), vel));
};

/** Electric/finger bass: a dark pluck over a sine fundamental. */
const bassGuitar: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.08;
  const s = filter(pluck(len, f, rng, 0.35, 0.998), 'lowpass', 900);
  return mul(layer(len, [s, 0.9], [osc(len, f), 0.5]), mul(adsr(len, 0.003, 0.3, 0.7, 0.06), vel * 0.8));
};

/** Synth bass: saw + sub sine through a plucky low-pass, lightly driven so it reads on small speakers. */
const synthBass: Instrument = (f, dur, vel, _rng, o) => {
  const len = dur + 0.06;
  const pitch = expressive(f, { glide: o?.glide, depth: 0 });
  const cut = env(len, [
    [0, f * (6 + 4 * vel)],
    [0.12, f * 3],
    [len, f * 3],
  ]);
  const tone = filter(osc(len, pitch, 'saw'), 'lowpass', follow(cut), 1.5);
  return mul(
    drive(layer(len, [tone, 0.7], [osc(len, pitch), 0.6]), 1.3),
    mul(adsr(len, 0.003, 0.1, 0.8, 0.05), vel * 0.52),
  );
};

/** Triangle bass (chiptune). */
const triBass: Instrument = (f, dur, vel) => {
  const len = dur + 0.03;
  return mul(osc(len, f, 'triangle'), mul(adsr(len, 0.002, 0.05, 0.9, 0.02), vel * 0.8));
};

/** Upright/tuba-ish round bass for cartoon tracks: sine + a little 2nd harmonic, soft attack. */
const tuba: Instrument = (f, dur, vel) => {
  const len = dur + 0.08;
  const tone = layer(len, [osc(len, f), 0.8], [osc(len, f * 2), 0.25], [osc(len, f * 3), 0.1]);
  return mul(drive(tone, 1.3), mul(adsr(len, 0.025, 0.1, 0.8, 0.07), vel * 0.7));
};

/** Marimba: wooden bar partials with a mallet tick. */
const marimba: Instrument = (f, _dur, vel, rng) => {
  const len = 0.9;
  const bar = partials(len, f, [
    [1, 1, 0.35 * Math.min(1, 300 / f + 0.3)],
    [3.93, 0.25, 0.06],
    [9.2, 0.05, 0.015],
  ]);
  const tick = mul(filter(noise(0.01, rng), 'bandpass', f * 4, 1), decay(0.01, 0.002));
  return mul(layer(len, [bar, 1], [tick, 0.15]), vel * 0.8);
};

/** Glockenspiel / music box: bright bell partials. */
const glock: Instrument = (f, _dur, vel) => {
  const len = 1.2;
  return mul(
    partials(len, f, [
      [1, 1, 0.5],
      [2.76, 0.35, 0.2],
      [5.4, 0.15, 0.08],
      [8.93, 0.06, 0.04],
    ]),
    vel * 0.6,
  );
};

/** FM bell (electric piano / celesta family). */
const bell: Instrument = (f, dur, vel) => {
  const len = Math.max(0.8, dur + 0.5);
  return mul(
    fm(len, f, 3.5, (t) => 2 * Math.exp(-t / 0.15) + 0.2),
    mul(decay(len, 0.45, 0.002), vel * 0.5),
  );
};

/** Electric piano (FM tine). */
const epiano: Instrument = (f, dur, vel) => {
  const len = dur + 0.4;
  const body = fm(len, f, 1, (t) => 1.6 * vel * Math.exp(-t / 0.4) + 0.1);
  const tine = mul(fm(len, f, 14, 0.6), decay(len, 0.05, 0.001));
  return mul(
    layer(len, [body, 1], [tine, 0.12]),
    mul(
      env(
        len,
        [
          [0, 0],
          [0.003, 1],
          [dur, 0.5],
          [len, 0],
        ],
        1,
      ),
      vel * 0.55,
    ),
  );
};

/** Steel drum: pitched pan partials with a quick strike. */
const steel: Instrument = (f, _dur, vel) => {
  const len = 0.9;
  return mul(
    partials(len, f, [
      [1, 1, 0.35],
      [2, 0.5, 0.25],
      [3.01, 0.25, 0.15],
      [4.17, 0.12, 0.08],
    ]),
    vel * 0.6,
  );
};

/** Piano-ish: inharmonic struck partials, damped at note-off. */
const piano: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.25;
  const B = 0.0004;
  const parts = [1, 2, 3, 4, 5, 6].map(
    (k) =>
      [k * Math.sqrt(1 + B * k * k), 0.6 / k ** 1.2, 1.6 / (1 + k * 0.6) / Math.max(1, f / 400)] as const,
  );
  const hammer = mul(filter(noise(0.02, rng), 'bandpass', f * 3, 1), decay(0.02, 0.004));
  return mul(
    layer(len, [partials(len, f, parts), 1], [hammer, 0.1]),
    mul(
      env(
        len,
        [
          [0, 1],
          [dur, 1],
          [len, 0],
        ],
        1,
      ),
      vel * 0.7,
    ),
  );
};

/** Synth pluck for arpeggios: detuned saws and a square whose filter snaps shut, like a trance pluck. */
const synthPluck: Instrument = (f, dur, vel) => {
  const len = Math.max(0.25, dur + 0.15);
  const tone = layer(len, [unison(len, () => f, 'saw', [-7, 7]), 0.7], [osc(len, f, 'square'), 0.3]);
  const top = Math.min(9000, f * 12) * (0.5 + 0.5 * vel);
  return mul(
    filter(tone, 'lowpass', (t) => f * 1.5 + top * Math.exp(-t / 0.09), 1.3),
    mul(decay(len, 0.16 + 0.3 * dur, 0.002), vel * 0.55),
  );
};

/**
 * A guitar amp and cabinet: the string tightened and softened before the distortion, then cabinet thump at
 * 190 Hz, the boxy 550 Hz scooped, a 1.3 kHz bark, the 3.2 kHz fizz cut and a 24 dB roll-off from about
 * 5.5 kHz (2.2 kHz palm-muted).
 */
const amp = (x: Float32Array, gain: number, muted: boolean) => {
  const hot = drive(filter(filter(x, 'highpass', 140, 0.7), 'lowpass', 3500, 0.7), gain);
  let y = filter(filter(hot, 'highpass', 95, 0.7), 'peak', 190, 1, 2);
  y = filter(filter(y, 'peak', 550, 1, -2.5), 'peak', 1300, 0.9, 2.5);
  y = filter(y, 'peak', 3200, 1.2, -3.5);
  const lp = muted ? 2200 : 5500;
  return filter(filter(y, 'lowpass', lp, 0.6), 'lowpass', lp * 1.3, 0.6);
};

/**
 * Overdriven electric guitar, one note: a picked string blended with a sustaining oscillator (so it can
 * slide and take vibrato) into a hot amp and cabinet. Notes shorter than 0.2 s are palm-muted: darker, tighter.
 */
const guitar: Instrument = (f, dur, vel, rng, o) => {
  const muted = dur < 0.2;
  const len = dur + (muted ? 0.05 : 0.12);
  const pitch = expressive(f, { glide: o?.glide, depth: 0.008, delay: 0.3 });
  const string = layer(len, [pluck(len, f, rng, 0.65, 0.997), 0.8], [osc(len, pitch, 'saw'), 0.2]);
  return mul(
    amp(mul(string, 1 + vel), 4.5, muted),
    mul(adsr(len, 0.002, muted ? 0.05 : 0.1, muted ? 0.5 : 0.85, muted ? 0.04 : 0.08), vel * 0.3),
  );
};

/** Power chord on the note: root, fifth and octave distorted together, palm-muted when shorter than 0.2 s. */
const power: Instrument = (f, dur, vel, rng) => {
  const muted = dur < 0.2;
  const len = dur + (muted ? 0.05 : 0.12);
  const strings = layer(
    len,
    [pluck(len, f, rng, 0.75, 0.998), 0.45],
    [pluck(len, f * 1.4983, rng, 0.75, 0.998), 0.35],
    [pluck(len, f * 2, rng, 0.75, 0.998), 0.25],
  );
  return mul(
    amp(mul(strings, 1 + vel), 5, muted),
    mul(adsr(len, 0.002, muted ? 0.05 : 0.1, muted ? 0.5 : 0.85, muted ? 0.04 : 0.08), vel * 0.27),
  );
};

// ---------------------------------------------------------------- sustained

/** Warm pad: three detuned saws, low-passed, slow attack. */
const pad: Instrument = (f, dur, vel) => {
  const len = dur + 0.6;
  return mul(
    filter(
      unison(len, (t) => f * (1 + 0.003 * Math.sin(2 * Math.PI * 0.3 * t)), 'saw', [-9, 0, 9]),
      'lowpass',
      Math.min(4000, f * 4),
      0.7,
    ),
    mul(adsr(len, 0.35, 0.3, 0.85, 0.55), vel * 0.4),
  );
};

/**
 * String section: seven saws that drift on their own (an ensemble, not a chorus), delayed vibrato, a soft
 * 24 dB low-pass that opens with velocity, bow noise, an attack whose speed follows velocity and a swell
 * across long notes. Pairs well with a wide track and a long hall.
 */
const strings: Instrument = (f, dur, vel, rng, o) => {
  const len = dur + 0.4;
  const pitch = expressive(f, { glide: o?.glide, rate: 5 + 0.5 * rng.next(), depth: 0.0045, delay: 0.18 });
  const swell = swellOf(dur);
  const cut = Math.min(8000, Math.max(2500, f * 6)) * (0.7 + 0.35 * vel);
  const saws = filter(
    filter(ensemble(len, pitch, [-15, -10, -5, -1, 3, 8, 13], 0.003), 'lowpass', (t) => cut * swell(t), 0.6),
    'lowpass',
    cut * 1.5,
    0.7,
  );
  const bow = mul(filter(noise(len, rng), 'bandpass', Math.min(9000, f * 5), 1.2), 0.03);
  return mul(
    layer(len, [saws, 1], [bow, 1]),
    mul(mul(adsr(len, 0.05 + 0.13 * (1 - vel), 0.25, 0.9, 0.35), shape(len, swell)), vel * 0.54),
  );
};

/** Spiccato strings: short bowed notes with a scratch of rosin, for driving ostinatos. */
const spicc: Instrument = (f, dur, vel, rng) => {
  const held = Math.min(dur, 0.3);
  const len = held + 0.15;
  const saws = filter(
    unison(len, () => f, 'saw', [-10, -3, 4, 11]),
    'lowpass',
    (t) => Math.min(6000, f * 3) + Math.min(6000, f * 4) * vel * Math.exp(-t / 0.05),
    0.7,
  );
  const scratch = mul(filter(noise(0.04, rng), 'bandpass', 2500, 1), decay(0.04, 0.008));
  return mul(
    layer(len, [saws, 1], [scratch, 0.15]),
    mul(
      env(len, [
        [0, 0],
        [0.006, 1],
        [held * 0.7, 0.55],
        [len, 0],
      ]),
      vel * 0.5,
    ),
  );
};

/** Choir "aah": saws through vowel formants. */
const choir: Instrument = (f, dur, vel) => {
  const len = dur + 0.4;
  const src = unison(len, vib(f, 5, 0.006, 0.2), 'saw', [-7, 0, 7]);
  const vowel = layer(
    len,
    [filter(src, 'bandpass', 730, 6), 1],
    [filter(src, 'bandpass', 1090, 7), 0.6],
    [filter(src, 'bandpass', 2440, 8), 0.3],
  );
  return mul(vowel, mul(adsr(len, 0.2, 0.2, 0.9, 0.35), vel * 1.4));
};

// ---------------------------------------------------------------- drums (pitch ignored)

const drumNoise = (rng: Rng, len: number) => noise(len, rng);

/**
 * Kick: a sine swept from about 180 Hz down to 55 Hz for the 60-110 Hz punch, a short boost on the attack,
 * a 52 Hz sub under it, a 3.8 kHz beater click, and saturation so it still reads on laptop speakers.
 */
const kick: Instrument = (_f, _d, vel, rng) => {
  const len = 0.5;
  const sweep = 125 * (0.75 + 0.25 * vel) * (1 + rng.range(-0.03, 0.03));
  const body = mul(
    osc(len, (t) => 55 + sweep * Math.exp(-t / 0.032)),
    shape(len, (t) => Math.min(1, t / 0.0012) * Math.exp(-t / 0.18) * (1 + 0.35 * Math.exp(-t / 0.025))),
  );
  const sub = mul(osc(len, 52), decay(len, 0.22, 0.006));
  const click = mul(filter(drumNoise(rng, 0.015), 'bandpass', 3800, 1), decay(0.015, 0.003, 0.0003));
  return mul(drive(layer(len, [body, 0.8], [sub, 0.3], [click, 0.9]), 1.8), vel * 0.7);
};

/**
 * Snare: a 190 Hz shell body with a ringing overtone, wires that ring longer when hit harder, and a crack;
 * each hit tuned a little differently, like a real drum's round-robin.
 */
const snare: Instrument = (_f, _d, vel, rng) => {
  const len = 0.4;
  const tune = 1 + rng.range(-0.02, 0.02);
  const body = mul(
    osc(len, (t) => (190 + 50 * Math.exp(-t / 0.012)) * tune),
    decay(len, 0.1, 0.0008),
  );
  const ring = mul(
    osc(len, (t) => (330 + 25 * Math.exp(-t / 0.01)) * tune),
    decay(len, 0.045, 0.0008),
  );
  const nz = drumNoise(rng, len);
  const wires = mul(
    filter(filter(nz, 'highpass', 1800, 0.7), 'peak', 5500, 0.8, 4),
    decay(len, 0.08 + 0.07 * vel, 0.001),
  );
  const crack = mul(filter(nz, 'bandpass', 3200, 0.9), decay(len, 0.012, 0.0005));
  return mul(drive(layer(len, [body, 0.9], [ring, 0.3], [wires, 0.5], [crack, 0.7]), 1.5), 0.46 * vel ** 1.1);
};

/** Closed hi-hat: metallic squares and noise, high-passed; soft hits are shorter, darker and much quieter. */
const hat: Instrument = (_f, _d, vel, rng) => {
  const len = 0.15;
  const src = layer(len, [metal(len, 1.7), 0.55], [drumNoise(rng, len), 0.5]);
  const tone = filter(filter(src, 'highpass', 7000, 0.8), 'lowpass', 9000 + 8000 * vel, 0.7);
  return mul(tone, mul(decay(len, (0.012 + 0.02 * vel) * (1 + rng.range(-0.12, 0.12)), 0.0004), 1.05 * vel));
};

/** Open hi-hat: the closed hat's metal ringing on. */
const openHat: Instrument = (_f, _d, vel, rng) => {
  const len = 0.6;
  const src = layer(len, [metal(len, 1.7), 0.55], [drumNoise(rng, len), 0.5]);
  const tone = filter(filter(src, 'highpass', 6500, 0.8), 'lowpass', 10000 + 6000 * vel, 0.7);
  return mul(tone, mul(decay(len, 0.14 + 0.1 * vel, 0.001), 0.85 * vel));
};

/** Ride cymbal: a stick tick, a bell ping and a long metallic wash. */
const ride: Instrument = (_f, _d, vel, rng) => {
  const len = 1.8;
  const ping = partials(len, 1, [
    [3170, 0.3, 0.5],
    [4390, 0.2, 0.4],
    [5240, 0.15, 0.3],
    [6870, 0.1, 0.2],
  ]);
  const wash = mul(
    filter(layer(len, [metal(len, 3.1), 0.5], [drumNoise(rng, len), 0.5]), 'highpass', 5500, 0.6),
    decay(len, 0.5, 0.001),
  );
  const tick = mul(filter(drumNoise(rng, 0.03), 'bandpass', 6000, 1), decay(0.03, 0.004));
  return mul(layer(len, [ping, 0.2 + 0.2 * vel], [wash, 0.45], [tick, 0.5]), vel * 0.6);
};

const clap: Instrument = (_f, _d, vel, rng) => {
  const out = buffer(0.25);
  for (const t of [0, 0.011, 0.022]) {
    const b = mul(
      filter(drumNoise(rng, 0.2), 'bandpass', 1300, 1.2),
      decay(0.2, t === 0.022 ? 0.05 : 0.006, 0.0005),
    );
    for (let i = 0; i < b.length && i + Math.round(t * SR) < out.length; i++)
      out[i + Math.round(t * SR)]! += b[i]!;
  }
  return mul(out, vel);
};

const shaker: Instrument = (_f, _d, vel, rng) =>
  mul(
    mul(
      filter(drumNoise(rng, 0.09), 'highpass', 5000),
      env(
        0.09,
        [
          [0, 0],
          [0.025, 1],
          [0.09, 0],
        ],
        2,
      ),
    ),
    vel * 0.45,
  );

/** Tom: a head that drops into pitch, an inharmonic overtone and a stick attack. */
const tom: Instrument = (tuned, _d, vel, rng) => {
  const len = 0.7;
  const f = tuned * (1 + rng.range(-0.015, 0.015));
  const head = mul(
    osc(len, (t) => f * (1 + 0.6 * Math.exp(-t / 0.03))),
    decay(len, 0.2, 0.001),
  );
  const over = mul(
    osc(len, (t) => f * 1.58 * (1 + 0.4 * Math.exp(-t / 0.02))),
    decay(len, 0.07, 0.001),
  );
  const stick = mul(filter(drumNoise(rng, 0.05), 'bandpass', 1800, 0.9), decay(0.05, 0.006));
  return mul(drive(layer(len, [head, 0.9], [over, 0.25], [stick, 0.35]), 1.3), vel * 0.75);
};

const conga: Instrument = (f, _d, vel) =>
  mul(
    osc(0.3, (t) => f * (1 + 0.3 * Math.exp(-t / 0.015))),
    mul(decay(0.3, 0.07, 0.001), vel),
  );

const wood: Instrument = (f, _d, vel) =>
  mul(
    partials(0.15, f || 1700, [
      [1, 1, 0.03],
      [2.3, 0.4, 0.015],
    ]),
    vel * 0.7,
  );

/** Crash cymbal: two sets of metallic squares and noise, a bright burst that darkens into a long wash. */
const crash: Instrument = (_f, _d, vel, rng) => {
  const len = 3.2;
  const src = layer(len, [metal(len, 2.3), 0.45], [metal(len, 3.7), 0.35], [drumNoise(rng, len), 0.65]);
  const tone = filter(
    filter(src, 'highpass', 1800, 0.5),
    'lowpass',
    (t) => 7000 + 10000 * Math.exp(-t / 0.6),
    0.6,
  );
  const amp = shape(
    len,
    (t) => Math.min(1, t / 0.0015) * (0.4 * Math.exp(-t / 0.12) + 0.6 * Math.exp(-t / 1.3)),
  );
  return mul(tone, mul(amp, vel * 1.2));
};

/** Reverse cymbal: a crash swelling up over the note's length, cut off right at its end (the downbeat). */
const revCrash: Instrument = (_f, dur, vel, rng) => {
  const len = Math.max(0.25, dur);
  const src = layer(len, [metal(len, 2.3), 0.4], [drumNoise(rng, len), 0.7]);
  const tone = filter(
    filter(src, 'highpass', 2200, 0.6),
    'lowpass',
    (t) => 2500 + 12500 * (t / len) ** 2,
    0.6,
  );
  const amp = shape(len, (t) => Math.exp((t - len) / (len * 0.28)) * Math.min(1, (len - t) / 0.004));
  return mul(tone, mul(amp, vel * 0.8));
};

/**
 * Riser: noise through a band-pass sweeping from 250 Hz to 12 kHz, swelling to a peak at 90% of the note and
 * whooshing away over the rest, so it can end a little after the downbeat it builds to.
 */
const riser: Instrument = (_f, dur, vel, rng) => {
  const len = Math.max(0.25, dur);
  const top = len * 0.9;
  const sweep = (t: number) => 250 * 48 ** Math.min(1, t / top);
  const band = filter(drumNoise(rng, len), 'bandpass', sweep, 1.4);
  const air = filter(drumNoise(rng, len), 'highpass', (t) => sweep(t) * 0.7, 0.7);
  const amp = shape(len, (t) => (t < top ? (t / top) ** 1.2 : ((len - t) / (len - top)) ** 2));
  return mul(layer(len, [band, 1], [air, 0.25]), mul(amp, vel * 0.9));
};

/** Impact boom: a sub drop from about 100 Hz with a dark thud, for big section downbeats. */
const boom: Instrument = (_f, _d, vel, rng) => {
  const len = 2.2;
  const sub = mul(
    osc(len, (t) => 36 + 64 * Math.exp(-t / 0.07)),
    decay(len, 0.6, 0.002),
  );
  const thud = mul(filter(drumNoise(rng, 0.4), 'lowpass', 350, 0.8), decay(0.4, 0.06, 0.001));
  return mul(drive(layer(len, [sub, 1], [thud, 0.8]), 1.4), vel * 0.9);
};

/** Timpani: the modes of a tuned membrane settling into pitch, and a felt mallet. */
const timpani: Instrument = (f, _d, vel, rng) => {
  const len = 2;
  const modes = [
    [1, 1, 0.9],
    [1.5, 0.45, 0.6],
    [1.98, 0.3, 0.45],
    [2.44, 0.15, 0.3],
    [2.98, 0.08, 0.2],
  ] as const;
  const head = layer(
    len,
    ...modes.map(
      ([r, g, tau]) =>
        [
          mul(
            osc(len, (t) => f * r * (1 + 0.03 * Math.exp(-t / 0.06))),
            decay(len, tau, 0.003),
          ),
          g,
        ] as const,
    ),
  );
  const mallet = mul(filter(drumNoise(rng, 0.06), 'lowpass', 1200), decay(0.06, 0.012));
  return mul(drive(layer(len, [head, 0.8], [mallet, 0.5]), 1.2), vel * 0.7);
};

/** Chiptune noise drum: n < 50 is a kick-ish thud, otherwise a hat/snare burst by pitch. */
const chipNoise: Instrument = (f, _d, vel, rng) => {
  const len = 0.12;
  const hold = Math.max(1, Math.round(SR / Math.max(200, f * 8)));
  const raw = drumNoise(rng, len);
  const held = raw.map((_, i) => raw[i - (i % hold)]!);
  return mul(mul(held, decay(len, 0.03, 0.0005)), vel * 0.5);
};

export const INSTRUMENTS: Record<string, Instrument> = {
  chip,
  square,
  sawLead,
  heroLead,
  brass,
  brassStab,
  horns,
  flute,
  whistle,
  accordion,
  organ,
  pluck: pluckI,
  banjo,
  pizz,
  bassGuitar,
  synthBass,
  triBass,
  tuba,
  marimba,
  glock,
  bell,
  epiano,
  steel,
  piano,
  synthPluck,
  guitar,
  power,
  pad,
  strings,
  spicc,
  choir,
  kick,
  snare,
  hat,
  openHat,
  ride,
  clap,
  shaker,
  tom,
  conga,
  wood,
  crash,
  revCrash,
  riser,
  boom,
  timpani,
  chipNoise,
};
