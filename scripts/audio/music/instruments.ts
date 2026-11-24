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

export type Instrument = (f: number, dur: number, vel: number, rng: Rng) => Float32Array;

const vib =
  (f: number, rate: number, depth: number, delay = 0.15) =>
  (t: number) =>
    f * (1 + (t > delay ? depth * Math.min(1, (t - delay) * 4) * Math.sin(2 * Math.PI * rate * t) : 0));

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

/** Bright synth lead: two detuned saws with a filter envelope. */
const sawLead: Instrument = (f, dur, vel) => {
  const len = dur + 0.12;
  const cut = env(len, [
    [0, f * 12],
    [0.15, f * 5],
    [len, f * 4],
  ]);
  return mul(
    filter(
      unison(len, vib(f, 5.5, 0.008), 'saw', [-8, 8]),
      'lowpass',
      (t) => cut[Math.min(cut.length - 1, Math.round(t * SR))]!,
      1.2,
    ),
    mul(adsr(len, 0.008, 0.15, 0.75, 0.1), vel * 0.5),
  );
};

/** Brass section: saws with a swelling filter, a little breath. */
const brass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.15;
  const cut = env(len, [
    [0, f * 1.5],
    [0.06, f * (4 + 4 * vel)],
    [0.3, f * 4],
    [len, f * 3],
  ]);
  const tone = filter(
    unison(len, vib(f, 5, 0.006, 0.25), 'saw', [-6, 0, 7]),
    'lowpass',
    (t) => cut[Math.min(cut.length - 1, Math.round(t * SR))]!,
    0.9,
  );
  const breath = mul(filter(noise(len, rng), 'bandpass', f * 3, 2), 0.04);
  return mul(layer(len, [tone, 1], [breath, 1]), mul(adsr(len, 0.03, 0.12, 0.85, 0.12), vel * 0.55));
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

/** Synth bass: saw + sub sine through a plucky low-pass. */
const synthBass: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  const cut = env(len, [
    [0, f * 10],
    [0.12, f * 3],
    [len, f * 3],
  ]);
  const tone = filter(
    osc(len, f, 'saw'),
    'lowpass',
    (t) => cut[Math.min(cut.length - 1, Math.round(t * SR))]!,
    1.5,
  );
  return mul(layer(len, [tone, 0.7], [osc(len, f), 0.6]), mul(adsr(len, 0.003, 0.1, 0.8, 0.05), vel * 0.7));
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

/** String section: four detuned saws, vibrato, medium attack. */
const strings: Instrument = (f, dur, vel) => {
  const len = dur + 0.3;
  return mul(
    filter(
      unison(len, vib(f, 5.2, 0.005, 0.1), 'saw', [-11, -4, 4, 11]),
      'lowpass',
      Math.min(6000, f * 6),
      0.7,
    ),
    mul(adsr(len, 0.09, 0.2, 0.9, 0.25), vel * 0.45),
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

const kick: Instrument = (_f, _d, vel, rng) =>
  mul(
    layer(
      0.4,
      [
        mul(
          osc(0.4, (t) => 48 + 110 * Math.exp(-t / 0.03)),
          decay(0.4, 0.12, 0.001),
        ),
        1,
      ],
      [mul(filter(drumNoise(rng, 0.01), 'highpass', 1500), decay(0.01, 0.002)), 0.3],
    ),
    vel,
  );

const snare: Instrument = (_f, _d, vel, rng) =>
  mul(
    layer(
      0.3,
      [mul(filter(drumNoise(rng, 0.3), 'bandpass', 2200, 0.7), decay(0.3, 0.07, 0.001)), 0.9],
      [
        mul(
          osc(0.3, (t) => 185 + 40 * Math.exp(-t / 0.02)),
          decay(0.3, 0.05, 0.001),
        ),
        0.6,
      ],
    ),
    vel,
  );

const hat: Instrument = (_f, _d, vel, rng) =>
  mul(mul(filter(drumNoise(rng, 0.08), 'highpass', 7500), decay(0.08, 0.018, 0.0005)), vel * 0.6);

const openHat: Instrument = (_f, _d, vel, rng) =>
  mul(mul(filter(drumNoise(rng, 0.4), 'highpass', 6500), decay(0.4, 0.12, 0.001)), vel * 0.5);

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

const tom: Instrument = (f, _d, vel) =>
  mul(
    osc(0.5, (t) => f * (1 + 0.5 * Math.exp(-t / 0.04))),
    mul(decay(0.5, 0.15, 0.001), vel),
  );

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

const crash: Instrument = (_f, _d, vel, rng) =>
  mul(
    layer(
      1.8,
      [mul(filter(drumNoise(rng, 1.8), 'highpass', 4500), decay(1.8, 0.6, 0.002)), 1],
      [
        partials(1.8, 420, [
          [1.37, 0.2, 0.4],
          [2.71, 0.15, 0.3],
          [4.43, 0.1, 0.2],
        ]),
        1,
      ],
    ),
    vel * 0.5,
  );

const timpani: Instrument = (f, _d, vel, rng) =>
  mul(
    layer(
      1.2,
      [
        mul(
          osc(1.2, (t) => f * (1 + 0.04 * Math.exp(-t / 0.05))),
          decay(1.2, 0.45, 0.003),
        ),
        1,
      ],
      [mul(filter(drumNoise(rng, 0.05), 'lowpass', 800), decay(0.05, 0.01)), 0.4],
    ),
    vel,
  );

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
  brass,
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
  pad,
  strings,
  choir,
  kick,
  snare,
  hat,
  openHat,
  clap,
  shaker,
  tom,
  conga,
  wood,
  crash,
  timpani,
  chipNoise,
};
