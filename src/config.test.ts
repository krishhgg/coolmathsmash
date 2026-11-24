import { describe, expect, it } from 'vitest';
import { SIM_HZ, VIEW_HEIGHT, VIEW_WIDTH } from './config';

describe('config', () => {
  it('runs the simulation at 60 Hz on a 16:9 view', () => {
    expect(SIM_HZ).toBe(60);
    expect(VIEW_WIDTH / VIEW_HEIGHT).toBeCloseTo(16 / 9);
  });
});
