import type { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { testCharger } from '../sim/testing/charge';
import { run, testMatch } from '../sim/testing/sim';
import { drawChargeGlows } from './chargeGlow';

/** A stand-in for Pixi's Graphics that counts the circles drawn. */
function fakeGraphics() {
  const g = {
    circles: 0,
    clear: () => g,
    circle: () => {
      g.circles++;
      return g;
    },
    fill: () => g,
  };
  return g;
}

/** Circles the placeholder glow draws for `fighter` charging its side special (Special held for 40 frames). */
function glowWhileCharging(fighter: string): number {
  const m = testMatch({ fighter });
  run(m, 1, { x: 65, buttons: ['special'] });
  run(m, 40, { buttons: ['special'] });
  expect(m.fighters[0]!.charge).toBeGreaterThan(0);
  const g = fakeGraphics();
  drawChargeGlows(g as unknown as Graphics, m, 1);
  return g.circles;
}

describe('the placeholder charge glow', () => {
  it('glows behind a charging move without its own drawing', () => {
    expect(glowWhileCharging(testCharger.id)).toBeGreaterThan(0);
  });

  it("steps aside for a move whose art draws its charge (the Duck's Running Ram)", () => {
    expect(glowWhileCharging('duck')).toBe(0);
  });
});
