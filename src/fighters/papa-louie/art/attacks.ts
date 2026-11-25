import { ease } from '../../../render/rig/sample';
import type { AnimClip, BonePose, Key } from '../../../render/rig/types';
import { moves } from '../moves';
import { FORE_ARM, UPPER_ARM } from './parts';
import { AIR, STAND, aim, feet, hands, key, mix, pointOf, swing, type Pose, type Pt } from './poses';
import { rig } from './rig';

/**
 * Papa Louie's move clips, one per move in ../moves.ts with the same name. Smash numbering (frame 1 is the move's
 * first frame) and length = FAF - 1; the paddle's face covers the far hitbox through each hit window, keyed from
 * the frame before the first active frame. Strikes are placed on the move's own hitboxes (`box`), so the paddle
 * lands where the move hits.
 */

type Swaps = Record<string, string | null>;

const DEG = Math.PI / 180;
const ARM = UPPER_ARM + FORE_ARM;

/** A move's hitbox centre in rig space (y down): `hit` is the hit window, `id` the box. */
function box(move: string, hit = 0, id = 0): Pt {
  const b = moves[move]!.hits[hit]!.boxes.find((b) => b.id === id)!;
  return [b.x, -b.y];
}

/** The aim angle (0 down, -90 forward, 180 up, 90 back) from one rig point to another. */
const toward = (from: Pt, to: Pt): number => Math.atan2(from[0] - to[0], to[1] - from[1]) / DEG;

/** The point `d` units from `from` along aim angle `deg`. */
const ahead = (from: Pt, deg: number, d: number): Pt => [
  from[0] - Math.sin(deg * DEG) * d,
  from[1] + Math.cos(deg * DEG) * d,
];

const mirror = ([x, y]: Pt): Pt => [-x, y];

/** Feet planted with the ankles at x = back and front, the body moved by (x, y) and leaning `rot` degrees forwards. */
function stance(x: number, y: number, rot: number, back: number, front: number, extra: Pose = {}): Pose {
  return feet(mix({ body: { x, y, rot } }, extra), [back, -1], [front, -1]);
}

/** Rubber-hose reach: stretches an arm just enough that its wrist gets to `to` with the elbow a little bent. */
function stretchTo(pose: Pose, side: 'F' | 'B', to: Pt): Pose {
  const [x, y] = pointOf(pose, 'arm' + side);
  const s = Math.hypot(to[0] - x, to[1] - y) / (ARM * 0.97);
  return s > 1 ? mix(pose, { ['arm' + side]: { sy: s }, ['fore' + side]: { sy: s } }) : pose;
}

/** Wrists on rig points (null leaves an arm alone), arms stretched where they fall short. */
function arms(pose: Pose, back: Pt | null, front: Pt | null): Pose {
  let p = pose;
  if (back) p = stretchTo(p, 'B', back);
  if (front) p = stretchTo(p, 'F', front);
  return hands(p, back, front);
}

/** The front wrist at `wrist`, the paddle pointing along `deg`; `back` places the back hand. */
const grip = (pose: Pose, wrist: Pt, deg: number, back: Pt | null = null): Pose =>
  swing(arms(pose, back, wrist), deg);

/** Both hands on the handle, the back hand just above the front one (the paddle's own two-handed grip). */
const both = (pose: Pose, wrist: Pt, deg: number): Pose => grip(pose, wrist, deg, ahead(wrist, deg, 0.9));

/** The paddle along `deg` with the point `along` units from the grip on `at` (handle to 3, blade 3.3-8.6). */
const peel = (pose: Pose, deg: number, at: Pt, along = 6, back: Pt | null = null): Pose =>
  grip(pose, ahead(at, deg, -(along + 0.6)), deg, back);

/** The paddle laid on the line from `near` to `far`, `far` sitting `along` units down it. */
const lay = (pose: Pose, near: Pt, far: Pt, along: number, back: Pt | null = null): Pose =>
  peel(pose, toward(near, far), far, along, back);

/** The body turned to face backwards, mirrored about the feet's centre (so a pose authored facing right hits behind). */
const flip = (pose: Pose): Pose =>
  mix(pose, { body: { x: -(pose.body?.x ?? 0), rot: -(pose.body?.rot ?? 0), sx: -1 } });

/** A frame of turning round: the pose squeezed side-on (`sx` < 0 is already facing back). */
function turning(pose: Pose, sx: number): Pose {
  const turned = mix(pose, { body: { sx, rot: (pose.body?.rot ?? 0) * 0.3 } });
  if (!grounded(pose)) return turned;
  const [bx] = pointOf(pose, 'body');
  const k = sx / (pose.body?.sx ?? 1);
  const [b, f] = ankles(pose).map(([x, y]): Pt => [bx + (x - bx) * k, y]);
  return plantFeet(turned, b!, f!, [
    footAim(pose, 'footB') * Math.sign(k),
    footAim(pose, 'footF') * Math.sign(k),
  ]);
}

/** The back hand's prop held up at `at` (the hand points at it), its +y axis along `deg`, scaled by `s`. */
function propAt(pose: Pose, at: Pt, deg = 0, s: [number, number] = [1, 1]): Pose {
  const w = pointOf(pose, 'handB');
  const p = aim(pose, 'handB', toward(w, at));
  return aim(
    mix(p, { prop: { y: Math.hypot(at[0] - w[0], at[1] - w[1]) - 0.6, sx: s[0], sy: s[1] } }),
    'prop',
    deg,
  );
}

/**
 * The swoosh smear on an fx bone, pivoting at `at`: its thick edge sits on aim angle `end` (where the paddle is)
 * and it trails 90 degrees back the way the swing came, clockwise (`cw`) or not. `s` scales its radius (7.2-9.2).
 */
function smear(at: Pt, end: number, cw: boolean, s = 1): BonePose {
  return { x: at[0], y: at[1], rot: end, sx: cw ? s : -s, sy: s };
}

/** A flat smear for a sideways swing: a quarter ellipse low in front of `at`, its thick end `r` units ahead. */
function flatSmear(at: Pt, r: number, flat = 0.3, back = false): BonePose {
  return back
    ? { x: at[0], y: at[1], rot: 90, sx: -(r / 9) * flat, sy: r / 9 }
    : { x: at[0], y: at[1], rot: -90, sx: -(r / 9) * flat, sy: r / 9 };
}

/** Where a bone (or a point in its space) lands for `pose`. */
const at = (pose: Pose, bone: string, x = 0, y = 0): Pt => pointOf(pose, bone, x, y);
const wristF = (pose: Pose): Pt => at(pose, 'handF');
const shoulderF = (pose: Pose): Pt => at(pose, 'armF');

/** A strike held from `from` to `to`, linear in and easing out, with its swaps and draw order. */
function strike(from: number, to: number, pose: Pose, swaps: Swaps, z?: Record<string, number>): Key[] {
  return [key(from, pose, { ease: 'linear', swaps, ...(z ? { z } : {}) }), key(to, pose, { ease: 'out' })];
}

/** Back to the clip's own swaps and draw order. */
const done = (frame: number) => key(frame, undefined, { swaps: {}, z: {} });

/**
 * Turns each bone by whole turns where that keeps its direction in rig space within half a turn of the previous
 * posed key, so every limb and the paddle tween the short way round (never a full spin through the floor).
 */
function unwrap(clip: AnimClip): AnimClip {
  let prev: Record<string, number> | undefined;
  const keys = clip.keys.map((k) => {
    if (!k.pose) return k;
    const pose: Pose = { ...k.pose };
    const world: Record<string, number> = {};
    for (const bone of rig.bones) {
      const parent = bone.parent ? world[bone.parent]! : 0;
      let rot = pose[bone.name]?.rot ?? 0;
      const turns = prev ? Math.round((prev[bone.name]! - parent - rot) / 360) : 0;
      if (turns) {
        rot += 360 * turns;
        pose[bone.name] = { ...pose[bone.name], rot };
      }
      world[bone.name] = parent + rot;
    }
    prev = world;
    return { ...k, pose };
  });
  return { ...clip, keys };
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Every bone of two poses mixed by `k` (0 = a, 1 = b), the way the sampler tweens them. */
function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out: Pose = {};
  for (const bone of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = a[bone] ?? {};
    const q = b[bone] ?? {};
    out[bone] = {
      x: lerp(p.x ?? 0, q.x ?? 0, k),
      y: lerp(p.y ?? 0, q.y ?? 0, k),
      rot: lerp(p.rot ?? 0, q.rot ?? 0, k),
      sx: lerp(p.sx ?? 1, q.sx ?? 1, k),
      sy: lerp(p.sy ?? 1, q.sy ?? 1, k),
    };
  }
  return out;
}

const ankles = (pose: Pose): [Pt, Pt] => [pointOf(pose, 'footB'), pointOf(pose, 'footF')];
const footAim = (pose: Pose, foot: string): number => toward(pointOf(pose, foot), pointOf(pose, foot, 0, 1));

/** Both ankles on the floor (standing, crouched or kneeling), not squeezed edge-on. */
const grounded = (pose: Pose): boolean =>
  Math.abs(pose.body?.sx ?? 1) > 0.3 && ankles(pose).every(([, y]) => y > -1.02 && y < -0.4);

/**
 * Puts the ankles on rig points with the shoes along `aims`, through a squeezed or flipped body too (the legs are
 * solved with the body unsqueezed, on the points that the squeeze then carries to the targets).
 */
function plantFeet(pose: Pose, back: Pt, front: Pt, aims: [number, number] = [0, 0]): Pose {
  const s = pose.body?.sx ?? 1;
  const flat = mix(pose, { body: { sx: 1 } });
  const [tx, ty] = pointOf(flat, 'body');
  const r = (pose.body?.rot ?? 0) * DEG;
  const c = Math.cos(r);
  const n = Math.sin(r);
  const unsqueeze = (x: number, y: number): Pt => {
    const lx = (c * x + n * y) / s;
    const ly = -n * x + c * y;
    return [c * lx - n * ly, n * lx + c * ly];
  };
  const to = ([x, y]: Pt): Pt => {
    const [ux, uy] = unsqueeze(x - tx, y - ty);
    return [tx + ux, ty + uy];
  };
  const along = (deg: number): number => {
    const [ux, uy] = unsqueeze(-Math.sin(deg * DEG), Math.cos(deg * DEG));
    return Math.atan2(-ux, uy) / DEG;
  };
  const legs = aim(aim(feet(flat, to(back), to(front)), 'footB', along(aims[0])), 'footF', along(aims[1]));
  return mix(legs, { body: { sx: s } });
}

/**
 * Where a tween runs between two poses with both feet on the floor, re-plants the feet on every in-between frame
 * (following the tween's own easing), so the shoes stay on the floor instead of dipping through it.
 */
function plant(clip: AnimClip): AnimClip {
  const posed = clip.keys.filter((k) => k.pose);
  const extra: Key[] = [];
  const linear = new Set<Key>();
  for (let i = 0; i + 1 < posed.length; i++) {
    const a = posed[i]!;
    const b = posed[i + 1]!;
    if (a.ease === 'step' || b.frame - a.frame < 2 || !grounded(a.pose!) || !grounded(b.pose!)) continue;
    const [ab, af] = ankles(a.pose!);
    const [bb, bf] = ankles(b.pose!);
    const aims = (pose: Pose): [number, number] => [footAim(pose, 'footB'), footAim(pose, 'footF')];
    const [ma, mb] = [aims(a.pose!), aims(b.pose!)];
    const at = (p: Pt, q: Pt, k: number): Pt => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
    linear.add(a);
    for (let f = a.frame + 1; f < b.frame; f++) {
      const k = ease(a.ease ?? 'inOut', (f - a.frame) / (b.frame - a.frame));
      const pose = plantFeet(lerpPose(a.pose!, b.pose!, k), at(ab, bb, k), at(af, bf, k), [
        lerp(ma[0], mb[0], k),
        lerp(ma[1], mb[1], k),
      ]);
      extra.push(key(f, pose, { ease: 'linear' }));
    }
  }
  const keys = clip.keys.map((k) => (linear.has(k) ? { ...k, ease: 'linear' as const } : k));
  return { ...clip, keys: [...keys, ...extra].sort((x, y) => x.frame - y.frame) };
}

/** The peel tipped towards the floor, so its face shows narrower (pushes and sweeps along the ground). */
const SLANT: Pose = { paddle: { sx: 0.6 } };
/** The peel lying flat on the floor, seen edge on. */
const EDGE: Pose = { paddle: { sx: 0.3 } };

const ANGRY: Swaps = { face: 'faceAngry' };
const GRIT: Swaps = { face: 'faceAngry', stache: 'stacheGrit' };
const SHOUT: Swaps = { face: 'faceAngry', stache: 'stacheShout' };

/** Draw orders: the paddle behind his body (wind-ups behind his back). */
const PADDLE_BEHIND = { paddle: 0.5 };
/** The back arm and its prop in front of his body (shaking pepper over the held opponent). */
const BACK_ARM_FRONT = {
  armBLine: 24.1,
  foreBLine: 24.2,
  armB: 24.3,
  foreB: 24.4,
  prop: 24.45,
  handB: 24.5,
};

// --- Jabs -------------------------------------------------------------------------------------------------

const JAB_WIND = grip(stance(-0.3, 0.45, -6, -1.1, 1.3), [0.4, -7.0], -82, [-2.3, -4.4]);
const JAB_POKE = grip(
  stance(0.6, 0.6, 14, -1.0, 1.5),
  [3.0, -6.9],
  toward([3.0, -6.9], box('jab', 0, 1)),
  [-2.5, -5.6],
);
const JAB_REC = grip(stance(0.3, 0.5, 6, -1.1, 1.4), [2.9, -6.7], -97, [-2.3, -4.6]);

const JAB2_WIND = grip(stance(0.1, 0.55, 2, -1.1, 1.4), [1.0, -5.5], -68, [-1.9, -5.4]);
const JAB2_POKE = grip(
  stance(0.8, 0.65, 16, -0.9, 1.6),
  [3.0, -6.7],
  toward([3.0, -6.7], box('jab2', 0, 1)),
  [-2.2, -6.6],
);
const JAB2_REC = grip(stance(0.4, 0.55, 8, -1.0, 1.5), [3.1, -7.0], -100, [-2.0, -5.0]);

const JAB3_UP = grip(stance(-0.4, 0.35, -10, -1.2, 1.2), [2.5, -10.1], 205, [-2.4, -6.4]);
const JAB3_SLAP = grip(
  stance(0.7, 0.6, 16, -0.9, 1.6),
  [3.6, -7.7],
  toward([3.6, -7.7], box('jab3', 0, 0)),
  [-2.6, -5.8],
);
const JAB3_FOLLOW = grip(stance(0.9, 0.7, 22, -0.9, 1.6), [4.0, -6.6], -64, [-2.5, -6.6]);

// --- Tilts ------------------------------------------------------------------------------------------------

const FT_WIND = grip(stance(-0.5, 0.5, -12, -1.3, 1.0), [-1.9, -7.2], 96, [-2.7, -5.8]);
const FT_MID = mix(grip(stance(0.3, 0.6, 6, -1.1, 1.5), [2.4, -7.2], -90, [-2.4, -5.2]), {
  paddle: { sy: 0.4 },
});
const FT_HIT = peel(stance(1.0, 0.85, 18, -0.9, 1.9), -90, box('ftilt', 0, 0), 8.0, [-2.8, -5.4]);
const FT_FOLLOW = grip(stance(0.8, 0.75, 12, -0.9, 1.8), [4.4, -8.4], -116, [-2.4, -5.4]);

const UT_DIP = grip(stance(-0.2, 0.9, 6, -1.3, 1.3), [3.0, -5.4], -110, [-1.6, -3.4]);
const UT_BASE = arms(stance(0, 0.25, -4, -1.1, 1.3), [-0.5, -10.8], null);
const UT_UP = peel(UT_BASE, -145, box('utilt', 0, 1), 4.6);
const UT_TOSS = peel(
  arms(stance(0, -0.05, -6, -1.0, 1.2, { body: { sy: 1.04, sx: 0.98 } }), [-0.2, -11.2], null),
  -150,
  box('utilt', 3, 1),
  5.2,
);
/** The dough spinning at `pos`: tilted `tilt` degrees, stretched to `s` as it spins out, with a spin smear. */
const dough = (pose: Pose, pos: Pt, tilt: number, s: number, ring: number): Pose =>
  mix(propAt(pose, pos, tilt, [s, 1 + (s - 1) * 0.4]), {
    fx2: { x: pos[0], y: pos[1], rot: ring, sx: 0.36 * s, sy: 0.12 * s },
  });

const DT_LOW = grip(stance(-0.2, 1.1, 8, -1.3, 1.2), [1.5, -3.3], -90, [-2.4, -3.0]);
const DT_PUSH = lay(
  stance(1.0, 1.3, 30, -1.0, 1.8, SLANT),
  box('dtilt', 0, 1),
  box('dtilt', 0, 0),
  8.0,
  [-1.4, -5.4],
);
const DT_END = grip(stance(0.7, 1.1, 18, -1.1, 1.7, SLANT), [4.2, -3.2], -93, [-1.8, -4.6]);

// --- Dash attack ------------------------------------------------------------------------------------------

const DA_CROUCH = grip(stance(0.4, 1.0, 22, -1.5, 0.9), [0.2, -6.0], 112, [-2.6, -5.2]);
/** Diving flat out, legs kicked up behind, chin up. */
const DIVE: Pose = {
  body: { x: 0, y: 1.6, rot: 72 },
  neck: { rot: -30 },
  thighB: { rot: 30 },
  shinB: { rot: 70 },
  thighF: { rot: 10 },
  shinF: { rot: 50 },
  footB: { rot: 20 },
  footF: { rot: 60 },
  hat: { rot: -12 },
};
/** Pushing off the back foot into the dive, the front knee coming up. */
const DA_LAUNCH = mix(
  grip(feet({ body: { x: 0.8, y: 0.7, rot: 40 } }, [-1.4, -1], [0.6, -1]), [2.8, -4.8], -96, [-2.8, -5.0]),
  { thighF: { rot: -100 }, shinF: { rot: 110 }, footF: { rot: -60 }, hat: { rot: -8 } },
);
const DA_DIVE = peel(DIVE, -112, box('dashAttack', 0, 0), 7, [-3.5, -3.2]);
const SLIDE = mix(DIVE, { body: { x: 0.2, y: 1.7, rot: 80 }, neck: { rot: -40 } });
const DA_SLIDE = peel(SLIDE, -128, box('dashAttack', 1, 0), 5.0, [-3.2, -2.2]);
const DA_SLIDE_END = peel(mix(SLIDE, { body: { x: 0.5 } }), -124, box('dashAttack', 1, 0), 4.6, [-3.0, -2.0]);
const DA_PUSH = grip(
  stance(0.5, 1.4, 50, -1.5, 0.5, { neck: { rot: -25 } }),
  [3.8, -1.4],
  -100,
  [-0.4, -3.8],
);
const DA_RISE = grip(stance(0.6, 1.2, 24, -0.8, 1.5), [3.6, -4.6], -120, [-1.8, -3.6]);

// --- Smashes ----------------------------------------------------------------------------------------------

const FS_WIND = both(stance(-0.3, 0.5, -4, -1.3, 1.1), [-0.6, -6.6], 100);
const FS_COIL = mix(both(stance(-0.9, 1.15, -9, -1.7, 0.8), [-2.5, -6.7], 118), { hat: { rot: -6 } });
const FS_SWING = grip(stance(0.6, 0.6, 8, -1.2, 1.4), [3.2, -9.0], -150, [1.0, -7.6]);
const FS_HIT = lay(
  stance(1.6, 0.6, 24, -0.4, 2.4),
  box('fsmash', 0, 1),
  box('fsmash', 0, 0),
  8.3,
  [-2.2, -6.6],
);
const FS_FOLLOW = grip(
  stance(1.6, 1.26, 36, -0.8, 2.6, { hat: { rot: 12, y: -0.24 }, head: { rot: -7 } }),
  [5.4, -5.4],
  -68,
  [-3, -4.8],
);
const FS_RECOIL = grip(stance(0.3, 0.56, 9, -1.05, 1.75), [3.9, -6.2], -116, [-1.95, -3.9]);

const US_LOW = grip(stance(0.1, 0.9, 10, -1.3, 1.3, SLANT), [2.4, -3.6], -86, [-1.6, -3.4]);
const US_CHARGE = grip(stance(0, 1.3, 16, -1.4, 1.3, SLANT), [2.2, -3.0], -84, [-1.8, -3.2]);
const US_FLIP = grip(stance(0.2, 0.4, 2, -1.1, 1.2), [3.6, -8.6], -125, [1.2, -7.0]);
const US_TOSS = peel(
  stance(0, 0.05, -12, -0.9, 1.1, { body: { sy: 1.03, sx: 0.98 } }),
  172,
  box('usmash', 0, 0),
  7.0,
  [-2.6, -8.6],
);
const US_FOLLOW = grip(stance(0, 0.2, -8, -1.0, 1.2), [3.4, -10.2], 182, [-2.4, -7.4]);

const DS_CHARGE = both(stance(-0.3, 1.0, -6, -1.5, 1.1, { paddle: { sy: 0.75 } }), [-1.8, -5.4], 75);
const DS_FRONT = lay(
  stance(1.0, 1.4, 30, -1.0, 1.8, SLANT),
  box('dsmash', 0, 1),
  box('dsmash', 0, 0),
  8.0,
  [-1.4, -5.6],
);
/** Mid-sweep: the peel swinging round past his belly, end on to us. */
const DS_MID = mix(grip(stance(0.4, 1.3, 14, -1.3, 1.5), [2.2, -5.4], -70, [-2.2, -4.8]), {
  paddle: { sy: 0.4, sx: 0.8 },
});
/** The peel swinging flat round behind him, pointing at us (so it is drawn short). */
const DS_SWEEP = mix(grip(stance(0.1, 1.15, 4, -1.4, 1.3), [0.2, -5.0], 5, [-2.2, -5.0]), {
  paddle: { sy: 0.25, sx: 0.9 },
});
const DS_FRONT_END = grip(stance(1.0, 1.3, 26, -1.0, 1.8, SLANT), [4.6, -2.8], -84, [-1.6, -5.4]);

// --- Getup attack -----------------------------------------------------------------------------------------

/** The back hand laid flat on the floor, fingers forward. */
const palmDown = (pose: Pose): Pose => aim(pose, 'handB', -90);

/** Flat on his belly where he fell, chin up, feet kicked up behind, the peel flat on the floor ahead. */
const PRONE = palmDown(
  grip(
    {
      ...EDGE,
      body: { x: -0.6, y: 1.8, rot: 84 },
      neck: { rot: -25 },
      thighB: { rot: 20 },
      shinB: { rot: 80 },
      thighF: { rot: 10 },
      shinF: { rot: 95 },
      footB: { rot: 30 },
      footF: { rot: 30 },
    },
    [4.6, -0.95],
    -90,
    [2.0, -0.9],
  ),
);
/** Pushing up off the floor onto his knees. */
const GU_PUSH = palmDown(
  grip(stance(-0.2, 1.35, 45, -1.9, -0.2, { ...EDGE, neck: { rot: -20 } }), [3.4, -0.9], -90, [2.2, -1.0]),
);
const GU_CROUCH = grip(
  stance(-0.2, 1.3, 12, -1.3, 1.3, { paddle: { sx: 0.6, sy: 0.75 } }),
  [-0.9, -5.2],
  95,
  [-2.2, -2.8],
);
const GU_FRONT = peel(
  stance(0.8, 1.3, 26, -1.0, 1.7, SLANT),
  -92,
  box('getupAttack', 0, 0),
  7.0,
  [-1.4, -5.0],
);

// --- Aerials ----------------------------------------------------------------------------------------------

/** Glide Spin: arms spread like his glide, the paddle held out flat. */
const SPIN = grip(
  { body: { y: -0.3 }, thighF: { rot: -50 }, shinF: { rot: 70 }, thighB: { rot: 25 }, shinB: { rot: 45 } },
  [3.5, -7.5],
  -90,
  [-4.4, -7.55],
);
/** The spin's trail: a flat ring of smear round his waist, in front of him. */
const SPIN_RING: Pose = {
  fx1: flatSmear([0.3, -6.2], 5.2, 0.35),
  fx2: flatSmear([0.3, -6.2], 5.2, 0.35, true),
};
const SPIN_TUCK = grip(mix(AIR, { body: { rot: 6 } }), [1.8, -6.8], -150, [-0.6, -6.0]);

const FAIR_WIND = grip(mix(AIR, { body: { rot: -14 } }), [-1.9, -8.3], 125, [-3.2, -6.0]);
const FAIR_OVER = grip(mix(AIR, { body: { rot: 0 } }), [3.4, -9.6], 210, [-2.8, -6.4]);
const FAIR_HIGH = lay(
  mix(AIR, { body: { rot: 6 } }),
  box('fair', 0, 1),
  box('fair', 0, 0),
  7.0,
  [-2.6, -6.4],
);
const FAIR_LOW = lay(
  mix(AIR, { body: { x: 1.0, rot: 26 }, thighF: { rot: -70 }, shinF: { rot: 80 } }),
  box('fair', 1, 1),
  box('fair', 1, 0),
  7.2,
  [-2.6, -9.4],
);
/** The peel where FAIR_HIGH held it, left behind as a multiple on the chop's smear frame. */
const FAIR_GHOST: BonePose = {
  x: at(FAIR_HIGH, 'paddle')[0],
  y: at(FAIR_HIGH, 'paddle')[1],
  rot: toward(box('fair', 0, 1), box('fair', 0, 0)),
};
const FAIR_FOLLOW = grip(mix(AIR, { body: { x: 0.8, rot: 30 } }), [5.0, -6.0], -20, [-2.4, -9.0]);

const BAIR_WIND = grip(mix(AIR, { body: { rot: 16 }, head: { sx: -1 } }), [2.6, -5.2], -40, [-2.0, -6.4]);
const BAIR_HIT = flip(
  lay(
    mix(AIR, { body: { x: 0.2, rot: 14 } }),
    mirror(box('bair', 0, 1)),
    mirror(box('bair', 0, 0)),
    7.4,
    [-2.4, -5.8],
  ),
);
const BAIR_FOLLOW = flip(grip(mix(AIR, { body: { x: 0.2, rot: 20 } }), [4.0, -6.2], -55, [-2.2, -6.4]));

const UAIR_COCK = grip(mix(AIR, { body: { rot: 12 } }), [2.9, -5.6], -60, [-2.4, -5.0]);
const UAIR_LEAN = mix(AIR, { body: { rot: -20 }, neck: { rot: -8 } });
const uairArc = (wrist: Pt): Pose => grip(UAIR_LEAN, wrist, toward(wrist, box('uair')), [-2.8, -6.2]);
const UAIR_A = uairArc([2.0, -10.6]);
const UAIR_B = uairArc([3.0, -10.1]);

/** Standing on the box stack: `lift` raises the front (1) or back (-1) knee. */
const STOMP = (lift: number, drop = 0): Pose =>
  grip(
    {
      body: { y: drop },
      thighF: { rot: lift > 0 ? -95 * lift : 0 },
      shinF: { rot: lift > 0 ? 105 * lift : 0 },
      thighB: { rot: lift < 0 ? 85 * lift : 0 },
      shinB: { rot: lift < 0 ? -100 * lift : 0 },
    },
    [3.0, -9.6],
    200,
    [-3.6, -8.4],
  );
const stack = (squash: number, y = 0): BonePose => ({
  x: 0,
  y: 2.55 * 1.15 + y,
  sx: 1.3 * (1 + (1 - squash) * 0.6),
  sy: 1.15 * squash,
});

// --- Grabs and throws -------------------------------------------------------------------------------------

/** Holding the grabbed opponent on the peel (the engine keeps them ~10 units in front, feet on his floor). */
export const HOLD = peel(stance(0.2, 0.45, 4, -1.2, 1.4), -92, [9.6, -6.0], 5.6, [-1.7, -4.5]);

const GRAB_DIP = lay(stance(0.6, 1.2, 24, -1.0, 1.7, SLANT), [6.0, -2.2], [11.0, -1.8], 6.0, [-1.6, -5.2]);
const GRAB_SCOOP = peel(stance(0.5, 0.7, 14, -1.1, 1.6), -110, box('grab'), 5.0, [-1.6, -4.6]);
const DGRAB_DIP = lay(stance(1.2, 1.3, 30, -0.4, 2.3, SLANT), [7.0, -2.2], [12.0, -1.8], 6.0, [-1.2, -5.8]);
const DGRAB_SCOOP = peel(stance(1.2, 1.0, 22, -0.4, 2.3), -110, box('dashGrab'), 5.2, [-1.4, -5.4]);
const PGRAB_SCOOP = peel(stance(1.0, 0.9, 20, -0.6, 2.1), -110, box('pivotGrab'), 5.4, [-1.4, -5.2]);

/** The shaker held up over the opponent, its cap pointing along `cap`. */
const shake = (wrist: Pt, cap: number): Pose =>
  aim(mix(arms(HOLD, wrist, null), { prop: { y: 0.3, sx: 1.25, sy: 1.25 } }), 'prop', cap + 180);
const PM_UP = shake([2.2, -8.0], -105);
const PM_SHAKE = shake([2.8, -7.2], -60);
const PM_UP2 = shake([2.4, -7.8], -100);
const PM_SHAKE2 = shake([2.9, -7.1], -65);
const dust = (pose: Pose, s = 1): BonePose => {
  const [x, y] = at(pose, 'prop', 0, -1.5);
  return { x, y, rot: toward(at(pose, 'prop'), [x, y]), sx: s, sy: s };
};

const FT_LIFT = grip(stance(-0.3, 0.5, -6, -1.3, 1.2), [1.4, -6.8], -100, [-2.0, -5.4]);
const FT_SHOVE = peel(stance(1.2, 0.8, 20, -0.6, 2.2), -90, [14.5, -6.2], 7.6, [-2.6, -5.6]);
const FT_YANK = grip(stance(0.0, 0.6, -8, -1.3, 1.1), [0.8, -6.0], -90, [-2.4, -5.0]);

const BT_LIFT = grip(stance(-0.2, 0.5, -8, -1.3, 1.2), [2.6, -7.8], -115, [-1.8, -5.6]);
const BT_SETTLE = grip(stance(-0.2, 0.5, -4, -1.3, 1.2), [2.6, -7.8], -115, [-1.8, -5.6]);
const BT_TURNED = flip(grip(stance(-0.2, 0.6, -6, -1.2, 1.2), [1.4, -7.6], -100, [-2.2, -5.0]));
const BT_WIND = flip(grip(stance(-0.6, 0.8, -12, -1.5, 1.0), [-0.4, -5.8], -88, [-2.6, -4.6]));
const BT_SHOVE = flip(peel(stance(1.2, 0.8, 22, -0.6, 2.2), -90, [13.0, -3.6], 7.5, [-2.8, -5.0]));
const BT_REC = flip(grip(stance(0.6, 0.6, 8, -1.0, 1.6), [3.6, -5.6], -100, [-2.0, -4.6]));
/** The brick oven behind him (fx3, behind his body), popped in at scale `s`. */
const OVEN_X = -12.5;
const oven = (s: number, sx = s, sy = s): BonePose => ({ x: OVEN_X, y: 0, sx: sx * 1.8, sy: sy * 1.8 });

const UT_LOWER = grip(stance(0.3, 1.2, 18, -1.2, 1.5), [3.4, -2.6], -88, [-1.8, -4.0]);
const UT_HEAVE = both(stance(0, 0.6, -4, -1.2, 1.2), [3.0, -8.6], -140);
const utSpin = (sx: number, deg: number): Pose =>
  mix(grip(stance(0, 0.3, -8, -1.1, 1.2), [3.2, -10.0], deg, [1.6, -9.6]), { paddle: { sx } });
const UT_FLICK = grip(
  stance(0, -0.1, -10, -0.9, 1.0, { body: { sy: 1.05, sx: 0.97 } }),
  [2.4, -10.8],
  178,
  [-2.4, -9.0],
);

const DT_RAISE = grip(stance(-0.3, 0.4, -10, -1.3, 1.1), [2.8, -9.8], 205, [-2.4, -6.0]);
const DT_SLAM = peel(stance(1.0, 0.9, 22, -0.8, 2.0), -92, [10.5, -5.2], 6.0, [-2.6, -5.0]);
const DT_STOMP_UP = mix(grip(stance(-0.3, 0.4, -14, -1.3, 1.1), [2.8, -9.8], 205, [-2.4, -6.0]), {
  thighF: { rot: -75 },
  shinF: { rot: 70 },
  footF: { rot: -10 },
});
/** The pizza box at the held opponent's feet (fx2), scaled up to fit them. */
const pizzaBox = (s: number, squash = 1): BonePose => ({
  x: 10,
  y: 0,
  sx: 1.9 * s * (2 - squash),
  sy: 1.2 * s * squash,
});

function propeller(frame: number): Key {
  const phase = frame % 4;
  const side = phase < 2 ? 1 : -1;
  const taper = phase % 2 ? 0.68 : 1;
  const finish = frame >= 28;
  const coil = frame >= 24 && !finish;
  const rise = finish ? 0.55 : 0;
  const pose = arms(
    mix(AIR, {
      body: {
        x: side * 0.22,
        y: coil ? 0.24 : -0.86 - rise,
        sx: coil ? 1.11 : finish ? 0.86 : 0.94,
        sy: coil ? 0.91 : finish ? 1.15 : 1.05,
        rot: finish ? -7 : side * 4,
      },
      head: { rot: coil ? 12 : -side * 4 - rise * 14 },
      hat: { rot: coil ? 9 : -rise * 24 },
      thighB: { rot: coil ? 56 : finish ? 9 : 24 + side * 8 },
      shinB: { rot: coil ? 57 : finish ? 9 : 32 },
      thighF: { rot: coil ? -55 : finish ? -12 : -31 + side * 10 },
      shinF: { rot: coil ? 89 : finish ? 15 : 44 },
    }),
    finish ? [-3.55, -9.1] : [-2.2, -7.5],
    [side * 2.2, -16.1 - rise],
  );
  return key(
    frame,
    mix(aim(pose, 'handF', 180), {
      fx1: { x: -side * 4.1 * taper, y: -17 - rise, rot: -side * 90, sx: 0.63, sy: taper },
      fx2: {
        x: 0,
        y: -17 - rise,
        sx: side * (finish ? 2.1 : 1.65 - taper * 0.35),
        sy: finish ? 0.68 : 0.3,
        rot: side * (finish ? 6 : 2),
      },
    }),
    { ease: 'linear', swaps: { ...SHOUT, face: 'faceUp', paddle: null, fx1: 'paddle', fx2: 'rotorTrail' } },
  );
}

const DEFLECT_WIND = mix(grip(stance(-0.6, 1.08, -15, -2.25, 2.04), [2.45, -5.45], -176, [0.22, -4.92]), {
  paddle: { sx: 0.29 },
});
const DEFLECT_HIT = peel(stance(0.48, 0.67, 15, -2.25, 2.15), -136, box('downB'), 5.25, [0.7, -4.9]);
const DEFLECT_HOLD = peel(stance(0.13, 0.94, 7, -2.1, 2), -149, [6.3, -8.2], 5.1, [0.5, -4.8]);

const PEPPER_DIP = propAt(
  grip(stance(-0.38, 0.99, -12, -1.6, 1.1), [2.1, -4.22], -82, [-2.8, -5.6]),
  [-3.15, -6.1],
  -20,
  [1.13, 1.13],
);
const PEPPER_WIND = propAt(
  grip(
    stance(-0.5, 0.49, -21, -1.55, 1.6, { head: { rot: 10 }, hat: { rot: -8 } }),
    [2.1, -3.8],
    -95,
    [-3.3, -9.15],
  ),
  [-3.4, -9.8],
  -35,
  [1.13, 1.13],
);
const PEPPER_TOSS = grip(
  stance(0.85, 0.49, 19, -1.7, 2.05, { head: { rot: -6 }, hat: { rot: 9 } }),
  [1, -4.3],
  -65,
  [5.6, -8.46],
);
const PEPPER_RELEASE = propAt(PEPPER_TOSS, [6, -9], -35, [1.13, 1.13]);
const PEPPER_FOLLOW = grip(
  stance(0.83, 1.04, 28, -1.28, 2.15, { neck: { rot: -13 }, hat: { rot: 14 } }),
  [1.3, -3.6],
  -72,
  [5.28, -5.95],
);

const clips: Record<string, AnimClip> = {
  neutralB: {
    length: 39,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(5, PEPPER_DIP, { ease: 'inOut', swaps: { prop: 'pepperBomb', handB: 'fist' } }),
      key(10, PEPPER_WIND, { ease: 'in', swaps: { ...GRIT, prop: 'pepperBomb', handB: 'fist' } }),
      key(13, PEPPER_RELEASE, {
        ease: 'linear',
        swaps: { ...SHOUT, prop: 'pepperBomb', handB: 'fist' },
        z: BACK_ARM_FRONT,
      }),
      key(14, aim(PEPPER_TOSS, 'handB', -112), { ease: 'out', swaps: SHOUT }),
      key(19, PEPPER_FOLLOW, { ease: 'inOut', swaps: GRIT }),
      key(27, PEPPER_DIP, { ease: 'out', swaps: {}, z: {} }),
      key(39, STAND),
    ],
  },
  upB: {
    length: 45,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, grip(stance(-0.15, 0.94, -13, -1.4, 1.55), [2.4, -5.4], -179), {
        ease: 'in',
        swaps: GRIT,
      }),
      ...Array.from({ length: 25 }, (_, i) => propeller(i + 5)),
      key(30, grip(AIR, [3.1, -8.4], -155), { ease: 'inOut', swaps: GRIT }),
      key(38, grip(AIR, [3.3, -6.4], -129), { ease: 'out', swaps: {} }),
      key(45, AIR),
    ],
  },
  downB: {
    length: 35,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(3, DEFLECT_WIND, { ease: 'in', swaps: GRIT }),
      ...strike(4, 6, mix(DEFLECT_HIT, { fx1: smear(wristF(DEFLECT_HIT), -129, false, 0.66) }), {
        ...GRIT,
        fx1: 'swoosh',
      }),
      key(7, undefined, { swaps: GRIT }),
      key(11, DEFLECT_HOLD, { ease: 'out' }),
      key(20, DEFLECT_HOLD, { ease: 'inOut' }),
      key(27, DEFLECT_WIND, { ease: 'out', swaps: {} }),
      key(35, STAND),
    ],
  },
  jab: {
    length: 19,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(2, JAB_WIND, { ease: 'in', swaps: GRIT }),
      key(3, mix(JAB_POKE, { paddle: { sy: 1.08 } }), { ease: 'linear', swaps: SHOUT }),
      ...strike(4, 5, JAB_POKE, SHOUT),
      key(10, JAB_REC, { ease: 'inOut', swaps: {} }),
      key(19, STAND),
    ],
  },
  jab2: {
    length: 20,
    swaps: ANGRY,
    keys: [
      key(0, JAB_REC, { ease: 'out' }),
      key(2, JAB2_WIND, { ease: 'in', swaps: GRIT }),
      key(3, mix(JAB2_POKE, { paddle: { sy: 1.08 } }), { ease: 'linear', swaps: SHOUT }),
      ...strike(4, 5, JAB2_POKE, SHOUT),
      key(11, JAB2_REC, { ease: 'inOut', swaps: {} }),
      key(20, STAND),
    ],
  },
  jab3: {
    length: 31,
    swaps: ANGRY,
    keys: [
      key(0, JAB2_REC, { ease: 'in' }),
      key(3, JAB3_UP, { ease: 'in', swaps: GRIT }),
      key(4, mix(JAB3_SLAP, { fx1: smear(wristF(JAB3_SLAP), -90, true) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh' },
      }),
      key(6, mix(JAB3_SLAP, { fx1: smear(wristF(JAB3_SLAP), -88, true, 0.9) }), {
        ease: 'out',
        swaps: SHOUT,
      }),
      key(12, JAB3_FOLLOW, { ease: 'inOut', swaps: GRIT }),
      done(18),
      key(31, STAND),
    ],
  },
  ftilt: {
    length: 30,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(1, undefined, { z: PADDLE_BEHIND }),
      key(4, FT_WIND, { ease: 'in', swaps: GRIT }),
      key(5, mix(FT_MID, { fx1: flatSmear(shoulderF(FT_MID), 6) }), {
        ease: 'linear',
        swaps: { ...GRIT, fx1: 'swoosh' },
        z: {},
      }),
      ...strike(6, 9, mix(FT_HIT, { fx1: flatSmear(shoulderF(FT_HIT), 11) }), { ...SHOUT, fx1: 'swoosh' }),
      key(7, undefined, { swaps: SHOUT }),
      key(14, FT_FOLLOW, { ease: 'inOut', swaps: GRIT }),
      done(20),
      key(30, STAND),
    ],
  },
  utilt: {
    length: 33,
    swaps: { ...ANGRY, prop: 'dough' },
    keys: [
      key(0, STAND, { ease: 'out', swaps: { prop: null } }),
      key(3, UT_DIP, { ease: 'in', swaps: { ...GRIT, prop: 'dough' } }),
      key(5, dough(UT_UP, box('utilt', 0, 0), -10, 1, 0), {
        ease: 'linear',
        swaps: { ...GRIT, face: 'faceUp', fx2: 'swoosh' },
        z: { prop: 29.5 },
      }),
      key(7, dough(UT_UP, box('utilt', 0, 0), 10, 1.1, 180), { ease: 'linear' }),
      key(9, dough(UT_UP, box('utilt', 0, 0), -8, 1.2, 0), { ease: 'linear' }),
      key(11, dough(UT_UP, box('utilt', 0, 0), 10, 1.25, 180), { ease: 'linear' }),
      key(13, dough(UT_UP, box('utilt', 0, 0), -6, 1.3, 0), { ease: 'linear' }),
      ...strike(14, 17, dough(UT_TOSS, box('utilt', 3, 0), 0, 1.55, 180), {
        ...SHOUT,
        face: 'faceUp',
        fx2: 'swoosh',
      }),
      key(18, undefined, { swaps: { face: 'faceUp' } }),
      key(23, dough(UT_UP, [0.6, -12.6], 8, 1.3, 0), { ease: 'in' }),
      key(27, UT_DIP, { ease: 'inOut', swaps: {}, z: {} }),
      key(30, undefined, { swaps: { prop: null } }),
      key(33, STAND),
    ],
  },
  dtilt: {
    length: 23,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, DT_LOW, { ease: 'in', swaps: GRIT }),
      key(5, mix(DT_PUSH, { paddle: { sy: 1.06 } }), { ease: 'linear', swaps: SHOUT }),
      ...strike(6, 8, DT_PUSH, SHOUT),
      key(13, DT_END, { ease: 'inOut', swaps: GRIT }),
      done(16),
      key(23, STAND),
    ],
  },
  dashAttack: {
    length: 39,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, DA_CROUCH, { ease: 'in', swaps: GRIT }),
      key(6, DA_LAUNCH, { ease: 'linear', swaps: SHOUT }),
      ...strike(7, 11, DA_DIVE, SHOUT),
      key(12, DA_SLIDE, { ease: 'linear', swaps: GRIT }),
      key(20, DA_SLIDE_END, { ease: 'inOut' }),
      key(24, DA_PUSH, { ease: 'inOut', swaps: {} }),
      key(29, DA_RISE, { ease: 'inOut' }),
      key(39, STAND),
    ],
  },
  fsmash: {
    length: 51,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'inOut' }),
      key(1, undefined, { z: PADDLE_BEHIND }),
      key(5, FS_WIND, { ease: 'out', swaps: { ...GRIT, handB: 'fist' } }),
      key(10, FS_COIL, { ease: 'in' }),
      key(12, mix(FS_SWING, { fx1: smear(wristF(FS_SWING), -150, true) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh' },
        z: {},
      }),
      ...strike(
        14,
        17,
        mix(FS_HIT, { fx1: smear(wristF(FS_HIT), toward(box('fsmash', 0, 1), box('fsmash')), true) }),
        { ...SHOUT, fx1: 'swoosh' },
      ),
      key(18, undefined, { swaps: GRIT }),
      key(20, FS_FOLLOW, { ease: 'out' }),
      key(27, FS_RECOIL, { ease: 'inOut', swaps: {} }),
      key(38, STAND, { ease: 'out' }),
      key(51, STAND),
    ],
  },
  usmash: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(4, US_LOW, { ease: 'inOut', swaps: { ...GRIT, handB: 'fist' } }),
      key(7, US_CHARGE, { ease: 'in' }),
      key(9, mix(US_FLIP, { fx1: smear(wristF(US_FLIP), -125, false) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh' },
      }),
      ...strike(10, 14, mix(US_TOSS, { fx1: smear(shoulderF(US_TOSS), -150, false, 0.88) }), {
        ...SHOUT,
        face: 'faceUp',
        fx1: 'swoosh',
      }),
      key(15, undefined, { swaps: { ...SHOUT, face: 'faceUp' } }),
      key(20, US_FOLLOW, { ease: 'inOut', swaps: { ...GRIT, face: 'faceUp' } }),
      done(26),
      key(45, STAND),
    ],
  },
  dsmash: {
    length: 49,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(1, undefined, { z: PADDLE_BEHIND }),
      key(4, DS_CHARGE, { ease: 'in', swaps: { ...GRIT, handB: 'fist' } }),
      key(5, DS_SWEEP, { ease: 'linear', swaps: { ...SHOUT, handB: 'fist' } }),
      key(6, mix(DS_MID, { fx1: flatSmear(shoulderF(DS_MID), 7, 0.3) }), {
        ease: 'linear',
        swaps: { ...SHOUT, handB: 'fist', fx1: 'swoosh' },
        z: {},
      }),
      ...strike(7, 9, mix(DS_FRONT, { fx1: flatSmear(shoulderF(DS_FRONT), 12, 0.25) }), {
        ...SHOUT,
        fx1: 'swoosh',
      }),
      key(8, undefined, { swaps: SHOUT }),
      key(10, DS_FRONT_END, { ease: 'in', swaps: GRIT }),
      key(11, turning(DS_MID, 0.6), { ease: 'step' }),
      key(12, turning(DS_MID, -0.6), { ease: 'linear' }),
      ...strike(13, 15, mix(flip(DS_FRONT), { fx1: flatSmear(shoulderF(flip(DS_FRONT)), 12, 0.25, true) }), {
        ...SHOUT,
        fx1: 'swoosh',
      }),
      key(14, undefined, { swaps: SHOUT }),
      key(21, flip(DS_FRONT_END), { ease: 'inOut', swaps: GRIT }),
      key(26, turning(flip(STAND), -0.6), { ease: 'step', swaps: {} }),
      key(27, turning(STAND, 0.6), { ease: 'out' }),
      key(31, STAND, { ease: 'inOut' }),
      key(49, STAND),
    ],
  },
  getupAttack: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, PRONE, { ease: 'inOut', swaps: { face: 'faceWorried' } }),
      key(7, GU_PUSH, { ease: 'inOut', swaps: GRIT }),
      key(13, GU_CROUCH, { ease: 'in', z: PADDLE_BEHIND }),
      key(15, mix(DS_MID, { fx1: flatSmear(shoulderF(DS_MID), 7, 0.3) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh' },
        z: {},
      }),
      ...strike(16, 18, mix(GU_FRONT, { fx1: flatSmear(shoulderF(GU_FRONT), 10, 0.25) }), {
        ...SHOUT,
        fx1: 'swoosh',
      }),
      key(17, undefined, { swaps: SHOUT }),
      key(20, turning(DS_MID, 0.6), { ease: 'step', swaps: GRIT }),
      key(21, turning(DS_MID, -0.6), { ease: 'out' }),
      ...strike(24, 26, mix(flip(GU_FRONT), { fx1: flatSmear(shoulderF(flip(GU_FRONT)), 10, 0.25, true) }), {
        ...SHOUT,
        fx1: 'swoosh',
      }),
      key(25, undefined, { swaps: SHOUT }),
      key(32, flip(GU_CROUCH), { ease: 'inOut', swaps: GRIT }),
      key(35, turning(flip(STAND), -0.6), { ease: 'step', swaps: {} }),
      key(36, turning(STAND, 0.6), { ease: 'out' }),
      key(39, STAND, { ease: 'inOut' }),
      key(45, STAND),
    ],
  },
  nair: {
    length: 43,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(3, SPIN_TUCK, { ease: 'in', swaps: { ...GRIT, hat: 'hatChute' } }),
      ...[4, 7, 10, 13, 16, 19, 22].map((f, i) =>
        key(f, mix(i % 2 ? flip(SPIN) : SPIN, SPIN_RING), {
          ease: 'step',
          swaps: { ...(i ? GRIT : SHOUT), hat: 'hatChute', fx1: 'swoosh', fx2: 'swoosh' },
        }),
      ),
      key(25, flip(SPIN), { ease: 'step', swaps: { ...GRIT, hat: 'hatChute' } }),
      key(27, turning(flip(SPIN), -0.6), { ease: 'step' }),
      key(28, turning(SPIN, 0.6), { ease: 'out' }),
      key(31, SPIN, { ease: 'inOut' }),
      key(36, AIR, { ease: 'inOut', swaps: {} }),
      key(43, AIR),
    ],
  },
  fair: {
    length: 45,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(6, FAIR_WIND, { ease: 'in', swaps: GRIT, z: PADDLE_BEHIND }),
      key(8, mix(FAIR_OVER, { fx1: smear(wristF(FAIR_OVER), 210, true) }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh' },
        z: {},
      }),
      ...strike(9, 10, FAIR_HIGH, SHOUT),
      key(11, mix(FAIR_LOW, { fx1: smear(shoulderF(FAIR_LOW), -54, true, 1.2), fx2: FAIR_GHOST }), {
        ease: 'linear',
        swaps: { ...SHOUT, fx1: 'swoosh', fx2: 'paddle' },
      }),
      key(12, FAIR_LOW, { ease: 'linear', swaps: SHOUT }),
      key(14, FAIR_LOW, { ease: 'out' }),
      key(20, FAIR_FOLLOW, { ease: 'inOut', swaps: GRIT }),
      done(26),
      key(45, AIR),
    ],
  },
  bair: {
    length: 33,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(4, BAIR_WIND, { ease: 'in', swaps: { ...GRIT, face: 'faceBack' } }),
      key(5, turning(BAIR_HIT, 0.6), { ease: 'linear', swaps: GRIT }),
      ...strike(6, 9, mix(BAIR_HIT, { fx1: smear(at(BAIR_HIT, 'handF'), 90, true) }), {
        ...SHOUT,
        fx1: 'swoosh',
      }),
      key(7, undefined, { swaps: SHOUT }),
      key(15, BAIR_FOLLOW, { ease: 'inOut', swaps: GRIT }),
      key(18, turning(BAIR_FOLLOW, -0.6), { ease: 'step', swaps: {} }),
      key(19, turning(AIR, 0.6), { ease: 'out' }),
      key(22, AIR, { ease: 'inOut' }),
      key(33, AIR),
    ],
  },
  uair: {
    length: 30,
    swaps: ANGRY,
    keys: [
      key(0, AIR, { ease: 'out' }),
      key(2, UAIR_COCK, { ease: 'in', swaps: GRIT }),
      key(
        4,
        mix(UAIR_A, {
          fx1: smear(wristF(UAIR_A), 172, false),
          fx2: smear(wristF(UAIR_A), -150, false, 0.62),
        }),
        { ease: 'linear', swaps: { ...SHOUT, face: 'faceUp', fx1: 'swoosh', fx2: 'swoosh' } },
      ),
      key(5, undefined, { swaps: { ...SHOUT, face: 'faceUp', fx2: 'swoosh' } }),
      key(8, mix(UAIR_B, { fx2: smear(wristF(UAIR_B), -160, false, 0.57) }), {
        ease: 'out',
        swaps: { ...SHOUT, face: 'faceUp', fx2: 'swoosh' },
      }),
      key(9, undefined, { swaps: { ...GRIT, face: 'faceUp' } }),
      key(16, AIR, { ease: 'inOut', swaps: {} }),
      key(30, AIR),
    ],
  },
  dair: {
    length: 45,
    swaps: { ...ANGRY, fx1: 'boxes' },
    keys: [
      key(0, mix(AIR, { fx1: stack(1, -1) }), { ease: 'out', swaps: { fx1: null } }),
      key(3, mix(STOMP(0.6), { fx1: { ...stack(1), sx: 0.3, sy: 0.3 } }), { ease: 'outBack', swaps: GRIT }),
      key(6, mix(STOMP(1), { fx1: stack(1) }), { ease: 'in' }),
      key(8, mix(STOMP(0, 0.25), { fx1: stack(0.88) }), { ease: 'out', swaps: SHOUT }),
      key(10, mix(STOMP(-1), { fx1: stack(1) }), { ease: 'in', swaps: GRIT }),
      key(11, mix(STOMP(0, 0.25), { fx1: stack(0.88) }), { ease: 'out', swaps: SHOUT }),
      key(13, mix(STOMP(1), { fx1: stack(1) }), { ease: 'in', swaps: GRIT }),
      key(14, mix(STOMP(0, 0.25), { fx1: stack(0.88) }), { ease: 'out', swaps: SHOUT }),
      key(16, mix(STOMP(-1), { fx1: stack(1) }), { ease: 'in', swaps: GRIT }),
      key(17, mix(STOMP(0, 0.25), { fx1: stack(0.88) }), { ease: 'out', swaps: SHOUT }),
      key(19, mix(STOMP(1), { thighB: { rot: -50 }, shinB: { rot: 70 }, fx1: stack(1) }), {
        ease: 'in',
        swaps: GRIT,
      }),
      key(20, mix(STOMP(0, 0.45), { body: { sy: 0.94, sx: 1.04 }, fx1: stack(0.78) }), {
        ease: 'out',
        swaps: SHOUT,
      }),
      key(22, mix(STOMP(0, 0.2), { fx1: stack(0.9, 1.2) }), { ease: 'in' }),
      key(27, mix(AIR, { fx1: { ...stack(1, 7), rot: 14 } }), { ease: 'inOut', swaps: GRIT }),
      key(28, undefined, { swaps: { fx1: null } }),
      key(45, AIR),
    ],
  },
  grab: {
    length: 36,
    swaps: ANGRY,
    keys: [
      key(0, STAND, { ease: 'out' }),
      key(5, GRAB_DIP, { ease: 'in', swaps: GRIT }),
      ...strike(7, 9, GRAB_SCOOP, SHOUT),
      key(16, GRAB_SCOOP, { ease: 'inOut', swaps: { face: 'faceWorried' } }),
      key(36, STAND),
    ],
  },
  dashGrab: {
    length: 44,
    swaps: ANGRY,
    keys: [
      key(0, grip(stance(0.4, 0.5, 12, -1.0, 1.4), [3.0, -5.8], -150, [-2.4, -4.4]), { ease: 'out' }),
      key(6, DGRAB_DIP, { ease: 'in', swaps: GRIT }),
      ...strike(9, 11, DGRAB_SCOOP, SHOUT),
      key(20, DGRAB_SCOOP, { ease: 'inOut', swaps: { face: 'faceWorried' } }),
      key(44, STAND),
    ],
  },
  pivotGrab: {
    length: 38,
    swaps: ANGRY,
    keys: [
      key(0, flip(STAND), { ease: 'step' }),
      key(2, turning(flip(STAND), -0.6), { ease: 'step', swaps: GRIT }),
      key(3, turning(GRAB_DIP, 0.6), { ease: 'out' }),
      key(8, GRAB_DIP, { ease: 'in' }),
      ...strike(10, 12, PGRAB_SCOOP, SHOUT),
      key(20, PGRAB_SCOOP, { ease: 'inOut', swaps: { face: 'faceWorried' } }),
      key(38, STAND),
    ],
  },
  pummel: {
    length: 6,
    swaps: { ...GRIT, prop: 'shaker', handB: 'fist' },
    keys: [
      key(0, PM_UP, { ease: 'in', z: BACK_ARM_FRONT }),
      key(1, mix(PM_SHAKE, { fx2: dust(PM_SHAKE) }), { ease: 'out', swaps: { ...SHOUT, fx2: 'pepperDust' } }),
      key(2, undefined, { swaps: SHOUT }),
      key(3, PM_UP2, { ease: 'in', swaps: {} }),
      key(4, mix(PM_SHAKE2, { fx2: dust(PM_SHAKE2, 0.8) }), { ease: 'out', swaps: { fx2: 'pepperDust' } }),
      key(5, undefined, { swaps: {} }),
      key(6, PM_UP),
    ],
  },
  fthrow: {
    length: 29,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(8, FT_LIFT, { ease: 'in', swaps: GRIT }),
      key(11, mix(FT_SHOVE, { fx1: flatSmear(shoulderF(FT_SHOVE), 12, 0.2) }), {
        ease: 'out',
        swaps: { ...SHOUT, fx1: 'swoosh' },
      }),
      key(12, undefined, { swaps: SHOUT }),
      key(13, FT_SHOVE, { ease: 'in' }),
      key(17, FT_YANK, { ease: 'out', swaps: GRIT }),
      key(29, STAND, { swaps: {} }),
    ],
  },
  bthrow: {
    length: 51,
    swaps: { ...ANGRY, fxBack: 'oven' },
    keys: [
      key(0, mix(HOLD, { fx3: oven(0) }), { ease: 'inOut', swaps: { fxBack: null } }),
      key(6, mix(BT_LIFT, { fx3: oven(0) }), { ease: 'in', swaps: GRIT }),
      key(10, mix(BT_LIFT, { fx3: oven(0.3) }), { ease: 'outBack', swaps: {} }),
      key(13, mix(BT_SETTLE, { fx3: oven(1) }), { ease: 'in' }),
      key(15, mix(turning(BT_LIFT, 0.6), { fx3: oven(1) }), { ease: 'step', swaps: GRIT }),
      key(16, mix(turning(BT_TURNED, -0.6), { fx3: oven(1) }), { ease: 'out' }),
      key(18, mix(BT_TURNED, { fx3: oven(1) }), { ease: 'inOut' }),
      key(25, mix(BT_WIND, { fx3: oven(1) }), { ease: 'in' }),
      key(29, mix(BT_SHOVE, { fx3: oven(1) }), { ease: 'linear', swaps: SHOUT }),
      key(31, mix(BT_SHOVE, { fx3: oven(1, 1.12, 0.9) }), { ease: 'out' }),
      key(34, mix(BT_SHOVE, { fx3: oven(1, 0.95, 1.1) }), { ease: 'inOut' }),
      key(38, mix(BT_REC, { fx3: oven(1) }), { ease: 'inOut', swaps: GRIT }),
      key(41, mix(turning(BT_REC, -0.6), { fx3: oven(1) }), { ease: 'step', swaps: {} }),
      key(42, mix(turning(STAND, 0.6), { fx3: oven(1.05) }), { ease: 'out' }),
      key(44, mix(STAND, { fx3: oven(1.1) }), { ease: 'in' }),
      key(47, mix(STAND, { fx3: oven(0) }), { ease: 'inOut' }),
      key(48, undefined, { swaps: { fxBack: null } }),
      key(51, STAND),
    ],
  },
  uthrow: {
    length: 37,
    swaps: ANGRY,
    keys: [
      key(0, HOLD, { ease: 'inOut' }),
      key(5, UT_LOWER, { ease: 'inOut', swaps: GRIT }),
      key(9, UT_HEAVE, { ease: 'out', swaps: { ...GRIT, handB: 'fist' } }),
      key(11, mix(utSpin(1, -150), { fx1: smear([3.2, -10.0], -150, true, 0.8) }), {
        ease: 'linear',
        swaps: { ...GRIT, face: 'faceUp', fx1: 'swoosh' },
      }),
      key(12, undefined, { swaps: { ...GRIT, face: 'faceUp' } }),
      key(13, utSpin(-1, -160), { ease: 'linear' }),
      key(15, mix(utSpin(1, -150), { fx1: smear([3.2, -10.0], -150, true, 0.8) }), {
        ease: 'linear',
        swaps: { ...GRIT, face: 'faceUp', fx1: 'swoosh' },
      }),
      key(16, undefined, { swaps: { ...GRIT, face: 'faceUp' } }),
      key(17, utSpin(-1, -160), { ease: 'in' }),
      key(19, mix(UT_FLICK, { fx1: smear(wristF(UT_FLICK), 178, false) }), {
        ease: 'out',
        swaps: { ...SHOUT, face: 'faceUp', fx1: 'swoosh' },
      }),
      key(20, undefined, { swaps: { ...SHOUT, face: 'faceUp' } }),
      key(26, US_FOLLOW, { ease: 'inOut', swaps: GRIT }),
      done(30),
      key(37, STAND),
    ],
  },
  dthrow: {
    length: 39,
    swaps: { ...ANGRY, fx2: 'boxes' },
    keys: [
      key(0, mix(HOLD, { fx2: pizzaBox(0) }), { ease: 'inOut', swaps: { fx2: null } }),
      key(5, mix(DT_RAISE, { fx2: pizzaBox(0.2) }), { ease: 'outBack', swaps: GRIT }),
      key(9, mix(DT_RAISE, { fx2: pizzaBox(1) }), { ease: 'inOut' }),
      key(17, mix(DT_STOMP_UP, { fx2: pizzaBox(1) }), { ease: 'in' }),
      key(21, mix(DT_SLAM, { fx2: pizzaBox(1, 0.8), fx1: smear(wristF(DT_SLAM), -92, true) }), {
        ease: 'out',
        swaps: { ...SHOUT, fx1: 'swoosh' },
      }),
      key(22, undefined, { swaps: SHOUT }),
      key(23, mix(DT_SLAM, { fx2: pizzaBox(1, 1.08) }), { ease: 'inOut' }),
      key(28, mix(DT_END, { fx2: pizzaBox(1) }), { ease: 'in', swaps: GRIT }),
      key(31, mix(STAND, { fx2: pizzaBox(0) }), { ease: 'inOut' }),
      key(32, undefined, { swaps: { fx2: null } }),
      key(39, STAND),
    ],
  },
};

export const attacks: Record<string, AnimClip> = Object.fromEntries(
  Object.entries(clips).map(([name, clip]) => [name, plant(unwrap(clip))]),
);
