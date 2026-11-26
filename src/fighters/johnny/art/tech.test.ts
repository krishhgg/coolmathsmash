import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { GETUP_ROLL, GETUP_STAND, TECH_IN_PLACE, TECH_ROLL } from '../../../sim/constants';
import { art } from '.';

/** Each tech and getup clip lasts its action's FAF - 1 frames, with its last key on that frame (docs/art.md). */
const LENGTHS: Record<string, number> = {
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
};

describe("johnny's techs and getups", () => {
  it('has a clip for each tech and getup, as long as the action, and a lying loop', () => {
    for (const [name, length] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      expect(clip!.loop, name).toBeFalsy();
      expect(clip!.length, name).toBe(length);
      expect(clip!.keys[clip!.keys.length - 1]!.frame, name).toBe(length);
    }
    expect(art.clips.down?.loop).toBe(true);
  });

  it('keeps him on the floor lying down and through every tech and getup, never sinking or lifting off', () => {
    for (const name of ['down', ...Object.keys(LENGTHS)])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const bottom = poseBounds(art, samplePose(art, name, f, f))[3];
        expect(bottom, `${name}@${f} sinks`).toBeLessThan(0.35);
        expect(bottom, `${name}@${f} floats`).toBeGreaterThan(-0.35);
      }
  });

  it('lies flat while down and stands facing ahead when each tech and getup ends', () => {
    expect(poseBounds(art, samplePose(art, 'down', 0, 0))[1]).toBeGreaterThan(-10);
    for (const name of Object.keys(LENGTHS)) {
      const f = art.clips[name]!.length;
      const pose = samplePose(art, name, f, f);
      expect(Math.sign(pose.world.body!.a), name).toBe(1);
      expect(poseBounds(art, pose)[1], name).toBeLessThan(-16);
    }
  });
});
