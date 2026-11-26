import type { Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { FAF, STOMP, WAVE } from '../finalSmashData';
import { strike, wings } from './attacks';
import { ANGRY, SHOUT, STAND, WEB, air, fx, key, leg, mix } from './poses';

/**
 * Evolved Stomp, the Final Smash (src/fighters/duck/finalSmash.ts), on Ganon's timeline. Through the activation
 * freeze the Duck grows in a gold glow, in pulses, to three times his height (Ganondorf's x3 scale while he turns),
 * and a grown duck's plume and tail come through halfway. He roars with his wings up, stamps a webbed foot down on
 * frame 54 (the slam) and again on 128 (the charge), watches the shockwave go, then shrinks back the same way and
 * stands on frame 225. The burst and the shockwave are the entities' props (art index, `projectiles`). Grounded he
 * plants his feet; in the air his legs hang and he stamps on nothing.
 */

/** The whole Duck scaled `s` times about his feet: the base bone carries every part but the effect bones. */
const grown = (pose: Pose, s: number): Pose => mix(pose, { base: { sx: s, sy: s } });

/** The evolved parts, drawn behind the belly's and head's outlines. */
const PARTS = { tail: 'tail', plume: 'plume' };
const PARTS_Z = { tail: 5.5, plume: 6.5 };
/** Both wings raised behind him: the front one drawn behind the belly too, so it never covers his face. */
const WINGS_BEHIND_Z = { ...PARTS_Z, wingF: 0.5 };

/** The gold glow behind him while he grows or shrinks, sized to `s`, radius `r` times his size. */
const glow = (s: number, r: number): Pose => ({ fx3: fx(0, -5.5 * s, r * s) });
/** The glow's radius at his own size; it grows with him. */
const GLOW_R = 9;
const GLOW = { fxBack: 'fxGlow3', face: 'faceHappy' };

function poses(inAir: boolean) {
  /** Feet planted at back and front ankle offsets on the ground, or hanging in the air. */
  const planted = (b: number, f: number): [number, number] | null => (inAir ? null : [b, f]);
  /** Standing tall, head up, wings held back: the evolved Duck between stomps. */
  const stance = (breath = 0): Pose =>
    wings(
      strike({
        lean: -3,
        squash: [1 + breath * 0.02, 1 - breath * 0.02],
        head: [1.0, -8.5 + breath * 0.08],
        aim: -6,
        feet: planted(-1.1, 0.7),
      }),
      // -202 rather than 158, so the wing swings the short way to and from the stamp's -166.
      [-202 - breath * 6, 1.5],
      [-160 + breath * 6, 1.5],
    );
  /** The roar: head thrown back, beak open, both wings raised high. */
  const roar = wings(
    strike({ lean: -10, head: [0.2, -8.8], aim: -34, feet: planted(-1.0, 0.6) }),
    [-148, 1.85],
    [-122, 1.85],
  );
  /** Winding up a stamp: leaning back, the front webbed foot raised high, wings up behind him for balance. */
  const lift = (high: number): Pose => {
    const base = strike({ lean: -12, shift: -0.3, head: [0.0, -8.4], aim: -14, feet: planted(-1.0, 0.2) });
    const raised = leg(base, 'F', [1.3 + high * 0.2, -2.0 - high * 0.6], 70);
    return wings(raised, [-150 - high * 6, 1.6], [-128 - high * 6, 1.55]);
  };
  /** The stamp: thrown forward onto the front foot, belly squashed, wings flung back and up. */
  const stamp = (squash: number): Pose => {
    const base = strike({
      lean: 12,
      drop: 0.35 * squash,
      squash: [1 + 0.09 * squash, 1 - 0.08 * squash],
      head: [3.0, -6.6 + squash * 0.3],
      aim: 16,
      feet: planted(-1.1, 2.4),
    });
    const down = inAir ? leg(base, 'F', [1.9, 0.7], 10) : base;
    return wings(down, [-166, 1.6], [-128, 1.55]);
  };
  /** Leaning after the shockwave, beak open, wings swept back. */
  const follow = wings(
    strike({ lean: 18, shift: 0.6, head: [3.6, -6.8], aim: 4, feet: planted(-1.6, 1.8) }),
    [-160, 1.6],
    [-176, 1.55],
  );
  const still = inAir ? air() : STAND;
  return { stance, roar, lift, stamp, follow, still };
}

/** Dust kicked up round the stamping foot (fx1, fx2), at full size. */
const stampDust = (k: number): Pose => ({
  fx1: fx(7.5 + k * 2, -1.6 - k, 3.2 + k * 1.2),
  fx2: fx(-3 - k * 2, -1.2 - k * 0.6, 2.4 + k),
});

/** Swap sets: what shows from each key on (a key's swaps replace the last key's). */
const EVOLVED = { ...ANGRY, ...PARTS, wingF: 'wingOpen', wingB: 'wingOpen' };
const ROAR = { ...EVOLVED, ...SHOUT };

const S = 3;

function evolvedStomp(inAir: boolean): AnimClip {
  const { stance, roar, lift, stamp, follow, still } = poses(inAir);
  // The stamp's star, and dust where there is a floor to kick it up from.
  const puff = inAir ? null : 'fxPuff';
  const IMPACT = { ...EVOLVED, ...SHOUT, ...WEB, fx1: 'fxStar', fx2: puff };
  const DUSTY = { ...EVOLVED, ...WEB, fx1: puff, fx2: puff };
  const growth: [number, number][] = [
    [10, 1.55],
    [14, 1.4],
    [20, 2.2],
    [24, 2.05],
    [30, 2.8],
    [34, 2.65],
  ];
  const shrink: [number, number][] = [
    [172, 2.3],
    [176, 2.45],
    [182, 1.7],
    [186, 1.8],
    [194, 1],
  ];
  const keys: Key[] = [
    key(0, still, { ease: 'out' }),
    key(4, mix(still, glow(1, GLOW_R)), { ease: 'out', swaps: GLOW }),
    // Growing through the freeze in pulses, each overshooting and settling back a little; the parts come through
    // halfway.
    ...growth.map(([f, s], i) =>
      key(f, mix(grown(stance(i % 2), s), glow(s, GLOW_R * (1 + (i % 2) * 0.15))), {
        ease: i % 2 ? 'in' : 'out',
        ...(f === 20 && { swaps: { ...GLOW, ...PARTS }, z: PARTS_Z }),
      }),
    ),
    key(40, grown(roar, S), { ease: 'out', swaps: ROAR, z: WINGS_BEHIND_Z }),
    key(46, grown(roar, S), { ease: 'inOut' }),
    // The first stamp: the slam on frame 54.
    key(STOMP.frame - 6, grown(lift(1), S), { ease: 'in', swaps: EVOLVED, z: PARTS_Z }),
    key(STOMP.frame, mix(grown(stamp(1), S), stampDust(0)), { ease: 'out', swaps: IMPACT }),
    key(STOMP.frame + 3, mix(grown(stamp(0.6), S), stampDust(0.5)), { ease: 'out', swaps: DUSTY }),
    key(STOMP.frame + 12, mix(grown(stance(), S), stampDust(1.5)), { ease: 'inOut', swaps: EVOLVED }),
  ];
  // Standing over the pinned: a slow heaving breath.
  for (let f = 80, i = 0; f < 108; f += 14, i++) keys.push(key(f, grown(stance(i % 2 ? 0 : 1), S)));
  keys.push(
    key(108, grown(stance(), S), { ease: 'inOut' }),
    // The second stamp, wound up higher: the charge on frame 128.
    key(WAVE.frame - 10, grown(lift(2), S), { ease: 'out' }),
    key(WAVE.frame - 4, grown(lift(2.3), S), { ease: 'in' }),
    key(WAVE.frame, mix(grown(stamp(1.2), S), stampDust(0)), { ease: 'out', swaps: IMPACT }),
    key(WAVE.frame + 3, mix(grown(stamp(0.7), S), stampDust(0.5)), { ease: 'out', swaps: DUSTY }),
    key(WAVE.frame + 14, mix(grown(follow, S), stampDust(1.5)), { ease: 'inOut', swaps: ROAR }),
    key(150, grown(follow, S), { ease: 'inOut', swaps: EVOLVED }),
    key(162, grown(stance(), S), { ease: 'out' }),
    key(166, mix(grown(stance(), S), glow(S, GLOW_R)), { ease: 'out', swaps: { ...GLOW, ...PARTS } }),
    // Shrinking back the way he grew; the parts go when he's below twice his size.
    ...shrink.map(([f, s], i) =>
      key(f, mix(grown(stance(i % 2), s), glow(s, GLOW_R * (1 + (i % 2) * 0.15))), {
        ease: i % 2 ? 'in' : 'out',
        ...(f === 182 && { swaps: GLOW, z: {} }),
      }),
    ),
    key(204, mix(still, glow(1, 2)), { ease: 'in' }),
    key(208, undefined, { swaps: {} }),
    key(FAF - 1, still),
  );
  return {
    length: FAF - 1,
    active: [
      [STOMP.frame, STOMP.frame],
      [WAVE.frame, WAVE.frame],
    ],
    keys,
  };
}

/** Grounded Evolved Stomp: FAF 226. */
export const finalSmashClip = evolvedStomp(false);
/** Aerial Evolved Stomp: the same frames, legs hanging. */
export const finalSmashAirClip = evolvedStomp(true);
