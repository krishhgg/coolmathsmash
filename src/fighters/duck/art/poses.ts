import type { Pose } from '../../../render/rig/author';
import { toLocal, worldTransforms, type Affine, type BoneTransform } from '../../../render/rig/sample';
import type { BonePose, Key } from '../../../render/rig/types';
import { LEG, WING } from './parts';
import { rig } from './rig';

/**
 * Authoring vocabulary for the Duck's clips: placing the head, legs and wings on rig points, effect placement
 * and swap sets. Rig space: y down, feet at the origin, facing right; rot > 0 is clockwise (the body leans
 * forwards).
 */

export type Pt = readonly [number, number];
const DEG = 180 / Math.PI;

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

export function world(pose: Pose): Record<string, Affine> {
  return worldTransforms(rig, locals(pose));
}

/** World rotation of a bone's frame in degrees (scale and mirroring left out). */
function angle(m: Affine): number {
  return Math.atan2(m.b, m.a) * DEG;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Merges poses bone by bone (later wins per field). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) for (const [bone, bp] of Object.entries(p)) out[bone] = { ...out[bone], ...bp };
  return out;
}

export function key(frame: number, pose?: Pose, extra: Omit<Key, 'frame' | 'pose'> = {}): Key {
  return pose ? { frame, pose, ...extra } : { frame, ...extra };
}

/**
 * Puts the head's centre on rig point `to`, measured in the belly's frame so the head rides the body, with the
 * beak pointing at world angle `aim` (degrees, 0 = forwards, 90 = down).
 */
export function headAt(pose: Pose, to: Pt, aim: number): Pose {
  const w = world(pose).body!;
  const tilt = aim - angle(w);
  const sx = Math.hypot(w.a, w.b);
  const sy = Math.hypot(w.c, w.d);
  const frame: Affine = { a: w.a / sx, b: w.b / sx, c: w.c / sy, d: w.d / sy, tx: w.tx, ty: w.ty };
  const [lx, ly] = toLocal(frame, to[0], to[1]);
  const head = rig.bones.find((b) => b.name === 'head')!;
  const bs = pose.body ?? {};
  return mix(pose, {
    head: { x: round(lx / (bs.sx ?? 1) - head.x), y: round(ly / (bs.sy ?? 1) - head.y), rot: tilt },
  });
}

/**
 * Plants a leg: the ankle goes on rig point `to` (the leg stretches or shortens to reach) and the foot points
 * at world angle `toe` (degrees, 0 = flat forwards, 90 = straight down).
 */
export function leg(pose: Pose, side: 'B' | 'F', to: Pt, toe = 0): Pose {
  const w = world(pose);
  const hip = w[`leg${side}`]!;
  const vx = to[0] - hip.tx;
  const vy = to[1] - hip.ty;
  const along = Math.atan2(-vx, vy) * DEG;
  return mix(pose, {
    [`leg${side}`]: {
      rot: round(along - angle(w.body!)),
      sy: round(Math.max(0.2, Math.hypot(vx, vy) / LEG)),
    },
    [`foot${side}`]: { rot: round(toe - along) },
  });
}

/** Both feet planted on the ground at x positions `back` and `front`. */
export function feet(pose: Pose, back: number, front: number, toeB = 0, toeF = 0): Pose {
  return leg(leg(pose, 'B', [back, -0.19], toeB), 'F', [front, -0.19], toeF);
}

/**
 * Points a wing at world angle `to` (degrees: 0 forwards, 90 down, -90 up, 180 back) from its shoulder,
 * stretched along its length by `reach`.
 */
export function wing(pose: Pose, side: 'B' | 'F', to: number, reach = 1, thick = 1): Pose {
  const w = world(pose);
  return mix(pose, {
    [`wing${side}`]: { rot: round(to + 180 - angle(w.body!)), sx: round(reach), sy: thick },
  });
}

/**
 * Swings an open wing so rig point `to` lies `frac` of the way along it (where the wing is broad), stretching
 * the wing to reach and fattening it by `thick`.
 */
export function wingTo(pose: Pose, side: 'B' | 'F', to: Pt, frac = 0.6, thick = 1): Pose {
  const [sx, sy] = at(pose, `wing${side}`);
  const dx = to[0] - sx;
  const dy = to[1] - sy;
  return wing(pose, side, Math.atan2(dy, dx) * DEG, Math.max(1, Math.hypot(dx, dy) / (WING * frac)), thick);
}

/** Rig point of a bone's origin (or of a point in its space) in `pose`. */
export function at(pose: Pose, bone: string, x = 0, y = 0): [number, number] {
  const m = world(pose)[bone]!;
  return [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty];
}

/** An effect bone: its symbol centred on rig point (x, y), scaled by `s` and turned by `rot`. */
export function fx(x: number, y: number, s: number, rot = 0, sy = s): BonePose {
  return { x, y, rot, sx: s, sy };
}

/** Swap sets: faces, wings and feet. */
export const ANGRY = { face: 'faceAngry' };
export const PECK = { face: 'facePeck' };
export const SHOUT = { face: 'faceShout' };
export const HURT = { face: 'faceHurt' };
export const BLINK = { face: 'faceBlink' };
export const DIZZY = { face: 'faceDizzy' };
export const LOOK_UP = { face: 'faceUp' };
export const LOOK_DOWN = { face: 'faceDown' };
export const WINGS = { wingF: 'wingOpen', wingB: 'wingOpen' };
export const WING_F = { wingF: 'wingOpen' };
export const WEB = { footF: 'footWeb', footB: 'footWeb' };
export const WEB_F = { footF: 'footWeb' };
/** Duck Life's flight: the line wing flapping on the match clock. */
export const FLYING = { wingF: 'wingFlap' };

/** Standing, as Duck Life draws him: upright, one leg in front of the other so only one shows. */
export const STAND: Pose = feet({}, -0.55, -0.55);

/** The idle breath: belly swells a touch and the head settles. */
export const BREATHE: Pose = feet({ body: { sx: 1.02, sy: 0.975 }, head: { y: 0.1, rot: 2 } }, -0.55, -0.55);

/** Squatting: belly squashed wide, head sunk into it, feet planted a little apart. */
export const CROUCH: Pose = feet(
  { body: { sx: 1.14, sy: 0.8, y: 0.9 }, head: { y: 0.55, x: 0.25, rot: 4 } },
  -1.1,
  -0.1,
);

/** In the air: legs hanging straight down, feet pointing down and forwards (Duck Life's jump). */
export function air(extra: Pose = {}, toeB = 55, toeF = 40): Pose {
  const pose = mix({ body: { sy: 1.02 } }, extra);
  const [hbx, hby] = at(pose, 'legB');
  const [hfx, hfy] = at(pose, 'legF');
  return leg(leg(pose, 'B', [hbx - 0.35, hby + 1.45], toeB), 'F', [hfx + 0.15, hfy + 1.5], toeF);
}

/** Balled up for rolls and spins: legs folded flat under the belly, head pulled down. */
export function tucked(extra: Pose = {}): Pose {
  const pose = mix({ head: { y: 0.5, x: 0.2, rot: 10 } }, extra);
  const [hx, hy] = at(pose, 'legF');
  const [bx, by] = at(pose, 'legB');
  const down = angle(world(pose).body!);
  const r = (down * Math.PI) / 180;
  return leg(
    leg(
      pose,
      'B',
      [bx - 0.3 * Math.cos(r) - 0.6 * Math.sin(r), by + 0.6 * Math.cos(r) - 0.3 * Math.sin(r)],
      down,
    ),
    'F',
    [hx + 0.2 * Math.cos(r) - 0.6 * Math.sin(r), hy + 0.6 * Math.cos(r) + 0.2 * Math.sin(r)],
    down,
  );
}
