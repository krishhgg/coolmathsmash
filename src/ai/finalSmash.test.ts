import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import type { SimEvent } from '../sim/events';
import type { FighterState } from '../sim/fighter';
import { finalReach } from '../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { finalDirectTester, finalTrapTester, noFinalTester } from '../sim/testing/finalSmash';
import { createCpu } from './index';

/** A CPU (port 0) playing `fighter` against a standing opponent `gap` units to its right. */
function duel(fighter: string, gap: number): { m: MatchState; me: FighterState; opp: FighterState } {
  const m = createMatch({
    seed: 2,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: noFinalTester.id }],
  });
  const [me, opp] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [me, -gap / 2, 1],
    [opp, gap / 2, -1],
  ] as const)
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
  for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  return { m, me, opp };
}

/** Run the CPU for up to `frames` frames; the frame of its Final Smash and the gap to the opponent then, or null. */
function play(m: MatchState, frames: number, level = 9): { frame: number; ahead: number } | null {
  const cpu = createCpu({ port: 0, level, seed: 5 });
  const [me, opp] = m.fighters as [FighterState, FighterState];
  for (let i = 0; i < frames; i++) {
    const ahead = (opp.pos.x - me.pos.x) * me.facing;
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (m.events.some((e: SimEvent) => e.type === 'finalSmash' && e.port === 0)) return { frame: i, ahead };
  }
  return null;
}

describe('CPUs and the Final Smash', () => {
  for (const def of [finalDirectTester, finalTrapTester]) {
    it(`use it at once with an opponent in reach (${def.id})`, () => {
      const reach = finalReach(def.id)!;
      const { m, me } = duel(def.id, reach.ahead - 2);
      me.finalReady = true;
      const used = play(m, 30);
      expect(used).not.toBe(null);
      expect(used!.frame).toBeLessThan(15);
      expect(me.move).toBe('finalSmash');
    });
  }

  it('hold it while the opponent is out of reach, and use it once in reach', () => {
    const reach = finalReach(finalDirectTester.id)!;
    for (const level of [3, 9]) {
      const { m, me } = duel(finalDirectTester.id, 140);
      me.finalReady = true;
      const used = play(m, 600, level);
      expect(used).not.toBe(null);
      expect(used!.frame).toBeGreaterThan(10);
      expect(used!.ahead).toBeGreaterThan(-5);
      expect(used!.ahead).toBeLessThanOrEqual(reach.ahead + 3);
    }
  });

  it('never use one without the charge', () => {
    const { m } = duel(finalDirectTester.id, 30);
    expect(play(m, 600)).toBe(null);
  });
});
