import { pointOf, type Pose } from '../../../render/rig/author';
import { flattenPath, poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { AnimClip, FighterArt, Key } from '../../../render/rig/types';
import {
  AIR,
  ANGRY,
  ARMS_OVER_HEAD,
  BLINK,
  BREATHE,
  CROUCH,
  FRONT,
  FRONT_ARM_OVER_HEAD,
  FRONT_BLINK,
  FRONT_DAZED,
  FRONT_WIDE,
  READY,
  SACK,
  SIDE,
  STAND,
  TUCK,
  WIDE,
  aim,
  feet,
  floor,
  hands,
  key,
  mix,
  worldRot,
  type Pt,
} from './poses';
import { FORE_ARM, SHIN, THIGH, UPPER_ARM, shoe } from './parts';
import { rig } from './rig';

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

/** Moves a standing pose up by `dy` (feet included), for poses the engine has not finished lifting. */
const lift = (pose: Pose, dy: number): Pose => mix(pose, { body: { y: (pose.body?.y ?? 0) - dy } });

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
  [3, -3.1, 5.6, 5, -4.2, -6.9, 26, -2.95, -5.7, 32],
  [6, -1.95, 2.75, 15, -3.1, -4.3, 27, -2.3, -2.45, -18],
  [8, -1.25, 0.4, 18, -2.85, -2.5, 31, -1.73, 0.12, -16],
  [9, 0.25, 0.25, 18, -1.75, -1.8, 28, 2.5, 0, 2],
  [11, 1.35, -1.32, 18, -1.65, 0.27, -13, 2.75, 0, 0],
  [12, 2.15, -1.82, 17, 0.5, 0, 22, 3.25, 0, 0],
  [15, 3.3, -2.58, 9, 1.4, 0, 12, 4.3, 0, 0],
  [18, 4.7, -2.65, 4, 3.0, 0, 0, 5.75, 0, 0],
  [26, 6.15, -2.65, 4, 4.65, 0, 0, 7.65, 0, 0],
] as const;

/** Climb drawing before and after the feet are on top. Grip targets follow the engine's moving corner. */
function climb(frame: number, moveEnd: number, inward: number, phase = frame): Pose {
  const [cx, cy] = corner(frame, moveEnd, inward);
  const i = CLIMB_BEATS.findIndex(([f]) => f > phase);
  const a = CLIMB_BEATS[i - 1] ?? CLIMB_BEATS.at(-1)!;
  const b = CLIMB_BEATS[i] ?? a;
  const t = a === b ? 0 : (phase - a[0]) / (b[0] - a[0]);
  const [, dx, dy, rot, bx, by, bt, x, y, tilt] = a.map((v, j) => v + (b[j]! - v) * t) as unknown as typeof a;
  const base = stance(
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
  if (phase <= 12) {
    const push = Math.max(0, (phase - 9) / 3);
    const front: Pt = [cx - 0.35 + 2 * push, cy - 0.84];
    const [wx, wy] = pointOf(rig, base, 'handB');
    const approach = smooth(Math.min(1, phase / 3));
    const back: Pt = [wx + (cx + 0.66 - 0.3 * push - wx) * approach, wy + (cy - 0.75 - wy) * approach];
    return gripHands(base, front, back, -30 + 20 * push);
  }
  return hands(base, [cx + dx - 1.7, cy + dy - 0.95], [cx + dx + 2.5, cy + dy - 2.4], -1);
}

/** Keep equivalent limb and prop angles on the short side of the tween across an IK wrap. */
function continuous(keys: Key[]): Key[] {
  const angles: Record<string, number> = {};
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    for (const { name } of rig.bones) {
      const prev = angles[name];
      let r = pose[name]?.rot ?? 0;
      if (name !== 'body' && prev !== undefined) r += 360 * Math.round((prev - r) / 360);
      if (r !== 0 || pose[name]?.rot !== undefined) pose[name] = { ...pose[name], rot: r };
      angles[name] = r;
    }
    return { ...k, pose };
  });
}

/**
 * Walk: the tip-toe sneak of the in-game sprite (ingame-walk-01). He leans in, keeps both fists up at chest
 * height, sets each foot down toe-first with the heel lifted, and brings the swinging leg through with a high
 * knee; the head rocks a few degrees on every step.
 */
const WALK_LENGTH = 16;
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
  feet({ hip: { y: 0.63 }, neck: { y: 0.45, rot: 6 }, body: { rot: 4 } }, floor(-1.6), floor(1.6), true),
  [1.4, -4.55],
  [3.0, -4.82],
  -1,
);

/** Bake contact poses on whole frames so joint tweens can't put a shoe, sleeve or beanie below the floor. */
function floorContact(clip: AnimClip, settle = true): AnimClip {
  const art: FighterArt = { rig, clips: { contact: clip }, palettes: { default: {} }, height: 0, icon: '' };
  const keys = new Map(clip.keys.map((k) => [k.frame, k]));
  return {
    ...clip,
    keys: Array.from({ length: clip.length + 1 }, (_, frame) => {
      const sampled = samplePose(art, 'contact', frame, frame);
      const bottom = poseBounds(art, sampled)[3];
      const pose: Pose = Object.fromEntries(
        rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
          const p = sampled.local[name]!;
          return [name, { x: p.x - x, y: p.y - y, rot: p.rot - rot, sx: p.sx / sx, sy: p.sy / sy }];
        }),
      );
      const { ease, swaps, z } = keys.get(frame) ?? {};
      return key(frame, lift(pose, settle ? bottom : Math.max(0, bottom)), {
        ease: ease === 'step' ? 'step' : 'linear',
        swaps,
        z,
      });
    }),
  };
}

const grounded = (pose: Pose): Pose => floorContact({ length: 0, keys: [key(0, pose)] }).keys[0]!.pose!;

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

const PIVOT = feet({ hip: { y: 0.34 }, neck: { y: 0.1 } }, floor(-1.05), floor(1.05), true);

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
      const swaps = prevPhase < 3 && phase >= 3 ? TWO_GRIPS : release ? RELEASE : undefined;
      const z = prevPhase < 8 && phase >= 8 ? KNEE_ON_TOP : release ? {} : undefined;
      return key(frame, climb(frame, moveEnd, inward, phase), { ease: 'linear', swaps, z });
    }),
  ];
}

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
  walk: {
    length: WALK_LENGTH,
    loop: true,
    swaps: SIDE,
    keys: continuous(
      Array.from({ length: WALK_LENGTH + 1 }, (_, f) => key(f, sneak(f % WALK_LENGTH), { ease: 'linear' })),
    ),
  },
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
    keys: Array.from({ length: STRIDE_LENGTH }, (_, f) =>
      key(f, stride(f), { ease: 'linear', ...(f === 0 ? { z: CARRY_ORDER } : {}) }),
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
      key(9, carry(READY, 39, 0.82, 0.8), { ease: 'in' }),
      key(13, carry(READY, 5, 0.02, 0), { ease: 'out' }),
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
      keys: continuous([
        key(0, READY, { ease: 'out' }),
        key(3, shush(1.25), { ease: 'out', z: FRONT_ARM_OVER_HEAD }),
        key(5, shush(1.88), { ease: 'out', swaps: { face: 'face3qShush', handF: 'point' } }),
        key(8, shush(1.74)),
      ]),
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
      keys: [
        key(0, mix(RISE, { body: { sy: 1.05 } }), { ease: 'out' }),
        key(4, flip(70, -1.1), { ease: 'linear', swaps: BLINK }),
        key(9, flip(190, -1.4), { ease: 'linear' }),
        key(15, flip(310, -0.8), { ease: 'out' }),
        key(21, mix(AIR, { body: { rot: 360 } }), { swaps: {} }),
        key(30, mix(APEX, { body: { rot: 360 } })),
      ],
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
    keys: [key(0, READY, { ease: 'out' }), key(6, SHIELD)],
  },
  shieldDrop: {
    length: 11,
    swaps: { ...SIDE, handF: 'fist', handB: 'fist' },
    keys: [key(0, SHIELD, { ease: 'out' }), key(6, undefined, { z: {} }), key(11, READY)],
  },
  spotDodge: {
    length: 27,
    swaps: SIDE,
    keys: [
      key(0, READY, { ease: 'out' }),
      key(
        3,
        hands(mix(CROUCH, { hip: { y: 1.26 }, body: { sy: 0.86, rot: 0 } }), [-0.6, -10.41], [1.4, -10.81]),
        {
          ease: 'out',
          swaps: { ...FRONT_WIDE, handB: 'handOpen' },
          z: ARMS_OVER_HEAD,
        },
      ),
      key(
        18,
        hands(mix(CROUCH, { hip: { y: 1.12 }, body: { sy: 0.88, rot: 0 } }), [-0.6, -10.21], [1.4, -10.61]),
        {
          ease: 'inOut',
        },
      ),
      key(22, undefined, { swaps: {}, z: {} }),
      key(27, READY),
    ],
  },
  rollForward: floorContact({
    length: 31,
    swaps: SIDE,
    keys: continuous([
      key(0, READY, { ease: 'out' }),
      key(4, grounded(CROUCH), { ease: 'out' }),
      ...rollKeys(6, 22, 1),
      key(25, mix(PIVOT, { body: { rot: 360 } }), { ease: 'step', swaps: FRONT }),
      key(26, mix(PIVOT, { body: { rot: 360, sx: -1 } }), { ease: 'out' }),
      key(28, undefined, { swaps: {} }),
      key(31, mix(READY, { body: { rot: 360, sx: -1 } })),
    ]),
  }),
  rollBack: floorContact({
    length: 31,
    swaps: SIDE,
    keys: continuous([
      key(0, READY, { ease: 'out' }),
      key(4, grounded(CROUCH), { ease: 'out' }),
      ...rollKeys(6, 22, -1),
      key(26, grounded(mix(CROUCH, { body: { rot: -344 } })), { ease: 'out' }),
      key(31, mix(READY, { body: { rot: -356 } })),
    ]),
  }),
  airDodge: {
    length: 49,
    swaps: BLINK,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(4, mix(TUCK, { body: { rot: -20, sx: 0.92, sy: 1.06 } })),
      key(30, mix(TUCK, { body: { rot: -30 } }), { ease: 'inOut' }),
      key(34, undefined, { swaps: SIDE }),
      key(49, AIR),
    ],
  },
  ledgeCatch: {
    length: 8,
    swaps: { ...GRIP, face: 'face3qWide' },
    keys: continuous(
      Array.from({ length: 9 }, (_, frame) => {
        const t = 1 - smooth(frame / 8);
        return key(
          frame,
          hang({
            body: { x: 0.1 - 0.6 * t, y: -2.6 + 0.55 * t, rot: -3 - 5 * t },
            thighF: { rot: -22 - 36 * t },
            thighB: { rot: 19 + 28 * t },
          }),
          { ease: 'linear', ...(frame === 0 ? { z: GRIP_ORDER } : frame === 8 ? { swaps: GRIP } : {}) },
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
    keys: continuous([...climbKeys(30, LEDGE_INWARD, 30), key(34, READY, { z: {} })]),
  },
  ledgeRoll: {
    length: 50,
    swaps: GRIP,
    keys: continuous([
      ...climbKeys(40, 25, 9, 12 / 9),
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
      key(50, mix(READY, { body: { rot: 364 } })),
    ]),
  },
  ledgeJump: {
    length: 20,
    swaps: GRIP,
    keys: continuous([
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
      key(3, mix(AIR, { body: { y: -2.5, rot: 8 }, thighF: { rot: -67 }, shinF: { rot: 89 } }), {
        swaps: RELEASE,
        z: {},
        ease: 'out',
      }),
      key(6, RISE, { ease: 'out' }),
      key(20, mix(AIR, { body: { sy: 1.02 } })),
    ]),
  },
};
