import type { AnimClip, Key } from '../../../render/rig/types';
import { REV_UP } from '../revUp';
import { BODY, EXHAUST, WHEEL_X } from './parts';
import {
  AIR,
  ANGRY,
  BLUR,
  FOCUS,
  FRONT,
  PARK,
  REAR,
  SHOUT,
  SQUAT,
  at,
  bob,
  fxOn,
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
 * Rev Up (neutral special, src/fighters/wheely/moves.ts REV_UP). Two clips per version:
 *
 * - `neutralB` / `neutralBAir` on the move's timeline: he settles onto the rear springs (the charge holds on frame 6),
 *   then pops the clutch. The tyres spin up in a burnout with the nose lifting, the exhaust bangs a flame, and he
 *   blasts off on frame 17, stretched long behind speed lines, through the hit window (19-26). Then he stamps on the
 *   brakes and skids to a stop.
 * - `neutralBCharge` / `neutralBAirCharge`, drawn at the revs so far (0 to 110 frames) while the move revs: the body
 *   shakes harder on its springs, the exhaust puffs grow, a flame licks from the pipe from two thirds, and the charge
 *   flashes behind him as the revs top out.
 */

const { chargeFrames: FULL } = REV_UP;
/** Degrees the tyres spin in the burnout before they bite, then on through the drive and the skid. */
const SPUN = 1700;
const DRIVEN = SPUN + roll(45);
const STOPPED = SPUN + roll(55);

/** Settled back on the rear springs, ready to go: the pose the charge holds on. */
const REV: Pose = mix(tilt(-2.5, REAR, -0.3), squash(0.96), bob(0.35));
/** In the air: nose up, wheels hanging. */
const REV_AIR: Pose = mix(AIR, tilt(-6, BODY));

/** Gravel flung back off the rear tyre (fx1), mirrored to fly behind him. */
const spray = (s: number): Pose => ({ fx1: at(-WHEEL_X - 0.3, 0, -s, 0, s) });

/**
 * A flame (fxFlame) of size `s` blasting back out of the exhaust on `fx`. With `flat`, it blasts straight back along
 * the floor at that share of its height, for a pipe brought down near the floor.
 */
const backfire = (pose: Pose, s: number, fx = 'fx2', flat?: number) =>
  flat === undefined
    ? fxOn(pose, fx, EXHAUST, s)
    : fxOn(pose, fx, EXHAUST, s, -(pose.body?.rot ?? 0), s * flat);

/**
 * One frame of the rev at `revs` frames charged. The shell shakes on the suspension every other frame (the wheels
 * stay put), harder as the revs build. Two streams of puffs (fx2, fx3) leave the pipe 6 frames apart, drift back and
 * up and break up over 12 frames, bigger the higher the revs, over the exhaust smoke (fxBack). From two thirds a
 * flame (fx1) licks from the pipe, and over the last 7 frames the flash (prop) bursts out behind the car.
 */
function revFrame(revs: number, air: boolean): Key {
  const t = revs / FULL;
  const side = Math.floor(revs / 2) % 2 ? 1 : -1;
  const shake = 0.06 + 0.16 * t;
  const base = air ? REV_AIR : REV;
  let pose = mix(base, {
    shell: { y: (base.shell?.y ?? 0) + side * shake, rot: side * (0.3 + 1.1 * t) },
  });
  if (air) pose = mix(pose, spin(revs * (8 + 30 * t)));
  const swaps: Record<string, string | null> = {
    ...(t < 0.3 ? FOCUS : t < 0.75 ? ANGRY : SHOUT),
    fxBack: 'fxSmoke',
    ...(air && t > 0.5 ? BLUR : {}),
  };
  pose = smoke(pose, 0.45 + 0.85 * t);
  for (const [fx, lag] of [
    ['fx2', 0],
    ['fx3', 6],
  ] as const) {
    const age = (revs + lag) % 12;
    const u = age / 11;
    const grow = 0.7 + 0.9 * t;
    pose = fxOn(
      pose,
      fx,
      [EXHAUST[0] - 0.6 - 4.2 * u * grow, EXHAUST[1] - 0.2 - 2.6 * u * grow],
      (0.35 + 0.75 * u) * grow,
    );
    swaps[fx] = age < 4 ? 'fxPuff1' : age < 8 ? 'fxPuff2' : 'fxPuff3';
  }
  if (t >= 0.6) {
    pose = backfire(pose, 0.5 + 0.8 * ((t - 0.6) / 0.4), 'fx1');
    swaps.fx1 = 'fxFlame';
  }
  const flashFrom = FULL - 7;
  if (revs > flashFrom) {
    const k = (revs - flashFrom) / 7;
    const s = 0.4 + 0.9 * k;
    pose = mix(pose, { prop: at(0, -7, s, 9 * k, 0.75 * s) });
    swaps.prop = 'fxFlash';
    Object.assign(swaps, SHOUT);
  }
  return key(revs, pose, { ease: 'linear', swaps });
}

function revClip(air: boolean): AnimClip {
  return { length: FULL, keys: Array.from({ length: FULL + 1 }, (_, revs) => revFrame(revs, air)) };
}

/** The blast, timed to REV_UP: frame 6 is the rev pose, frame 17 the launch, 19-26 the hit, then the skid. */
function blastClip(air: boolean): AnimClip {
  const length = REV_UP.faf - 1;
  const [go, end] = REV_UP.drive;
  /** Grounded poses pivot on the tyres; in the air he turns about his middle. */
  const nose = (rot: number, dx = 0, dy = 0) =>
    air ? mix(AIR, tilt(rot, BODY, dx, dy)) : tilt(rot, rot < 0 ? REAR : FRONT, dx, dy);
  const ground = (p: Pose): Pose => (air ? {} : p);
  const burn = (rot: number, deg: number, s: number) =>
    smoke(
      mix(nose(rot, -0.4), air ? {} : bob(0.4), squash(0.95), spin(deg), ground(spray(s))),
      0.6 + 0.4 * s,
    );
  const burnSwaps = { ...SHOUT, ...BLUR, fxBack: 'fxSmoke', ...(air ? {} : { fx1: 'fxGravel' }) };
  const drive = (rot: number, dx: number, deg: number, flame: number, lines: number) =>
    backfire(mix(nose(rot, dx), squash(0.95, 1.08), spin(deg), { fx3: at(-8.7, 0, lines) }), flame);
  const driveSwaps = { ...SHOUT, ...BLUR, fx2: 'fxFlame', fx3: 'fxSpeed' };
  const skid = (rot: number, dx: number, s: number) =>
    mix(
      nose(rot, dx),
      air ? {} : bob(0.25),
      spin(STOPPED - (rot > 4 ? 120 : 0)),
      ground({ fx1: at(WHEEL_X, 0, s) }),
    );
  const settle = air ? AIR : PARK;
  return {
    length,
    swaps: ANGRY,
    keys: [
      key(0, settle, { ease: 'out', swaps: FOCUS }),
      key(3, air ? mix(AIR, tilt(-3, BODY)) : mix(SQUAT, tilt(1, FRONT)), { ease: 'inOut' }),
      key(REV_UP.charge - 1, smoke(air ? REV_AIR : REV, 0.45), {
        ease: 'in',
        swaps: { ...ANGRY, fxBack: 'fxSmoke' },
      }),
      key(REV_UP.charge, burn(-3.5, 120, 0.7), { ease: 'out', swaps: burnSwaps }),
      key(11, burn(-7, 900, 1.15), { ease: 'inOut' }),
      key(14, burn(-9, 1400, 1.3), { ease: 'in' }),
      // Reared nose-up, the pipe is a unit off the floor: the flame flattens along it rather than into it.
      key(15, backfire(burn(-9.5, 1550, 1.3), 1.2, 'fx2', 0.75), {
        ease: 'in',
        swaps: { ...burnSwaps, fx2: 'fxFlame' },
      }),
      key(go - 1, backfire(burn(-8, SPUN, 1.2), 1.6, 'fx2', 0.65), { ease: 'linear' }),
      key(go, drive(2, 1.6, SPUN + 150, 2, 1.1), { ease: 'linear', swaps: driveSwaps }),
      key(REV_UP.hit[0] + 1, drive(1.5, 2.2, SPUN + 500, 1.8, 1.3), { ease: 'linear' }),
      key(end, drive(1, 2, DRIVEN, 1.1, 1.2), { ease: 'out' }),
      key(end + 1, skid(5, 1.2, 1.1), {
        ease: 'out',
        swaps: { ...ANGRY, brake: 'brakeGlow', ...(air ? {} : { fx1: 'fxSkid' }) },
      }),
      key(33, skid(3, 0.4, 1.5), { ease: 'inOut' }),
      key(36, undefined, { swaps: FOCUS }),
      key(40, air ? AIR : mix(tilt(-1.5, REAR, 0.2), spin(STOPPED)), { ease: 'inOut' }),
      key(length, air ? AIR : spin(STOPPED)),
    ],
  };
}

export const revUp: Record<string, AnimClip> = {
  neutralB: blastClip(false),
  neutralBAir: blastClip(true),
  neutralBCharge: revClip(false),
  neutralBAirCharge: revClip(true),
};
