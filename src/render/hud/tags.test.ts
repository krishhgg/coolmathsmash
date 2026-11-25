import { describe, expect, it } from 'vitest';
import { SCREEN_H, SCREEN_W } from './style';
import { placeTag, POINTER, TAG_H, tagLabel, tagWidth } from './tags';

const W = tagWidth('P1');

describe('overhead tags', () => {
  it('labels humans by port and CPUs as CPU', () => {
    expect(tagLabel(0, false)).toBe('P1');
    expect(tagLabel(3, false)).toBe('P4');
    expect(tagLabel(1, true)).toBe('CPU');
    expect(tagWidth('CPU')).toBeGreaterThan(W);
  });

  it('sits above the head with the pointer down while on screen', () => {
    expect(placeTag(640, 400, W)).toEqual({ x: 640, y: 400 - POINTER - TAG_H / 2, side: 'down' });
  });

  it('clamps to the edge an offscreen fighter left by and points at them', () => {
    const above = placeTag(300, -200, W);
    expect(above.side).toBe('up');
    expect(above.y - TAG_H / 2 - POINTER).toBeGreaterThanOrEqual(0);
    expect(above.x).toBe(300);

    const left = placeTag(-150, 360, W);
    expect(left.side).toBe('left');
    expect(left.x - W / 2 - POINTER).toBeGreaterThanOrEqual(0);

    const right = placeTag(SCREEN_W + 150, 360, W);
    expect(right.side).toBe('right');
    expect(right.x + W / 2 + POINTER).toBeLessThanOrEqual(SCREEN_W);

    const below = placeTag(640, SCREEN_H + 300, W);
    expect(below.side).toBe('down');
    expect(below.y + TAG_H / 2 + POINTER).toBeLessThanOrEqual(SCREEN_H);
  });

  it('a corner keeps the whole tag on screen', () => {
    const t = placeTag(-400, -400, W);
    expect(t.x - W / 2).toBeGreaterThanOrEqual(0);
    expect(t.y - TAG_H / 2).toBeGreaterThanOrEqual(0);
  });
});
