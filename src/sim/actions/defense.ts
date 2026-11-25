import { Btn } from '../../input/types';
import {
  DASH_THRESHOLD,
  ROLL_BACK,
  ROLL_FORWARD,
  SHIELD_BREAK_DIZZY,
  SHIELD_DEPLETION,
  SHIELD_DROP_FRAMES,
  SHIELD_HP_AFTER_BREAK,
  SHIELD_MIN_HOLD,
  SPOT_DODGE,
} from '../constants';
import { flickDown, flickX, isHeld } from '../control';
import { emit } from '../events';
import type { Ctx } from '../fighter';
import { leaveGround } from '../movement';
import { groundAttack } from './attack';
import { consumeJump, wantsJump } from './common';
import { grabInput, shieldGrab } from './grab';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

/** Share of a roll's distance covered on each frame of its movement window: a smooth ease-in/ease-out. */
export function rollWeights([from, to]: [number, number]): number[] {
  const n = to - from + 1;
  const raw = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / n));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
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
      f.vel.x = k >= 0 && k < weights.length ? f.dodgeDir.x * s.rollDistance * weights[k]! : 0;
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

  /** Shield release lag; its first frames are the parry window. */
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
      enterAction(x, 'dizzy', 0);
    },
  },

  dizzy: {
    physics: 'ground',
    update(x) {
      const { f } = x;
      if (f.actionFrame >= Math.max(120, SHIELD_BREAK_DIZZY - Math.floor(f.damage))) {
        f.shieldHp = SHIELD_HP_AFTER_BREAK;
        setAction(x, 'idle');
      }
    },
  },
};
