import { describe, expect, it } from 'vitest';
import { FRAME_MS, FixedLoop } from './loop';

function harness() {
  const log = { steps: 0, alphas: [] as number[] };
  const loop = new FixedLoop({ step: () => log.steps++, render: (a) => log.alphas.push(a) });
  return { loop, log };
}

describe('FixedLoop', () => {
  it('steps exactly once per 1/60 s regardless of display rate', () => {
    const { loop, log } = harness();
    loop.tick(0);
    for (let t = 1; t <= 145; t++) loop.tick((t * 1000) / 144);
    expect(log.steps).toBe(60);
  });

  it('reports the leftover fraction as the interpolation alpha', () => {
    const { loop, log } = harness();
    loop.tick(0);
    loop.tick(FRAME_MS * 2.5);
    expect(log.steps).toBe(2);
    expect(log.alphas.at(-1)).toBeCloseTo(0.5);
  });

  it('drops time instead of spiralling after a long stall', () => {
    const { loop, log } = harness();
    loop.tick(0);
    loop.tick(10_000);
    expect(log.steps).toBe(5);
    expect(log.alphas.at(-1)).toBe(0);
  });
});
