import { describe, expect, it } from 'vitest';
import type { StageGeometry } from '../../sim/stage';
import { STAGES } from '../../stages/registry';
import { stageFrame, stageSvg } from './stageArt';

const battlefield = STAGES.battlefield!;

describe('stage thumbnails', () => {
  it('frame every solid and platform inside the camera box', () => {
    for (const stage of Object.values(STAGES)) {
      const f = stageFrame(stage);
      const cam = stage.camera;
      expect(f.left).toBeGreaterThanOrEqual(cam.left);
      expect(f.right).toBeLessThanOrEqual(cam.right);
      expect(f.top).toBeLessThanOrEqual(cam.top);
      expect(f.bottom).toBeGreaterThanOrEqual(cam.bottom);
      for (const [x, y] of stage.solids.flatMap((s) => s.points)) {
        expect(x).toBeGreaterThan(f.left);
        expect(x).toBeLessThan(f.right);
        expect(y).toBeGreaterThan(f.bottom);
        expect(y).toBeLessThan(f.top);
      }
      for (const p of stage.platforms) {
        expect(p.x1).toBeGreaterThan(f.left);
        expect(p.x2).toBeLessThan(f.right);
        expect(p.y).toBeLessThan(f.top);
      }
    }
  });

  it('draw the frame as the viewBox, one body per solid and one slab per platform', () => {
    const f = stageFrame(battlefield);
    const markup = stageSvg(battlefield);
    const box = markup
      .match(/viewBox="([^"]+)"/)![1]!
      .split(' ')
      .map(Number);
    [f.left, -f.top, f.right - f.left, f.top - f.bottom].forEach((v, i) => expect(box[i]).toBeCloseTo(v, 1));
    expect(markup.match(/<clipPath /g)).toHaveLength(battlefield.solids.length);
    expect(markup.match(/fill="url\(#st\d+p\)"/g)).toHaveLength(battlefield.platforms.length);
  });

  it('look the same every time for one stage and differ between stages', () => {
    const plain = (s: StageGeometry) => stageSvg(s).replace(/st\d+/g, 'st');
    expect(plain(battlefield)).toBe(plain(battlefield));
    expect(plain({ ...battlefield, id: 'other' })).not.toBe(plain(battlefield));
  });

  it('fall back to the camera box for an empty stage', () => {
    const empty = { ...battlefield, solids: [], platforms: [] };
    expect(stageFrame(empty)).toEqual(battlefield.camera);
  });
});
