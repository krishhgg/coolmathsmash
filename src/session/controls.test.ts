import { describe, expect, it } from 'vitest';
import { GAMEPAD_BUTTONS, KEYBOARD_BINDINGS } from '../input/bindings';
import {
  bindButton,
  bindKey,
  boundKeys,
  keyLabel,
  menuKeyConflict,
  padButtonLabel,
  padButtonLabels,
  padMenuConflict,
  padMenusUsable,
  pausePrompts,
  resetKeyboard,
} from './controls';

describe('key labels', () => {
  it('names keys the way players read them', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ShiftLeft')).toBe('L-Shift');
    expect(keyLabel('ControlRight')).toBe('R-Ctrl');
    expect(keyLabel('Numpad1')).toBe('Num 1');
    expect(keyLabel('NumpadEnter')).toBe('Num Enter');
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel('Semicolon')).toBe(';');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('F5')).toBe('F5');
  });

  it('names standard gamepad buttons and folds the D-pad', () => {
    expect([0, 1, 2, 3, 4, 7, 9].map(padButtonLabel)).toEqual(['A', 'B', 'X', 'Y', 'L', 'ZR', 'Start']);
    expect(padButtonLabel(14)).toBe('D-pad ←');
    expect(padButtonLabel(23)).toBe('Button 23');
    expect(padButtonLabels(GAMEPAD_BUTTONS.taunt)).toEqual(['D-pad']);
    expect(padButtonLabels([9, 12, 13, 14, 15])).toEqual(['Start', 'D-pad']);
    expect(padButtonLabels([12, 13])).toEqual(['D-pad ↑', 'D-pad ↓']);
  });
});

describe('rebinding', () => {
  it('replaces the list with the one new key', () => {
    const kb = structuredClone(KEYBOARD_BINDINGS);
    expect(bindKey(kb, 1, 'attack', 'KeyM')).toEqual([]);
    expect(kb[1]!.buttons.attack).toEqual(['KeyM']);
    expect(bindKey(kb, 0, 'walk', 'KeyQ')).toEqual([]);
    expect(kb[0]!.walk).toEqual(['KeyQ']);
  });

  it('takes a key off the action that had it', () => {
    const kb = structuredClone(KEYBOARD_BINDINGS);
    expect(bindKey(kb, 0, 'attack', 'KeyW')).toEqual([{ keyboard: 0, action: 'up' }]);
    expect(kb[0]!.buttons.attack).toEqual(['KeyW']);
    expect(boundKeys(kb[0]!, 'up')).toEqual([]);
    expect(kb[0]!.buttons.special).toEqual(['KeyG']);
  });

  it('takes a key off the other keyboard half too, keeping its other keys', () => {
    const kb = structuredClone(KEYBOARD_BINDINGS);
    expect(bindKey(kb, 0, 'jump', 'KeyJ')).toEqual([{ keyboard: 1, action: 'attack' }]);
    expect(kb[1]!.buttons.attack).toEqual(['Numpad1']);
    expect(kb[0]!.buttons.jump).toEqual(['KeyJ']);
  });

  it('keeps menu keys on the one action that means the same in menus', () => {
    expect(menuKeyConflict('Enter', 'attack')).toBe('start');
    expect(menuKeyConflict('NumpadEnter', 'jump')).toBe('start');
    expect(menuKeyConflict('Backspace', 'special')).toBe('start');
    expect(menuKeyConflict('Space', 'jump')).toBe('attack');
    expect(menuKeyConflict('Enter', 'start')).toBeNull();
    expect(menuKeyConflict('Space', 'attack')).toBeNull();
    expect(menuKeyConflict('KeyQ', 'attack')).toBeNull();
  });

  it('rebinding a key to the action that has it keeps it', () => {
    const kb = structuredClone(KEYBOARD_BINDINGS);
    expect(bindKey(kb, 1, 'walk', 'Numpad0')).toEqual([]);
    expect(kb[1]!.walk).toEqual(['Numpad0']);
  });

  it('resets one half and takes its default keys back from the other', () => {
    const kb = structuredClone(KEYBOARD_BINDINGS);
    bindKey(kb, 1, 'attack', 'KeyF');
    bindKey(kb, 1, 'special', 'KeyM');
    expect(kb[0]!.buttons.attack).toEqual([]);
    resetKeyboard(kb, 0);
    expect(kb[0]).toEqual(KEYBOARD_BINDINGS[0]);
    expect(kb[1]!.buttons.attack).toEqual([]);
    expect(kb[1]!.buttons.special).toEqual(['KeyM']);
    resetKeyboard(kb, 1);
    expect(kb).toEqual(KEYBOARD_BINDINGS);
  });

  it('moves a gamepad button between actions', () => {
    const pad = structuredClone(GAMEPAD_BUTTONS);
    expect(bindButton(pad, 'attack', 3)).toEqual(['jump']);
    expect(pad.attack).toEqual([3]);
    expect(pad.jump).toEqual([2]);
    expect(bindButton(pad, 'shield', 13)).toEqual(['taunt']);
    expect(pad.taunt).toEqual([12, 14, 15]);
    expect(pad.shield).toEqual([13]);
    expect(bindButton(pad, 'start', 9)).toEqual([]);
  });

  it('keeps A off Pause, since A selects Restart and Quit in the pause menu', () => {
    const pad = structuredClone(GAMEPAD_BUTTONS);
    expect(padMenuConflict(pad, 'start', 0)).toBe('confirm');
    expect(padMenuConflict(pad, 'start', 1)).toBeNull();
    expect(padMenuConflict(pad, 'start', 3)).toBeNull();
    expect(padMenuConflict(pad, 'start', 9)).toBeNull();
    // Off Pause, A and B take any fight action: outside a match the pad's menu buttons ignore the bindings.
    expect(padMenuConflict(pad, 'jump', 0)).toBeNull();
    expect(padMenuConflict(pad, 'shield', 1)).toBeNull();
  });

  it('never takes the last button off Pause', () => {
    const pad = structuredClone(GAMEPAD_BUTTONS);
    expect(padMenuConflict(pad, 'attack', 9)).toBe('pause');
    expect(padMenuConflict(pad, 'taunt', 9)).toBe('pause');
    expect(padMenuConflict(pad, 'attack', 8)).toBeNull();
    bindButton(pad, 'start', 3);
    expect(padMenuConflict(pad, 'jump', 3)).toBe('pause');
    expect(padMenuConflict(pad, 'attack', 9)).toBeNull();
    pad.start = [3, 9];
    expect(padMenuConflict(pad, 'attack', 9)).toBeNull();
    pad.start = [];
    expect(padMenuConflict(pad, 'attack', 9)).toBeNull();
  });

  it('tells which pad mappings leave the pause menu usable', () => {
    const pad = structuredClone(GAMEPAD_BUTTONS);
    expect(padMenusUsable(pad)).toBe(true);
    expect(padMenusUsable({ ...pad, start: [1] })).toBe(true);
    expect(padMenusUsable({ ...pad, start: [0] })).toBe(false);
    expect(padMenusUsable({ ...pad, start: [9, 0] })).toBe(false);
    expect(padMenusUsable({ ...pad, start: [] })).toBe(false);
  });
});

describe('pause prompts', () => {
  const keyboard = () => structuredClone(KEYBOARD_BINDINGS[0]!);
  const pad = () => structuredClone(GAMEPAD_BUTTONS);

  it('shows the default keys, and the pad buttons only when a pad is given', () => {
    expect(pausePrompts(keyboard(), null)).toEqual({ select: 'F', resume: 'Esc' });
    expect(pausePrompts(keyboard(), pad())).toEqual({ select: 'F · A', resume: 'Esc · Start' });
  });

  it('follows Keyboard 1 and the gamepad after a rebind', () => {
    const keyboards = structuredClone(KEYBOARD_BINDINGS);
    bindKey(keyboards, 0, 'attack', 'KeyQ');
    bindKey(keyboards, 0, 'start', 'KeyP');
    const buttons = pad();
    bindButton(buttons, 'start', 3);
    expect(pausePrompts(keyboards[0], buttons)).toEqual({ select: 'Q · A', resume: 'P · Y' });
  });

  it('keeps A on Select when the pad moves Attack off it', () => {
    const buttons = pad();
    bindButton(buttons, 'attack', 2);
    expect(pausePrompts(keyboard(), buttons).select).toBe('F · A');
  });

  it('falls back to the menu keys when Keyboard 1 has nothing bound', () => {
    const keyboards = structuredClone(KEYBOARD_BINDINGS);
    bindKey(keyboards, 1, 'attack', 'KeyF');
    bindKey(keyboards, 1, 'taunt', 'Escape');
    expect(pausePrompts(keyboards[0], null)).toEqual({ select: 'Space', resume: 'Esc' });
    expect(pausePrompts(undefined, { ...pad(), start: [] })).toEqual({
      select: 'Space · A',
      resume: 'Esc · B',
    });
  });
});
