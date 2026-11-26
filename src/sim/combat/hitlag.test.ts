import { describe, expect, it } from 'vitest';
import { getFighter } from '../../fighters/registry';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { attack, run, testMatch } from '../testing/sim';
import { hitlagFrames } from './formulas';

/**
 * Ultimate's hitlag (SmashWiki, Hitlag; docs/physics-reference.md section 5): a hit that connects on frame N freezes
 * the attacker and the victim for the next `hitlag` frames, N+1 to N+hitlag, and both act again on N+hitlag+1. They
 * are frozen for the whole of each of those frames: they don't move, aren't pushed apart, and land no hitbox.
 */

/** The probe's 12% with a fresh move's x1.05: floor(12.6 x 0.65 + 6) = 14 frames. */
const LAG = hitlagFrames(12 * 1.05);

/** Stand `f` on Battlefield's main stage at `x`, facing `facing`. */
function stand(f: FighterState, x: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, vel: { x: 0, y: 0 }, facing });
}

/** Port 0 throws the probe at port 1 standing 4 units in front, so close that their bodies overlap. */
function pointBlank(players: number): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ players });
  const [a, v] = m.fighters as [FighterState, FighterState];
  expect([a.action, v.action, a.ground, v.ground]).toEqual([
    'idle',
    'idle',
    expect.anything(),
    expect.anything(),
  ]);
  stand(a, -4, 1);
  stand(v, 0, -1);
  attack(m, 0, 'probe');
  return { m, a, v };
}

const hits = (m: MatchState) => m.events.filter((e) => e.type === 'hit');

/** Widths overlap: pushApart would shove two grounded fighters this close apart on any frame they act. */
function overlapping(a: FighterState, b: FighterState): boolean {
  const reach = (getFighter(a.fighter).stats.width + getFighter(b.fighter).stats.width) / 2;
  return Math.abs(a.pos.x - b.pos.x) < reach;
}

describe('hitlag', () => {
  it('freezes attacker and victim on every hitlag frame: no movement, no push apart, no hit, then both resume', () => {
    expect(LAG).toBe(14);
    const { m, a, v } = pointBlank(2);
    run(m, 1);
    expect(hits(m)).toMatchObject([{ attacker: 0, victim: 1, hitlag: LAG }]);
    expect([a.hitlag, v.hitlag]).toEqual([LAG, LAG]);
    const attackFrame = a.actionFrame;

    for (let frame = 1; frame <= LAG; frame++) {
      const before = { a: { ...a.pos }, v: { ...v.pos } };
      expect(overlapping(a, v)).toBe(true);
      run(m, 1);
      expect({ frame, a: a.pos, v: v.pos }).toEqual({ frame, ...before });
      expect({ frame, hits: hits(m) }).toEqual({ frame, hits: [] });
      expect({ frame, actionFrame: a.actionFrame }).toEqual({ frame, actionFrame: attackFrame });
      expect({ frame, hitlag: [a.hitlag, v.hitlag] }).toEqual({ frame, hitlag: [LAG - frame, LAG - frame] });
      expect(v.launch).not.toBeNull();
    }

    // Frame N+hitlag+1: both act again, the attacker's move advances and the victim launches.
    const frozen = { ...v.pos };
    run(m, 1);
    expect(a.actionFrame).toBe(attackFrame + 1);
    expect(v.launch).toBeNull();
    expect(v.pos).not.toEqual(frozen);
  });

  it("keeps the attacker's still-active hitbox out on every hitlag frame, and lands it on the first frame after", () => {
    const { m, a, v } = pointBlank(3);
    const t = m.fighters[2]!;
    // A bystander inside the probe's box, intangible for the hit frame and the two after it.
    stand(t, 4, -1);
    t.intangible = 3;
    run(m, 1);
    expect(hits(m)).toMatchObject([{ attacker: 0, victim: 1, hitlag: LAG }]);

    const landed: number[] = [];
    for (let frame = 1; frame <= LAG + 1; frame++) {
      run(m, 1);
      if (hits(m).some((e) => e.attacker === 0 && e.victim === 2)) landed.push(frame);
    }
    expect(t.intangible).toBe(0);
    expect(landed).toEqual([LAG + 1]);
    expect(a.hitVictims).toEqual([1, 2]);
    expect(v.launch).toBeNull();
  });
});
