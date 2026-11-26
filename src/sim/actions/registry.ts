import { getFighter } from '../../fighters/lookup';
import type { Ctx, FighterState } from '../fighter';

type Dynamic<T> = T | ((x: Ctx) => T);

/**
 * An action is one state of a fighter's state machine. `update` runs every frame (after actionFrame advances)
 * and may switch action with setAction; the physics mode then moves the fighter.
 */
export interface ActionDef {
  physics: 'ground' | 'air' | 'none';
  /**
   * Ground: at the end of the surface, walk off into fall ('fall'), slide off still in this action, which then
   * runs air physics ('keep'), or stop ('stop', the default).
   */
  edge?: 'fall' | 'keep' | 'stop';
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

/**
 * The action `f` is in: its fighter's own version (`FighterDef.actions`) when it has one, else the shared one.
 */
export function actionDef(f: FighterState): ActionDef {
  return getFighter(f.fighter).actions?.[f.action] ?? ACTIONS[f.action]!;
}

function known(x: Ctx, name: string): boolean {
  return ACTIONS[name] !== undefined || x.def.actions?.[name] !== undefined;
}

/** Switch action and run the new action's first frame now. */
export function setAction(x: Ctx, name: string): void {
  if (!known(x, name)) throw new Error(`unknown action ${name}`);
  x.f.action = name;
  x.f.actionFrame = 1;
  x.f.move = null;
}

/** Switch action from physics (landing, ledge grab): its frame 1 is the next simulated frame. */
export function enterAction(x: Ctx, name: string, frame = 0): void {
  if (!known(x, name)) throw new Error(`unknown action ${name}`);
  x.f.action = name;
  x.f.actionFrame = frame;
  x.f.move = null;
}

/** The frame contexts (one per fighter per simulated frame) whose action held its frame with holdFrame. */
const held = new WeakSet<Ctx>();

/**
 * Play the current action frame again next frame, as a move held on its charge frame does. The frame's work is
 * done: unlike a switch to another action or frame, runAction doesn't update the action a second time.
 */
export function holdFrame(x: Ctx): void {
  x.f.actionFrame--;
  held.add(x);
}

/**
 * Update the fighter's action once, and again each time that update switches to another action or frame, so the new
 * one starts this frame. A frame held with holdFrame isn't new.
 */
export function runAction(x: Ctx): void {
  for (let i = 0; i < 8; i++) {
    const { action, actionFrame } = x.f;
    actionDef(x.f).update(x);
    if (x.f.action !== action) continue;
    if (x.f.actionFrame === actionFrame) return;
    if (x.f.actionFrame === actionFrame - 1 && held.has(x)) return;
  }
}

export const inWindow = (frame: number, [a, b]: readonly [number, number]) => frame >= a && frame <= b;

export function isIntangible(f: FighterState): boolean {
  return f.intangible > 0 || (actionDef(f).intangible?.(f) ?? false);
}
