import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import {
  AIR,
  ANGRY,
  ARMS_OVER_HEAD,
  BACK_ARM_IN_FRONT,
  BATON,
  CROUCH,
  DOWN,
  FRONT_ARM_OVER_HEAD,
  GRIN,
  HURT,
  READY,
  SACK,
  SACK_IN_FRONT,
  SHOUT,
  SIDE,
  TUCK,
  aim,
  continuous,
  feet,
  floor,
  floorContact,
  fx,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Attack clips, keyed on Bob's frame data in `../moves.ts` and `../specials.ts`: frame 1 is the move's first
 * frame, the clip ends at FAF - 1, and `active` repeats the move's hit windows (or its throw or pummel frame), so
 * the renderer's retiming (`src/render/rig/timing.ts`) plays them frame for frame. On every active frame the
 * baton, the sack, a hand, the hook or the swing's smear reaches into each hitbox (`index.test.ts` checks).
 */

/** Holds the night-stick in the front fist at `wrist`, pointing `deg` (0 forward, -90 up, 90 down). */
export const swing = (pose: Pose, wrist: Pt, deg: number, bend: 1 | -1 = 1): Pose =>
  aim(hands(pose, null, wrist, bend), 'baton', deg);

/** Stretches the front arm so the wrist reaches `wrist` from where the shoulder is in `pose`. */
export function reachF(pose: Pose, wrist: Pt, slack = 1): Pose {
  const [sx, sy] = pointOf(rig, pose, 'armF');
  const k = Math.max(1, (Math.hypot(wrist[0] - sx, wrist[1] - sy) * slack) / 2.68);
  return mix(pose, { armF: { sy: k }, foreF: { sy: k } });
}

/** Stretches the back arm the same way, for the sack. */
export function reachB(pose: Pose, wrist: Pt): Pose {
  const [sx, sy] = pointOf(rig, pose, 'armB');
  const k = Math.max(1, Math.hypot(wrist[0] - sx, wrist[1] - sy) / 2.68);
  return mix(pose, { armB: { sy: k }, foreB: { sy: k } });
}

/**
 * A swing smear on the `fxS` bone: pivot, leading edge angle, radius; `back` mirrors it for upward swings, and
 * `squash` flattens it across the swing for a sweep round the body along the floor.
 */
const smearAt = (pivot: Pt, deg: number, radius: number, back = false, squash = 1) => ({
  fxS: fx(pivot[0], pivot[1], deg, radius, (back ? -radius : radius) * squash),
});

/**
 * A smear from the grip's shoulder that reaches the baton's tip in `pose`: the arc a Flash animator draws behind
 * a swing, trailing back from the leading edge.
 */
export function trail(pose: Pose, back = false, extra = 0.3, squash = 1): Pose {
  const pivot = pointOf(rig, pose, 'armF');
  const [tx, ty] = pointOf(rig, pose, 'baton', 7.5, 0);
  const deg = (Math.atan2(ty - pivot[1], tx - pivot[0]) * 180) / Math.PI;
  return mix(pose, smearAt(pivot, deg, Math.hypot(tx - pivot[0], ty - pivot[1]) + extra, back, squash));
}

export const STANCE = feet(
  { body: { rot: 6 }, hip: { y: 0.45 }, neck: { rot: -4 } },
  floor(-1.8),
  floor(1.8),
);
export const LUNGE = feet(
  { body: { rot: 14, x: 1.0 }, hip: { y: 0.8 }, neck: { rot: -8 } },
  floor(-2.6),
  floor(2.6),
  false,
  [30, 0],
);
/** Crouched low over the front foot, the back shoe on tiptoe with its toe resting on the floor. */
const LOW = feet(
  { body: { rot: 22, x: 0.6 }, hip: { y: 1.7 }, neck: { rot: -14, y: 0.2 } },
  floor(-2.4, -0.86),
  floor(2.2),
  false,
  [35, 0],
);
export const BATON_READY = swing(STANCE, [2.6, -5.8], -60);

/**
 * STANCE turned or shifted by `lean`, with the feet planted again. Mixing a body turn into a stance after its feet
 * were solved swings the legs with the body and sinks a shoe into the floor.
 */
const stanceWith = (lean: Pose) => feet(mix(STANCE, lean), floor(-1.8), floor(1.8));

/** How far to lift the ankle of a shoe pitched 30 degrees onto tiptoe so its toe rests on the floor. */
const TIPTOE = 0.75;

/**
 * LUNGE turned or shifted by `lean`, front foot planted again and the back foot on tiptoe at `back`, where the
 * stretched back leg still reaches.
 */
const lungeWith = (lean: Pose, back: number) =>
  feet(mix(LUNGE, lean), floor(back, -TIPTOE), floor(2.6), false, [30, 0]);

/** LOW turned or shifted by `lean`, with the feet planted again. */
const lowWith = (lean: Pose) => feet(mix(LOW, lean), floor(-2.4, -0.86), floor(2.2), false, [35, 0]);

/** READY turned or shifted by `lean`, with the feet planted again. */
const readyWith = (lean: Pose) => feet(mix(READY, lean), floor(-1.6), floor(1.5));

/**
 * CROUCH turned or shifted by `lean`, with the feet planted again and both knees bent forward as in his stances.
 * CROUCH bows the back knee out, so a tween from a stance flips that leg through straight and sinks the shoe.
 */
const crouchWith = (lean: Pose) => feet(mix(CROUCH, lean), floor(-1.5), floor(1.6));

/**
 * Adds a spin to keys made with the baton held still: `spin` gives the degrees it adds on each of its keys, and
 * every key after the last of them keeps `wound`, the whole turns it leaves, so the baton carries on round instead
 * of unwinding. `continuous` would fold each half turn back the short way, so the spin goes on after it.
 */
const spun = (keys: Key[], spin: Record<number, number>, wound: number): Key[] => {
  const end = Math.max(...Object.keys(spin).map(Number));
  return keys.map((k) => {
    const deg = spin[k.frame] ?? (k.frame > end ? wound : 0);
    return k.pose && deg ? { ...k, pose: mix(k.pose, { baton: { rot: k.pose.baton!.rot! + deg } }) } : k;
  });
};

/** The opponent held by the collar at the front fist, the body turned or shifted by `lean`. */
const holdWith = (lean: Pose) =>
  hands(
    feet(mix({ body: { rot: 6 }, hip: { y: 0.45 } }, lean), floor(-1.8), floor(1.6)),
    [0.6, -5.4],
    [4.6, -7.2],
    -1,
  );
const HOLD = holdWith({});

/**
 * Upright poses for turning edge-on to the camera. Squashing a leaning body across tips one foot down through the
 * floor and lifts the other off it; squashing an upright one leaves both feet where they are.
 */
const UPRIGHT = { body: { rot: 0 } };

export const strikeKey = (
  frame: number,
  pose: Pose,
  swaps: Key['swaps'],
  extra: Omit<Key, 'frame' | 'pose' | 'swaps'> = {},
) => key(frame, pose, { ease: 'linear', swaps, ...extra });

// Jab: poke, second poke, overhead bonk ----------------------------------------------------------------------

const JAB_BACK = swing(STANCE, [1.8, -5.4], -16);
const JAB_POKE = swing(stanceWith({ body: { rot: 4, x: 0.6 } }), [4.9, -6.3], -10);
/** A short pull back under the first poke, elbow dropped, for the second poke to come up from. */
const JAB2_WIND = swing(STANCE, [3.2, -5.2], 20, -1);
const JAB2_POKE = swing(stanceWith({ body: { rot: 5, x: 0.8 } }), [4.9, -5.9], -6, -1);
const JAB3_UP = swing(stanceWith({ body: { rot: -6 } }), [1.0, -9.6], -115);
const JAB3_BONK = swing(lungeWith({ body: { rot: 18, x: 0.9 } }, -2.6), [4.0, -9.2], 18);

// Tilts ----------------------------------------------------------------------------------------------------

const FTILT_BACK = swing(stanceWith({ body: { rot: -4 } }), [-0.2, -6.2], -165);
const FTILT_HIT = reachF(swing(lungeWith({ body: { rot: 6 } }, -2.6), [5.2, -6.4], -8), [5.2, -6.4]);
const FTILT_FOLLOW = swing(lungeWith({ body: { rot: 12 } }, -2.2), [3.4, -6.0], 50);

const UTILT_UP = (deg: number) =>
  reachF(swing(stanceWith({ body: { rot: -4 } }), [1.8, -10.4], deg), [1.8, -10.4]);
const UTILT_FINISH = reachF(swing(stanceWith({ body: { rot: -8 } }), [2.2, -11.2], -80), [2.2, -11.2]);
/** Holding the finish with the fist forward of his hat, so the baton is clear of his head as it goes behind it. */
const UTILT_REST = trail(
  reachF(swing(stanceWith({ body: { rot: -8 } }), [4.8, -10.2], -75), [4.8, -10.2]),
  true,
);
/** The twirl's blur over his head, at `size`. */
const TWIRL = (size: number) => ({ fx4: fx(1.8, -10.6, 0, size) });
/** Degrees the twirl adds to the baton on its keys: it spins counterclockwise, a half turn every two frames. */
const UTILT_SPIN: Record<number, number> = { 5: -90, 7: -270, 9: -450, 11: -630, 13: -810 };
/** Whole turns the baton keeps after the twirl, so the finishing stroke carries on round and nothing unwinds. */
const UTILT_WOUND = -1080;

const DTILT_BACK = swing(LOW, [1.0, -3.0], 166, -1);
/** Halfway round the sweep the baton points at the viewer, so it is drawn short instead of through the floor. */
const DTILT_MID = mix(swing(LOW, [2.4, -2.6], 90, -1), { baton: { sx: 0.3 } });
const DTILT_HIT = swing(LOW, [3.6, -2.5], 6, -1);
const DTILT_SWEEP = trail(DTILT_HIT, true, 0.3, 0.25);

// Dash attack: the loot sack swung forward out of the run -----------------------------------------------------

/** Skidding low out of the run: back shoe on tiptoe, front heel down, both resting on the floor. */
const SLIDE = feet(
  { body: { rot: 18, x: 1.2 }, hip: { y: 1.3 }, neck: { rot: -10 } },
  floor(-2.8, -0.95),
  floor(2.8, -0.11),
  false,
  [40, -15],
);
/** SLIDE turned or shifted by `lean`, with the feet planted again. */
const slideWith = (lean: Pose) =>
  feet(mix(SLIDE, lean), floor(-2.8, -0.95), floor(2.8, -0.11), false, [40, -15]);
const DASH_WIND = aim(hands(SLIDE, [-2.6, -7.4], [2.4, -5.4]), 'sackH', 130);
const DASH_HIT = aim(reachB(hands(SLIDE, [5.0, -5.9], [2.6, -4.4]), [5.0, -5.9]), 'sackH', -84);
const DASH_LATE = aim(reachB(hands(SLIDE, [4.7, -5.5], [2.6, -4.4]), [4.7, -5.5]), 'sackH', -66);
/** Standing out of the slide, back foot still back, for the swing over his head. */
const RISEN = feet(STANCE, floor(-2.4), floor(1.8));
/** The arm flung forward and up, sack and all, clear of his face on its way over. */
const DASH_UP = aim(reachB(hands(RISEN, [6.4, -9.0], null), [6.4, -9.0]), 'sackH', -100);
/** The sack held up over his hat. */
const DASH_OVER = aim(reachB(hands(RISEN, [0.4, -13.6], null), [0.4, -13.6]), 'sackH', -140);
/**
 * The sack come down over his head and hanging behind it from his raised back hand, clear of his head and body, so
 * it can go behind his back without jumping.
 */
const DASH_SLUNG = aim(hands(RISEN, [-4.4, -6.6], null), 'sackH', 80);

// Smashes ----------------------------------------------------------------------------------------------------

const FSMASH_WIND = hands(
  swing(stanceWith({ body: { rot: -12, x: -0.6 }, neck: { rot: 6 } }), [-0.8, -9.8], -165),
  [-0.4, -9.4],
  null,
);
/** Baton straight up over the head; the back hand has let go and swings forward with the stroke. */
const FSMASH_TOP = aim(swing(stanceWith({ body: { rot: 2 } }), [1.6, -10.6], -90), 'armB', -80);
const FSMASH_HIT = reachF(swing(lungeWith({ body: { rot: 8, x: 1.6 } }, -1.6), [6.2, -6.9], -8), [6.2, -6.9]);
/** The stroke carries on down until the tip nearly touches the floor in front of him. */
const FSMASH_FOLLOW = swing(lungeWith({ body: { rot: 20, x: 1.4 } }, -2.2), [4.2, -5.8], 45);

/** Crouched for the spin, the baton forward and low with its tip clear of the floor. */
const USMASH_LOW = swing(crouchWith({ body: { rot: 4 } }), [2.6, -3.6], 20);
const USMASH_HAND: Pt = [0.8, -12.2];
const USMASH_UP = (deg: number) =>
  reachF(swing(stanceWith({ body: { rot: -2 }, hip: { y: 0.2 } }), USMASH_HAND, deg), USMASH_HAND);
const ROTOR = { fx4: fx(USMASH_HAND[0], USMASH_HAND[1] - 0.6, 0, 6.8) };
/**
 * Degrees the rotor adds to the baton on its keys: counterclockwise, 100 a frame from the moment it is up. Faster
 * than half a turn a frame, the eye reads a spin as going backwards.
 */
const USMASH_SPIN: Record<number, number> = { 10: -100, 12: -300, 14: -500, 16: -700, 18: -900, 20: -1100 };
/** Whole turns the baton keeps after the spin, so it stops straight up instead of unwinding. */
const USMASH_WOUND = -1080;

const DSMASH_HIT = swing(lowWith({ body: { rot: 26 } }), [3.6, -2.2], 4, -1);
const DSMASH_WIND = swing(lowWith({ body: { rot: 10 } }), [1.4, -4.6], -40, -1);

// Aerials ----------------------------------------------------------------------------------------------------

const NAIR_POSE = swing(
  mix(AIR, { thighF: { rot: -70 }, shinF: { rot: 90 }, thighB: { rot: -40 }, shinB: { rot: 80 } }),
  [4.0, -7.4],
  0,
);
const SPIN = { fx4: fx(0, -6.4, 0, 9.4) };

const FAIR_UP = swing(AIR, [0.6, -10.6], -120);
const FAIR_HIT = reachF(swing(mix(AIR, { body: { rot: 12 } }), [5.2, -9.4], 35), [5.2, -9.4]);
const FAIR_FOLLOW = swing(mix(AIR, { body: { rot: 14 } }), [3.8, -6.0], 85);

/** Back air: Bob twists round (body mirrored) and swings behind him. */
const turned = (pose: Pose): Pose => {
  const out = mix(pose, { body: { sx: -1, x: -(pose.body?.x ?? 0), rot: -(pose.body?.rot ?? 0) } });
  for (const bone of ['fx1', 'fx2', 'fx3', 'fx4', 'fxS']) {
    const p = pose[bone];
    if (p) out[bone] = { ...p, x: -(p.x ?? 0), rot: -(p.rot ?? 0), sx: -(p.sx ?? 1) };
  }
  return out;
};
const BAIR_WIND = swing(AIR, [-0.6, -8.0], -160);
const BAIR_HIT = reachF(swing(mix(AIR, { body: { rot: 8 } }), [4.6, -7.6], 0), [4.6, -7.6]);

const UAIR_FRONT = swing(AIR, [3.0, -8.4], -20);
const UAIR_TOP = (deg: number) =>
  reachF(swing(mix(AIR, { body: { rot: -6 } }), [0.8, -11.0], deg), [0.8, -11.0]);

const DAIR_TUCK = mix(TUCK, { hip: { y: -1.0 }, thighF: { rot: -110 }, thighB: { rot: -85 } });
const DAIR_UP = aim(hands(DAIR_TUCK, [-1.6, -9.6], [-0.6, -10.0]), 'sackH', 125);
const DAIR_HIT = aim(hands(DAIR_TUCK, [0.9, -4.6], [1.6, -4.8], -1), 'sackH', 0);

// Grabs and throws --------------------------------------------------------------------------------------------

const reachBoth = (pose: Pose, f: Pt, b: Pt): Pose => {
  const [sx, sy] = pointOf(rig, pose, 'armB');
  const k = Math.max(1, Math.hypot(b[0] - sx, b[1] - sy) / 2.68);
  return hands(reachF(mix(pose, { armB: { sy: k }, foreB: { sy: k } }), f), b, f, -1);
};

/** Both fists drawn back to his shoulders for the grab. */
const GRAB_WIND = hands(stanceWith({ body: { rot: -4 } }), [0.0, -7.2], [1.6, -7.6]);
const GRAB_REACH = reachBoth(lungeWith({ body: { rot: 16 } }, -2.6), [6.0, -7.4], [5.2, -6.8]);
const PIVOT_REACH = reachBoth(lungeWith({ body: { rot: 18, x: 1.4 } }, -2.2), [6.8, -7.4], [6.2, -6.8]);
const FTHROW = reachBoth(lungeWith({ body: { rot: 18, x: 1.4 } }, -2.2), [6.2, -7.8], [5.6, -6.4]);
/** Stretched up on his toes under the throw. */
const UTHROW_REACH = stanceWith({ body: { rot: -6, sy: 1.04 } });

// Specials ---------------------------------------------------------------------------------------------------

const HOOK_DIR = -66;
const hookAt = (pose: Pose, dist: number): Pose => {
  const [hx, hy] = pointOf(rig, pose, 'handF', 0, 0.6);
  const r = (HOOK_DIR * Math.PI) / 180;
  const tip: Pt = [hx + Math.cos(r) * dist, hy + Math.sin(r) * dist];
  return mix(pose, {
    fx1: fx(tip[0], tip[1], HOOK_DIR),
    fx2: fx(hx, hy, HOOK_DIR, Math.max(0.01, dist - 0.8), 1),
  });
};
const HOOK_THROW = reachF(hands(mix(AIR, { body: { rot: -10 } }), [-1.0, -6.0], [3.0, -10.6]), [3.0, -10.6]);
const ZIP = reachF(
  hands(
    mix(AIR, { body: { rot: -22, sy: 1.06 }, thighF: { rot: 10 }, thighB: { rot: 20 } }),
    [-1.6, -6.6],
    [2.6, -11.4],
  ),
  [2.6, -11.4],
);

const TWIRL_POSE = (deg: number) =>
  swing(
    feet(
      { body: { rot: 8, x: 1.0 }, hip: { y: 0.6 }, neck: { rot: -6 } },
      floor(-2.6),
      floor(2.4),
      false,
      [35, 0],
    ),
    [4.6, -6.2],
    deg,
  );

/**
 * The ledge attack's low baton sweep once Bob is up on the stage, from frame `from` (`clips.ts` draws the climb
 * before it). The engine's ledge attack has no hitbox yet; the swing lands on frame 22, its last intangible frame.
 */
export const ledgeSweep = (from: number, start: Pose = swing(LOW, [2.2, -3.6], -30, -1)): Key[] => [
  key(from, aim(start, 'baton', -30), { ease: 'out', swaps: { ...ANGRY, ...BATON } }),
  // Held back until the sweep: tweened over three frames, the baton would swing down through the floor.
  key(18, DTILT_BACK, { ease: 'step' }),
  key(21, DTILT_MID, { ease: 'linear' }),
  strikeKey(22, DTILT_SWEEP, { ...SHOUT, ...BATON, smear: 'smear90' }),
  key(25, DTILT_SWEEP, { ease: 'out' }),
  key(31, swing(LOW, [3.0, -2.8], 22, -1), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
  // The baton is put away on the last frame; aimed up, it rises with the fist instead of dipping into the floor.
  key(55, aim(READY, 'baton', -60), { swaps: SIDE }),
];

export const attacks: Record<string, AnimClip> = {
  jab: {
    length: 19,
    active: [[4, 5]],
    swaps: { ...ANGRY, ...BATON },
    keys: continuous(
      [
        key(0, BATON_READY, { ease: 'out' }),
        key(2, JAB_BACK, { ease: 'in' }),
        strikeKey(4, JAB_POKE, { ...SHOUT, ...BATON }),
        key(5, JAB_POKE, { ease: 'inOut' }),
        key(10, swing(STANCE, [2.8, -6.8], -20), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
        key(19, BATON_READY),
      ],
      { onScreen: true },
    ),
  },
  jab2: {
    length: 19,
    active: [[3, 4]],
    swaps: { ...ANGRY, ...BATON },
    keys: continuous(
      [
        key(0, JAB_POKE, { ease: 'out' }),
        key(1, JAB2_WIND, { ease: 'in' }),
        strikeKey(3, JAB2_POKE, { ...SHOUT, ...BATON }),
        key(4, JAB2_POKE, { ease: 'inOut' }),
        key(9, swing(STANCE, [2.8, -6.2], 20, -1), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
        key(19, BATON_READY),
      ],
      { onScreen: true },
    ),
  },
  jab3: {
    length: 32,
    active: [[6, 7]],
    swaps: { ...ANGRY, ...BATON },
    keys: continuous(
      [
        key(0, JAB2_POKE, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
        key(4, JAB3_UP, { ease: 'in' }),
        strikeKey(6, trail(JAB3_BONK), { ...SHOUT, ...BATON, smear: 'smear90' }),
        key(7, trail(JAB3_BONK), { ease: 'out' }),
        // Follow through low and forward, clear of his head, so the baton goes behind it without jumping.
        key(11, swing(lungeWith({ body: { rot: 20, x: 0.9 } }, -2.6), [5.2, -5.0], 30), {
          ease: 'inOut',
          swaps: { ...ANGRY, ...BATON },
          z: {},
        }),
        key(32, BATON_READY),
      ],
      { onScreen: true },
    ),
  },
  ftilt: {
    length: 29,
    active: [[6, 8]],
    swaps: { ...ANGRY, ...BATON },
    keys: continuous(
      [
        key(0, BATON_READY, { ease: 'linear' }),
        key(4, FTILT_BACK, { ease: 'in' }),
        strikeKey(6, trail(FTILT_HIT), { ...SHOUT, ...BATON, smear: 'smear90' }),
        key(8, trail(FTILT_HIT), { ease: 'out' }),
        key(13, FTILT_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
        key(29, BATON_READY),
      ],
      { onScreen: true },
    ),
  },
  utilt: {
    length: 33,
    active: [
      [6, 7],
      [9, 10],
      [12, 13],
      [15, 17],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: spun(
      continuous(
        [
          key(0, BATON_READY, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
          key(4, mix(UTILT_UP(-120), TWIRL(5.6)), {
            ease: 'linear',
            swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' },
          }),
          ...[5, 7, 9, 11, 13].map((f) => key(f, mix(UTILT_UP(-120), TWIRL(5.6)), { ease: 'linear' })),
          strikeKey(15, mix(trail(UTILT_FINISH, true), TWIRL(5.4)), {
            ...SHOUT,
            ...BATON,
            fxBack: 'twirl',
            smear: 'smear90',
          }),
          key(17, mix(trail(UTILT_FINISH, true), TWIRL(5.0)), { ease: 'out' }),
          key(18, undefined, { swaps: { ...SHOUT, ...BATON, smear: 'smear90' } }),
          key(21, UTILT_REST, { ease: 'inOut', swaps: { ...ANGRY, ...BATON }, z: {} }),
          key(33, BATON_READY),
        ],
        { onScreen: true },
      ),
      UTILT_SPIN,
      UTILT_WOUND,
    ),
  },
  dtilt: {
    length: 23,
    active: [[6, 7]],
    swaps: { ...ANGRY, ...BATON },
    keys: continuous(
      [
        key(0, BATON_READY, { ease: 'inOut' }),
        key(4, DTILT_BACK, { ease: 'linear' }),
        key(5, DTILT_MID, { ease: 'linear' }),
        strikeKey(6, DTILT_SWEEP, { ...SHOUT, ...BATON, smear: 'smear90' }),
        key(7, DTILT_SWEEP, { ease: 'out' }),
        key(11, swing(LOW, [3.0, -2.8], 22, -1), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
        key(23, BATON_READY),
      ],
      { onScreen: true },
    ),
  },
  dashAttack: {
    length: 39,
    active: [
      [9, 12],
      [13, 20],
    ],
    swaps: { ...ANGRY, ...SACK },
    keys: continuous(
      [
        key(0, DASH_WIND, { ease: 'out' }),
        key(6, aim(DASH_WIND, 'sackH', 150), { ease: 'in' }),
        strikeKey(9, DASH_HIT, { ...SHOUT, ...SACK }, { z: { ...BACK_ARM_IN_FRONT, ...SACK_IN_FRONT } }),
        key(12, DASH_HIT, { ease: 'linear' }),
        key(20, DASH_LATE, { ease: 'inOut', swaps: { ...GRIN, ...SACK } }),
        key(22, DASH_UP, { ease: 'linear' }),
        key(24, DASH_OVER, { ease: 'inOut' }),
        key(28, DASH_SLUNG, { ease: 'inOut', z: {} }),
        key(39, aim(READY, 'sackH', 130), { swaps: { ...SIDE, sack: null } }),
      ],
      { onScreen: true },
    ),
  },
  fsmash: {
    length: 49,
    active: [[13, 15]],
    swaps: { ...ANGRY, ...BATON, handB: 'fist' },
    keys: continuous([
      // The baton goes back over his head in front of it, so it is over his head from the start.
      key(0, BATON_READY, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(8, FSMASH_WIND, { ease: 'inOut' }),
      key(9, FSMASH_WIND, { ease: 'in' }),
      key(11, FSMASH_TOP, { ease: 'linear', swaps: { ...SHOUT, ...BATON, handB: 'fist' } }),
      strikeKey(
        13,
        trail(FSMASH_HIT, false, 0.6),
        { ...SHOUT, ...BATON, handB: 'fist', smear: 'smear150' },
        { z: {} },
      ),
      key(15, trail(FSMASH_HIT, false, 0.6), { ease: 'out' }),
      key(21, FSMASH_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...BATON, handB: 'fist' } }),
      key(49, BATON_READY),
    ]),
  },
  usmash: floorContact(
    {
      length: 51,
      active: [
        [10, 11],
        [13, 14],
        [16, 17],
        [19, 20],
        [23, 25],
      ],
      swaps: { ...ANGRY, ...BATON },
      keys: spun(
        continuous(
          [
            // The baton goes up in front of his face, so it is over his head from the start.
            key(0, BATON_READY, { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
            key(6, USMASH_LOW, { ease: 'in' }),
            // The rotor blur shows from here, so it is placed over his fist here too, not left at his feet.
            key(9, mix(USMASH_UP(-60), ROTOR), {
              ease: 'linear',
              swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' },
            }),
            ...[10, 12, 14, 16, 18, 20].map((f) => key(f, mix(USMASH_UP(-60), ROTOR), { ease: 'linear' })),
            key(21, USMASH_UP(-100), { ease: 'out', swaps: { ...SHOUT, ...BATON } }),
            strikeKey(23, trail(USMASH_UP(-90), true), { ...SHOUT, ...BATON, smear: 'smear90' }),
            key(25, trail(USMASH_UP(-90), true), { ease: 'out' }),
            // The smear stays over his head until this key puts it away. Tweened toward its rest at his feet, it slid
            // through the floor on 26-28.
            key(30, trail(USMASH_UP(-80), true), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
            key(40, swing(STANCE, [2.6, -6.6], -50), { ease: 'inOut' }),
            // The baton stays over his head while it comes down past his face, and goes back under it at the end.
            key(51, BATON_READY, { z: {} }),
          ],
          { onScreen: true },
        ),
        USMASH_SPIN,
        USMASH_WOUND,
      ),
    },
    false,
  ),
  dsmash: floorContact(
    {
      length: 47,
      active: [
        [7, 8],
        [15, 16],
      ],
      swaps: { ...ANGRY, ...BATON },
      keys: continuous(
        [
          key(0, BATON_READY, { ease: 'out' }),
          key(4, DSMASH_WIND, { ease: 'in' }),
          strikeKey(7, trail(DSMASH_HIT), { ...SHOUT, ...BATON, smear: 'smear90' }),
          key(8, trail(DSMASH_HIT), { ease: 'inOut' }),
          key(10, DSMASH_HIT, { ease: 'in', swaps: { ...ANGRY, ...BATON } }),
          key(13, mix(DSMASH_WIND, { body: { sx: -0.2 } }), { ease: 'out' }),
          strikeKey(15, turned(trail(DSMASH_HIT)), { ...SHOUT, ...BATON, smear: 'smear90' }),
          key(16, turned(trail(DSMASH_HIT)), { ease: 'inOut' }),
          key(20, turned(DSMASH_HIT), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
          key(30, mix(BATON_READY, { body: { sx: -0.2 } }), { ease: 'out' }),
          key(36, BATON_READY),
          key(47, BATON_READY),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  getupAttack: floorContact(
    {
      length: 45,
      active: [
        [17, 18],
        [25, 26],
      ],
      swaps: { ...HURT, ...BATON },
      keys: continuous(
        [
          // From the pose he lies in when down, baton in hand.
          key(0, aim(DOWN, 'baton', -45), { ease: 'out' }),
          key(10, DSMASH_WIND, { ease: 'in', swaps: { ...ANGRY, ...BATON } }),
          strikeKey(17, trail(swing(LOW, [4.0, -3.2], 10, -1)), { ...SHOUT, ...BATON, smear: 'smear90' }),
          // Evenly into the turn: eased, the forearm would swing 96 degrees in one frame.
          key(18, trail(swing(LOW, [4.0, -3.2], 10, -1)), { ease: 'linear' }),
          key(21, mix(DSMASH_WIND, { body: { sx: -0.2 } }), { ease: 'out', swaps: { ...ANGRY, ...BATON } }),
          strikeKey(25, turned(trail(swing(LOW, [4.0, -3.2], 10, -1))), {
            ...SHOUT,
            ...BATON,
            smear: 'smear90',
          }),
          key(26, turned(trail(swing(LOW, [4.0, -3.2], 10, -1))), { ease: 'inOut' }),
          key(32, turned(BATON_READY), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
          key(38, mix(BATON_READY, { body: { sx: -0.2 } }), { ease: 'out' }),
          key(45, BATON_READY, { swaps: SIDE }),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  nair: {
    length: 39,
    active: [
      [5, 8],
      [9, 22],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.2], -60), { ease: 'in' }),
      key(4, NAIR_POSE, { ease: 'linear', swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' } }),
      key(5, mix(NAIR_POSE, SPIN), { ease: 'linear' }),
      key(9, mix(NAIR_POSE, SPIN, { body: { rot: 360 } }), { ease: 'linear' }),
      key(15, mix(NAIR_POSE, SPIN, { body: { rot: 720 } }), { ease: 'linear' }),
      key(22, mix(NAIR_POSE, SPIN, { body: { rot: 1080 } }), { ease: 'out', swaps: { ...ANGRY, ...BATON } }),
      key(23, undefined, { swaps: { ...ANGRY, ...BATON, fxBack: null } }),
      key(30, mix(swing(AIR, [2.6, -6.4], -40), { body: { rot: 1080 } }), { ease: 'inOut' }),
      key(39, mix(AIR, { body: { rot: 1080 } }), { swaps: SIDE }),
    ],
  },
  fair: {
    length: 35,
    active: [[7, 9]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.4], -50), { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(4, FAIR_UP, { ease: 'in' }),
      strikeKey(7, trail(FAIR_HIT), { ...SHOUT, ...BATON, smear: 'smear90' }, { z: {} }),
      key(9, trail(FAIR_HIT), { ease: 'out' }),
      key(14, FAIR_FOLLOW, { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(35, mix(AIR, {}), { swaps: SIDE }),
    ],
  },
  bair: {
    length: 37,
    active: [[9, 11]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.4], -50), { ease: 'out' }),
      key(5, turned(BAIR_WIND), { ease: 'in' }),
      strikeKey(9, turned(trail(BAIR_HIT)), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(11, turned(trail(BAIR_HIT)), { ease: 'out' }),
      key(17, turned(swing(AIR, [3.4, -6.4], 40)), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(26, mix(AIR, { body: { sx: -0.2 } }), { ease: 'out' }),
      key(37, AIR, { swaps: SIDE }),
    ],
  },
  uair: {
    length: 33,
    active: [[6, 9]],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, swing(AIR, [2.4, -6.4], -40), { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
      key(3, UAIR_FRONT, { ease: 'in' }),
      strikeKey(6, trail(UAIR_TOP(-82), true), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(9, trail(UAIR_TOP(-102), true), { ease: 'out' }),
      key(14, UAIR_TOP(-150), { ease: 'inOut', swaps: { ...ANGRY, ...BATON } }),
      key(22, swing(AIR, [1.0, -8.0], -120), { ease: 'inOut', z: {} }),
      key(33, AIR, { swaps: SIDE }),
    ],
  },
  dair: {
    length: 49,
    active: [
      [14, 16],
      [17, 22],
    ],
    swaps: { ...ANGRY, ...SACK, handF: 'fist' },
    keys: [
      key(0, aim(hands(AIR, [1.0, -6.0], [2.0, -6.4]), 'sackH', 20), { ease: 'out' }),
      key(8, DAIR_UP, { ease: 'inOut' }),
      key(11, DAIR_UP, { ease: 'in' }),
      strikeKey(
        14,
        DAIR_HIT,
        { ...SHOUT, ...SACK, handF: 'fist' },
        { z: { ...BACK_ARM_IN_FRONT, ...SACK_IN_FRONT } },
      ),
      key(16, DAIR_HIT, { ease: 'linear' }),
      key(22, aim(DAIR_HIT, 'sackH', 8), { ease: 'inOut', swaps: { ...GRIN, ...SACK, handF: 'fist' } }),
      key(34, aim(hands(AIR, [1.0, -6.0], [2.0, -6.4]), 'sackH', 30), { ease: 'inOut', z: {} }),
      key(49, AIR, { swaps: SIDE }),
    ],
  },
  grab: floorContact(
    {
      length: 35,
      active: [[7, 8]],
      swaps: SIDE,
      keys: continuous(
        [
          // Evenly into the wind-up: eased, the forearms would fold 73 degrees in one frame.
          key(0, READY, { ease: 'linear' }),
          key(4, GRAB_WIND, { ease: 'in' }),
          strikeKey(7, GRAB_REACH, ANGRY),
          key(8, GRAB_REACH, { ease: 'inOut' }),
          key(16, hands(STANCE, [1.0, -6.4], [3.0, -6.8]), { ease: 'inOut', swaps: SIDE }),
          key(35, READY),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  dashGrab: floorContact(
    {
      length: 43,
      active: [[10, 11]],
      swaps: SIDE,
      keys: continuous(
        [
          key(0, readyWith({ body: { rot: 12 } }), { ease: 'out' }),
          key(6, hands(slideWith({ body: { rot: 4 } }), [0.0, -7.2], [1.6, -7.6]), { ease: 'in' }),
          strikeKey(10, reachBoth(slideWith({ body: { rot: 22, x: 1.6 } }), [6.6, -7.4], [6.0, -6.8]), ANGRY),
          key(11, reachBoth(slideWith({ body: { rot: 22, x: 1.6 } }), [6.6, -7.4], [6.0, -6.8]), {
            ease: 'inOut',
          }),
          key(20, hands(STANCE, [1.0, -6.4], [3.0, -6.8]), { ease: 'inOut', swaps: SIDE }),
          key(43, READY),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  pivotGrab: floorContact(
    {
      length: 38,
      active: [[11, 12]],
      swaps: SIDE,
      keys: continuous(
        [
          // Still facing the way he was, leaning into it. He draws his fists back evenly as he turns: in the two
          // frames after the turn, they would fold 125 degrees in one.
          key(0, turned(readyWith({ body: { rot: -10 } })), { ease: 'linear' }),
          key(5, mix(hands(stanceWith(UPRIGHT), [0.0, -7.2], [1.6, -7.6]), { body: { sx: -0.15 } }), {
            ease: 'out',
            swaps: { ...SIDE, face: 'face3qWide' },
          }),
          key(7, GRAB_WIND, { ease: 'in', swaps: SIDE }),
          strikeKey(11, PIVOT_REACH, ANGRY),
          key(12, PIVOT_REACH, { ease: 'inOut' }),
          key(20, hands(STANCE, [1.0, -6.4], [3.0, -6.8]), { ease: 'inOut', swaps: SIDE }),
          key(38, READY),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  grabHold: {
    length: 30,
    loop: true,
    swaps: { ...GRIN, handF: 'fist', handB: 'fist' },
    keys: [key(0, HOLD), key(15, mix(HOLD, { hip: { y: 0.55 }, neck: { rot: -3 } })), key(30, HOLD)],
  },
  pummel: {
    length: 6,
    active: [[1, 1]],
    swaps: { ...GRIN, handF: 'fist', handB: 'handOpen' },
    keys: [
      key(0, HOLD, { ease: 'out', z: BACK_ARM_IN_FRONT }),
      key(1, hands(HOLD, [4.4, -5.0], null, -1), { ease: 'inOut' }),
      key(3, hands(HOLD, [4.0, -4.6], null, -1), { ease: 'inOut' }),
      key(6, HOLD),
    ],
  },
  fthrow: floorContact(
    {
      length: 29,
      active: [[12, 12]],
      swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
      keys: continuous(
        [
          key(0, HOLD, { ease: 'out' }),
          key(8, hands(stanceWith({ body: { rot: -6, x: -0.4 } }), [1.6, -6.8], [2.6, -7.0], -1), {
            ease: 'in',
          }),
          strikeKey(12, FTHROW, { ...SHOUT, handF: 'handOpen', handB: 'handOpen' }),
          key(16, FTHROW, { ease: 'inOut' }),
          key(29, READY, { swaps: SIDE }),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  bthrow: floorContact(
    {
      length: 43,
      active: [[22, 22]],
      swaps: { ...ANGRY, handB: 'fist', handF: 'fist' },
      keys: continuous(
        [
          key(0, HOLD, { ease: 'out' }),
          key(8, mix(holdWith(UPRIGHT), { body: { sx: 0.2 } }), { ease: 'in' }),
          key(12, turned(swing(STANCE, [1.0, -9.8], -120)), {
            ease: 'inOut',
            swaps: { ...ANGRY, ...BATON },
            z: FRONT_ARM_OVER_HEAD,
          }),
          key(18, turned(swing(stanceWith({ body: { rot: -6 } }), [0.8, -10.0], -130)), { ease: 'in' }),
          strikeKey(22, turned(trail(JAB3_BONK)), { ...SHOUT, ...BATON, smear: 'smear90' }),
          key(24, turned(trail(JAB3_BONK)), { ease: 'out' }),
          key(30, turned(swing(lungeWith({}, -2.6), [3.4, -6.6], 50)), {
            ease: 'inOut',
            swaps: { ...GRIN, ...BATON },
          }),
          // Back under his head once the baton is clear of it, edge-on as he turns back.
          key(38, mix(swing(stanceWith(UPRIGHT), [2.6, -5.8], -60), { body: { sx: -0.2 } }), {
            ease: 'out',
            z: {},
          }),
          // The baton is put away on the last frame; aimed up, it rises with the fist instead of dipping into the
          // floor.
          key(43, aim(READY, 'baton', -60), { swaps: SIDE }),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  uthrow: floorContact(
    {
      length: 37,
      active: [[16, 16]],
      swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
      keys: continuous(
        [
          key(0, HOLD, { ease: 'out' }),
          key(8, hands(crouchWith({ body: { rot: 4 } }), [2.6, -4.4], [3.6, -4.6], -1), { ease: 'in' }),
          strikeKey(
            16,
            reachBoth(UTHROW_REACH, [1.8, -12.0], [0.6, -11.8]),
            { ...SHOUT, handF: 'handOpen', handB: 'handOpen' },
            { z: ARMS_OVER_HEAD },
          ),
          key(20, reachBoth(UTHROW_REACH, [1.8, -12.2], [0.6, -12.0]), { ease: 'inOut' }),
          key(28, hands(STANCE, [-0.4, -9.0], [2.0, -9.6]), { ease: 'inOut', swaps: GRIN, z: {} }),
          key(37, READY, { swaps: SIDE }),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  dthrow: floorContact(
    {
      length: 37,
      active: [[18, 18]],
      swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
      keys: continuous(
        [
          key(0, HOLD, { ease: 'out' }),
          key(10, hands(stanceWith({ body: { rot: -4 } }), [1.6, -9.6], [2.8, -9.8]), {
            ease: 'in',
            z: ARMS_OVER_HEAD,
          }),
          strikeKey(18, hands(lowWith({ body: { rot: 30 } }), [4.2, -1.8], [5.0, -1.6], -1), SHOUT, {
            z: {},
          }),
          key(22, hands(lowWith({ body: { rot: 28 } }), [4.2, -1.6], [5.0, -1.4], -1), {
            ease: 'inOut',
            swaps: GRIN,
          }),
          key(37, READY, { swaps: SIDE }),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  sideB: {
    length: 49,
    active: [
      [8, 9],
      [11, 12],
      [14, 15],
      [17, 18],
      [20, 21],
      [25, 27],
    ],
    swaps: { ...ANGRY, ...BATON },
    keys: [
      key(0, BATON_READY, { ease: 'out' }),
      key(5, TWIRL_POSE(-90), { ease: 'linear', swaps: { ...SHOUT, ...BATON, fxBack: 'twirl' } }),
      ...[8, 11, 14, 17, 20].map((f, i) =>
        key(f, mix(TWIRL_POSE(-90 + 240 * (i + 1)), { fx4: fx(5.4, -7.8, 0, 4.6) }), { ease: 'linear' }),
      ),
      key(22, mix(TWIRL_POSE(1350), { fx4: fx(5.4, -7.8, 0, 4.6) }), {
        ease: 'out',
        swaps: { ...SHOUT, ...BATON },
      }),
      key(24, JAB3_UP, { ease: 'in', z: FRONT_ARM_OVER_HEAD }),
      strikeKey(25, trail(JAB3_BONK), { ...SHOUT, ...BATON, smear: 'smear90' }),
      key(27, trail(JAB3_BONK), { ease: 'out' }),
      key(34, swing(mix(LUNGE, { body: { rot: 20, x: 0.9 } }), [3.6, -7.0], 45), {
        ease: 'inOut',
        swaps: { ...GRIN, ...BATON },
        z: {},
      }),
      key(49, BATON_READY),
    ],
  },
  upB: {
    length: 45,
    active: [
      [10, 11],
      [12, 13],
    ],
    swaps: { ...ANGRY, handF: 'fist', fx1: 'hook' },
    keys: [
      key(
        0,
        mix(hands(mix(AIR, { body: { rot: 6 } }), [-1.0, -6.0], [-0.6, -4.6], -1), {
          fx1: fx(-0.4, -3.6, 120),
        }),
        { ease: 'in' },
      ),
      key(
        6,
        mix(hands(mix(AIR, { body: { rot: 8 } }), [-1.0, -6.0], [-1.6, -5.0], -1), {
          fx1: fx(-1.8, -4.0, 150),
        }),
        { ease: 'in' },
      ),
      key(9, hookAt(HOOK_THROW, 1.2), {
        ease: 'linear',
        swaps: { ...SHOUT, handF: 'handOpen', fx1: 'hook', fx2: 'rope' },
        z: FRONT_ARM_OVER_HEAD,
      }),
      key(12, hookAt(HOOK_THROW, 14), { ease: 'linear' }),
      key(14, hookAt(HOOK_THROW, 20), { ease: 'out' }),
      key(16, hookAt(ZIP, 20), { ease: 'in', swaps: { ...GRIN, handF: 'fist', fx1: 'hook', fx2: 'rope' } }),
      key(30, hookAt(ZIP, 2.5), { ease: 'out' }),
      key(32, undefined, { swaps: { ...SIDE, fx1: null, fx2: null }, z: {} }),
      key(45, mix(AIR, { body: { rot: 0 } })),
    ],
  },
};
