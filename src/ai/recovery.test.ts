import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { stepMatch } from '../sim/match';
import { compiledStage } from '../sim/step';
import { createCpu } from './index';
import {
  canRecover,
  cpuRecovers,
  drill,
  registerWide150,
  spots,
  WIDE_150,
  type Spot,
} from './testing/recovery';

registerWide150();

const STAGES = ['battlefield', 'snail-bob-construction', WIDE_150.id];
const possible = new Map<string, boolean>();

/** Whether any drift, double jump and up special timing gets back from the spot (cached per stage and spot). */
function recoverable(stage: string, spot: Spot): boolean {
  const key = `${stage} ${spot.x} ${spot.y}`;
  let ok = possible.get(key);
  if (ok === undefined) {
    ok = canRecover(stage, spot);
    possible.set(key, ok);
  }
  return ok;
}

describe('CPU recovery from under and beside the stage', () => {
  it.each(STAGES.flatMap((stage) => [4, 7, 9].map((level) => [stage, level] as const)))(
    'on %s, a level %d CPU gets back from every spot it physically can',
    (stage, level) => {
      const all = spots(stage);
      const lost: string[] = [];
      let back = 0;
      for (const spot of all) {
        const r = cpuRecovers(stage, spot, level, 5);
        if (r === 'safe') back++;
        else if (recoverable(stage, spot)) lost.push(`${spot.where} (${spot.x}, ${spot.y}): ${r}`);
      }
      expect(lost).toEqual([]);
      expect(back / all.length).toBeGreaterThan(0.9);
    },
    60_000,
  );

  it.each(STAGES)('on %s, drifts out from 13 under the middle before the up special', (stage) => {
    const start = spots(stage).find((s) => s.where === 'under' && s.x === 0)!;
    const m = drill(stage, start.x, start.y);
    const f = m.fighters[0]!;
    const ledge = Math.max(...compiledStage(stage).geo.ledges.map((l) => Math.abs(l.x)));
    const cpu = createCpu({ port: 0, level: 7, seed: 5 });
    let upAt: number | null = null;
    for (let i = 0; i < 600 && f.ground === null && f.action !== 'ledgeHang' && f.stocks === 3; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (upAt === null && f.move === 'upB') upAt = f.pos.x;
    }
    expect(f.stocks).toBe(3);
    expect(upAt).not.toBeNull();
    expect(Math.abs(upAt!)).toBeGreaterThan(ledge / 2);
  });
});
