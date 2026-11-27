import type { Pose } from '../../../render/rig/author';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import {
  AIR,
  BACK_LEG_IN_FRONT,
  CROUCH,
  FISTS,
  FRONT_LEG_IN_FRONT,
  GRIT,
  PALM_B,
  PALM_F,
  SHOUT,
  STANCE,
  between,
  elbows,
  feet,
  fist,
  hands,
  key,
  leg,
  mix,
  onFloor,
  passes,
  shortTurns,
  stanceWith,
  stepping,
  soles,
  tuck,
  type Pt,
} from './poses';
import { DOWN } from './tech';

/**
 * Johnny's normals, keyed on his frame data (src/fighters/johnny/moves.ts): frames use Smash numbering (frame 1 is
 * the first frame of the move, length = FAF - 1) and `active` names the move's hit windows (a throw's or pummel's
 * frame), so the renderer's retiming (src/render/rig/timing.ts) plays them frame for frame until the data changes. Each strike pose is held from the frame before the first active
 * frame through the last one, and its fist, boot, knee or smear covers every hitbox centre the whole time. Smears
 * and impact stars are the Flash-era speed lines that carry a hit out to the reach of Captain Falcon's boxes.
 */

type Swaps = Record<string, string | null>;

/** Impact star of radius `r` on rig point `at` (fx1). */
export const star = ([x, y]: Pt, r: number, rot = 0): BonePose => ({ x, y, rot, sx: r, sy: r });

/** Motion smear (fx2) whose blunt head sits on `to` and whose tail trails back to `from`, half-width `w`. */
export function trail(from: Pt, to: Pt, w: number): BonePose {
  const rot = (Math.atan2(from[1] - to[1], from[0] - to[0]) * 180) / Math.PI;
  return { x: to[0], y: to[1], rot, sx: Math.hypot(from[0] - to[0], from[1] - to[1]), sy: w };
}

/** Swing swoosh (fxBack) around centre `c` with radius `r`, its thick head at `deg` (clockwise sweep). */
const swing = ([x, y]: Pt, r: number, deg: number, flip = false): BonePose => ({
  x,
  y,
  rot: deg,
  sx: r,
  sy: flip ? -r : r,
});

/** A leg folded short under the hip while it swings from one side of the body to the other, passing in front. */
const pass = (pose: Pose, side: 'B' | 'F', ankle: Pt) => tuck(pose, side, ankle, 20, 0.55);

export const HIT = { fx1: 'impact', fx2: 'smear' };

/** Holds `pose` from `from` to `to` (the active window), with the strike's swaps and draw order. */
function strike(
  from: number,
  to: number,
  pose: Pose,
  swaps: Swaps,
  z?: Record<string, number>,
  ease: Key['ease'] = 'out',
): Key[] {
  return [key(from, pose, { ease: 'linear', swaps, ...(z ? { z } : {}) }), key(to, pose, { ease })];
}

/** Ends the strike: swaps back to the clip's. A limb drawn over the body stays there until a key resets `z`. */
const done = (frame: number) => key(frame, undefined, { swaps: {} });

const FRONT_LEG = FRONT_LEG_IN_FRONT;
const BACK_LEG = BACK_LEG_IN_FRONT;

/** Fists up, feet set: the ready pose every grounded normal starts and ends in. */
const READY = STANCE;

// --- Jab: One-Two's first punch, a snapping lead-hand jab at chest height. ---------------------------------
const JAB_WIND = fist(
  fist(feet({ body: { rot: -4, x: -0.2 }, hip: { y: 0.35 } }, [3.0, 0], [-2.4, 0]), 'B', [4.6, -9.6]),
  'F',
  [-0.8, -9.4],
  1,
  1,
);
const JAB_BASE = feet({ body: { rot: 9, x: 0.8 }, hip: { y: 0.4 } }, [3.4, 0], [-2.0, 0]);
const JAB = fist(fist(JAB_BASE, 'B', [7.4, -10.1], 1.1), 'F', [0.2, -9.6], 1, 1);
const JAB_HIT = mix(JAB, { fx1: star([7.5, -10], 1.1), fx2: trail([4.6, -10.0], [7.0, -10.0], 0.9) });

// --- Jab 2: One-Two's second punch, a straight right thrown across the body. ----------------------------
const JAB2_WIND = fist(
  fist(feet({ body: { rot: -6, x: 0.2 }, hip: { y: 0.4 } }, [3.4, 0], [-2.2, 0]), 'B', [5.6, -9.4]),
  'F',
  [0.6, -10.8],
  1,
  1,
);
const JAB2 = fist(
  fist(feet({ body: { rot: 14, x: 1.6 }, hip: { y: 0.5 } }, [4.2, 0], [-1.8, 0]), 'B', [3.2, -10.6]),
  'F',
  [7.8, -10.0],
  1.5,
  1,
);
const JAB2_HIT = mix(JAB2, { fx1: star([8.2, -10], 1.1), fx2: trail([3.0, -10.0], [7.6, -10.0], 1.0) });

// --- Jab 3: the Rush, fists traded at chest height (frames 3, 6, 9, 12), then a finishing far-hand punch. ---
const RUSH = feet({ body: { rot: 10, x: 1.2 }, hip: { y: 0.6 } }, [4.0, 0], [-2.0, 0]);
/** Both fists pulled in: the flurry starts and restarts here, so frame 14 flows back into frame 1. */
const RUSH_PULL = mix(fist(fist(RUSH, 'B', [4.8, -10.0]), 'F', [1.6, -8.6], 1, 1), {
  fx1: star([7.0, -10], 0.3),
  fx2: trail([2.0, -10.0], [5.0, -10.0], 0.6),
});
/** One flurry punch: the far fist (`far`) or the near one out to `y`, the other pulled back. */
const rushPunch = (far: boolean, y: number) =>
  mix(
    far
      ? fist(fist(RUSH, 'B', [8.6, y], 1.2), 'F', [1.4, -9.4], 1, 1)
      : fist(fist(RUSH, 'B', [4.0, -10.8]), 'F', [8.2, y], 1.5, 1),
    { fx1: star([8.8, y], 1.2), fx2: trail([3.0, y], [8.4, y], 1.4) },
  );
const RUSH_END_WIND = fist(
  fist(feet({ body: { rot: -12, x: -0.6 }, hip: { y: 0.6 } }, [3.4, 0], [-2.6, 0]), 'B', [3.4, -10.4]),
  'F',
  [-1.4, -9.6],
  1,
  1,
);
const RUSH_END = fist(
  fist(feet({ body: { rot: 18, x: 2.6 }, hip: { y: 0.7 } }, [6.0, 0], [-2.0, 0]), 'B', [9.8, -10.0], 1.4),
  'F',
  [0.8, -8.8],
  1,
  1,
);
const RUSH_END_HIT = mix(RUSH_END, {
  fx1: star([10, -10], 1.9),
  fx2: trail([4.4, -10.0], [9.6, -10.0], 1.7),
});

// --- Ftilt: Hero Kick, a chambered side kick at chest height with the near leg. ---------------------------
const KICK_BASE = fist(
  fist(feet({ body: { rot: -18, x: 1.4 }, hip: { y: 0.6 } }, [2.6, 0], [-0.6, 0]), 'B', [4.0, -12.4]),
  'F',
  [-0.8, -10.4],
  1,
  1,
);
const FTILT_CHAMBER = leg(KICK_BASE, 'F', [4.4, -7.4], -50, 1.0);
const FTILT = leg(KICK_BASE, 'F', [8.7, -8.1], -6, 1.55);
const FTILT_HIT = mix(FTILT, { fx1: star([11, -8], 1.3), fx2: trail([3.0, -8.2], [10.6, -8.0], 1.4) });

// --- Utilt: Axe Kick, the near leg swung up over his head and chopped down in front. ----------------------
const AXE_BASE = fist(
  fist(feet({ body: { rot: -24, x: 1.2 }, hip: { y: 0.8 } }, [2.2, 0], [-1.0, 0]), 'B', [3.6, -7.2]),
  'F',
  [-3.4, -8.6],
  1,
  1,
);
const UTILT_UP = leg(AXE_BASE, 'F', [6.0, -12.4], -100, 1.55);
const UTILT = leg(AXE_BASE, 'F', [7.8, -10.4], -50, 1.55);
const UTILT_HIT = mix(UTILT, { fx1: star([9, -10], 1.3), fx2: trail([5.2, -19.6], [9.2, -9.6], 1.5) });

// --- Dtilt: Low Kick, a sprawled shin kick along the floor. -----------------------------------------------
const LOW = fist(
  fist(
    feet({ body: { rot: 14, x: 0.4 }, hip: { y: 1.9 }, neck: { y: 0.3 } }, [-1.0, 0], [-2.8, 0]),
    'B',
    [3.4, -6.6],
  ),
  'F',
  [-1.2, -6.2],
  1,
  1,
);
const DTILT = leg(LOW, 'B', [8.9, -1.3], 0, 1.45);
const DTILT_HIT = mix(DTILT, { fx1: star([11, -2.5], 1.3), fx2: trail([4.4, -2.4], [10.6, -2.5], 1.3) });

// --- Dash attack: Speed-Upgrade Shoulder, a running shoulder charge. --------------------------------------
const SHOULDER = fist(
  fist(feet({ body: { rot: 24, x: 2.6 }, hip: { y: 0.6 } }, [5.2, 0], [-1.4, -0.6]), 'B', [5.2, -6.6]),
  'F',
  [2.4, -7.2],
  1,
  1,
);
const DASH_HIT = mix(SHOULDER, { fx1: star([6.6, -9.4], 1.0), fx3: trail([-3.0, -9.2], [6.0, -9.2], 2.4) });

// --- Fsmash: Power Punch, the attack-power upgrade wound up into one huge straight punch. -----------------
const PUNCH_WIND = fist(
  fist(feet({ body: { rot: -12, x: -0.8 }, hip: { y: 0.6 } }, [3.2, 0], [-2.8, 0]), 'B', [0.6, -10.6]),
  'F',
  [3.4, -10.0],
  1,
  1,
);
const PUNCH_BASE = feet({ body: { rot: 18, x: 2.6 }, hip: { y: 0.7 } }, [6.0, 0], [-2.0, 0]);
const FSMASH = fist(fist(PUNCH_BASE, 'B', [12.0, -10.0], 1.4), 'F', [0.8, -8.8], 1, 1);
const FSMASH_HIT = mix(FSMASH, { fx1: star([13, -10], 2.0), fx2: trail([4.6, -10.0], [12.4, -10.0], 1.8) });

// --- Usmash: Double Uppercut, a rising near fist, then the far fist driven up overhead. ------------------
const LOW_WIND = fist(
  fist(stanceWith(CROUCH, { body: { rot: 6 } }), 'B', [3.0, -5.0]),
  'F',
  [1.6, -4.8],
  1,
  1,
);
const UP1 = fist(
  fist(feet({ body: { rot: -4, x: 0.6 }, hip: { y: 0.6 } }, [3.0, 0], [-2.0, 0]), 'F', [5.6, -10.4], 1.15, 1),
  'B',
  [4.6, -7.0],
);
const UP1_HIT = mix(UP1, { fx1: star([6, -10], 1.2), fx2: trail([4.6, -5.0], [5.9, -10.2], 1.1) });
const UP2 = fist(
  fist(
    feet({ body: { rot: -6, x: 0.2, y: -0.8, sy: 1.04 }, hip: { y: 0.2 } }, [3.0, 0], [-2.0, 0]),
    'B',
    [3.2, -17.0],
    1.3,
  ),
  'F',
  [-1.6, -9.0],
  1,
  1,
);
const UP2_HIT = mix(UP2, { fx1: star([3, -18], 1.6), fx2: trail([3.6, -11.0], [3.1, -17.8], 1.4) });

// --- Dsmash: Sweep Kicks, low in front, then low behind. --------------------------------------------------
const SWEEP_BASE = fist(
  fist(stanceWith(CROUCH, { hip: { y: 2.2 }, body: { rot: 4 } }), 'B', [3.4, -6.0]),
  'F',
  [-2.6, -6.2],
  1,
  1,
);
const DSMASH_1 = leg(SWEEP_BASE, 'F', [8.9, -1.6], 4, 1.6);
const DSMASH_1_HIT = mix(DSMASH_1, { fx1: star([11, -3], 1.4), fx2: trail([4.0, -2.8], [10.7, -3.0], 1.4) });
/**
 * The near leg folded under him on its way back to the stance after the second sweep, the knee bowed out as in the
 * stance it steps into.
 */
const DSMASH_PASS = leg(stanceWith(READY, { hip: { y: 1.0 } }), 'F', [0.2, -2.0], 20, 0.55, -1);
/** The near boot planted in front again after the first sweep. */
const SWEEP_2 = tuck(SWEEP_BASE, 'F', [3.2, -0.55], 0);
const DSMASH_2 = mix(leg(SWEEP_2, 'B', [-8.9, -1.6], 184, 1.6, -1), { footB: { sy: -1 } });
const DSMASH_2_HIT = mix(DSMASH_2, {
  fx1: star([-11, -3], 1.4),
  fx2: trail([-4.0, -2.8], [-10.7, -3.0], 1.4),
});

// --- Aerials. ----------------------------------------------------------------------------------------------
export const AIR_GUARD = fist(fist(AIR, 'B', [4.6, -10.6]), 'F', [1.0, -10.2], 1, 1);
/** Nair: Double Kick, the near boot then the far one. */
const NAIR_1 = leg(mix(AIR_GUARD, { body: { rot: -10 } }), 'F', [4.6, -7.4], -8, 1.25);
const NAIR_1_HIT = mix(NAIR_1, { fx1: star([5.4, -8], 1.2), fx2: trail([1.0, -6.8], [5.0, -8.0], 1.2) });
/** The far kick: the leg driven out straight at the target, unstretched. */
const NAIR_2 = leg(mix(AIR_GUARD, { body: { rot: -14 } }), 'B', [4.8, -7.8], -4);
const NAIR_2_HIT = mix(NAIR_2, { fx1: star([6.4, -8], 1.3), fx2: trail([1.6, -7.2], [6.0, -8.0], 1.3) });

/** Fair: The Knee, the far knee thrown forward with his whole weight behind it. */
const KNEE_BASE = fist(
  fist(mix(AIR, { body: { rot: -8, x: 2.2, y: -1.8 } }), 'B', [6.2, -14.0]),
  'F',
  [-2.8, -10.2],
  1,
  1,
);
const KNEE_WIND = mix(KNEE_BASE, {
  thighB: { rot: 30 },
  shinB: { rot: 60 },
  body: { rot: 4, x: 1.0, y: -1.8 },
});
const KNEE = mix(KNEE_BASE, { thighB: { rot: -114, sy: 1.35 }, shinB: { rot: 124 } });
const KNEE_HIT = mix(KNEE, { fx1: star([8.2, -7], 1.0), fx2: trail([3.0, -6.6], [7.6, -7.0], 1.3) });

/** Bair: Backhand, the near fist swung round behind him. */
const BACKHAND = fist(
  fist(mix(AIR, { body: { rot: 10, x: -1.4 }, neck: { rot: -8 } }), 'F', [-9.4, -9.2], 1.2),
  'B',
  [3.4, -8.0],
);
const BAIR_HIT = mix(BACKHAND, { fx1: star([-10, -9], 1.2), fx2: trail([-4.2, -12.6], [-9.6, -9.1], 1.3) });

/** Uair: Flip Kick, a quick backflip that swings both boots overhead. */
const FLIP = fist(
  fist(
    mix(AIR, {
      body: { rot: -150, x: -0.8, y: -1.6 },
      thighF: { rot: -10 },
      shinF: { rot: 10 },
      thighB: { rot: 20 },
      shinB: { rot: 40 },
    }),
    'B',
    [6.0, -10.4],
  ),
  'F',
  [-3.0, -11.6],
  1,
  1,
);
const UAIR_HIT = mix(FLIP, { fx1: star([2, -17.6], 1.3), fx3: swing([1.2, -12.6], 5.4, -78, true) });
const UAIR_LATE = mix(FLIP, {
  body: { rot: -172 },
  fx1: star([2, -17], 1.1),
  fx3: swing([1.2, -12.6], 5.4, -100, true),
});

/** Dair: Stomp, knees up, then both boots driven straight down. */
const STOMP_WIND = fist(
  fist(
    mix(AIR, {
      body: { y: -1.2 },
      thighF: { rot: -80 },
      shinF: { rot: 110 },
      thighB: { rot: -70 },
      shinB: { rot: 105 },
    }),
    'B',
    [4.8, -12.6],
  ),
  'F',
  [-3.4, -12.2],
  1,
  1,
);
const STOMP = fist(
  fist(feet({ body: { y: -0.6 }, hip: { y: -0.6 } }, [1.6, 0.1], [0.2, 0.1]), 'B', [5.6, -12.4]),
  'F',
  [-4.2, -12.0],
  1,
  1,
);
const STOMP_HIT = mix(STOMP, { fx1: star([1, 0.4], 1.3), fx2: trail([1.0, -6.0], [1.0, 0.2], 1.6) });

// --- Getup attack: flat on his back, he sits up kicking in front, then sweeps behind. ----------------------
const SIT = hands(
  tuck(tuck({ body: { rot: -16, x: -1.0 }, hip: { y: 2.8 } }, 'B', [4.4, -0.55], 0), 'F', [2.6, -0.55], 0),
  [-0.8, -1.6],
  [-4.2, -1.6],
);
const ROLL_UP = hands(
  tuck(tuck({ body: { rot: -55, y: 4.4 } }, 'B', [6.0, -0.55], 0), 'F', [5.2, -0.55], 0),
  [-0.6, -1.6],
  [-0.2, -4.4],
);
const GETUP_1 = leg(SIT, 'F', [8.6, -2.6], 0, 1.6);
const GETUP_1_HIT = mix(GETUP_1, { fx1: star([9, -3], 1.4), fx2: trail([3.6, -2.8], [8.8, -3.0], 1.4) });
const SIT_2 = hands(
  tuck(tuck({ body: { rot: 10, x: 0.6 }, hip: { y: 2.6 } }, 'B', [3.4, -0.55], 0), 'F', [2.4, -0.55], 0),
  [3.0, -0.6],
  [0.6, -0.6],
);
const GETUP_2 = mix(leg(SIT_2, 'B', [-8.6, -2.4], 184, 1.6, -1), { footB: { sy: -1 } });
const GETUP_2_HIT = mix(GETUP_2, { fx1: star([-9, -3], 1.4), fx2: trail([-3.6, -2.8], [-8.8, -3.0], 1.4) });

// --- Grabs: a lunge with the far hand open, the near one ready to clamp. ----------------------------------
const OPEN = { ...PALM_F, ...PALM_B };
const GRAB = fist(
  fist(feet({ body: { rot: 16, x: 1.8 }, hip: { y: 0.6 } }, [4.6, 0], [-1.8, 0]), 'B', [7.9, -8.2], 1.15),
  'F',
  [4.6, -6.8],
  1,
  1,
);
const DASH_GRAB = fist(
  fist(feet({ body: { rot: 24, x: 2.8 }, hip: { y: 0.9 } }, [6.6, 0], [-2.0, 0]), 'B', [9.0, -8.2], 1.25),
  'F',
  [5.8, -6.6],
  1,
  1,
);
const PIVOT_GRAB = fist(
  fist(feet({ body: { rot: 20, x: 2.6 }, hip: { y: 0.8 } }, [6.2, 0], [-2.2, 0]), 'B', [9.4, -8.0], 1.3),
  'F',
  [6.0, -6.6],
  1,
  1,
);

// --- Holding, pummel and throws. --------------------------------------------------------------------------
/** Holding someone by the collar at arm's length, the near fist cocked. */
export const HOLD = fist(
  fist(feet({ body: { rot: 6, x: 0.6 }, hip: { y: 0.4 } }, [3.4, 0], [-2.2, 0]), 'B', [6.8, -9.0], 1.2),
  'F',
  [0.6, -9.8],
  1,
  1,
);
const PUMMEL = tuck(stanceWith(HOLD, { body: { rot: 10, x: 1.0 } }), 'B', [4.6, -3.0], 30, 1.3);
const PUMMEL_HIT = mix(PUMMEL, { fx1: star([5.4, -6], 1.2) });
/** Fthrow: Punch Toss, lets go and punches him away with the far fist. */
const FTHROW_WIND = fist(
  fist(feet({ body: { rot: -10, x: -0.6 }, hip: { y: 0.5 } }, [3.4, 0], [-2.4, 0]), 'B', [1.6, -10.0]),
  'F',
  [-2.6, -10.0],
  1,
  1,
);
const FTHROW = fist(
  fist(feet({ body: { rot: 16, x: 2.2 }, hip: { y: 0.6 } }, [5.8, 0], [-2.0, 0]), 'B', [9.4, -9.4], 1.3),
  'F',
  [0.6, -8.8],
  1,
  1,
);
const FTHROW_HIT = mix(FTHROW, { fx1: star([10.2, -9.4], 1.8), fx2: trail([4.0, -9.4], [9.8, -9.4], 1.6) });
/** Bthrow: Spin Throw, heaves him overhead and slings him down behind. */
const BTHROW_UP = fist(
  fist(feet({ body: { rot: -8, x: -0.2 }, hip: { y: 0.3 } }, [3.2, 0], [-2.0, 0]), 'B', [2.6, -16.0], 1.2),
  'F',
  [0.4, -15.4],
  1.1,
  1,
);
const BTHROW = fist(
  fist(feet({ body: { rot: -22, x: -1.6 }, hip: { y: 0.6 } }, [3.4, 0], [-3.4, 0]), 'B', [-3.6, -12.6], 1.2),
  'F',
  [-7.4, -10.4],
  1.2,
  1,
);
const BTHROW_HIT = mix(BTHROW, { fx1: star([-8.4, -10.6], 1.8), fx3: swing([0.4, -10.6], 7, -165, true) });
/** Uthrow: Palm Lift, a one-handed heave straight up. */
const UTHROW_LOW = fist(
  fist(stanceWith(CROUCH, { body: { rot: 4 } }), 'B', [5.6, -6.4], 1.05),
  'F',
  [0.8, -6.8],
  1,
  1,
);
const UTHROW = fist(
  fist(
    feet({ body: { rot: -4, y: -0.6, sy: 1.04 }, hip: { y: 0.2 } }, [3.0, 0], [-2.0, 0]),
    'B',
    [4.2, -18.4],
    1.25,
  ),
  'F',
  [-1.4, -9.4],
  1,
  1,
);
const UTHROW_HIT = mix(UTHROW, { fx1: star([4.2, -19.8], 1.8), fx2: trail([4.6, -10.0], [4.2, -19.2], 1.6) });
/** Dthrow: Slam, hoists him overhead and drives him into the floor. */
const DTHROW_UP = fist(
  fist(
    feet({ body: { rot: -10, x: -0.4, y: -0.4 }, hip: { y: 0.1 } }, [3.2, 0], [-2.2, 0]),
    'B',
    [3.8, -17.0],
    1.2,
  ),
  'F',
  [1.6, -16.4],
  1.15,
  1,
);
const DTHROW = fist(
  fist(feet({ body: { rot: 30, x: 2.6 }, hip: { y: 2.0 } }, [5.4, 0], [-3.0, 0]), 'B', [7.4, -1.6], 1.25),
  'F',
  [5.4, -1.8],
  1.15,
  1,
);
const DTHROW_HIT = mix(DTHROW, { fx1: star([7.2, -1.9], 2.0), fx2: trail([5.6, -12.0], [7.2, -1.4], 1.6) });

// --- Side special: Upgrade Dash, a wound-up burst dash that ends in a punch. ------------------------------
const DASH_WIND = fist(
  fist(feet({ body: { rot: -14, x: -1.2 }, hip: { y: 1.2 } }, [2.6, 0], [-3.4, 0]), 'B', [-0.4, -9.6]),
  'F',
  [1.6, -10.4],
  1,
  1,
);
const BURST = fist(
  fist(feet({ body: { rot: 30, x: 2.4 }, hip: { y: 0.8 } }, [5.6, 0], [-4.2, -1.2]), 'B', [1.6, -8.0]),
  'F',
  [4.0, -6.8],
  1,
  1,
);
const BURST_FX = mix(BURST, { fx3: trail([-8.0, -8.6], [2.0, -8.6], 3.0) });
const DASH_PUNCH = fist(
  fist(feet({ body: { rot: 22, x: 2.8 }, hip: { y: 0.8 } }, [6.0, 0], [-2.6, 0]), 'B', [9.4, -9.2], 1.35),
  'F',
  [1.0, -8.6],
  1,
  1,
);
const DASH_PUNCH_HIT = mix(DASH_PUNCH, {
  fx1: star([9.6, -9], 1.8),
  fx2: trail([4.0, -9.2], [9.0, -9.2], 1.6),
  fx3: trail([-6.0, -8.6], [2.0, -8.6], 2.4),
});

// --- Up special: Double-Jump Boots, a knee off the floor, then a rising uppercut on a jet from the boots. -
const BOOT_SQUAT = fist(
  fist(stanceWith(CROUCH, { hip: { y: 2.0 }, body: { rot: 10 } }), 'B', [3.4, -4.6]),
  'F',
  [0.6, -4.4],
  1,
  1,
);
const BOOT_KNEE = tuck(
  fist(
    fist(feet({ body: { rot: -6, y: -1.0 } }, [2.0, -1.0], [-1.0, -0.6]), 'B', [4.6, -11.0]),
    'F',
    [1.0, -10.4],
    1,
    1,
  ),
  'F',
  [3.4, -4.0],
  40,
  1.2,
);
const BOOT_KNEE_HIT = mix(BOOT_KNEE, {
  fx1: star([4.2, -7.4], 1.3),
  fx3: trail([0.6, 4.0], [0.6, -0.4], 1.6),
});
const ROCKET = fist(
  fist(
    soles(feet({ body: { rot: -4, y: -1.6, sy: 1.05 } }, [1.2, -1.2], [0.0, -1.2]), 50, 50),
    'B',
    [3.0, -18.2],
    1.3,
  ),
  'F',
  [-0.4, -10.6],
  1,
  1,
);
const ROCKET_HIT = mix(ROCKET, {
  fx1: star([3.0, -18.4], 2.0),
  fx2: trail([3.2, -9.0], [3.0, -17.8], 1.8),
  fx3: trail([0.6, 5.0], [0.6, -0.6], 1.8),
});

const clips: Record<string, AnimClip> = {
  jab: {
    length: 17,
    active: [[3, 4]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(1, JAB_WIND, { ease: 'in' }),
      ...strike(2, 4, JAB_HIT, HIT),
      done(5),
      key(8, JAB, { ease: 'inOut' }),
      key(17, READY),
    ],
  },
  jab2: {
    length: 19,
    active: [[4, 5]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'linear' }),
      key(2, JAB2_WIND, { ease: 'in' }),
      ...strike(3, 5, JAB2_HIT, HIT),
      done(6),
      key(10, JAB2, { ease: 'inOut' }),
      key(19, READY),
    ],
  },
  jab3: {
    length: 44,
    active: [
      [3, 3],
      [6, 6],
      [9, 9],
      [12, 12],
      [19, 20],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(1, RUSH_PULL, { ease: 'linear', swaps: { ...HIT, ...SHOUT } }),
      key(3, rushPunch(true, -10.0), { ease: 'linear' }),
      key(6, rushPunch(false, -10.4), { ease: 'linear' }),
      key(9, rushPunch(true, -9.6), { ease: 'linear' }),
      key(12, rushPunch(false, -10.2), { ease: 'linear' }),
      key(14, RUSH_PULL, { ease: 'out' }),
      done(15),
      key(17, RUSH_END_WIND, { ease: 'in' }),
      ...strike(18, 20, RUSH_END_HIT, { ...HIT, ...SHOUT }),
      done(21),
      key(28, RUSH_END, { ease: 'inOut' }),
      key(44, READY),
    ],
  },
  ftilt: {
    length: 29,
    active: [[7, 10]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'linear' }),
      key(4, FTILT_CHAMBER, { ease: 'in' }),
      ...strike(6, 10, FTILT_HIT, { ...HIT, ...SHOUT }, FRONT_LEG),
      done(11),
      key(16, leg(KICK_BASE, 'F', [6.4, -7.2], -20, 1.1), { ease: 'inOut' }),
      key(29, READY, { z: {} }),
    ],
  },
  utilt: {
    length: 36,
    active: [[14, 17]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'linear' }),
      key(6, leg(AXE_BASE, 'F', [1.8, -9.0], -40, 1.1), { ease: 'in', z: FRONT_LEG }),
      key(12, UTILT_UP, { ease: 'in' }),
      ...strike(13, 17, UTILT_HIT, { ...HIT, ...SHOUT }),
      done(18),
      key(22, leg(AXE_BASE, 'F', [6.0, -3.4], -20, 1.1), { ease: 'inOut' }),
      key(29, pass(READY, 'F', [0.2, -2.4]), { ease: 'inOut' }),
      key(36, READY, { z: {} }),
    ],
  },
  dtilt: {
    length: 33,
    active: [[10, 11]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(6, leg(LOW, 'B', [4.4, -1.2], -10, 1.0), { ease: 'in' }),
      ...strike(9, 11, DTILT_HIT, HIT),
      done(12),
      key(18, DTILT, { ease: 'inOut' }),
      key(33, READY),
    ],
  },
  dashAttack: {
    length: 34,
    active: [
      [7, 9],
      [10, 16],
    ],
    swaps: { ...SHOUT, ...FISTS },
    keys: [
      key(0, stanceWith(SHOULDER, { body: { rot: 10, x: 0.6 } }), { ease: 'in' }),
      ...strike(6, 16, DASH_HIT, { fx1: 'impact', fxBack: 'smear' }),
      done(17),
      key(24, stanceWith(SHOULDER, { body: { rot: 12, x: 1.4 } }), {
        ease: 'inOut',
        swaps: { ...GRIT, ...FISTS },
      }),
      key(34, READY),
    ],
  },
  fsmash: {
    length: 59,
    active: [[18, 21]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(10, PUNCH_WIND, { ease: 'inOut' }),
      key(15, stanceWith(PUNCH_WIND, { body: { rot: -15, x: -1.0 } }), { ease: 'linear' }),
      ...strike(17, 21, FSMASH_HIT, { ...HIT, ...SHOUT }),
      done(22),
      key(30, FSMASH, { ease: 'inOut' }),
      key(59, READY),
    ],
  },
  usmash: {
    length: 45,
    active: [
      [14, 15],
      [20, 22],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(8, LOW_WIND, { ease: 'in' }),
      ...strike(13, 15, UP1_HIT, { ...HIT, ...SHOUT }),
      done(16),
      key(18, fist(mix(UP1, { body: { rot: -6 } }), 'B', [3.4, -10.6]), { ease: 'in' }),
      ...strike(19, 22, UP2_HIT, { ...HIT, ...SHOUT }),
      done(23),
      key(30, UP2, { ease: 'inOut' }),
      key(45, READY),
    ],
  },
  dsmash: {
    length: 48,
    active: [
      [16, 17],
      [25, 26],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(9, SWEEP_BASE, { ease: 'linear' }),
      key(12, pass(SWEEP_BASE, 'F', [0.6, -2.0]), { ease: 'in', z: FRONT_LEG }),
      ...strike(15, 17, DSMASH_1_HIT, { ...HIT, ...SHOUT }, FRONT_LEG),
      done(18),
      key(21, pass(SWEEP_2, 'B', [-0.6, -2.0]), { ease: 'in', z: {} }),
      ...strike(24, 26, DSMASH_2_HIT, { ...HIT, ...SHOUT }),
      done(27),
      key(34, DSMASH_2, { ease: 'inOut' }),
      key(40, pass(SWEEP_2, 'B', [0.6, -2.0]), { ease: 'inOut' }),
      key(44, DSMASH_PASS, { ease: 'linear' }),
      // The near boot comes down over the floor into the stance.
      key(46, stepping(DSMASH_PASS, READY, 0.5, 'F'), { ease: 'linear' }),
      key(47, stepping(DSMASH_PASS, READY, 0.75, 'F'), { ease: 'linear' }),
      key(48, READY),
    ],
  },
  nair: {
    length: 39,
    active: [
      [7, 8],
      [13, 15],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, AIR_GUARD, { ease: 'out' }),
      key(4, leg(AIR_GUARD, 'F', [2.0, -4.4], 20, 1.0), { ease: 'in', z: FRONT_LEG }),
      ...strike(6, 8, NAIR_1_HIT, HIT, undefined, 'linear'),
      done(9),
      key(
        11,
        // The near leg drops back as the far knee comes up to chamber the second kick.
        mix(NAIR_1, {
          thighF: AIR_GUARD.thighF!,
          shinF: AIR_GUARD.shinF!,
          footF: { rot: 0 },
          thighB: { rot: -70 },
          shinB: { rot: 20 },
        }),
        { ease: 'in', z: {} },
      ),
      ...strike(12, 15, NAIR_2_HIT, { ...HIT, ...SHOUT }, BACK_LEG),
      done(16),
      key(24, NAIR_2, { ease: 'inOut' }),
      key(39, AIR_GUARD, { z: {} }),
    ],
  },
  fair: {
    length: 45,
    active: [
      [14, 14],
      [15, 30],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, AIR_GUARD, { ease: 'out' }),
      key(10, KNEE_WIND, { ease: 'in' }),
      ...strike(13, 14, KNEE_HIT, { ...HIT, ...SHOUT }, BACK_LEG),
      key(15, KNEE, { ease: 'linear', swaps: {}, z: BACK_LEG }),
      key(30, KNEE, { ease: 'inOut' }),
      key(31, undefined, { z: {} }),
      key(45, AIR_GUARD),
    ],
  },
  bair: {
    length: 35,
    active: [
      [10, 11],
      [12, 15],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, AIR_GUARD, { ease: 'out' }),
      key(7, fist(mix(AIR_GUARD, { body: { rot: -8 } }), 'F', [2.6, -12.4]), { ease: 'in' }),
      ...strike(9, 15, BAIR_HIT, { ...HIT, ...SHOUT }),
      done(16),
      key(22, BACKHAND, { ease: 'inOut' }),
      key(35, AIR_GUARD),
    ],
  },
  uair: {
    length: 31,
    active: [
      [6, 10],
      [11, 12],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, AIR_GUARD, { ease: 'linear' }),
      key(4, mix(FLIP, { body: { rot: -90, x: -0.4, y: -0.8 } }), { ease: 'linear' }),
      key(5, UAIR_HIT, { ease: 'linear', swaps: { fx1: 'impact', fxBack: 'swoosh', ...SHOUT } }),
      key(12, UAIR_LATE, { ease: 'linear' }),
      done(13),
      key(20, mix(AIR_GUARD, { body: { rot: -360 } }), { ease: 'out' }),
      key(31, mix(AIR_GUARD, { body: { rot: -360 } })),
    ],
  },
  dair: {
    length: 44,
    active: [
      [16, 18],
      [19, 22],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, AIR_GUARD, { ease: 'out' }),
      key(12, STOMP_WIND, { ease: 'in' }),
      ...strike(15, 22, STOMP_HIT, { ...HIT, ...SHOUT }),
      done(23),
      key(30, STOMP, { ease: 'inOut' }),
      key(44, AIR_GUARD),
    ],
  },
  getupAttack: {
    length: 45,
    active: [
      [17, 18],
      [25, 26],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      // From his knocked-down pose (tech.ts), as the `down` clip draws him.
      key(0, DOWN, { ease: 'inOut' }),
      key(8, ROLL_UP, { ease: 'linear' }),
      key(13, SIT, { ease: 'in' }),
      ...strike(16, 18, GETUP_1_HIT, { ...HIT, ...SHOUT }, FRONT_LEG),
      done(19),
      key(21, pass(SIT_2, 'B', [-0.6, -1.8]), { ease: 'in', z: {} }),
      ...strike(24, 26, GETUP_2_HIT, { ...HIT, ...SHOUT }, undefined, 'linear'),
      done(27),
      key(30, pass(SIT_2, 'B', [0.4, -1.8]), { ease: 'linear' }),
      key(34, CROUCH, { ease: 'inOut' }),
      key(45, READY),
    ],
  },
  grab: {
    length: 35,
    active: [[7, 8]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(4, stanceWith(READY, { body: { rot: -6, x: -0.4 } }), { ease: 'in', swaps: OPEN }),
      ...strike(6, 8, GRAB, { ...OPEN, ...SHOUT }),
      done(9),
      key(14, stanceWith(GRAB, { body: { rot: 10, x: 1.2 } }), { ease: 'inOut' }),
      key(35, READY),
    ],
  },
  dashGrab: {
    length: 43,
    active: [[10, 11]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(
        0,
        fist(
          fist(feet({ body: { rot: 18, x: 1.6 }, hip: { y: 0.5 } }, [4.0, 0], [-2.6, 0]), 'B', [1.4, -8.0]),
          'F',
          [-3.2, -8.4],
          1,
          1,
        ),
        { ease: 'in' },
      ),
      key(6, stanceWith(DASH_GRAB, { body: { rot: 14, x: 1.6 } }), { ease: 'in', swaps: OPEN }),
      ...strike(9, 11, DASH_GRAB, { ...OPEN, ...SHOUT }),
      done(12),
      key(20, stanceWith(DASH_GRAB, { body: { rot: 28, x: 3.2 } }), { ease: 'inOut' }),
      key(43, READY),
    ],
  },
  pivotGrab: {
    length: 38,
    active: [[11, 12]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, stanceWith(STANCE, { body: { rot: -14, x: -1.4 } }), { ease: 'out' }),
      key(7, stanceWith(PIVOT_GRAB, { body: { rot: 6, x: 0.6 } }), { ease: 'in', swaps: OPEN }),
      ...strike(10, 12, PIVOT_GRAB, { ...OPEN, ...SHOUT }),
      done(13),
      key(22, stanceWith(PIVOT_GRAB, { body: { rot: 26, x: 3.0 } }), { ease: 'inOut' }),
      key(38, READY),
    ],
  },
  pummel: {
    length: 6,
    active: [[1, 1]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, HOLD, { ease: 'in' }),
      ...strike(1, 3, PUMMEL_HIT, { fx1: 'impact', ...SHOUT }, BACK_LEG),
      done(4),
      key(6, HOLD, { z: {} }),
    ],
  },
  fthrow: {
    length: 32,
    active: [[13, 13]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(8, FTHROW_WIND, { ease: 'in' }),
      ...strike(12, 14, FTHROW_HIT, { ...HIT, ...SHOUT }),
      done(15),
      key(20, FTHROW, { ease: 'inOut' }),
      key(32, READY),
    ],
  },
  bthrow: {
    length: 45,
    active: [[13, 13]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(6, BTHROW_UP, { ease: 'inOut' }),
      key(10, stanceWith(BTHROW_UP, { body: { rot: -14 } }), { ease: 'in' }),
      ...strike(12, 14, BTHROW_HIT, { fx1: 'impact', fxBack: 'swoosh', ...SHOUT }),
      done(15),
      key(24, BTHROW, { ease: 'inOut' }),
      key(45, READY),
    ],
  },
  uthrow: {
    length: 37,
    active: [[14, 14]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(9, UTHROW_LOW, { ease: 'in', swaps: PALM_B }),
      ...strike(13, 15, UTHROW_HIT, { ...HIT, ...SHOUT, ...PALM_B }),
      done(16),
      key(22, UTHROW, { ease: 'inOut' }),
      key(37, READY),
    ],
  },
  dthrow: {
    length: 39,
    active: [[21, 21]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(10, DTHROW_UP, { ease: 'inOut' }),
      key(17, stanceWith(DTHROW_UP, { body: { rot: -16 } }), { ease: 'in' }),
      ...strike(20, 22, DTHROW_HIT, { ...HIT, ...SHOUT }),
      done(23),
      key(30, DTHROW, { ease: 'inOut' }),
      key(39, READY),
    ],
  },
  sideB: {
    length: 49,
    active: [[16, 19]],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(4, DASH_WIND, { ease: 'linear' }),
      // The far boot steps forward over the floor into the burst.
      key(5, stepping(DASH_WIND, BURST, 0.6, 'B'), { ease: 'linear' }),
      key(6, BURST_FX, { ease: 'linear', swaps: { fxBack: 'smear', ...SHOUT } }),
      key(14, fist(stanceWith(BURST_FX, { body: { rot: 32 } }), 'B', [5.0, -8.6]), { ease: 'in' }),
      ...strike(15, 19, DASH_PUNCH_HIT, { ...HIT, fxBack: 'smear', ...SHOUT }),
      done(20),
      key(28, DASH_PUNCH, { ease: 'inOut' }),
      key(49, READY),
    ],
  },
  upB: {
    length: 45,
    active: [
      [8, 10],
      [14, 17],
    ],
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(0, READY, { ease: 'out' }),
      key(5, BOOT_SQUAT, { ease: 'in' }),
      ...strike(7, 10, BOOT_KNEE_HIT, { fx1: 'impact', fxBack: 'smear', ...SHOUT }, FRONT_LEG, 'linear'),
      done(11),
      key(12, between(BOOT_KNEE, mix(ROCKET, { body: { rot: 6 } }), 0.5), { ease: 'in', z: {} }),
      ...strike(13, 17, ROCKET_HIT, { ...HIT, fxBack: 'smear', ...SHOUT }),
      done(18),
      key(28, ROCKET, { ease: 'out' }),
      key(45, AIR_GUARD),
    ],
  },
};

/** Moves drawn off the floor: the aerials and the up special, which takes off on its first frame. */
const AIRBORNE = new Set(['nair', 'fair', 'bair', 'uair', 'dair', 'upB']);

/**
 * Frames where a tween between two planted poses sweeps a boot through the floor, and which leg: each gets an
 * in-between key with that boot passing over it (poses.ts `passes`).
 */
const PASSES: Record<string, [number, 'B' | 'F', number?][]> = {
  ftilt: [
    [2, 'B'],
    [22, 'B'],
  ],
  utilt: [
    [2, 'B'],
    [4, 'B'],
    [25, 'B'],
    [33, 'F'],
  ],
  dtilt: [[26, 'B']],
  dashGrab: [[32, 'B']],
  pivotGrab: [[30, 'B']],
  dthrow: [
    [18, 'B'],
    [19, 'B'],
    [19, 'F'],
    [35, 'B'],
  ],
};

/**
 * Every clip's keys keep the elbows on their side and turn the short way. The grounded ones get their passing keys
 * and are keyed on every frame, lifted wherever a tween between two planted poses would still dip a boot into the
 * floor.
 */
export const attacks: Record<string, AnimClip> = Object.fromEntries(
  Object.entries(clips).map(([name, clip]) => {
    const short = { ...clip, keys: shortTurns(elbows(clip.keys)) };
    if (AIRBORNE.has(name)) return [name, short];
    const passed = passes(short, PASSES[name] ?? []);
    return [name, onFloor({ ...passed, keys: shortTurns(passed.keys) }, false)];
  }),
);
