import { BUTTON_NAMES, buttonBit, neutralInput, type ButtonName, type InputFrame } from '../input/types';

/**
 * Scripted input for tests, capture scenarios and the harness API: each step holds an input on one port for
 * frames [from, to). Later steps override earlier ones on the frames they share. JSON-friendly on purpose.
 */
export interface ScriptStep {
  port: number;
  from: number;
  /** Exclusive; defaults to from + 1 (a one-frame tap). */
  to?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  buttons?: ButtonName[];
}

export function scriptLength(steps: readonly ScriptStep[]): number {
  return steps.reduce((m, s) => Math.max(m, s.to ?? s.from + 1), 0);
}

export function inputsAt(steps: readonly ScriptStep[], frame: number, ports: number): InputFrame[] {
  const out = Array.from({ length: ports }, neutralInput);
  for (const s of steps) {
    if (frame < s.from || frame >= (s.to ?? s.from + 1)) continue;
    const i = out[s.port];
    if (!i) continue;
    if (s.x !== undefined) i.x = s.x;
    if (s.y !== undefined) i.y = s.y;
    if (s.cx !== undefined) i.cx = s.cx;
    if (s.cy !== undefined) i.cy = s.cy;
    if (s.buttons) for (const b of s.buttons) i.buttons |= buttonBit(b);
  }
  return out;
}

export function isButtonName(v: string): v is ButtonName {
  return (BUTTON_NAMES as string[]).includes(v);
}
