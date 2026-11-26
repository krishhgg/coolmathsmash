import { describe, expect, it } from 'vitest';
import { poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { LEDGE_ATTACK, LEDGE_CLIMB, LEDGE_ROLL } from '../../../sim/constants';
import { stats } from '../stats';
import { art } from '.';
import { GRIP_TARGETS } from './ledge';
import { HAND } from './rig';

describe("johnny's ledge clips", () => {
  it('holds the ledge corner with both fists until release', () => {
    for (const [clip, frames] of [
      ['ledgeCatch', [8]],
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
          expect(
            Math.hypot(m.c * HAND + m.tx - x, m.d * HAND + m.ty - y),
            `${clip}@${f} ${bone}`,
          ).toBeLessThan(0.4);
        }
      }
    }
  });

  it('has each ledge getup as long as the action, with its last key on the last frame', () => {
    for (const [name, faf] of [
      ['ledgeClimb', LEDGE_CLIMB.faf],
      ['ledgeRoll', LEDGE_ROLL.faf],
      ['ledgeAttack', LEDGE_ATTACK.faf],
    ] as const) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      expect(clip!.length, name).toBe(faf - 1);
      expect(clip!.keys[clip!.keys.length - 1]!.frame, name).toBe(faf - 1);
    }
  });

  /**
   * The corner in rig space through each getup, from his size and the engine's getup paths (src/sim/movement.ts
   * hangPos, src/sim/actions/ledge.ts). He may scrape the lip by about a unit, no more, and finishes standing on
   * the floor. A getup is drawn from its frame 1 (setAction), so frame 0, the hang, is left out.
   */
  it('climbs where the engine puts the ledge corner for his size', () => {
    const smooth = (u: number) => u * u * (3 - 2 * u);
    const [hx, hy] = [stats.width / 2 + 0.5, -stats.height * 0.85];
    expect(art.ledgeGrip).toEqual([hx, hy]);
    const getup = (moveEnd: number, dist: number) => (f: number) => {
      const u = smooth(Math.min(1, f / moveEnd));
      return [hx - (hx + dist) * u, hy * (1 - Math.min(1, 1.6 * u))] as const;
    };
    const clips: [string, number, (f: number) => readonly [number, number]][] = [
      ['ledgeClimb', LEDGE_CLIMB.moveEnd, getup(LEDGE_CLIMB.moveEnd, stats.width / 2 + 2)],
      ['ledgeAttack', LEDGE_ATTACK.moveEnd, getup(LEDGE_ATTACK.moveEnd, stats.width / 2 + 2)],
      ['ledgeRoll', LEDGE_ROLL.moveEnd, getup(LEDGE_ROLL.moveEnd, LEDGE_ROLL.distance)],
    ];
    const inside: string[] = [];
    const floating: string[] = [];
    for (const [name, end, corner] of clips) {
      for (let f = 1; f <= end; f += 1) {
        const [cx, cy] = corner(f);
        const pose = samplePose(art, name, f, f);
        const block: [number, number][] = [];
        for (let d = 0; d < 10; d += 1)
          block.push([cx + 1.2 + d, cy + 1.2], [cx + 1.2 + d, cy + 3], [cx + 1.2, cy + 1.2 + d]);
        if (block.some(([x, y]) => slotsCovering(art, pose, x, y).length)) inside.push(`${name}@${f}`);
      }
      const bottom = poseBounds(art, samplePose(art, name, end, end))[3];
      if (Math.abs(bottom - corner(end)[1]) > 0.3) floating.push(`${name} ${bottom.toFixed(2)}`);
    }
    expect(inside).toEqual([]);
    expect(floating).toEqual([]);
  });

  it('stands on the floor from the end of each getup to the last frame', () => {
    for (const [name, moveEnd] of [
      ['ledgeClimb', LEDGE_CLIMB.moveEnd],
      ['ledgeRoll', LEDGE_ROLL.moveEnd],
      ['ledgeAttack', LEDGE_ATTACK.moveEnd],
    ] as const)
      for (let f = moveEnd; f <= art.clips[name]!.length; f++) {
        const bottom = poseBounds(art, samplePose(art, name, f, f))[3];
        expect(bottom, `${name}@${f} sinks`).toBeLessThan(0.35);
        expect(bottom, `${name}@${f} floats`).toBeGreaterThan(-0.35);
      }
  });
});
