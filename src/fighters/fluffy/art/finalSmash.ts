import type { BonePose, Key } from '../../../render/rig/types';
import type { AnimClip } from '../../../render/rig/types';
import { FUZZ_FRENZY } from '../finalSmash';
import {
  BRISTLE,
  FIERCE,
  HALF,
  HAPPY,
  PUFF,
  RUN_FUR,
  SAD,
  SHOCK,
  at,
  ball,
  centreOf,
  key,
  type Aim,
  type Ball,
  type Pt,
} from './poses';

/**
 * Fuzz Frenzy, the Final Smash (src/fighters/fluffy/finalSmash.ts), on Jungle Rush's frames. The activation: Fluffy
 * swells in a halo of glowing fur through the 27-frame hold, coils the grabber behind him and lashes it 39 units out
 * along the lash's boxes on 29-34; a whiff goes slack and reels in, and he sags. The cinematic: the grabber coils
 * twice round the catch (held 10 units in front, the engine's hold), he rams it with 18 fuzzy bumps, grinds into it
 * with 13 spins of the fur, then unwinds the line, hooks the spiked ball under it and swings it up through the catch
 * on 139, the release, and bounces happily while it reels back in. The caught foe draws its own `grabbed` clip.
 * Rig points are y down; FRONT is where the coil sits, on a 15-unit foe's middle.
 */

const STAND: Ball = {};

/** The line's height in the lash: the boxes' centres, 10 up (rig y -10). */
const LASH_Y = -10;
/** The coil's centre: the hold's 10 units in front, about a standing foe's middle. */
const FRONT: Pt = [10, -7];
/** Where the line meets the coil: its near loop's edge. */
const COIL_NEAR: Pt = [FRONT[0] - 5.1, FRONT[1] - 2.5];

/** The grabber from the front of the ball `b` to `to`. */
const lineFrom = (b: Ball, to: Pt, near = 0, lift = 0.6): Aim => {
  const [cx, cy] = centreOf(b);
  return { from: [cx + 1.2, cy - lift], to, near };
};

/** The grabber coiled short at the ball's centre, pointing `dir` degrees (0 forward, -90 up), `len` long. */
const coil = (b: Ball, dir: number, len: number): Aim => {
  const [cx, cy] = centreOf(b);
  const r = (dir * Math.PI) / 180;
  return { from: [cx, cy], to: [cx + Math.cos(r) * len, cy + Math.sin(r) * len], near: dir };
};

/**
 * The power-up halo round the ball `b`, scaled `s` (fx3, the fxBack slot): raised and flattened so its lower spikes
 * stop at the floor.
 */
const halo = (b: Ball, s: number): BonePose => {
  const [cx, cy] = centreOf(b);
  return { x: cx, y: cy - 2.4 * s, sx: s, sy: 0.8 * s };
};

/** A pose with extras: the grabber, the halo, the coil (fx1) and a flash (fx2). */
function pose(
  b: Ball,
  o: { grab?: Aim; halo?: number; coil?: BonePose; flash?: BonePose; fx?: BonePose } = {},
) {
  return ball({
    ...b,
    ...(o.grab && { grab: o.grab }),
    ...(o.halo !== undefined && { fx3: halo(b, o.halo) }),
    ...(o.fx && { fx3: o.fx }),
    ...(o.coil && { fx1: o.coil }),
    ...(o.flash && { fx2: o.flash }),
  });
}

/** The coil round the catch, loose (`s` > 1) as it lands and snug at 1. */
const wrapAt = (s = 1): BonePose => ({ x: FRONT[0], y: FRONT[1], sx: s, sy: 1 + (s - 1) * 1.6 });

/* Swap sets. A key's swaps replace the last key's whole set (slots it leaves out fall back to the clip's swaps). */
const POWER = { ...SHOCK, ...PUFF, fxBack: 'aura' };
const POWER_BRISTLE = { ...FIERCE, ...BRISTLE, fxBack: 'aura' };
const COILED = { ...FIERCE, ...BRISTLE, fxBack: 'aura', grabLine: 'line', tip: 'tipSpin' };
const LASH = { ...FIERCE, ...RUN_FUR, grabLine: 'line', tip: 'tip' };
const SLACK = { ...SHOCK, grabLine: 'lineWaveBig', tip: 'tip' };
const REEL = { ...SAD, grabLine: 'line', tip: 'tip' };
const SAG = { ...SAD, sweat: 'sweat' };

const HOLD = { ...FIERCE, ...PUFF, grabLine: 'line', prop: 'wrap' };
const flashOn = (i: number) => ({ burst: `burst${i % 3}` });
const ROLL = { ...FIERCE, fur: 'furRoll', grabLine: 'line', prop: 'wrap', fx: 'dust' };
const HOOK = { ...FIERCE, ...PUFF, grabLine: 'line', tip: 'tipSpin' };
const SWING = {
  mouth: 'mouthO',
  lids: 'lidsAngry',
  ...BRISTLE,
  grabLine: 'line',
  tip: 'tip',
  burst: 'burst2',
};
const FOLLOW = { ...HAPPY, grabLine: 'lineWave', tip: 'tip' };
const CHEER = { ...HAPPY, grabLine: 'line', tip: 'tip' };

/** The activation: the hold, the lash on 29-34, and a whiff's recovery to frame 99 (FAF 100). */
function lash(): AnimClip {
  const [from, to] = FUZZ_FRENZY.lash;
  const puffed = (i: number): Ball =>
    i % 2
      ? { sx: 1.04, sy: 0.97, puff: 1.16, look: [0.45, -0.15] }
      : { sx: 1.14, sy: 0.88, puff: 1.1, look: [0.45, 0.05], face: { y: 0.25 } };
  const wind: Ball = { x: -1, sx: 0.9, sy: 1.1, tilt: -14, look: [0.5, -0.1] };
  const back: Ball = { x: -1.4, sx: 0.85, sy: 1.15, tilt: -18, look: [0.55, -0.15] };
  const strike: Ball = { x: 1.8, sx: 1.16, sy: 0.88, tilt: 12, face: { x: 0.6 }, look: [0.6, 0] };
  const out = (b: Ball, reach: number): Aim => ({
    from: [centreOf(b)[0] - 1.2, LASH_Y],
    to: [reach, LASH_Y],
  });
  const keys: Key[] = [
    key(0, ball(STAND), { ease: 'out', swaps: SHOCK }),
    key(3, pose({ sx: 0.9, sy: 1.12, puff: 1.08, look: [0.3, -0.3] }, { halo: 0.45 }), {
      ease: 'out',
      swaps: POWER,
    }),
  ];
  // Swelling through the hold: the fur bristles and the halo pulses.
  for (let f = 8, i = 0; f <= 20; f += 4, i++)
    keys.push(
      key(f, pose(puffed(i), { halo: 0.9 + (i % 2) * 0.18 + i * 0.03 }), {
        ease: 'inOut',
        swaps: i ? undefined : POWER_BRISTLE,
      }),
    );
  keys.push(
    key(24, pose(wind, { halo: 0.75, grab: coil(wind, -160, 5) }), { ease: 'inOut', swaps: COILED }),
    key(from - 2, pose(back, { halo: 0.35, grab: coil(back, -172, 6.5) }), { ease: 'in' }),
    key(from - 1, pose({ ...strike, x: 1 }, { grab: out({ ...strike, x: 1 }, 20) }), {
      ease: 'linear',
      swaps: LASH,
    }),
    key(from, pose(strike, { grab: out(strike, 39) }), { ease: 'linear' }),
    key(to, pose({ ...strike, x: 1.6 }, { grab: out({ ...strike, x: 1.6 }, 40) }), { ease: 'out' }),
    // A whiff: the line goes slack, falls and is reeled back in.
    key(
      to + 4,
      pose({ x: 1, sx: 1.04, sy: 0.97, look: [0.5, 0.2] }, { grab: lineFrom({ x: 1 }, [31, -5]) }),
      {
        ease: 'inOut',
        swaps: SLACK,
      },
    ),
    key(to + 12, pose({ x: 0.4, sx: 1.02, sy: 0.98 }, { grab: lineFrom({ x: 0.4 }, [13, -3], 10) }), {
      ease: 'inOut',
      swaps: REEL,
    }),
    key(to + 18, pose({ sx: 1.04, sy: 0.97 }, { grab: coil(STAND, 10, 2.5) }), { ease: 'out' }),
    key(to + 19, undefined, { swaps: SAG }),
    key(to + 30, ball({ sx: 1.1, sy: 0.92, tilt: -4, look: [0.1, 0.4], puff: 0.96 }), { ease: 'inOut' }),
    key(84, ball({ sx: 1.06, sy: 0.95, look: [0.2, 0.3] }), {
      ease: 'inOut',
      swaps: { ...HALF, mouth: null },
    }),
    key(94, undefined, { swaps: { lids: null, mouth: null } }),
    key(FUZZ_FRENZY.whiffFaf - 1, ball(STAND)),
  );
  return { length: FUZZ_FRENZY.whiffFaf - 1, active: [FUZZ_FRENZY.lash], swaps: FIERCE, keys };
}

/** The cinematic: catch, 18 bumps, 13 grinding spins, the Spiked Ball on 139 (the release), and a happy bounce. */
function frenzy(): AnimClip {
  const { bumps, rolls, every, release } = FUZZ_FRENZY;
  const keys: Key[] = [];
  const holding = (b: Ball, coilAt = wrapAt(), flash?: BonePose) =>
    pose(b, { grab: lineFrom(b, COIL_NEAR), coil: coilAt, flash });

  // The catch: yanked in on the line, the coil snaps tight round the foe, and the catch's hit flashes on it.
  const yank: Ball = { x: -1.2, sx: 0.86, sy: 1.14, tilt: -16, puff: 1.1, look: [0.5, -0.05] };
  keys.push(
    key(0, holding({ ...yank, x: -0.6 }, wrapAt(1.3)), { ease: 'out', swaps: { ...HOLD, ...SHOCK } }),
    key(1, holding(yank, wrapAt(1.06), at(FRONT[0], FRONT[1], 1.35, 12)), {
      ease: 'out',
      swaps: { ...HOLD, ...flashOn(0) },
    }),
    key(3, holding({ x: -0.3, sx: 1.04, sy: 0.97 }), { ease: 'inOut', swaps: HOLD }),
    key(bumps.from - 1, holding({ x: -0.8, sx: 0.93, sy: 1.07, tilt: -6 }), { ease: 'in' }),
  );

  // The bumps: rammed home on each hit frame (the hitlag holds it there), bounced back off two frames later.
  for (let i = 0; i < bumps.count; i++) {
    const f = bumps.from + every * i;
    const high = (i % 3) - 1;
    const hit: Ball = {
      x: 2.5,
      y: high === 1 ? -0.9 : 0,
      sx: 0.84,
      sy: 1.12,
      tilt: 10 + high * 3,
      puff: 1.1,
      look: [0.55, -0.1],
    };
    keys.push(
      key(f, holding(hit, wrapAt(1.03), at(7.3, -6.5 + high * 1.6, 0.55 + 0.1 * (i % 2), i * 23)), {
        ease: 'out',
        swaps: { ...HOLD, ...flashOn(i) },
      }),
      key(f + 2, holding({ x: -0.7, sx: 1.08, sy: 0.94, tilt: -6, puff: 1.04 }), { ease: 'in', swaps: HOLD }),
    );
  }

  // The rolls: backs off a step, then grinds into the foe with the fur spinning, a flash on each hit.
  keys.push(
    key(rolls.from - 2, holding({ x: -1.2, sx: 0.9, sy: 1.1, tilt: -8, spin: -40 }), {
      ease: 'in',
      swaps: { ...ROLL, fx: null },
    }),
  );
  const spin = (i: number) => 150 * (i + 1);
  for (let i = 0; i < rolls.count; i++) {
    const f = rolls.from + every * i;
    const grind: Ball = { x: 2 + (i % 2) * 0.3, sx: 1.05, sy: 0.96, tilt: 4, spin: spin(i), look: [0.5, 0] };
    keys.push(
      key(
        f,
        pose(grind, {
          grab: lineFrom(grind, COIL_NEAR),
          coil: wrapAt(),
          flash: at(7, -3.5 - (i % 3) * 1.6, 0.45 + 0.1 * (i % 2), i * 41),
          fx: at(-4.5, 0, 0.7 + 0.15 * (i % 2)),
        }),
        { ease: 'linear', swaps: { ...ROLL, ...flashOn(i + 1) } },
      ),
      key(
        f + 2,
        pose(
          { ...grind, x: 1.8, spin: spin(i) + 75 },
          { grab: lineFrom(grind, COIL_NEAR), coil: wrapAt(), fx: at(-4.2, 0, 0.6) },
        ),
        { ease: 'linear', swaps: ROLL },
      ),
    );
  }

  // The Spiked Ball: the coil unwinds, the ball hooks under the foe, and swings up through it on the release.
  // Six whole turns: the fur ends the grind upright again.
  const last = 2160;
  const squat: Ball = { x: -1.5, sx: 1.2, sy: 0.82, tilt: -6, spin: last, look: [0.5, 0.2] };
  const deep: Ball = { x: -1.7, sx: 1.25, sy: 0.78, tilt: -4, spin: last, look: [0.5, 0.25] };
  const rise: Ball = { x: -0.5, sx: 0.96, sy: 1.06, tilt: 6, spin: last, look: [0.5, -0.2] };
  const swing: Ball = {
    x: 0.6,
    y: -1.8,
    sx: 0.84,
    sy: 1.2,
    tilt: 10,
    spin: last,
    puff: 1.12,
    look: [0.4, -0.6],
  };
  const over: Ball = { x: 0.4, y: -2.4, sx: 0.86, sy: 1.16, tilt: 4, spin: last, look: [0.2, -0.6] };
  keys.push(
    key(132, pose(squat, { grab: lineFrom(squat, [7.5, -1.2], 0, -1.5) }), { ease: 'inOut', swaps: HOOK }),
    key(136, pose(deep, { grab: lineFrom(deep, [10, -0.9], 0, -1.5) }), { ease: 'in' }),
    key(release - 1, pose(rise, { grab: lineFrom(rise, [13, -3.5], -10) }), { ease: 'linear' }),
    key(release, pose(swing, { grab: lineFrom(swing, [12, -16], -60), flash: at(10.5, -9, 1.5, 8) }), {
      ease: 'out',
      swaps: SWING,
    }),
    key(release + 2, pose(over, { grab: lineFrom(over, [7, -23], -80) }), {
      ease: 'inOut',
      swaps: { ...SWING, burst: null },
    }),
    key(
      release + 8,
      pose(
        { y: -1.2, sx: 0.94, sy: 1.08, spin: last, look: [0.2, -0.5] },
        { grab: lineFrom({ y: -1.2 }, [-3, -21], -110) },
      ),
      {
        ease: 'in',
        swaps: FOLLOW,
      },
    ),
  );

  // Lands and bounces happily while the line comes home.
  const bounce: [number, Ball][] = [
    [150, { sx: 1.16, sy: 0.85, spin: last }],
    [158, { y: -1.6, sx: 0.94, sy: 1.08, spin: last }],
    [166, { sx: 1.1, sy: 0.9, spin: last }],
    [174, { y: -1, sx: 0.97, sy: 1.04, spin: last }],
    [182, { sx: 1.06, sy: 0.95, spin: last }],
  ];
  bounce.forEach(([f, b], i) =>
    keys.push(
      key(f, pose(b, { grab: coil(b, -100 + i * 16, 5 - i * 0.6) }), {
        ease: b.y ? 'in' : 'out',
        swaps: i ? undefined : CHEER,
      }),
    ),
  );
  keys.push(
    key(194, pose({ spin: last }, { grab: coil(STAND, -20, 1.5) }), { ease: 'out', swaps: { ...HAPPY } }),
    key(196, undefined, { swaps: { ...HALF, mouth: null } }),
    key(204, undefined, { swaps: { lids: null, mouth: null } }),
    key(FUZZ_FRENZY.cinematicFaf - 1, ball({ spin: last })),
  );
  return { length: FUZZ_FRENZY.cinematicFaf - 1, active: [[release, release]], swaps: FIERCE, keys };
}

export const FINAL_SMASH: Record<string, AnimClip> = {
  /** Fuzz Frenzy's activation: hold 2-28, lash 29-34, a whiff's recovery to 99 (FAF 100). */
  finalSmash: lash(),
  /** Fuzz Frenzy's cinematic: the catch on 1, bumps 6-74, rolls 79-127, the Spiked Ball on 139 (FAF 210). */
  finalSmashCinematic: frenzy(),
};
