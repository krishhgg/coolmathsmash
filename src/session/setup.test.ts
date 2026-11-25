import { beforeAll, describe, expect, it } from 'vitest';
import { getFighter, registerFighter } from '../fighters/registry';
import { fighterCostumes } from './roster';
import { RANDOM, cpuSlot, cycleCostume, defaultSetup, humanSlot, isReady, pickFighter } from './setup';

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
});
