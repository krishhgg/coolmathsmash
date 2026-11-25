import { beforeAll, describe, expect, it } from 'vitest';
import { getFighter, registerFighter } from '../fighters/registry';
import { fighterCostumes } from './roster';
import {
  MAX_PLAYERS,
  RANDOM,
  cpuSlot,
  cycleCostume,
  defaultSetup,
  humanSlot,
  humansFirst,
  isReady,
  joinHuman,
  pickFighter,
  resolveMatch,
} from './setup';

const palette = { line: '#000000', body: '#ff0000' };

beforeAll(() => {
  registerFighter({
    ...getFighter('fireboy'),
    id: 'test-alts',
    name: 'Alts',
    art: { palettes: { default: palette, blue: palette, green: palette } },
  });
});

describe('match setup', () => {
  it('starts as P1 on Keyboard 1 against a CPU, not ready until P1 picks', () => {
    const s = defaultSetup();
    expect(s.slots).toEqual([humanSlot('kb1'), cpuSlot()]);
    expect(s.slots[1]!.fighter).toBe(RANDOM);
    expect(isReady(s)).toBe(false);
    pickFighter(s, 0, 'fireboy');
    expect(isReady(s)).toBe(true);
    s.slots.pop();
    expect(isReady(s)).toBe(false);
  });

  it('lists costumes with default first', () => {
    expect(fighterCostumes('test-alts')).toEqual(['default', 'blue', 'green']);
    expect(fighterCostumes('fireboy')[0]).toBe('default');
  });

  it('gives a mirror match different costumes and skips worn ones when cycling', () => {
    const s = defaultSetup();
    s.slots.push(cpuSlot());
    pickFighter(s, 0, 'test-alts');
    pickFighter(s, 1, 'test-alts');
    pickFighter(s, 2, 'test-alts');
    expect(s.slots.map((x) => x.costume)).toEqual(['default', 'blue', 'green']);
    cycleCostume(s, 0, 1);
    expect(s.slots[0]!.costume).toBe('default');
    s.slots[2]!.fighter = 'fireboy';
    cycleCostume(s, 0, 1);
    expect(s.slots[0]!.costume).toBe('green');
    cycleCostume(s, 0, -1);
    expect(s.slots[0]!.costume).toBe('default');
  });

  it('keeps a slot on its costume when it re-picks the same fighter', () => {
    const s = defaultSetup();
    pickFighter(s, 0, 'test-alts');
    cycleCostume(s, 0, 1);
    pickFighter(s, 0, 'test-alts');
    expect(s.slots[0]!.costume).toBe('blue');
    pickFighter(s, 0, RANDOM);
    expect(s.slots[0]!.costume).toBe('default');
  });

  it('seats a joining human as P2, ahead of the CPU, and the match ports follow', () => {
    const s = defaultSetup();
    s.slots[1] = { ...cpuSlot(7), fighter: 'fireboy' };
    expect(joinHuman(s, 'kb2')).toEqual([0, -1, 1]);
    expect(s.slots).toEqual([humanSlot('kb1'), humanSlot('kb2'), { ...cpuSlot(7), fighter: 'fireboy' }]);
    pickFighter(s, 0, 'fireboy');
    pickFighter(s, 1, 'fireboy');
    expect(resolveMatch(s, 1).controllers).toEqual([
      { kind: 'human', device: 'kb1' },
      { kind: 'human', device: 'kb2' },
      { kind: 'cpu', level: 7 },
    ]);
  });

  it('makes room in a full line-up by dropping the last CPU; the others keep their settings', () => {
    const s = defaultSetup();
    s.slots = [humanSlot('kb1'), cpuSlot(5), cpuSlot(7), cpuSlot(9)];
    expect(joinHuman(s, 'pad1')).toEqual([0, -1, 1, 2]);
    expect(s.slots).toEqual([humanSlot('kb1'), humanSlot('pad1'), cpuSlot(5), cpuSlot(7)]);
    s.slots = (['kb1', 'kb2', 'pad1', 'pad2'] as const).map(humanSlot);
    expect(s.slots).toHaveLength(MAX_PLAYERS);
    const before = structuredClone(s.slots);
    expect(joinHuman(s, 'pad3')).toBeNull();
    expect(s.slots).toEqual(before);
  });

  it('moves humans ahead of CPUs, keeping each group in order', () => {
    const s = defaultSetup();
    s.slots = [cpuSlot(2), humanSlot('pad1'), cpuSlot(8), humanSlot('kb1')];
    expect(humansFirst(s)).toEqual([1, 3, 0, 2]);
    expect(s.slots).toEqual([humanSlot('pad1'), humanSlot('kb1'), cpuSlot(2), cpuSlot(8)]);
    expect(humansFirst(s)).toEqual([0, 1, 2, 3]);
  });
});
