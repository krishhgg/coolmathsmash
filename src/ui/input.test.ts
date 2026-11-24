import { describe, expect, it } from 'vitest';
import { KEYBOARD_BINDINGS } from '../input/bindings';
import type { PadLike } from '../input/gamepad';
import { MenuInput, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from './input';

const menu = () => new MenuInput(() => KEYBOARD_BINDINGS);

const pad = (pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadLike => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    value: pressed.includes(i) ? 1 : 0,
  })),
});

describe('MenuInput', () => {
  it('maps each keyboard half through its fight bindings', () => {
    const m = menu();
    m.keyDown('KeyW', 0);
    m.keyDown('KeyF', 0);
    m.keyDown('ArrowLeft', 0);
    m.keyDown('KeyK', 0);
    m.keyDown('KeyR', 0);
    expect(m.poll(0)).toEqual([
      { device: 'kb1', action: 'up' },
      { device: 'kb1', action: 'confirm' },
      { device: 'kb2', action: 'left' },
      { device: 'kb2', action: 'back' },
      { device: 'kb1', action: 'prev' },
    ]);
  });

  it('has keyboard-wide menu keys for keys no binding uses', () => {
    const m = menu();
    for (const code of ['Space', 'Backspace', 'Enter', 'Escape']) m.keyDown(code, 0);
    expect(m.poll(0)).toEqual([
      { device: 'keys', action: 'confirm' },
      { device: 'keys', action: 'back' },
      { device: 'keys', action: 'start' },
      { device: 'keys', action: 'back' },
    ]);
  });

  it('repeats a held direction after a delay, and stops on release', () => {
    const m = menu();
    m.keyDown('KeyD', 0);
    expect(m.poll(0)).toHaveLength(1);
    expect(m.poll(REPEAT_DELAY_MS - 1)).toHaveLength(0);
    expect(m.poll(REPEAT_DELAY_MS)).toEqual([{ device: 'kb1', action: 'right' }]);
    expect(m.poll(REPEAT_DELAY_MS + REPEAT_EVERY_MS - 1)).toHaveLength(0);
    expect(m.poll(REPEAT_DELAY_MS + REPEAT_EVERY_MS)).toHaveLength(1);
    m.keyUp('KeyD');
    expect(m.poll(5000)).toHaveLength(0);
  });

  it('never repeats buttons', () => {
    const m = menu();
    m.keyDown('KeyF', 0);
    m.keyDown('KeyF', 10);
    expect(m.poll(0)).toHaveLength(1);
    expect(m.poll(5000)).toHaveLength(0);
  });

  it('reads gamepad buttons and the stick per slot, on press edges', () => {
    const m = menu();
    expect(m.poll(0, [null, pad([0, 9])])).toEqual([
      { device: 'pad2', action: 'confirm' },
      { device: 'pad2', action: 'start' },
    ]);
    expect(m.poll(16, [null, pad([0, 9])])).toEqual([]);
    expect(m.poll(32, [pad([], [0, 0.9, 0, 0])])).toEqual([{ device: 'pad1', action: 'down' }]);
    expect(m.poll(32 + REPEAT_DELAY_MS, [pad([], [0, 0.9, 0, 0])])).toEqual([
      { device: 'pad1', action: 'down' },
    ]);
    expect(m.poll(2000, [pad()])).toEqual([]);
  });
});
