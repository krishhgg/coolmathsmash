import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { GRAB } from '../../../sim/constants';
import { HOLD } from './attacks';
import {
  AIR,
  FISTS,
  FIST_B,
  GRIT,
  GUARD,
  HURT,
  PALM_B,
  PALM_F,
  SHOUT,
  SMIRK,
  STANCE,
  aloft,
  feet,
  fist,
  hands,
  key,
  mix,
  type Pt,
} from './poses';
import { rig } from './rig';

/**
 * Johnny's reactions around the match: his shield breaking and the daze after it, both ends of a grab, the grab
 * release, and the respawn platform.
 */

const IDLE_FEET = { footF: { sx: -1 } };

/** Shield break: snapped up and back, arms flung wide, head thrown back. */
const BREAK_SNAP = aloft(
  hands(
    mix(AIR, {
      body: { rot: -22, x: -0.6 },
      neck: { rot: -20 },
      thighF: { rot: -20 },
      shinF: { rot: 40 },
      thighB: { rot: 24 },
      shinB: { rot: 30 },
    }),
    [6.0, -16.4],
    [-6.6, -15.0],
    -1,
    1,
  ),
);
/** Going limp in the air: arms dropping, knees loose, head lolling forward. */
const BREAK_LIMP = aloft(
  hands(
    mix(AIR, {
      body: { rot: 6 },
      neck: { y: 0.4, rot: 14 },
      thighF: { rot: -10 },
      shinF: { rot: 30 },
      thighB: { rot: 10 },
      shinB: { rot: 26 },
    }),
    [5.2, -6.4],
    [-4.0, -6.0],
    1,
    -1,
  ),
);

/** Dazed on his feet: knees knocked in, arms hanging, swaying `sway` degrees with the head lolling the other way. */
function daze(sway: number): Pose {
  const legs = mix(
    feet(
      { hip: { y: 0.9 }, body: { rot: sway, x: 0.05 * sway }, neck: { y: 0.5, rot: 10 - 1.5 * sway } },
      [1.6, 0],
      [-1.2, 0],
    ),
    IDLE_FEET,
  );
  return hands(legs, [4.0 + 0.1 * sway, -4.2], [-3.0 + 0.1 * sway, -4.4], 1, -1);
}

/** Two of his impact stars circling above his quiff, `turn` (0 to 1) of the way round. */
function stars(pose: Pose, turn: number): Pose {
  const [cx, cy] = pointOf(rig, pose, 'head', 0, -7.6);
  const at = (t: number): Pose[string] => {
    const a = 2 * Math.PI * t;
    return {
      x: cx + 2.6 * Math.cos(a),
      y: cy + 0.7 * Math.sin(a),
      rot: 20 * Math.cos(a),
      sx: 0.75,
      sy: 0.75,
    };
  };
  return mix(pose, { fx1: at(turn), fx2: at(turn + 0.5) });
}

/** One key every `step` frames over a `length`-frame loop, swaying and with the stars going round twice. */
function dizzyKeys(length: number, step: number): Key[] {
  const keys: Key[] = [];
  for (let f = 0; f <= length; f += step) {
    const u = f / length;
    keys.push(key(f, stars(daze(9 * Math.sin(2 * Math.PI * u)), 2 * u), { ease: 'linear' }));
  }
  return keys;
}

/** Holding on: the grab's hold leaning back a little against the weight in his fist, the near fist drawn in. */
const HOLD_BRACE = fist(
  fist(feet({ body: { rot: 3, x: 0.3 }, hip: { y: 0.6 } }, [3.4, 0], [-2.2, 0]), 'B', [6.8, -9.0], 1.2),
  'F',
  [0.2, -9.6],
  1,
  1,
);

/**
 * Held by the collar: leaning back on his heels, both hands pulling at the grip in front of him, `strain` twisting
 * his shoulders as he struggles.
 */
function strained(strain: number): Pose {
  const legs = mix(
    feet(
      { hip: { y: 0.8 }, body: { rot: -12 + 3 * strain, x: -0.8 }, neck: { rot: -8 - 4 * strain } },
      [3.2, 0],
      [-3.0, 0],
    ),
    IDLE_FEET,
  );
  const grip: Pt = [6.8, -11.2];
  return hands(
    legs,
    [grip[0] - 0.4 * strain, grip[1] - 0.6],
    [grip[0] - 2.8 + 0.6 * strain, grip[1] + 0.8],
    -1,
    1,
  );
}

/** Shoved out of the grab: weight thrown back on the rear boot, arms windmilling; `k` 1 is the full recoil. */
function shoved(k: number): Pose {
  return hands(
    mix(
      feet(
        { hip: { y: 0.4 + 0.3 * k }, body: { rot: -14 * k, x: -0.8 * k }, neck: { rot: -10 * k } },
        [3.6, 0],
        [-3.0, 0],
      ),
      IDLE_FEET,
    ),
    [6.0 + 1.4 * k, -10.0 - 3.0 * k],
    [-5.0 - 1.4 * k, -9.0 - 2.0 * k],
    -1,
    1,
  );
}

/** Catching his balance: crouched, fists coming back up. */
const STEADY = hands(
  mix(feet({ hip: { y: 1.3 }, body: { rot: 6 }, neck: { y: 0.3 } }, [3.2, 0], [-2.6, 0]), IDLE_FEET),
  [5.6, -7.6],
  [-3.4, -7.0],
  -1,
  1,
);

/** The hero's pose on the respawn platform: chest out, fists on his hips, chin up. `breath` lifts the chest. */
function heroic(breath: number, look: number): Pose {
  return hands(
    feet(
      {
        hip: { y: 0.1 - 0.15 * breath },
        body: { rot: -3, sy: 1 + 0.015 * breath },
        torso: { rot: -2 },
        neck: { rot: -6 + look },
        armF: { x: -0.35 },
        armB: { x: 0.35 },
      },
      [2.6, 0],
      [-2.2, 0],
    ),
    [4.3, -4.8],
    [-3.6, -4.9],
    -1,
    1,
  );
}

export const reactions: Record<string, AnimClip> = {
  shieldBreak: {
    length: 40,
    swaps: { ...HURT, ...PALM_F, ...PALM_B },
    keys: [
      key(0, BREAK_SNAP, { ease: 'out', swaps: { ...SHOUT, ...PALM_F, ...PALM_B } }),
      key(6, aloft(mix(BREAK_SNAP, { body: { rot: -26 }, neck: { rot: -24 } })), {
        ease: 'inOut',
        swaps: {},
      }),
      key(22, BREAK_LIMP, { ease: 'inOut' }),
      key(40, aloft(mix(BREAK_LIMP, { neck: { y: 0.5, rot: 20 } }))),
    ],
  },

  dizzy: {
    length: 60,
    loop: true,
    swaps: { ...HURT, ...PALM_F, ...PALM_B, fx1: 'impact', fx2: 'impact' },
    keys: dizzyKeys(60, 3),
  },

  grabHold: {
    length: 30,
    loop: true,
    swaps: { ...GRIT, ...FISTS },
    keys: [key(0, HOLD, { ease: 'inOut' }), key(15, HOLD_BRACE, { ease: 'inOut' }), key(30, HOLD)],
  },

  grabbed: {
    length: 20,
    loop: true,
    swaps: { ...HURT, ...PALM_F, ...FIST_B },
    keys: [
      key(0, strained(0), { ease: 'inOut' }),
      key(10, strained(1), { ease: 'inOut' }),
      key(20, strained(0)),
    ],
  },

  grabRelease: {
    length: GRAB.releaseLag,
    swaps: { ...SHOUT, ...PALM_F, ...PALM_B },
    keys: [
      key(0, shoved(1), { ease: 'out' }),
      key(5, shoved(0.8), { ease: 'inOut' }),
      key(10, shoved(0.45), { ease: 'inOut' }),
      key(16, STEADY, { ease: 'inOut', swaps: { ...GRIT, ...FISTS } }),
      key(GRAB.releaseLag, STANCE, { swaps: { ...GRIT, ...GUARD } }),
    ],
  },

  respawn: {
    length: 60,
    loop: true,
    swaps: { ...SMIRK, ...FISTS },
    keys: [
      key(0, heroic(0, 0), { ease: 'inOut' }),
      key(20, heroic(1, -4), { ease: 'inOut' }),
      key(40, heroic(0.4, 3), { ease: 'inOut' }),
      key(60, heroic(0, 0)),
    ],
  },
};
