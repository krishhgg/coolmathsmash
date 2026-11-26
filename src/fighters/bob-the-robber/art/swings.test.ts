import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose, type RigPose } from '../../../render/rig/sample';
import { art } from '.';

/** Swings checked frame by frame. Bob's other grounded clips still dip into the floor, so they join once fixed. */
const SWINGS = ['fsmash'];

/** How far a drawn part may reach below the floor (rig y 0), as in Fireboy's rolls and Runner's getup attack. */
const SINK = 0.2;

/**
 * The most a drawn part may turn from one frame to the next, in degrees. The forward smash's fastest real frame
 * turns the baton and back arm 56 degrees into the hit. A tween that goes the long way round from one key's angle
 * to the next peaked at 109 to 252 degrees a frame in it before the fix, and past 180 the eye reads a turn as
 * going backwards.
 */
const TURN = 60;

/** Where the baton's tip sits along its bone (as `tipOf` in poses.ts). */
const TIP = 7.5;

const parents = Object.fromEntries(art.rig.bones.map((b) => [b.name, b.parent]));

/** A bone's rotation in rig space, unwrapped (its own turn plus its parents'), so a full spin counts 360. */
function turn(pose: RigPose, bone: string): number {
  let deg = 0;
  for (let b: string | undefined = bone; b; b = parents[b]) deg += pose.local[b]!.rot;
  return deg;
}

/** Bones that carry a drawing in `pose`. */
const drawn = (pose: RigPose) =>
  new Set(art.rig.slots.filter((s) => pose.symbols[s.name] !== null).map((s) => s.bone));

describe("bob's baton swings", () => {
  it('keeps every drawn part, the baton tip included, above the floor on every frame', () => {
    const sunk: string[] = [];
    for (const name of SWINGS)
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const pose = samplePose(art, name, f, f);
        const bottom = poseBounds(art, pose)[3];
        const m = pose.world.baton!;
        const tip = m.b * TIP + m.ty;
        if (bottom > SINK || tip > SINK)
          sunk.push(`${name}@${f} ${bottom.toFixed(2)}${tip > SINK ? ` (tip ${tip.toFixed(2)})` : ''}`);
      }
    expect(sunk).toEqual([]);
  });

  it(`turns no drawn part more than ${TURN} degrees between frames`, () => {
    const spun: string[] = [];
    for (const name of SWINGS) {
      let prev = samplePose(art, name, 0, 0);
      for (let f = 1; f <= art.clips[name]!.length; f++) {
        const pose = samplePose(art, name, f, f);
        const before = drawn(prev);
        for (const bone of drawn(pose)) {
          const deg = turn(pose, bone) - turn(prev, bone);
          if (before.has(bone) && Math.abs(deg) > TURN) spun.push(`${name}@${f} ${bone} ${deg.toFixed(0)}`);
        }
        prev = pose;
      }
    }
    expect(spun).toEqual([]);
  });
});
