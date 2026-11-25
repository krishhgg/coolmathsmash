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
});
