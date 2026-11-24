import { describe, expect, it } from 'vitest';
import {
  CARD_H,
  CARD_SCALE,
  CARD_TOP,
  CARD_W,
  HIT_FRAMES,
  SCREEN_H,
  SCREEN_W,
  cardSlots,
  damageColor,
  formatDamage,
  hitEffect,
  portColor,
} from './style';

const luminance = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

describe('damage colour', () => {
  it('starts white and darkens towards red as damage rises', () => {
    expect(damageColor(0)).toBe(0xffffff);
    let prev = Infinity;
    for (let d = 0; d <= 300; d += 10) {
      const l = luminance(damageColor(d));
      expect(l).toBeLessThanOrEqual(prev + 1e-9);
      prev = l;
    }
    const red = damageColor(150);
    expect((red >> 16) & 255).toBeGreaterThan(200);
    expect((red >> 8) & 255).toBeLessThan(80);
    expect(damageColor(999)).toBe(damageColor(300));
  });
});

describe('formatDamage', () => {
  it('floors to a tenth like Ultimate', () => {
    expect(formatDamage(34.27)).toEqual({ whole: '34', tenth: '.2%' });
    expect(formatDamage(47.3)).toEqual({ whole: '47', tenth: '.3%' });
    expect(formatDamage(0)).toEqual({ whole: '0', tenth: '.0%' });
    expect(formatDamage(1234)).toEqual({ whole: '999', tenth: '.9%' });
  });
});

describe('hitEffect', () => {
  it('is at rest without a hit and after the window', () => {
    expect(hitEffect(100, -1, 0)).toMatchObject({ dx: 0, dy: 0, scale: 1, flash: 0, burst: -1 });
    expect(hitEffect(100 + HIT_FRAMES, 100, 0)).toMatchObject({ dx: 0, dy: 0, scale: 1, flash: 0 });
    expect(hitEffect(99, 100, 0).scale).toBe(1);
  });

  it('pops, flashes and shakes right after a hit, deterministically', () => {
    const a = hitEffect(103, 100, 2);
    expect(a.scale).toBeGreaterThan(1);
    expect(a.flash).toBeGreaterThan(0.5);
    expect(Math.hypot(a.dx, a.dy)).toBeGreaterThan(0.5);
    expect(hitEffect(103, 100, 2)).toEqual(a);
  });
});

describe('card layout', () => {
  it('keeps 1-4 cards on screen without overlap', () => {
    for (let n = 1; n <= 4; n++) {
      const slots = cardSlots(n);
      expect(slots).toHaveLength(n);
      const w = CARD_W * CARD_SCALE;
      expect(slots[0]! - w / 2).toBeGreaterThanOrEqual(0);
      expect(slots[n - 1]! + w / 2).toBeLessThanOrEqual(SCREEN_W);
      for (let i = 1; i < n; i++) expect(slots[i]! - slots[i - 1]!).toBeGreaterThanOrEqual(w);
    }
    expect(CARD_TOP + CARD_H * CARD_SCALE).toBeLessThanOrEqual(SCREEN_H);
    expect(CARD_H * CARD_SCALE).toBeLessThan(SCREEN_H * 0.19);
  });

  it('uses Smash port colours', () => {
    expect([0, 1, 2, 3].map(portColor)).toEqual([0xf2333a, 0x2f84ff, 0xffc21a, 0x2fbf45]);
  });
});
