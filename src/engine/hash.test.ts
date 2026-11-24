import { describe, expect, it } from 'vitest';
import { hashState } from './hash';

describe('hashState', () => {
  it('ignores key order but not values', () => {
    expect(hashState({ a: 1, b: [1, 2] })).toBe(hashState({ b: [1, 2], a: 1 }));
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 1.0000001 }));
    expect(hashState([1, 2])).not.toBe(hashState([2, 1]));
  });
});
