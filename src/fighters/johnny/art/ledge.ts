import { pointOf, type Pose } from '../../../render/rig/author';
import type { AnimClip, Key } from '../../../render/rig/types';
import { LEDGE_ATTACK, LEDGE_CLIMB, LEDGE_ROLL } from '../../../sim/constants';
import { stats } from '../stats';
import { HIT, star, trail } from './attacks';
import {
  AIR,
  BACK_LEG_IN_FRONT,
  CROUCH,
  FISTS,
  GRIT,
  GUARD,
  HEAD_IN_FRONT,
  PALM_B,
  PALM_F,
  SHOUT,
  SMIRK,
  STANCE,
  TUCK,
  between,
  elbows,
  feet,
  fist,
  grounded,
  hands,
  key,
  leg,
  mix,
  onFloor,
  shortTurns,
  sole,
  tuck,
  type Pt,
} from './poses';
import { HAND, rig } from './rig';

/**
 * Where the hands hold the ledge (rig space): the ledge's top corner while hanging. It matches the engine's hang
 * position, feet width / 2 + 0.5 out from the corner and 0.85 x height below it (src/sim/movement.ts hangPos).
 */
export const LEDGE_GRIP: [number, number] = [5.0, -14.45];
const [GX, GY] = LEDGE_GRIP;

/**
 * Hanging: both arms up over the lip with the fists on the grip, his shoulders pulled in under his jaw, the body
 * slumped against the wall and the boots dangling. `extra` bends it, for the catch and the sway.
 */
function hang(extra: Pose = {}): Pose {
  return hands(
    mix(
      {
        body: { x: -0.5, y: -0.2 },
        neck: { rot: 5 },
        armF: { x: 6.4, y: -1.0, sy: 1.05 },
        armB: { x: 1.8, y: 0.6, sy: 1.2 },
      },
      extra,
    ),
    [GX, GY],
    [GX - 0.3, GY - 0.1],
    -1,
    1,
  );
}

/** Boots dangling: the far one hangs lower and back, the near one swings a little forward. */
function dangling(extra: Pose = {}): Pose {
  return sole(
    sole(
      hang(mix({ thighF: { rot: -12 }, shinF: { rot: 24 }, thighB: { rot: 14 }, shinB: { rot: 18 } }, extra)),
      'B',
      42,
    ),
    'F',
    24,
  );
}

const HANG = dangling();
/** The hang on the breath: the shoulders sink and the head tips back. */
const HANG_SAG = dangling({
  body: { x: -0.7, y: 0.1 },
  neck: { rot: 9 },
  thighF: { rot: -6 },
  shinF: { rot: 14 },
  thighB: { rot: 20 },
});

/** The fists let go and the arms sweep up as he leaves the ledge, legs tucking under. */
const RELEASE: Pose = mix(AIR, {
  body: { y: -2 },
  armF: { rot: -150 },
  armB: { rot: 150 },
  foreF: { rot: -20 },
  foreB: { rot: 20 },
  thighF: { rot: -52 },
  shinF: { rot: 40 },
  thighB: { rot: -16 },
  shinB: { rot: 48 },
});

/** A ledge getup's path (src/sim/actions/ledge.ts): it slides him `distance` past the corner by frame `moveEnd`. */
interface Getup {
  moveEnd: number;
  distance: number;
}
const CLIMB: Getup = { moveEnd: LEDGE_CLIMB.moveEnd, distance: stats.width / 2 + 2 };
const ROLL: Getup = { moveEnd: LEDGE_ROLL.moveEnd, distance: LEDGE_ROLL.distance };
const ATTACK: Getup = { moveEnd: LEDGE_ATTACK.moveEnd, distance: stats.width / 2 + 2 };

/**
 * Where the ledge corner is in rig space `f` frames into a getup. The engine slides him from the hang position
 * along a smoothstep and lifts him to the floor's height by 1/1.6 of the way, so the corner sinks towards his feet
 * and passes behind him.
 */
function corner({ moveEnd, distance }: Getup, f: number): Pt {
  const t = Math.min(1, f / moveEnd);
  const u = t * t * (3 - 2 * t);
  return [GX - (GX + distance) * u, GY * (1 - Math.min(1, 1.6 * u))];
}

/** `pose` stood on a floor `y` units below the rig root (negative: above it), the ledge top while the engine lifts him. */
const atFloor = (pose: Pose, y: number): Pose => mix(pose, { body: { y: (pose.body?.y ?? 0) + y } });

/**
 * Pulling himself up the wall with both fists on corner `c`: `lift` 0 is the hang, 1 has his chest up at the lip
 * and the far knee drawn up under him against the wall, ready to step up onto the ledge; the near leg hangs. The far * shoulder tucks in off the wall as he rises. `bothKnees` draws the near knee up too, to tuck for the ledge roll.
 */
function pullUp([cx, cy]: Pt, lift: number, bothKnees = false): Pose {
  const base = mix({
    body: { x: -0.5 + cx - GX - 0.6 * lift, y: -0.2 + cy - GY - 7.5 * lift },
    neck: { rot: 5 - 12 * lift },
    armF: { x: 6.4 * (1 - 0.6 * lift), y: -1.0, sy: 1.05 },
    armB: { x: 1.8 * (1 - lift), y: 0.6, sy: 1.2 - 0.2 * lift },
    thighF: { rot: bothKnees ? -12 - 70 * lift : -12 + 6 * lift },
    shinF: { rot: bothKnees ? 24 + 76 * lift : 24 + 10 * lift },
    thighB: { rot: 14 - 100 * lift },
    shinB: { rot: 18 + 100 * lift },
  });
  return sole(
    sole(hands(base, [cx, cy], [cx - 0.3, cy - 0.1], 1, 1), 'B', 42 - 20 * lift),
    'F',
    24 + 20 * lift,
  );
}

/**
 * Over the lip at corner `c`: chest leaning in, palms pressed on the ledge top, the far boot planted on it and the
 * near leg still hanging down the wall.
 */
function mantle([cx, cy]: Pt): Pose {
  const base = { body: { x: cx + 1.0, y: cy + 3.2, rot: 24 }, neck: { rot: -12 } };
  const legs = leg(tuck(base, 'B', [cx + 2.6, cy - 0.55], 0), 'F', [cx - 0.4, cy + 3.0], 70);
  return hands(legs, [cx + 3.0, cy - 1.6], [cx + 1.4, cy - 1.4], 1, 1);
}

/** Up on the ledge top: crouched on both boots, the near hand still braced on his knee. */
const CROUCHED = grounded(
  hands(
    mix(feet({ hip: { y: 2.6 }, body: { rot: 16 }, neck: { y: 0.4, rot: -6 } }, [2.8, 0], [-1.8, 0]), {
      footF: { sx: -1 },
    }),
    [5.0, -5.2],
    [1.6, -3.8],
    1,
    1,
  ),
);

/** Keys on every frame from `from` to `to`, each drawing `pose(f)`. */
function each(
  from: number,
  to: number,
  pose: (f: number) => Pose,
  extra: (f: number) => Partial<Key> = () => ({}),
): Key[] {
  return Array.from({ length: to - from + 1 }, (_, i) =>
    key(from + i, pose(from + i), { ease: 'linear', ...extra(from + i) }),
  );
}

/**
 * How far up the attack's five-frame pull-up is on each frame: slower through the first half, where the far forearm
 * turns fastest as his shoulder rises past his fist.
 */
const PULL = [0, 0.17, 0.35, 0.53, 0.73, 1];

/** The point `t` of the way along the path through `points`, each stretch taking its share by length. */
function along(points: Pt[], t: number): Pt {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  let d = t * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i]! || i === lengths.length - 1) {
      const u = lengths[i]! ? Math.min(1, d / lengths[i]!) : 1;
      const [a, b] = [points[i]!, points[i + 1]!];
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    }
    d -= lengths[i]!;
  }
  return points[points.length - 1]!;
}

/**
 * A frame `t` of the way from climb drawing `a` to `b`, drawn so nothing goes through the ledge: the body blended,
 * the stepping leg's ankle carried up the wall face and over the lip by way of `lip` (`knee` 0 tucks the knee up, * 1 or -1 bends it that way; the boot turning from `soles[0]` to `soles[1]` degrees), and the hands slid from where
 * `a` has them to where `b` does by way of `reach`, above the lip, so the elbows stay out of the wall.
 */
function climbStep(
  a: Pose,
  b: Pose,
  t: number,
  side: 'B' | 'F',
  lip: Pt,
  soles: [number, number],
  knee: 0 | 1 | -1 = 0,
  reach?: Pt,
): Pose {
  const foot = `foot${side}`;
  const ankle = along([pointOf(rig, a, foot), lip, pointOf(rig, b, foot)], t);
  const deg = soles[0] + (soles[1] - soles[0]) * t;
  const blend = between(a, b, t);
  const stepped = knee === 0 ? tuck(blend, side, ankle, deg) : leg(blend, side, ankle, deg, 1, knee);
  const hand = (pose: Pose, arm: 'B' | 'F') => pointOf(rig, pose, `fore${arm}`, 0, HAND);
  const slide = (arm: 'B' | 'F'): Pt =>
    along(reach ? [hand(a, arm), reach, hand(b, arm)] : [hand(a, arm), hand(b, arm)], t);
  return hands(stepped, slide('B'), slide('F'), 1, 1);
}

/** Pulled up at corner `c` to the mantle, `t` of the way: the far boot steps up the wall and onto the top. */
const toMantle = (c: Pt, t: number) =>
  climbStep(pullUp(c, 1), mantle(c), t, 'B', [c[0] + 0.6, c[1] - 0.85], [22, 0], 0, [c[0] + 0.8, c[1] - 2.2]);
/** From the mantle at corner `c` to crouched on top, `t` of the way: the near boot comes up the wall face. */
const toCrouch = (c: Pt, t: number) =>
  climbStep(mantle(c), atFloor(CROUCHED, c[1]), t, 'F', [c[0] - 0.4, c[1] - 1.0], [70, 0], -1);

/** Tucked on the ledge top at corner `c`'s height, turned `rot` degrees, lifted `hop` units off it and `back` units behind. */
const tuckAt = (c: Pt, rot: number, hop = 0, back = 0): Pose =>
  atFloor(grounded(mix(TUCK, { body: { rot, x: -back } })), c[1] - hop);

/** `keys` from frame `start` to `end` re-keyed by `onFloor`, for the part of a getup after the engine has him on the floor. */
function onFloorFrom(start: number, end: number, keys: Key[]): Key[] {
  const clip = onFloor({
    length: end - start,
    keys: shortTurns(keys.map((k) => ({ ...k, frame: k.frame - start }))),
  });
  return clip.keys.map((k) => ({ ...k, frame: k.frame + start }));
}

/** The ledge attack's wind-up: weight back, the far fist cocked up by his ear, the near fist out as a guard. */
const PUNCH_WIND = fist(
  fist(
    mix(feet({ body: { rot: -8, x: -0.6 }, hip: { y: 1.4 }, neck: { rot: 6 } }, [3.4, 0], [-2.6, 0]), {
      footF: { sx: -1 },
    }),
    'B',
    [1.8, -11.4],
    1,
    1,
  ),
  'F',
  [3.6, -9.4],
  1,
  1,
);
/** The punch: a lunge onto the front boot, the far fist driven straight out past the lip. */
const PUNCH = fist(
  fist(
    mix(feet({ body: { rot: 14, x: 1.8 }, hip: { y: 0.8 } }, [5.2, 0], [-2.0, 0]), { footF: { sx: -1 } }),
    'B',
    [10.2, -9.6],
    1.3,
  ),
  'F',
  [0.4, -8.8],
  1,
  1,
);
const PUNCH_HIT = mix(PUNCH, { fx1: star([10.9, -9.6], 1.3), fx2: trail([4.6, -9.6], [10.4, -9.6], 1.2) });

export const ledge: Record<string, AnimClip> = {
  ledgeCatch: {
    length: 19,
    swaps: { ...GRIT, ...FISTS },
    keys: [
      key(
        0,
        dangling({
          thighF: { rot: -40 },
          shinF: { rot: 44 },
          thighB: { rot: 36 },
          shinB: { rot: 34 },
          body: { y: 0.4 },
        }),
        {
          ease: 'outBack',
          z: HEAD_IN_FRONT,
        },
      ),
      key(19, HANG),
    ],
  },

  ledgeHang: {
    length: 60,
    loop: true,
    swaps: { ...SHOUT, ...FISTS },
    keys: [key(0, HANG, { z: HEAD_IN_FRONT }), key(30, HANG_SAG), key(60, HANG)],
  },

  ledgeClimb: {
    length: LEDGE_CLIMB.faf - 1,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns([
      key(0, HANG, { ease: 'linear', z: HEAD_IN_FRONT }),
      ...each(1, 10, (f) => pullUp(corner(CLIMB, f), 1 - (1 - f / 10) ** 2)),
      // The far boot steps up onto the ledge over frames 11-13, the near one comes up after it over 16-18.
      ...each(
        11,
        16,
        (f) =>
          f <= 13
            ? toMantle(corner(CLIMB, f), (f - 10) / 4)
            : f >= 16
              ? toCrouch(corner(CLIMB, f), [0.3, 0.6, 0.85][f - 16]!)
              : mantle(corner(CLIMB, f)),
        (f) => (f === 11 ? { swaps: { ...GRIT, ...PALM_F, ...PALM_B }, z: BACK_LEG_IN_FRONT } : {}),
      ),
      ...each(
        17,
        18,
        (f) => toCrouch(corner(CLIMB, f), [0.3, 0.6, 0.85][f - 16]!),
        (f) => (f === 17 ? { swaps: { ...GRIT, ...FISTS }, z: {} } : {}),
      ),
      ...onFloorFrom(19, LEDGE_CLIMB.faf - 1, [
        key(19, CROUCHED, { ease: 'inOut' }),
        key(26, mix(CROUCH, { body: { rot: 4 } }), { ease: 'inOut' }),
        key(LEDGE_CLIMB.faf - 1, STANCE, { swaps: { ...GRIT, ...GUARD } }),
      ]),
    ]),
  },

  ledgeRoll: {
    length: LEDGE_ROLL.faf - 1,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns([
      key(0, HANG, { ease: 'linear', z: HEAD_IN_FRONT }),
      ...each(1, 5, (f) => pullUp(corner(ROLL, f), PULL[f]!, true)),
      // Curling up to roll over the lip.
      key(6, between(pullUp(corner(ROLL, 6), 1, true), tuckAt(corner(ROLL, 6), -60, -1.4, 3.4), 0.4), {
        ease: 'linear',
      }),
      key(7, tuckAt(corner(ROLL, 7), -60, -1.4, 3.4), { ease: 'linear', z: {} }),
      key(8, tuckAt(corner(ROLL, 8), -20, 0.8, 1.2), { ease: 'linear' }),
      ...each(9, 33, (f) => tuckAt(corner(ROLL, f), (360 * (f - 9)) / 25)),
      ...onFloorFrom(34, LEDGE_ROLL.faf - 1, [
        key(34, tuckAt([0, 0], 360), { ease: 'linear' }),
        key(38, mix(CROUCHED, { body: { rot: 368 } }), { ease: 'inOut' }),
        key(LEDGE_ROLL.faf - 1, mix(STANCE, { body: { rot: 360 } }), { swaps: { ...GRIT, ...GUARD } }),
      ]),
    ]),
  },

  ledgeAttack: {
    length: LEDGE_ATTACK.faf - 1,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns(
      elbows([
        key(0, HANG, { ease: 'linear', z: HEAD_IN_FRONT }),
        ...each(1, 5, (f) => pullUp(corner(ATTACK, f), PULL[f]!)),
        // The far boot steps up over frames 6-8, the near one comes up after it over 9-11.
        ...each(
          6,
          10,
          (f) =>
            f <= 8
              ? toMantle(corner(ATTACK, f), [0.27, 0.54, 0.8][f - 6]!)
              : toCrouch(corner(ATTACK, f), [0.17, 0.48][f - 9]!),
          (f) => (f === 6 ? { swaps: { ...SHOUT, ...PALM_F, ...PALM_B }, z: BACK_LEG_IN_FRONT } : {}),
        ),
        key(11, toCrouch(corner(ATTACK, 11), 0.8), {
          ease: 'linear',
          swaps: { ...GRIT, ...FISTS },
          z: {},
        }),
        ...onFloorFrom(12, LEDGE_ATTACK.faf - 1, [
          key(12, CROUCHED, { ease: 'linear' }),
          // Wound up a frame sooner, so the punch comes round over three frames.
          key(15, PUNCH_WIND, { ease: 'linear' }),
          key(18, PUNCH_HIT, { ease: 'linear', swaps: { ...HIT, ...SHOUT, ...FISTS } }),
          key(21, PUNCH_HIT, { ease: 'out' }),
          key(22, undefined, { swaps: { ...SMIRK, ...FISTS } }),
          key(32, mix(PUNCH, { body: { rot: 6, x: 1.0 } }), { ease: 'inOut' }),
          key(LEDGE_ATTACK.faf - 1, STANCE, { swaps: { ...GRIT, ...GUARD } }),
        ]),
      ]),
    ),
  },

  ledgeJump: {
    length: 20,
    swaps: { ...GRIT, ...FISTS },
    keys: shortTurns([
      key(0, HANG, { ease: 'in', z: HEAD_IN_FRONT }),
      key(
        4,
        dangling({
          body: { y: -0.2 },
          neck: { rot: -4 },
          thighF: { rot: -48 },
          shinF: { rot: 52 },
          thighB: { rot: 40 },
          shinB: { rot: 30 },
        }),
        {
          ease: 'out',
          swaps: { ...GRIT, ...FISTS },
        },
      ),
      key(8, RELEASE, { ease: 'out', z: {} }),
      key(20, mix(AIR, { body: { y: -3 } })),
    ]),
  },
};

/** Hands and the grip, for the tests and the levels. */
export const GRIP_TARGETS: [Pt, Pt] = [
  [GX, GY],
  [GX - 0.3, GY - 0.1],
];
