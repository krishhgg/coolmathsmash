import type { Pose } from '../../../render/rig/author';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip, Key } from '../../../render/rig/types';
import {
  BLINK,
  DIZZY,
  GRIN,
  GRIT,
  HAPPY,
  HURT,
  LOOK_UP,
  OPEN,
  OPEN_B,
  ROCKET,
  SCARED,
  SHOUT,
  aim,
  aloft,
  at,
  feet,
  fx,
  grip,
  grounded,
  hands,
  key,
  mix,
  plant,
  rotOf,
  shortTurns,
  sole,
  type Pt,
} from './poses';
import {
  LEDGE_ATTACK,
  LEDGE_CATCH_FRAMES,
  LEDGE_CLIMB,
  LEDGE_JUMP,
  LEDGE_ROLL,
} from '../../../sim/constants';
import { stats } from '../stats';
import { BRO_ARM } from './parts';

/**
 * The kids' movement, defence, ledge and hurt clips. The big kid carries the launcher in both hands and wades
 * along inside the ring; his brother rides on the back of it, bouncing a beat behind and reacting with his own
 * face. Rig space: y down, feet at the origin, facing right.
 */

// ---------------------------------------------------------------------------------------------------------
// The brother.

const DEG = 180 / Math.PI;
const round = (v: number) => Math.round(v * 1000) / 1000;

/** The brother's offsets: lean (degrees, + leans forwards), head tilt, far arm, near arm and leg swing. */
function bro(lean = 0, head = 0, armB = 0, armF = 0, leg = 0, lift = 0): Pose {
  return {
    bro: { rot: lean, y: -lift },
    broHead: { rot: head },
    broArmB: { rot: armB },
    broArmF: { rot: armF },
    broLeg: { rot: leg },
  };
}

/** The brother hanging on with both hands, his far arm up and waving, as he cheers. */
const BRO_CHEER = bro(4, -8, -150, 0, -20, 0.2);
/** The brother ducking behind his brother's head, head down and both arms holding on. */
const BRO_DUCK = bro(18, 14, 30, 6, 10);
/** Thrown about: leaning back, far arm flung up, leg kicking out. */
const BRO_FLUNG = bro(-26, -18, -165, -40, -50, 0.2);

// ---------------------------------------------------------------------------------------------------------
// Standing, crouching and the air.

/** Feet apart, the far sneaker a step ahead. */
const FAR_FOOT: Pt = [1.3, 0];
const NEAR_FOOT: Pt = [-0.6, 0];

/** Plants the feet and aims the launcher (`gun` degrees, 0 forwards, negative up). */
function stand(extra: Pose, gun = -6, back: Pt = FAR_FOOT, front: Pt = NEAR_FOOT): Pose {
  return aim(feet(extra, back, front), gun);
}

/** Standing: feet apart, the launcher held level across the ring. */
export const STAND = stand({});
/** The idle breath: shoulders sink, the head nods and the brother leans in. */
const BREATHE = stand(
  { body: { y: 0.12 }, neck: { rot: 3 }, torso: { rot: 1.5 }, ...bro(4, 5, 6, 3, 8) },
  -3,
);
/** Looking about: the head turns up, the brother peeks out further. */
const LOOK = stand({ neck: { rot: -6 }, ...bro(-4, -10, -12, -4, -10) }, -10);

/** Knees bent, head pulled down, the launcher held low and the brother ducking. */
const CROUCH = stand(
  { body: { y: 1.5, rot: 4 }, neck: { y: 0.3, rot: 6 }, ...BRO_DUCK },
  4,
  [1.6, 0],
  [-1.0, 0],
);
/** Landing on the stage after a pull-up: low and leaning in, before standing. */
const CLIMB = stand(
  { body: { y: 1.4, rot: 12 }, neck: { y: 0.3, rot: -4 }, ...BRO_DUCK },
  10,
  [1.9, 0],
  [-0.6, 0],
);
const SQUAT = stand(
  { body: { y: 2.0, rot: 6, sy: 0.96 }, neck: { y: 0.35, rot: 8 }, ...BRO_DUCK },
  8,
  [1.7, 0],
  [-1.1, 0],
);

/** Airborne legs: the near knee lifted, the far leg trailing, toes pointing down. */
function air(extra: Pose = {}, gun = -6, tuck = 0): Pose {
  const pose = aim(
    mix(
      {
        thighF: { rot: -38 - tuck * 30 },
        shinF: { rot: 50 + tuck * 40 },
        thighB: { rot: 18 - tuck * 40 },
        shinB: { rot: 30 + tuck * 50 },
      },
      extra,
    ),
    gun,
  );
  return sole(sole(pose, 'B', 45), 'F', 30);
}

const RISE = air({ body: { sy: 1.04, sx: 0.97 }, neck: { rot: -6 }, ...bro(-8, -14, -120, -6, -40) }, -14);
const APEX = air({ neck: { rot: 2 }, ...bro(2, -4, -60, 0, -20) }, -6, 0.3);
const FALL = air({ body: { sy: 1.02 }, neck: { rot: 6 }, ...bro(-10, -10, -140, -12, -55) }, 4, 0.1);
const FALL_2 = air({ body: { sy: 1.01 }, neck: { rot: 4 }, ...bro(-6, -6, -125, -8, -40) }, 2, 0.05);

/** Balled up for rolls: knees to the chest, the launcher hugged in, the brother squashed against the back. */
function ball(deg: number, extra: Pose = {}): Pose {
  const pose = aim(
    mix(
      {
        body: { rot: deg, y: 2.2 },
        hip: { y: -0.4 },
        neck: { y: 0.4, rot: 14 },
        thighF: { rot: -110 },
        shinF: { rot: 130 },
        thighB: { rot: -100 },
        shinB: { rot: 125 },
      },
      bro(24, 16, 40, 10, 40),
      extra,
    ),
    deg + 30,
    -0.3,
    0.4,
  );
  return grounded(pose);
}

/** Keys turning `pose(deg)` from `from` to `to` degrees over frames f0 to f1, one key every `every` degrees or so. */
function spin(
  f0: number,
  f1: number,
  from: number,
  to: number,
  pose: (deg: number) => Pose,
  every = 30,
  swaps?: Key['swaps'],
): Key[] {
  const n = Math.max(1, Math.round(Math.abs(to - from) / every));
  return Array.from({ length: n + 1 }, (_, i) =>
    key(f0 + ((f1 - f0) * i) / n, pose(from + ((to - from) * i) / n), {
      ease: 'linear',
      ...(i === 0 && swaps ? { swaps } : {}),
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Walk and run.

/** A step: body offsets, then each sneaker as (x, lift above the floor, sole angle). */
function step(body: Pose, back: [number, number, number], front: [number, number, number], gun = -6): Pose {
  return aim(plant(plant(body, 'B', ...back), 'F', ...front), gun);
}

/** Walk: wading along, the ring bobbing on each step and the brother rocking a beat behind. */
const WALK: [Pose, Pose, Pose, Pose] = [
  step(
    { body: { y: 0.15, rot: 3 }, ring: { y: 0.1 }, ...bro(4, 6, 6, 0, 10) },
    [-0.7, 0.15, 20],
    [1.6, 0, 0],
    -4,
  ),
  step(
    { body: { y: -0.25, rot: 2 }, ring: { y: -0.08 }, ...bro(-2, -2, -6, 0, -6) },
    [0.6, 0.7, 10],
    [0.3, 0, 0],
    -8,
  ),
  step(
    { body: { y: 0.15, rot: 3 }, ring: { y: 0.1 }, ...bro(4, 6, 6, 0, 10) },
    [1.7, 0, 0],
    [-0.6, 0.15, 20],
    -4,
  ),
  step(
    { body: { y: -0.25, rot: 2 }, ring: { y: -0.08 }, ...bro(-2, -2, -6, 0, -6) },
    [0.4, 0, 0],
    [0.6, 0.7, 10],
    -8,
  ),
];

/** Run: leaning in with long strides, the launcher pointed ahead and the brother bouncing with his arm up. */
const LEAN: Pose = { body: { rot: 12 }, neck: { rot: -10 } };
const RUN: [Pose, Pose, Pose, Pose] = [
  step(
    mix(LEAN, { body: { y: 0.35 }, ring: { y: 0.15 }, ...bro(10, 4, -100, 0, 20) }),
    [-1.6, 1.0, 50],
    [2.2, 0, 0],
    4,
  ),
  step(
    mix(LEAN, { body: { y: -0.7 }, ring: { y: -0.15 }, ...bro(2, -8, -140, 0, -30) }),
    [1.7, 1.6, 10],
    [-0.6, 1.4, 60],
    0,
  ),
  step(
    mix(LEAN, { body: { y: 0.35 }, ring: { y: 0.15 }, ...bro(10, 4, -100, 0, 20) }),
    [2.4, 0, 0],
    [-1.5, 1.0, 50],
    4,
  ),
  step(
    mix(LEAN, { body: { y: -0.7 }, ring: { y: -0.15 }, ...bro(2, -8, -140, 0, -30) }),
    [-0.5, 1.4, 60],
    [1.8, 1.6, 10],
    0,
  ),
];

/** A gait loop of four poses: contact, passing, contact and passing on the other leg. */
function cycle(length: number, poses: [Pose, Pose, Pose, Pose], extra: Partial<AnimClip> = {}): AnimClip {
  const q = length / 4;
  return { length, loop: true, keys: poses.map((pose, i) => key(i * q, pose, { ease: 'linear' })), ...extra };
}

// ---------------------------------------------------------------------------------------------------------
// Defence.

/** Shield: hunkered down behind the launcher held across the chest, the brother tucked in behind his head. */
const GUARD = stand(
  { body: { y: 1.0, rot: -4 }, neck: { y: 0.45, rot: 10 }, ring: { y: -0.5 }, ...BRO_DUCK },
  -60,
  [1.8, 0],
  [-1.0, 0],
);

/** Ducking down into the ring for a spot dodge: knees deep, head sunk to the ring, the brother flat behind. */
const DUCK = aim(
  feet(
    {
      body: { y: 2.0, rot: 4, sx: 1.04 },
      neck: { y: 0.7, rot: 4 },
      ring: { y: -1.6 },
      ...bro(30, 20, 40, 10, 20, -0.6),
    },
    [1.8, 0],
    [-1.3, 0],
  ),
  10,
  -0.2,
  0.5,
);

/** Knocked about, then the stars: the shield-break and dizzy sway. */
function sway(deg: number): Pose {
  return stand(
    {
      body: { rot: deg },
      neck: { rot: deg * 1.6 },
      hat: { rot: -deg * 0.8 },
      ...bro(-deg, deg * 2, -80 + deg * 6, 0, -deg * 3),
    },
    50 - deg,
    [1.5, 0],
    [-0.8, 0],
  );
}

/** Recoiling from a hit: thrown back, the hat lifting, the brother flung back with an arm in the air. */
const RECOIL = aloft(
  air(
    {
      body: { rot: -20, x: -0.4 },
      neck: { rot: -14 },
      hat: { y: -0.6, rot: -16 },
      ...BRO_FLUNG,
      armF: { rot: 140 },
      foreF: { rot: 20 },
    },
    50,
    -0.3,
  ),
);

/** Tumbling: spread out and spinning, the body turned `deg` about its middle. */
const tumble = (deg: number): Pose =>
  aloft(
    air(
      {
        body: { rot: deg },
        neck: { rot: -12 },
        thighF: { rot: -10 },
        shinF: { rot: 30 },
        thighB: { rot: 30 },
        shinB: { rot: 20 },
        ...BRO_FLUNG,
      },
      deg + 70,
    ),
  );

/** Lying on his back after a knockdown, the ring around his middle and the brother slumped on top of him. */
const DOWN: Pose = (() => {
  const pose: Pose = {
    body: { rot: -90, x: 1.6, y: 3.9 },
    neck: { rot: -8 },
    thighF: { rot: -40 },
    shinF: { rot: 60 },
    thighB: { rot: -60 },
    shinB: { rot: 80 },
    bro: { x: 1.4, y: -1.6, rot: 70 },
    broHead: { rot: -30 },
    broArmB: { rot: -40 },
    broArmF: { rot: 30 },
    broLeg: { rot: 30 },
  };
  return grounded(aim(pose, 30, 0, 0.2));
})();

// ---------------------------------------------------------------------------------------------------------
// The ledge.

/**
 * Where the hands hold the ledge (rig space): the ledge's top corner while hanging. It matches the engine's hang
 * position, width / 2 + 0.5 out from the corner and 0.85 x height below it (src/sim/movement.ts hangPos).
 */
export const LEDGE_GRIP: [number, number] = [stats.width / 2 + 0.5, -stats.height * 0.85];
const [GX, GY] = LEDGE_GRIP;

const smooth = (u: number) => u * u * (3 - 2 * u);

/** How far past the corner each getup ends: the stance width plus 2 for the climb and attack, a set roll. */
const CLIMB_TO = stats.width / 2 + 2;

/**
 * Where the ledge corner sits in rig space `frame` frames into a climb, roll or attack getup. The engine slides the
 * origin from the hang position to `distance` past the corner along a smoothstep, rising 1.6 times as fast
 * (src/sim/actions/ledge.ts getup), so the corner sweeps back and down towards the feet.
 */
function corner(frame: number, moveEnd: number, distance: number): [number, number] {
  const u = smooth(Math.min(1, frame / moveEnd));
  return [GX - (GX + distance) * u, GY * (1 - Math.min(1, 1.6 * u))];
}

/** The corner `frame` frames into a ledge jump, which rises to a unit above the floor over the jump's rise. */
/**
 * A pose drawn `clear` above the stage `frame` frames into a getup, while the engine still lifts the origin.
 */
function onLip(pose: Pose, frame: number, moveEnd: number, clear = 0.5): Pose {
  return mix(pose, { root: { y: round(corner(frame, moveEnd, 0)[1] - clear) } });
}

/** Knees up and launcher raised: springing off the lip. */
const TUCK = aloft(air({ body: { rot: -6 }, ...BRO_CHEER }, -30, 1));

function jumpCorner(frame: number): [number, number] {
  const u = smooth(Math.min(1, frame / LEDGE_JUMP.rise));
  return [GX - (GX + stats.width / 2) * u, GY + (1 - GY) * u];
}

/** The body's offset from the hands while hanging: chin over the lip, the ring tipped up against the wall. */
const HANG_AT = { x: 1.2, y: -3.7, rot: 8 };

/**
 * Hanging from the corner at (hx, hy) with the chin over the lip: both fists on the edge, legs dangling and the
 * launcher swinging on its strap. The brother clings on, looking up. `lift` raises the body towards the hands
 * and `swing` turns it, for the pull-ups and the idle sway.
 */
function hang(hx = GX, hy = GY, extra: Pose = {}, lift = 0, swing = 0, shift = 0): Pose {
  const pose = mix(
    {
      body: { x: hx - GX + HANG_AT.x + shift, y: hy - GY + HANG_AT.y - lift, rot: HANG_AT.rot + swing },
      neck: { rot: -6 },
      ring: { rot: 16 },
      thighF: { rot: -8 },
      shinF: { rot: 14 },
      thighB: { rot: 14 },
      shinB: { rot: 18 },
      gun: { rot: 100, x: -0.8 },
      ...bro(-6, -20, -30, 0, -20),
    },
    extra,
  );
  return sole(sole(hands(pose, [hx - 0.1, hy + 0.15], [hx - 0.75, hy + 0.2]), 'B', 50), 'F', 40);
}
const HANG = hang();

/** The hang swinging by `rot`, the legs paddling at the wall. */
function paddle(rot: number, kick: number): Pose {
  return hang(
    GX,
    GY,
    {
      thighF: { rot: -8 + kick * 30 },
      shinF: { rot: 14 + kick * 20 },
      thighB: { rot: 14 - kick * 30 },
      shinB: { rot: 18 - kick * 10 },
      ...bro(-6 - rot, -20 + rot * 2, -30 + kick * 40, 0, -20 - kick * 30),
    },
    0,
    rot,
  );
}

/**
 * Pulling up with the fists on the corner at `at`: `lift` raises the body past the hands, `shift` moves it towards
 * the stage, and `knee` (0 to 1) swings the near knee up over the lip.
 */
function pull([cx, cy]: [number, number], lift: number, shift: number, knee: number): Pose {
  return hang(
    cx,
    cy,
    {
      thighF: { rot: -8 - 75 * knee },
      shinF: { rot: 14 + 80 * knee },
      thighB: { rot: 14 - 50 * knee },
      shinB: { rot: 18 + 70 * knee },
      neck: { rot: -6 + 8 * knee },
      ...BRO_DUCK,
    },
    lift,
    10 * knee,
    shift,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Grabs.

/** Holding a grabbed fighter at arm's length, both fists out and the launcher hanging on its strap. */
const HOLD: Pose = hands(
  feet(
    { body: { rot: 6, y: 0.4 }, neck: { rot: -4 }, gun: { rot: 60 }, ...bro(6, -6, -60, 0, 10) },
    [1.9, 0],
    [-0.9, 0],
  ),
  [4.3, -6.2],
  [3.9, -5.7],
);
/** Held by someone: lifted, legs kicking, the brother pulling at his brother's shirt. */
const HELD: Pose = aloft(
  aim(
    mix(
      {
        body: { rot: -8 },
        neck: { rot: -10 },
        thighF: { rot: -30 },
        shinF: { rot: 50 },
        thighB: { rot: 20 },
        shinB: { rot: 40 },
      },
      bro(-12, -16, -150, -20, -40),
    ),
    60,
  ),
);

// ---------------------------------------------------------------------------------------------------------
// The taunt: the brother hoists the rocket overhead while the big kid pumps the launcher in the air.

/** Turns the brother's arms to world angles (degrees; 180 points straight up). */
function broArms(pose: Pose, far: number, near: number): Pose {
  const turn = (bone: string, deg: number) => ({
    rot: round(deg - rotOf(pose, bone) + (pose[bone]?.rot ?? 0)),
  });
  return mix(pose, { broArmB: turn('broArmB', far), broArmF: turn('broArmF', near) });
}

/**
 * The rocket held up behind the brother's head: his far arm raised up and back with the fist round the tail, his
 * near arm punching the air. The rocket leans `tilt` degrees (negative: nose back).
 */
function rocketUp(pose: Pose, tilt: number, wave: number): Pose {
  const held = broArms(pose, 145 + tilt / 2, 205 + wave);
  const [hx, hy] = at(held, 'broArmB', 0, BRO_ARM);
  const S = 0.7;
  const t = tilt / DEG;
  const grip = 1.1 * S;
  return mix(held, {
    rocket: { x: round(hx - grip * Math.sin(t)), y: round(hy + grip * Math.cos(t)), rot: tilt, sx: S, sy: S },
  });
}

/** The taunt: the big kid pumps the launcher skywards while his brother shows off the rocket. */
function tauntPose(pump: number): Pose {
  const base = stand(
    { body: { y: -0.15 * pump }, neck: { rot: -8 - 4 * pump }, ...bro(-4, -16, 0, 0, -20, 0.9 + 0.5 * pump) },
    -60 - pump * 20,
  );
  return rocketUp(base, -28 + 8 * pump, 12 * pump);
}

// ---------------------------------------------------------------------------------------------------------

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 120,
    loop: true,
    keys: [
      key(0, STAND),
      key(30, BREATHE),
      key(60, STAND),
      key(76, LOOK, { swaps: LOOK_UP }),
      key(94, STAND, { swaps: {} }),
      key(104, undefined, { swaps: BLINK }),
      key(108, undefined, { swaps: {} }),
    ],
  },
  walk: cycle(32, WALK),
  dash: {
    length: 10,
    swaps: { fx1: 'fxPuff' },
    keys: [
      key(
        0,
        mix(step({ body: { rot: 16, y: 0.6 }, ...bro(14, 8, -60, 0, 30) }, [-1.6, 0, 20], [1.0, 0, 0], 6), {
          fx1: fx(-2.4, -0.8, 0.9),
        }),
        {
          ease: 'out',
        },
      ),
      key(4, mix(RUN[1], { fx1: fx(-3.6, -1.1, 0.6) }), { ease: 'linear' }),
      key(10, mix(RUN[2], { fx1: fx(-4.6, -1.4, 0.2) })),
    ],
  },
  run: cycle(16, RUN, { swaps: SHOUT }),
  runBrake: {
    length: 14,
    swaps: { ...GRIT, fx1: 'fxPuff' },
    keys: [
      key(
        0,
        mix(
          stand(
            { body: { rot: -14, y: 0.6 }, neck: { rot: 10 }, ...bro(20, 10, -150, 0, 40) },
            10,
            [-0.2, 0],
            [2.8, 0],
          ),
          { fx1: fx(3.2, -0.7, 0.8) },
        ),
        {
          ease: 'out',
        },
      ),
      key(
        8,
        mix(stand({ body: { rot: -5, y: 0.3 }, ...bro(8, 4, -40, 0, 10) }, 0, [0.4, 0], [2.0, 0]), {
          fx1: fx(4.2, -1.1, 0.35),
        }),
      ),
      key(9, undefined, { swaps: {} }),
      key(14, STAND),
    ],
  },
  turn: {
    length: 8,
    keys: [
      key(0, mix(STAND, { body: { sx: -1 } }), { ease: 'in' }),
      key(3, mix(STAND, { body: { sx: -0.2, sy: 1.03 } }), { ease: 'step', swaps: BLINK }),
      key(4, mix(STAND, { body: { sx: 0.2, sy: 1.03 } }), { ease: 'out' }),
      key(6, undefined, { swaps: {} }),
      key(8, STAND),
    ],
  },
  crouch: { length: 6, keys: [key(0, STAND, { ease: 'out' }), key(6, CROUCH)] },
  jumpSquat: { length: 3, keys: [key(0, STAND, { ease: 'out' }), key(3, SQUAT)] },
  jump: {
    length: 40,
    keys: [
      key(0, aloft(RISE), { ease: 'out', swaps: { ...LOOK_UP, broFace: 'broCheer' } }),
      key(18, aloft(mix(RISE, { body: { sy: 1.0, sx: 1.0 } }))),
      key(40, aloft(APEX), { swaps: {} }),
    ],
  },
  doubleJump: {
    length: 30,
    swaps: HAPPY,
    keys: shortTurns([
      ...spin(0, 16, 0, 280, (deg) => aloft(ball(deg), 0.3)),
      key(22, aloft(mix(APEX, { body: { rot: 360 } })), { swaps: {} }),
      key(30, aloft(mix(APEX, { body: { rot: 360 } }))),
    ]),
  },
  fall: {
    length: 40,
    loop: true,
    swaps: { broFace: 'broShout' },
    keys: [key(0, aloft(FALL)), key(20, aloft(FALL_2))],
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: { ...SCARED, ...OPEN },
    keys: [
      key(
        0,
        aloft(
          hands(
            air({ body: { rot: -8 }, gun: { rot: 70 }, ...bro(-20, -20, -170, -40, -60) }, 60),
            [3.2, -10.8],
            [-2.2, -10.6],
            1,
            1,
          ),
        ),
      ),
      key(
        16,
        aloft(
          hands(
            air({ body: { rot: 6 }, gun: { rot: 85 }, ...bro(-8, -8, -150, -30, -30) }, 75),
            [3.6, -10.2],
            [-2.6, -10.0],
            1,
            1,
          ),
        ),
      ),
    ],
  },
  land: {
    length: 4,
    swaps: { fx1: 'fxPuff', fx2: 'fxPuff' },
    keys: [
      key(0, mix(SQUAT, { fx1: fx(-2.8, -0.6, 0.6), fx2: fx(3.2, -0.6, 0.6) }), { ease: 'out' }),
      key(4, mix(STAND, { fx1: fx(-3.8, -0.9, 0.2), fx2: fx(4.2, -0.9, 0.2) })),
    ],
  },
  shield: { length: 6, swaps: GRIT, keys: [key(0, STAND, { ease: 'out' }), key(6, GUARD)] },
  shieldDrop: {
    length: 11,
    keys: [key(0, GUARD, { ease: 'out', swaps: GRIT }), key(7, undefined, { swaps: {} }), key(11, STAND)],
  },
  shieldBreak: {
    length: 40,
    swaps: { ...DIZZY, ...OPEN, fx2: 'fxSpark' },
    keys: [
      key(0, mix(GUARD, { fx2: fx(2.2, -8.0, 0.4) }), { ease: 'out' }),
      key(
        8,
        aloft(
          mix(
            air(
              { body: { rot: -14, y: -2.0 }, neck: { rot: -18 }, hat: { y: -1.2, rot: -24 }, ...BRO_FLUNG },
              70,
              0.2,
            ),
            { fx2: fx(2.0, -12.0, 1.1, 20) },
          ),
        ),
        { ease: 'inOut' },
      ),
      key(16, undefined, { swaps: { ...DIZZY, ...OPEN, fx2: null } }),
      key(
        26,
        aloft(
          air(
            {
              body: { rot: 4, y: -0.8 },
              neck: { rot: 8 },
              hat: { y: -0.4, rot: -8 },
              ...bro(4, 10, -60, 0, -10),
            },
            60,
          ),
        ),
      ),
      key(40, sway(-6)),
    ],
  },
  dizzy: {
    length: 60,
    loop: true,
    swaps: { ...DIZZY, ...OPEN, fx1: 'fxStar', fx2: 'fxStar' },
    keys: [
      key(0, mix(sway(-7), { fx1: fx(-1.6, -13.2, 0.5, 0), fx2: fx(2.6, -12.4, 0.4, 0) })),
      key(15, mix(sway(0), { fx1: fx(0.4, -13.8, 0.4, 45), fx2: fx(0.6, -12.0, 0.5, 45) })),
      key(30, mix(sway(7), { fx1: fx(2.6, -13.2, 0.5, 90), fx2: fx(-1.4, -12.4, 0.4, 90) })),
      key(45, mix(sway(0), { fx1: fx(0.6, -12.6, 0.4, 135), fx2: fx(0.4, -13.8, 0.5, 135) })),
      key(60, mix(sway(-7), { fx1: fx(-1.6, -13.2, 0.5, 180), fx2: fx(2.6, -12.4, 0.4, 180) })),
    ],
  },
  spotDodge: {
    length: 27,
    swaps: BLINK,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, DUCK, { ease: 'inOut' }),
      key(17, DUCK),
      key(20, undefined, { swaps: {} }),
      key(27, STAND),
    ],
  },
  rollForward: {
    length: 31,
    keys: [
      key(0, CROUCH, { ease: 'in', swaps: BLINK }),
      ...spin(2, 22, 20, 380, ball, 30, { ...BLINK, broFace: 'broScared' }),
      key(24, undefined, { swaps: {} }),
      key(26, mix(CROUCH, { body: { rot: 364, y: 1.5 } }), { ease: 'out' }),
      key(31, mix(STAND, { body: { rot: 360 } })),
    ],
  },
  rollBack: {
    length: 31,
    keys: [
      key(0, CROUCH, { ease: 'in', swaps: BLINK }),
      ...spin(2, 22, -20, -380, ball, 30, { ...BLINK, broFace: 'broScared' }),
      key(24, undefined, { swaps: {} }),
      key(26, mix(CROUCH, { body: { rot: -364, y: 1.5 } }), { ease: 'out' }),
      key(31, mix(STAND, { body: { rot: -360 } })),
    ],
  },
  airDodge: {
    length: 49,
    swaps: BLINK,
    keys: [
      key(0, aloft(APEX), { ease: 'out' }),
      key(2, aloft(air({ body: { rot: -10 } }, -10, 0.6), 0.15), { ease: 'linear' }),
      key(4, aloft(ball(-24, { body: { sx: 0.92 } }), 0.2), { ease: 'inOut' }),
      key(30, aloft(ball(-12, { body: { sx: 0.95 } }), 0.2), { ease: 'inOut' }),
      key(35, aloft(air({ body: { rot: -10 } }, 0, 1), 0.15), { ease: 'linear' }),
      key(36, undefined, { swaps: {} }),
      key(40, aloft(air({ body: { rot: -6 }, ...bro(-4, -4, -100, -6, -30) }, 10, 0.7)), { ease: 'inOut' }),
      key(49, aloft(FALL)),
    ],
  },
  ledgeCatch: retimeClip(
    {
      length: 8,
      swaps: { ...SHOUT, ...OPEN },
      keys: [
        key(0, hang(GX, GY + 1.2, { body: { x: 2.3, y: -1.5, rot: 4 } }), { ease: 'outBack' }),
        key(8, HANG),
      ],
    },
    LEDGE_CATCH_FRAMES,
  ),
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: { ...GRIT, broFace: 'broUp' },
    keys: [
      key(0, HANG),
      key(15, paddle(-2, 0.5)),
      key(30, paddle(1, -0.4)),
      key(34, undefined, { swaps: { ...BLINK } }),
      key(38, undefined, { swaps: {} }),
      key(45, paddle(2, 0.4)),
      key(60, HANG),
    ],
  },
  ledgeClimb: {
    length: 34,
    swaps: GRIT,
    keys: [
      key(0, HANG, { ease: 'linear' }),
      key(6, pull(corner(6, LEDGE_CLIMB.moveEnd, CLIMB_TO), 1, 0, 0.4), { ease: 'linear' }),
      key(10, pull(corner(10, LEDGE_CLIMB.moveEnd, CLIMB_TO), 3, 1.0, 1), { ease: 'out' }),
      key(13, onLip(CLIMB, 13, LEDGE_CLIMB.moveEnd), { ease: 'linear' }),
      key(18, CLIMB, { ease: 'out', swaps: BLINK }),
      key(24, CROUCH, { ease: 'inOut', swaps: {} }),
      key(34, STAND),
    ],
  },
  /** The keys up to the roll's moveEnd follow the engine's path; only the stand-up after them fits its last frames. */
  ledgeRoll: retimeClip(
    {
      length: 50,
      swaps: GRIT,
      keys: [
        key(0, HANG, { ease: 'linear' }),
        key(6, pull(corner(6, LEDGE_ROLL.moveEnd, LEDGE_ROLL.distance), 1, 0, 0.5), { ease: 'linear' }),
        ...spin(
          10,
          34,
          120,
          540,
          (deg) =>
            mix(ball(deg), { root: { y: corner(10 + ((deg - 120) * 24) / 420, LEDGE_ROLL.moveEnd, 0)[1] } }),
          30,
          {
            ...BLINK,
            broFace: 'broScared',
          },
        ),
        key(37, mix(CROUCH, { body: { rot: 720, y: 1.5 } }), { ease: 'out', swaps: {} }),
        key(50, mix(STAND, { body: { rot: 720 } })),
      ],
    },
    LEDGE_ROLL.faf - 1,
    [[LEDGE_ROLL.moveEnd, LEDGE_ROLL.moveEnd]],
  ),
  ledgeJump: {
    length: 20,
    swaps: { ...SHOUT, ...OPEN },
    keys: [
      key(0, HANG, { ease: 'in' }),
      key(2, pull(jumpCorner(2), 3, 0, 1), { ease: 'out' }),
      key(3, mix(TUCK, { root: { y: round(jumpCorner(3)[1] - 0.3) } }), { ease: 'out' }),
      key(5, TUCK, { ease: 'out' }),
      key(8, aloft(RISE), { ease: 'out', swaps: { ...LOOK_UP, broFace: 'broCheer' } }),
      key(20, aloft(mix(RISE, { body: { sy: 1.0 } }))),
    ],
  },
  ledgeAttack: {
    length: 55,
    swaps: GRIT,
    keys: shortTurns([
      key(0, HANG, { ease: 'linear' }),
      key(4, pull(corner(4, LEDGE_ATTACK.moveEnd, CLIMB_TO), 2.5, 0.6, 0.9), { ease: 'out' }),
      key(7, onLip(CLIMB, 7, LEDGE_ATTACK.moveEnd), { ease: 'linear' }),
      key(14, CLIMB, { ease: 'out', swaps: GRIT }),
      key(17, stand({ body: { rot: 2, y: 0.7 }, ...bro(0, -4, -80, 0, -4) }, -40, [1.0, 0], [-0.9, 0]), {
        ease: 'linear',
      }),
      key(20, stand({ body: { rot: -10 }, ...bro(-6, -10, -120, 0, -10) }, -80, [0.4, 0], [-1.2, 0]), {
        ease: 'in',
        swaps: SHOUT,
      }),
      key(26, stand({ body: { rot: 14 }, ...bro(12, 8, -40, 0, 20) }, 40, [2.4, 0], [-0.8, 0]), {
        ease: 'out',
      }),
      key(32, undefined, { swaps: GRIN }),
      key(55, STAND),
    ]),
  },
  hitstun: {
    length: 20,
    swaps: { ...HURT, ...OPEN },
    keys: [
      key(0, RECOIL, { ease: 'out' }),
      key(12, mix(RECOIL, { body: { rot: -12 }, hat: { y: -0.3, rot: -8 } })),
      key(20, aloft(FALL), { swaps: { ...HURT } }),
    ],
  },
  tumble: {
    length: 30,
    loop: true,
    swaps: { ...HURT, ...OPEN },
    keys: [...spin(0, 30, 0, -360, tumble, 15)],
  },
  down: {
    length: 40,
    loop: true,
    swaps: { ...DIZZY, ...OPEN },
    keys: [
      key(0, DOWN),
      key(20, mix(DOWN, { neck: { rot: -14 }, broHead: { rot: -38 }, thighF: { rot: -46 } })),
    ],
  },
  techInPlace: {
    length: 26,
    swaps: GRIT,
    keys: [
      key(0, ball(-60), { ease: 'out', swaps: BLINK }),
      key(8, SQUAT, { ease: 'out', swaps: GRIT }),
      key(14, stand({ neck: { rot: -6 }, ...BRO_CHEER }, -30), { swaps: HAPPY }),
      key(20, undefined, { swaps: {} }),
      key(26, STAND),
    ],
  },
  techRoll: {
    length: 40,
    keys: [
      ...spin(0, 24, -60, 300, ball, 30, { ...BLINK, broFace: 'broScared' }),
      key(28, mix(CROUCH, { body: { rot: 364, y: 1.5 } }), { ease: 'out', swaps: GRIT }),
      key(40, mix(STAND, { body: { rot: 360 } }), { swaps: {} }),
    ],
  },
  getupStand: {
    length: 29,
    swaps: BLINK,
    keys: [
      key(0, DOWN, { ease: 'inOut' }),
      key(10, grounded(mix(SQUAT, { body: { rot: -40, x: 1.0 } })), { ease: 'out', swaps: GRIT }),
      key(18, CROUCH, { ease: 'inOut', swaps: GRIT }),
      key(29, STAND),
    ],
  },
  grabHold: {
    length: 30,
    loop: true,
    swaps: GRIT,
    keys: [key(0, HOLD), key(15, mix(HOLD, { body: { rot: 8, y: 0.5 }, bro: { rot: 10 } }))],
  },
  grabbed: {
    length: 20,
    loop: true,
    swaps: { ...SCARED, ...OPEN_B },
    keys: [
      key(0, HELD),
      key(
        10,
        mix(HELD, {
          thighF: { rot: 0 },
          shinF: { rot: 20 },
          thighB: { rot: -20 },
          shinB: { rot: 60 },
          broArmB: { rot: -110 },
        }),
      ),
    ],
  },
  grabRelease: {
    length: 30,
    swaps: SCARED,
    keys: [
      key(
        0,
        stand({ body: { rot: -14, x: -0.6 }, neck: { rot: -10 }, ...BRO_FLUNG }, 40, [0.6, 0], [-2.0, 0]),
        { ease: 'out' },
      ),
      key(
        12,
        stand({ body: { rot: -4, x: -0.3, y: 0.6 }, ...bro(4, 4, -60, 0, 0) }, 20, [1.2, 0], [-1.4, 0]),
        { ease: 'inOut', swaps: GRIT },
      ),
      key(30, STAND, { swaps: {} }),
    ],
  },
  taunt: {
    length: 60,
    keys: [
      key(0, STAND, { ease: 'out', swaps: GRIN }),
      key(8, tauntPose(0), { ease: 'out', swaps: { ...HAPPY, ...ROCKET } }),
      key(16, tauntPose(1), { ease: 'inOut' }),
      key(24, tauntPose(0)),
      key(32, tauntPose(1)),
      key(40, tauntPose(0)),
      key(48, tauntPose(1), { ease: 'in' }),
      key(52, undefined, { swaps: GRIN }),
      key(60, STAND, { swaps: GRIN }),
    ],
  },
  respawn: {
    length: 60,
    swaps: HAPPY,
    keys: [
      key(0, stand({ ...BRO_CHEER }, -40), { ease: 'inOut' }),
      key(10, stand({ body: { y: 0.3 }, ...bro(6, 0, -120, 0, -10, 0.2) }, -55)),
      key(20, stand({ ...BRO_CHEER }, -40)),
      key(30, stand({ body: { y: 0.3 }, ...bro(6, 0, -120, 0, -10, 0.2) }, -55)),
      key(40, stand({ ...BRO_CHEER }, -40), { swaps: GRIN }),
      key(60, STAND),
    ],
  },
};

/** Angles of the pose helpers, for the tests. */
export const authored = { STAND, HANG, rotOf, grip };
