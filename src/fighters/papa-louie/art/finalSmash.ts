import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import { CONVEYOR } from '../finalSmash';
import {
  ANGRY,
  BACK_ARM_FRONT,
  GRIT,
  PEPPER_SCALE,
  SHOUT,
  arms,
  both,
  grip,
  plant,
  propAt,
  smear,
  stance,
  toward,
  unwrap,
} from './attacks';
import { BELT, CHIMNEY, FLOUR_X, TOPPINGS } from './conveyor';
import { STAND, key, mix, type Pose, type Pt } from './poses';

/**
 * Conveyor Oven, the Final Smash (../finalSmash.ts), on House of Boom's timeline. The activation: Papa heaves his peel
 * overhead through the 23-frame freeze, slams it down on 14 and the belt rolls out from the blade; on 21-24 the belt
 * throws up its flour (House of Boom's box line, frames 25-48, sits in the cloud); he works the peel like a lever,
 * shoving it forward as the belt jolts (25-44) and yanking it back for the catch (45-48). A miss leaves him peering
 * down the empty belt, scratching his head, while it rolls back up. The cinematic: he hauls the belt in hand over hand,
 * lobs a pepper shaker and then the Parmesan into the oven's chimney (topped), fans its fire with the peel (baked), and
 * crouches and springs up with the peel overhead on CONVEYOR.blast as the oven blows its door. Anything he does over
 * the oven is drawn beside it, since the oven (the `papa-louie/oven` entity's flipbook) draws over him too.
 */

type Swaps = Record<string, string | null>;

/** The peel's blade resting on the belt's near end, where he works it like a lever. */
const LEVER_TIP: Pt = [10.2, -1.2];
/** The peel from the wrist at `wrist` towards `tip`, the back hand on the handle at `back`. */
const lever = (pose: Pose, wrist: Pt, back: Pt): Pose => grip(pose, wrist, toward(wrist, LEVER_TIP), back);

const RAISE_LOW = both(stance(-0.2, 0.7, -4, -1.3, 1.2, { head: { rot: -6 } }), [1.6, -8.2], 160);
const RAISE = both(
  stance(-0.7, -0.1, -12, -1.2, 1.1, { head: { rot: -10 }, hat: { rot: -14 } }),
  [0.2, -10.7],
  172,
);
const SLAM = grip(stance(1.4, 1.5, 30, -1.4, 2.2, { head: { rot: 8 } }), [4.6, -4.2], -66, [3.2, -4.9]);
const PUSH = lever(stance(1.0, 0.8, 18, -1.3, 1.9), [4.4, -6.2], [3.0, -6.9]);
const PUSH2 = lever(stance(1.2, 0.9, 22, -1.3, 2.0), [4.9, -5.8], [3.5, -6.5]);
const PULL = lever(stance(-0.9, 0.9, -16, -1.7, 1.1, { head: { rot: -6 } }), [1.4, -6.2], [0.1, -6.6]);
const HAUL = lever(stance(0.2, 0.8, 4, -1.4, 1.5), [3.0, -6.4], [1.6, -7.0]);

/** Peering down the empty belt, the back hand scratching under his toque. */
const WORRY = mix(arms(grip(stance(0.4, 0.4, 8, -1.1, 1.4), [3.2, -5.4], -160), [-0.6, -12.2], null), {
  head: { rot: 6 },
});
const WORRY2 = mix(arms(grip(stance(0.4, 0.4, 8, -1.1, 1.4), [3.2, -5.4], -160), [-0.2, -12.6], null), {
  head: { rot: 2 },
});

/** Standing by the oven with the peel upright in his front hand. */
const BY_OVEN = grip(stance(0.1, 0.3, 2, -1.1, 1.3), [3.2, -5.6], -172, [-2.0, -4.0]);

/** The back hand down behind him with a topping, then flung up and forward to lob it. */
const wind = (scale: number): Pose =>
  propAt(
    arms(grip(stance(-0.5, 0.7, -10, -1.4, 1.2), [3.0, -5.6], -172), [-3.4, -4.2], null),
    [-3.6, -3.4],
    30,
    [scale, scale],
  );
const LOB = arms(
  grip(stance(0.7, 0.2, 10, -1.0, 1.6, { head: { rot: -12 } }), [3.2, -5.8], -172),
  [3.9, -12.2],
  null,
);

/** Fanning the fire beside the oven's back: the peel swung upright, then out over the dome. */
const FAN_UP = grip(stance(0.2, 0.5, 4, -1.2, 1.4), [2.6, -7.4], -174, [-1.8, -5.0]);
const FAN_OUT = grip(stance(0.6, 0.8, 12, -1.2, 1.6), [3.2, -6.8], -134, [-1.8, -5.0]);

/** Crouched over the peel, both hands low on the handle, then sprung up with it held high: "order up!" */
const GATHER = grip(stance(0.1, 1.5, 8, -1.5, 1.5, { head: { rot: 6 } }), [2.8, -4.4], -172, [1.7, -4.0]);
const TADA = both(
  stance(0.3, -0.3, -6, -1.1, 1.3, { head: { rot: -10 }, hat: { rot: -10 } }),
  [1.6, -10.6],
  -172,
);
/** Flinching from the blast, the peel flung back behind him. */
const RECOIL = grip(
  stance(-1.0, 0.5, -18, -1.6, 1.0, { head: { rot: -14 } }),
  [-1.2, -7.8],
  100,
  [-2.6, -7.0],
);
/** Pleased with himself: the peel upright at his side, the back hand on his hip, chest out. */
const PROUD = grip(stance(0, 0.1, -5, -1.1, 1.3, { head: { rot: -6 } }), [3.3, -5.0], -168, [-1.9, -4.4]);

const GRIN: Swaps = { face: 'faceBlink', stache: 'stacheGrit' };
const WORRIED: Swaps = { face: 'faceWorried' };
const OUCH: Swaps = { face: 'faceHurt', stache: 'stacheGrit' };

/** The belt on its bone, its near end BELT.x in front of him, unrolled to `s` of its length. */
const belt = (s: number): BonePose => ({ x: BELT.x, y: 0, sx: Math.max(0.02, s), sy: 1 });
/** The flour cloud, grown to `s` along the belt and `h` high. */
const flour = (s: number, h = s): BonePose => ({
  x: FLOUR_X,
  y: 0,
  sx: Math.max(0.02, s),
  sy: Math.max(0.02, h),
});

/** Where a lobbed topping is, `t` (0-1) along its arc from the hand at `from` into the chimney, spinning. */
function arc(from: Pt, t: number, scale: number): BonePose {
  const to: Pt = [CONVEYOR.ovenX + CHIMNEY[0], CHIMNEY[1] - 1.2];
  const peak = Math.min(from[1], to[1]) - 4.5;
  const x = from[0] + (to[0] - from[0]) * t;
  const y = (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * (2 * peak - (from[1] + to[1]) / 2) + t ** 2 * to[1];
  return { x, y, rot: 40 + t * 420, sx: scale, sy: scale };
}

/** The lob's keys: the topping leaves the hand on `toss` and drops into the chimney on `lands`. */
function lob(toss: number, lands: number, symbol: string, scale: number, base: Swaps): Key[] {
  const from: Pt = [4.0, -13.0];
  const keys: Key[] = [];
  for (let f = toss; f < lands; f += 2) {
    const t = (f - toss) / (lands - toss);
    keys.push(
      key(f, mix(LOB, { fx2: arc(from, t, scale) }), {
        ease: 'linear',
        ...(f === toss && { swaps: { ...base, fx2: symbol }, z: BACK_ARM_FRONT }),
      }),
    );
  }
  keys.push(key(lands, BY_OVEN, { ease: 'inOut', swaps: base, z: {} }));
  return keys;
}

const ACTIVE_BELT = { fxBack: 'beltStill' };

function activation(): AnimClip {
  const [jolt, last] = [CONVEYOR.jolt[0], CONVEYOR.catch[1]];
  return {
    length: CONVEYOR.faf - 1,
    active: [CONVEYOR.jolt, CONVEYOR.catch],
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(5, RAISE_LOW, { ease: 'out', swaps: GRIT }),
      key(11, RAISE, { ease: 'in' }),
      key(13, mix(SLAM, { fx1: smear([4.6, -4.2], -66, true, 1.1) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh' },
      }),
      key(14, mix(SLAM, { fx3: belt(0.12) }), { ease: 'out', swaps: { ...SHOUT, ...ACTIVE_BELT } }),
      key(17, mix(SLAM, { fx3: belt(0.62) }), { ease: 'out' }),
      key(20, mix(SLAM, { fx3: belt(1.04) }), { ease: 'inOut' }),
      key(21, mix(SLAM, { fx3: belt(1), fx1: flour(0.35, 0.5) }), {
        ease: 'out',
        swaps: { ...GRIT, ...ACTIVE_BELT, fx1: 'flour' },
      }),
      key(jolt - 1, mix(PUSH, { fx3: belt(1), fx1: flour(1) }), { ease: 'out' }),
      key(jolt, mix(PUSH2, { fx3: belt(1), fx1: flour(1.02) }), {
        ease: 'inOut',
        swaps: { ...SHOUT, fxBack: 'beltFwd', fx1: 'flour' },
      }),
      key(31, mix(PUSH, { fx3: belt(1), fx1: flour(1, 1.05) }), {
        ease: 'inOut',
        swaps: { ...GRIT, fxBack: 'beltFwd', fx1: 'flour' },
      }),
      key(37, mix(PUSH2, { fx3: belt(1), fx1: flour(1.02, 1) }), { ease: 'inOut' }),
      key(43, mix(PUSH, { fx3: belt(1), fx1: flour(1) }), { ease: 'in' }),
      key(CONVEYOR.catch[0], mix(PULL, { fx3: belt(1), fx1: flour(1, 1.04) }), {
        ease: 'out',
        swaps: { ...SHOUT, fxBack: 'beltBack', fx1: 'flour' },
      }),
      key(last, mix(PULL, { fx3: belt(1), fx1: flour(1) }), { ease: 'inOut' }),
      key(53, mix(WORRY, { fx3: belt(1), fx1: flour(0.95, 0.4) }), {
        ease: 'inOut',
        swaps: { ...WORRIED, ...ACTIVE_BELT, fx1: 'flour' },
        z: BACK_ARM_FRONT,
      }),
      key(54, undefined, { swaps: { ...WORRIED, ...ACTIVE_BELT } }),
      key(64, mix(WORRY2, { fx3: belt(1) }), { ease: 'inOut' }),
      key(74, mix(WORRY, { fx3: belt(1) }), { ease: 'inOut' }),
      key(84, mix(WORRY2, { fx3: belt(1) }), { ease: 'inOut' }),
      key(92, mix(WORRY, { fx3: belt(1) }), { ease: 'in', z: {} }),
      key(102, mix(STAND, { fx3: belt(0.03) }), { ease: 'inOut' }),
      key(103, undefined, { swaps: { fxBack: null } }),
      key(CONVEYOR.faf - 1, STAND, { swaps: {} }),
    ],
  };
}

function cinematic(): AnimClip {
  const { inOven, blast } = CONVEYOR;
  const p = TOPPINGS.pepper;
  const c = TOPPINGS.cheese;
  const rolling = { ...GRIT, fxBack: 'beltBack' };
  const still = { ...GRIT, ...ACTIVE_BELT };
  const b = { fx3: belt(1) };
  return {
    length: CONVEYOR.cinematicFaf - 1,
    active: [[blast, blast]],
    swaps: ANGRY,
    keys: [
      key(0, mix(PULL, b, { fx1: flour(1) }), { ease: 'inOut', swaps: { ...rolling, fx1: 'flour' } }),
      key(5, mix(HAUL, b, { fx1: flour(0.9, 0.35) }), { ease: 'inOut' }),
      key(6, undefined, { swaps: rolling }),
      key(10, mix(PULL, b), { ease: 'inOut' }),
      key(15, mix(HAUL, b), { ease: 'inOut' }),
      key(20, mix(PULL, b), { ease: 'inOut' }),
      key(24, mix(BY_OVEN, b), { ease: 'inOut', swaps: still }),
      key(inOven, mix(BY_OVEN, b, { body: { y: -0.4 } }), {
        ease: 'out',
        swaps: { ...GRIN, ...ACTIVE_BELT },
      }),
      key(p.toss - 6, mix(wind(PEPPER_SCALE), b), {
        ease: 'inOut',
        swaps: { ...still, prop: 'pepperBomb', handB: 'fist' },
        z: BACK_ARM_FRONT,
      }),
      ...lob(p.toss, p.lands, 'pepperBomb', PEPPER_SCALE, still).map((k) => ({
        ...k,
        pose: k.pose && mix(k.pose, b),
      })),
      key(c.toss - 6, mix(wind(1.25), b), {
        ease: 'inOut',
        swaps: { ...still, prop: 'shaker', handB: 'fist' },
        z: BACK_ARM_FRONT,
      }),
      ...lob(c.toss, c.lands, 'shaker', 1.25, still).map((k) => ({ ...k, pose: k.pose && mix(k.pose, b) })),
      key(c.lands + 1, undefined, { swaps: { ...GRIN, ...ACTIVE_BELT } }),
      ...[70, 76, 82, 88, 94].map((f, i) =>
        key(f, mix(i % 2 ? FAN_OUT : FAN_UP, b), { ease: 'inOut', ...(i === 0 && { swaps: still }) }),
      ),
      key(blast - 9, mix(GATHER, b), { ease: 'out' }),
      key(blast - 3, mix(GATHER, b, { body: { y: 0.3 } }), { ease: 'in' }),
      key(blast, mix(TADA, b), { ease: 'out', swaps: { ...SHOUT, ...ACTIVE_BELT } }),
      key(blast + 6, mix(RECOIL, b), { ease: 'inOut', swaps: { ...OUCH, ...ACTIVE_BELT } }),
      key(118, mix(RECOIL, b), { ease: 'inOut' }),
      key(122, mix(PROUD, { fx3: belt(0.7) }), { ease: 'in', swaps: { ...GRIN, ...ACTIVE_BELT } }),
      key(128, mix(PROUD, { fx3: belt(0.03) }), { ease: 'inOut' }),
      key(129, undefined, { swaps: GRIN }),
      key(CONVEYOR.cinematicFaf - 1, STAND, { swaps: {} }),
    ],
  };
}

export const finalSmashClips: Record<string, AnimClip> = {
  /** Conveyor Oven's activation: FAF 120, House of Boom's 119 frames. */
  finalSmash: unwrap(plant(unwrap(activation()))),
  /** Conveyor Oven's cinematic, keyed on the blast. */
  finalSmashCinematic: unwrap(plant(unwrap(cinematic()))),
};
