import { describe, expect, it } from 'vitest';
import { STOCK_CHOICES, TIME_CHOICES, type Rules } from '../../session/setup';
import { GRID_BOX, gridShape, ruleText, stepChoice, stepRule } from './stageSelect';

const rules = (r: Partial<Rules> = {}): Rules => ({ stocks: 3, minutes: 7, items: false, ...r });

describe('stage select rules', () => {
  it('steps through choices both ways and wraps round', () => {
    expect(stepChoice([1, 2, 3], 2, 1)).toBe(3);
    expect(stepChoice([1, 2, 3], 3, 1)).toBe(1);
    expect(stepChoice([1, 2, 3], 1, -1)).toBe(3);
    expect(stepChoice([1, 2, 3], 7, 1)).toBe(1);
  });

  it('changes stocks, time and items in place', () => {
    const r = rules();
    stepRule(r, 'stocks', 1);
    expect(r.stocks).toBe(4);
    r.stocks = STOCK_CHOICES.at(-1)!;
    stepRule(r, 'stocks', 1);
    expect(r.stocks).toBe(STOCK_CHOICES[0]);
    stepRule(r, 'minutes', -1);
    expect(r.minutes).toBe(6);
    r.minutes = TIME_CHOICES[0]!;
    stepRule(r, 'minutes', -1);
    expect(r.minutes).toBe(TIME_CHOICES.at(-1));
    stepRule(r, 'items', 1);
    expect(r.items).toBe(true);
    stepRule(r, 'items', -1);
    expect(r.items).toBe(false);
  });

  it('labels values the way the rows show them', () => {
    expect(ruleText(rules(), 'stocks')).toBe('3');
    expect(ruleText(rules({ stocks: 99 }), 'stocks')).toBe('Infinite');
    expect(ruleText(rules(), 'minutes')).toBe('7:00');
    expect(ruleText(rules({ minutes: 0 }), 'minutes')).toBe('No Limit');
    expect(ruleText(rules({ items: true }), 'items')).toBe('On');
  });
});

describe('stage grid shape', () => {
  it('puts a few choices side by side at full size', () => {
    expect(gridShape(1)).toEqual({ cols: 1, rows: 1, tile: GRID_BOX.maxTile });
    expect(gridShape(2)).toEqual({ cols: 2, rows: 1, tile: GRID_BOX.maxTile });
    expect(gridShape(4)).toEqual({ cols: 2, rows: 2, tile: GRID_BOX.maxTile });
  });

  it('fits any number of choices in the box with no empty row', () => {
    const { width, height, pad, gap, maxTile } = GRID_BOX;
    for (let n = 1; n <= 150; n++) {
      const { cols, rows, tile } = gridShape(n);
      expect(cols * rows, `n=${n}`).toBeGreaterThanOrEqual(n);
      expect((rows - 1) * cols, `n=${n}`).toBeLessThan(n);
      expect(tile, `n=${n}`).toBeGreaterThan(0);
      expect(tile).toBeLessThanOrEqual(maxTile);
      expect(cols * tile + (cols - 1) * gap + 2 * pad).toBeLessThanOrEqual(width);
      expect((rows * tile * 9) / 16 + (rows - 1) * gap + 2 * pad).toBeLessThanOrEqual(height);
    }
  });
});
