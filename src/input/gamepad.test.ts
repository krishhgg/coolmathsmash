import { describe, expect, it } from 'vitest';
import { padSlots, readGamepad, type PadLike } from './gamepad';
import { Btn } from './types';

function pad(axes: number[], pressed: number[] = [], analog: Record<number, number> = {}): PadLike {
  return {
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: analog[i] ?? (pressed.includes(i) ? 1 : 0),
    })),
  };
}

describe('readGamepad', () => {
  it('flips the y axis so up is positive and maps the right stick to the C-stick', () => {
    expect(readGamepad(pad([0.5, -1, -1, 0.2]))).toMatchObject({ x: 50, y: 100, cx: -100, cy: -20 });
  });

  it('maps face buttons, bumpers and analog triggers', () => {
    const r = readGamepad(pad([0, 0, 0, 0], [0, 3, 5], { 7: 0.6 }));
    expect(r.buttons).toBe(Btn.Attack | Btn.Jump | Btn.Grab | Btn.Shield);
  });
});

describe('padSlots', () => {
  it('keeps browser slot indices when an earlier pad disconnects', () => {
    const second = { ...pad([1, 0, 0, 0]), connected: true, mapping: 'standard' };
    const nonStandard = { ...pad([0, 0, 0, 0]), connected: true, mapping: '' };
    Object.defineProperty(globalThis, 'navigator', {
      value: { getGamepads: () => [null, second, nonStandard] },
      configurable: true,
    });
    const slots = padSlots();
    expect(slots[0]).toBeNull();
    expect(slots[1]).toBe(second);
    expect(slots[2]).toBeNull();
  });
});
