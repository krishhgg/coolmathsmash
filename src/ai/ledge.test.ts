import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import { getStage } from '../stages/registry';
import { runCpuMatch } from './bench';
import { createCpu } from './index';

/**
 * `fighter` catches Battlefield's ledge `side` with a Fireboy standing 20 units in, close enough that a level 9 CPU
 * taking over then mixes up its getup. Returns the getup it took and how the stock ended: back on the stage, or KO'd.
 */
function fromLedge(fighter: string, side: 0 | 1, seed: number): { option: string; end: string } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: 'fireboy' }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const L = getStage('battlefield').ledges[side]!;
  const f = m.fighters[0]!;
  const at = { x: L.x + L.side * 3, y: L.y - 6 };
  Object.assign(f, {
    pos: at,
    prevPos: { ...at },
    ground: null,
    action: 'fall',
    actionFrame: 1,
    jumpsUsed: 1,
  });
  f.facing = -L.side as 1 | -1;
  const o = m.fighters[1]!;
  o.pos.x = L.x - L.side * 20;
  o.prevPos = { ...o.pos };
  while (f.action === 'fall') stepMatch(m, [neutralInput(), neutralInput()]);
  expect(f.action).toBe('ledgeCatch');
  const cpu = createCpu({ port: 0, level: 9, seed });
  let option = '';
  for (let i = 0; i < 600; i++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (!option && !f.action.startsWith('ledge')) option = 'drop';
    if (!option && f.action !== 'ledgeCatch' && f.action !== 'ledgeHang') {
      option = f.action.replace(/^ledge/, '').toLowerCase();
    }
    if (f.stocks < 3) return { option, end: 'ko' };
    if (f.ground !== null) return { option, end: 'stage' };
  }
  return { option, end: f.action };
}

function getups(fighter: string): { picked: Record<string, number>; lost: string[] } {
  const picked: Record<string, number> = {};
  const lost: string[] = [];
  for (const side of [0, 1] as const) {
    for (let seed = 1; seed <= 40; seed++) {
      const r = fromLedge(fighter, side, seed);
      picked[r.option] = (picked[r.option] ?? 0) + 1;
      if (r.end !== 'stage') lost.push(`ledge ${side}, seed ${seed}: ${r.option} ended ${r.end}`);
    }
  }
  return { picked, lost };
}

describe('CPU ledge getups', () => {
  // Bloxorz's block hangs 20 units under the ledge, so its drop and double jump hits the stage's corner, and the
  // up special that follows rises into the stage's underside. On main 10 of these 80 getups were drops, and all 10
  // KO'd it.
  it('a level 9 Bloxorz block gets back to the stage from either Battlefield ledge with every getup it picks', () => {
    const { picked, lost } = getups('bloxorz');
    expect(lost).toEqual([]);
    expect(picked.drop ?? 0).toBe(0);
    for (const getup of ['climb', 'jump', 'roll', 'attack']) expect(picked[getup], getup).toBeGreaterThan(0);
  }, 60_000);

  it.each(['fireboy', 'runner', 'redball'])(
    'a level 9 %s still drops and double jumps back',
    (fighter) => {
      const { picked, lost } = getups(fighter);
      expect(lost).toEqual([]);
      expect(picked.drop).toBeGreaterThan(5);
    },
    60_000,
  );

  // Level 9 against level 9 on Battlefield (src/ai/bench.ts). On main, Bloxorz self-destructs on the frame given: it
  // drops from the ledge 190 frames before.
  it.each([
    [8, ['bloxorz', 'redball'], 854],
    [12, ['bloxorz', 'bob-the-robber'], 1208],
    [19, ['johnny', 'bloxorz'], 1194],
    [6, ['bloxorz', 'johnny'], 1449],
  ] as const)(
    'a level 9 Bloxorz block does not self-destruct in bench match seed %d, %j',
    (seed, fighters, ko) => {
      const r = runCpuMatch({ seed, levels: [9, 9], fighters: [...fighters], maxFrames: ko + 60 });
      expect(r.kos.filter((k) => k.selfDestruct)).toEqual([]);
    },
    60_000,
  );
});
