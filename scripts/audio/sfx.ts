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

/** Short glassy pings scattered in time: shatter, sparkle, crackle. */
function scatter(
  rng: Rng,
  len: number,
  count: number,
  spread: number,
  lo: number,
  hi: number,
  tau: [number, number],
): Float32Array {
  const out = buffer(len);
  for (let i = 0; i < count; i++) {
    const t = spread * rng.next() ** 1.6;
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

/** Light hit (jabs, weak aerials): a snappy high "pap". */
function hitLight(rng: Rng, v: number): Float32Array {
  const p = [1, 1.12, 0.9][v] ?? 1;
  return finish(
    layer(
      0.22,
      [click(rng, 0.007, 3200), 0.9],
      [slap(rng, 2300 * p, 1.3, 0.028, 0.16), 1.2],
      [slap(rng, 5200 * p, 2, 0.012, 0.06), 0.35],
      [drive(thump(300 * p, 110, 0.025, 0.045, 0.2), 1.6), 0.75],
    ),
  );
}

/** Medium hit (tilts, strong aerials): a "whap" with a pitched body. */
function hitMedium(rng: Rng, v: number): Float32Array {
  const p = [1, 1.1, 0.92][v] ?? 1;
  const crunch = mul(drive(filter(noise(0.3, rng), 'lowpass', 1800), 3), decay(0.3, 0.045, 0.001));
  return finish(
    layer(
      0.42,
      [click(rng, 0.01, 2200), 1],
      [slap(rng, 1500 * p, 1, 0.05, 0.3), 1.1],
      [slap(rng, 3900 * p, 2.2, 0.02, 0.1), 0.4],
      [drive(thump(220 * p, 62, 0.035, 0.085, 0.42), 2), 1],
      [crunch, 0.35],
    ),
  );
}

/** Heavy hit (smash attacks): a "WHAM" with a metallic ring and a short room. */
function hitHeavy(rng: Rng, v: number): Float32Array {
  const p = [1, 1.08, 0.93][v] ?? 1;
  const crunch = mul(drive(filter(noise(0.4, rng), 'lowpass', 3200), 4), decay(0.4, 0.07, 0.001));
  const ring = partials(0.7, 760 * p, [
    [1, 0.5, 0.13],
    [1.47, 0.42, 0.1],
    [2.09, 0.3, 0.08],
    [2.76, 0.25, 0.06],
    [3.91, 0.16, 0.05],
  ]);
  const dry = layer(
    0.8,
    [click(rng, 0.012, 1800), 1.2],
    [slap(rng, 1200 * p, 0.8, 0.07, 0.4), 1],
    [drive(thump(170 * p, 44, 0.05, 0.17, 0.8), 2.4), 1.2],
    [crunch, 0.55],
    [ring, 0.32],
  );
  return finish(reverbMono(dry, { room: 0.45, damp: 0.6, wet: 0.22, tail: 0.5 }));
}

/** The hit that will KO: an enormous crack, a sub boom and a zooming swish, with a big room. */
function hitKo(rng: Rng): Float32Array {
  const crack = mul(drive(filter(noise(0.25, rng), 'highpass', 900), 5), decay(0.25, 0.035, 0.0005));
  const crunch = mul(drive(filter(noise(0.6, rng), 'lowpass', 2600), 5), decay(0.6, 0.12, 0.001));
  const shriek = partials(1.2, 1180, [
    [1, 0.5, 0.35],
    [1.34, 0.4, 0.3],
    [1.98, 0.35, 0.25],
    [2.61, 0.25, 0.2],
    [3.47, 0.18, 0.15],
  ]);
  const zoom = whoosh(
    rng,
    1.1,
    [
      [0, 3800],
      [1.1, 380],
    ],
    1.6,
    0.12,
    'white',
  );
  const dry = layer(
    1.6,
    [click(rng, 0.015, 1500), 1.4],
    [crack, 0.9],
    [drive(thump(140, 26, 0.12, 0.5, 1.6), 2.5), 1.4],
    [crunch, 0.7],
    [shriek, 0.3],
    [zoom, 0.45, 0.04],
  );
  return finish(reverbMono(dry, { room: 0.85, damp: 0.5, wet: 0.42, tail: 1.2, predelay: 0.02 }));
}

/** Layer for fire hitboxes: a fwoosh with crackle. */
function hitFire(rng: Rng): Float32Array {
  const body = whoosh(
    rng,
    0.5,
    [
      [0, 700],
      [0.15, 2600],
      [0.5, 1200],
    ],
    0.8,
    0.03,
    'white',
  );
  const crackle = scatter(rng, 0.5, 26, 0.42, 1500, 6000, [0.002, 0.006]);
  return finish(layer(0.5, [body, 1], [crackle, 0.6]));
}

/** Layer for electric hitboxes: a gated buzz. */
function hitElectric(rng: Rng): Float32Array {
  const len = 0.4;
  const buzz = layer(
    len,
    [osc(len, 92, 'saw'), 0.5],
    [osc(len, 184.5, 'square'), 0.3],
    [noise(len, rng), 0.25],
  );
  const gate = buffer(len);
  for (let i = 0, g = 1; i < gate.length; i++) {
    if (i % 900 === 0) g = rng.next() < 0.7 ? 1 : 0.2;
    gate[i] = g;
  }
  return finish(
    mul(mul(filter(buzz, 'bandpass', 1800, 0.6), filter(gate, 'lowpass', 400)), decay(len, 0.12, 0.002)),
  );
}

// ---------------------------------------------------------------- shield

function shieldHit(rng: Rng, v: number): Float32Array {
  const p = [1, 1.06][v] ?? 1;
  const glass = partials(0.35, 940 * p, [
    [1, 1, 0.06],
    [1.52, 0.6, 0.05],
    [2.31, 0.4, 0.035],
    [3.13, 0.25, 0.02],
  ]);
  return finish(
    layer(
      0.35,
      [glass, 0.6],
      [thump(320 * p, 150, 0.02, 0.05, 0.3), 0.8],
      [slap(rng, 2600, 2, 0.015, 0.08), 0.35],
    ),
  );
}

function shieldBreak(rng: Rng): Float32Array {
  const shatter = scatter(rng, 0.9, 60, 0.35, 2200, 8000, [0.015, 0.06]);
  const burst = mul(filter(noise(0.4, rng), 'highpass', 2500), decay(0.4, 0.07, 0.001));
  const whistle = mul(
    osc(1.3, (t) => 620 * 2 ** (t * 1.35) * (1 + 0.015 * Math.sin(2 * Math.PI * 7 * t)), 'triangle'),
    env(1.3, [
      [0, 0],
      [0.12, 1],
      [0.9, 0.6],
      [1.3, 0],
    ]),
  );
  const dry = layer(
    1.6,
    [click(rng, 0.01, 2000), 1],
    [shatter, 0.7],
    [burst, 0.8],
    [drive(thump(130, 40, 0.06, 0.22, 1), 2), 1.1],
    [whistle, 0.22, 0.08],
  );
  return finish(reverbMono(dry, { room: 0.7, wet: 0.3, tail: 0.8 }));
}

function shieldOn(rng: Rng): Float32Array {
  const hum = mul(
    osc(0.18, (t) => 180 + 90 * t),
    env(0.18, [
      [0, 0],
      [0.02, 1],
      [0.18, 0],
    ]),
  );
  return finish(layer(0.18, [hum, 0.7], [slap(rng, 1300, 1.5, 0.03, 0.15, 'pink'), 0.6]));
}

/** Seamless 1.2 s loop of cartoon birds and stars for the dizzy state. */
function dizzy(rng: Rng): Float32Array {
  const len = 1.2;
  const out = buffer(len);
  const chirp = (f: number) =>
    mul(
      osc(0.07, (t) => f * (1.3 - 3.5 * t)),
      env(0.07, [
        [0, 0],
        [0.006, 1],
        [0.07, 0],
      ]),
    );
  for (const [t, f] of [
    [0.02, 3600],
    [0.13, 3900],
    [0.62, 3400],
    [0.73, 3700],
  ] as const)
    add(out, chirp(f), t, 0.8);
  add(out, scatter(rng, 0.4, 6, 0.25, 2500, 5200, [0.03, 0.05]), 0.32, 0.25);
  add(out, scatter(rng, 0.4, 6, 0.25, 2500, 5200, [0.03, 0.05]), 0.92, 0.25);
  return normalize(out, 0.8);
}

// ---------------------------------------------------------------- launches and KOs

function launch(rng: Rng, v: number): Float32Array {
  const strong = v === 1;
  const len = strong ? 1.1 : 0.7;
  const air = whoosh(
    rng,
    len,
    [
      [0, 450],
      [len * 0.25, strong ? 2600 : 2100],
      [len, 650],
    ],
    1.3,
    len * 0.18,
  );
  const rumble = mul(
    filter(noise(len, rng, 'brown'), 'lowpass', 300),
    env(
      len,
      [
        [0, 0],
        [0.08, 1],
        [len, 0],
      ],
      2,
    ),
  );
  const streak = strong
    ? mul(
        osc(len, (t) => 2400 - 1400 * (t / len)),
        env(
          len,
          [
            [0, 0],
            [0.1, 1],
            [len, 0],
          ],
          2,
        ),
      )
    : buffer(len);
  return finish(layer(len, [air, 1], [rumble, strong ? 0.6 : 0.3], [streak, 0.06]));
}

/** The blast-zone explosion. */
function koBlast(rng: Rng): Float32Array {
  const len = 2.4;
  const blast = mul(
    drive(
      filter(noise(len, rng, 'white'), 'lowpass', (t) => 300 + 4200 * Math.exp(-t / 0.25)),
      3,
    ),
    decay(len, 0.45, 0.003),
  );
  const sizzle = mul(
    mul(
      filter(noise(len, rng), 'highpass', 4500),
      osc(len, 23, 'triangle').map((s) => 0.6 + 0.4 * s),
    ),
    env(
      len,
      [
        [0, 0],
        [0.05, 1],
        [1.4, 0],
      ],
      2,
    ),
  );
  const dry = layer(
    len,
    [click(rng, 0.015, 1200), 1.2],
    [blast, 1],
    [drive(thump(90, 24, 0.15, 0.7, len), 2.2), 1.3],
    [sizzle, 0.35],
  );
  return finish(reverbMono(dry, { room: 0.9, damp: 0.4, wet: 0.45, tail: 1.4, predelay: 0.03 }));
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
  const blip = mul(
    osc(0.08, (t) => 330 * p + 2600 * t, 'triangle'),
    decay(0.08, 0.02, 0.002),
  );
  return finish(layer(0.16, [air, 1], [blip, 0.12]));
}

function doubleJump(rng: Rng): Float32Array {
  const air = whoosh(
    rng,
    0.26,
    [
      [0, 900],
      [0.14, 3400],
      [0.26, 2200],
    ],
    2.4,
    0.05,
  );
  const tone = mul(
    osc(0.2, (t) => 480 + 2400 * t, 'triangle'),
    env(
      0.2,
      [
        [0, 0],
        [0.02, 1],
        [0.2, 0],
      ],
      2,
    ),
  );
  return finish(layer(0.26, [air, 1], [tone, 0.16]));
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
    0.02,
    'white',
  );
  const grit = mul(
    slap(rng, 3200, 2.5, 0.06, 0.3),
    osc(0.3, 37, 'square').map((s) => 0.65 + 0.35 * s),
  );
  return finish(layer(0.3, [sweep, 1], [grit, 0.35], [thump(160, 80, 0.02, 0.03, 0.15), 0.4]));
}

function skid(rng: Rng): Float32Array {
  const len = 0.38;
  const scrape = mul(
    filter(noise(len, rng), 'bandpass', (t) => 2900 - 1500 * t, 3),
    env(
      len,
      [
        [0, 0],
        [0.02, 1],
        [len, 0],
      ],
      1.5,
    ),
  );
  const rough = mul(filter(noise(len, rng), 'lowpass', 60), 4).map(
    (s) => 0.5 + Math.max(-0.5, Math.min(0.5, s)),
  );
  return finish(mul(scrape, rough));
}

function step(rng: Rng, v: number): Float32Array {
  const p = [1, 1.15, 0.9][v] ?? 1;
  return finish(
    layer(
      0.09,
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

function dodge(rng: Rng): Float32Array {
  const air = whoosh(
    rng,
    0.3,
    [
      [0, 1500],
      [0.09, 4200],
      [0.3, 2000],
    ],
    1.8,
    0.05,
    'white',
  );
  const sparkle = partials(0.3, 3100, [
    [1, 0.6, 0.08],
    [1.5, 0.4, 0.06],
    [2.01, 0.25, 0.05],
  ]);
  return finish(layer(0.3, [air, 1], [sparkle, 0.14, 0.03]));
}

function roll(rng: Rng): Float32Array {
  const air = whoosh(
    rng,
    0.36,
    [
      [0, 800],
      [0.14, 1900],
      [0.36, 900],
    ],
    1.4,
    0.08,
  );
  return finish(layer(0.36, [air, 1], [land(rng, 1), 0.35, 0.24]));
}

/** The rising shimmer while a smash attack charges (60 frames = 1 s at most). */
function smashCharge(rng: Rng): Float32Array {
  const len = 1.05;
  const rise = (t: number) => 820 * 2 ** (t * 1.25);
  const tone = layer(
    len,
    [osc(len, (t) => rise(t)), 0.5],
    [osc(len, (t) => rise(t) * 1.007), 0.4],
    [osc(len, (t) => rise(t) * 2.003, 'triangle'), 0.18],
  );
  const trem = osc(len, (t) => 14 + 10 * t).map((s) => 0.62 + 0.38 * s);
  const sparkle = mul(
    filter(noise(len, rng), 'highpass', 6000),
    env(len, [
      [0, 0.2],
      [len, 1],
    ]),
  );
  return normalize(
    mul(
      layer(len, [mul(tone, trem), 1], [sparkle, 0.12]),
      env(len, [
        [0, 0],
        [0.06, 0.6],
        [len, 1],
      ]),
    ),
    0.85,
  );
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
    partials(1.4, f, [
      [1, 0.7, 0.5],
      [2, 0.25, 0.3],
      [3.01, 0.12, 0.2],
    ]);
  const dry = layer(
    1.4,
    [bell(midiHz(84)), 0.5],
    [bell(midiHz(88)), 0.4, 0.06],
    [bell(midiHz(91)), 0.4, 0.12],
    [bell(midiHz(96)), 0.25, 0.18],
    [scatter(rng, 1, 14, 0.6, 3500, 7000, [0.04, 0.09]), 0.15, 0.05],
  );
  return finish(reverbMono(dry, { room: 0.8, wet: 0.4, tail: 0.6 }), 0.8);
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

function menuError(): Float32Array {
  const len = 0.22;
  const buzz = layer(len, [osc(len, 146, 'square'), 0.5], [osc(len, 155, 'saw'), 0.5]);
  return finish(
    mul(
      filter(buzz, 'lowpass', 1600),
      env(len, [
        [0, 0],
        [0.005, 1],
        [0.17, 0.8],
        [len, 0],
      ]),
    ),
    0.7,
  );
}

function menuToggle(rng: Rng): Float32Array {
  return finish(layer(0.05, [click(rng, 0.004, 1800), 1], [thump(1400, 900, 0.005, 0.008, 0.05), 0.5]), 0.7);
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
    [filter(stab, 'lowpass', 4200), 1, 0.55],
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
