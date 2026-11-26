import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import { moves } from '../moves';
import { POUND } from '../shellPound';
import { art } from '.';

const CLIPS = ['downB', 'downBAir', 'downBLand'] as const;

describe('snail bob art: Shell Pound', () => {
  it("keys each clip to its move: FAF - 1 frames long, with the move's hit windows as its active windows", () => {
    for (const name of CLIPS) {
      const clip = art.clips[name]!;
      expect(clip.length, name).toBe(moves[name]!.faf - 1);
      expect(clip.active, name).toEqual(moves[name]!.hits.map((w) => w.frames));
    }
  });

  it('keeps the shell on the floor until the hop and all through the landing', () => {
    const off: string[] = [];
    for (const [name, last] of [
      ['downB', POUND.hop - 1],
      ['downBLand', art.clips.downBLand!.length],
    ] as const)
      for (let f = 0; f <= last; f++)
        for (const g of [0, 1, 2, 3]) {
          const bottom = poseBounds(art, samplePose(art, name, f, f + g))[3];
          if (Math.abs(bottom) > 0.3) off.push(`${name}@${f}: ${bottom.toFixed(2)}`);
        }
    expect(off).toEqual([]);
  });

  it('draws the drop on the late frame the sim holds, however long he falls', () => {
    for (const [name, late] of [
      ['downB', POUND.late],
      ['downBAir', POUND.lateAir],
    ] as const) {
      const frame = moveClipFrame(art.clips[name]!, late, moves[name]);
      expect(frame, name).toBe(art.clips[name]!.length);
      for (const g of [late, late + 30, late + 300]) {
        const { symbols } = samplePose(art, name, frame, g);
        expect([symbols.fx1, symbols.head], `${name}@${g}`).toEqual(['fallLines', null]);
      }
    }
  });

  it('sits dizzy in the shell through the landing lag and stands on its last frame', () => {
    const clip = art.clips.downBLand!;
    expect(samplePose(art, 'downBLand', 1, 1).symbols.smearBack).toBe('shockwave');
    const stunned = samplePose(art, 'downBLand', 20, 20).symbols;
    expect([stunned.fx1, stunned.lip, stunned.head]).toEqual(['stars', 'lipPeek', null]);
    const up = samplePose(art, 'downBLand', clip.length, clip.length).symbols;
    expect([up.fx1, up.head]).toEqual([null, 'head']);
  });
});
