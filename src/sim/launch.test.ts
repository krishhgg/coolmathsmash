import { describe, expect, it } from 'vitest';
import { applyHit } from './combat/hits';
import { LAUNCH_DECAY, VERTICAL_LAUNCH_FALL_SPEED } from './combat/formulas';
import { TOP_KO_MARGIN, TOP_KO_MIN_SPEED } from './constants';
import type { FighterState } from './fighter';
import type { HitboxDef } from '../fighters/types';
import { marioReference as mario } from './testing/reference';
import { run, testMatch } from './testing/sim';

const up: HitboxDef = { id: 0, x: 0, y: 0, radius: 0, hitlag: 1, damage: 10, angle: 90, kbg: 100, bkb: 60 };

/** Launch the reference Mario at centre stage with `box` from `percent`; returns it on its first launch frame. */
function launched(box: HitboxDef, percent: number): { m: ReturnType<typeof testMatch>; v: FighterState } {
  const m = testMatch({ players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, { pos: { x: -10, y: 0 }, facing: 1, move: 'probe' });
  Object.assign(v, { pos: { x: 0, y: 0 }, facing: -1, damage: percent });
  applyHit(m, a, v, box);
  while (v.hitlag > 0 || v.launch) run(m, 1);
  return { m, v };
}

describe('vertical launches (DamageFlyTop)', () => {
  it("fall with the fighter's DamageFlyTop gravity, capped at 1.8, during hitstun, then ease back to its fall speed", () => {
    const { m, v } = launched(up, 60);
    expect(v.flyTop).toBe(true);
    const ys: { vy: number; stun: boolean }[] = [];
    while (v.ground === null && ys.length < 400) {
      run(m, 1);
      if (v.ground === null) ys.push({ vy: v.vel.y, stun: v.hitstun > 0 });
    }
    const stun = ys.filter((s) => s.stun).map((s) => s.vy);
    const after = ys.filter((s) => !s.stun).map((s) => s.vy);
    const steps = stun
      .slice(-30)
      .map((vy, i, a) => (i ? a[i - 1]! - vy : 0))
      .filter((d) => d > 0);
    for (const d of steps) expect(d).toBeCloseTo(mario.stats.damageFlyTopGravity, 6);
    expect(Math.min(...stun)).toBeCloseTo(-VERTICAL_LAUNCH_FALL_SPEED, 6);
    expect(after[1]! - after[0]!).toBeCloseTo(mario.stats.gravity, 6);
    expect(after.at(-1)).toBeCloseTo(-mario.stats.fallSpeed, 6);
  });

  it('a 38-degree launch keeps normal gravity', () => {
    const { v } = launched({ ...up, angle: 38 }, 60);
    expect(v.flyTop).toBe(false);
  });
});

describe('the top blast zone', () => {
  const at = (y: number, kbY: number) => {
    const m = testMatch();
    const f = m.fighters[0]!;
    Object.assign(f, { pos: { x: 0, y }, ground: null, action: 'tumble', actionFrame: 30, hitstun: 30 });
    Object.assign(f, { vel: { x: 0, y: 0 }, kb: { x: 0, y: kbY } });
    run(m, 1);
    return f.action;
  };
  const top = 192;

  it('KOs a fighter crossing it with a vertical launch speed of at least 2.4', () => {
    expect(at(top - 1, TOP_KO_MIN_SPEED + 0.2)).toBe('ko');
  });

  it('lets a slower fighter drift through and back down, unless it gets 30 past it', () => {
    expect(at(top - 1, 1.5)).not.toBe('ko');
    expect(at(top + TOP_KO_MARGIN - 0.5, 1.5)).toBe('ko');
    expect(at(top + TOP_KO_MARGIN - 3, 0)).not.toBe('ko');
  });

  it('decays the launch while it rises', () => {
    const m = testMatch();
    const f = m.fighters[0]!;
    Object.assign(f, {
      pos: { x: 0, y: 100 },
      ground: null,
      action: 'tumble',
      hitstun: 30,
      kb: { x: 0, y: 2 },
    });
    run(m, 1);
    expect(f.kb.y).toBeCloseTo(2 - LAUNCH_DECAY, 6);
  });
});
