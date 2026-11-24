import type { Ctx, FighterState } from '../fighter';

type Dynamic<T> = T | ((x: Ctx) => T);

/**
 * An action is one state of a fighter's state machine. `update` runs every frame (after actionFrame advances)
 * and may switch action with setAction; the physics mode then moves the fighter.
 */
export interface ActionDef {
  physics: 'ground' | 'air' | 'none';
  /** Ground: at the end of the surface, walk off ('fall') or stop ('stop', the default). */
  edge?: 'fall' | 'stop';
  /** Ground: apply traction (default true). Actions that set their own speed turn it off. */
  friction?: boolean;
  /** Air: stick drift (default true); 'helpless' drifts at reduced speed. */
  drift?: Dynamic<boolean | 'helpless'>;
  /** Air: gravity (default true). */
  gravity?: Dynamic<boolean>;
  /** Air: may grab ledges. true = while falling, a number = from that action frame even while rising. */
  ledge?: Dynamic<boolean | number>;
  /** Intangible on this frame of the action. */
  intangible?: (f: FighterState) => boolean;
  update(x: Ctx): void;
  /** Air: what landing does (default: normal landing lag). */
  land?(x: Ctx): void;
}

export const ACTIONS: Record<string, ActionDef> = {};

/** Switch action and run the new action's first frame now. */
export function setAction(x: Ctx, name: string): void {
  if (!ACTIONS[name]) throw new Error(`unknown action ${name}`);
  x.f.action = name;
  x.f.actionFrame = 1;
  x.f.move = null;
}

/** Switch action from physics (landing, ledge grab): its frame 1 is the next simulated frame. */
export function enterAction(x: Ctx, name: string, frame = 0): void {
  if (!ACTIONS[name]) throw new Error(`unknown action ${name}`);
  x.f.action = name;
  x.f.actionFrame = frame;
  x.f.move = null;
}

export function runAction(x: Ctx): void {
  for (let i = 0; i < 8; i++) {
    const { action, actionFrame } = x.f;
    ACTIONS[action]!.update(x);
    if (x.f.action === action && x.f.actionFrame === actionFrame) return;
  }
}

export const inWindow = (frame: number, [a, b]: readonly [number, number]) => frame >= a && frame <= b;

export function isIntangible(f: FighterState): boolean {
  return f.intangible > 0 || (ACTIONS[f.action]?.intangible?.(f) ?? false);
}
