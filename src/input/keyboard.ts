import { KEYBOARD_WALK_TILT, type KeyboardBinding } from './bindings';
import { BUTTON_NAMES, buttonBit, neutralInput, quantizeAxis, type InputFrame } from './types';

/**
 * Tracks held keys and turns them into stick + button state. Opposite directions resolve to the most recently
 * pressed one (last-input priority), which is what platform fighter players expect on keyboards.
 */
export class KeyboardState {
  private readonly order = new Map<string, number>();
  private counter = 0;

  keyDown(code: string): void {
    if (!this.order.has(code)) this.order.set(code, ++this.counter);
  }

  keyUp(code: string): void {
    this.order.delete(code);
  }

  clear(): void {
    this.order.clear();
  }

  private latest(codes: string[]): number {
    let best = 0;
    for (const c of codes) best = Math.max(best, this.order.get(c) ?? 0);
    return best;
  }

  read(binding: KeyboardBinding): InputFrame {
    const out = neutralInput();
    const tilt = this.latest(binding.walk) > 0 ? KEYBOARD_WALK_TILT : 1;
    const axis = (neg: string[], pos: string[]) => {
      const n = this.latest(neg);
      const p = this.latest(pos);
      if (n === 0 && p === 0) return 0;
      return quantizeAxis((p > n ? 1 : -1) * tilt);
    };
    out.x = axis(binding.left, binding.right);
    out.y = axis(binding.down, binding.up);
    for (const name of BUTTON_NAMES) {
      const codes = binding.buttons[name];
      if (codes && this.latest(codes) > 0) out.buttons |= buttonBit(name);
    }
    return out;
  }

  attach(target: Window): () => void {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keyDown(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => this.keyUp(e.code);
    const blur = () => this.clear();
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
