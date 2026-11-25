import type { KeyboardBinding } from '../input/bindings';
import type { PadLike } from '../input/gamepad';
import { padDevice, type DeviceId } from '../session/devices';

export type MenuAction =
  'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start' | 'prev' | 'next' | 'alt';
export type Direction = Extract<MenuAction, 'up' | 'down' | 'left' | 'right'>;
/** A controller, or `keys` for the keyboard-wide menu keys (Enter, Space, Escape, Backspace). */
export type MenuDevice = DeviceId | 'keys';

export interface MenuEvent {
  device: MenuDevice;
  action: MenuAction;
}

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
export const isDirection = (a: MenuAction): a is Direction => (DIRECTIONS as readonly string[]).includes(a);

/** Keys that work in every menu whatever the bindings say. */
const MENU_KEYS: Record<string, MenuAction> = {
  Enter: 'start',
  NumpadEnter: 'start',
  Space: 'confirm',
  Escape: 'back',
  Backspace: 'back',
};

/** Standard-mapping gamepad buttons in menus: A confirm, B back, X/Y alt, L/ZL previous, R/ZR next. */
const PAD_BUTTONS: [index: number, action: MenuAction][] = [
  [0, 'confirm'],
  [1, 'back'],
  [2, 'alt'],
  [3, 'alt'],
  [4, 'prev'],
  [6, 'prev'],
  [5, 'next'],
  [7, 'next'],
  [8, 'back'],
  [9, 'start'],
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
];
const STICK_THRESHOLD = 0.55;
export const REPEAT_DELAY_MS = 380;
export const REPEAT_EVERY_MS = 95;

/** Keys whose browser default (activating a focused button, scrolling, moving focus) would act alongside the menu. */
const NATIVE_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'Escape', 'Backspace', 'Tab']);

/**
 * Turns keyboards and gamepads into menu events, per device so several players can drive their own cursors on the
 * character select. Each keyboard half follows its fight bindings (directions, attack = confirm, special = back,
 * shield/grab = previous/next, jump = alt); held directions repeat.
 */
export class MenuInput {
  private readonly queue: MenuEvent[] = [];
  private readonly held = new Map<string, { event: MenuEvent; last: number; since: number }>();
  private readonly keysDown = new Set<string>();
  private padButtons: boolean[][] = [];

  constructor(
    private readonly bindings: () => readonly KeyboardBinding[],
    private readonly matchPadStart: () => readonly number[] | null = () => null,
  ) {}

  private keyEvents(code: string): MenuEvent[] {
    const menu = MENU_KEYS[code];
    const inMatch = this.matchPadStart() !== null;
    if (inMatch && menu) return [{ device: 'keys', action: menu }];
    const out: MenuEvent[] = [];
    this.bindings().forEach((b, i) => {
      const device: DeviceId = i === 0 ? 'kb1' : 'kb2';
      const has = (codes: string[] | undefined) => codes?.includes(code) ?? false;
      if (inMatch && has(b.buttons.start)) {
        out.push({ device, action: 'start' });
        return;
      }
      for (const dir of DIRECTIONS) if (has(b[dir])) out.push({ device, action: dir });
      if (has(b.buttons.attack)) out.push({ device, action: 'confirm' });
      if (has(b.buttons.special)) out.push({ device, action: 'back' });
      if (has(b.buttons.shield)) out.push({ device, action: 'prev' });
      if (has(b.buttons.grab)) out.push({ device, action: 'next' });
      if (has(b.buttons.jump)) out.push({ device, action: 'alt' });
    });
    if (menu && !out.some((e) => e.action === menu)) out.push({ device: 'keys', action: menu });
    return out;
  }

  private press(key: string, event: MenuEvent, now: number): void {
    this.queue.push(event);
    if (isDirection(event.action)) this.held.set(key, { event, since: now, last: now });
  }

  keyDown(code: string, now: number): void {
    if (this.keysDown.has(code)) return;
    this.keysDown.add(code);
    this.keyEvents(code).forEach((e, i) => this.press(`key:${code}:${i}`, e, now));
  }

  keyUp(code: string): void {
    this.keysDown.delete(code);
    for (const key of [...this.held.keys()]) if (key.startsWith(`key:${code}:`)) this.held.delete(key);
  }

  /** Forget queued events and held directions (keys still down stay down, so they cannot fire again). */
  clear(): void {
    this.held.clear();
    this.queue.length = 0;
  }

  /** Everything pressed since the last poll plus repeats of held directions, oldest first. */
  poll(now: number, pads: readonly (PadLike | null)[] = []): MenuEvent[] {
    const start = this.matchPadStart();
    const buttons: readonly [number, MenuAction][] =
      start === null
        ? PAD_BUTTONS
        : [
            ...PAD_BUTTONS.filter(([index, action]) => action !== 'start' && !start.includes(index)),
            ...Array.from(new Set(start), (index): [number, MenuAction] => [index, 'start']),
          ];
    pads.forEach((pad, slot) => this.pollPad(pad, slot, now, buttons));
    for (const h of this.held.values()) {
      if (now - h.since >= REPEAT_DELAY_MS && now - h.last >= REPEAT_EVERY_MS) {
        h.last = now;
        this.queue.push(h.event);
      }
    }
    return this.queue.splice(0);
  }

  private pollPad(
    pad: PadLike | null,
    slot: number,
    now: number,
    buttons: readonly [number, MenuAction][],
  ): void {
    const device = padDevice(slot);
    const prev = this.padButtons[slot] ?? [];
    const cur = (pad?.buttons ?? []).map((b) => b.pressed || b.value > 0.5);
    const x = pad?.axes[0] ?? 0;
    const y = pad?.axes[1] ?? 0;
    const stick: Record<Direction, boolean> = {
      up: y < -STICK_THRESHOLD,
      down: y > STICK_THRESHOLD,
      left: x < -STICK_THRESHOLD,
      right: x > STICK_THRESHOLD,
    };
    for (const [index, action] of buttons) {
      const down = cur[index] ?? false;
      const key = `pad:${slot}:${index}`;
      if (down && !prev[index]) this.press(key, { device, action }, now);
      if (!down) this.held.delete(key);
    }
    DIRECTIONS.forEach((dir, i) => {
      const index = 100 + i;
      cur[index] = stick[dir];
      const key = `pad:${slot}:${index}`;
      if (stick[dir] && !prev[index]) this.press(key, { device, action: dir }, now);
      if (!stick[dir]) this.held.delete(key);
    });
    this.padButtons[slot] = cur;
  }

  attach(target: Window): () => void {
    const down = (e: KeyboardEvent) => {
      if (NATIVE_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.keyDown(e.code, performance.now());
    };
    const up = (e: KeyboardEvent) => this.keyUp(e.code);
    const blur = () => {
      this.held.clear();
      this.keysDown.clear();
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', blur);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    };
  }
}
