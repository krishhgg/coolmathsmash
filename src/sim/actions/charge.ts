import { Btn } from '../../input/types';
import type { MoveDef } from '../../fighters/types';
import { buffered, consume, cStickHeld, isHeld } from '../control';
import { emit } from '../events';
import type { Ctx, FighterState } from '../fighter';
import { moveOf } from './attack';
import { consumeJump, wantsJump } from './common';
import { setAction } from './registry';

/** Ultimate: a smash attack charges for at most 60 frames, reaching 1.4x damage. */
export const SMASH_CHARGE_FRAMES = 60;
export const SMASH_CHARGE_MAX = 1.4;

/** How far the current move is charged, from 0 to 1 (full charge is the move's `chargeFrames`, default 60). */
export function chargeLevel(f: FighterState): number {
  return f.charge / (moveOf(f)?.chargeFrames ?? SMASH_CHARGE_FRAMES);
}

/** The value between `uncharged` and `full` at the current charge level, for a script's speeds or distances. */
export function chargeLerp(f: FighterState, uncharged: number, full: number): number {
  return uncharged + (full - uncharged) * chargeLevel(f);
}

/** Damage multiplier from charging: from 1 uncharged up to the move's `chargeDamage` (default 1.4) at full charge. */
export function chargeMultiplier(f: FighterState): number {
  return chargeLerp(f, 1, moveOf(f)?.chargeDamage ?? SMASH_CHARGE_MAX);
}

function report(x: Ctx, phase: 'full' | 'store' | 'fire'): void {
  emit(x.m, { type: 'charge', port: x.f.port, move: x.f.move!, phase, level: chargeLevel(x.f) });
}

/** Keep the charge for the move's next use (an uncharged move keeps nothing). */
function store(x: Ctx): void {
  const { f } = x;
  if (f.charge === 0) return;
  f.storedCharge = { fighter: f.fighter, move: f.move!, frames: f.charge };
  report(x, 'store');
}

/**
 * The charge stored for the move `f` is playing, if any. A charge belongs to the form that stored it: a transformed
 * fighter's move of the same name starts uncharged (Ultimate: Squirtle keeps Water Gun's charge through Pokemon
 * Change, and Ivysaur and Charizard cannot use it).
 */
function storedFor(f: FighterState): { frames: number } | null {
  const s = f.storedCharge;
  return s && s.fighter === f.fighter && s.move === f.move ? s : null;
}

/** Shield (on the ground; roll or spot dodge from there), an air dodge or a jump keeps the charge and cancels. */
function storeCancel(x: Ctx): boolean {
  const { f, s, c } = x;
  if (buffered(c, Btn.Shield) && (f.ground || !f.airDodgeUsed)) {
    store(x);
    consume(c, Btn.Shield);
    setAction(x, f.ground ? 'shield' : 'airDodge');
    return true;
  }
  if (wantsJump(x) && (f.ground || f.jumpsUsed < s.jumps)) {
    store(x);
    consumeJump(x);
    setAction(x, f.ground ? 'jumpSquat' : 'doubleJump');
    return true;
  }
  return false;
}

/**
 * The move is on its `charge` frame: stay there another frame while it charges ('hold'), carry on and fire
 * ('go'), or report that a stored-charge move was cancelled into another action ('cancel').
 *
 * - Smash attacks charge while Attack or the C-stick is held, other moves while Special is held, for up to
 *   `chargeFrames`; letting go, or reaching full charge, fires.
 * - Moves with `storeCharge` start from the charge stored for them (a full one fires at once). They charge while
 *   Special is held and fire on release, or with `tap` charge by themselves and fire on the next Special or Attack
 *   press. Shield, an air dodge or a jump stores the charge in `storedCharge` and cancels the move. At full
 *   charge they store it and end (`storeAtFull`) or wait. A stored charge is spent only when the move fires.
 */
export function chargeHold(x: Ctx, move: MoveDef): 'hold' | 'go' | 'cancel' {
  const { f, c } = x;
  const max = move.chargeFrames ?? SMASH_CHARGE_FRAMES;
  const grow = () => {
    f.charge++;
    if (f.charge === max) report(x, 'full');
    return 'hold' as const;
  };
  const fire = () => {
    if (f.charge > 0) report(x, 'fire');
    if (storedFor(f)) f.storedCharge = null;
    return 'go' as const;
  };
  const opts = move.storeCharge;
  if (!opts) {
    const holding = move.kind === 'smash' ? isHeld(c, Btn.Attack) || cStickHeld(c) : isHeld(c, Btn.Special);
    return f.charge < max && holding ? grow() : fire();
  }
  const kept = f.charge === 0 ? storedFor(f) : null;
  if (kept) {
    f.charge = kept.frames;
    if (f.charge >= max) return fire();
  }
  if (storeCancel(x)) return 'cancel';
  const released = opts.tap ? buffered(c, Btn.Special) || buffered(c, Btn.Attack) : !isHeld(c, Btn.Special);
  if (released) {
    consume(c, Btn.Special);
    consume(c, Btn.Attack);
    return fire();
  }
  if (f.charge < max) return grow();
  if (!opts.storeAtFull) return 'hold';
  store(x);
  setAction(x, f.ground ? 'idle' : 'fall');
  return 'cancel';
}
