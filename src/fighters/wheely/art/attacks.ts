import type { AnimClip, Key } from '../../../render/rig/types';
import { BODY, EXHAUST, WHEEL_X } from './parts';
import {
  AIR,
  ANGRY,
  BACK,
  BLUR,
  CLOSED,
  DEG,
  FOCUS,
  FRONT,
  IDLE_FACE,
  OPEN_DOOR,
  OPEN_HOOD,
  PARK,
  REAR,
  SCOOP,
  SHOUT,
  SQUAT,
  UP,
  UPSIDE_DOWN,
  at,
  bob,
  flip,
  frontView,
  fxOn,
  key,
  mix,
  roll,
  smoke,
  smooth,
  spin,
  squash,
  tilt,
  trail,
  type Pose,
} from './poses';

/**
 * Wheely's attacks, timed to src/fighters/wheely/moves.ts in Smash numbering (frame 1 is the move's first frame,
 * length = FAF - 1). Every hitbox centre is covered by the car or an effect during its active frames
 * (index.test.ts checks this against moves.ts).
 */

/** Gravel flung back off the rear tyre (fx1), mirrored to fly behind him. */
const spray = (s: number, dx = 0): Pose => ({ fx1: at(-WHEEL_X - 0.3 - dx, 0, -s, 0, s) });

/** The door swung on its hinge: 1 shut, 0 edge-on, below 0 open past square with its inside showing. */
const door = (sx: number, sy = 1): Pose => ({ door: { sx, sy } });

/** A horn beep (`jab`, `jab2`): lean into the horn and a ring of sound bursts over the hitbox. */
function beep(length: number, x: number, r: number, lean: Pose): AnimClip {
  return {
    length,
    swaps: IDLE_FACE,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(2, mix(lean, bob(0.12), { fx1: at(x, -5.5, r * 0.5) }), {
        ease: 'out',
        swaps: { ...SHOUT, fx1: 'fxBeep' },
      }),
      key(4, mix(lean, bob(0.06), { fx1: at(x, -5.5, r * 1.05) }), { ease: 'out' }),
      key(6, mix(lean, { fx1: at(x + 0.4, -5.5, r * 1.25) }), { ease: 'inOut', swaps: SHOUT }),
      key(10, PARK, { ease: 'inOut', swaps: {} }),
      key(length, PARK),
    ],
  };
}

/** Grabs: the door swings open past square and scoops forward `reach` (door scale) by `at`, held to `hold`. */
function scoop(
  length: number,
  from: number,
  reach: number,
  hold: number,
  lunge: number,
  start: Pose = PARK,
): Key[] {
  return [
    key(0, start, { ease: 'out' }),
    key(from - 5, mix(bob(0.1), door(0.45)), { ease: 'in', swaps: { ...FOCUS, ...OPEN_DOOR } }),
    key(from - 3, mix(bob(0.15), door(0.08)), { ease: 'step' }),
    key(from - 2, mix(bob(0.15), door(-0.2, 1.02), tilt(1, FRONT, lunge * 0.5)), {
      ease: 'out',
      swaps: { ...ANGRY, ...SCOOP },
    }),
    key(from - 1, mix(bob(0.2), door(reach, 1.05), tilt(2, FRONT, lunge)), { ease: 'linear' }),
    key(hold, mix(bob(0.2), door(reach, 1.05), tilt(2, FRONT, lunge)), { ease: 'inOut' }),
    key(hold + 8, mix(bob(0.1), door(-0.25)), { ease: 'in' }),
    key(hold + 11, mix(bob(0.1), door(-0.05)), { ease: 'step' }),
    key(hold + 12, mix(bob(0.05), door(0.2)), { ease: 'out', swaps: { ...FOCUS, ...OPEN_DOOR } }),
    key(hold + 17, PARK, { swaps: {} }),
    key(length, PARK),
  ];
}

/** The ramp: dropped with its foot this far in front of his frame-3 origin, scaled up to the engine's climb. */
const RAMP_FOOT = 2.25;
const RAMP_RISE = 1.5;
const RAMP_LEN = 7.45;
const RAMP_SLOPE = (3.3 * RAMP_RISE) / RAMP_LEN;

/** Up special keys to the launch: world-space ramp and tyres, drawn relative to the origin the engine moves. */
function rampJump(): Key[] {
  const backUp = 2.5;
  const keys: Key[] = [];
  for (let f = 0; f <= 3; f++) {
    const back = -backUp * smooth(f / 3);
    const drop = [-6, -2.4, 0.3, 0][f]!;
    keys.push(
      key(
        f,
        mix(tilt(0, REAR, back), f === 3 ? SQUAT : PARK, spin(roll(back)), {
          prop: at(RAMP_FOOT, drop, 1, 0, RAMP_RISE),
        }),
        {
          ease: 'linear',
          ...(f === 0
            ? { swaps: { ...FOCUS, prop: 'fxRamp' } }
            : f === 3
              ? { swaps: { ...ANGRY, prop: 'fxRamp' } }
              : {}),
        },
      ),
    );
  }
  for (let f = 4; f <= 9; f++) {
    const k = f - 3;
    const [ox, oy] = [0.89 * k, -0.6 * k];
    const u = (7.9 * k) / 6;
    const front = WHEEL_X - backUp + u;
    const h = Math.min(RAMP_SLOPE * RAMP_LEN, Math.max(0, front - RAMP_FOOT) * RAMP_SLOPE);
    const theta = Math.asin(h / (2 * WHEEL_X)) / DEG;
    const rear = front - 2 * WHEEL_X * Math.cos(theta * DEG);
    keys.push(
      key(
        f,
        mix(tilt(-theta, REAR, rear + WHEEL_X - ox, -oy), bob(0.15), spin(roll(u - backUp)), {
          prop: at(RAMP_FOOT - ox, -oy, 1, 0, RAMP_RISE),
        }),
        {
          ease: 'linear',
          ...(f === 4 ? { swaps: { ...ANGRY, ...BLUR, prop: 'fxRamp' } } : {}),
        },
      ),
    );
  }
  keys.push(
    key(
      11,
      mix(AIR, tilt(-30, BODY), spin(roll(12)), { prop: at(RAMP_FOOT - 9.31, 11.28, 1, 0, RAMP_RISE) }),
      {
        ease: 'out',
        swaps: { ...SHOUT, ...BLUR, prop: 'fxRamp' },
      },
    ),
  );
  return keys;
}

/** Holding someone in the open door (the grabHold pose). */
const HOLD = mix(bob(0.15), tilt(1.5, FRONT), door(-1.05, 1.04));

export const attacks: Record<string, AnimClip> = {
  /** Beep. */
  jab: beep(17, 11, 3.5, tilt(2, FRONT)),
  /** Beep, a little bigger. */
  jab2: beep(19, 11.5, 4, mix(tilt(-3.5, REAR, -0.3), bob(-0.14))),
  /** HONK: rears back, then a long blast whose big wave blows them away. */
  jab3: {
    length: 31,
    swaps: IDLE_FACE,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(2, mix(tilt(-3, REAR, -0.4), squash(0.94)), { ease: 'in', swaps: CLOSED }),
      key(
        3,
        mix(tilt(3, FRONT, 0.6), squash(1.03, 0.98), { fx1: at(12, -5.5, 2.4), fx2: at(9.6, -3.6, 0.8) }),
        {
          ease: 'out',
          swaps: { ...SHOUT, fx1: 'fxHonkBlast', fx2: 'fxHonk' },
        },
      ),
      key(6, mix(tilt(2.5, FRONT, 0.7), { fx1: at(12.3, -5.5, 5.2), fx2: at(9.8, -3.6, 1.2) }), {
        ease: 'inOut',
      }),
      key(9, mix(tilt(1, FRONT, 0.4), { fx1: at(12.8, -5.5, 6), fx2: at(10, -3.6, 1.4) }), {
        ease: 'inOut',
        swaps: SHOUT,
      }),
      key(16, PARK, { swaps: {} }),
      key(31, PARK),
    ],
  },
  /** Bumper Bump: rocks back on the springs, then lurches forward bumper first. */
  ftilt: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(4, mix(tilt(-4, REAR, -0.7), squash(0.94), bob(0.3)), { ease: 'in' }),
      key(6, mix(tilt(3, FRONT, 3.1), squash(0.98, 1.05), spin(roll(3)), { fx3: at(-6.2, 0, 0.6) }), {
        ease: 'linear',
        swaps: { ...SHOUT, ...BLUR, fx3: 'fxSpeed' },
      }),
      key(9, mix(tilt(2.5, FRONT, 3.3), squash(0.99, 1.04), spin(roll(3.5)), { fx3: at(-5.6, 0, 0.5) }), {
        ease: 'out',
      }),
      key(12, undefined, { swaps: ANGRY }),
      key(16, mix(tilt(-1, REAR, 1.2), spin(roll(3.5))), { ease: 'inOut' }),
      key(29, spin(roll(3.5))),
    ],
  },
  /** Wheelie: hops up on the back wheels and the front bumper swings up through them. */
  utilt: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(3, mix(SQUAT, tilt(2, FRONT)), { ease: 'in' }),
      key(5, mix(tilt(-36, REAR, 1.1, -1.3), bob(-0.1, 0.4), { fx1: trail(-3.2, -1.3, 15.2, 54, false) }), {
        ease: 'out',
        swaps: { ...SHOUT, fx1: 'fxSwipe' },
      }),
      key(7, mix(tilt(-40, REAR, 1.2, -1.5), bob(-0.1, 0.4), { fx1: trail(-3.1, -1.5, 15.2, 56, false) }), {
        ease: 'out',
      }),
      key(10, mix(tilt(-41, REAR, 1.2, -1.5), bob(-0.1, 0.4), { fx1: trail(-3.1, -1.5, 15.2, 58, false) }), {
        ease: 'inOut',
      }),
      key(11, undefined, { swaps: ANGRY }),
      key(16, mix(tilt(-14, REAR, 0.6, -0.2), bob(0, 0.2)), { ease: 'in' }),
      key(19, mix(SQUAT, tilt(1, FRONT, 0.3)), { ease: 'out', swaps: FOCUS }),
      key(29, PARK),
    ],
  },
  /** Gravel Spray: the front tyre spins backwards and throws gravel low along the ground. */
  dtilt: {
    length: 21,
    swaps: { ...ANGRY, wheelF: 'wheelBlur' },
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(2, mix(tilt(2.5, FRONT), bob(0.25), spin(0, -200), { fx1: at(5.5, 0, 0.6) }), {
        ease: 'out',
        swaps: { fx1: 'fxGravel' },
      }),
      key(4, mix(tilt(3, FRONT), bob(0.3), spin(0, -500), { fx1: at(5.5, 0, 2.35) }), { ease: 'out' }),
      key(7, mix(tilt(3, FRONT), bob(0.3), spin(0, -900), { fx1: at(5.6, 0, 2.6) }), { ease: 'out' }),
      key(9, mix(tilt(2, FRONT), bob(0.2), spin(0, -1080), { fx1: at(5.8, 0.1, 2.8, 0, 2.4) }), {
        swaps: {},
      }),
      key(21, spin(0, -1080)),
    ],
  },
  /** Handbrake Drift: out of a run he yanks the handbrake and skids half broadside into them. */
  dashAttack: {
    length: 41,
    swaps: { ...ANGRY, ...BLUR },
    keys: [
      key(0, smoke(mix(tilt(-3, REAR), spin(0)), 0.6), { ease: 'out', swaps: { fxBack: 'fxSmoke' } }),
      key(5, smoke(mix(tilt(3, FRONT, 0.8), bob(0.2), spin(roll(4))), 0.8), { ease: 'out' }),
      key(
        7,
        mix(tilt(4, FRONT, 1.1), bob(0.25), spin(roll(5)), {
          body: { sx: 0.84 },
          fx1: at(3, 0, 1.2),
          fx2: at(9.6, -1.1, 1),
          fx4: at(-8.5, -1.6, 1.1),
        }),
        {
          ease: 'linear',
          swaps: { ...SHOUT, brake: 'brakeGlow', fx1: 'fxSkid', fxBack: 'fxSmoke', fx2: 'fxPuff3' },
        },
      ),
      key(
        12,
        mix(tilt(3.5, FRONT, 1.3), bob(0.2), spin(roll(5)), {
          body: { sx: 0.82 },
          fx1: at(3, 0, 1.6),
          fx2: at(10.2, -1.6, 1.25),
          fx4: at(-9, -1.8, 1.3),
        }),
        {
          ease: 'linear',
        },
      ),
      key(13, undefined, { swaps: { ...ANGRY, brake: 'brakeGlow', fx1: 'fxSkid', fxBack: 'fxSmoke' } }),
      key(
        22,
        mix(tilt(2, FRONT, 0.8), bob(0.1), spin(roll(5)), {
          body: { sx: 0.9 },
          fx1: at(3, 0, 1.8),
          fx4: at(-9.6, -2.4, 1.2),
        }),
        {
          ease: 'inOut',
        },
      ),
      key(26, undefined, { swaps: { brake: null } }),
      key(30, mix(tilt(-1.5, REAR, 0.2), spin(roll(5))), { ease: 'inOut' }),
      key(41, spin(roll(5))),
    ],
  },
  /** Rev Ram: revs on the spot (the charge holds on frame 10), then rams forward bumper first. */
  fsmash: {
    length: 51,
    swaps: { ...ANGRY, ...BLUR },
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(3, smoke(mix(tilt(-4, REAR, -0.8), bob(0.3), squash(0.94), spin(300), spray(0.7)), 0.7), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...BLUR, fx1: 'fxGravel', fxBack: 'fxSmoke' },
      }),
      key(
        6,
        smoke(
          mix(
            tilt(-4.5, REAR, -0.9),
            bob(0.4),
            squash(0.93),
            spin(650),
            { car: { x: 0.16 }, hood: { rot: -1.5 } },
            spray(1),
          ),
          0.9,
        ),
        { ease: 'out' },
      ),
      key(
        8,
        smoke(
          mix(
            tilt(-4, REAR, -0.85),
            bob(0.32),
            squash(0.94),
            spin(900),
            { car: { x: -0.16 }, hood: { rot: 1.4 } },
            spray(0.9),
          ),
          0.8,
        ),
        { ease: 'out' },
      ),
      key(
        10,
        smoke(
          mix(
            tilt(-5, REAR, -0.95),
            bob(0.46),
            squash(0.92),
            spin(1150),
            { car: { x: 0.12 }, hood: { rot: -1 } },
            spray(1.2),
          ),
          1,
        ),
        { ease: 'in' },
      ),
      key(12, mix(tilt(-2, REAR, 1.4), squash(1.02, 0.99), spin(1400), { fx3: at(-7, 0, 0.8) }), {
        ease: 'linear',
        swaps: { ...SHOUT, ...BLUR, fx3: 'fxSpeed' },
      }),
      key(15, mix(tilt(2, FRONT, 4.3), squash(0.97, 1.06), spin(1700), { fx3: at(-4.4, 0, 1) }), {
        ease: 'linear',
      }),
      key(18, mix(tilt(2.5, FRONT, 4.4), squash(0.97, 1.06), spin(1850), { fx3: at(-4.2, 0, 0.9) }), {
        ease: 'out',
      }),
      key(21, undefined, { swaps: ANGRY }),
      key(28, mix(tilt(-1.5, REAR, 1.8), spin(1950)), { ease: 'inOut' }),
      key(40, mix(bob(0.1), spin(1980)), { ease: 'inOut', swaps: FOCUS }),
      key(51, spin(1980)),
    ],
  },
  /** Hood Pop: squats on the springs (the charge holds on frame 6), then the hood springs up in a burst of steam. */
  usmash: {
    length: 47,
    swaps: ANGRY,
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(4, SQUAT, { ease: 'inOut' }),
      key(6, mix(SQUAT, bob(0.62)), { ease: 'in' }),
      key(8, mix(bob(0.2), { hood: { rot: -8 } }), { ease: 'inOut', swaps: { ...ANGRY, ...OPEN_HOOD } }),
      key(10, mix(bob(0.1), { hood: { rot: -16, y: -0.3 }, fx2: at(6.4, -7.4, 0.7) }), {
        ease: 'out',
        swaps: { ...SHOUT, ...OPEN_HOOD, fx2: 'fxPuff1' },
      }),
      key(
        11,
        mix(squash(1.04, 0.98), {
          hood: { x: -1.2, y: -7.6, rot: -24 },
          fx1: at(3.1, -13.6, 1.5),
          fx2: at(6.8, -8.9, 1.3),
          fx3: at(5.6, -6.4, 1.3, 0, 6.9),
        }),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...OPEN_HOOD, fx1: 'fxPuff2', fx2: 'fxPuff3', fx3: 'fxSpring' },
        },
      ),
      key(
        15,
        mix(squash(1.03, 0.99), {
          hood: { x: -1.3, y: -7.9, rot: -27 },
          fx1: at(3, -14, 1.7),
          fx2: at(6.8, -9.2, 1.5),
          fx3: at(5.6, -6.4, 1.3, 0, 7.2),
        }),
        {
          ease: 'in',
        },
      ),
      key(17, undefined, { swaps: { ...ANGRY, ...OPEN_HOOD, fx3: 'fxSpring' } }),
      key(22, mix(bob(0.1), { hood: { x: -0.4, y: -3, rot: -200 }, fx3: at(5.6, -6.4, 1.2, 0, 2.6) }), {
        ease: 'in',
      }),
      key(26, mix(SQUAT, { hood: { rot: -360 } }), { ease: 'out', swaps: { ...CLOSED, ...OPEN_HOOD } }),
      key(27, undefined, { swaps: CLOSED }),
      key(34, PARK, { swaps: FOCUS }),
      key(47, PARK),
    ],
  },
  /** Donut: revs (the charge holds on frame 4), then spins out on the spot: the nose sweeps out front, then the tail. */
  dsmash: {
    length: 49,
    swaps: { ...ANGRY, ...BLUR },
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(2, smoke(mix(SQUAT, spin(200)), 0.7), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...BLUR, fxBack: 'fxSmoke' },
      }),
      key(4, smoke(mix(SQUAT, bob(0.62), spin(400)), 0.9), { ease: 'in' }),
      key(7, smoke(mix(tilt(-2, REAR), spin(700)), 1), { ease: 'out' }),
      key(
        10,
        mix(tilt(2, FRONT, 1.2), bob(0.2), spin(1000), {
          fx1: at(2, 0, 1),
          fx2: at(10, -2.6, 1.2),
          fx4: at(-9, -1.6, 1.2),
        }),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...BLUR, fx2: 'fxPuff3', fxBack: 'fxSmoke', fx1: 'fxSkid' },
        },
      ),
      key(
        12,
        mix(tilt(2, FRONT, 1.3), bob(0.2), spin(1200), {
          car: { sy: 0.97 },
          fx1: at(2, 0, 1.4),
          fx2: at(10.2, -2.8, 1.4),
          fx4: at(-6, -1.6, 1.2),
        }),
        {
          ease: 'linear',
        },
      ),
      key(
        13,
        mix(bob(0.25), spin(1300), {
          fx1: at(0, 0, 1.5),
          fx2: at(10.4, -3, 1.55),
          fx4: at(-1, -1.8, 1.4),
        }),
        { ease: 'step', swaps: frontView('frontEyesShout') },
      ),
      key(
        14,
        mix(bob(0.25), spin(1400), {
          car: { sy: 0.95 },
          fx1: at(-2, 0, -1.4, 0, 1),
          fx3: at(-10, -2.6, 1.3),
          fx4: at(4, -1.8, 1.4),
        }),
        {
          ease: 'linear',
          swaps: { ...SHOUT, ...BLUR, fx1: 'fxSkid', fx3: 'fxPuff3', fxBack: 'fxSmoke' },
        },
      ),
      key(
        16,
        mix(bob(0.2), spin(1600), {
          fx1: at(-2, 0, -1.6, 0, 1),
          fx3: at(-10.3, -2.8, 1.5),
          fx4: at(8, -1.8, 1.3),
        }),
        {
          ease: 'inOut',
        },
      ),
      key(18, undefined, { swaps: { ...ANGRY, ...BLUR, fx1: 'fxSkid' } }),
      key(22, mix(bob(0.15), spin(1800), { fx1: at(0, 0, 1.5) }), {
        ease: 'step',
      }),
      key(23, mix(bob(0.15), spin(1850), { fx1: at(0, 0, 1.5) }), {
        ease: 'out',
      }),
      key(28, mix(bob(0.1), spin(1950)), { ease: 'inOut', swaps: { ...FOCUS } }),
      key(49, spin(1980)),
    ],
  },
  /** Getup attack: rolls back off his roof onto his wheels and bumps out front, then behind. */
  getupAttack: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, UPSIDE_DOWN, { ease: 'in' }),
      key(4, mix(UPSIDE_DOWN, tilt(172, BODY, -0.4, -0.3), spin(90)), { ease: 'in' }),
      key(8, mix(flip(250), spin(360)), { ease: 'linear', swaps: SHOUT }),
      key(11, mix(flip(320), spin(540)), { ease: 'linear' }),
      key(13, mix(flip(360), SQUAT, spin(640)), { ease: 'out', swaps: ANGRY }),
      key(16, mix(tilt(362, FRONT, 1.3), spin(700), { fx1: at(10.2, -2.8, 1.25) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'fxPuff3' },
      }),
      key(18, mix(tilt(362, FRONT, 1.4), spin(720), { fx1: at(10.6, -3, 1.4) }), { ease: 'inOut' }),
      key(20, mix(tilt(360, BODY, 0.2), spin(720)), { ease: 'inOut', swaps: ANGRY }),
      key(24, mix(tilt(358, REAR, -1.4), spin(640), { fx2: at(-10.2, -2.8, 1.25) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx2: 'fxPuff3' },
      }),
      key(26, mix(tilt(358, REAR, -1.5), spin(620), { fx2: at(-10.6, -3, 1.4) }), { ease: 'inOut' }),
      key(28, mix(tilt(360, BODY), spin(620)), { ease: 'inOut', swaps: ANGRY }),
      key(36, mix(tilt(360, BODY), spin(620)), { swaps: FOCUS }),
      key(45, mix(tilt(360, BODY), spin(620))),
    ],
  },
  /** Barrel Roll: a full roll backwards in mid-air with a smear following the bumper round. */
  nair: {
    length: 39,
    swaps: SHOUT,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(3, mix(AIR, tilt(-25, BODY)), { ease: 'linear', swaps: CLOSED }),
      ...[6, 9, 12, 15, 18, 21].map((f, i) => {
        const rot = -25 - 55 * (i + 1);
        return key(f, mix(AIR, tilt(rot, BODY), { fx1: trail(0, -5.2, 9.9, -12.8 - rot, false) }), {
          ease: 'linear',
          ...(i === 0 ? { swaps: { ...SHOUT, fx1: 'fxSwoosh' } } : {}),
        });
      }),
      key(23, mix(AIR, tilt(-360, BODY)), { ease: 'out', swaps: SHOUT }),
      key(30, mix(AIR, tilt(-360, BODY)), { swaps: IDLE_FACE }),
      key(39, mix(AIR, tilt(-360, BODY))),
    ],
  },
  /** Front Flip: pitches forward and slams the nose down in front of him. */
  fair: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(5, mix(AIR, tilt(-14, BODY, -0.4)), { ease: 'in' }),
      key(9, mix(AIR, tilt(32, BODY, 2.6, -0.7), { fx1: trail(2.6, -5.9, 9.7, -12.8 - 32) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'fxSwoosh' },
      }),
      key(13, mix(AIR, tilt(52, BODY, 3, -0.7), { fx1: trail(3, -5.9, 9.8, -12.8 - 52) }), { ease: 'out' }),
      key(15, undefined, { swaps: ANGRY }),
      key(22, mix(AIR, tilt(160, BODY, 1.2)), { ease: 'linear' }),
      key(28, mix(AIR, tilt(290, BODY, 0.4)), { ease: 'out' }),
      key(34, mix(AIR, tilt(360, BODY))),
      key(43, mix(AIR, tilt(360, BODY))),
    ],
  },
  /** Backfire: the tail kicks up and the exhaust bangs out a burst of flame behind him. */
  bair: {
    length: 35,
    swaps: BACK,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(5, mix(AIR, tilt(-8, BODY)), { ease: 'in' }),
      key(8, fxOn(mix(AIR, tilt(12, BODY)), 'fx1', EXHAUST, 1.7), {
        ease: 'out',
        swaps: { ...SHOUT, fx1: 'fxFlame' },
      }),
      key(11, fxOn(mix(AIR, tilt(13, BODY)), 'fx1', EXHAUST, 1.8), { ease: 'inOut' }),
      key(15, fxOn(mix(AIR, tilt(10, BODY)), 'fx1', EXHAUST, 1.3), { ease: 'in' }),
      key(16, smoke(mix(AIR, tilt(9, BODY)), 0.9), { ease: 'out', swaps: { ...BACK, fxBack: 'fxSmoke' } }),
      key(24, mix(AIR, tilt(2, BODY)), { swaps: IDLE_FACE }),
      key(35, AIR),
    ],
  },
  /** Roof Flip: flips wheels-up and runs the spinning tyres over whoever is above. */
  uair: {
    length: 34,
    swaps: SHOUT,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(3, mix(AIR, tilt(-50, BODY, 0, -0.6)), { ease: 'linear' }),
      key(
        6,
        mix(bob(-0.1, 1), tilt(-150, BODY, 0, -1.6), spin(-400), { fx1: trail(0, -8, 6.6, 150, false) }),
        {
          ease: 'out',
          swaps: { ...SHOUT, ...BLUR, fx1: 'fxSwoosh' },
        },
      ),
      key(
        9,
        mix(bob(-0.1, 1.1), tilt(-180, BODY, 0, -2.2), spin(-800), { fx1: trail(0, -8, 6.6, 160, false) }),
        { ease: 'inOut' },
      ),
      key(
        11,
        mix(bob(-0.1, 1.1), tilt(-190, BODY, 0, -2.2), spin(-1000), { fx1: trail(0, -8, 6.6, 165, false) }),
        { ease: 'in' },
      ),
      key(14, undefined, { swaps: { ...SHOUT, ...BLUR } }),
      key(18, mix(AIR, tilt(-300, BODY, 0, -1), spin(-1300)), { ease: 'out', swaps: IDLE_FACE }),
      key(24, mix(AIR, tilt(-360, BODY), spin(-1440))),
      key(34, mix(AIR, tilt(-360, BODY), spin(-1440))),
    ],
  },
  /** Wheel Stomp: tucks the wheels up, then stamps them down; a shock of dust under the tyres meteors. */
  dair: {
    length: 49,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(6, mix(bob(-0.3, -0.3), tilt(-4, BODY)), { ease: 'inOut' }),
      key(10, mix(bob(-0.45, -0.45), squash(1.05, 0.96)), { ease: 'in', swaps: FOCUS }),
      key(
        12,
        mix(bob(0.3, 1.7), squash(0.94, 1.04), { fx2: at(0, 1.1, 1.35), fx3: at(-5.6, -3.2, 0.9, 90) }),
        {
          ease: 'out',
          swaps: { ...SHOUT, fx2: 'fxPuff2', fx3: 'fxSpeed' },
        },
      ),
      key(
        16,
        mix(bob(0.2, 1.8), squash(0.96, 1.03), { fx2: at(0, 0.9, 1.6), fx3: at(-5.6, -3.6, 0.9, 90) }),
        { ease: 'linear' },
      ),
      key(17, mix(bob(0.15, 1.6), { fx2: at(0, 0.4, 1.7) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx2: 'fxPuff3' },
      }),
      key(24, mix(bob(0.05, 1.2), { fx2: at(0, 0.2, 2) }), { ease: 'inOut' }),
      key(26, undefined, { swaps: ANGRY }),
      key(36, AIR, { swaps: FOCUS }),
      key(49, AIR),
    ],
  },
  /** Door Scoop. */
  grab: { length: 39, swaps: FOCUS, keys: scoop(39, 9, -1.28, 10, 0.4) },
  /** Running Door Scoop: skids in with the door already swinging. */
  dashGrab: {
    length: 45,
    swaps: FOCUS,
    keys: scoop(45, 11, -1.4, 12, 0.9, mix(tilt(4, FRONT, 0.6), bob(0.2))),
  },
  /** Pivot grab: turns round out of the run (the engine faces him back on frame 1) and scoops. */
  pivotGrab: {
    length: 41,
    swaps: FOCUS,
    keys: scoop(41, 12, -1.55, 13, 0.6, { body: { sx: -1 } }),
  },
  /** Door Slam. */
  pummel: {
    length: 7,
    swaps: { ...ANGRY, ...SCOOP },
    keys: [
      key(0, HOLD, { ease: 'out' }),
      key(2, mix(bob(0.3), tilt(2, FRONT), door(-0.55, 1.02)), {
        ease: 'out',
        swaps: { ...SHOUT, ...SCOOP },
      }),
      key(7, HOLD),
    ],
  },
  /** Eject: winds the door in, then flings it open and fires them out forward. */
  fthrow: {
    length: 31,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'out', swaps: { ...ANGRY, ...SCOOP } }),
      key(10, mix(bob(0.36), tilt(-4, REAR, -0.65), door(-0.62, 1.02)), { ease: 'in' }),
      key(13, mix(SQUAT, tilt(-5, REAR, -0.6), door(-0.82, 1.04)), { ease: 'in' }),
      key(
        14,
        mix(bob(0.05), tilt(7, FRONT, 0.84), squash(0.98, 1.035), door(-1.66, 1.04), {
          door: { rot: -8 },
          fx2: at(10.6, -4.8, 1.06, -20),
        }),
        { ease: 'out', swaps: { ...SHOUT, ...SCOOP, fx2: 'fxThrow' } },
      ),
      key(
        16,
        mix(tilt(2, FRONT, 0.36), door(-1.36, 1.01), { door: { rot: 3 }, fx2: at(12.7, -5.7, 0.82, -23) }),
        {
          ease: 'out',
        },
      ),
      key(17, undefined, { swaps: { ...FOCUS, ...SCOOP } }),
      key(20, mix(bob(0.14), door(-1.03, 1.04)), { ease: 'inOut' }),
      key(25, mix(door(-0.05)), { ease: 'step' }),
      key(26, mix(door(0.25)), { ease: 'out', swaps: { ...FOCUS, ...OPEN_DOOR } }),
      key(30, PARK, { swaps: FOCUS }),
      key(31, PARK),
    ],
  },
  /** Reverse Bump: slams the door, throws it in reverse and rams them out of the back. */
  bthrow: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'in', swaps: { ...ANGRY, ...SCOOP } }),
      key(5, mix(door(-0.05)), { ease: 'step' }),
      key(6, mix(bob(0.2), door(0.3)), { ease: 'out', swaps: { ...BACK, ...OPEN_DOOR } }),
      key(10, mix(bob(0.15)), { ease: 'inOut', swaps: { ...BACK, ...BLUR } }),
      key(16, mix(tilt(3, FRONT, 0.4), bob(0.2), spin(-200)), { ease: 'in' }),
      key(21, mix(tilt(-7, REAR, -2.35), squash(0.93, 1.06), spin(-600), { fx2: at(-11.1, -2.8, 0.6) }), {
        ease: 'in',
        swaps: { ...SHOUT, ...BLUR, fx2: 'fxPuff2', brake: 'brakeGlow' },
      }),
      key(
        22,
        mix(tilt(-8, REAR, -3.1), squash(0.91, 1.09), spin(-660), {
          fx2: at(-11.9, -3, 0.73),
          fx3: at(-11.8, -4.3, -1.04, 0, 1.07),
        }),
        { ease: 'out', swaps: { ...SHOUT, ...BLUR, fx2: 'fxPuff2', fx3: 'fxThrow', brake: 'brakeGlow' } },
      ),
      key(
        23,
        mix(tilt(-8, REAR, -2.9), squash(0.93, 1.05), spin(-680), {
          fx2: at(-12, -2.8, 0.88),
          fx3: at(-12.5, -4.55, -0.82, 0, 0.83),
        }),
        { ease: 'out' },
      ),
      key(24, mix(tilt(-2, REAR, -2.2), spin(-700), { fx2: at(-10.8, -3, 1.3) }), {
        ease: 'inOut',
        swaps: { ...BACK, fx2: 'fxPuff3', brake: 'brakeGlow' },
      }),
      key(28, undefined, { swaps: BACK }),
      key(32, mix(bob(0.1), tilt(1, FRONT, -0.6), spin(-740)), { ease: 'inOut', swaps: FOCUS }),
      key(43, spin(-740)),
    ],
  },
  /** Wheelie Flip: pops a wheelie and flips them off the hood, straight up. */
  uthrow: {
    length: 41,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'in', swaps: { ...ANGRY, ...SCOOP } }),
      key(5, mix(door(-0.05)), { ease: 'step' }),
      key(6, mix(bob(0.2), door(0.3)), { ease: 'out', swaps: { ...ANGRY, ...OPEN_DOOR } }),
      key(12, mix(SQUAT, tilt(2, FRONT)), { ease: 'in', swaps: ANGRY }),
      key(18, mix(tilt(-20, REAR), spin(0, 200)), { ease: 'out', swaps: SHOUT }),
      key(20, mix(tilt(-38, REAR, -0.25), spin(0, 274), { fx2: at(4.6, -11.2, 1.1, -80) }), {
        ease: 'out',
        swaps: { ...UP, fx2: 'fxThrow' },
      }),
      key(22, mix(tilt(-32, REAR), spin(0, 320), { fx2: at(4.92, -12.45, 0.76, -82) }), { ease: 'inOut' }),
      key(23, undefined, { swaps: UP }),
      key(30, mix(SQUAT, spin(0, 360)), { ease: 'out' }),
      key(35, mix(bob(-0.05), spin(0, 360)), { ease: 'inOut', swaps: FOCUS }),
      key(41, spin(0, 360)),
    ],
  },
  /** Run Over: drops them, backs up and drives right over them, front wheels then back. */
  dthrow: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'in', swaps: { ...ANGRY, ...SCOOP } }),
      key(5, mix(door(-0.05)), { ease: 'step' }),
      key(6, mix(bob(0.2), door(0.3)), { ease: 'out', swaps: { ...ANGRY, ...OPEN_DOOR } }),
      key(12, mix(tilt(2, FRONT, -1.4), spin(-roll(1.4))), { ease: 'inOut', swaps: { ...ANGRY, ...BLUR } }),
      key(17, mix(tilt(-9, REAR, -0.2, -0.5), spin(roll(2))), { ease: 'out', swaps: { ...SHOUT, ...BLUR } }),
      key(21, mix(tilt(-1, REAR, 1.4, -0.9), spin(roll(5))), { ease: 'inOut' }),
      key(23, mix(tilt(11, FRONT, 2.37, -0.15), spin(roll(6.4))), { ease: 'in' }),
      key(
        24,
        mix(tilt(5, FRONT, 2.65), squash(0.75, 1.11), bob(0.54), spin(roll(7)), {
          fx1: at(-2.4, 0, 1.32),
          fx2: at(-0.72, -1.48, 1.43, 0, 0.56),
          fx3: at(6, -1.52, 1.37, 0, 0.52),
        }),
        { ease: 'out', swaps: { ...SHOUT, ...BLUR, fx1: 'fxSkid', fx2: 'fxPuff2', fx3: 'fxPuff2' } },
      ),
      key(
        26,
        mix(tilt(2, FRONT, 2.82), squash(0.86, 1.06), spin(roll(7.7)), {
          fx1: at(-2, 0, 1.42),
          fx2: at(-1.45, -1.59, 1.58, 0, 0.63),
          fx3: at(7.12, -1.65, 1.61, 0, 0.52),
        }),
        { ease: 'out' },
      ),
      key(28, mix(SQUAT, tilt(0, FRONT, 2.8), spin(roll(8)), { fx1: at(-2, 0, 1.5) }), {
        ease: 'out',
        swaps: { ...ANGRY, fx1: 'fxSkid' },
      }),
      key(34, mix(tilt(0, FRONT, 1), spin(roll(8))), { ease: 'inOut', swaps: FOCUS }),
      key(43, spin(roll(8))),
    ],
  },
  /** Charge Through: spins the tyres on the spot, then floors it through whoever is in the way. */
  sideB: {
    length: 51,
    swaps: { ...ANGRY, ...BLUR },
    keys: [
      key(0, PARK, { ease: 'out' }),
      key(4, smoke(mix(tilt(-3, REAR, -0.4), bob(0.35), squash(0.95), spin(500), spray(0.9)), 0.8), {
        ease: 'inOut',
        swaps: { ...ANGRY, ...BLUR, fxBack: 'fxSmoke', fx1: 'fxGravel' },
      }),
      key(9, smoke(mix(tilt(-3.5, REAR, -0.5), bob(0.4), squash(0.94), spin(1100), spray(1.2)), 1), {
        ease: 'inOut',
      }),
      key(13, smoke(mix(tilt(-4, REAR, -0.6), bob(0.42), squash(0.94), spin(1550), spray(1.3)), 1.1), {
        ease: 'in',
      }),
      key(
        14,
        smoke(
          mix(tilt(7, FRONT, 0.9), squash(1.03, 0.97), spin(1700), {
            fx1: at(-9.8, -0.4, -1.1, 0, 0.9),
            fx3: at(-8.6, 0, 1.1),
          }),
          0.8,
        ),
        { ease: 'linear', swaps: { ...SHOUT, ...BLUR, fx1: 'fxGravel', fx3: 'fxSpeed', fxBack: 'fxSmoke' } },
      ),
      key(
        21,
        smoke(
          mix(tilt(8, FRONT, 1.1), squash(1.02, 0.98), spin(2500), {
            fx1: at(-10.4, -0.6, -1.3, 0, 1.1),
            fx3: at(-8.8, 0.1, 1.2),
          }),
          1,
        ),
        { ease: 'linear' },
      ),
      key(
        28,
        smoke(
          mix(tilt(6, FRONT, 0.9), squash(1.02, 0.98), spin(3300), {
            fx1: at(-10, -0.5, -1.2, 0, 1),
            fx3: at(-8.6, 0, 1.1),
          }),
          0.9,
        ),
        { ease: 'out' },
      ),
      key(30, mix(tilt(4, FRONT, 0.6), bob(0.25), spin(3400), { fx1: at(4.3, 0, 1.2) }), {
        ease: 'out',
        swaps: { ...ANGRY, brake: 'brakeGlow', fx1: 'fxSkid' },
      }),
      key(40, mix(tilt(2, FRONT, 0.2), bob(0.15), spin(3450), { fx1: at(4.3, 0, 1.4) }), { ease: 'inOut' }),
      key(44, undefined, { swaps: FOCUS }),
      key(51, spin(3450)),
    ],
  },
  /**
   * Ramp Jump. His little wooden ramp drops in front of him and he backs up a touch; the engine then carries his
   * origin about 0.9 forward and 0.6 up a frame on frames 4-9 and launches him on frame 10 (moves.ts upB). The ramp stays
   * put in the world, pitched to that same climb, and he drives up it so his front tyre reaches the lip as he takes off.
   */
  upB: {
    length: 39,
    swaps: ANGRY,
    keys: [
      ...rampJump(),
      key(12, undefined, { swaps: { ...SHOUT, ...BLUR } }),
      key(24, mix(AIR, tilt(-18, BODY), spin(roll(16))), { ease: 'inOut', swaps: UP }),
      key(39, mix(AIR, tilt(-8, BODY), spin(roll(17)))),
    ],
  },
};

/** The same clips under docs/art.md's canonical names. */
attacks.jab1 = attacks.jab!;
attacks.sideSpecial = attacks.sideB!;
attacks.upSpecial = attacks.upB!;
