import type { Pose } from '../../../render/rig/author';
import type { AnimClip } from '../../../render/rig/types';
import { downB, downBHit } from '../specials';
import { BATON_READY, LUNGE, STANCE, reachF, strikeKey, swing, trail } from './attacks';
import {
  ANGRY,
  BATON,
  CROUCH,
  FRONT_ARM_OVER_HEAD,
  GRIN,
  READY,
  SHOUT,
  SIDE,
  continuous,
  feet,
  floor,
  fx,
  hands,
  key,
  mix,
} from './poses';
import { rig } from './rig';

/**
 * Shadow Step's clips (src/fighters/bob-the-robber/specials.ts, Lucario's Double Team), frame for frame on the
 * moves. `downB`: Bob ducks on frames 1-4 as a pool of shadow spreads under him and a column of it rises over him,
 * hides in it with only his eyes glowing while the counter is open (5-24), then lets it sink back and stands by
 * 52. `downBHit`: its frame 0 holds through the freeze, so he is still a shadow, now behind the attacker; on 1-5 he
 * bursts out of it with the baton raised and on 6 brings it down level, holding the lunge through the strike's
 * last active frame, 17.
 */

const slot = (name: string) => rig.slots.findIndex((s) => s.name === name);
/** His glowing eyes draw over the shadow column on `fx1`. */
const EYES_OVER_SHADOW = { face: slot('fx1') + 0.5 };
/** Only his eyes show while he hides. */
const HIDDEN = { face: 'face3qShadow', fxBack: 'shadowPool', fx1: 'shadowVeil' };

/** The pool on the floor (`fx4`, drawn behind him) and the column over him (`fx1`), grown from the floor up. */
const shade = (pool: number, veil: number, x = 0): Pose => ({
  fx4: fx(x, 0, 0, pool, pool),
  fx1: fx(x, 0, 0, 1, veil),
});

/** Ducked low in the shadow, fists tucked to his chest; `breath` lifts him a touch. */
const DUCK = (breath = 0): Pose =>
  hands(
    feet(
      { body: { rot: 16, x: -0.2 }, hip: { y: 2.0 - breath }, neck: { rot: -14, y: 1.5 - breath * 0.5 } },
      floor(-2.3),
      floor(2.1),
      true,
      [25, 20],
    ),
    [-0.4, -4.2],
    [1.9, -4.6],
    -1,
  );

/** Ducked as above with the baton out, held low behind him, ready to come up. */
const DUCK_ARMED = swing(DUCK(), [1.4, -4.4], 150, -1);

/** Springing up out of the shadow, the baton cocked back over his shoulder. */
const WIND = hands(
  swing(mix(STANCE, { body: { rot: -12, x: -0.6 }, hip: { y: 0.2 }, neck: { rot: 6 } }), [-0.8, -9.8], -165),
  [-0.4, -9.4],
  null,
);
const TOP = swing(mix(STANCE, { body: { rot: 2, x: 0.4 } }), [1.6, -10.6], -80);

/** The strike: lunging, the baton level at chest height; `push` carries the lunge on as it holds. */
const STRIKE = (push = 0): Pose => {
  const wrist: [number, number] = [5.0 + push, -6.6];
  return reachF(swing(mix(LUNGE, { body: { rot: 8 + push * 2, x: 1.3 + push * 0.6 } }), wrist, -1), wrist);
};
const FOLLOW = swing(mix(LUNGE, { body: { rot: 18, x: 1.2 } }), [4.0, -5.6], 65);

const [hitFrom, hitTo] = downBHit.hits[0]!.frames;

export const shadowStepClips: Record<string, AnimClip> = {
  downB: {
    length: downB.faf - 1,
    active: [downB.counter!.window],
    swaps: SIDE,
    keys: [
      key(0, mix(READY, shade(0.2, 0)), {
        ease: 'out',
        swaps: { ...SIDE, face: 'face3qWide', fxBack: 'shadowPool' },
      }),
      key(3, mix(DUCK(), shade(0.85, 0.55)), {
        ease: 'out',
        swaps: { ...SIDE, face: 'face3qShush', fxBack: 'shadowPool', fx1: 'shadowVeil' },
      }),
      key(5, mix(DUCK(), shade(1, 1)), { ease: 'inOut', swaps: { ...SIDE, ...HIDDEN }, z: EYES_OVER_SHADOW }),
      key(14, mix(DUCK(0.15), shade(1.04, 1.02)), { ease: 'inOut' }),
      key(24, mix(DUCK(), shade(1, 1)), { ease: 'in' }),
      key(28, mix(DUCK(0.1), shade(0.95, 0.45)), {
        ease: 'in',
        swaps: { ...SIDE, face: 'face3qShush', fxBack: 'shadowPool', fx1: 'shadowVeil' },
        z: {},
      }),
      key(31, mix(DUCK(0.2), shade(0.8, 0.05)), { ease: 'out' }),
      key(32, undefined, { swaps: { ...SIDE, face: 'face3qShush', fxBack: 'shadowPool' } }),
      key(42, mix(CROUCH, shade(0.15, 0)), { ease: 'inOut', swaps: { ...SIDE, fxBack: 'shadowPool' } }),
      key(43, undefined, { swaps: SIDE }),
      key(54, READY, { ease: 'inOut' }),
      key(downB.faf - 1, READY),
    ],
  },
  downBHit: {
    length: downBHit.faf - 1,
    active: [[hitFrom, hitTo]],
    swaps: { ...ANGRY, ...BATON },
    keys: continuous([
      key(0, mix(DUCK_ARMED, shade(1, 1)), {
        ease: 'in',
        swaps: { ...SIDE, ...BATON, ...HIDDEN },
        z: EYES_OVER_SHADOW,
      }),
      key(1, mix(DUCK_ARMED, shade(1, 1), { fx1: fx(0, 0, 0, 0.95) }), {
        ease: 'out',
        swaps: { ...SHOUT, ...BATON, fxBack: 'shadowPool', fx1: 'shadowBurst' },
        z: FRONT_ARM_OVER_HEAD,
      }),
      key(3, mix(WIND, shade(0.8, 1), { fx1: fx(0, -0.6, 0, 1.3) }), { ease: 'in' }),
      key(4, undefined, { swaps: { ...SHOUT, ...BATON, fxBack: 'shadowPool' } }),
      key(5, mix(TOP, shade(0.5, 1)), { ease: 'linear' }),
      strikeKey(hitFrom, trail(STRIKE(), false, 0.6), { ...SHOUT, ...BATON, smear: 'smear150' }, { z: {} }),
      key(hitFrom + 3, STRIKE(0.4), { ease: 'out', swaps: { ...SHOUT, ...BATON } }),
      key(hitTo, STRIKE(0.6), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(24, FOLLOW, { ease: 'inOut', swaps: { ...GRIN, ...BATON } }),
      key(36, BATON_READY, { ease: 'inOut' }),
      key(downBHit.faf - 1, BATON_READY),
    ]),
  },
};
