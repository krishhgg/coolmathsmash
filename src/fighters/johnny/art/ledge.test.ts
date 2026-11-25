import { expect, it } from 'vitest';
import { samplePose } from '../../../render/rig/sample';
import { art } from '.';
import { GRIP_TARGETS } from './ledge';
import { HAND } from './rig';

it('holds the ledge corner with both fists until release', () => {
  for (const [clip, frames] of [
    ['ledgeCatch', [19]],
    ['ledgeHang', [0, 15, 30, 45, 59]],
    ['ledgeJump', [0, 2, 4]],
  ] as const) {
    for (const f of frames) {
      const { world } = samplePose(art, clip, f, f);
      for (const [bone, [x, y]] of [
        ['foreB', GRIP_TARGETS[0]],
        ['foreF', GRIP_TARGETS[1]],
      ] as const) {
        const m = world[bone]!;
        expect(Math.hypot(m.c * HAND + m.tx - x, m.d * HAND + m.ty - y), `${clip}@${f} ${bone}`).toBeLessThan(
          0.4,
        );
      }
    }
  }
});
