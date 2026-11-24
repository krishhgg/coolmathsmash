import { worldTransforms, type BoneTransform } from './sample';
import type { BonePose, Rig } from './types';

/**
 * Authoring helpers for clips: they run once when an art module loads and return plain data, so clips can be
 * written as poses with planted feet and hands on targets instead of raw angles.
 */

export type Pose = Record<string, BonePose>;

function locals(rig: Rig, pose: Pose): Record<string, BoneTransform> {
  const out: Record<string, BoneTransform> = {};
  for (const bone of rig.bones) {
    const p = pose[bone.name] ?? {};
    out[bone.name] = {
      x: bone.x + (p.x ?? 0),
      y: bone.y + (p.y ?? 0),
      rot: (bone.rot ?? 0) + (p.rot ?? 0),
      sx: p.sx ?? 1,
      sy: p.sy ?? 1,
    };
  }
  return out;
}

const DEG = 180 / Math.PI;

/**
 * Two-bone IK. Rotates `upper` and `lower` (lower is a child of upper, offset straight down its +y axis) so
 * that the point `length` units down `lower`'s +y axis lands on `target` (rig space, y down). `bend` +1 puts
 * the joint on the +x side of a limb hanging straight down (a knee for a right-facing fighter); -1 the other way.
 * Out-of-reach targets straighten the limb towards them. Returns a new pose.
 */
export function reach(
  rig: Rig,
  pose: Pose,
  upper: string,
  lower: string,
  length: number,
  target: readonly [number, number],
  bend: 1 | -1 = 1,
): Pose {
  const bones = Object.fromEntries(rig.bones.map((b) => [b.name, b]));
  const up = bones[upper];
  const lo = bones[lower];
  if (!up || !lo || lo.parent !== upper) throw new Error(`${lower} must be a child of ${upper}`);
  const world = worldTransforms(rig, locals(rig, pose));
  const parent = up.parent ? world[up.parent]! : { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const parentRot = Math.atan2(parent.b, parent.a) * DEG;
  const u = world[upper]!;
  const l = world[lower]!;
  const l1 = Math.hypot(l.tx - u.tx, l.ty - u.ty);
  const l2 = length * Math.hypot(l.c, l.d);
  const vx = target[0] - u.tx;
  const vy = target[1] - u.ty;
  const dist = Math.min(Math.max(Math.hypot(vx, vy), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const line = Math.atan2(-vx, vy) * DEG;
  const alpha = Math.acos((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)) * DEG;
  const upperWorld = line - bend * alpha;
  const kx = u.tx - Math.sin(upperWorld / DEG) * l1;
  const ky = u.ty + Math.cos(upperWorld / DEG) * l1;
  const lowerWorld = Math.atan2(-(target[0] - kx), target[1] - ky) * DEG;
  return {
    ...pose,
    [upper]: { ...pose[upper], rot: wrap(upperWorld - parentRot - (up.rot ?? 0)) },
    [lower]: { ...pose[lower], rot: wrap(lowerWorld - upperWorld - (lo.rot ?? 0)) },
  };
}

function wrap(deg: number): number {
  return Math.round((((((deg + 180) % 360) + 360) % 360) - 180) * 100) / 100;
}

/** Rig-space position of a bone's origin (or of a point in its space) in `pose`. */
export function pointOf(rig: Rig, pose: Pose, bone: string, x = 0, y = 0): [number, number] {
  const m = worldTransforms(rig, locals(rig, pose))[bone]!;
  return [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty];
}
