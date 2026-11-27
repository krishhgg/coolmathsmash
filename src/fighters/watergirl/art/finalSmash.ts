import type { Pose } from '../../../render/rig/author';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import {
  AIR,
  ANGRY,
  ARMS_IN_FRONT,
  BALL,
  MITTENS,
  SHOUT,
  STAND,
  feet,
  flame,
  hands,
  key,
  mix,
} from '../../fireboy/art/poses';
import { WAVE } from '../finalSmashData';
import { WAVE_FOOT } from './parts';

/**
 * Tidal Wave, the Final Smash (src/fighters/watergirl/finalSmash.ts), on Mario Finale's timeline: through the
 * activation freeze she crouches with her palms down over a swell of water rising round her feet, then straightens
 * and lifts it with both arms up and back, and on frame 65 (WAVE.frame) she sweeps her arms forward and down as the
 * wave breaks out in front of her. She holds the push, water running off her palms, while it rolls away. The wave
 * itself is the entity's prop (art index, `projectiles.wave`). In the air her legs trail and the water rises behind
 * her instead of round her feet.
 */

const RELEASE = WAVE.frame;

/** Legs: planted wide on the ground, or trailing in the air. `lean` tips the body (deg, + forwards). */
function legs(air: boolean, lean: number, drop: number, back: number, front: number): Pose {
  if (air) return mix(AIR, { body: { rot: lean }, thighF: { rot: -40 }, shinF: { rot: 55 } });
  return feet({ body: { rot: lean }, hip: { y: drop } }, [back, 0], [front, 0], true);
}

/** Both arms stretched by `s`. */
const reaching = (s: number): Pose => ({
  armF: { sy: s },
  foreF: { sy: s },
  armB: { sy: s },
  foreB: { sy: s },
});

/** The swell round her feet (bone fx4, on the floor), `w` wide and `h` times as tall. */
const swell = (w: number, h: number): Pose => ({ fx4: { x: 0, y: 0, sx: w, sy: w * h } });
/**
 * Two columns of water rising at her sides as she lifts (bones fx2 and fx3), clear of her head, `r` round and
 * `stretch` tall. The stretch draws out the whole jet, round foot too, so each foot is raised to stand on the floor.
 */
function lifting(r: number, stretch: number): Pose {
  const column = (x: number, k: number, tilt: number) => {
    const sy = ((r * k) / BALL) * stretch;
    return flame(x, -3 * sy + 0.15, r * k, -90 + tilt, stretch);
  };
  return { fx2: column(-4.7, 1, -6), fx3: column(4.9, 0.9, 6) };
}
/** In the air: a tongue of water rising behind her middle instead (her fxFlame is water). */
const rising = (r: number, stretch: number): Pose => ({ fx4: flame(0, -3.2, r, -90, stretch) });

/**
 * The wave forming in front of her sweeping hands (bone fx1) at `s` of its full size, its back foot `x` ahead of her
 * and its base on the floor (WAVE_FOOT).
 */
const forming = (x: number, s: number): Pose => ({
  fx1: { x: x + WAVE_FOOT.back * s, y: -WAVE_FOOT.base * s, sx: s, sy: s },
});

/** Streams running off her palms after the release, scaled by `jet`. */
const runoff = (jet: number): Record<string, BonePose> => ({
  fx2: flame(3.4, -2.6, 0.6 * jet, 10, 1.3),
  fx3: flame(3.0, -2.0, 0.5 * jet, 24, 1.2),
});

function poses(air: boolean) {
  const water = (w: number, h: number) => (air ? rising(w * 3, 1 + h * 0.2) : swell(w, h));
  /** Crouched wide, palms down over the water at her sides. */
  const call = (w: number, h: number) =>
    mix(hands(legs(air, 6, 0.8, -1.5, 1.4), [-2.3, -1.3], [2.3, -1.4], -1), reaching(1.3), water(w, h), {
      neck: { rot: 8 },
    });
  /** Straightened and leaning back, both arms up and back, lifting the water up at her sides. */
  const lift = (w: number, r: number, stretch: number, lean: number) =>
    mix(
      hands(legs(air, lean, 0.3, -1.2, 1.2), [-1.9, -4.5], [-0.8, -4.9], 1),
      reaching(1.5),
      water(w, 1),
      lifting(r, stretch),
      { neck: { rot: -8 } },
    );
  /** Pitched forward, both arms swept out in front and down, palms open towards the wave. */
  const push = (lean: number, jet: number) =>
    mix(hands(legs(air, lean, 0.6, -1.7, 1.7), [3.2, -2.0], [3.8, -2.6], -1), reaching(1.45), runoff(jet));
  return { call, lift, push };
}

/**
 * Swap sets. A key's `swaps` replace the last key's (they don't merge), so each set names everything shown from then
 * on; keys without `swaps` keep the last set.
 */
const swellSet = (air: boolean) => ({ ...MITTENS, fxBack: air ? 'fxFlame' : 'fxSwell' });
const lifted = (air: boolean) => ({ ...swellSet(air), ...SHOUT, fx2: 'fxFlame', fx3: 'fxFlame' });
/** The tongues rise behind her body. */
const BEHIND = { fx2: 0.55, fx3: 0.6 };
const FORMING = { ...SHOUT, ...MITTENS, fx1: 'fxWave' };
const PUSH = { ...SHOUT, ...MITTENS, fx2: 'fxJet', fx3: 'fxJet' };

function tidalWave(air: boolean, length: number): AnimClip {
  const { call, lift, push } = poses(air);
  const end = length - 16;
  const CALL = swellSet(air);
  const keys: Key[] = [
    key(0, air ? mix(AIR, {}) : STAND, { ease: 'out' }),
    key(5, call(0.35, 0.8), { ease: 'out', swaps: CALL }),
  ];
  // Calling the water up through the freeze: the swell grows and heaves.
  for (let f = 11, i = 0; f <= 35; f += 6, i++)
    keys.push(key(f, call(0.55 + i * 0.12, 0.9 + (i % 2) * 0.25), { ease: 'inOut' }));
  keys.push(
    key(40, call(1.2, 1.1), { ease: 'linear', swaps: { ...CALL, face: 'faceFrontShout' } }),
    key(44, lift(1.2, 0.6, 1.2, -4), { ease: 'out', swaps: lifted(air), z: BEHIND }),
    key(52, lift(1.15, 1.3, 2.2, -10), { ease: 'inOut' }),
    // The sweep from the lift into the push takes three even frames (the arms turn about 50 degrees in each).
    key(RELEASE - 6, lift(1.05, 1.6, 2.8, -14), { ease: 'linear' }),
    key(RELEASE - 3, mix(push(6, 0.2), forming(4.2, 0.3)), {
      ease: 'linear',
      swaps: FORMING,
      z: { ...ARMS_IN_FRONT, fx1: 0.5 },
    }),
    key(RELEASE - 1, mix(push(12, 0.4), forming(5.2, 0.62)), { ease: 'linear' }),
    // The forming wave grows on where it is into the frame the rolling wave takes over (it isn't drawn from here).
    key(RELEASE, mix(push(16, 1.3), forming(5.7, 0.8)), { ease: 'out', swaps: PUSH, z: ARMS_IN_FRONT }),
    key(RELEASE + 6, push(9, 1.6), { ease: 'inOut' }),
  );
  // Holding the push while the wave rolls away: a slow rock, the water running off her palms.
  for (let f = RELEASE + 14, i = 0; f < end - 10; f += 10, i++)
    keys.push(key(f, push(i % 2 ? 12 : 8, i % 2 ? 1.3 : 1.55), { ease: 'inOut' }));
  keys.push(
    key(end - 6, push(8, 0.5), { ease: 'in' }),
    // The streams run dry where they are (a bone a key leaves out would swing back to its rest place).
    key(end, mix(hands(legs(air, 3, 0.4, -1, 1), [-0.7, -2.6], [0.6, -2.9], -1), runoff(0.05)), {
      ease: 'inOut',
      swaps: {},
      z: {},
    }),
    key(length, air ? mix(AIR, {}) : STAND),
  );
  return { active: [[RELEASE, RELEASE]], length, swaps: ANGRY, keys };
}

/** Grounded Tidal Wave: FAF 157 (Mario Finale's grounded interruptible frame). */
export const finalSmashClip = tidalWave(false, 156);
/** Aerial Tidal Wave: FAF 147 (Mario Finale's aerial interruptible frame). */
export const finalSmashAirClip = tidalWave(true, 146);
