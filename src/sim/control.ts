import { Btn, neutralInput, type InputFrame } from '../input/types';
import {
  DIRECTION_THRESHOLD,
  DOWN_FLICK_THRESHOLD,
  FLICK_NEUTRAL,
  FLICK_WINDOW,
  HOLD_BUFFER,
  INPUT_BUFFER_FRAMES,
  SMASH_THRESHOLD,
  SMASH_WINDOW,
  STICK_DEADZONE,
  TAP_JUMP_THRESHOLD,
} from './constants';

const BUTTON_BITS = [Btn.Attack, Btn.Special, Btn.Jump, Btn.Shield, Btn.Grab, Btn.Taunt, Btn.Start];
const NEVER = -100000;

/**
 * Per-player input history the simulation reads instead of raw frames: press edges, the input buffer, and
 * flick (tap) timing for dashes, smash attacks, tap jumps, fast falls and platform drops.
 * Plain numbers only, so it is part of the deterministic, serialisable match state.
 */
export interface ControlState {
  frame: number;
  cur: InputFrame;
  prev: InputFrame;
  pressedAt: number[];
  consumed: boolean[];
  /** Last frame each stick axis/direction was near neutral. */
  neutralX: number;
  neutralUp: number;
  neutralDown: number;
  neutralC: number;
  /** Frame a C-stick flick registered, and its direction then. */
  cPressedAt: number;
  cDirX: number;
  cDirY: number;
  cConsumed: boolean;
  /** A flick already registered since the C-stick last left neutral. */
  cRegistered: boolean;
  /** neutralUp of the up-flick last used for a tap jump, so one flick jumps once. */
  upFlickUsed: number;
}

export function createControl(): ControlState {
  return {
    frame: -1,
    cur: neutralInput(),
    prev: neutralInput(),
    pressedAt: BUTTON_BITS.map(() => NEVER),
    consumed: BUTTON_BITS.map(() => true),
    neutralX: NEVER,
    neutralUp: NEVER,
    neutralDown: NEVER,
    neutralC: NEVER,
    cPressedAt: NEVER,
    cDirX: 0,
    cDirY: 0,
    cConsumed: true,
    cRegistered: false,
    upFlickUsed: NEVER,
  };
}

function bitIndex(bit: number): number {
  const i = BUTTON_BITS.indexOf(bit as (typeof BUTTON_BITS)[number]);
  if (i < 0) throw new Error(`unknown button bit ${bit}`);
  return i;
}

export function feedControl(c: ControlState, input: InputFrame): void {
  c.frame++;
  c.prev = c.cur;
  c.cur = { x: input.x, y: input.y, cx: input.cx, cy: input.cy, buttons: input.buttons };
  for (let i = 0; i < BUTTON_BITS.length; i++) {
    const bit = BUTTON_BITS[i]!;
    if (c.cur.buttons & bit && !(c.prev.buttons & bit)) {
      c.pressedAt[i] = c.frame;
      c.consumed[i] = false;
    }
  }
  const x = Math.abs(c.cur.x) / 100;
  const y = c.cur.y / 100;
  if (x < FLICK_NEUTRAL) c.neutralX = c.frame;
  if (y < FLICK_NEUTRAL) c.neutralUp = c.frame;
  if (y > -FLICK_NEUTRAL) c.neutralDown = c.frame;
  const cMag = Math.max(Math.abs(c.cur.cx), Math.abs(c.cur.cy)) / 100;
  if (cMag < FLICK_NEUTRAL) {
    c.neutralC = c.frame;
    c.cRegistered = false;
  } else if (!c.cRegistered && cMag >= SMASH_THRESHOLD && c.frame - c.neutralC <= FLICK_WINDOW) {
    c.cRegistered = true;
    c.cPressedAt = c.frame;
    c.cConsumed = false;
    const horizontal = Math.abs(c.cur.cx) >= Math.abs(c.cur.cy);
    c.cDirX = horizontal ? Math.sign(c.cur.cx) : 0;
    c.cDirY = horizontal ? 0 : Math.sign(c.cur.cy);
  }
}

function deadzone(v: number): number {
  const f = v / 100;
  return Math.abs(f) < STICK_DEADZONE ? 0 : f;
}

/** Main stick x in [-1, 1] after the dead zone. */
export function stickX(c: ControlState): number {
  return deadzone(c.cur.x);
}

export function stickY(c: ControlState): number {
  return deadzone(c.cur.y);
}

export function isHeld(c: ControlState, bit: number): boolean {
  return (c.cur.buttons & bit) !== 0;
}

export function justPressed(c: ControlState, bit: number): boolean {
  return c.pressedAt[bitIndex(bit)] === c.frame;
}

/** True while an unconsumed press is inside the buffer window (or still held, with the hold buffer). */
export function buffered(c: ControlState, bit: number): boolean {
  const i = bitIndex(bit);
  if (c.consumed[i]) return false;
  if (c.frame - c.pressedAt[i]! < INPUT_BUFFER_FRAMES) return true;
  return HOLD_BUFFER && isHeld(c, bit);
}

export function consume(c: ControlState, bit: number): void {
  c.consumed[bitIndex(bit)] = true;
}

/** Frames since the button was last pressed (large when never). */
export function framesSincePress(c: ControlState, bit: number): number {
  return c.frame - c.pressedAt[bitIndex(bit)]!;
}

/** Horizontal flick: the stick went from neutral to past `threshold` within the flick window. Returns -1, 0 or 1. */
export function flickX(c: ControlState, threshold: number, window = FLICK_WINDOW): number {
  const x = stickX(c);
  if (Math.abs(x) < threshold || c.frame - c.neutralX > window) return 0;
  return Math.sign(x);
}

export function flickUp(c: ControlState, threshold = TAP_JUMP_THRESHOLD, window = FLICK_WINDOW): boolean {
  return stickY(c) >= threshold && c.frame - c.neutralUp <= window;
}

/** An up-flick that has not been used for a tap jump yet. */
export function tapJumpReady(c: ControlState): boolean {
  return flickUp(c) && c.upFlickUsed !== c.neutralUp;
}

export function consumeTapJump(c: ControlState): void {
  c.upFlickUsed = c.neutralUp;
}

export function flickDown(c: ControlState, threshold = DOWN_FLICK_THRESHOLD, window = FLICK_WINDOW): boolean {
  return stickY(c) <= -threshold && c.frame - c.neutralDown <= window;
}

export type Dir = 'neutral' | 'forward' | 'back' | 'up' | 'down';

/** Dominant stick direction relative to facing (1 = right, -1 = left). */
export function stickDir(c: ControlState, facing: number, threshold = DIRECTION_THRESHOLD): Dir {
  const x = stickX(c);
  const y = stickY(c);
  if (Math.max(Math.abs(x), Math.abs(y)) < threshold) return 'neutral';
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? 'up' : 'down';
  return Math.sign(x) === facing ? 'forward' : 'back';
}

/**
 * Smash-attack direction for an attack press this frame: the stick was flicked past SMASH_THRESHOLD within
 * SMASH_WINDOW frames, so tapping a direction together with attack smashes and holding it first tilts.
 */
export function smashDir(c: ControlState, facing: number): Dir {
  const x = stickX(c);
  const y = stickY(c);
  if (Math.abs(y) > Math.abs(x)) {
    if (y >= SMASH_THRESHOLD && c.frame - c.neutralUp <= SMASH_WINDOW) return 'up';
    if (y <= -SMASH_THRESHOLD && c.frame - c.neutralDown <= SMASH_WINDOW) return 'down';
    return 'neutral';
  }
  if (Math.abs(x) >= SMASH_THRESHOLD && c.frame - c.neutralX <= SMASH_WINDOW) {
    return Math.sign(x) === facing ? 'forward' : 'back';
  }
  return 'neutral';
}

/** A C-stick flick still in the buffer window, as a direction relative to facing; consume with consumeCStick. */
export function cStickDir(c: ControlState, facing: number): Dir {
  if (c.cConsumed || c.frame - c.cPressedAt >= INPUT_BUFFER_FRAMES) return 'neutral';
  if (c.cDirY !== 0) return c.cDirY > 0 ? 'up' : 'down';
  return c.cDirX === facing ? 'forward' : 'back';
}

/** The C-stick is pushed past the dead zone (it keeps a smash charging). */
export function cStickHeld(c: ControlState): boolean {
  return Math.max(Math.abs(c.cur.cx), Math.abs(c.cur.cy)) / 100 >= STICK_DEADZONE;
}

export function consumeCStick(c: ControlState): void {
  c.cConsumed = true;
}
