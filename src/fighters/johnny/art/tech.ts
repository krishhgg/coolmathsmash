import type { Pose } from '../../../render/rig/author';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip } from '../../../render/rig/types';
import { GETUP_ROLL, GETUP_STAND, ROLL_BACK, TECH_IN_PLACE, TECH_ROLL } from '../../../sim/constants';
import {
  FISTS,
  FIST_B,
  GRIT,
  GUARD,
  HURT,
  PALM_F,
  SHOUT,
  SMIRK,
  STANCE,
  TUCK,
  feet,
  fist,
  grounded,
  hands,
  key,
  leg,
  mix,
  onFloor,
  shortTurns,
  somersault,
  tuck,
} from './poses';

/**
 * Johnny on the floor: lying down after a missed tech, the techs that catch the landing, and the getups, with the
 * back roll they reuse. Each timed clip lasts its action's FAF - 1 frames (src/sim/constants.ts), and the sim moves
 * him through the rolls. A tech or getup roll away from his facing draws its `Back` clip (src/render/fighterView.ts).
 */

const IDLE_FEET = { footF: { sx: -1 } };

/**
 * Flat on his back, head behind him as at the start of the getup attack: the far knee up, the near leg flopped out
 * straight, the near arm thrown back over his head and the far one limp on the floor. `breath` lifts the chest,
 * `loll` rolls the head.
 */
function lying(breath: number, loll: number): Pose {
  const legs = leg(
    tuck(
      { body: { rot: -84, y: 5.5 }, torso: { rot: -2 * breath }, neck: { rot: loll } },
      'B',
      [5.4, -0.6],
      0,
    ),
    'F',
    [8.8, -0.9],
    -70,
  );
  return grounded(hands(legs, [-5.6, -1.0], [2.0, -4.4 - 0.3 * breath], 1, 1));
}
const DOWN = lying(0, 0);

/**
 * The superhero landing: down on the near knee, the far boot planted ahead, the near fist punched into the floor and
 * the far arm thrown out behind for balance. `lift` raises the head and chest out of it.
 */
function landing(sink: number, lift: number): Pose {
  const base = {
    hip: { y: sink },
    body: { rot: 30 - 22 * lift, x: 0.6, sx: 1.05 - 0.05 * lift, sy: 0.93 + 0.07 * lift },
    torso: { rot: 6 - 6 * lift },
    neck: { y: 0.8 - 0.5 * lift, rot: -8 - 22 * lift },
  };
  const legs = leg(feet(base, [3.8, 0], [-1.6, 0]), 'F', [-3.9, -0.5], 64, 1, 1);
  return fist(hands(legs, [-4.6, -10.0 - 1.2 * lift], null, -1, 1), 'F', [1.2, -0.9], 1.65, 1);
}
const LAND_HIT = landing(4.4, 0);
const LAND_LOOK = landing(4.0, 1);

/** Pushing up out of the landing: weight on the front boot, the back knee lifting off the floor. */
const PUSH_UP = hands(
  mix(feet({ hip: { y: 1.8 }, body: { rot: 10, x: 0.3 }, neck: { y: 0.3 } }, [3.6, 0], [-2.8, 0]), IDLE_FEET),
  [5.2, -7.0],
  [-3.6, -6.4],
  -1,
  1,
);

/** Sat up off his back, leaning on the far hand behind him, knees up. */
const SIT_UP = grounded(
  hands(
    tuck(tuck({ body: { rot: -38, y: 4.2 }, neck: { rot: 10 } }, 'B', [5.6, -0.6], 0), 'F', [4.8, -0.6], 0),
    [-2.8, -0.9],
    [1.8, -2.6],
    1,
    -1,
  ),
);

/** Boots drawn under him, crouched on his toes with a fist on the floor to push off. */
const SQUAT = hands(
  mix(
    feet({ hip: { y: 3.2 }, body: { rot: 18 }, neck: { y: 0.5, rot: -8 } }, [2.8, 0], [-2.6, 0]),
    IDLE_FEET,
  ),
  [5.4, -5.0],
  [1.6, -0.8],
  1,
  1,
);

/** Coming out of a roll: crouched on both boots, fists down for balance. */
const CROUCHED = hands(
  mix(feet({ hip: { y: 2.2 }, body: { rot: 12 }, neck: { y: 0.4 } }, [3.2, 0], [-3.0, 0]), IDLE_FEET),
  [5.2, -4.4],
  [-1.0, -4.0],
  1,
  -1,
);

/**
 * The back roll from his shield: sits back, somersaults backwards while the sim slides him (its travel is frames 4
 * to 20) and comes up in his guard facing ahead. The back tech roll is this retimed onto the tech roll's travel.
 */
const BACK_ROLL: AnimClip = {
  length: ROLL_BACK.faf - 1,
  swaps: { ...GRIT, ...FISTS },
  keys: shortTurns([
    key(0, STANCE, { ease: 'in' }),
    key(3, mix(CROUCHED, { body: { rot: -6 } }), { ease: 'in' }),
    ...somersault(5, 20, 0, -360),
    key(24, mix(CROUCHED, { body: { rot: -348 } }), { ease: 'out' }),
    key(ROLL_BACK.faf - 1, mix(STANCE, { body: { rot: -360 } }), { swaps: { ...GRIT, ...GUARD } }),
  ]),
};

export const tech: Record<string, AnimClip> = {
  down: {
    length: 40,
    loop: true,
    swaps: { ...HURT, ...PALM_F, ...FIST_B },
    keys: [key(0, DOWN), key(20, lying(1, 6)), key(40, DOWN)],
  },

  techInPlace: onFloor({
    length: TECH_IN_PLACE.faf - 1,
    swaps: { ...SHOUT, ...FISTS },
    keys: [
      key(0, LAND_HIT, { ease: 'out' }),
      key(3, landing(4.6, 0.1), { ease: 'inOut' }),
      key(11, LAND_LOOK, { ease: 'inOut', swaps: { ...SMIRK, ...FISTS } }),
      key(17, PUSH_UP, { ease: 'out', swaps: { ...GRIT, ...FISTS } }),
      key(TECH_IN_PLACE.faf - 1, STANCE, { swaps: { ...GRIT, ...GUARD } }),
    ],
  }),

  techRoll: onFloor({
    length: TECH_ROLL.faf - 1,
    swaps: { ...SHOUT, ...FISTS },
    keys: shortTurns([
      key(0, LAND_HIT, { ease: 'out' }),
      key(2, grounded(mix(TUCK, { body: { rot: -20 } })), { ease: 'linear', swaps: { ...GRIT, ...FISTS } }),
      ...somersault(4, 24, 0, 360),
      key(29, mix(CROUCHED, { body: { rot: 368 } }), { ease: 'inOut' }),
      key(TECH_ROLL.faf - 1, mix(STANCE, { body: { rot: 360 } }), { swaps: { ...GRIT, ...GUARD } }),
    ]),
  }),

  getupStand: onFloor({
    length: GETUP_STAND.faf - 1,
    swaps: { ...GRIT, ...PALM_F, ...FIST_B },
    keys: shortTurns([
      key(0, DOWN, { ease: 'inOut' }),
      key(7, SIT_UP, { ease: 'inOut' }),
      key(14, SQUAT, { ease: 'out', swaps: { ...GRIT, ...FISTS } }),
      key(21, PUSH_UP, { ease: 'inOut' }),
      key(GETUP_STAND.faf - 1, STANCE, { swaps: { ...GRIT, ...GUARD } }),
    ]),
  }),

  getupRoll: onFloor({
    length: GETUP_ROLL.faf - 1,
    swaps: { ...GRIT, ...PALM_F, ...FIST_B },
    keys: shortTurns([
      key(0, DOWN, { ease: 'in' }),
      key(3, grounded(mix(TUCK, { body: { rot: -80 } })), { ease: 'linear', swaps: { ...GRIT, ...FISTS } }),
      ...somersault(4, 22, -80, 360),
      key(25, mix(CROUCHED, { body: { rot: 368 } }), { ease: 'inOut' }),
      key(GETUP_ROLL.faf - 1, mix(STANCE, { body: { rot: 360 } }), { swaps: { ...GRIT, ...GUARD } }),
    ]),
  }),

  rollBack: onFloor(BACK_ROLL),
  techRollBack: onFloor(
    retimeClip(BACK_ROLL, TECH_ROLL.faf - 1, [
      [4, 4],
      [20, 30],
    ]),
  ),

  getupRollBack: onFloor({
    length: GETUP_ROLL.faf - 1,
    swaps: { ...GRIT, ...PALM_F, ...FIST_B },
    keys: shortTurns([
      key(0, DOWN, { ease: 'in' }),
      key(3, grounded(mix(TUCK, { body: { rot: -90 } })), { ease: 'linear', swaps: { ...GRIT, ...FISTS } }),
      ...somersault(4, 21, -100, -360),
      key(25, mix(CROUCHED, { body: { rot: -360 } }), { ease: 'inOut' }),
      key(GETUP_ROLL.faf - 1, mix(STANCE, { body: { rot: -360 } }), { swaps: { ...GRIT, ...GUARD } }),
    ]),
  }),
};
