import { pointOf, reach, type Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import { samplePose, worldTransforms, type Affine, type BoneTransform } from '../../../render/rig/sample';
import type { AnimClip, FighterArt, Key } from '../../../render/rig/types';
import { ANKLE } from './parts';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for Johnny's clips: IK helpers, pose mixing and the swap sets for his mouths and hands.
 * Rig space: y down, feet at the origin, facing right; rot > 0 is clockwise.
 */

export type Pt = readonly [number, number];

/** Rig-space matrix of every bone in `pose`. */
function worldOf(pose: Pose): Record<string, Affine> {
  const local: Record<string, BoneTransform> = {};
  for (const bone of rig.bones) {
    const p = pose[bone.name] ?? {};
    local[bone.name] = {
      x: bone.x + (p.x ?? 0),
      y: bone.y + (p.y ?? 0),
      rot: (bone.rot ?? 0) + (p.rot ?? 0),
      sx: (bone.sx ?? 1) * (p.sx ?? 1),
      sy: (bone.sy ?? 1) * (p.sy ?? 1),
    };
  }
  return worldTransforms(rig, local);
}

/** World rotation (degrees) of every bone in `pose`. */
function worldRot(pose: Pose): Record<string, number> {
  return Object.fromEntries(
    Object.entries(worldOf(pose)).map(([k, m]) => [k, (Math.atan2(m.b, m.a) * 180) / Math.PI]),
  );
}

/** The lowest drawn point of `pose` in rig y (down), with each slot wearing its rest symbol. */
function lowest(pose: Pose): number {
  const world = worldOf(pose);
  let low = -Infinity;
  for (const slot of rig.slots) {
    const sym = slot.symbol ? rig.symbols[slot.symbol] : undefined;
    if (slot.decor || !Array.isArray(sym)) continue;
    const m = world[slot.bone]!;
    for (const shape of sym)
      for (const pts of flattenPath(shape.d, 4))
        for (let i = 0; i < pts.length; i += 2) low = Math.max(low, m.b * pts[i]! + m.d * pts[i + 1]! + m.ty);
  }
  return low;
}

/**
 * Lifts an airborne drawing (through `body`) until nothing hangs below the rig root, the floor he lands on, so he
 * never sinks into a platform in the air and pops up when he touches down.
 */
export function aloft(pose: Pose): Pose {
  const low = lowest(pose);
  return low <= 0 ? pose : mix(pose, { body: { y: (pose.body?.y ?? 0) - low } });
}

/** Moves a drawing (through `body`) up or down until its lowest point rests on the floor: rolls and lying poses. */
export function grounded(pose: Pose): Pose {
  return mix(pose, { body: { y: (pose.body?.y ?? 0) - lowest(pose) } });
}

/** Turns one boot so its sole meets the world at `deg` degrees (0: flat, toes forward; 90: toes down). */
export function sole(pose: Pose, side: 'B' | 'F', deg: number): Pose {
  const shin = worldRot(pose)[`shin${side}`] ?? 0;
  return { ...pose, [`foot${side}`]: { ...pose[`foot${side}`], rot: deg - shin } };
}

/** Turns both boots: the far one to `back` degrees, the near one to `front`. */
export function soles(pose: Pose, back = 0, front = 0): Pose {
  return sole(sole(pose, 'B', back), 'F', front);
}

/**
 * Puts one leg's ankle on a rig point with its sole at `deg`: `stretch` lengthens thigh and shin (Flash-style
 * rubber hose, for kicks), `bend` 1 puts the knee forward.
 */
export function leg(
  pose: Pose,
  side: 'B' | 'F',
  ankle: Pt,
  deg: number,
  stretch = 1,
  bend: 1 | -1 = 1,
): Pose {
  const s = mix(pose, { [`thigh${side}`]: { sy: stretch }, [`shin${side}`]: { sy: stretch } });
  return sole(reach(rig, s, `thigh${side}`, `shin${side}`, FOOT, ankle, bend), side, deg);
}

/** `leg` with the knee bent whichever way keeps it higher: knees up when sitting, lying or chambering a kick. */
export function tuck(pose: Pose, side: 'B' | 'F', ankle: Pt, deg: number, stretch = 1): Pose {
  const [up, down] = [leg(pose, side, ankle, deg, stretch, 1), leg(pose, side, ankle, deg, stretch, -1)];
  return pointOf(rig, up, `shin${side}`)[1] <= pointOf(rig, down, `shin${side}`)[1] ? up : down;
}

/** Puts one fist on a rig point; `stretch` lengthens the arm for big punches. */
export function fist(pose: Pose, side: 'B' | 'F', at: Pt, stretch = 1, bend: 1 | -1 = -1): Pose {
  const s = mix(pose, { [`arm${side}`]: { sy: stretch }, [`fore${side}`]: { sy: stretch } });
  return reach(rig, s, `arm${side}`, `fore${side}`, HAND, at, bend);
}

/**
 * Plants the boots with their soles on rig points (the far leg `back`, the near leg `front`), soles flat.
 * Knees bow outwards, as in his stance; `bend` flips the near knee for strides.
 */
export function feet(pose: Pose, back: Pt, front: Pt, bend: 1 | -1 = -1): Pose {
  const p = reach(rig, pose, 'thighB', 'shinB', FOOT, [back[0], back[1] - ANKLE], 1);
  return soles(reach(rig, p, 'thighF', 'shinF', FOOT, [front[0], front[1] - ANKLE], bend));
}

/** Puts the hands (fist or palm centres) on rig points; null leaves an arm alone. */
export function hands(
  pose: Pose,
  back: Pt | null,
  front: Pt | null,
  bendB: 1 | -1 = 1,
  bendF: 1 | -1 = 1,
): Pose {
  let p = pose;
  if (back) p = reach(rig, p, 'armB', 'foreB', HAND, back, bendB);
  if (front) p = reach(rig, p, 'armF', 'foreF', HAND, front, bendF);
  return p;
}

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/**
 * `clip` keyed on every frame, each one moved up or down (through `body`) so its lowest point rests on the floor.
 * A tween between two planted poses can bend a knee through the floor or lift the boots off it; keying every frame
 * on the floor stops that. Swaps, draw orders and step keys stay on their frames.
 */
export function onFloor(clip: AnimClip): AnimClip {
  const art: FighterArt = { rig, clips: { clip }, palettes: { default: {} }, height: 0, icon: '' };
  const keys = Array.from({ length: clip.length + 1 }, (_, frame) => {
    const { local } = samplePose(art, 'clip', frame, frame);
    const pose: Pose = Object.fromEntries(
      rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
        const p = local[name]!;
        return [name, { x: p.x - x, y: p.y - y, rot: p.rot - rot, sx: p.sx / sx, sy: p.sy / sy }];
      }),
    );
    const authored = clip.keys.filter((k) => k.frame === frame).reverse();
    const swaps = authored.find((k) => k.swaps)?.swaps;
    const z = authored.find((k) => k.z)?.z;
    const step = authored.find((k) => k.pose)?.ease === 'step';
    return key(frame, grounded(pose), {
      ease: step ? 'step' : 'linear',
      ...(swaps && { swaps }),
      ...(z && { z }),
    });
  });
  return { ...clip, keys };
}

const LIMBS = ['armB', 'foreB', 'armF', 'foreF', 'thighB', 'shinB', 'footB', 'thighF', 'shinF', 'footF'];

/**
 * Turns every limb the short way from one posed key to the next (a bone a key leaves out tweens from rest), so a
 * leg swung across the body goes over the top instead of sweeping through the floor. `body` keeps its authored
 * angles, so whole-body spins still turn as far as they are keyed.
 */
export function shortTurns(keys: Key[]): Key[] {
  const last: Record<string, number> = {};
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    for (const bone of LIMBS) {
      const rot = pose[bone]?.rot ?? 0;
      const turned = rot - 360 * Math.round((rot - (last[bone] ?? rot)) / 360);
      if (pose[bone]) pose[bone] = { ...pose[bone], rot: turned };
      last[bone] = pose[bone] ? turned : 0;
    }
    return { ...k, pose };
  });
}

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

export const GRIT = { face: 'grit' };
export const SHOUT = { face: 'shout' };
export const SMIRK = { face: 'smirk' };
export const HURT = { face: 'hurt' };

export const FIST_F = { foreF: 'fist', foreFLine: 'fistLine' };
export const FIST_B = { foreB: 'fistFar', foreBLine: 'fistFarLine' };
export const PALM_F = { foreF: 'palm', foreFLine: 'palmLine' };
export const PALM_B = { foreB: 'palmFar', foreBLine: 'palmFarLine' };
/** The idle's hands: open guard in front, fist cocked behind. */
export const GUARD = { ...PALM_F, ...FIST_B };
export const FISTS = { ...FIST_F, ...FIST_B };

/** Draw orders that move `slots` (in order) just above slot `over`; slot i draws at z = i. */
function above(over: string, slots: string[]): Record<string, number> {
  const z = rig.slots.findIndex((s) => s.name === over);
  return Object.fromEntries(slots.map((name, i) => [name, z + (i + 1) / 10]));
}

export const BACK_ARM_IN_FRONT = above('foreF', ['armBLine', 'foreBLine', 'armB', 'foreB']);
export const FRONT_ARM_BEHIND = above('fxBack', ['armFLine', 'foreFLine', 'armF', 'foreF']);
export const HEAD_IN_FRONT = above('foreF', ['', '', '', '', 'head', 'face']);
/** The far arm drawn over his head and torso but under the near arm, for guards held across the face. */
export const BACK_ARM_OVER_HEAD = above('face', ['armBLine', 'foreBLine', 'armB', 'foreB']);
/** The far leg drawn over the torso but under the head and near arm (the knee). */
export const BACK_LEG_IN_FRONT = above('torso', ['thighBLine', 'shinBLine', 'thighB', 'shinB', 'footB']);
/** The near leg drawn over the torso, for kicks and knees raised across it. */
export const FRONT_LEG_IN_FRONT = above('torso', ['thighFLine', 'shinFLine', 'thighF', 'shinF', 'footF']);

/** His fighting stance from the game's idle: wide bow-legged feet, fist up by the chin, open hand guarding. */
export const STANCE = hands(
  mix(feet({ hip: { y: 0.25 }, body: { rot: 2 } }, [3.0, 0], [-2.4, 0]), { footF: { sx: -1 } }),
  [5.7, -9.0],
  [-3.7, -8.9],
  -1,
  1,
);

/** Turnaround pivot: squared up to the camera, fists on his hips, boots splayed; nearly the same drawing either way round. */
export const PIVOT = hands(
  mix(
    feet({ hip: { y: 0.45 }, armF: { x: -0.35 }, armB: { x: 0.35 }, neck: { y: 0.15 } }, [3.5, 0], [-3.1, 0]),
    { footF: { sx: -1 } },
  ),
  [4.3, -4.6],
  [-3.6, -4.7],
  -1,
  1,
);

/** Standing tall, arms at his sides (turnarounds and getups pass through it). */
export const STAND = hands(feet({}, [2.0, 0], [-1.6, 0]), [4.6, -4.9], [-3.6, -4.9], 1, -1);

/** Knees bent, head pulled into the shoulders. */
export const CROUCH = hands(
  feet({ hip: { y: 1.6 }, body: { rot: 8 }, neck: { y: 0.4 } }, [3.0, 0], [-3.0, 0]),
  [4.6, -5.6],
  [-2.4, -5.4],
  1,
  -1,
);

/** Airborne, limbs loose. */
export const AIR: Pose = {
  thighF: { rot: -40 },
  shinF: { rot: 55 },
  thighB: { rot: 20 },
  shinB: { rot: 35 },
  armF: { rot: -50 },
  foreF: { rot: -70 },
  armB: { rot: 45 },
  foreB: { rot: 40 },
};
