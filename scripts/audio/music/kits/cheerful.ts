/**
 * Signature timbres and pattern helpers for the "cheerful" stage themes (Papa's Pizzeria, Snail Bob, Duck
 * Life, Wheely): café accordion, mandolin and clarinet; cartoon bassoon, xylophone and construction clanks;
 * banjo, acoustic guitar and whistle; clavinet, slap bass and rhodes; plus a fuller acoustic drum kit.
 */
import type { Rng } from '../../dsp.ts';
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
} from '../../dsp.ts';
import type { Instrument } from '../instruments.ts';
import type { Note } from '../notes.ts';

const follow = (e: Float32Array) => (t: number) => e[Math.min(e.length - 1, Math.round(t * SR))]!;

const vib =
  (f: number, rate: number, depth: number, delay = 0.15) =>
  (t: number) =>
    f * (1 + (t > delay ? depth * Math.min(1, (t - delay) * 3) * Math.sin(2 * Math.PI * rate * t) : 0));

/** Release-shaped hold: full level until dur, then a rel-second fade. */
const hold = (len: number, dur: number, rel: number) =>
  env(len, [
    [0, 1],
    [Math.max(0.01, dur), 1],
    [Math.max(0.01, dur) + rel, 0],
    [len, 0],
  ]);

/** Amplitude tremolo: 1 - depth at the dips, rate in Hz. */
const tremolo = (len: number, rate: number, depth: number) =>
  buffer(len).map((_, i) => 1 - depth * 0.5 * (1 - Math.cos((2 * Math.PI * rate * i) / SR)));

/** Sum parts into a new buffer len seconds long, each [buffer, gain, offset seconds]. */
const place = (len: number, parts: (readonly [Float32Array, number, number])[]) => {
  const out = buffer(len);
  for (const [x, g, at] of parts) {
    const o = Math.round(at * SR);
    for (let i = 0; i < x.length && o + i < out.length; i++) out[o + i]! += x[i]! * g;
  }
  return out;
};

// ---------------------------------------------------------------- winds and reeds

/** Clarinet: hollow odd harmonics, soft breath, a little jazz vibrato; brighter when played harder. */
export const clarinet: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.12;
  const v = vib(f, 5.2, 0.005, 0.22);
  const pitch = (t: number) => v(t) * (1 - 0.012 * Math.exp(-t / 0.025));
  const body = layer(len, [osc(len, pitch, 'square'), 0.55], [osc(len, pitch, 'triangle'), 0.45]);
  const cut = env(len, [
    [0, f * 1.5],
    [0.05, f * (2.5 + 2.5 * vel)],
    [len, f * (2 + 2 * vel)],
  ]);
  let tone: Float32Array = filter(body, 'lowpass', follow(cut), 0.6);
  tone = filter(tone, 'lowpass', 4200, 0.5);
  tone = filter(tone, 'peak', 1400, 1, 3);
  const breath = mul(filter(noise(len, rng), 'bandpass', Math.min(5000, f * 3), 1.5), 0.05);
  return mul(layer(len, [tone, 1], [breath, 1]), mul(adsr(len, 0.03, 0.08, 0.82, 0.1), vel * 0.5));
};

/** Musette accordion: three saw reeds (one sharp, one flat) through a nasal reed formant, bellows swell. */
export const accordion: Instrument = (f, dur, vel) => {
  const len = dur + 0.08;
  const reed = (cents: number, ph: number) =>
    osc(len, (t) => f * 2 ** (cents / 1200) * (1 + 0.0015 * Math.sin(2 * Math.PI * 5.5 * t)), 'saw', {
      phase: ph,
    });
  const reeds = layer(len, [reed(0, 0), 0.4], [reed(13, 0.31), 0.32], [reed(-9, 0.67), 0.28]);
  let tone: Float32Array = filter(reeds, 'lowpass', Math.min(3600, f * 5), 0.6);
  tone = filter(tone, 'peak', 1150, 1.4, 4);
  tone = filter(tone, 'highshelf', 4500, 0.7, -8);
  const end = Math.max(0.04, dur);
  const bellows = env(len, [
    [0, 0],
    [0.025, 0.9],
    [Math.max(0.03, end * 0.6), 1],
    [end, 0.92],
    [end + 0.07, 0],
    [len, 0],
  ]);
  return mul(tone, mul(bellows, vel * 0.42));
};

/** Bassoon: a reedy saw through two vowel-ish formants, for sneaky staccato lines. */
export const bassoon: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.1;
  const src = osc(len, vib(f, 5, 0.006, 0.25), 'saw');
  const tone = layer(
    len,
    [filter(src, 'bandpass', 480, 2.2), 1],
    [filter(src, 'bandpass', 1150, 4), 0.45],
    [filter(src, 'lowpass', Math.min(900, f * 3), 0.7), 0.35],
  );
  const breath = mul(filter(noise(len, rng), 'bandpass', 900, 2), 0.04);
  return mul(
    layer(len, [drive(tone, 1.4), 1], [breath, 1]),
    mul(adsr(len, 0.025, 0.06, 0.8, 0.07), vel * 0.75),
  );
};

/** Human whistle: near-sine, scoops into the note, breathy, quick vibrato. */
export const whistle: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.1;
  const v = vib(f, 5.8, 0.011, 0.14);
  const pitch = (t: number) => v(t) * (1 - 0.035 * Math.exp(-t / 0.03));
  const tone = layer(len, [osc(len, pitch), 1], [osc(len, (t) => pitch(t) * 2), 0.06]);
  const breath = filter(noise(len, rng), 'bandpass', Math.min(9000, f * 1.5), 2.5);
  return mul(layer(len, [tone, 1], [breath, 0.07]), mul(adsr(len, 0.025, 0.08, 0.85, 0.07), vel * 0.5));
};

/** Soft synth lead for cute pop: triangle + sine with a gentle filter, a scoop and slow vibrato. */
export const softLead: Instrument = (f, dur, vel) => {
  const len = dur + 0.15;
  const v = vib(f, 5.5, 0.008, 0.18);
  const pitch = (t: number) => v(t) * (1 - 0.02 * Math.exp(-t / 0.02));
  const tone = layer(
    len,
    [osc(len, pitch, 'triangle'), 0.6],
    [osc(len, pitch), 0.5],
    [osc(len, (t) => pitch(t) * 1.003, 'saw'), 0.12],
  );
  return mul(
    filter(tone, 'lowpass', Math.min(5000, f * (3 + 2 * vel)), 0.7),
    mul(adsr(len, 0.012, 0.15, 0.75, 0.12), vel * 0.55),
  );
};

/** Slide whistle swooping up an octave over the note (cartoon gag). */
export const slideUp: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  return mul(
    osc(len, (t) => f * 2 ** Math.min(1, t / dur) * (1 + 0.01 * Math.sin(2 * Math.PI * 6 * t))),
    mul(adsr(len, 0.02, 0.05, 0.85, 0.05), vel * 0.4),
  );
};

/** Slide whistle swooping down an octave over the note. */
export const slideDown: Instrument = (f, dur, vel) => {
  const len = dur + 0.06;
  return mul(
    osc(len, (t) => f * 2 ** -Math.min(1, t / dur) * (1 + 0.01 * Math.sin(2 * Math.PI * 6 * t))),
    mul(adsr(len, 0.02, 0.05, 0.85, 0.05), vel * 0.4),
  );
};

/** Short brass stab for funk hits: three saws, fast filter blip. */
export const brassHit: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.15;
  const cut = env(len, [
    [0, f * 1.2],
    [0.03, f * (3 + 4 * vel)],
    [0.2, f * 3],
    [len, f * 2.5],
  ]);
  const saws = layer(
    len,
    [osc(len, f * 2 ** (-7 / 1200), 'saw', { phase: 0.1 }), 0.33],
    [osc(len, f, 'saw', { phase: 0.5 }), 0.33],
    [osc(len, f * 2 ** (8 / 1200), 'saw', { phase: 0.8 }), 0.33],
  );
  const breath = mul(filter(noise(len, rng), 'bandpass', f * 3, 2), 0.05);
  const tone = filter(filter(saws, 'lowpass', follow(cut), 0.8), 'lowpass', 5000, 0.6);
  return mul(layer(len, [tone, 1], [breath, 1]), mul(adsr(len, 0.015, 0.1, 0.7, 0.1), vel * 0.5));
};

/** Cartoon duck quack: a nasal buzz through two formants, pitch falling. */
export const quack: Instrument = (f, _dur, vel, rng) => {
  const len = 0.2;
  const pitch = (t: number) => f * (1.15 - 0.5 * Math.min(1, t / len));
  const buzz = osc(len, pitch, 'pulse', { width: 0.18 });
  const tone = layer(
    len,
    [filter(buzz, 'bandpass', 1100, 3), 1],
    [filter(buzz, 'bandpass', 2600, 5), 0.6],
    [filter(noise(len, rng), 'bandpass', 1800, 2), 0.08],
  );
  const shape = env(len, [
    [0, 0],
    [0.012, 1],
    [0.09, 0.8],
    [len, 0],
  ]);
  return mul(drive(tone, 2), mul(shape, vel * 0.6));
};

// ---------------------------------------------------------------- plucked strings

/** Mandolin: doubled steel courses; long notes become the classic tremolo. */
export const mandolin: Instrument = (f, dur, vel, rng) => {
  const course = (len: number, v: number) => {
    const a = pluck(len, f, rng, 0.75 + 0.2 * v, 0.993);
    const b = pluck(len, f * 1.0025, rng, 0.75 + 0.2 * v, 0.993);
    return mul(layer(len, [a, 0.5], [b, 0.5]), mul(decay(len, 0.35, 0.002), v));
  };
  const strokes = dur > 0.3 ? Math.max(2, Math.floor(dur * 13)) : 1;
  const len = dur + 0.35;
  const parts = Array.from({ length: strokes }, (_, k) => {
    const at = strokes === 1 ? 0 : k / 13;
    const v = vel * (k === 0 ? 1 : k % 2 ? 0.62 : 0.78);
    return [course(Math.max(0.2, Math.min(0.45, len - at)), v), 1, at] as const;
  });
  let tone: Float32Array = place(len, parts);
  tone = filter(tone, 'highpass', 180);
  tone = filter(tone, 'peak', 2600, 1, 4);
  return mul(filter(tone, 'lowpass', 7500), mul(hold(len, dur + 0.08, 0.2), 0.55));
};

/** Banjo: bright twangy pluck through a ringing drum-head resonance. */
export const banjo: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.35, Math.min(0.9, dur + 0.3));
  let s: Float32Array = pluck(len, f, rng, 0.9 + 0.08 * vel, 0.991);
  s = filter(s, 'highpass', 250);
  s = filter(s, 'peak', 1800, 1.5, 6);
  s = filter(s, 'lowpass', 8000);
  return mul(s, mul(decay(len, 0.22, 0.001), vel * 0.7));
};

/** Steel-string acoustic guitar: warm pluck with a body resonance; damped at note-off. */
export const acGuitar: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.3, dur + 0.25);
  let s: Float32Array = pluck(len, f, rng, 0.55 + 0.3 * vel, 0.996);
  s = filter(s, 'peak', 2800, 1.2, 3);
  s = filter(s, 'peak', 180, 1.5, 3);
  s = filter(s, 'lowpass', 6500);
  return mul(s, mul(hold(len, dur, 0.12), vel * 0.6));
};

/** Upright bass: round fingered pluck with a woody thump. */
export const upright: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.12;
  const str = filter(pluck(len, f, rng, 0.35, 0.998), 'lowpass', 650);
  const fund = mul(osc(len, f), decay(len, 0.6, 0.004));
  const thump = mul(filter(noise(0.03, rng), 'lowpass', 400), decay(0.03, 0.008));
  return mul(
    layer(len, [str, 0.8], [fund, 0.55], [thump, 0.35]),
    mul(mul(hold(len, dur, 0.06), decay(len, 1.2, 0.003)), vel * 0.85),
  );
};

/** Slap/pop bass: a bright string pluck whose filter snaps shut, over a solid sine fundamental. */
export const slapBass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.08;
  const cut = env(len, [
    [0, 1200 + 4500 * vel],
    [0.05, 900 + 600 * vel],
    [0.3, 500],
    [len, 450],
  ]);
  const str = filter(pluck(len, f, rng, 0.9, 0.997), 'lowpass', follow(cut), 1.3);
  const fund = osc(len, f);
  const pop = mul(filter(noise(0.025, rng), 'bandpass', 2200, 1.2), decay(0.025, 0.005));
  return mul(
    layer(len, [drive(str, 1.6), 0.75], [fund, 0.55], [pop, 0.25 * vel]),
    mul(adsr(len, 0.002, 0.15, 0.7, 0.04), vel * 0.85),
  );
};

/** Clavinet: plucky narrow pulse through a resonant filter that snaps closed (funky "wah"). */
export const clav: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.04;
  const cut = env(len, [
    [0, f * (6 + 8 * vel)],
    [0.07, f * 3.5],
    [len, f * 2.5],
  ]);
  const src = layer(
    len,
    [osc(len, f, 'pulse', { width: 0.22 }), 0.6],
    [filter(pluck(len, f, rng, 0.95, 0.994), 'highpass', 400), 0.6],
  );
  const tone = filter(filter(src, 'lowpass', follow(cut), 2.8), 'highpass', 160);
  return mul(tone, mul(adsr(len, 0.001, 0.12, 0.55, 0.025), vel * 0.42));
};

// ---------------------------------------------------------------- keys and mallets

/** Rhodes-style electric piano: FM tine, velocity bark, gentle tremolo. */
export const rhodes: Instrument = (f, dur, vel) => {
  const len = dur + 0.5;
  const body = fm(len, f, 1, (t) => (0.6 + 1.6 * vel) * Math.exp(-t / 0.35) + 0.15);
  const tine = mul(fm(len, f * 4, 1, 0.8), decay(len, 0.04, 0.001));
  return mul(
    mul(layer(len, [body, 1], [tine, 0.08 * vel]), tremolo(len, 4.8, 0.22)),
    mul(mul(hold(len, dur, 0.25), decay(len, 2.5, 0.002)), vel * 0.5),
  );
};

/** Xylophone: hard mallet on rosewood, bright and short. */
export const xylo: Instrument = (f, _dur, vel, rng) => {
  const len = 0.6;
  const bar = partials(len, f, [
    [1, 1, 0.22],
    [3.0, 0.35 * vel, 0.06],
    [6.1, 0.1 * vel, 0.02],
  ]);
  const tick = mul(filter(noise(0.008, rng), 'bandpass', Math.min(9000, f * 5), 1), decay(0.008, 0.0015));
  return mul(layer(len, [bar, 1], [tick, 0.25]), vel * 0.6);
};

/** Vibraphone: soft mallet bars with motor tremolo, damped a little after note-off. */
export const vibes: Instrument = (f, dur, vel) => {
  const len = Math.max(0.6, dur + 0.6);
  const bars = partials(len, f, [
    [1, 1, 1.5],
    [4, 0.22 * vel, 0.25],
    [10, 0.05 * vel, 0.06],
  ]);
  return mul(mul(bars, tremolo(len, 5.5, 0.35)), mul(hold(len, dur + 0.2, 0.35), vel * 0.5));
};

/** Celesta / toy piano: bright bell partials with a soft hammer. */
export const celesta: Instrument = (f, _dur, vel) => {
  const len = 1.1;
  return mul(
    partials(len, f, [
      [1, 1, 0.55],
      [2, 0.3, 0.25],
      [3.98, 0.12 * vel, 0.08],
    ]),
    vel * 0.5,
  );
};

/** Bar-room upright piano: two slightly detuned strings per note for a honky warmth. */
export const upPiano: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.3;
  const B = 0.0003;
  const parts = (detune: number) =>
    [1, 2, 3, 4, 5, 6, 7].map(
      (k) =>
        [
          k * Math.sqrt(1 + B * k * k) * detune,
          (0.5 + 0.4 * vel) / k ** (1.4 - 0.4 * vel),
          1.4 / (1 + k * 0.5) / Math.max(1, f / 500),
        ] as const,
    );
  const hammer = mul(filter(noise(0.015, rng), 'bandpass', f * 4, 1), decay(0.015, 0.003));
  return mul(
    layer(len, [partials(len, f, parts(1)), 0.5], [partials(len, f, parts(1.0012)), 0.5], [hammer, 0.12]),
    mul(hold(len, dur, 0.15), vel * 0.55),
  );
};

// ---------------------------------------------------------------- drums and percussion

/** Metallic noise: six detuned square waves (the classic cymbal recipe). */
const metal = (len: number, base: number) =>
  layer(
    len,
    ...[1, 1.4826, 1.8003, 2.5461, 2.6303, 3.8968].map(
      (r, k) => [osc(len, base * r, 'square', { phase: k * 0.17 }), 1 / 6] as const,
    ),
  );

/** Kick: round body with a pitch drop, a beater click and a touch of drive. */
export const kick: Instrument = (_f, _d, vel, rng) => {
  const len = 0.5;
  const body = mul(
    osc(len, (t) => 52 + 95 * Math.exp(-t / 0.03) + 20 * Math.exp(-t / 0.15)),
    decay(len, 0.2 + 0.08 * vel, 0.002),
  );
  const click = mul(filter(noise(0.012, rng), 'bandpass', 3500, 0.8), decay(0.012, 0.003));
  return mul(drive(layer(len, [body, 1], [click, 0.3 * vel]), 1.4), vel * 0.9);
};

/** Snare: two drum-head modes, snare wires and a stick crack; soft hits are darker. */
export const snare: Instrument = (_f, _d, vel, rng) => {
  const len = 0.4;
  const head = layer(
    len,
    [
      mul(
        osc(len, (t) => 185 * (1 + 0.15 * Math.exp(-t / 0.01))),
        decay(len, 0.07, 0.001),
      ),
      0.7,
    ],
    [mul(osc(len, 330), decay(len, 0.035, 0.001)), 0.3],
  );
  const wires = mul(
    filter(filter(noise(len, rng), 'highpass', 1200), 'lowpass', 4000 + 5000 * vel),
    decay(len, 0.1 + 0.06 * vel, 0.001),
  );
  const crack = mul(filter(noise(0.02, rng), 'bandpass', 4200, 0.9), decay(0.02, 0.004));
  return mul(drive(layer(len, [head, 0.8], [wires, 0.65], [crack, 0.4 * vel]), 1.3), vel * 0.75);
};

/** Cross-stick / rim click. */
export const rim: Instrument = (_f, _d, vel, rng) => {
  const len = 0.12;
  const knock = partials(len, 1650, [
    [1, 1, 0.018],
    [1.83, 0.5, 0.01],
    [0.32, 0.4, 0.02],
  ]);
  const tick = mul(filter(noise(0.006, rng), 'highpass', 3000), decay(0.006, 0.0015));
  return mul(layer(len, [knock, 1], [tick, 0.4]), vel * 0.6);
};

/** Hi-hat: closed below middle C, open from middle C up; metallic squares plus air. */
export const hat: Instrument = (f, _d, vel, rng) => {
  const open = f >= 261;
  const len = open ? 0.5 : 0.12;
  const tau = open ? 0.17 : 0.025 + 0.015 * vel;
  const m = filter(filter(metal(len, 330), 'bandpass', 10000, 0.8), 'highpass', 7000);
  const air = filter(noise(len, rng), 'highpass', 8000);
  return mul(layer(len, [m, 0.8], [air, 0.35]), mul(decay(len, tau, 0.0008), vel * 0.5));
};

/** Ride cymbal: bright ping over a shimmering wash. */
export const ride: Instrument = (_f, _d, vel, rng) => {
  const len = 1.4;
  const wash = mul(filter(metal(len, 410), 'highpass', 5000), decay(len, 0.5, 0.001));
  const ping = partials(len, 3150, [
    [1, 1, 0.35],
    [1.47, 0.6, 0.25],
    [2.09, 0.3, 0.15],
  ]);
  const air = mul(filter(noise(len, rng), 'highpass', 9000), decay(len, 0.3, 0.001));
  return mul(layer(len, [wash, 0.4], [ping, 0.12 + 0.08 * vel], [air, 0.15]), vel * 0.45);
};

/** Crash cymbal: long metallic bloom. */
export const crash: Instrument = (_f, _d, vel, rng) => {
  const len = 2.2;
  const m = filter(metal(len, 370), 'highpass', 3500);
  const air = filter(noise(len, rng), 'highpass', 5000);
  const shape = env(
    len,
    [
      [0, 0],
      [0.004, 1],
      [0.08, 0.55],
      [len, 0],
    ],
    3,
  );
  return mul(layer(len, [m, 0.6], [air, 0.5]), mul(shape, vel * 0.5));
};

/** Hand clap: four bursts of band-passed noise and a short room tail. */
export const clap: Instrument = (_f, _d, vel, rng) => {
  const len = 0.35;
  const burst = (tau: number) => mul(filter(noise(0.3, rng), 'bandpass', 1200, 1.1), decay(0.3, tau, 0.0006));
  const out = place(len, [
    [burst(0.004), 0.8, 0],
    [burst(0.004), 0.7, 0.009],
    [burst(0.005), 0.75, 0.019],
    [burst(0.06), 1, 0.028],
  ]);
  return mul(filter(out, 'peak', 2400, 1, 4), vel * 0.8);
};

/** Tambourine: a jingle shake (two micro-hits) of very high metal. */
export const tamb: Instrument = (_f, _d, vel, rng) => {
  const jingle = () =>
    mul(
      layer(
        0.2,
        [filter(metal(0.2, 1650), 'highpass', 6500), 0.6],
        [filter(noise(0.2, rng), 'highpass', 7000), 0.4],
      ),
      decay(0.2, 0.05, 0.001),
    );
  return mul(
    place(0.25, [
      [jingle(), 1, 0],
      [jingle(), 0.6, 0.012],
    ]),
    vel * 0.45,
  );
};

/** Shaker: a short swish of high noise. */
export const shaker: Instrument = (_f, _d, vel, rng) => {
  const shape = env(
    0.1,
    [
      [0, 0],
      [0.03, 1],
      [0.1, 0],
    ],
    2,
  );
  return mul(mul(filter(noise(0.1, rng), 'bandpass', 7000, 0.9), shape), vel * 0.4);
};

/** Tom: pitched body (the note's pitch) with a stick attack. */
export const tom: Instrument = (f, _d, vel, rng) => {
  const len = 0.6;
  const body = mul(
    osc(len, (t) => f * (1 + 0.35 * Math.exp(-t / 0.05))),
    decay(len, 0.2, 0.001),
  );
  const stick = mul(filter(noise(0.03, rng), 'bandpass', 1500, 0.8), decay(0.03, 0.006));
  return mul(drive(layer(len, [body, 1], [stick, 0.3]), 1.3), vel * 0.8);
};

/** Woodblock (pitch picks the block). */
export const woodblock: Instrument = (f, _d, vel, rng) => {
  const len = 0.15;
  const block = partials(len, f, [
    [1, 1, 0.03],
    [2.72, 0.35, 0.012],
  ]);
  const tick = mul(filter(noise(0.005, rng), 'bandpass', f * 3, 1), decay(0.005, 0.001));
  return mul(layer(len, [block, 1], [tick, 0.3]), vel * 0.65);
};

/** Construction clank: a hammer on a steel girder (pitch picks the beam). */
export const clank: Instrument = (f, _d, vel, rng) => {
  const len = 0.7;
  const beam = partials(len, f, [
    [1, 1, 0.3],
    [2.31, 0.7, 0.18],
    [3.89, 0.5, 0.12],
    [5.12, 0.35, 0.08],
    [6.73, 0.2, 0.05],
  ]);
  const hit = mul(filter(noise(0.02, rng), 'bandpass', 3000, 1), decay(0.02, 0.004));
  return mul(layer(len, [beam, 0.6], [hit, 0.6]), vel * 0.45);
};

/** Cowbell: two square tones through a band-pass, quick decay. */
export const cowbell: Instrument = (_f, _d, vel) => {
  const len = 0.3;
  const tone = layer(len, [osc(len, 545, 'square'), 0.5], [osc(len, 815, 'square'), 0.5]);
  return mul(filter(tone, 'bandpass', 900, 2), mul(decay(len, 0.07, 0.001), vel * 0.4));
};

/** Ratchet: a quick run of clicks (a socket wrench) over the note's length. */
export const ratchet: Instrument = (_f, dur, vel, rng) => {
  const len = dur + 0.05;
  const clicks = Math.max(3, Math.round(dur * 28));
  const parts = Array.from(
    { length: clicks },
    (_, k) =>
      [
        mul(filter(noise(0.012, rng), 'bandpass', 2600, 2), decay(0.012, 0.0025)),
        0.7 + 0.3 * (k % 2),
        (k * dur) / clicks,
      ] as const,
  );
  return mul(place(len, parts), vel * 0.6);
};

// ---------------------------------------------------------------- pattern helpers

/** Deterministic 0..1 hash of an integer pair, for humanising without Math.random. */
const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Humanise: velocity jitter (±v, relative) and a small late push (up to t beats), seeded so renders repeat. */
export function human(notes: Note[], seed: number, v = 0.08, t = 0.012): Note[] {
  return notes.map((n, i) => ({
    ...n,
    t: n.t + hash(seed, i) * t,
    v: Math.max(0.05, Math.min(1, n.v * (1 + (hash(seed + 1, i) * 2 - 1) * v))),
  }));
}

/** Swing: warp each beat (unit beats long) so its second half starts at ratio of it (2/3 is a shuffle). */
export function swing(notes: Note[], ratio = 2 / 3, unit = 1): Note[] {
  const warp = (x: number) => {
    const beat = Math.floor(x / unit + 1e-9);
    const p = x / unit - beat;
    return (beat + (p < 0.5 ? p * 2 * ratio : ratio + (p - 0.5) * 2 * (1 - ratio))) * unit;
  };
  return notes.map((n) => {
    const t = warp(n.t);
    return { ...n, t, d: Math.max(0.02, warp(n.t + n.d) - t) };
  });
}

/** Scale velocities by a function of time in beats: phrase arcs, crescendos, section dynamics. */
export function shape(notes: Note[], gain: (t: number) => number): Note[] {
  return notes.map((n) => ({ ...n, v: Math.max(0.03, Math.min(1, n.v * gain(n.t))) }));
}

/** Spread notes that start together into a strum, low to high (up reverses), gap beats apart. */
export function strum(notes: Note[], gap = 0.02, up = false): Note[] {
  const groups = new Map<number, Note[]>();
  for (const n of notes) {
    const key = Math.round(n.t * 1000);
    const g = groups.get(key);
    if (g) g.push(n);
    else groups.set(key, [n]);
  }
  return [...groups.values()].flatMap((g) =>
    g
      .sort((a, b) => (up ? b.n - a.n : a.n - b.n))
      .map((n, k) => ({ ...n, t: n.t + k * gap, v: n.v * (1 - 0.06 * k) })),
  );
}

/** Multiply the velocity of notes on the given beat positions within each bar (backbeats, downbeats). */
export function accent(notes: Note[], positions: number[], amount: number, bar = 4): Note[] {
  return notes.map((n) => {
    const p = ((n.t % bar) + bar) % bar;
    return positions.some((q) => Math.abs(p - q) < 1e-3) ? { ...n, v: Math.min(1, n.v * amount) } : n;
  });
}

/** One note per hit (for drums and percussion), velocity v, pitch n (a MIDI number picks the variant). */
export const hits = (beats: number[], v = 0.8, n = 60): Note[] => beats.map((t) => ({ t, d: 0.25, n, v }));

export type { Rng };
