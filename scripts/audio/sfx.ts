/**
 * Sound effect recipes: every file under public/audio/sfx/ is rendered from one of these by
 * `node scripts/audio/build-sfx.ts`. Each recipe renders mono at 44.1 kHz from a seeded RNG, so the output is
 * reproducible and variants differ only by seed and the small per-variant tweak `v` (0, 1, 2...).
 */
import type { Rng } from './dsp.ts';
import {
  SR,
  add,
  buffer,
  decay,
  drive,
  env,
  filter,
  fm,
  layer,
  midiHz,
  modDelay,
  mul,
  noise,
  normalize,
  osc,
  partials,
  reverbMono,
  trim,
  type Param,
} from './dsp.ts';

export interface Recipe {
  variants: number;
  render(rng: Rng, v: number): Float32Array;
}

// ---------------------------------------------------------------- building blocks

/** A few milliseconds of bright noise: the transient that makes a hit read as a hit. */
const click = (rng: Rng, len = 0.008, hp = 2500) =>
  mul(filter(noise(len, rng), 'highpass', hp), decay(len, len / 4, 0.0003));

/** A sine whose pitch falls from f0 to f1: the body of punches, landings and booms. */
const thump = (f0: number, f1: number, sweep: number, tau: number, len = tau * 5) =>
  mul(
    osc(len, (t) => f1 + (f0 - f1) * Math.exp(-t / sweep)),
    decay(len, tau, 0.0015),
  );

/** Band-passed noise burst: slaps, skin, cloth. */
const slap = (
  rng: Rng,
  center: Param,
  q: number,
  tau: number,
  len = tau * 5,
  color: 'white' | 'pink' = 'white',
) => mul(filter(noise(len, rng, color), 'bandpass', center, q), decay(len, tau, 0.0008));

/** Driven band-passed noise: crunch and grit. */
const crunch = (rng: Rng, center: number, q: number, tau: number, amount = 3, len = tau * 5) =>
  mul(drive(filter(noise(len, rng), 'bandpass', center, q), amount), decay(len, tau, 0.0008));

/** A train of very short bright bursts a few ms apart: the crack of a whip or lightning. */
function crackle(rng: Rng, times: readonly number[], hp: number, tau: number): Float32Array {
  const out = buffer(Math.max(...times) + tau * 8);
  for (const t of times)
    add(
      out,
      mul(filter(noise(tau * 8, rng), 'highpass', hp), decay(tau * 8, tau, 0.0002)),
      t,
      rng.range(0.6, 1),
    );
  return out;
}

/** Air moving: noise through a swept band-pass with a swell envelope. */
function whoosh(
  rng: Rng,
  len: number,
  sweep: readonly (readonly [number, number])[],
  q: number,
  peakAt: number,
  color: 'white' | 'pink' = 'pink',
): Float32Array {
  const center = env(len, sweep);
  const shape = env(
    len,
    [
      [0, 0],
      [peakAt, 1],
      [len, 0],
    ],
    2,
  );
  return mul(
    filter(
      noise(len, rng, color),
      'bandpass',
      (t) => center[Math.min(center.length - 1, Math.round(t * SR))]!,
      q,
    ),
    shape,
  );
}

/** Mix a sound with a copy through a slowly swept short delay: the comb "phase" shimmer of a dodge. */
const flange = (x: Float32Array, base: number, depth: number, rate: number) =>
  layer(x.length / SR, [x, 0.7], [modDelay(x, (t) => base + depth * Math.sin(2 * Math.PI * rate * t)), 0.7]);

/** Short glassy pings scattered in time: shatter, sparkle, crackle. */
function scatter(
  rng: Rng,
  len: number,
  count: number,
  spread: number,
  lo: number,
  hi: number,
  tau: [number, number],
  bunch = 1.6,
): Float32Array {
  const out = buffer(len);
  for (let i = 0; i < count; i++) {
    const t = spread * rng.next() ** bunch;
    const f = rng.range(lo, hi);
    const d = rng.range(tau[0], tau[1]);
    add(
      out,
      partials(d * 6, f, [
        [1, 1, d],
        [2.7, 0.3, d / 2],
      ]),
      t,
      rng.range(0.3, 1),
    );
  }
  return out;
}

const finish = (x: Float32Array, target = 0.9) => normalize(trim(x, -54), target);

// ---------------------------------------------------------------- hits

/** Light hit (jabs, weak aerials): a crisp high "pap" with a small body. */
function hitLight(rng: Rng, v: number): Float32Array {
  const p = [1, 1.12, 0.9][v] ?? 1;
  return finish(
    layer(
      0.18,
      [click(rng, 0.005, 4000), 0.7],
      [slap(rng, 3300 * p, 1.6, 0.012, 0.08), 1.2],
      [slap(rng, 1800 * p, 1.2, 0.022, 0.13), 0.8],
      [crunch(rng, 2600 * p, 0.8, 0.009, 3, 0.06), 0.35],
      [drive(thump(270 * p, 125, 0.012, 0.028, 0.14), 1.4), 0.6],
    ),
  );
}

/** Medium hit (tilts, strong aerials): a "whap" with a short, punchy body. */
function hitMedium(rng: Rng, v: number): Float32Array {
  const p = [1, 1.1, 0.92][v] ?? 1;
  return finish(
    layer(
      0.34,
      [click(rng, 0.007, 3200), 0.9],
      [slap(rng, 2800 * p, 1.4, 0.02, 0.12), 1.1],
      [slap(rng, 1400 * p, 0.9, 0.04, 0.25), 0.9],
      [crunch(rng, 1600 * p, 0.7, 0.035, 3, 0.25), 0.45],
      [drive(thump(200 * p, 78, 0.02, 0.06, 0.32), 2), 1],
    ),
  );
}

/** Heavy hit (smash attacks): a "WHAM" with a focused crack, a sub that clears out fast and a short room. */
function hitHeavy(rng: Rng, v: number): Float32Array {
  const p = [1, 1.08, 0.93][v] ?? 1;
  const ring = partials(0.4, 760 * p, [
    [1, 0.5, 0.08],
    [1.47, 0.4, 0.06],
    [2.09, 0.3, 0.05],
  ]);
  const dry = layer(
    0.55,
    [click(rng, 0.008, 2500), 0.8],
    [crunch(rng, 2600 * p, 0.6, 0.03, 4, 0.2), 0.9],
    [slap(rng, 1200 * p, 0.8, 0.05, 0.3), 1],
    [drive(thump(160 * p, 48, 0.04, 0.11, 0.55), 2.4), 1.2],
    [crunch(rng, 900 * p, 0.7, 0.06, 4, 0.35), 0.5],
    [ring, 0.18],
  );
  return finish(filter(reverbMono(dry, { room: 0.4, damp: 0.6, wet: 0.16, tail: 0.3 }), 'lowpass', 9000));
}

/** The hit that will KO: a lightning crack over a clean sub boom with a bright glint, like Ultimate's finish. */
function hitKo(rng: Rng): Float32Array {
  const glint = mul(
    layer(0.5, [osc(0.5, 3520), 0.7], [osc(0.5, 3520 * 1.5), 0.25], [osc(0.5, 7040 * 1.003), 0.15]),
    decay(0.5, 0.11, 0.002),
  );
  const dry = layer(
    1.1,
    [crackle(rng, [0, 0.004, 0.009, 0.016, 0.026], 3000, 0.003), 1.3],
    [slap(rng, 5200, 1.2, 0.03, 0.2), 0.7],
    [click(rng, 0.01, 1800), 0.9],
    [slap(rng, 2000, 1, 0.03, 0.2), 0.45],
    [crunch(rng, 1200, 0.8, 0.05, 4, 0.3), 0.5],
    [drive(thump(130, 34, 0.05, 0.22, 1.1), 2.2), 1.75],
    [glint, 0.12, 0.01],
  );
  const wet = reverbMono(dry, { room: 0.6, damp: 0.5, wet: 0.25, tail: 0.45, predelay: 0.015 });
  return finish(filter(filter(wet, 'peak', 2000, 1.1, -6), 'lowshelf', 70, Math.SQRT1_2, 2));
}

/** Layer for fire hitboxes: a warm flame whoosh with ember pops. */
function hitFire(rng: Rng): Float32Array {
  const len = 0.5;
  const flutter = filter(noise(len, rng), 'lowpass', 25).map(
    (s) => 0.6 + Math.max(-0.4, Math.min(0.4, s * 8)),
  );
  const flame = mul(
    mul(
      filter(noise(len, rng, 'pink'), 'bandpass', (t) => 260 + 500 * Math.exp(-t / 0.1), 0.7),
      flutter,
    ),
    env(
      len,
      [
        [0, 0],
        [0.02, 1],
        [len, 0],
      ],
      2,
    ),
  );
  const roar = mul(filter(noise(len, rng), 'bandpass', 1300, 0.7), decay(len, 0.08, 0.005));
  const embers = buffer(len);
  for (let i = 0; i < 22; i++)
    add(embers, click(rng, 0.0025, rng.range(1500, 4000)), 0.45 * rng.next() ** 1.4, rng.range(0.3, 1));
  return finish(layer(len, [flame, 1.3], [roar, 0.45], [embers, 0.6]));
}

/** Layer for electric hitboxes: a snap and crackling micro-arcs over a sizzle. */
function hitElectric(rng: Rng): Float32Array {
  const len = 0.42;
  const arcs = buffer(len);
  for (let t = 0.005; t < len - 0.03;) {
    const on = rng.range(0.004, 0.014);
    add(
      arcs,
      mul(filter(noise(on, rng), 'bandpass', rng.range(3000, 7000), 1.2), decay(on, on / 2, 0.01)),
      t,
      Math.exp(-t / 0.15),
    );
    t += on + rng.range(0.004, 0.02) * (1 + t * 6);
  }
  const sizzle = mul(filter(noise(len, rng), 'highpass', 6000), decay(len, 0.1, 0.002));
  const hum = mul(filter(osc(len, 120, 'saw'), 'lowpass', 400), decay(len, 0.08, 0.002));
  const micro = crackle(
    rng,
    Array.from({ length: 18 }, () => 0.3 * rng.next() ** 1.5),
    6000,
    0.0012,
  );
  return finish(
    filter(
      layer(len, [click(rng, 0.006, 3000), 0.8], [arcs, 1], [micro, 0.6], [sizzle, 0.35], [hum, 0.08]),
      'peak',
      1100,
      0.8,
      -6,
    ),
  );
}

// ---------------------------------------------------------------- shield

/** A hit on the shield: a tight damped thud against a taut barrier, with a crisp glassy force-field ping. */
function shieldHit(rng: Rng, v: number): Float32Array {
  const p = [1, 1.06][v] ?? 1;
  const ping = partials(0.3, 3300 * p, [
    [1, 1, 0.05],
    [1.41, 0.6, 0.04],
    [2.17, 0.35, 0.03],
    [2.9, 0.2, 0.02],
  ]);
  return filter(
    finish(
      layer(
        0.3,
        [click(rng, 0.004, 2500), 0.5],
        [thump(240 * p, 150, 0.008, 0.03, 0.2), 1],
        [slap(rng, 1800 * p, 1, 0.012, 0.1), 0.35],
        [ping, 0.45],
      ),
    ),
    'peak',
    900,
    1,
    -4,
  );
}

function shieldBreak(rng: Rng): Float32Array {
  const shards = scatter(rng, 0.5, 45, 0.16, 4000, 10000, [0.002, 0.008], 1.2);
  const shatter = scatter(rng, 0.9, 40, 0.35, 2200, 7000, [0.015, 0.05]);
  const burst = mul(filter(noise(0.4, rng), 'highpass', 2500), decay(0.4, 0.06, 0.001));
  const glide = (t: number) => 300 * 2 ** (t * 2);
  const gliss = mul(
    filter(
      layer(1.2, [osc(1.2, glide, 'saw'), 0.5], [osc(1.2, (t) => glide(t) * 1.008, 'saw'), 0.5]),
      'lowpass',
      3200,
    ),
    env(1.2, [
      [0, 0],
      [0.1, 1],
      [0.8, 0.6],
      [1.2, 0],
    ]),
  );
  const dry = layer(
    1.5,
    [click(rng, 0.01, 2000), 1],
    [shards, 0.9],
    [shatter, 0.6],
    [burst, 0.7],
    [drive(thump(130, 40, 0.05, 0.2, 1), 2), 1.1],
    [gliss, 0.18, 0.08],
  );
  return finish(reverbMono(dry, { room: 0.65, wet: 0.28, tail: 0.6 }));
}

function shieldOn(rng: Rng): Float32Array {
  const hum = mul(
    osc(0.2, (t) => 190 + 110 * t),
    env(0.2, [
      [0, 0],
      [0.02, 1],
      [0.2, 0],
    ]),
  );
  const sparkle = partials(0.2, 3100, [
    [1, 0.7, 0.04],
    [1.5, 0.5, 0.03],
    [2.2, 0.3, 0.02],
  ]);
  return finish(
    layer(0.2, [hum, 0.7], [slap(rng, 1300, 1.5, 0.03, 0.15, 'pink'), 0.5], [sparkle, 0.25, 0.01]),
  );
}

/** Seamless 1.2 s loop of soft cartoon birds and stars for the dizzy state. */
function dizzy(rng: Rng): Float32Array {
  const len = 1.2;
  const out = buffer(len);
  const chirp = (f: number) =>
    mul(
      layer(
        0.09,
        [osc(0.09, (t) => f * (1.25 - 3 * t)), 0.6],
        [osc(0.09, (t) => f * 1.006 * (1.25 - 3 * t)), 0.6],
      ),
      env(
        0.09,
        [
          [0, 0],
          [0.015, 1],
          [0.09, 0],
        ],
        2,
      ),
    );
  for (const [t, f] of [
    [0.02, 3300],
    [0.14, 3600],
    [0.62, 3100],
    [0.74, 3400],
  ] as const)
    add(out, chirp(f), t, 0.8);
  add(out, scatter(rng, 0.4, 6, 0.25, 2500, 5000, [0.03, 0.05]), 0.32, 0.2);
  add(out, scatter(rng, 0.4, 6, 0.25, 2500, 5000, [0.03, 0.05]), 0.9, 0.2);
  const wet = reverbMono(out, { room: 0.3, wet: 0.15, tail: 0 }).slice(0, out.length);
  return normalize(filter(wet, 'lowpass', 7000), 0.7);
}

// ---------------------------------------------------------------- launches and KOs

function launch(rng: Rng, v: number): Float32Array {
  const strong = v === 1;
  const len = strong ? 1 : 0.65;
  const whip = slap(rng, 2600, 1, 0.012, 0.08);
  const air = whoosh(
    rng,
    len,
    [
      [0, 1200],
      [len * 0.2, strong ? 1300 : 1100],
      [len, 320],
    ],
    strong ? 0.8 : 0.9,
    0.015,
  );
  const rumble = mul(
    filter(noise(len, rng, 'brown'), 'lowpass', 320),
    env(
      len,
      [
        [0, 0],
        [0.03, 1],
        [len, 0],
      ],
      2,
    ),
  );
  return finish(layer(len, [whip, 0.8], [air, 1.2], [rumble, strong ? 0.6 : 0.3]));
}

/** The blast-zone explosion: a cannon punch, a short blast and a bright sparkle trail. */
function koBlast(rng: Rng): Float32Array {
  const len = 1.6;
  const blast = mul(
    drive(
      filter(noise(len, rng), 'lowpass', (t) => 400 + 5000 * Math.exp(-t / 0.12)),
      2.5,
    ),
    decay(len, 0.2, 0.002),
  );
  const sparkle = layer(
    len,
    [scatter(rng, len, 50, 0.9, 4000, 9000, [0.02, 0.06], 1), 0.5, 0.05],
    [
      mul(
        filter(noise(len, rng), 'highpass', 6000),
        env(
          len,
          [
            [0, 0],
            [0.05, 1],
            [0.9, 0],
          ],
          2,
        ),
      ),
      0.25,
    ],
  );
  const dry = layer(
    len,
    [click(rng, 0.012, 1500), 1],
    [drive(thump(115, 46, 0.03, 0.17, 1), 3), 1.4],
    [blast, 0.8],
    [sparkle, 0.9],
  );
  return finish(reverbMono(dry, { room: 0.7, damp: 0.4, wet: 0.3, tail: 0.7, predelay: 0.02 }));
}

// ---------------------------------------------------------------- movement

function jump(rng: Rng, v: number): Float32Array {
  const p = [1, 1.1][v] ?? 1;
  const air = whoosh(
    rng,
    0.16,
    [
      [0, 700 * p],
      [0.1, 2600 * p],
      [0.16, 2000],
    ],
    2,
    0.03,
  );
  const push = thump(200 * p, 110, 0.01, 0.015, 0.08);
  return finish(layer(0.16, [air, 1], [push, 0.25]));
}

function doubleJump(rng: Rng): Float32Array {
  const air = whoosh(
    rng,
    0.26,
    [
      [0, 900],
      [0.14, 3200],
      [0.26, 2200],
    ],
    1.5,
    0.05,
  );
  const tone = mul(
    osc(0.2, (t) => 600 + 1800 * t, 'triangle'),
    env(
      0.2,
      [
        [0, 0],
        [0.03, 1],
        [0.2, 0],
      ],
      2,
    ),
  );
  return finish(layer(0.26, [flange(air, 0.0018, 0.0012, 9), 1], [tone, 0.05]));
}

function land(rng: Rng, v: number): Float32Array {
  const heavy = v === 2;
  const p = [1, 0.9, 0.8][v] ?? 1;
  const len = heavy ? 0.35 : 0.2;
  return finish(
    layer(
      len,
      [thump(150 * p, 55, 0.02, heavy ? 0.07 : 0.04, len), 1],
      [slap(rng, 900, 0.7, heavy ? 0.07 : 0.045, len, 'pink'), heavy ? 1.1 : 0.8],
      [click(rng, 0.006, 1500), 0.3],
    ),
  );
}

function dash(rng: Rng, v: number): Float32Array {
  const p = [1, 1.12][v] ?? 1;
  const sweep = whoosh(
    rng,
    0.3,
    [
      [0, 2300 * p],
      [0.3, 650],
    ],
    1.1,
    0.03,
    'white',
  );
  const grit = mul(
    slap(rng, 3200, 2.5, 0.06, 0.3),
    osc(0.3, 37, 'square').map((s) => 0.65 + 0.35 * s),
  );
  return finish(
    layer(
      0.3,
      [click(rng, 0.005, 1500), 0.5],
      [thump(190, 85, 0.012, 0.028, 0.15), 0.8],
      [sweep, 0.9, 0.01],
      [grit, 0.3],
    ),
  );
}

function skid(rng: Rng): Float32Array {
  const len = 0.38;
  const rough = mul(filter(noise(len, rng), 'lowpass', 60), 4).map(
    (s) => 0.5 + Math.max(-0.5, Math.min(0.5, s)),
  );
  const shape = env(
    len,
    [
      [0, 0],
      [0.02, 1],
      [len, 0],
    ],
    1.5,
  );
  const friction = mul(mul(filter(noise(len, rng), 'bandpass', 550, 1), rough), shape);
  const scrape = mul(
    mul(
      filter(noise(len, rng), 'bandpass', (t) => 2600 - 1200 * t, 1.5),
      rough,
    ),
    shape,
  );
  return finish(layer(len, [friction, 1.2], [scrape, 0.6]));
}

function step(rng: Rng, v: number): Float32Array {
  const p = [1, 1.15, 0.9][v] ?? 1;
  return finish(
    layer(
      0.09,
      [click(rng, 0.003, 3000), 0.4],
      [slap(rng, 1100 * p, 1, 0.012, 0.09, 'pink'), 1],
      [thump(130 * p, 70, 0.01, 0.015, 0.09), 0.6],
    ),
  );
}

function ledgeGrab(rng: Rng): Float32Array {
  return finish(
    layer(
      0.2,
      [click(rng, 0.006, 2800), 0.9],
      [slap(rng, 1250, 1.8, 0.022, 0.15), 1],
      [thump(220, 120, 0.015, 0.03, 0.15), 0.6],
      [slap(rng, 3000, 1, 0.04, 0.2, 'pink'), 0.25, 0.02],
    ),
  );
}

/** Dodge: a quick airy swish with a phasing shimmer (the intangibility). */
function dodge(rng: Rng): Float32Array {
  const air = whoosh(
    rng,
    0.32,
    [
      [0, 1500],
      [0.09, 3600],
      [0.32, 1800],
    ],
    1.2,
    0.05,
    'white',
  );
  const sparkle = partials(0.3, 3100, [
    [1, 0.6, 0.08],
    [1.5, 0.4, 0.06],
    [2.01, 0.25, 0.05],
  ]);
  const zipF = (t: number) => 1400 + 2600 * Math.min(1, t / 0.05);
  const zip = mul(
    layer(0.1, [osc(0.1, zipF, 'triangle'), 1], [osc(0.1, (t) => zipF(t) * 1.5), 0.4]),
    decay(0.1, 0.03, 0.002),
  );
  return finish(
    layer(
      0.32,
      [flange(air, 0.0025, 0.002, 14), 0.65],
      [flange(zip, 0.0015, 0.001, 20), 0.55],
      [sparkle, 0.2, 0.03],
    ),
  );
}

/** Roll: two cloth-and-floor scuffs under a low swoosh. */
function roll(rng: Rng): Float32Array {
  const air = whoosh(
    rng,
    0.36,
    [
      [0, 600],
      [0.14, 1300],
      [0.36, 700],
    ],
    1,
    0.1,
  );
  return finish(
    layer(
      0.38,
      [filter(air, 'lowpass', 1800), 0.4],
      [slap(rng, 520, 0.9, 0.035, 0.2, 'pink'), 0.8],
      [slap(rng, 460, 0.9, 0.045, 0.2, 'pink'), 0.75, 0.16],
      [thump(190, 90, 0.02, 0.04, 0.2), 0.9],
      [thump(170, 80, 0.02, 0.045, 0.2), 0.9, 0.16],
    ),
  );
}

/**
 * The smash charge: a crystalline glint, then a warm shimmering swell that rises and brightens under a gentle
 * pulsing aura, with a power hum underneath (60 frames max).
 */
function smashCharge(rng: Rng): Float32Array {
  const len = 1.05;
  const f = (t: number) => 146.8 * 2 ** (t * 0.5);
  const vib = (t: number) => 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.3);
  const swell = filter(
    layer(
      len,
      [osc(len, (t) => f(t) * vib(t), 'saw'), 0.3],
      [osc(len, (t) => f(t) * 1.005 * vib(t), 'saw', { phase: 0.4 }), 0.3],
      [osc(len, (t) => f(t) * 2 * vib(t), 'triangle'), 0.3],
      [osc(len, (t) => f(t) * 3.01, 'sine'), 0.12],
    ),
    'lowpass',
    (t) => 900 + 2600 * t,
    0.9,
  );
  const hum = mul(
    layer(len, [osc(len, f), 0.7], [osc(len, (t) => f(t) / 2), 0.4]),
    env(len, [
      [0, 0.3],
      [len, 1],
    ]),
  );
  let ph = 0;
  const aura = new Float32Array(swell.length);
  for (let i = 0; i < aura.length; i++) {
    ph += (5 + 4 * (i / aura.length)) / SR;
    aura[i] = 0.85 + 0.15 * Math.sin(2 * Math.PI * ph);
  }
  const glint = partials(0.35, 4186, [
    [1, 1, 0.07],
    [1.5, 0.5, 0.06],
    [2, 0.4, 0.05],
    [3, 0.2, 0.03],
  ]);
  const glints = buffer(len);
  for (let i = 0; i < 14; i++)
    add(
      glints,
      partials(0.15, rng.range(3500, 7000), [
        [1, 1, 0.03],
        [2.4, 0.3, 0.015],
      ]),
      len * (0.2 + 0.8 * Math.sqrt(rng.next())),
      rng.range(0.2, 0.6),
    );
  const air = mul(
    filter(noise(len, rng), 'highpass', 5000),
    env(len, [
      [0, 0.05],
      [len, 0.4],
    ]),
  );
  const body = mul(
    layer(len, [mul(swell, aura), 1], [hum, 0.45], [glints, 0.25], [air, 0.08]),
    env(len, [
      [0, 0],
      [0.06, 0.45],
      [len - 0.1, 1],
      [len, 0.75],
    ]),
  );
  return normalize(layer(len, [body, 1], [glint, 0.5]), 0.85);
}

function swing(rng: Rng, v: number): Float32Array {
  const len = [0.16, 0.24, 0.36][v]!;
  const lo = [1500, 1000, 650][v]!;
  const hi = [3800, 2800, 1800][v]!;
  const air = whoosh(
    rng,
    len,
    [
      [0, lo],
      [len * 0.4, hi],
      [len, lo],
    ],
    1.5,
    len * 0.35,
  );
  return finish(air);
}

function respawn(rng: Rng): Float32Array {
  const bell = (f: number) =>
    partials(1.1, f, [
      [1, 0.7, 0.32],
      [2, 0.25, 0.2],
      [3.01, 0.12, 0.14],
    ]);
  const dry = layer(
    1.1,
    [bell(midiHz(84)), 0.5],
    [bell(midiHz(88)), 0.4, 0.06],
    [bell(midiHz(91)), 0.4, 0.12],
    [bell(midiHz(96)), 0.25, 0.18],
    [scatter(rng, 0.8, 14, 0.5, 3500, 7000, [0.04, 0.09]), 0.15, 0.05],
  );
  return finish(reverbMono(dry, { room: 0.7, wet: 0.3, tail: 0.3 }), 0.8);
}

// ---------------------------------------------------------------- menus

function menuMove(): Float32Array {
  const len = 0.07;
  const tone = layer(len, [osc(len, 1320, 'square'), 0.5], [osc(len, 2640, 'triangle'), 0.3]);
  return finish(filter(mul(tone, decay(len, 0.014, 0.001)), 'lowpass', 6500), 0.75);
}

function menuSelect(rng: Rng): Float32Array {
  const note = (m: number, len: number) =>
    mul(
      fm(len, midiHz(m), 3.5, (t) => 2.2 * Math.exp(-t / 0.05)),
      decay(len, 0.09, 0.002),
    );
  const dry = layer(
    0.45,
    [note(88, 0.3), 0.7],
    [note(95, 0.35), 0.7, 0.06],
    [scatter(rng, 0.3, 8, 0.15, 5000, 9000, [0.02, 0.05]), 0.12, 0.05],
  );
  return finish(reverbMono(dry, { room: 0.4, wet: 0.2, tail: 0.3 }), 0.8);
}

function menuBack(): Float32Array {
  const note = (f: number) =>
    mul(
      layer(0.12, [osc(0.12, f, 'square'), 0.35], [osc(0.12, f / 2, 'triangle'), 0.6]),
      decay(0.12, 0.035, 0.002),
    );
  return finish(
    filter(layer(0.22, [note(midiHz(79)), 1], [note(midiHz(72)), 1, 0.07]), 'lowpass', 5000),
    0.75,
  );
}

/** Refused: two short muted low blips, in the same soft palette as the other menu sounds. */
function menuError(): Float32Array {
  const blip = (f: number) =>
    mul(
      layer(0.08, [osc(0.08, f, 'triangle'), 0.8], [osc(0.08, f * 2, 'square'), 0.12]),
      decay(0.08, 0.025, 0.003),
    );
  return finish(
    filter(layer(0.2, [blip(midiHz(55)), 1], [blip(midiHz(54)), 1, 0.095]), 'lowpass', 1800),
    0.75,
  );
}

/** A two-step pitched switch: a light tick, then a firmer snap a fifth up. */
function menuToggle(rng: Rng): Float32Array {
  const blip = (f: number) => mul(osc(0.05, f, 'triangle'), decay(0.05, 0.012, 0.002));
  return finish(
    layer(
      0.11,
      [click(rng, 0.003, 4000), 0.4],
      [blip(midiHz(84)), 0.6],
      [click(rng, 0.005, 1800), 0.8, 0.045],
      [blip(midiHz(91)), 0.7, 0.045],
    ),
    0.7,
  );
}

/** "Ready to fight": a big riser into an impact and a bright stab. */
function menuStart(rng: Rng): Float32Array {
  const riser = whoosh(
    rng,
    0.55,
    [
      [0, 400],
      [0.55, 4200],
    ],
    1.4,
    0.53,
    'white',
  );
  const stab = layer(
    0.9,
    ...[60, 67, 72, 76, 79].map(
      (m) => [mul(osc(0.9, midiHz(m), 'saw'), decay(0.9, 0.25, 0.004)), 0.15] as const,
    ),
  );
  const dry = layer(
    1.6,
    [riser, 0.7],
    [click(rng, 0.012, 1500), 1, 0.55],
    [drive(thump(150, 40, 0.06, 0.22, 1), 2), 1, 0.55],
    [filter(stab, 'lowpass', 3000), 1, 0.55],
  );
  return finish(reverbMono(dry, { room: 0.75, wet: 0.35, tail: 0.8 }));
}

export const RECIPES: Record<string, Recipe> = {
  'hit-light': { variants: 3, render: hitLight },
  'hit-medium': { variants: 3, render: hitMedium },
  'hit-heavy': { variants: 3, render: hitHeavy },
  'hit-ko': { variants: 1, render: hitKo },
  'hit-fire': { variants: 2, render: hitFire },
  'hit-electric': { variants: 1, render: hitElectric },
  'shield-hit': { variants: 2, render: shieldHit },
  'shield-break': { variants: 1, render: shieldBreak },
  'shield-on': { variants: 1, render: shieldOn },
  dizzy: { variants: 1, render: dizzy },
  launch: { variants: 2, render: launch },
  'ko-blast': { variants: 1, render: koBlast },
  jump: { variants: 2, render: jump },
  'double-jump': { variants: 1, render: doubleJump },
  land: { variants: 3, render: land },
  dash: { variants: 2, render: dash },
  skid: { variants: 1, render: skid },
  step: { variants: 3, render: step },
  'ledge-grab': { variants: 1, render: ledgeGrab },
  dodge: { variants: 1, render: dodge },
  roll: { variants: 1, render: roll },
  'smash-charge': { variants: 1, render: smashCharge },
  swing: { variants: 3, render: swing },
  respawn: { variants: 1, render: respawn },
  'menu-move': { variants: 1, render: menuMove },
  'menu-select': { variants: 1, render: menuSelect },
  'menu-back': { variants: 1, render: menuBack },
  'menu-error': { variants: 1, render: menuError },
  'menu-toggle': { variants: 1, render: menuToggle },
  'menu-start': { variants: 1, render: menuStart },
};

/** File names (under public/audio/) for a recipe: sfx/<name>-<n>.mp3. */
export const recipeFiles = (name: string) =>
  Array.from({ length: RECIPES[name]?.variants ?? 0 }, (_, i) => `sfx/${name}-${i + 1}.mp3`);
