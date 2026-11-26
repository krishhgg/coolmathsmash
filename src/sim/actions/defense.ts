import { Btn } from '../../input/types';
import {
  DASH_THRESHOLD,
  DIZZY,
  PARRY,
  ROLL_BACK,
  ROLL_FORWARD,
  SHIELD_DEPLETION,
  SHIELD_DROP_FRAMES,
  SHIELD_HP_AFTER_BREAK,
  SHIELD_MIN_HOLD,
  SPOT_DODGE,
} from '../constants';
import { shieldBreakStun } from '../combat/formulas';
import { flickDown, flickX, isHeld, justPressed } from '../control';
import { emit } from '../events';
import type { Ctx, FighterState } from '../fighter';
import { leaveGround } from '../movement';
import { groundAttack } from './attack';
import { consumeJump, wantsJump } from './common';
import { grabInput, MASH_BUTTONS, mashDir, shieldGrab } from './grab';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

/** Share of a roll's distance covered on each frame of its movement window: a smooth ease-in/ease-out. */
export function rollWeights([from, to]: [number, number]): number[] {
  const n = to - from + 1;
  const raw = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / n));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/**
 * A hit landing on `f` during match frame `frame` is parried: `f` is on frames 1 to PARRY.window of a shield drop
 * that started on or after `parryFrom`, PARRY.lockout frames after its last shieldstun.
 */
export function parries(f: FighterState, frame: number): boolean {
  return (
    f.action === 'shieldDrop' && f.actionFrame <= PARRY.window && frame - f.actionFrame + 1 >= f.parryFrom
  );
}

export function breakShield(x: Ctx): void {
  const { f, d } = x;
  f.shieldHp = 0;
  leaveGround(x);
  f.vel.x = 0;
  f.vel.y = d.shieldBreakV;
  setAction(x, 'shieldBreak');
  emit(x.m, { type: 'shieldBreak', port: f.port });
}

function roll(name: 'rollForward' | 'rollBack'): ActionDef {
  const spec = name === 'rollForward' ? ROLL_FORWARD : ROLL_BACK;
  const weights = rollWeights(spec.move);
  return {
    physics: 'ground',
    friction: false,
    intangible: (f) => inWindow(f.actionFrame, spec.intangible),
    update(x) {
      const { f, s } = x;
      const k = f.actionFrame - spec.move[0];
      const distance = name === 'rollBack' ? (s.backRollDistance ?? s.rollDistance) : s.rollDistance;
      f.vel.x = k >= 0 && k < weights.length ? f.dodgeDir.x * distance * weights[k]! : 0;
      if (f.actionFrame >= spec.faf) {
        if (name === 'rollForward') f.facing = -f.facing as 1 | -1;
        setAction(x, 'idle');
      }
    },
  };
}

export const DEFENSE: Record<string, ActionDef> = {
  /**
   * Held shield: drains health; jump, roll (flick sideways) and spot dodge (flick down) come out instantly, and a
   * shield grab once the post-shieldstun lock is over.
   */
  shield: {
    physics: 'ground',
    update(x) {
      const { f, c } = x;
      if (shieldGrab(x)) return;
      if (wantsJump(x)) {
        consumeJump(x);
        return setAction(x, 'jumpSquat');
      }
      const fl = flickX(c, DASH_THRESHOLD);
      if (fl !== 0) {
        f.dodgeDir = { x: fl, y: 0 };
        return setAction(x, fl === f.facing ? 'rollForward' : 'rollBack');
      }
      if (flickDown(c)) return setAction(x, 'spotDodge');
      if (!isHeld(c, Btn.Shield) && f.actionFrame >= SHIELD_MIN_HOLD) return setAction(x, 'shieldDrop');
      f.shieldHp -= SHIELD_DEPLETION;
      if (f.shieldHp <= 0) breakShield(x);
    },
  },

  /** Shield release lag; its first PARRY.window frames are the parry window (`parries`). */
  shieldDrop: {
    physics: 'ground',
    update(x) {
      if (x.f.actionFrame > SHIELD_DROP_FRAMES) setAction(x, 'idle');
    },
  },

  /** Spot dodge: from SPOT_DODGE.attackCancel a ground attack or special comes out early; a grab waits for the FAF. */
  spotDodge: {
    physics: 'ground',
    intangible: (f) => inWindow(f.actionFrame, SPOT_DODGE.intangible),
    update(x) {
      if (x.f.actionFrame >= SPOT_DODGE.faf) return setAction(x, 'idle');
      if (x.f.actionFrame >= SPOT_DODGE.attackCancel && !grabInput(x.c)) groundAttack(x);
    },
  },

  rollForward: roll('rollForward'),
  rollBack: roll('rollBack'),

  shieldBreak: {
    physics: 'air',
    drift: false,
    update() {},
    land(x) {
      x.f.vel.x = 0;
      x.f.dizzyTimer = shieldBreakStun(Math.floor(x.f.damage));
      enterAction(x, 'dizzy', 0);
    },
  },

  /**
   * Shield-break stun: 400 - % frames (shieldBreakStun; SmashWiki: Stun), less DIZZY.mashStick for each new stick
   * direction and DIZZY.mashButton for each mash button pressed. Then the shield is back at 37.5 HP and the fighter
   * wakes up.
   */
  dizzy: {
    physics: 'ground',
    update(x) {
      const { f, c } = x;
      const dir = mashDir(c.cur);
      const stick = dir !== 0 && dir !== mashDir(c.prev) ? DIZZY.mashStick : 0;
      const buttons = MASH_BUTTONS.filter((b) => justPressed(c, b)).length * DIZZY.mashButton;
      f.dizzyTimer -= 1 + stick + buttons;
      if (f.dizzyTimer <= 0) {
        f.shieldHp = SHIELD_HP_AFTER_BREAK;
        setAction(x, 'dizzyWake');
      }
    },
  },

  /** Waking up from the dizzy (Ultimate's FuraFuraEnd): DIZZY.wakeFrames frames, actionable on the next. */
  dizzyWake: {
    physics: 'ground',
    update(x) {
      if (x.f.actionFrame > DIZZY.wakeFrames) setAction(x, 'idle');
    },
  },
};
