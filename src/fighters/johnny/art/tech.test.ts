import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { GETUP_ROLL, GETUP_STAND, ROLL_BACK, TECH_IN_PLACE, TECH_ROLL } from '../../../sim/constants';
import { art } from '.';

/**
 * Each tech and getup clip, the back roll and the back tech and getup rolls (drawn rolling away from his facing)
 * last their action's FAF - 1 frames, with the last key on that frame (docs/art.md).
 */
const LENGTHS: Record<string, number> = {
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  techRollBack: TECH_ROLL.faf - 1,
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  getupRollBack: GETUP_ROLL.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
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

  it('somersaults forward in the tech and getup rolls and backward in their back rolls', () => {
    const turned = (name: string, f: number) => samplePose(art, name, f, f).local.body!.rot;
    for (const [name, mid, dir] of [
      ['techRoll', 14, 1],
      ['getupRoll', 13, 1],
      ['rollBack', 12, -1],
      ['techRollBack', 17, -1],
      ['getupRollBack', 13, -1],
    ] as const)
      expect(Math.sign(turned(name, mid) - turned(name, 4)), name).toBe(dir);
  });
});
