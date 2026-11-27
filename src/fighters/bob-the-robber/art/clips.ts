import { pointOf, type Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import { retimeClip } from '../../../render/rig/timing';
import type { AnimClip, Key } from '../../../render/rig/types';
import {
  AIR,
  ANGRY,
  ARMS_OVER_HEAD,
  BLINK,
  BREATHE,
  CROUCH,
  DOWN,
  FRONT,
  FRONT_ARM_OVER_HEAD,
  FRONT_BLINK,
  FRONT_DAZED,
  FRONT_WIDE,
  HURT,
  READY,
  SACK,
  SIDE,
  STAND,
  TUCK,
  WIDE,
  aim,
  continuous,
  feet,
  floor,
  floorContact,
  between,
  fx,
  grounded,
  hands,
  key,
  lift,
  mix,
  worldRot,
  type Pt,
} from './poses';
import { attacks, crouchWith, ledgeSweep } from './attacks';
import { finalSmashClips } from './finalSmash';
import { FORE_ARM, SHIN, THIGH, UPPER_ARM, shoe } from './parts';
import { rig } from './rig';
import { shadowStepClips } from './shadowStep';
import { stunGunClips } from './stunGun';

/**
 * Where the hands hold the ledge (rig space): the ledge's top corner while hanging. It matches the engine's hang
 * position (half the width + 0.5 out from the corner, 0.85 x height below it).
 */
export const LEDGE_GRIP: [number, number] = [4.75, -12.325];
const [GX, GY] = LEDGE_GRIP;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Where the ledge's corner is in rig space `frame` frames into a getup that ends its move at `moveEnd` and
 * finishes `inward` past the corner: the engine slides the origin across with a smoothstep and lifts it
 * 1.6 times as fast, so hands planted on the corner ride down and back as Bob comes up.
 */
function corner(frame: number, moveEnd: number, inward: number): Pt {
  const t = smooth(Math.min(1, frame / moveEnd));
  return [GX - (GX + inward) * t, GY * (1 - Math.min(1, 1.6 * t))];
}

const rad = (deg: number) => (deg * Math.PI) / 180;

const shoeOutline = flattenPath(shoe[0]!.d, 12)[0]!;

/** How far the rotated shoe extends below the ankle. */
function soleDepth(deg: number): number {
  const [s, c] = [Math.sin(rad(deg)), Math.cos(rad(deg))];
  let depth = -Infinity;
  for (let i = 0; i < shoeOutline.length; i += 2) {
    depth = Math.max(depth, shoeOutline[i]! * s + shoeOutline[i + 1]! * c);
  }
  return depth;
}

/** A foot: `x` and the shoe's tilt, or `up` units lifted clear of the floor. */
type Step = { x: number; tilt?: number; up?: number };
const ankleOf = ({ x, tilt = 0, up = 0 }: Step): Pt => [x, -soleDepth(tilt) - up];

/** Fit the ankles to the step targets. A little rubber-hose stretch on the long strides keeps the soles planted. */
function stance(pose: Pose, back: Step, front: Step, bowed = false): Pose {
  const ankles = [ankleOf(back), ankleOf(front)] as const;
  let fit = pose;
  for (const [i, side] of ['B', 'F'].entries()) {
    const [x, y] = ankles[i]!;
    const thigh = 'thigh' + side;
    const shin = 'shin' + side;
    const [hx, hy] = pointOf(rig, fit, thigh);
    const k = Math.max(1, Math.hypot(x - hx, y - hy) / (THIGH + SHIN) + 0.015);
    fit = mix(fit, { [thigh]: { sy: k }, [shin]: { sy: k } });
  }
  return feet(fit, ...ankles, bowed, [back.tilt ?? 0, front.tilt ?? 0]);
}

const GRIP = { ...SIDE, handF: 'ledgeGripHand' };
const TWO_GRIPS = { ...GRIP, handB: 'ledgeGripHand' };
const RELEASE = { ...SIDE, handF: 'handOpen', handB: 'handOpen' };
const GRIP_ORDER = { handF: FRONT_ARM_OVER_HEAD.handF!, handB: FRONT_ARM_OVER_HEAD.handF! - 0.01 };

/** Extend the striped sleeves only as far as needed to put the wrists over the lip. */
function gripHands(pose: Pose, front: Pt, back: Pt | null, angle = -30): Pose {
  const fit = (p: Pose, side: 'F' | 'B', [x, y]: Pt) => {
    const arm = 'arm' + side;
    const [sx, sy] = pointOf(rig, p, arm);
    const k = Math.max(1, Math.hypot(x - sx, y - sy) / (UPPER_ARM + FORE_ARM) + 0.06);
    return mix(p, { [arm]: { sy: k }, ['fore' + side]: { sy: k } });
  };
  let p = aim(hands(fit(pose, 'F', front), null, front, -1), 'handF', angle);
  if (back) p = aim(hands(fit(p, 'B', back), back, null, -1), 'handB', -18);
  return p;
}

/** Hang from the near hand. The far arm and legs can still swing when he catches the lip. */
function hang(extra: Pose = {}): Pose {
  return gripHands(
    mix(
      {
        body: { x: 0.1, y: -2.6, rot: -3 },
        neck: { rot: 7 },
        armB: { rot: 14 },
        foreB: { rot: -47 },
        thighF: { rot: -22 },
        shinF: { rot: 35 },
        thighB: { rot: 19 },
        shinB: { rot: 16 },
        footF: { rot: 20 },
        footB: { rot: 7 },
      },
      extra,
    ),
    [GX - 0.35, GY - 0.84],
    null,
  );
}

const HANG = hang();
const hangStep = (bone: string) => {
  const [x, y] = pointOf(rig, HANG, bone);
  const tilt = worldRot(HANG, bone);
  return [x - GX, GY - y - soleDepth(tilt), tilt] as const;
};

/** Hip and feet relative to the ledge, then lean and knee lift. Front ankle clears the wall before crossing it. */
const CLIMB_BEATS = [
  [0, -4.51, 6.88, -3, ...hangStep('footB'), ...hangStep('footF')],
  [3, -3.1, 4.5, 5, -4.2, -6.9, 26, -2.95, -5.7, 32],
  [6, -1.95, 2.3, 15, -3.1, -4.3, 27, -2.3, -2.45, -18],
  [8, -1.25, 0.6, 18, -2.85, -2.5, 31, -1.73, 0.12, -16],
  [9, 0.25, 0.25, 18, -1.75, -1.8, 28, 2.5, 0, 2],
  [11, 1.35, -1.32, 18, -1.65, 0.27, -13, 2.75, 0, 0],
  [12, 2.15, -1.82, 17, 0.5, 0, 22, 3.25, 0, 0],
  [15, 3.3, -2.58, 9, 1.4, 0, 12, 4.3, 0, 0],
  [18, 4.7, -2.65, 4, 3.0, 0, 0, 5.75, 0, 0],
  [26, 6.15, -2.65, 4, 4.65, 0, 0, 7.65, 0, 0],
] as const;

/** The phase from which both feet are on top and the legs are fitted to their steps. */
const ON_TOP = 12;
/** Phases the back hand takes to reach up to the corner from the hang, and so when it grips. */
const REACH = 6;
/** Phases the hands take to let go of the corner and come down to his sides once he is on top. */
const LET_GO = 6;

const LEGS = ['thighB', 'shinB', 'footB', 'thighF', 'shinF', 'footF'] as const;
const ARMS = ['armB', 'foreB', 'handB', 'armF', 'foreF', 'handF'] as const;

/**
 * Leg turns while he pulls himself up, before both feet are on top (thigh, shin and foot, back then front), by
 * phase: from the hang, the knees come up against the wall and the front one up to the top, then ease into the
 * crouch on top. Fitted to the beats' foot targets instead, the legs folded up in two or three frames and a knee
 * flipped round as its foot passed the hip, turning a leg up to 156 degrees a frame.
 */
const CLIMB_LEGS: [number, number[]][] = [
  [0, LEGS.map((bone) => HANG[bone]?.rot ?? 0)],
  [4, [-15, 75, -40, -60, 95, -20]],
  [8, [-30, 110, -70, -90, 125, -45]],
];

/** The legs at `phase` before he is on top, easing from CLIMB_LEGS into `onTop`, the legs fitted on top. */
function climbLegs(phase: number, onTop: Pose): Pose {
  const table: [number, number[]][] = [...CLIMB_LEGS, [ON_TOP, LEGS.map((bone) => onTop[bone]?.rot ?? 0)]];
  const i = table.findIndex(([p]) => p > phase);
  const [[p0, a], [p1, b]] = [table[i - 1]!, table[i]!];
  const t = (phase - p0) / (p1 - p0);
  const stretch = (bone: string) =>
    1 + ((onTop[bone]?.sy ?? 1) - 1) * Math.max(0, (phase - 8) / (ON_TOP - 8));
  return Object.fromEntries(
    LEGS.map((bone, j) => {
      const d = b[j]! - a[j]!;
      return [bone, { rot: a[j]! + (d - 360 * Math.round(d / 360)) * t, sy: stretch(bone) }];
    }),
  );
}

/** The beats at `phase`, between the two around it. */
function beatAt(phase: number): (typeof CLIMB_BEATS)[number] {
  const i = CLIMB_BEATS.findIndex(([f]) => f > phase);
  const a = CLIMB_BEATS[i - 1] ?? CLIMB_BEATS.at(-1)!;
  const b = CLIMB_BEATS[i] ?? a;
  const t = a === b ? 0 : (phase - a[0]) / (b[0] - a[0]);
  return a.map((v, j) => v + (b[j]! - v) * t) as unknown as typeof a;
}

/** The body and legs at `phase` from the beats, the feet fitted to their steps, beside the corner at (cx, cy). */
function climbStance(phase: number, cx: number, cy: number): Pose {
  const [, dx, dy, rot, bx, by, bt, x, y, tilt] = beatAt(phase);
  return stance(
    {
      body: { x: cx + dx + 2.65 * Math.sin(rad(rot)), y: cy + dy + 5.5 - 2.65 * Math.cos(rad(rot)), rot },
      neck: {
        rot: 8 - rot,
        x: -1.05 * Math.max(0, 1 - Math.abs(phase - 5) / 5),
        y: Math.max(0, 1 - Math.abs(phase - 11) / 5),
      },
      armB: { rot: 14 },
      foreB: { rot: -47 },
    },
    { x: cx + bx, up: by - cy, tilt: bt },
    { x: cx + x, up: y - cy, tilt },
  );
}

/** Climb drawing before and after the feet are on top. Grip targets follow the engine's moving corner. */
function climb(frame: number, moveEnd: number, inward: number, phase = frame): Pose {
  const [cx, cy] = corner(frame, moveEnd, inward);
  const fitted = climbStance(phase, cx, cy);
  const base = phase < ON_TOP ? mix(fitted, climbLegs(phase, climbStance(ON_TOP, cx, cy))) : fitted;
  const grip = (at: number) => {
    const push = Math.max(0, (Math.min(at, ON_TOP) - 9) / 3);
    const front: Pt = [cx - 0.35 + 2 * push, cy - 0.84];
    const [wx, wy] = pointOf(rig, base, 'handB');
    const approach = smooth(Math.min(1, at / REACH));
    const back: Pt = [wx + (cx + 0.66 - 0.3 * push - wx) * approach, wy + (cy - 0.75 - wy) * approach];
    return gripHands(base, front, back, -30 + 20 * push);
  };
  if (phase < REACH) {
    // The back arm swings up from the hang to its grip: slid straight to the corner, the hand passed the shoulder
    // and the arm turned up to 115 degrees in a frame.
    const reached = grip(REACH);
    const t = phase / REACH;
    const backArm = Object.fromEntries(
      (['armB', 'foreB', 'handB'] as const).map((bone) => {
        const [a, b] = [HANG[bone]?.rot ?? 0, reached[bone]?.rot ?? 0];
        const d = b - a;
        const [sa, sb] = [HANG[bone]?.sy ?? 1, reached[bone]?.sy ?? 1];
        return [bone, { rot: a + (d - 360 * Math.round(d / 360)) * t, sy: sa + (sb - sa) * t }];
      }),
    );
    return mix(grip(phase), backArm);
  }
  if (phase <= ON_TOP) return grip(phase);
  const [, dx, dy] = beatAt(phase);
  // The front fist comes off the corner to his hip rather than up to his chest: the forearm turns 75 degrees
  // instead of half a turn, which could go either way round. READY raises it after the climb.
  const stood = hands(base, [cx + dx - 1.7, cy + dy - 0.95], [cx + dx + 2.3, cy + dy - 1.0], -1);
  if (phase >= ON_TOP + LET_GO) return stood;
  // Letting go of the corner evenly over a few phases: at once, the forearms turned up to 107 degrees in a frame.
  const blend = between(grip(phase), stood, (phase - ON_TOP) / LET_GO);
  return mix(stood, Object.fromEntries(ARMS.map((bone) => [bone, blend[bone] ?? {}])));
}

/**
 * Walk: the tip-toe sneak of the in-game sprite (ingame-walk-01). He leans in, keeps both fists up at chest
 * height, sets each foot down toe-first with the heel lifted, and brings the swinging leg through with a high
 * knee; the head rocks a few degrees on every step.
 */
const WALK_LENGTH = 16;
/**
 * Walk frames drawn by the tween from the frames either side rather than fitted: on them the swinging foot passes
 * close under its hip, and the short folded leg's thigh flipped up to 85 degrees in a frame (the front shin turns
 * 127 degrees from frame 12 to 14, so it needs four frames).
 */
const WALK_TWEENED = [3, 12, 13, 14];

function sneak(frame: number): Pose {
  const half = WALK_LENGTH / 2;
  const t = (frame % half) / half;
  const step = Math.sin(Math.PI * t);
  const sway = Math.cos((2 * Math.PI * frame) / WALK_LENGTH);
  const planted = { x: 2.05 - 4.15 * t, tilt: 14 + 30 * t ** 4 };
  const swinging = { x: -2.1 + 4.15 * smooth(t), tilt: 44 - 30 * t, up: 0.55 * step };
  const [back, front] = frame < half ? [swinging, planted] : [planted, swinging];
  const base = stance(
    { body: { rot: 8 }, hip: { y: 0.52 - 0.3 * step }, neck: { rot: -8 + 6 * sway } },
    back,
    front,
  );
  const wrists = hands(
    base,
    [-3.2 - 0.36 * sway, -5.3 + 0.37 * sway],
    [3.65 - 0.38 * sway, -5.3 - 0.37 * sway],
    -1,
  );
  return aim(aim(wrists, 'handB', -30 + 15 * sway), 'handF', -38 - 15 * sway);
}

/**
 * Run: the getaway sprint from the title screen. Leaning in, the loot sack slung over his shoulder in the back
 * fist, the front fist pumping, legs cycling under him.
 */
const RUN_LOOK = { ...SIDE, ...SACK };
const CARRY_ORDER = { sack: 2.5 };

/** The wrist moves with the shoulder; the load swings independently around the knot in the fist. */
function carry(pose: Pose, angle: number, scale = 1, scoop = 1): Pose {
  const [sx, sy] = pointOf(rig, pose, 'armB');
  const wrist: Pt = [sx - 0.7 - 1.05 * scoop, sy + 1.65 - 2.65 * scoop];
  const grip = aim(hands(pose, wrist, null), 'handB', 35);
  return aim(mix(grip, { sackH: { sx: 1.08 * scale, sy: 1.16 * scale } }), 'sackH', angle);
}

const STRIDE_LENGTH = 22;
function stride(frame: number): Pose {
  const half = STRIDE_LENGTH / 2;
  const t = (frame % half) / half;
  const plant = t < 0.39;
  const launch = plant ? 0 : (t - 0.39) / 0.61;
  const swing = Math.cos((2 * Math.PI * frame) / STRIDE_LENGTH);
  const lead = { x: 2.55 - 5.05 * t, tilt: -14 + 62 * t, up: 0.9 * Math.sin(Math.PI * launch) };
  const trail = { x: -2.5 + 5.05 * smooth(t), tilt: 48 - 62 * t, up: 0.92 * Math.sin(Math.PI * t) };
  const base = stance(
    {
      body: {
        rot: 19,
        x: 0.5,
        y: 0.24 + (plant ? 0.42 * Math.sin((Math.PI * t) / 0.39) : -0.84 * Math.sin(Math.PI * launch)),
      },
      neck: { rot: -14 - 3 * swing },
      armF: { rot: 48 * swing },
      foreF: { rot: -76 - 12 * swing },
    },
    frame < half ? trail : lead,
    frame < half ? lead : trail,
  );
  const lag = (2 * Math.PI * (frame - 2)) / half;
  return carry(base, 56 + 8 * Math.sin(lag), 1 - 0.05 * Math.max(0, Math.cos(lag)));
}

/** Falling: arms up and out, legs reaching for the floor. */
const FALL = hands(
  mix(AIR, {
    thighF: { rot: -10 },
    shinF: { rot: 15 },
    thighB: { rot: 10 },
    shinB: { rot: 10 },
    footF: { rot: 15 },
  }),
  [-3.6, -8.73],
  [3.4, -9.18],
);
const FALL_2 = hands(FALL, [-3.8, -8.05], [3.6, -8.5]);

/** Rising out of a jump: stretched tall, arms thrown up, legs trailing. */
const RISE = hands(
  mix(AIR, {
    body: { sx: 0.95, sy: 1.07 },
    thighF: { rot: -8 },
    shinF: { rot: 12 },
    thighB: { rot: 12 },
    shinB: { rot: 16 },
    footF: { rot: 30 },
    footB: { rot: 40 },
  }),
  [-3.9, -9.81],
  [3.9, -10.11],
);

/** Jump apex: weightless, knees up, arms floating. */
const APEX = hands(
  mix(AIR, { thighF: { rot: -55 }, shinF: { rot: 85 }, thighB: { rot: -30 }, shinB: { rot: 75 } }),
  [-3.4, -6.7],
  [3.6, -7.38],
);

/** Braced behind the bubble: crouched, head pulled in, fists up in front of his chest. */
const SHIELD = hands(
  feet({ hip: { y: 0.63 }, neck: { y: 0.45, rot: 6 }, body: { rot: 4 } }, floor(-1.6), floor(1.6)),
  [1.4, -4.55],
  [3.0, -4.82],
  -1,
);

/**
 * Ducked under the spot dodge, facing the camera, hips at `hip`, squashed to `squash` and the hands over his head:
 * upright, with the feet planted again under the squash.
 */
const DUCKED = (hip: number, squash: number, back: Pt, front: Pt): Pose =>
  hands(
    feet(mix(CROUCH, { hip: { y: hip }, body: { sy: squash, rot: 0 } }), floor(-1.5), floor(1.6), true),
    back,
    front,
  );

/** A tucked flip: hips up under the chin, knees forward and wrists wrapped around the shins. */
const BALL = (() => {
  const tuck: Pose = {
    body: { sx: 0.75, sy: 0.75 },
    hip: { x: -0.8, y: -1.45 },
    torso: { rot: 15 },
    neck: { y: 2.4, rot: 5 },
    hat: { rot: 7 },
    thighF: { rot: -132 },
    shinF: { rot: 145 },
    thighB: { rot: -118 },
    shinB: { rot: 139 },
    footF: { rot: 30 },
    footB: { rot: 45 },
  };
  const [bx, by] = pointOf(rig, tuck, 'shinB', 0, 0.45);
  const [x, y] = pointOf(rig, tuck, 'shinF', 0, 0.45);
  return hands(tuck, [bx - 0.45, by - 0.6], [x + 0.35, y - 0.55], -1);
})();

const flip = (rot: number, y = 0): Pose => mix(BALL, { body: { rot, y } });
const roll = (rot: number): Pose => grounded(flip(rot));

/** The legs and arms of `pose` moved `t` of the way to the ball's, each turn the short way round. */
function tucked(pose: Pose, t: number): Pose {
  return Object.fromEntries(
    [...LEGS, 'armB', 'foreB', 'armF', 'foreF'].map((bone) => {
      const [a, b] = [pose[bone]?.rot ?? 0, BALL[bone]?.rot ?? 0];
      const d = b - a;
      return [bone, { ...pose[bone], rot: a + (d - 360 * Math.round(d / 360)) * t }];
    }),
  );
}

/**
 * Halfway from the crouch into the ball, on the floor: the knees come up and the hands go to the shins over the
 * frames before the roll, not all in the frame or two after the crouch. The crouch bends both knees forward, as the
 * ball does; CROUCH bows the back knee out, and tucking from it would swing that leg round through straight.
 */
const TUCKING = grounded(between(crouchWith({}), BALL, 0.5));

/** Follow the silhouette's contact point all the way around, rather than rolling on the skeleton pivot. */
function rollKeys(start: number, end: number, direction: 1 | -1): Key[] {
  return Array.from({ length: end - start + 1 }, (_, i) =>
    key(start + i, roll((i / (end - start)) * 360 * direction), {
      ease: 'linear',
      ...(i === 0 ? { swaps: BLINK } : i === end - start ? { swaps: {} } : {}),
    }),
  );
}

/** Tiptoe shush: hold the point finger vertical, with its tip crossing the lips and the cuff below the chin. */
function shush(depth: number): Pose {
  const base = stance(
    { body: { rot: 18, x: 0.25 }, hip: { y: depth - 0.34 }, neck: { rot: -21, y: 1.59 } },
    { x: -1.7, tilt: 38 },
    { x: 1.9, tilt: 25 },
    true,
  );
  const [x, y] = pointOf(rig, base, 'face', 0.62, 2.03);
  const wrists = hands(base, [-2.4, -3.55], [x + 0.15, y + 1.98], -1);
  return aim(wrists, 'handF', 180);
}

/** A turn along the floor from frame 4 to `turned`, a crouch on `crouch`, standing on the last frame. */
function floorRoll(length: number, turned: number, crouch: number): AnimClip {
  return floorContact({
    length,
    swaps: SIDE,
    keys: continuous(
      [
        // Evenly into the roll: eased, the back thigh would turn 61 degrees in the first frame.
        key(0, grounded(mix(CROUCH, { body: { rot: -20 } })), { ease: 'linear' }),
        ...rollKeys(4, turned, 1),
        key(crouch, mix(grounded(CROUCH), { body: { rot: 360 } }), { ease: 'out' }),
        key(length, mix(READY, { body: { rot: 360 } })),
      ],
      { onScreen: true },
    ),
  });
}

/**
 * A backward roll over `length` frames: from standing into a crouch, one turn back from `start` to `end`, a
 * crouch at `crouch`, then standing.
 */
function floorBackRoll(length: number, start: number, end: number, crouch: number): AnimClip {
  return floorContact({
    length,
    swaps: SIDE,
    keys: continuous(
      [
        key(0, READY, { ease: 'out' }),
        key(4, TUCKING, { ease: 'linear' }),
        ...rollKeys(start, end, -1),
        key(crouch, grounded(mix(CROUCH, { body: { rot: -344 } })), { ease: 'out' }),
        key(length, mix(READY, { body: { rot: -356 } })),
      ],
      { onScreen: true },
    ),
  });
}

const PIVOT = feet({ hip: { y: 0.34 }, neck: { y: 0.1 } }, floor(-1.05), floor(1.05), true);
/**
 * PIVOT with both knees bent forward, for coming up out of the forward roll: from the ball, the bowed back knee
 * swings round through straight. Hardly bent, it looks the same.
 */
const ROLL_UP = feet({ hip: { y: 0.34 }, neck: { y: 0.1 } }, floor(-1.05), floor(1.05));

const LEDGE_INWARD = 6.25;
const KNEE_ON_TOP = {
  ...GRIP_ORDER,
  thighFLine: 19.1,
  shinFLine: 19.2,
  thighF: 19.3,
  shinF: 19.4,
  footF: 19.5,
};

/** Draw the reach, second grip, pull and release on the exact platform corner at each frame. */
function climbKeys(moveEnd: number, inward: number, lastFrame: number, phaseScale = 1): Key[] {
  return [
    key(0, HANG, { ease: 'linear', z: GRIP_ORDER }),
    ...Array.from({ length: lastFrame }, (_, i) => {
      const frame = i + 1;
      const phase = frame * phaseScale;
      const prevPhase = (frame - 1) * phaseScale;
      const release = prevPhase <= 12 && phase > 12;
      const swaps = prevPhase < REACH && phase >= REACH ? TWO_GRIPS : release ? RELEASE : undefined;
      const z = prevPhase < 8 && phase >= 8 ? KNEE_ON_TOP : release ? {} : undefined;
      return key(frame, climb(frame, moveEnd, inward, phase), { ease: 'linear', swaps, z });
    }),
  ];
}

/** Knocked off balance: head snapped back, arms and legs flung, beanie lifted off his head. */
const HIT: Pose = mix(AIR, {
  body: { rot: -20, x: -0.4 },
  neck: { rot: -14 },
  hat: { y: -0.7, rot: -12 },
  armF: { rot: -130 },
  foreF: { rot: -40 },
  armB: { rot: 130 },
  foreB: { rot: 40 },
  thighF: { rot: -45 },
  shinF: { rot: 35 },
  thighB: { rot: 25 },
  shinB: { rot: 25 },
});

/** Launched: spread-eagled, beanie half off. */
const TUMBLE: Pose = mix(AIR, {
  hat: { y: -0.8, rot: -18, x: -0.3 },
  armF: { rot: -150 },
  foreF: { rot: -20 },
  armB: { rot: 140 },
  foreB: { rot: 30 },
  thighF: { rot: -70 },
  shinF: { rot: 80 },
  thighB: { rot: 45 },
  shinB: { rot: 10 },
});

/** Dazed on his feet, swaying side to side under a ring of stars. */
const sway = (side: 1 | -1): Pose =>
  mix(
    feet(
      { body: { rot: 8 * side }, hip: { y: 0.3 }, neck: { rot: 10 * side } },
      floor(-1.2),
      floor(1.2),
      true,
    ),
    {
      fx2: fx(0.6 * side, -15.4, 6 * side, -side, 1),
    },
  );

export const clips: Record<string, AnimClip> = {
  idle: {
    length: 96,
    loop: true,
    swaps: FRONT,
    keys: [
      key(0, STAND),
      key(48, BREATHE),
      key(70, undefined, { swaps: FRONT_BLINK }),
      key(75, undefined, { swaps: {} }),
    ],
  },
  // Settled on the floor every frame: the tweened frames would let the planted foot dip.
  walk: floorContact({
    length: WALK_LENGTH,
    loop: true,
    swaps: SIDE,
    keys: continuous(
      Array.from({ length: WALK_LENGTH + 1 }, (_, f) => f)
        .filter((f) => !WALK_TWEENED.includes(f))
        .map((f) => key(f, sneak(f % WALK_LENGTH), { ease: 'linear' })),
      { onScreen: true },
    ),
  }),
  dash: {
    length: 10,
    swaps: RUN_LOOK,
    keys: [
      key(
        0,
        carry(stance({ body: { rot: 22 }, hip: { y: 0.75 } }, { x: -2.1, tilt: 28 }, { x: 1.3 }), 8, 0.02, 0),
        {
          ease: 'out',
          z: CARRY_ORDER,
        },
      ),
      key(
        2,
        carry(
          stance(
            { body: { rot: 24, x: 0.4 }, hip: { y: 0.55 } },
            { x: -2.15, tilt: 40 },
            { x: 2.2, up: 0.35 },
          ),
          31,
          0.68,
          0.6,
        ),
        { ease: 'out' },
      ),
      key(4, stride(0), { ease: 'linear' }),
      key(6, stride(2), { ease: 'linear' }),
      key(10, stride(6)),
    ],
  },
  run: {
    length: STRIDE_LENGTH,
    loop: true,
    swaps: RUN_LOOK,
    // Keyed every other frame, as the walk is: the trailing knee snapped through up to 74 degrees in a frame.
    keys: continuous(
      Array.from({ length: STRIDE_LENGTH / 2 + 1 }, (_, i) =>
        key(2 * i, stride((2 * i) % STRIDE_LENGTH), {
          ease: 'linear',
          ...(i === 0 ? { z: CARRY_ORDER } : {}),
        }),
      ),
      { onScreen: true },
    ),
  },
  runBrake: {
    length: 14,
    swaps: RUN_LOOK,
    keys: [
      key(
        0,
        carry(
          hands(
            stance({ body: { rot: -18 }, hip: { y: 0.6 } }, { x: -0.9, tilt: 22 }, { x: 2.6, tilt: -24 }),
            null,
            [3.8, -4.9],
            -1,
          ),
          70,
        ),
        {
          ease: 'out',
          swaps: { ...WIDE, ...SACK },
          z: CARRY_ORDER,
        },
      ),
      key(
        5,
        carry(
          hands(
            stance({ body: { rot: -11 }, hip: { y: 0.7 } }, { x: -1.1, tilt: 10 }, { x: 1.9, tilt: -8 }),
            null,
            [3.15, -4.2],
            -1,
          ),
          43,
          1.03,
        ),
        {
          ease: 'inOut',
          swaps: RUN_LOOK,
        },
      ),
      key(9, carry(READY, 39, 0.82, 0.8), { ease: 'linear' }),
      // The back arm is back where READY holds it as the sack shrinks away: carried to the last frame, it swung
      // 92 degrees into READY in one.
      key(13, mix(READY, { sackH: carry(READY, 5, 0.02, 0).sackH! }), { ease: 'out' }),
      key(14, READY, { swaps: { sack: null, handB: 'handOpen' } }),
    ],
  },
  turn: floorContact({
    length: 8,
    swaps: SIDE,
    keys: continuous([
      key(0, mix(READY, { body: { sx: -1 } }), { ease: 'out' }),
      key(3, mix(PIVOT, { body: { sx: -1 } }), { ease: 'step', swaps: FRONT_BLINK }),
      key(4, PIVOT, { ease: 'out', swaps: FRONT }),
      key(5, undefined, { swaps: {} }),
      key(8, READY),
    ]),
  }),
  crouch: floorContact(
    {
      length: 8,
      swaps: SIDE,
      keys: continuous(
        [
          key(0, READY, { ease: 'linear' }),
          key(3, shush(1.25), { ease: 'linear', z: FRONT_ARM_OVER_HEAD }),
          key(5, shush(1.88), { ease: 'out', swaps: { face: 'face3qShush', handF: 'point' } }),
          key(8, shush(1.74)),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  jumpSquat: {
    length: 3,
    swaps: SIDE,
    keys: [key(0, READY, { ease: 'out' }), key(3, mix(CROUCH, { body: { sy: 0.92 } }))],
  },
  jump: {
    length: 40,
    swaps: SIDE,
    keys: [
      key(0, RISE, { ease: 'out' }),
      key(14, mix(RISE, { body: { sx: 1, sy: 1 } }), { ease: 'inOut' }),
      key(26, mix(AIR, { body: { sy: 1.02 } })),
      key(40, APEX),
    ],
  },
  doubleJump: floorContact(
    {
      length: 30,
      swaps: SIDE,
      keys: continuous(
        [
          // Evenly into the flip: eased, the forearm would turn 77 degrees in the first frame.
          key(0, mix(RISE, { body: { sy: 1.05 } }), { ease: 'linear' }),
          key(4, flip(70, -1.1), { ease: 'linear', swaps: BLINK }),
          key(9, flip(190, -1.4), { ease: 'linear' }),
          key(15, flip(310, -0.8), { ease: 'out' }),
          key(21, mix(AIR, { body: { rot: 360 } }), { swaps: {} }),
          key(30, mix(APEX, { body: { rot: 360 } })),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  fall: {
    length: 40,
    loop: true,
    swaps: { ...SIDE, face: 'face3qWide' },
    keys: [key(0, FALL, { z: ARMS_OVER_HEAD }), key(20, FALL_2)],
  },
  helpless: {
    length: 32,
    loop: true,
    swaps: FRONT_DAZED,
    keys: [
      key(0, mix(FALL, { neck: { rot: 8 } }), { z: ARMS_OVER_HEAD }),
      key(16, mix(FALL_2, { neck: { rot: -8 } })),
    ],
  },
  land: {
    length: 4,
    swaps: SIDE,
    keys: [key(0, mix(CROUCH, { body: { sx: 1.06, sy: 0.9 } }), { ease: 'out' }), key(4, READY)],
  },
  shield: {
    length: 6,
    swaps: { ...ANGRY, handF: 'fist', handB: 'fist' },
    keys: continuous([key(0, READY, { ease: 'out' }), key(6, SHIELD)], { onScreen: true }),
  },
  shieldDrop: {
    length: 11,
    swaps: { ...SIDE, handF: 'fist', handB: 'fist' },
    keys: continuous([key(0, SHIELD, { ease: 'out' }), key(6, undefined, { z: {} }), key(11, READY)], {
      onScreen: true,
    }),
  },
  spotDodge: floorContact({
    length: 25,
    swaps: SIDE,
    keys: continuous(
      [
        // Evenly down: eased, his forearms would turn 83 degrees in the first frame.
        key(0, READY, { ease: 'linear' }),
        key(3, DUCKED(1.26, 0.86, [-0.6, -10.41], [1.4, -10.81]), {
          ease: 'out',
          swaps: { ...FRONT_WIDE, handB: 'handOpen' },
          z: ARMS_OVER_HEAD,
        }),
        key(18, DUCKED(1.12, 0.88, [-0.6, -10.21], [1.4, -10.61]), { ease: 'inOut' }),
        key(21, undefined, { swaps: {}, z: {} }),
        key(25, READY),
      ],
      { onScreen: true },
    ),
  }),
  rollForward: floorContact({
    length: 29,
    swaps: SIDE,
    keys: continuous(
      [
        key(0, READY, { ease: 'out' }),
        key(4, TUCKING, { ease: 'linear' }),
        ...rollKeys(6, 22, 1),
        key(24, mix(ROLL_UP, { body: { rot: 360 } }), { ease: 'step', swaps: FRONT }),
        key(25, mix(ROLL_UP, { body: { rot: 360, sx: -1 } }), { ease: 'out' }),
        key(27, undefined, { swaps: {} }),
        key(29, mix(READY, { body: { rot: 360, sx: -1 } })),
      ],
      { onScreen: true },
    ),
  }),
  rollBack: floorBackRoll(34, 6, 22, 27),
  airDodge: {
    length: 49,
    swaps: BLINK,
    keys: continuous(
      [
        // Evenly into the tuck: eased, the back forearm would turn 70 degrees in the first frame.
        key(0, AIR, { ease: 'linear' }),
        key(4, mix(TUCK, { body: { rot: -20, sx: 0.92, sy: 1.06 } })),
        key(30, mix(TUCK, { body: { rot: -30 } }), { ease: 'inOut' }),
        key(34, undefined, { swaps: SIDE }),
        key(49, AIR),
      ],
      { onScreen: true },
    ),
  },
  ledgeCatch: {
    length: 19,
    swaps: { ...GRIP, face: 'face3qWide' },
    keys: continuous(
      Array.from({ length: 20 }, (_, frame) => {
        const t = 1 - smooth(frame / 19);
        return key(
          frame,
          hang({
            body: { x: 0.1 - 0.6 * t, y: -2.6 + 0.55 * t, rot: -3 - 5 * t },
            thighF: { rot: -22 - 36 * t },
            thighB: { rot: 19 + 28 * t },
          }),
          { ease: 'linear', ...(frame === 0 ? { z: GRIP_ORDER } : frame === 19 ? { swaps: GRIP } : {}) },
        );
      }),
    ),
  },
  ledgeHang: {
    length: 60,
    loop: true,
    swaps: GRIP,
    keys: continuous([
      key(0, HANG, { z: GRIP_ORDER }),
      key(
        15,
        hang({ body: { y: -2.45, rot: -4 }, neck: { rot: 8 }, thighF: { rot: -13 }, thighB: { rot: 26 } }),
      ),
      key(
        30,
        hang({ body: { y: -2.3, rot: -5 }, neck: { rot: 9 }, thighF: { rot: -9 }, thighB: { rot: 29 } }),
      ),
      key(
        45,
        hang({ body: { y: -2.45, rot: -4 }, neck: { rot: 8 }, thighF: { rot: -13 }, thighB: { rot: 26 } }),
      ),
      key(60, HANG),
    ]),
  },
  ledgeClimb: {
    length: 34,
    swaps: GRIP,
    keys: continuous([...climbKeys(30, LEDGE_INWARD, 30), key(34, READY, { z: {} })], { onScreen: true }),
  },
  // Lifted where unfolding out of the ball onto his feet would dip into the floor.
  ledgeRoll: floorContact(
    {
      length: 45,
      swaps: GRIP,
      keys: continuous(
        [
          // Tucking towards the ball on the climb's last two frames: from the crouch on top, the legs folded into it
          // in one frame.
          ...climbKeys(40, 25, 9, 12 / 9).map((k) =>
            k.frame < 8 ? k : { ...k, pose: mix(k.pose!, tucked(k.pose!, (k.frame - 7) / 3)) },
          ),
          ...rollKeys(10, 34, 1).map((k) => {
            const [cx, cy] = corner(k.frame, 40, 25);
            return {
              ...k,
              pose: mix(lift(k.pose!, -cy), { body: { x: Math.max(0, cx + 4.2) } }),
              ...(k.frame === 10
                ? { swaps: { ...RELEASE, ...BLINK }, z: {} }
                : k.frame === 34
                  ? { swaps: RELEASE }
                  : {}),
            };
          }),
          key(39, mix(grounded(CROUCH), { body: { rot: 368 } }), { ease: 'out' }),
          key(45, mix(READY, { body: { rot: 364 } })),
        ],
        { onScreen: true },
      ),
    },
    false,
  ),
  ledgeJump: {
    length: 20,
    swaps: GRIP,
    keys: continuous(
      [
        key(0, HANG, { ease: 'linear', z: GRIP_ORDER }),
        ...[1, 2].map((frame) => {
          const t = smooth(frame / 6);
          const cx = GX - (GX + 4.25) * t;
          const cy = GY + (1 - GY) * t;
          const pop = mix(HANG, {
            body: { x: 0.1 + cx - GX + 4.7 * t, y: -2.6 + cy - GY - 8.8 * t, rot: 8 },
            thighF: { rot: -75 },
            shinF: { rot: 95 },
            thighB: { rot: -36 },
            shinB: { rot: 65 },
          });
          return key(frame, gripHands(pop, [cx - 0.35, cy - 0.84], null), { ease: 'linear' });
        }),
        // Letting go with the gripping arm still up, as it is for the rise, and the open hand still turned up from
        // the grip: dropped here, the arm would swing down 100 degrees in a frame and come back up by 6. The back
        // arm still hangs, and both come up evenly to the rise.
        key(
          3,
          aim(
            mix(RISE, {
              body: { y: -2.5, rot: 8, sx: 1, sy: 1 },
              thighF: { rot: -67 },
              shinF: { rot: 89 },
              armB: HANG.armB!,
              foreB: HANG.foreB!,
            }),
            'handF',
            -60,
          ),
          { swaps: RELEASE, z: {}, ease: 'linear' },
        ),
        key(6, RISE, { ease: 'out' }),
        key(20, mix(AIR, { body: { sy: 1.02 } })),
      ],
      { onScreen: true },
    ),
  },
  ledgeAttack: floorContact(
    {
      length: 55,
      /** The engine's ledge attack has no hitbox yet: this is where the sweep lands. */
      active: [[22, 22]],
      swaps: GRIP,
      keys: continuous(
        // The sweep starts from where the climb leaves him standing, so his legs don't snap into the crouch.
        [...climbKeys(20, LEDGE_INWARD, 12, 1.5), ...ledgeSweep(13, climb(12, 20, LEDGE_INWARD, 18))],
        { onScreen: true },
      ),
    },
    false,
  ),
  shieldBreak: {
    length: 40,
    swaps: FRONT_DAZED,
    keys: [
      key(0, mix(HIT, { body: { rot: -30 } }), { ease: 'out' }),
      key(20, mix(TUCK, { body: { rot: -200 } }), { ease: 'linear' }),
      key(40, mix(HIT, { body: { rot: -360 } })),
    ],
  },
  dizzy: {
    length: 60,
    loop: true,
    swaps: { ...FRONT_DAZED, fx2: 'stars' },
    keys: [key(0, sway(-1)), key(30, sway(1)), key(60, sway(-1))],
  },
  hitstun: {
    length: 20,
    swaps: HURT,
    keys: [
      key(0, HIT, { ease: 'out' }),
      key(6, mix(HIT, { body: { rot: -28 } })),
      key(20, mix(HIT, { body: { rot: -12 }, hat: {}, armF: { rot: -80 }, armB: { rot: 80 } })),
    ],
  },
  tumble: {
    length: 32,
    loop: true,
    swaps: { ...HURT, face: 'face3qHurt' },
    keys: [
      key(0, TUMBLE, { ease: 'linear' }),
      key(16, mix(TUMBLE, { body: { rot: 180 }, armF: { rot: -120 }, thighF: { rot: -95 } }), {
        ease: 'linear',
      }),
      key(32, mix(TUMBLE, { body: { rot: 360 } })),
    ],
  },
  down: {
    length: 40,
    loop: true,
    swaps: HURT,
    keys: [key(0, DOWN), key(20, mix(DOWN, { armF: { rot: 0 }, hat: { rot: 20, x: -0.3 } })), key(40, DOWN)],
  },
  getupStand: floorContact({
    length: 29,
    swaps: HURT,
    keys: [
      key(0, DOWN, { ease: 'in' }),
      key(10, feet({ body: { rot: -40, y: 1.1 }, armB: { rot: 90 } }, floor(0.8), floor(2.0)), {
        ease: 'out',
        swaps: SIDE,
      }),
      key(20, CROUCH, { ease: 'out' }),
      key(29, READY),
    ],
  }),
  techInPlace: floorContact({
    length: 26,
    swaps: BLINK,
    keys: [
      key(0, mix(CROUCH, { body: { rot: -20 } }), { ease: 'out' }),
      key(6, mix(CROUCH, { body: { sx: 1.05, sy: 0.92 } }), { ease: 'inOut' }),
      key(14, undefined, { swaps: ANGRY }),
      key(26, READY),
    ],
  }),
  techRoll: floorRoll(40, 26, 31),
  /** The tech roll on the getup roll's shorter timeline: the turn ends two frames sooner, as the travel does. */
  getupRoll: floorRoll(35, 24, 29),
  /** Tech and getup rolls away from the facing: the back roll with its frames moved onto each action's travel. */
  techRollBack: floorBackRoll(40, 7, 31, 35),
  getupRollBack: floorBackRoll(35, 7, 29, 32),
  grabbed: {
    length: 20,
    loop: true,
    swaps: HURT,
    keys: [
      key(0, mix(HIT, { body: { rot: -8, y: -0.6 }, hat: {} })),
      key(10, mix(HIT, { body: { rot: -2, y: -0.7 }, hat: {}, thighF: { rot: -20 }, thighB: { rot: 35 } })),
      key(20, mix(HIT, { body: { rot: -8, y: -0.6 }, hat: {} })),
    ],
  },
  // On the floor all through: the reeling first pose sank his back shoe 0.84 into it.
  grabRelease: floorContact({
    length: 29,
    swaps: WIDE,
    keys: [
      key(0, mix(HIT, { body: { rot: -14 }, hat: {} }), { ease: 'out' }),
      key(10, feet({ body: { rot: -12 }, hip: { y: 0.4 } }, floor(-2.2), floor(1.0)), {
        ease: 'inOut',
        swaps: SIDE,
      }),
      key(29, READY),
    ],
  }),
  respawn: {
    length: 60,
    loop: true,
    swaps: FRONT,
    keys: [key(0, STAND), key(30, BREATHE), key(60, STAND)],
  },
  ...attacks,
  ...stunGunClips,
  ...shadowStepClips,
  ...finalSmashClips,
};

/**
 * The air dodge on the neutral dodge's 52 frames (AIR_DODGE_NEUTRAL): keys inside the intangible window (3 to 29)
 * stay put and only the recovery after it stretches. A directional dodge plays the same clip over its own length.
 */
clips.airDodge = retimeClip(clips.airDodge!, 52, [[29, 29]]);
