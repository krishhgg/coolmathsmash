import { describe, expect, it } from 'vitest';
import type { MoveDef } from '../../fighters/types';
import { moveClipFrame, retimeClip } from './timing';
import type { AnimClip } from './types';

const clip = (length: number, active?: [number, number][]): AnimClip => ({ length, keys: [], active });
const move = (faf: number, ...windows: [number, number][]): MoveDef => ({
  kind: 'other',
  faf,
  hits: windows.map((frames) => ({ frames, boxes: [] })),
});

describe('moveClipFrame', () => {
  it('plays frame for frame when the clip was keyed on the move frame data', () => {
    for (let f = 0; f <= 27; f++) expect(moveClipFrame(clip(27, [[6, 8]]), f, move(28, [6, 8]))).toBe(f);
  });

  it('lands the authored active window on the hit window and the clip end on the FAF', () => {
    const c = clip(16, [[3, 4]]);
    const m = move(19, [5, 6]);
    expect(moveClipFrame(c, 0, m)).toBe(0);
    expect(moveClipFrame(c, 5, m)).toBe(3);
    expect(moveClipFrame(c, 6, m)).toBe(4);
    expect(moveClipFrame(c, 18, m)).toBe(16);
    expect(moveClipFrame(c, 40, m)).toBe(16);
    expect(moveClipFrame(c, 12, m)).toBeCloseTo(4 + (6 * 12) / 12);
  });

  it('maps window by window, or first start and last end when the counts differ', () => {
    const two = clip(45, [
      [5, 7],
      [11, 13],
    ]);
    const m = move(49, [5, 6], [14, 15]);
    expect(moveClipFrame(two, 14, m)).toBe(11);
    expect(moveClipFrame(two, 15, m)).toBe(13);
    const one = clip(43, [[13, 17]]);
    const multi = move(37, [5, 6], [8, 9], [17, 18]);
    expect(moveClipFrame(one, 5, multi)).toBe(13);
    expect(moveClipFrame(one, 18, multi)).toBe(17);
    expect(moveClipFrame(one, 36, multi)).toBe(43);
  });

  it('only stretches to the FAF when the clip has no windows or there is no move', () => {
    expect(moveClipFrame(clip(30), 15, move(31))).toBe(15);
    expect(moveClipFrame(clip(60), 15, move(31))).toBe(30);
    expect(moveClipFrame(clip(60), 15, undefined)).toBe(15);
  });

  it("lines a throw's or pummel's impact frame up with the clip's active window", () => {
    const c = clip(29, [[11, 13]]);
    const fthrow: MoveDef = {
      kind: 'other',
      faf: 30,
      hits: [],
      throw: { frame: 18, hit: { damage: 8, angle: 45, kbg: 55, bkb: 45 } },
    };
    expect(moveClipFrame(c, 9, fthrow)).toBeCloseTo(5.5);
    expect(moveClipFrame(c, 18, fthrow)).toBe(11);
    expect(moveClipFrame(c, 19, fthrow)).toBeGreaterThanOrEqual(13);
    expect(moveClipFrame(c, 29, fthrow)).toBe(29);
    const pummel: MoveDef = { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3 } };
    expect(moveClipFrame(clip(17, [[2, 4]]), 1, pummel)).toBe(2);
  });
});

describe('retimeClip', () => {
  const keyed = (length: number, ...frames: number[]): AnimClip => ({
    length,
    keys: frames.map((frame) => ({ frame })),
  });

  it('scales every key onto the new length', () => {
    const out = retimeClip({ ...keyed(30, 0, 10, 15, 30), active: [[10, 15]] }, 35);
    expect(out.length).toBe(35);
    expect(out.keys.map((k) => k.frame)).toEqual([0, 12, 18, 35]);
    expect(out.active).toEqual([[12, 18]]);
  });

  it('keeps keys on their knots and stretches each span between them', () => {
    const out = retimeClip(keyed(40, 0, 4, 16, 30, 33, 40), 35, [
      [4, 4],
      [30, 28],
    ]);
    expect(out.keys.map((k) => k.frame)).toEqual([0, 4, 15, 28, 30, 35]);
  });

  it('refuses to merge two keys onto one frame', () => {
    expect(() => retimeClip(keyed(10, 0, 2, 3, 10), 4)).toThrow(/land on/);
  });
});
