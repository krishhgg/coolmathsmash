/** The controllers a player slot can be given: the two halves of the keyboard and up to four gamepads. */
export type DeviceId = 'kb1' | 'kb2' | 'pad1' | 'pad2' | 'pad3' | 'pad4';

export const DEVICES: readonly DeviceId[] = ['kb1', 'kb2', 'pad1', 'pad2', 'pad3', 'pad4'];

/** 0-based keyboard binding index for kb1/kb2, else -1. */
export function keyboardIndex(d: DeviceId): number {
  return d === 'kb1' ? 0 : d === 'kb2' ? 1 : -1;
}

/** 0-based browser gamepad slot for pad1-pad4, else -1. */
export function padIndex(d: DeviceId): number {
  return d.startsWith('pad') ? Number(d.slice(3)) - 1 : -1;
}

export function padDevice(slot: number): DeviceId {
  return `pad${slot + 1}` as DeviceId;
}

export function deviceLabel(d: DeviceId): string {
  return keyboardIndex(d) >= 0 ? `Keyboard ${keyboardIndex(d) + 1}` : `Gamepad ${padIndex(d) + 1}`;
}
