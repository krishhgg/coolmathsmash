import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { GRAB } from '../../../sim/constants';
import { art } from '.';
import { HAND } from './rig';

/** Clip lengths: loops play as long as the action lasts, the rest end on their last key. */
const LENGTHS: Record<string, number | 'loop'> = {
  shieldBreak: 40,
  dizzy: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  grabRelease: GRAB.releaseLag,
  respawn: 'loop',
};

describe("johnny's reactions", () => {
  it('has each clip, looping or as long as the action', () => {
    for (const [name, length] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (length === 'loop') expect(clip!.loop, name).toBe(true);
      else {
        expect(clip!.loop, name).toBeFalsy();
        expect(clip!.length, name).toBe(length);
        expect(clip!.keys[clip!.keys.length - 1]!.frame, name).toBe(length);
      }
    }
  });

  it('keeps his boots on the floor while dazed, grabbing, held, released and respawning', () => {
    for (const name of ['dizzy', 'grabHold', 'grabbed', 'grabRelease', 'respawn'])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const bottom = poseBounds(art, samplePose(art, name, f, f))[3];
        expect(bottom, `${name}@${f} sinks`).toBeLessThan(0.35);
        expect(bottom, `${name}@${f} floats`).toBeGreaterThan(-0.35);
      }
  });

  it('keeps his boots above the rig root through the shield break, which the sim plays in the air', () => {
    for (let f = 0; f <= art.clips.shieldBreak!.length; f++)
      expect(
        poseBounds(art, samplePose(art, 'shieldBreak', f, f))[3],
        `shieldBreak@${f}`,
      ).toBeLessThanOrEqual(0.4);
  });

  it('circles two stars above his quiff while dizzy', () => {
    for (let f = 0; f < art.clips.dizzy!.length; f++) {
      const pose = samplePose(art, 'dizzy', f, f);
      for (const fx of ['fx1', 'fx2']) {
        expect(pose.symbols[fx], `dizzy@${f} ${fx}`).toBe('impact');
        expect(pose.world.head!.ty - pose.world[fx]!.ty, `dizzy@${f} ${fx}`).toBeGreaterThan(5.5);
      }
    }
  });

  it('holds the grab in the pose the pummel and throws start from', () => {
    const hold = samplePose(art, 'grabHold', 0, 0).world;
    const pummel = samplePose(art, 'pummel', 0, 0).world;
    for (const bone of ['foreB', 'foreF']) {
      const [a, b] = [hold[bone]!, pummel[bone]!];
      expect(
        Math.hypot(a.c * HAND + a.tx - (b.c * HAND + b.tx), a.d * HAND + a.ty - (b.d * HAND + b.ty)),
        bone,
      ).toBeLessThan(0.05);
    }
  });
});
