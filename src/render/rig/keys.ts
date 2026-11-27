import type { Pose } from './author';
import { poseBounds } from './geometry';
import { samplePose, worldTransforms, type RigPose } from './sample';
import type { AnimClip, FighterArt, Key, Rig } from './types';

/**
 * Key helpers for any rig, as Bob the Robber's `continuous` and `floorContact` (`bob-the-robber/art/poses.ts`) work
 * on his: tween each part the short way round, and bake a clip so nothing it draws dips below the floor.
 */

/** How `continuous` treats a rig's bones. */
export interface Continuity {
  /**
   * Keep each bone's angle on screen (its own turn plus its parents') nearest the last key's, instead of its own
   * turn. Short turns can add up along a limb: each part can turn the short way while the tip goes most of the way
   * round on screen.
   */
  onScreen?: boolean;
  /**
   * Bones whose whole turns are kept, such as a body that flips or rolls. Only their turn since the last key, taken
   * the short way, counts against the parts they carry, so a flip still spins and carries the rest with it.
   */
  keep?: string[];
}

/** Each bone in `keys` takes the whole turns that leave its angle nearest the last key's. */
export function continuous(rig: Rig, keys: Key[], { onScreen = false, keep = [] }: Continuity = {}): Key[] {
  const kept = new Set(keep);
  const last: Record<string, number> = {};
  const own: Record<string, number> = {};
  return keys.map((k) => {
    if (!k.pose) return k;
    const pose = { ...k.pose };
    const now: Record<string, number> = {};
    for (const { name, parent } of rig.bones) {
      const above = parent ? now[parent]! : 0;
      let r = pose[name]?.rot ?? 0;
      if (kept.has(name)) {
        const was = own[name];
        // Its turn since the last key, the short way; half a turn goes the way it was keyed.
        const delta = was === undefined ? 0 : r - was;
        let turn = delta - 360 * Math.round(delta / 360);
        if (Math.abs(turn) === 180) turn = 180 * Math.sign(delta);
        now[name] =
          was === undefined ? above + r : last[name]! + (above - (parent ? last[parent]! : 0)) + turn;
        own[name] = r;
        continue;
      }
      const was = last[name];
      if (was !== undefined) {
        const [from, to] = onScreen ? [was, above + r] : [was - (parent ? last[parent]! : 0), r];
        r += 360 * Math.round((from - to) / 360);
      }
      if (r !== 0 || pose[name]?.rot !== undefined) pose[name] = { ...pose[name], rot: r };
      now[name] = above + r;
    }
    Object.assign(last, now);
    return { ...k, pose };
  });
}

/** `pose` (offsets from the rest pose) as the sampler draws it, with `symbols` in its slots. */
function posed(rig: Rig, pose: Pose, symbols: Record<string, string | null>): RigPose {
  const local = Object.fromEntries(
    rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
      const p = pose[name] ?? {};
      return [
        name,
        {
          x: x + (p.x ?? 0),
          y: y + (p.y ?? 0),
          rot: rot + (p.rot ?? 0),
          sx: sx * (p.sx ?? 1),
          sy: sy * (p.sy ?? 1),
        },
      ];
    }),
  );
  return { local, world: worldTransforms(rig, local), symbols, z: {} };
}

/** How `floorContact` measures and moves a clip. */
export interface Contact {
  /** The bone moved up (or down) to rest the fighter on the floor; it should carry everything that is measured. */
  bone: string;
  /** Also lower frames where the fighter floats above the floor (default: only lift). */
  settle?: boolean;
  /** Slots left out of the measure, such as effects placed in rig space. */
  skip?: (slot: string, symbol: string) => boolean;
  /** Runs on each frame's pose before it is measured, given the symbol each slot draws: to re-plant a foot, say. */
  adjust?: (pose: Pose, symbols: Record<string, string | null>) => Pose;
}

/**
 * Bakes `clip` on whole frames, moving `bone` up on any frame where something drawn would be below the floor
 * (rig y 0), so tweens between keys can't put a foot through it. Keys keep their frames, swaps and draw order.
 */
export function floorContact(
  rig: Rig,
  clip: AnimClip,
  { bone, settle = false, skip, adjust }: Contact,
): AnimClip {
  const art: FighterArt = { rig, clips: { contact: clip }, palettes: { default: {} }, height: 0, icon: '' };
  const keys = new Map(clip.keys.map((k) => [k.frame, k]));
  return {
    ...clip,
    keys: Array.from({ length: clip.length + 1 }, (_, frame) => {
      const sampled = samplePose(art, 'contact', frame, frame);
      const drawn = rig.slots.filter((s) => {
        const symbol = sampled.symbols[s.name];
        return symbol && !skip?.(s.name, symbol);
      });
      let pose: Pose = Object.fromEntries(
        rig.bones.map(({ name, x, y, rot = 0, sx = 1, sy = 1 }) => {
          const p = sampled.local[name]!;
          return [name, { x: p.x - x, y: p.y - y, rot: p.rot - rot, sx: p.sx / sx, sy: p.sy / sy }];
        }),
      );
      if (adjust) pose = adjust(pose, sampled.symbols);
      const measured = adjust ? posed(rig, pose, sampled.symbols) : sampled;
      const bottom = poseBounds({ ...art, rig: { ...rig, slots: drawn } }, measured)[3];
      const dy = drawn.length ? (settle ? bottom : Math.max(0, bottom)) : 0;
      pose[bone] = { ...pose[bone], y: (pose[bone]?.y ?? 0) - dy };
      const { ease, swaps, z } = keys.get(frame) ?? {};
      const out: Key = { frame, pose, ease: ease === 'step' ? 'step' : 'linear' };
      if (swaps) out.swaps = swaps;
      if (z) out.z = z;
      return out;
    }),
  };
}
