import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { runCpuMatch } from './bench';
import { createCpu } from './index';
import { stageInfo, walkStopsAtGap } from './stage';

/**
 * Run Tunnel's floor is three solids with 16-unit gaps between them (x -48 to -32 and 32 to 48), and both fighters
 * spawn on the outer two, so a CPU that won't cross a gap never meets its opponent.
 */
function tunnel(fighters: string[], xs: number[]): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'run-tunnel',
    stocks: 3,
    ports: fighters.map((fighter) => ({ fighter })),
  });
  m.fighters.forEach((f, i) =>
    Object.assign(f, { pos: { x: xs[i]!, y: 0 }, prevPos: { x: xs[i]!, y: 0 }, facing: 1 }),
  );
  return m;
}

describe('CPUs on Run Tunnel', () => {
  it('tell a gap in the floor from the stage end and from open floor', () => {
    const info = stageInfo(tunnel(['fireboy'], [-64]));
    expect(walkStopsAtGap(info, 'fireboy', -64, 0, 0)).toBe(true);
    expect(walkStopsAtGap(info, 'fireboy', 0, 0, 64)).toBe(true);
    expect(walkStopsAtGap(info, 'fireboy', -64, 0, -80)).toBe(false);
    expect(walkStopsAtGap(info, 'fireboy', -20, 0, 20)).toBe(false);
  });

  // The CPU stands at the left gap's edge, where its walk stops, with the opponent standing still on the middle floor.
  it.each(['fireboy', 'runner', 'redball', 'wheely', 'bob-the-robber', 'johnny'])(
    '%s hops the gap to reach an opponent across it and lands on the far side',
    (fighter) => {
      const m = tunnel([fighter, 'fireboy'], [-53, 10]);
      const cpu = createCpu({ port: 0, level: 9, seed: 1 });
      const me = m.fighters[0]!;
      let crossed = false;
      for (let t = 0; t < 240 && !crossed; t++) {
        stepMatch(m, [cpu.input(m), neutralInput()]);
        expect(me.action).not.toBe('ko');
        crossed = me.ground?.kind === 'solid' && me.pos.x > -32;
      }
      expect(crossed).toBe(true);
      expect(me.stocks).toBe(3);
    },
    60_000,
  );

  // On main both CPUs walked to the gap nearest them and stood there for the whole 8 minutes.
  it.each([1, 2, 3, 4])(
    'level 9 against level 9 lands a KO within 40 s (seed %i)',
    (seed) => {
      const r = runCpuMatch({ seed, levels: [9, 9], stage: 'run-tunnel', maxFrames: 40 * 60 });
      expect(r.kos.length).toBeGreaterThan(0);
      expect(r.kos.filter((k) => k.selfDestruct)).toEqual([]);
    },
    60_000,
  );
});
