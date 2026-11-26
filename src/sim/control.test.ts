import { describe, expect, it } from 'vitest';
import { Btn, neutralInput, type InputFrame } from '../input/types';
import { FAST_FALL_FLICK, INPUT_BUFFER_FRAMES } from './constants';
import ref from './reference/physics-constants.json';
import {
  buffered,
  cStickDir,
  consume,
  consumeCStick,
  createControl,
  feedControl,
  flickDown,
  flickUp,
  flickX,
  justPressed,
  smashDir,
  stickDir,
  stickX,
} from './control';

const f = (p: Partial<InputFrame> = {}): InputFrame => ({ ...neutralInput(), ...p });

describe('control state', () => {
  it('detects press edges, not holds', () => {
    const c = createControl();
    feedControl(c, f({ buttons: Btn.Attack }));
    expect(justPressed(c, Btn.Attack)).toBe(true);
    feedControl(c, f({ buttons: Btn.Attack }));
    expect(justPressed(c, Btn.Attack)).toBe(false);
  });

  it("uses Ultimate's 9-frame buffer (SmashWiki: Buffer)", () => {
    expect(INPUT_BUFFER_FRAMES).toBe(ref.movement.buffer_window_frames);
  });

  it(`buffers a tapped button for ${INPUT_BUFFER_FRAMES} frames`, () => {
    const c = createControl();
    feedControl(c, f({ buttons: Btn.Jump }));
    for (let i = 1; i < INPUT_BUFFER_FRAMES; i++) {
      feedControl(c, f());
      expect(buffered(c, Btn.Jump)).toBe(true);
    }
    feedControl(c, f());
    expect(buffered(c, Btn.Jump)).toBe(false);
  });

  it('keeps a held press buffered (hold buffer) until consumed', () => {
    const c = createControl();
    for (let i = 0; i < 20; i++) feedControl(c, f({ buttons: Btn.Special }));
    expect(buffered(c, Btn.Special)).toBe(true);
    consume(c, Btn.Special);
    feedControl(c, f({ buttons: Btn.Special }));
    expect(buffered(c, Btn.Special)).toBe(false);
  });

  it('applies the stick dead zone', () => {
    const c = createControl();
    feedControl(c, f({ x: 15 }));
    expect(stickX(c)).toBe(0);
    feedControl(c, f({ x: 40 }));
    expect(stickX(c)).toBeCloseTo(0.4);
  });

  it('tells a flick (dash, tap jump, fast fall) from a slow tilt', () => {
    const fast = createControl();
    feedControl(fast, f());
    feedControl(fast, f({ x: -100, y: 100 }));
    expect(flickX(fast, 0.6)).toBe(-1);
    expect(flickUp(fast)).toBe(true);

    const slow = createControl();
    for (const v of [0, 35, 45, 55, 65, 75, 100]) feedControl(slow, f({ x: v, y: -v }));
    expect(flickX(slow, 0.6)).toBe(0);
    expect(flickDown(slow, FAST_FALL_FLICK)).toBe(false);
  });

  it('makes tap + attack a smash attack and hold-then-attack a tilt', () => {
    const tap = createControl();
    feedControl(tap, f());
    feedControl(tap, f({ x: 100 }));
    feedControl(tap, f({ x: 100, buttons: Btn.Attack }));
    expect(smashDir(tap, 1)).toBe('forward');
    expect(smashDir(tap, -1)).toBe('back');

    const hold = createControl();
    feedControl(hold, f());
    for (let i = 0; i < 8; i++) feedControl(hold, f({ y: -100 }));
    feedControl(hold, f({ y: -100, buttons: Btn.Attack }));
    expect(smashDir(hold, 1)).toBe('neutral');
    expect(stickDir(hold, 1)).toBe('down');
  });

  it('reads a C-stick flick as a buffered direction', () => {
    const c = createControl();
    feedControl(c, f());
    feedControl(c, f({ cy: 100 }));
    expect(cStickDir(c, 1)).toBe('up');
    for (let i = 0; i < INPUT_BUFFER_FRAMES; i++) feedControl(c, f({ cy: 100 }));
    expect(cStickDir(c, 1)).toBe('neutral');
  });

  it('registers an analog C-stick flick that passes through mid values, once per flick', () => {
    const c = createControl();
    for (const v of [0, 50, 100]) feedControl(c, f({ cx: v }));
    expect(cStickDir(c, 1)).toBe('forward');
    consumeCStick(c);
    feedControl(c, f({ cx: 100 }));
    expect(cStickDir(c, 1)).toBe('neutral');
    for (const v of [0, -100]) feedControl(c, f({ cx: v }));
    expect(cStickDir(c, 1)).toBe('back');
  });

  it('ignores a slow C-stick tilt', () => {
    const c = createControl();
    for (const v of [0, 35, 45, 55, 65, 75, 100]) feedControl(c, f({ cy: v }));
    expect(cStickDir(c, 1)).toBe('neutral');
  });

  it('never treats a stick held since the first frame as a flick', () => {
    const c = createControl();
    feedControl(c, f({ x: 100, cx: 100 }));
    expect(flickX(c, 0.6)).toBe(0);
    expect(cStickDir(c, 1)).toBe('neutral');
  });
});
