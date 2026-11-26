import type { AnimClip, Key } from '../../../render/rig/types';
import { FULL_THROTTLE } from '../finalSmash';
import { BODY, EXHAUST, HORN, WHEEL_X } from './parts';
import {
  AIR,
  ANGRY,
  BACK,
  BLUR,
  CLOSED,
  FOCUS,
  FRONT,
  PARK,
  REAR,
  SHOUT,
  SURPRISED,
  at,
  bob,
  fxOn,
  holdEffects,
  key,
  mix,
  roll,
  smoke,
  spin,
  squash,
  tilt,
  type Pose,
} from './poses';

/**
 * Full Throttle, the Final Smash (src/fighters/wheely/finalSmash.ts, Blue Falcon's timeline). Three clips:
 *
 * - `finalSmash` / `finalSmashAir`: through the activation freeze he revs with the brake on, the way Rev Up revs (the
 *   shell shaking harder, smoke and flame from the pipe, the flash as the revs top out). On frame 26 he pops the
 *   clutch, and on 27-30 he crosses the Blue Falcon's boxes, stretched long behind a turbo jet and speed lines with a
 *   bow wave of air shoved ahead of his bumper over the boxes. Caught nobody: he stamps on the brakes, skids, and
 *   honks twice in annoyance (Captain Falcon "swings his fist in annoyance") before he settles.
 * - `finalSmashCinematic`, from the catch, with the caught fighter held just off his front bumper: the crash, then
 *   he reverses ten units for a run-up, revs, floors it and rams them (FULL_THROTTLE.ram), rears back and lets go a
 *   blast on the horn that is the final launch (FULL_THROTTLE.launch).
 */

const LAST = FULL_THROTTLE.hit[1];
const RAM = FULL_THROTTLE.ram.frame;
const LAUNCH = FULL_THROTTLE.launch.frame;
/** The clutch pops on this frame; the bow wave is out from the next, a frame before the first box. */
const POP = FULL_THROTTLE.hit[0] - 2;
/** The run-up in the cinematic: how far back he reverses (rig units). */
const RUN_UP = -10;
/** The caught fighter's near side, from his feet: half his length plus the hold gap (sim/actions/grab.ts hold). */
const CONTACT: [number, number] = [10.4, -5.6];

/** The turbo jet (fxBack) out of the pipe, `s` times its drawn length. */
const jet = (pose: Pose, s: number) => fxOn(pose, 'fx4', EXHAUST, s);
/** The bow wave (fx2) standing on the ground at the front bumper. */
const wave = (pose: Pose, s: number) => fxOn(pose, 'fx2', [9.3, -0.5], s);
/** Speed lines (fx3) streaming off the tail. */
const lines = (pose: Pose, s: number) => fxOn(pose, 'fx3', [-8.9, 0], s);
/** A backfire flame (`fx`, fxFlame) out of the pipe. */
const backfire = (pose: Pose, s: number, fx = 'fx1') => fxOn(pose, fx, EXHAUST, s);
/** Horn waves (`fx`, fxHonk) opening forward from the horn. */
const horn = (pose: Pose, s: number, fx = 'fx2') => fxOn(pose, fx, [HORN[0] + 0.5, HORN[1]], s);

/**
 * The rev at level `t` (0 to 1) on `base`: the shell shakes on its springs every other key (`side`), harder as the
 * revs build, with smoke over the pipe and two puffs drifting back off it (fx2, fx3), a flame licking out (fx1) from
 * `flameFrom` and the flash (prop) behind him past `flashFrom`.
 */
function rev(base: Pose, t: number, side: number, age: number): Pose {
  const shake = 0.06 + 0.18 * t;
  let pose = mix(base, {
    shell: { y: (base.shell?.y ?? 0) + side * shake, rot: side * (0.3 + 1.2 * t) },
  });
  pose = smoke(pose, 0.5 + 0.9 * t);
  for (const [fx, lag] of [
    ['fx2', 0],
    ['fx3', 5],
  ] as const) {
    const u = ((age + lag) % 10) / 9;
    const grow = 0.7 + 0.9 * t;
    pose = fxOn(
      pose,
      fx,
      [EXHAUST[0] - 0.6 - 4 * u * grow, EXHAUST[1] - 0.2 - 2.4 * u * grow],
      (0.35 + 0.7 * u) * grow,
    );
  }
  pose = backfire(pose, 0.4 + 0.9 * t);
  const s = 0.5 + 0.8 * t;
  return fxOn(pose, 'prop', [0, -7], s, 9 * t, 0.75 * s);
}

/** The puff drawings for a rev key: each stream's puff grows, then breaks up. */
function revSwaps(t: number, age: number, flame: boolean, flash: boolean): Record<string, string | null> {
  const puffAt = (lag: number) => {
    const u = (age + lag) % 10;
    return u < 3 ? 'fxPuff1' : u < 7 ? 'fxPuff2' : 'fxPuff3';
  };
  return {
    ...(t < 0.3 ? FOCUS : t < 0.7 ? ANGRY : SHOUT),
    fxBack: 'fxSmoke',
    fx2: puffAt(0),
    fx3: puffAt(5),
    fx1: flame ? 'fxFlame' : null,
    prop: flash ? 'fxFlash' : null,
  };
}

function activation(air: boolean): AnimClip {
  const length = FULL_THROTTLE.faf - 1;
  const settle = air ? AIR : PARK;
  /** Grounded poses pivot on a tyre; in the air he turns about his middle. */
  const nose = (rot: number, dx = 0, dy = 0): Pose =>
    air ? mix(AIR, tilt(rot, BODY, dx, dy)) : tilt(rot, rot < 0 ? REAR : FRONT, dx, dy);
  /** Settled back on the rear springs with the brake on. */
  const braced = mix(nose(-2.5, -0.3), squash(0.96), air ? {} : bob(0.35));
  const keys: Key[] = [
    key(0, settle, { ease: 'out', swaps: FOCUS }),
    key(3, mix(nose(1, 0.2), squash(0.94), air ? {} : bob(0.4)), { ease: 'inOut', swaps: FOCUS }),
  ];
  // Revving through the freeze, a key every other frame.
  const revFrom = 5;
  for (let f = revFrom; f < POP; f += 2) {
    const t = (f - revFrom) / (POP - 1 - revFrom);
    const pose = rev(mix(braced, air ? spin(f * 30) : {}), t, Math.floor(f / 2) % 2 ? 1 : -1, f - revFrom);
    keys.push(key(f, pose, { ease: 'linear', swaps: revSwaps(t, f - revFrom, t >= 0.4, f >= POP - 6) }));
  }
  /** The dash: stretched long and level, the turbo jet behind, the bow wave ahead and speed lines off the tail. */
  const dash = (rot: number, dx: number, deg: number, s: number) =>
    lines(wave(jet(mix(nose(rot, dx), squash(0.96, 1.1), spin(deg)), 1.5 * s), 0.95 + 0.1 * s), 1.1 * s);
  const dashSwaps = {
    ...SHOUT,
    ...BLUR,
    fxBack: 'fxTurbo',
    fx1: null,
    fx2: 'fxBoom',
    fx3: 'fxSpeed',
    prop: null,
  };
  /** Stamping on the brakes: the nose dips, the tail light glows and the tyres lay rubber (on the ground). */
  const brake = (rot: number, dx: number, s: number): Pose =>
    smoke(
      mix(
        nose(rot, dx),
        air ? {} : bob(0.3),
        spin(1900 - (rot > 3 ? 60 : 0)),
        air ? { fx1: at(-WHEEL_X - 1.6, -1.2, 0.8 * s) } : { fx1: at(WHEEL_X, 0, s) },
        { fx2: at(WHEEL_X + 1, -0.8, 0.5 * s) },
      ),
      0.6 * s,
    );
  /** A honk in annoyance: up on the rear springs, waves from the horn. */
  const annoyed = (rot: number, s: number, hop: number) =>
    horn(mix(nose(rot, 0, -hop), squash(1 + hop * 0.04, 1 - hop * 0.03)), s, 'fx3');
  keys.push(
    key(POP, backfire(jet(mix(nose(-7, -0.6), squash(0.94), air ? {} : bob(0.4), spin(200)), 0.9), 1.6), {
      ease: 'linear',
      swaps: { ...SHOUT, ...BLUR, fxBack: 'fxTurbo', fx1: 'fxFlame', fx2: null, fx3: null, prop: null },
    }),
    key(POP + 1, dash(1.5, 1.2, 500, 1), { ease: 'linear', swaps: dashSwaps }),
    key(POP + 2, dash(1, 1.6, 900, 1.1), { ease: 'linear' }),
    key(POP + 3, dash(1.5, 1.8, 1300, 1.15), { ease: 'linear' }),
    key(LAST, dash(1.2, 1.8, 1700, 1.2), { ease: 'linear' }),
    key(LAST + 1, brake(6, 0.8, 1.1), {
      ease: 'out',
      swaps: {
        ...SURPRISED,
        brake: 'brakeGlow',
        fxBack: 'fxSmoke',
        fx1: air ? 'fxPuff2' : 'fxSkid',
        fx2: 'fxPuff2',
        fx3: null,
      },
    }),
    key(38, brake(3.5, 0.4, 1.6), { ease: 'inOut', swaps: { ...ANGRY, fx2: 'fxPuff3' } }),
    key(44, mix(nose(-2.5, 0.1), air ? {} : bob(0.1), spin(1840)), {
      ease: 'inOut',
      swaps: { ...ANGRY, brake: null, fxBack: null, fx1: null, fx2: null },
    }),
    key(48, annoyed(-9, 0.7, 0.4), { ease: 'outBack', swaps: { ...SHOUT, fx3: 'fxHonk' } }),
    key(53, annoyed(-4, 1.15, 0), { ease: 'inOut' }),
    key(55, undefined, { swaps: { ...ANGRY, fx3: null } }),
    key(58, annoyed(-10, 0.7, 0.5), { ease: 'outBack', swaps: { ...SHOUT, fx3: 'fxHonk' } }),
    key(63, annoyed(-4, 1.2, 0), { ease: 'inOut' }),
    key(66, mix(nose(1.5), squash(0.95), air ? {} : bob(0.25)), { ease: 'inOut', swaps: ANGRY }),
    key(76, mix(nose(-1), air ? {} : bob(0.05)), { ease: 'inOut', swaps: FOCUS }),
    key(length, settle),
  );
  return holdEffects({ length, active: [FULL_THROTTLE.hit], swaps: FOCUS, keys });
}

function cinematic(): AnimClip {
  const length = FULL_THROTTLE.cinematicFaf - 1;
  /** A crash star (fx1) at the contact point, `s` across. */
  const crash = (pose: Pose, s: number, rot = 0) => mix(pose, { fx1: at(CONTACT[0], CONTACT[1], s, rot) });
  /** Parked `dx` along, nose at `rot`. */
  const at0 = (rot: number, dx: number, extra: Pose = {}) =>
    mix(tilt(rot, rot < 0 ? REAR : FRONT, dx), extra);
  const burn = (f: number, t: number) =>
    rev(
      mix(at0(-3.5, RUN_UP - 0.3), squash(0.95), bob(0.4), spin(400 + f * 90)),
      t,
      Math.floor(f / 2) % 2 ? 1 : -1,
      f,
    );
  const BURN_FROM = 34;
  const BURN_TO = 56;
  const keys: Key[] = [
    key(0, smoke(crash(mix(at0(-5, -0.8), squash(1.02, 0.92), bob(0.3)), 2.2), 0.8), {
      ease: 'out',
      swaps: { ...SURPRISED, fx1: 'fxCrash', fxBack: 'fxSmoke' },
    }),
    key(3, smoke(crash(mix(at0(-3, -0.6), squash(0.97, 1.03)), 3.1, 10), 0.6), { ease: 'out' }),
    key(7, smoke(crash(mix(at0(-1, -0.3)), 2.4, 16), 0.4), { ease: 'in' }),
    key(9, mix(at0(1, 0), bob(0.15)), { ease: 'inOut', swaps: { ...ANGRY, fx1: null, fxBack: null } }),
    // Reverse for a run-up, looking back over his tail.
    key(13, mix(at0(-1.5, -0.8), spin(-roll(0.8))), { ease: 'in', swaps: BACK }),
    key(27, smoke(mix(at0(-1, RUN_UP + 0.3), spin(-roll(10))), 0.5), {
      ease: 'out',
      swaps: { ...BACK, fxBack: 'fxSmoke' },
    }),
    key(31, smoke(mix(at0(2, RUN_UP), bob(0.25), spin(-roll(10))), 0.4), { ease: 'inOut', swaps: ANGRY }),
  ];
  // The burnout: the tyres spin on the spot and the revs climb.
  for (let f = BURN_FROM; f <= BURN_TO; f += 2) {
    const t = (f - BURN_FROM) / (BURN_TO - BURN_FROM);
    keys.push(
      key(f, burn(f, t), {
        ease: 'linear',
        swaps: { ...revSwaps(t, f, t >= 0.35, f >= BURN_TO - 5), ...BLUR },
      }),
    );
  }
  /** Flooring it: stretched long, the turbo jet behind, speed lines off the tail. */
  const floor = (rot: number, dx: number, deg: number, s: number) =>
    lines(jet(mix(at0(rot, dx), squash(0.96, 1.08), spin(deg)), 1.4 * s), s);
  const flooring = { ...SHOUT, ...BLUR, fxBack: 'fxTurbo', fx1: null, fx2: null, fx3: 'fxSpeed', prop: null };
  keys.push(
    key(58, backfire(jet(mix(at0(-7, RUN_UP - 0.4), squash(0.94), bob(0.4), spin(2600)), 0.9), 1.7), {
      ease: 'linear',
      swaps: { ...SHOUT, ...BLUR, fxBack: 'fxTurbo', fx1: 'fxFlame', fx2: null, fx3: null, prop: null },
    }),
    key(60, floor(-1, RUN_UP + 0.6, 2800, 0.8), { ease: 'in', swaps: flooring }),
    key(RAM - 1, floor(1.5, 0.4, 3400, 1.2), { ease: 'linear' }),
    // The ram: crumpled against them, a crash star on the bumper.
    key(RAM, crash(mix(at0(3, 0.9), squash(1.05, 0.94), bob(0.2), spin(3450)), 2.6), {
      ease: 'out',
      swaps: { ...SHOUT, fx1: 'fxCrash', fxBack: 'fxSmoke', fx3: null },
    }),
    key(RAM + 3, smoke(crash(mix(at0(-2, -0.5), squash(0.97, 1.03), spin(3420)), 3.4, 12), 0.7), {
      ease: 'out',
    }),
    key(RAM + 7, smoke(crash(mix(at0(-1, -0.9), spin(3400)), 2.6, 20), 0.5), { ease: 'inOut' }),
    key(RAM + 10, mix(at0(1, -0.2), bob(0.15), spin(3420)), {
      ease: 'inOut',
      swaps: { ...ANGRY, fx1: null, fxBack: null },
    }),
    // Draws a breath, rears up on the rear springs, and lets go on the horn: the final launch.
    key(88, mix(at0(-4, -0.4), squash(0.94), bob(0.35), spin(3420)), { ease: 'inOut', swaps: CLOSED }),
    key(98, mix(at0(-10, -0.7), squash(0.96), spin(3420)), { ease: 'inOut' }),
    key(LAUNCH - 2, mix(at0(-15, -0.8), squash(0.95, 1.02), spin(3420)), { ease: 'in' }),
    key(
      LAUNCH,
      horn(mix(at0(4, 0.8), squash(1.03, 0.98), spin(3420), { fx1: at(CONTACT[0] + 4, CONTACT[1], 3) }), 1.2),
      { ease: 'out', swaps: { ...SHOUT, fx1: 'fxHonkBlast', fx2: 'fxHonk' } },
    ),
    key(LAUNCH + 4, horn(mix(at0(3, 0.7), spin(3420), { fx1: at(CONTACT[0] + 5, CONTACT[1], 5.6) }), 1.5), {
      ease: 'inOut',
    }),
    key(LAUNCH + 10, horn(mix(at0(1.5, 0.4), spin(3420), { fx1: at(CONTACT[0] + 6, CONTACT[1], 7) }), 1.7), {
      ease: 'inOut',
    }),
    key(LAUNCH + 16, mix(at0(-7, 0), squash(0.97), spin(3420)), {
      ease: 'outBack',
      swaps: { ...FOCUS, fx1: null, fx2: null },
    }),
    key(LAUNCH + 22, mix(at0(0.5, 0), bob(0.2), spin(3420)), { ease: 'inOut' }),
    key(length, spin(3420)),
  );
  return holdEffects({ length, active: [[LAUNCH, LAUNCH]], swaps: ANGRY, keys });
}

export const fullThrottle: Record<string, AnimClip> = {
  finalSmash: activation(false),
  finalSmashAir: activation(true),
  finalSmashCinematic: cinematic(),
};
