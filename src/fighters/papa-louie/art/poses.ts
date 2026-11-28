import { reach, type Pose } from '../../../render/rig/author';
import { flattenPath } from '../../../render/rig/geometry';
import { between as blend, floorContact } from '../../../render/rig/keys';
import { worldTransforms, type BoneTransform } from '../../../render/rig/sample';
import type { AnimClip, Key } from '../../../render/rig/types';
import { FOOT, HAND, rig } from './rig';

/**
 * Authoring vocabulary for Papa Louie's clips. Rig space: y down, feet at the origin, facing right; rot > 0 is
 * clockwise (a limb hanging down swings backwards, the body leans forwards). Poses are offsets from the rest
 * pose in rig.ts, and every key is a full pose.
 */

export type Pt = readonly [number, number];
export type { Pose };

const DEG = 180 / Math.PI;

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/** `a` moved `t` of the way to `b`, each bone turning the short way round on screen (keys.ts `between`). */
export const between = (a: Pose, b: Pose, t: number): Pose => blend(rig, a, b, t);

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

function locals(pose: Pose): Record<string, BoneTransform> {
  const out: Record<string, BoneTransform> = {};
  for (const bone of rig.bones) {
    const p = pose[bone.name] ?? {};
    out[bone.name] = {
      x: bone.x + (p.x ?? 0),
      y: bone.y + (p.y ?? 0),
      rot: (bone.rot ?? 0) + (p.rot ?? 0),
      sx: (bone.sx ?? 1) * (p.sx ?? 1),
      sy: (bone.sy ?? 1) * (p.sy ?? 1),
    };
  }
  return out;
}

/** Where a bone's point (bone space) lands in rig space for this pose. */
export function pointOf(pose: Pose, bone: string, x = 0, y = 0): [number, number] {
  const m = worldTransforms(rig, locals(pose))[bone]!;
  return [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty];
}

/** A bone's direction in rig space, in degrees (0 = its +y axis pointing straight down). */
function worldRot(pose: Pose, bone: string): number {
  const m = worldTransforms(rig, locals(pose))[bone]!;
  return Math.atan2(m.b, m.a) * DEG;
}

/** Plants the ankles at rig points (the sole is 1 unit below the ankle) with the shoes flat. Knees bend forwards. */
export function feet(pose: Pose, back: Pt, front: Pt): Pose {
  const p = reach(rig, pose, 'thighB', 'shinB', FOOT, back, 1);
  return aim(aim(reach(rig, p, 'thighF', 'shinF', FOOT, front, 1), 'footB', 0), 'footF', 0);
}

/** Puts the wrists on rig points (null leaves an arm alone); `bend` -1 drops the elbows. */
export function hands(pose: Pose, back: Pt | null, front: Pt | null, bend: 1 | -1 = -1): Pose {
  let p = pose;
  if (back) p = reach(rig, p, 'armB', 'foreB', HAND, back, bend);
  if (front) p = reach(rig, p, 'armF', 'foreF', HAND, front, bend);
  return p;
}

/**
 * Turns `bone` so its +y axis points along `deg` in rig space: 0 straight down, -90 forward (+x), 90 back,
 * 180 straight up. Use it to aim the paddle, the hands and the feet whatever the arm is doing.
 */
export function aim(pose: Pose, bone: string, deg: number): Pose {
  const parent = rig.bones.find((b) => b.name === bone)!.parent!;
  const rest = rig.bones.find((b) => b.name === bone)!.rot ?? 0;
  const rot = deg - worldRot(pose, parent) - rest;
  return mix(pose, { [bone]: { rot: ((rot + 540) % 360) - 180 } });
}

/**
 * The paddle pointing along `deg` (see aim), with the wrist turned to follow so the fist stays square on the
 * handle.
 */
export function swing(pose: Pose, deg: number): Pose {
  const hand = aim(pose, 'handF', deg);
  return aim(hand, 'paddle', deg);
}

/** Both hands on the handle: the front hand at `grip`, the back hand further up the handle towards the butt. */
export function twoHanded(pose: Pose, grip: Pt, deg: number): Pose {
  const r = (deg + 180) / DEG;
  const back: Pt = [grip[0] - Math.sin(r) * -0.9, grip[1] + Math.cos(r) * -0.9];
  return swing(hands(pose, back, grip), deg);
}

/** The apron's waistband, in hip space: `tuckApron` shortens the apron about it. */
const WAIST = -0.7;

/**
 * Shortens the apron (drawn as `symbols` has it) about its waistband until its hem rests on the floor, as it would
 * bunch against it in a deep crouch.
 */
export function tuckApron(pose: Pose, symbols: Record<string, string | null>): Pose {
  const shapes = symbols.apron ? rig.symbols[symbols.apron] : undefined;
  if (!Array.isArray(shapes)) return pose;
  let p = pose;
  for (let i = 0; i < 3; i++) {
    const m = worldTransforms(rig, locals(p)).apron!;
    let [hem, depth] = [-Infinity, 0];
    for (const shape of shapes)
      for (const pts of flattenPath(shape.d, 4))
        for (let j = 0; j < pts.length; j += 2) {
          const y = m.b * pts[j]! + m.d * pts[j + 1]! + m.ty;
          if (y > hem) [hem, depth] = [y, pts[j + 1]! - WAIST];
        }
    // How far the hem rises per unit the apron is shortened: under 0 it hangs upside down and can't be tucked.
    const was = p.apron?.sy ?? 1;
    const rise = (m.d / was) * depth;
    if (hem <= 0.01 || rise <= 0) break;
    const s = Math.max(0.5, was - hem / rise);
    p = mix(p, { apron: { sy: s, y: WAIST * (1 - s) } });
  }
  return p;
}

/** Effects and the back hand's prop, placed in rig space or out of reach of the floor: `onFloor` leaves them out. */
const LOOSE = new Set(['fxBack', 'fx1', 'fx2', 'prop']);

/**
 * `clip` baked on whole frames with the apron tucked up (`tuckApron`) where a crouch would sink its hem, and his
 * body lifted on any frame where something else would still dip below the floor.
 */
export const onFloor = (clip: AnimClip): AnimClip =>
  floorContact(rig, clip, { bone: 'body', adjust: tuckApron, skip: (slot) => LOOSE.has(slot) });

/** Standing: feet apart under the hips, the paddle held upright at his side like a chef on parade. */
export const STAND: Pose = swing(
  hands(feet({ body: { y: 0.15 } }, [-1.05, -1], [1.2, -1]), [-2.2, -3.6], [3.3, -5.0]),
  -168,
);

/** Knees bent and the body sunk (landing, crouch, jumpsquat). */
export const SQUAT: Pose = swing(
  hands(
    feet({ body: { y: 0.9 }, head: { sx: 1.04, sy: 0.96 } }, [-1.35, -1], [1.45, -1]),
    [-2.4, -2.4],
    [2.6, -2.8],
  ),
  -75,
);

/** Airborne, limbs loose, the paddle held up and back. */
export const AIR: Pose = swing(
  hands(
    mix({ thighF: { rot: -40 }, shinF: { rot: 45 }, thighB: { rot: 20 }, shinB: { rot: 30 } }),
    [-2.6, -5.6],
    [2.4, -6.4],
  ),
  150,
);
