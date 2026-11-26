import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { AIR_DODGE_NEUTRAL, ROLL_FORWARD, SPOT_DODGE } from '../../../sim/constants';
import { art } from '.';

/** Each dodge clip lasts its action's FAF - 1 frames, with its last key on that frame (docs/art.md). */
const LENGTHS: Record<string, number> = {
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
};

describe("johnny's dodges", () => {
  it('has a clip for each dodge, as long as the action', () => {
    for (const [name, length] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      expect(clip!.loop, name).toBeFalsy();
      expect(clip!.length, name).toBe(length);
      expect(clip!.keys[clip!.keys.length - 1]!.frame, name).toBe(length);
    }
  });

  it('keeps him on the floor through the spot dodge and forward roll, never sinking or lifting off', () => {
    for (const name of ['spotDodge', 'rollForward'])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const bottom = poseBounds(art, samplePose(art, name, f, f))[3];
        expect(bottom, `${name}@${f} sinks`).toBeLessThan(0.35);
        expect(bottom, `${name}@${f} floats`).toBeGreaterThan(-0.35);
      }
  });

  it('keeps his boots above the rig root through the air dodge', () => {
    for (let f = 0; f <= art.clips.airDodge!.length; f++)
      expect(poseBounds(art, samplePose(art, 'airDodge', f, f))[3], `airDodge@${f}`).toBeLessThanOrEqual(0.4);
  });

  it('ends the forward roll turned round, as the sim turns him when it ends, and the spot dodge facing ahead', () => {
    const facing = (name: string) => {
      const f = art.clips[name]!.length;
      return Math.sign(samplePose(art, name, f, f).world.body!.a);
    };
    expect(facing('rollForward')).toBe(-1);
    expect(facing('spotDodge')).toBe(1);
  });
});
