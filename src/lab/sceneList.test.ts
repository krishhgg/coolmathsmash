import { describe, expect, it } from 'vitest';
import { SCENES } from './sceneList';

describe('lab scene list', () => {
  it('lists the scene files and no test files', () => {
    const names = Object.keys(SCENES);
    expect(names.filter((name) => name.endsWith('.test'))).toEqual([]);
    expect(names).toContain('stage');
  });
});
