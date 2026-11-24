import { describe, expect, it } from 'vitest';
import { KEYBOARD_BINDINGS } from './bindings';
import { KeyboardState } from './keyboard';
import { Btn } from './types';

const p1 = KEYBOARD_BINDINGS[0]!;
const p2 = KEYBOARD_BINDINGS[1]!;

describe('KeyboardState', () => {
  it('maps directions to a full-tilt stick and the walk modifier to half tilt', () => {
    const kb = new KeyboardState();
    kb.keyDown('KeyD');
    expect(kb.read(p1).x).toBe(100);
    kb.keyDown('ShiftLeft');
    expect(kb.read(p1).x).toBe(50);
  });

  it('gives opposite directions to the most recent key', () => {
    const kb = new KeyboardState();
    kb.keyDown('KeyA');
    kb.keyDown('KeyD');
    expect(kb.read(p1).x).toBe(100);
    kb.keyUp('KeyD');
    expect(kb.read(p1).x).toBe(-100);
  });

  it('keeps the two keyboard players independent', () => {
    const kb = new KeyboardState();
    kb.keyDown('KeyF');
    kb.keyDown('ArrowUp');
    kb.keyDown('KeyL');
    expect(kb.read(p1)).toEqual({ x: 0, y: 0, cx: 0, cy: 0, buttons: Btn.Attack });
    expect(kb.read(p2)).toEqual({ x: 0, y: 100, cx: 0, cy: 0, buttons: Btn.Jump });
  });
});
