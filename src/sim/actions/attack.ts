import { getFighter } from '../../fighters/registry';
import type { MoveDef } from '../../fighters/types';
import { Btn } from '../../input/types';
import {
  buffered,
  cStickDir,
  consume,
  consumeCStick,
  smashDir,
  specialDir,
  stickDir,
  type Dir,
} from '../control';
import { emit } from '../events';
import type { Ctx, FighterState } from '../fighter';
import { HELPLESS_LANDING_LAG } from '../constants';
import { spawnFromMove } from '../entities/entities';
import { pickUpItem } from '../items/pickup';
import { leaveGround, normalLandingLag } from '../movement';
import { fastFallCheck } from './air';
import { chargeHold } from './charge';
import { groundGrab } from './grab';
import { glideAfterMove } from './mobility';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

export function moveOf(f: FighterState): MoveDef | undefined {
  return f.move ? getFighter(f.fighter).moves?.[f.move] : undefined;
}

/**
 * Begin one of the fighter's moves now. Grounded moves play as 'attack', airborne ones as 'aerial', unless
 * `action` names another action that plays moves (the grab actions). An airborne start plays the move's `air`
 * variant instead when it has one.
 */
export function startMove(x: Ctx, requested: string, action?: string): boolean {
  const air = x.f.ground ? undefined : x.def.moves?.[requested]?.air;
  const name = air ?? requested;
  const move = x.def.moves?.[name];
  if (!move) return false;
  if (x.f.ground && move.leavesGround) leaveGround(x);
  // Recoveries own their vertical motion: a fast fall carried into one would snap back once it ends.
  if (move.helpless || move.action === 'hover') x.f.fastFalling = false;
  setAction(x, action ?? move.action ?? (x.f.ground ? 'attack' : 'aerial'));
  x.f.move = name;
  emit(x.m, { type: 'move', port: x.f.port, move: name });
  x.f.hitVictims = [];
  x.f.holdHitsLanded = 0;
  x.f.hitEntities = [];
  x.f.moveStale = 0;
  x.f.charge = 0;
  x.f.counterDamage = 0;
  return true;
}

const SMASH: Record<Dir, string> = {
  neutral: 'jab',
  forward: 'fsmash',
  back: 'fsmash',
  up: 'usmash',
  down: 'dsmash',
};
const TILT: Record<Dir, string> = {
  neutral: 'jab',
  forward: 'ftilt',
  back: 'ftilt',
  up: 'utilt',
  down: 'dtilt',
};
const AERIAL: Record<Dir, string> = {
  neutral: 'nair',
  forward: 'fair',
  back: 'bair',
  up: 'uair',
  down: 'dair',
};
const SPECIAL: Record<Dir, string> = {
  neutral: 'neutralB',
  forward: 'sideB',
  back: 'sideB',
  up: 'upB',
  down: 'downB',
};

function turnFor(x: Ctx, dir: Dir): void {
  if (dir === 'back') x.f.facing = -x.f.facing as 1 | -1;
}

/**
 * Grounded attack inputs, Smash style: Grab (or Attack with Shield held) grabs; the C-stick smashes; Attack with a
 * freshly flicked stick smashes, with a held stick tilts, and alone jabs; Attack while dashing or running is a
 * dash attack. Backward smashes and tilts turn around first. Standing or walking, Attack without a smash input picks
 * up an item within reach instead (src/sim/items/pickup.ts). True when a move started or an item was picked up.
 */
export function groundAttack(x: Ctx): boolean {
  const { f, c } = x;
  if (groundGrab(x)) return true;
  const cDir = cStickDir(c, f.facing);
  if (cDir !== 'neutral') {
    consumeCStick(c);
    turnFor(x, cDir);
    return startMove(x, SMASH[cDir]);
  }
  if (buffered(c, Btn.Special)) {
    consume(c, Btn.Special);
    const dir = specialDir(c, f.facing);
    turnFor(x, dir);
    return startMove(x, SPECIAL[dir]);
  }
  if (!buffered(c, Btn.Attack)) return false;
  consume(c, Btn.Attack);
  const smash = smashDir(c, f.facing);
  if (smash !== 'neutral') {
    turnFor(x, smash);
    return startMove(x, SMASH[smash]);
  }
  if (pickUpItem(x)) return true;
  if (f.action === 'dash' || f.action === 'run') return startMove(x, 'dashAttack');
  const dir = stickDir(c, f.facing);
  turnFor(x, dir);
  return startMove(x, TILT[dir]);
}

/** Ultimate lets up smash and up special come out of jumpsquat, so up + Attack with tap jump still up-smashes. */
export function jumpSquatAttack(x: Ctx): boolean {
  const { f, c } = x;
  if (cStickDir(c, f.facing) === 'up') {
    consumeCStick(c);
    return startMove(x, 'usmash');
  }
  if (buffered(c, Btn.Special) && specialDir(c, f.facing) === 'up') {
    consume(c, Btn.Special);
    return startMove(x, 'upB');
  }
  if (buffered(c, Btn.Attack) && smashDir(c, f.facing) === 'up') {
    consume(c, Btn.Attack);
    return startMove(x, 'usmash');
  }
  return false;
}

/** Airborne attack inputs: Attack or the C-stick picks an aerial by direction relative to facing; Special a special. */
export function airAttack(x: Ctx): boolean {
  const { f, c } = x;
  const cDir = cStickDir(c, f.facing);
  if (cDir !== 'neutral') {
    consumeCStick(c);
    return startMove(x, AERIAL[cDir]);
  }
  if (buffered(c, Btn.Special)) {
    consume(c, Btn.Special);
    const dir = specialDir(c, f.facing);
    turnFor(x, dir);
    return startMove(x, SPECIAL[dir]);
  }
  if (!buffered(c, Btn.Attack)) return false;
  consume(c, Btn.Attack);
  return startMove(x, AERIAL[stickDir(c, f.facing)]);
}

/**
 * Per-frame move bookkeeping: hold the charge frame while the move charges, reopen `rehit` windows, spawn the
 * frame's entities, run the move's script. Returns the move, or null when a stored charge cancelled it into
 * another action.
 */
export function playMove(x: Ctx): MoveDef | null {
  const { f } = x;
  const move = moveOf(f)!;
  if (move.charge === f.actionFrame) {
    const hold = chargeHold(x, move);
    if (hold === 'cancel') return null;
    if (hold === 'hold') f.actionFrame--;
  }
  if (move.hits.some((w) => w.rehit && w.frames[0] === f.actionFrame)) {
    f.hitVictims = [];
    f.hitEntities = [];
  }
  for (const s of move.spawn ?? []) if (s.frame === f.actionFrame) spawnFromMove(x, s);
  move.script?.(x);
  if (move.transform?.frame === f.actionFrame) {
    emit(x.m, { type: 'transform', port: f.port, from: f.fighter, to: move.transform.into });
    f.fighter = move.transform.into;
  }
  return move;
}

function moveIntangible(f: FighterState): boolean {
  const w = moveOf(f)?.intangible;
  return w !== undefined && inWindow(f.actionFrame, w);
}

/** Jab combos: Attack with the stick neutral inside the move's `next` window starts the combo's next hit. */
function comboNext(x: Ctx, move: MoveDef): boolean {
  const { f, c } = x;
  if (!move.next || !inWindow(f.actionFrame, move.next.window)) return false;
  if (!buffered(c, Btn.Attack) || stickDir(c, f.facing) !== 'neutral') return false;
  consume(c, Btn.Attack);
  return startMove(x, move.next.move);
}

export const ATTACK: Record<string, ActionDef> = {
  /** A grounded move, played from its frame data until its first actionable frame. */
  attack: {
    physics: 'ground',
    intangible: moveIntangible,
    update(x) {
      const move = playMove(x);
      if (!move || comboNext(x, move)) return;
      if (x.f.actionFrame >= move.faf) setAction(x, 'idle');
    },
  },

  /**
   * An airborne move. Landing during it costs the move's landing lag, unless it lands in an auto-cancel window or
   * the move continues on landing.
   */
  aerial: {
    physics: 'air',
    intangible: moveIntangible,
    drift: (x) => moveOf(x.f)?.drift ?? true,
    gravity: (x) => moveOf(x.f)?.gravity ?? true,
    ledge: (x) => {
      const from = moveOf(x.f)?.ledgeFrom;
      return from === undefined ? false : from;
    },
    update(x) {
      const { f } = x;
      const move = playMove(x);
      if (!move) return;
      if (!move.helpless && !move.tether?.aimed) fastFallCheck(x);
      if (f.actionFrame < move.faf) return;
      if (glideAfterMove(x, move)) return;
      if (!move.helpless) return setAction(x, 'fall');
      setAction(x, 'helpless');
      f.landingLag = move.landingLag ?? HELPLESS_LANDING_LAG;
    },
    land(x) {
      const { f } = x;
      const move = moveOf(f)!;
      if (move.continuesOnLanding) {
        const { move: name, actionFrame } = f;
        enterAction(x, 'attack', actionFrame);
        f.move = name;
        return;
      }
      const cancelled = move.autoCancel?.some((w) => inWindow(f.actionFrame, w)) ?? false;
      f.landingLag = !cancelled && move.landingLag !== undefined ? move.landingLag : normalLandingLag(x);
      enterAction(x, 'land', 0);
    },
  },
};
