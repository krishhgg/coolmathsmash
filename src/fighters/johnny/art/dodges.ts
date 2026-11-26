import type { Pose } from '../../../render/rig/author';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip, Key } from '../../../render/rig/types';
import { ROLL_FORWARD, SPOT_DODGE } from '../../../sim/constants';
import {
  AIR,
  BACK_ARM_OVER_HEAD,
  FISTS,
  GRIT,
  GUARD,
  PALM_B,
  PALM_F,
  PIVOT,
  SHOUT,
  SMIRK,
  STANCE,
  aloft,
  feet,
  fist,
  hands,
  key,
  mix,
  onFloor,
  shortTurns,
  somersault,
} from './poses';

/**
 * Johnny's dodges on the shared timings (src/sim/constants.ts): each ground clip lasts the action's FAF - 1 frames.
 * The sim moves him through a roll, so the clips only turn him; they never slide him along the floor. His back roll
 * is drawn with the tech and getup rolls (tech.ts), which are built from it.
 */

const IDLE_FEET = { footF: { sx: -1 } };

/**
 * Spot dodge: he drops into a deep bow-legged squat and sways his head and shoulders back out of the way, both
 * fists pulled in by his hips, then rises back into his guard.
 */
function duck(sink: number, lean: number, head: number): Pose {
  return hands(
    mix(
      feet(
        {
          hip: { y: sink },
          body: { rot: -lean, x: -0.05 * lean },
          torso: { rot: -4 },
          neck: { y: 0.6, rot: -head },
        },
        [3.6, 0],
        [-3.4, 0],
      ),
      IDLE_FEET,
    ),
    [3.0, -5.4],
    [-4.6, -5.6],
    1,
    -1,
  );
}
const DUCK = duck(2.4, 22, 16);
/** Still low, rocking forward a little as the hit goes past. */
const DUCK_SWAY = duck(2.2, 15, 8);
/** Rising out of it, the weight coming back over both boots. */
const DUCK_RISE = duck(1.2, 4, -2);

/** Ducking into the roll: low, chin tucked, arms reaching ahead. */
const DIVE = hands(
  mix(
    feet({ hip: { y: 2.6 }, body: { rot: 24 }, neck: { y: 0.6, rot: 10 } }, [2.6, 0], [-2.8, 0]),
    IDLE_FEET,
  ),
  [6.4, -4.2],
  [4.6, -3.6],
  1,
  1,
);

/** Coming out of a roll: crouched on both boots, fists down for balance. */
const UNROLL = hands(
  mix(feet({ hip: { y: 2.2 }, body: { rot: 12 }, neck: { y: 0.4 } }, [3.2, 0], [-3.0, 0]), IDLE_FEET),
  [5.2, -4.4],
  [-1.0, -4.0],
  1,
  -1,
);

/**
 * The air dodge's corkscrew: pulled into a pencil, forearms crossed over his goggles, boots together and toes
 * pointed. The clip turns it on the spot by squashing `body` through its width, the Flash way of turning a flat
 * drawing round.
 */
const PENCIL = fist(
  fist(
    mix(AIR, {
      neck: { y: 0.6, rot: 10 },
      armF: { x: 0.4, y: -0.4 },
      armB: { x: -0.4, y: -0.4 },
      thighF: { rot: 4 },
      shinF: { rot: 10 },
      thighB: { rot: -4 },
      shinB: { rot: 12 },
      footF: { rot: 50 },
      footB: { rot: 46 },
    }),
    'F',
    [2.8, -12.2],
    1.2,
    1,
  ),
  'B',
  [-0.4, -12.6],
  1.2,
  -1,
);

/** One key a frame from `start` to `end` turning the pencil once round: its width goes 1, -1, 1. */
function corkscrew(start: number, end: number): Key[] {
  const keys: Key[] = [];
  for (let f = start; f <= end; f++) {
    const c = Math.cos((2 * Math.PI * (f - start)) / (end - start));
    const sx = Math.sign(c || 1) * Math.max(0.2, Math.abs(c));
    keys.push(key(f, aloft(mix(PENCIL, { body: { sx, rot: -6 * c } })), { ease: 'linear' }));
  }
  return keys;
}

/** Opening out of the twist, arms flung wide, legs dropping for the fall. */
const OPEN = aloft(
  hands(
    mix(AIR, {
      body: { rot: 6 },
      neck: { rot: -6 },
      thighF: { rot: -30 },
      shinF: { rot: 50 },
      thighB: { rot: 10 },
      shinB: { rot: 40 },
    }),
    [8.2, -12.6],
    [-6.6, -12.0],
    -1,
    1,
  ),
);

/** Close to fall's first drawing (`flap` in clips.ts), so the air dodge runs into it: arms up and spread, palms open. */
const FALL_START = aloft(
  hands(
    mix(AIR, {
      torso: { rot: -2 },
      neck: { rot: 2 },
      thighF: { rot: 16 },
      shinF: { rot: 34 },
      thighB: { rot: -26 },
      shinB: { rot: 30 },
    }),
    [7.6, -12.4],
    [-6.4, -12.4],
    -1,
    1,
  ),
);

export const dodges: Record<string, AnimClip> = {
  spotDodge: onFloor({
    length: SPOT_DODGE.faf - 1,
    swaps: { ...GRIT, ...GUARD },
    keys: [
      key(0, STANCE, { ease: 'out' }),
      key(3, DUCK, { ease: 'inOut', swaps: { ...SMIRK, ...FISTS } }),
      key(11, DUCK_SWAY, { ease: 'inOut' }),
      key(17, DUCK, { ease: 'inOut' }),
      key(21, DUCK_RISE, { ease: 'out', swaps: { ...GRIT, ...FISTS } }),
      key(SPOT_DODGE.faf - 1, STANCE, { swaps: {} }),
    ],
  }),

  rollForward: onFloor({
    length: ROLL_FORWARD.faf - 1,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns([
      key(0, STANCE, { ease: 'in' }),
      key(3, DIVE, { ease: 'in' }),
      ...somersault(5, 18, 0, 360),
      key(21, mix(UNROLL, { body: { rot: 372 } }), { ease: 'out' }),
      key(23, mix(PIVOT, { body: { rot: 360, sx: 0.92 } }), { ease: 'step' }),
      key(24, mix(PIVOT, { body: { rot: 360, sx: -0.92 } }), { ease: 'out', swaps: { ...GRIT, ...GUARD } }),
      key(ROLL_FORWARD.faf - 1, mix(STANCE, { body: { rot: 360, sx: -1 } })),
    ]),
  }),

  airDodge: {
    length: 46,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, OPEN, { ease: 'out' }),
      key(3, aloft(PENCIL), { ease: 'linear', z: BACK_ARM_OVER_HEAD }),
      ...corkscrew(4, 24),
      key(29, aloft(mix(PENCIL, { body: { rot: -4 } })), { ease: 'out' }),
      key(34, OPEN, { ease: 'inOut', swaps: { ...SHOUT, ...PALM_F, ...PALM_B }, z: {} }),
      key(46, FALL_START, { swaps: { ...GRIT, ...PALM_F, ...PALM_B } }),
    ],
  },
};

/**
 * The air dodge, drawn over the old 46-frame neutral dodge, on the current 52 (AIR_DODGE_NEUTRAL): keys inside the
 * intangible window (3 to 29) stay put and only the recovery after it stretches. A directional dodge plays the same
 * clip over its own length.
 */
dodges.airDodge = retimeClip(dodges.airDodge!, 52, [[29, 29]]);
