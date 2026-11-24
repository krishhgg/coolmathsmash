/**
 * One player's controller state for one simulation frame. Sticks are integers in [-100, 100] with +y up, so
 * input logs (replays, harness scripts) are exact and the simulation stays deterministic.
 */
export interface InputFrame {
  x: number;
  y: number;
  /** Right stick / C-stick: smash attacks on the ground, aerials in the air. */
  cx: number;
  cy: number;
  buttons: number;
}

export const Btn = {
  Attack: 1,
  Special: 2,
  Jump: 4,
  Shield: 8,
  Grab: 16,
  Taunt: 32,
  Start: 64,
} as const;
export type ButtonName = Uncapitalize<keyof typeof Btn>;
export const BUTTON_NAMES = Object.keys(Btn).map((k) => k[0]!.toLowerCase() + k.slice(1)) as ButtonName[];

export function buttonBit(name: ButtonName): number {
  return Btn[(name[0]!.toUpperCase() + name.slice(1)) as keyof typeof Btn];
}

export const NEUTRAL_INPUT: Readonly<InputFrame> = Object.freeze({ x: 0, y: 0, cx: 0, cy: 0, buttons: 0 });

export function neutralInput(): InputFrame {
  return { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 };
}

export function quantizeAxis(v: number): number {
  const q = Math.round(v * 100);
  return q > 100 ? 100 : q < -100 ? -100 : q === 0 ? 0 : q;
}

export function mergeInputs(a: InputFrame, b: InputFrame): InputFrame {
  const pick = (p: number, q: number) => (Math.abs(p) >= Math.abs(q) ? p : q);
  return {
    x: pick(a.x, b.x),
    y: pick(a.y, b.y),
    cx: pick(a.cx, b.cx),
    cy: pick(a.cy, b.cy),
    buttons: a.buttons | b.buttons,
  };
}
