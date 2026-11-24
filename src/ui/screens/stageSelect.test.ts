import { describe, expect, it } from 'vitest';
import { STOCK_CHOICES, TIME_CHOICES, type Rules } from '../../session/setup';
import { gridShape, ruleText, stepChoice, stepRule } from './stageSelect';

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
  it('gives a few stages big tiles and fills exact rectangles when it can', () => {
    expect(gridShape(1)).toEqual({ cols: 2, rows: 2 });
    expect(gridShape(2)).toEqual({ cols: 2, rows: 2 });
    expect(gridShape(5)).toEqual({ cols: 2, rows: 3 });
    expect(gridShape(9)).toEqual({ cols: 3, rows: 3 });
    expect(gridShape(12)).toEqual({ cols: 3, rows: 4 });
  });

  it('always fits every tile in cells between 4:3 and 2:1', () => {
    for (let n = 1; n <= 150; n++) {
      const { cols, rows } = gridShape(n);
      expect(cols * rows, `n=${n}`).toBeGreaterThanOrEqual(n);
      expect(rows).toBeGreaterThanOrEqual(cols);
      expect(rows).toBeLessThanOrEqual(cols * 1.6);
    }
  });
});
