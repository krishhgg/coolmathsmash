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

/** Early reflections of a small wooden room (mono), so drums and percussion are not bone dry. */
const room = (x: Float32Array, amount: number, tail = 0.08) => {
  const out = new Float32Array(x.length + Math.round(tail * SR));
  out.set(x);
  const dark = filter(x, 'lowpass', 4500);
  const taps = [
    [0.0071, 0.5],
    [0.0113, 0.42],
    [0.0167, 0.36],
    [0.0229, 0.3],
    [0.0311, 0.24],
    [0.0397, 0.19],
    [0.0523, 0.13],
    [0.0641, 0.09],
  ] as const;
  for (const [at, g] of taps) {
    const o = Math.round(at * SR);
    for (let i = 0; i < dark.length && o + i < out.length; i++) out[o + i]! += dark[i]! * g * amount;
  }
  return out;
};

// ---------------------------------------------------------------- winds and reeds

/** Clarinet: a woody odd-harmonic tone that opens up with the breath, scooped attacks, jazz vibrato. */
export const clarinet: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.14;
  const v = vib(f, 5.4, dur > 0.3 ? 0.009 : 0.004, 0.18);
  const pitch = (t: number) => v(t) * (1 - 0.009 * Math.exp(-t / 0.035));
  const body = layer(len, [osc(len, pitch, 'square'), 0.4], [osc(len, pitch), 0.6]);
  const cut = env(len, [
    [0, f * 1.2 + 300],
    [0.06, f * (1.8 + 1.4 * vel) + 600],
    [Math.max(0.07, dur), f * (1.6 + 1.2 * vel) + 500],
    [len, f * 1.2 + 300],
  ]);
  let tone: Float32Array = filter(body, 'lowpass', follow(cut), 0.5);
  tone = filter(tone, 'highshelf', 3200, 0.7, -5);
  tone = filter(tone, 'peak', 700, 1, 2);
  const breath = mul(
    filter(filter(noise(len, rng), 'bandpass', Math.min(4000, f * 2.5), 1.2), 'lowpass', 5000),
    adsr(len, 0.015, 0.08, 0.5, 0.08),
  );
  const swell = env(len, [
    [0, 0],
    [0.045, 0.85],
    [Math.max(0.05, dur * 0.7), 1],
    [Math.max(0.06, dur), 0.92],
    [dur + 0.12, 0],
    [len, 0],
  ]);
  return mul(layer(len, [tone, 1], [breath, 0.09]), mul(swell, vel * 0.55));
};

/** Musette accordion: three saw reeds (one sharp, one flat) through a soft reed formant, bellows swell. */
export const accordion: Instrument = (f, dur, vel) => {
  const len = dur + 0.08;
  const reed = (cents: number, ph: number) =>
    osc(len, (t) => f * 2 ** (cents / 1200) * (1 + 0.0015 * Math.sin(2 * Math.PI * 5.5 * t)), 'saw', {
      phase: ph,
    });
  const reeds = layer(len, [reed(0, 0), 0.42], [reed(11, 0.31), 0.32], [reed(-8, 0.67), 0.26]);
  let tone: Float32Array = filter(reeds, 'lowpass', Math.min(2800, f * 3.5), 0.55);
  tone = filter(tone, 'peak', 1000, 1.2, 3);
  tone = filter(tone, 'peak', 3000, 1.2, -5);
  tone = filter(tone, 'highshelf', 4500, 0.7, -10);
  const end = Math.max(0.04, dur);
  const bellows = env(len, [
    [0, 0],
    [0.03, 0.8],
    [Math.max(0.035, end * 0.6), 1],
    [end, 0.9],
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

/** Human whistle: a breathy near-sine that scoops into the note, with a little throat warmth and vibrato. */
export const whistle: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.12;
  const v = vib(f, 5.2, 0.009, 0.2);
  const pitch = (t: number) => v(t) * (1 - 0.03 * Math.exp(-t / 0.035));
  const tone = layer(
    len,
    [osc(len, pitch), 1],
    [osc(len, (t) => pitch(t) * 2), 0.07],
    [osc(len, (t) => pitch(t) * 3), 0.025],
  );
  const breath = filter(filter(noise(len, rng), 'bandpass', Math.min(6000, f * 1.3), 1.5), 'lowpass', 4000);
  return mul(layer(len, [tone, 1], [breath, 0.12]), mul(adsr(len, 0.035, 0.1, 0.82, 0.09), vel * 0.48));
};

/** Harmonica: two beating reeds through a cupped-hands formant, bent up into each note, hand tremolo. */
export const harmonica: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.1;
  const pitch = (t: number) => f * (1 - 0.025 * Math.exp(-t / 0.04));
  const reeds = layer(
    len,
    [osc(len, pitch, 'pulse', { width: 0.38 }), 0.55],
    [osc(len, (t) => pitch(t) * 1.004, 'saw', { phase: 0.4 }), 0.45],
  );
  let tone: Float32Array = layer(
    len,
    [filter(reeds, 'bandpass', 1100, 1.2), 1],
    [filter(reeds, 'lowpass', Math.min(2000, f * 2.5), 0.7), 0.7],
  );
  tone = filter(tone, 'highshelf', 3500, 0.7, -8);
  const breath = filter(noise(len, rng), 'bandpass', 1600, 1);
  const trem = tremolo(len, 5.2, dur > 0.35 ? 0.25 : 0);
  return mul(
    mul(drive(layer(len, [tone, 1], [breath, 0.05]), 1.4), trem),
    mul(adsr(len, 0.03, 0.1, 0.8, 0.07), vel * 0.42),
  );
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

/** Slide whistle gliding an octave (up when rise is 1, down when -1) over the note, breathy and soft. */
const slide =
  (rise: number): Instrument =>
  (f, dur, vel, rng) => {
    const len = dur + 0.08;
    const pitch = (t: number) =>
      f * 2 ** (rise * Math.min(1, t / dur) ** 0.8) * (1 + 0.008 * Math.sin(2 * Math.PI * 6 * t));
    const tone = layer(len, [osc(len, pitch), 1], [osc(len, (t) => pitch(t) * 2), 0.06]);
    const breath = filter(filter(noise(len, rng), 'bandpass', 1800, 1), 'lowpass', 3500);
    return mul(
      filter(layer(len, [tone, 1], [breath, 0.1]), 'lowpass', 3500),
      mul(adsr(len, 0.03, 0.05, 0.85, 0.06), vel * 0.36),
    );
  };

/** Slide whistle swooping up an octave (cartoon gag). */
export const slideUp: Instrument = slide(1);

/** Slide whistle swooping down an octave. */
export const slideDown: Instrument = slide(-1);

/** Brass section stab: three players entering a few ms apart, each lipping up into the note. */
export const brassHit: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.18;
  const player = (cents: number, delay: number, ph: number) => {
    const pitch = (t: number) =>
      f * 2 ** (cents / 1200) * (1 - 0.03 * Math.exp(-Math.max(0, t - delay) / 0.025));
    const cut = env(len, [
      [0, f],
      [delay + 0.035, Math.min(4500, f * (2.5 + 3 * vel))],
      [delay + 0.2, Math.min(3000, f * 2.5)],
      [len, f * 2],
    ]);
    const tone = filter(osc(len, pitch, 'saw', { phase: ph }), 'lowpass', follow(cut), 0.9);
    const gate = env(len, [
      [0, 0],
      [delay, 0],
      [delay + 0.02, 1],
      [delay + 0.1, 0.75],
      [Math.max(delay + 0.11, dur), 0.65],
      [dur + 0.15, 0],
      [len, 0],
    ]);
    return mul(tone, gate);
  };
  const section = layer(
    len,
    [player(-6, 0, 0.1), 0.36],
    [player(0, 0.008, 0.5), 0.34],
    [player(7, 0.015, 0.8), 0.3],
  );
  const breath = mul(filter(noise(len, rng), 'bandpass', f * 3, 2), adsr(len, 0.01, 0.06, 0.2, 0.05));
  let tone: Float32Array = layer(len, [section, 1], [breath, 0.04]);
  tone = filter(tone, 'peak', 2600, 1.2, -4);
  return mul(tone, vel * 0.55);
};

/** Car horn: a dual-tone square honk through a tinny formant, sagging slightly as it lets go. */
export const horn: Instrument = (f, dur, vel) => {
  const len = dur + 0.08;
  const pitch = (t: number) => f * (1 - 0.02 * Math.max(0, (t - dur * 0.6) / Math.max(0.05, dur * 0.4)));
  const src = osc(len, pitch, 'square');
  const tone = layer(len, [filter(src, 'bandpass', 800, 1.5), 1], [filter(src, 'bandpass', 1900, 3), 0.35]);
  return mul(drive(tone, 1.5), mul(adsr(len, 0.008, 0.05, 0.85, 0.05), vel * 0.5));
};

/** Warm string section: six detuned saws with drifting vibrato, rounded off, slow bow. */
export const warmStrings: Instrument = (f, dur, vel) => {
  const len = dur + 0.45;
  const voices = [-14, -7, -3, 3, 7, 14].map(
    (c, k) =>
      [
        osc(
          len,
          (t) => f * 2 ** (c / 1200) * (1 + 0.004 * Math.sin(2 * Math.PI * (4.6 + 0.37 * k) * t + k)),
          'saw',
          { phase: (k * 0.29) % 1 },
        ),
        1 / 6,
      ] as const,
  );
  let tone: Float32Array = filter(layer(len, ...voices), 'lowpass', Math.min(3200, f * 3.5), 0.6);
  tone = filter(tone, 'peak', 2500, 1, -3);
  const warmth = osc(len, f);
  return mul(layer(len, [tone, 1], [warmth, 0.25]), mul(adsr(len, 0.22, 0.3, 0.9, 0.4), vel * 0.45));
};

/** Cartoon duck quack: a nasal buzz through two soft formants, pitch falling. */
export const quack: Instrument = (f, _dur, vel, rng) => {
  const len = 0.2;
  const pitch = (t: number) => f * (1.15 - 0.5 * Math.min(1, t / len));
  const buzz = osc(len, pitch, 'pulse', { width: 0.18 });
  const tone = layer(
    len,
    [filter(buzz, 'bandpass', 900, 2.5), 1],
    [filter(buzz, 'bandpass', 2200, 4), 0.3],
    [filter(noise(len, rng), 'bandpass', 1800, 2), 0.08],
  );
  const shape = env(len, [
    [0, 0],
    [0.012, 1],
    [0.09, 0.8],
    [len, 0],
  ]);
  return mul(filter(drive(tone, 1.6), 'lowpass', 3000), mul(shape, vel * 0.6));
};

// ---------------------------------------------------------------- plucked strings

/** Mandolin: doubled steel courses with a pick click; long notes become a hand-played tremolo. */
export const mandolin: Instrument = (f, dur, vel, rng) => {
  const course = (len: number, v: number) => {
    const a = pluck(len, f, rng, 0.6 + 0.25 * v, 0.994);
    const b = pluck(len, f * 1.0025, rng, 0.6 + 0.25 * v, 0.994);
    const pick = mul(filter(noise(0.006, rng), 'highpass', 2500), decay(0.006, 0.0015));
    return mul(layer(len, [a, 0.5], [b, 0.5], [pick, 0.15]), mul(decay(len, 0.45, 0.002), v));
  };
  const strokes: number[] = [0];
  if (dur > 0.3)
    while (strokes.at(-1)! < dur - 0.05) strokes.push(strokes.at(-1)! + (0.068 + 0.016 * rng.next()));
  const len = dur + 0.4;
  const parts = strokes.map((at, k) => {
    const v = vel * (k === 0 ? 1 : (k % 2 ? 0.58 : 0.74) * (0.85 + 0.3 * rng.next()));
    return [course(Math.max(0.2, Math.min(0.5, len - at)), v), 1, at] as const;
  });
  let tone: Float32Array = place(len, parts);
  tone = filter(tone, 'highpass', 160);
  tone = filter(tone, 'peak', 420, 1.2, 3);
  tone = filter(tone, 'peak', 2400, 1, 1.5);
  return mul(filter(tone, 'lowpass', 6000), mul(hold(len, dur + 0.1, 0.22), 0.6));
};

/** Banjo: bright twangy pluck through a ringing drum-head resonance. */
export const banjo: Instrument = (f, dur, vel, rng) => {
  const len = Math.max(0.35, Math.min(0.9, dur + 0.3));
  let s: Float32Array = pluck(len, f, rng, 0.9 + 0.08 * vel, 0.991);
  s = filter(s, 'highpass', 250);
  s = filter(s, 'peak', 1800, 1.5, 4);
  s = filter(s, 'peak', 3500, 1.2, -3);
  s = filter(s, 'lowpass', 6500);
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

/** Slap/pop bass: a warm thumbed body (fundamental and second harmonic) under a string pluck whose filter
 * snaps shut; harder hits are brighter. */
export const slapBass: Instrument = (f, dur, vel, rng) => {
  const len = dur + 0.08;
  const cut = env(len, [
    [0, 900 + 2600 * vel],
    [0.04, 600 + 500 * vel],
    [0.3, 400],
    [len, 380],
  ]);
  const str = filter(pluck(len, f, rng, 0.8, 0.997), 'lowpass', follow(cut), 1.1);
  const body = layer(len, [osc(len, f), 0.85], [osc(len, f * 2, 'sine', { phase: 0.25 }), 0.22]);
  const pop = mul(filter(noise(0.02, rng), 'bandpass', 1600, 1), decay(0.02, 0.004));
  return mul(
    layer(len, [drive(str, 1.4), 0.6], [body, 0.75], [pop, 0.12 * vel]),
    mul(adsr(len, 0.003, 0.18, 0.72, 0.045), vel * 0.85),
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

/** Xylophone: a rosewood bar struck with medium-soft mallets, its resonator ringing on a little. */
export const xylo: Instrument = (f, _dur, vel, rng) => {
  const len = 0.7;
  const bar = partials(len, f, [
    [1, 1, 0.2 + 0.1 * (1 - vel)],
    [1, 0.35, 0.45],
    [3.0, 0.18 * vel, 0.05],
    [6.1, 0.04 * vel, 0.015],
  ]);
  const tick = mul(filter(noise(0.006, rng), 'bandpass', Math.min(6000, f * 3), 1), decay(0.006, 0.0015));
  return mul(filter(layer(len, [bar, 1], [tick, 0.1 + 0.1 * vel]), 'lowpass', 7000), vel * 0.6);
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

/** Kick: a round low body with a pitch drop and sub tail, a felt-beater knock, a little room. */
export const kick: Instrument = (_f, _d, vel, rng) => {
  const len = 0.55;
  const body = mul(
    osc(len, (t) => 50 + 105 * Math.exp(-t / 0.025) + 22 * Math.exp(-t / 0.12)),
    decay(len, 0.26 + 0.1 * vel, 0.002),
  );
  const knock = mul(filter(noise(0.03, rng), 'bandpass', 1800, 0.9), decay(0.03, 0.005));
  const thud = mul(filter(noise(0.06, rng), 'lowpass', 220), decay(0.06, 0.02));
  const hit = drive(layer(len, [body, 1], [knock, 0.12 + 0.12 * vel], [thud, 0.4]), 1.5);
  return mul(room(hit, 0.12), vel * 0.9);
};

/** Snare: drum-head modes, a wire rattle with a woody mid crack, and room; each stroke a little different. */
export const snare: Instrument = (_f, _d, vel, rng) => {
  const len = 0.45;
  const tune = 1 + 0.03 * (rng.next() - 0.5);
  const head = layer(
    len,
    [
      mul(
        osc(len, (t) => 190 * tune * (1 + 0.12 * Math.exp(-t / 0.012))),
        decay(len, 0.08, 0.001),
      ),
      0.7,
    ],
    [mul(osc(len, 345 * tune), decay(len, 0.04, 0.001)), 0.3],
  );
  const raw = noise(len, rng);
  const wires = mul(
    layer(
      len,
      [filter(filter(raw, 'highpass', 2500), 'lowpass', 3500 + 4500 * vel), 0.7],
      [filter(raw, 'bandpass', 1300, 0.8), 0.5],
    ),
    decay(len, 0.09 + 0.08 * vel, 0.0015),
  );
  const crack = mul(filter(noise(0.015, rng), 'bandpass', 2600, 1), decay(0.015, 0.003));
  const hit = drive(layer(len, [head, 0.75 + 0.15 * (1 - vel)], [wires, 0.6], [crack, 0.3 * vel]), 1.25);
  return mul(room(hit, 0.3, 0.1), vel * 0.75);
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

/** Hand clap: a few hands slightly apart (each burst a little different) with a short room. */
export const clap: Instrument = (_f, _d, vel, rng) => {
  const len = 0.3;
  const burst = (tau: number, fc: number) =>
    mul(filter(noise(0.25, rng), 'bandpass', fc, 0.9), decay(0.25, tau, 0.0008));
  const gaps = [0, 0.006 + 0.004 * rng.next(), 0.014 + 0.005 * rng.next(), 0.022 + 0.004 * rng.next()];
  const out = place(
    len,
    gaps.map(
      (at, k) => [burst(k === 3 ? 0.045 : 0.005, 1000 + 500 * rng.next()), k === 3 ? 1 : 0.7, at] as const,
    ),
  );
  return mul(room(filter(out, 'highshelf', 5000, 0.7, -6), 0.35, 0.1), vel * 0.8);
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

/** Tom: pitched body (the note's pitch) with skin noise, a stick attack and room. */
export const tom: Instrument = (f, _d, vel, rng) => {
  const len = 0.7;
  const body = mul(
    osc(len, (t) => f * (1 + 0.3 * Math.exp(-t / 0.05))),
    decay(len, 0.25, 0.001),
  );
  const skin = mul(filter(noise(len, rng), 'bandpass', f * 2.5, 1.2), decay(len, 0.06, 0.001));
  const stick = mul(filter(noise(0.02, rng), 'bandpass', 2000, 0.8), decay(0.02, 0.004));
  return mul(room(drive(layer(len, [body, 1], [skin, 0.25], [stick, 0.2]), 1.3), 0.25), vel * 0.8);
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

/** Construction clank: a hammer on a steel girder (pitch picks the beam), gritty and ringing. */
export const clank: Instrument = (f, _d, vel, rng) => {
  const len = 0.9;
  const beam = partials(len, f, [
    [1, 1, 0.35],
    [1.53, 0.55, 0.25],
    [2.31, 0.7, 0.2],
    [3.89, 0.5, 0.13],
    [5.12, 0.4, 0.09],
    [6.73, 0.25, 0.06],
  ]);
  const grit = mul(filter(noise(len, rng), 'bandpass', f * 2.3, 6), decay(len, 0.12, 0.001));
  const hit = mul(filter(noise(0.025, rng), 'bandpass', 2500, 0.9), decay(0.025, 0.005));
  return mul(room(drive(layer(len, [beam, 0.55], [grit, 0.5], [hit, 0.7]), 1.6), 0.3), vel * 0.42);
};

/** Cowbell: two square tones through a band-pass, quick decay, a touch of room. */
export const cowbell: Instrument = (_f, _d, vel) => {
  const len = 0.3;
  const tone = layer(len, [osc(len, 545, 'square'), 0.5], [osc(len, 815, 'square'), 0.5]);
  return mul(room(filter(tone, 'bandpass', 900, 2), 0.3), mul(decay(len + 0.08, 0.07, 0.001), vel * 0.4));
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

/**
 * A hand-played roll from start to end (beats) at rate strokes per beat: alternating hands (the weaker hand
 * a little softer and later) under an exponential crescendo from v0 to v1.
 */
export function roll(start: number, end: number, rate: number, v0: number, v1: number, seed = 1): Note[] {
  const n = Math.round((end - start) * rate);
  return Array.from({ length: n }, (_, k) => {
    const p = k / Math.max(1, n - 1);
    return {
      t: start + k / rate + (k % 2 ? 0.008 : 0) + hash(seed, k) * 0.006,
      d: 1 / rate,
      n: 60,
      v: v0 * (v1 / v0) ** (p * p) * (k % 2 ? 0.86 : 1) * (0.94 + 0.12 * hash(seed + 7, k)),
    };
  });
}

export type { Rng };
