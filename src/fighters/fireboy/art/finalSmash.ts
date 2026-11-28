import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { BLAST } from '../finalSmash';
import { AIR, ANGRY, ARMS_IN_FRONT, FISTS, SHOUT, STAND, ball, feet, flame, hands, key, mix } from './poses';

/**
 * Fire Blast, the Final Smash (src/fighters/fireboy/finalSmash.ts), on Mario Finale's timeline: Fireboy powers up in a
 * flame through the activation freeze, gathers a fireball at his back hip, and thrusts both hands forward on frame
 * 65 as the blast leaves them (BLAST.frame), holding the push while it rolls away. The blast itself is the entity's
 * prop (art index, `projectiles.blast`). Grounded he braces on his feet; in the air his legs trail.
 */

const RELEASE = BLAST.frame;

/** Legs: planted wide on the ground, or trailing in the air. `lean` tips the body (deg, + forwards). */
function legs(air: boolean, lean: number, drop: number, back: number, front: number): Pose {
  if (air) return mix(AIR, { body: { rot: lean }, thighF: { rot: -40 }, shinF: { rot: 55 } });
  return feet({ body: { rot: lean }, hip: { y: drop } }, [back, 0], [front, 0], true);
}

/**
 * The flame aura behind him while he powers up: a flame of radius `r` rising from his middle, or, once it swells
 * wider than his middle is high, from the floor, its round base resting on the floor line.
 */
const aura = (r: number, stretch: number) => ({
  fx4: flame(0, Math.min(-3.2, -0.85 * r * stretch), r, -90, stretch),
});
/** The aura's slot, behind everything but the decor glow (bone fx4). */
const AURA = 'fxBack';

/** The jets flaring from the thrust palms, scaled by `jet`. */
const thrustJets = (jet: number): Pose => ({
  fx2: flame(4.6, -4.0, 1.3 * jet, 0, 1.5),
  fx3: flame(4.2, -3.3, 1.0 * jet, 6, 1.4),
});

function poses(air: boolean) {
  /**
   * Braced, fists clenched at the hips with the elbows back, chest out. The front fist sits by his side rather
   * than out in front, so it sweeps back to the back hip for the gather in four frames.
   */
  const power = (r: number, s: number) =>
    mix(hands(legs(air, -5, 0.55, -1.3, 1.3), [-1.6, -2.4], [1.0, -2.2], -1), aura(r, s), {
      neck: { rot: -6 },
    });
  /** Hands together at the back hip, a flame rising from the palms and leaning back past his shoulder. */
  const gather = (r: number) =>
    mix(hands(legs(air, -14, 0.8, -1.5, 1.1), [-2.6, -2.9], [-2.0, -3.4], -1), {
      fx1: flame(-3.2, -3.0, r, -128, 1.15),
    });
  /** Both hands thrust forward at chest height, jets flaring from the palms. */
  const thrust = (lean: number, jet: number) =>
    mix(
      hands(legs(air, lean, 0.5, -1.7, 1.6), [3.1, -3.3], [3.6, -3.9], -1),
      { armF: { sy: 1.4 }, foreF: { sy: 1.4 }, armB: { sy: 1.4 }, foreB: { sy: 1.4 } },
      thrustJets(jet),
    );
  return { power, gather, thrust };
}

/**
 * Swap sets. A key's `swaps` replace the last key's (they don't merge), so each set names everything shown from then
 * on; keys without `swaps` keep the last set.
 */
const POWER = { ...FISTS, [AURA]: 'fxFlame' };
const POWER_SHOUT = { ...POWER, face: 'faceFrontShout' };
const GATHER = { [AURA]: 'fxFlame', fx1: 'fxFlame' };
const HOLD_FLAME = { fx1: 'fxFlame' };
const THRUST_IN = { ...SHOUT, fx1: 'fxBall', fx2: 'fxJet', fx3: 'fxJet' };
const PUSH = { ...SHOUT, fx2: 'fxJet', fx3: 'fxJet' };

function fireBlast(air: boolean, length: number): AnimClip {
  const { power, gather, thrust } = poses(air);
  const end = length - 16;
  const keys: Key[] = [
    key(0, air ? mix(AIR, {}) : STAND, { ease: 'out' }),
    key(4, power(1.6, 1.1), { ease: 'out', swaps: POWER }),
  ];
  // Powering up through the freeze: the aura swells and flickers.
  for (let f = 10, i = 0; f <= 34; f += 6, i++)
    keys.push(key(f, power(3.2 + (i % 2) * 0.5 + i * 0.25, 1.25 + (i % 2) * 0.15), { ease: 'inOut' }));
  keys.push(
    key(40, power(4.6, 1.35), { ease: 'linear', swaps: POWER_SHOUT }),
    key(44, mix(gather(0.4), aura(2.4, 1.1)), { ease: 'out', swaps: GATHER, z: { fx1: 0.5 } }),
    key(52, mix(gather(1.1), aura(0.8, 1)), { ease: 'inOut' }),
    key(58, mix(gather(1.6), aura(0.2, 1)), { ease: 'in', swaps: HOLD_FLAME }),
    key(RELEASE - 2, mix(thrust(6, 0.4), { fx1: ball(5.2, -3.8, 2.2, 0) }), {
      ease: 'linear',
      swaps: THRUST_IN,
      z: ARMS_IN_FRONT,
    }),
    // The fireball leaves his hands as the blast: it grows on out of them for its last frame.
    key(RELEASE, mix(thrust(12, 1.3), { fx1: ball(6.4, -3.8, 2.6, 0) }), { ease: 'out', swaps: PUSH }),
    key(RELEASE + 6, thrust(4, 1.6), { ease: 'inOut' }),
  );
  // Holding the push while the blast rolls away: a slow rock against the recoil.
  for (let f = RELEASE + 14, i = 0; f < end - 10; f += 10, i++)
    keys.push(key(f, thrust(i % 2 ? 9 : 5, i % 2 ? 1.35 : 1.55), { ease: 'inOut' }));
  keys.push(
    key(end - 6, thrust(6, 0.5), { ease: 'in' }),
    // The jets burn down where they are (a bone a key leaves out would swing back to its rest place).
    key(end, mix(hands(legs(air, 4, 0.4, -1, 1), [-0.6, -2.8], [0.4, -3.1], -1), thrustJets(0.05)), {
      ease: 'inOut',
      swaps: {},
      z: {},
    }),
    key(length, air ? mix(AIR, {}) : STAND),
  );
  return { active: [[RELEASE, RELEASE]], length, swaps: ANGRY, keys };
}

/** Grounded Fire Blast: FAF 157 (Mario Finale's grounded interruptible frame). */
export const finalSmashClip = fireBlast(false, 156);
/** Aerial Fire Blast: FAF 147 (Mario Finale's aerial interruptible frame). */
export const finalSmashAirClip = fireBlast(true, 146);
