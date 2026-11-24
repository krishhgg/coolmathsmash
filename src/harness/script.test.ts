import { describe, expect, it } from 'vitest';
import { Btn } from '../input/types';
import { inputsAt, scriptLength, type ScriptStep } from './script';

describe('input scripts', () => {
  const steps: ScriptStep[] = [
    { port: 0, from: 0, to: 30, x: 100 },
    { port: 0, from: 10, buttons: ['jump'] },
    { port: 1, from: 5, to: 8, y: -100, buttons: ['shield', 'attack'] },
  ];

  it('expands holds and taps per frame and port', () => {
    expect(inputsAt(steps, 10, 2)[0]).toEqual({ x: 100, y: 0, cx: 0, cy: 0, buttons: Btn.Jump });
    expect(inputsAt(steps, 11, 2)[0]!.buttons).toBe(0);
    expect(inputsAt(steps, 7, 2)[1]).toEqual({
      x: 0,
      y: -100,
      cx: 0,
      cy: 0,
      buttons: Btn.Shield | Btn.Attack,
    });
    expect(inputsAt(steps, 8, 2)[1]!.y).toBe(0);
  });

  it('knows its length', () => {
    expect(scriptLength(steps)).toBe(30);
  });
});
