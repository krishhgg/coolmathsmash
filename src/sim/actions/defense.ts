import { Btn } from '../../input/types';
import {
  DASH_THRESHOLD,
  ROLL,
  SHIELD_BREAK_DIZZY,
  SHIELD_DEPLETION,
  SHIELD_DROP_FRAMES,
  SHIELD_HP_AFTER_BREAK,
  SHIELD_MIN_HOLD,
  SPOT_DODGE,
} from '../constants';
import { flickDown, flickX, isHeld } from '../control';
import type { Ctx } from '../fighter';
import { leaveGround } from '../movement';
import { consumeJump, wantsJump } from './common';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

/** Share of a roll's distance covered on each movement frame: a smooth ease-in/ease-out. */
const ROLL_WEIGHTS = (() => {
  const n = ROLL.move[1] - ROLL.move[0] + 1;
  const raw = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / n));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
})();

export function breakShield(x: Ctx): void {
  const { f, d } = x;
  f.shieldHp = 0;
  leaveGround(x);
  f.vel.x = 0;
  f.vel.y = d.shieldBreakV;
  setAction(x, 'shieldBreak');
}

function roll(name: 'rollForward' | 'rollBack'): ActionDef {
  return {
    physics: 'ground',
    friction: false,
    intangible: (f) => inWindow(f.actionFrame, ROLL.intangible),
    update(x) {
      const { f, s } = x;
      const k = f.actionFrame - ROLL.move[0];
      f.vel.x = k >= 0 && k < ROLL_WEIGHTS.length ? f.dodgeDir.x * s.rollDistance * ROLL_WEIGHTS[k]! : 0;
      if (f.actionFrame >= ROLL.faf) {
        if (name === 'rollForward') f.facing = -f.facing as 1 | -1;
        setAction(x, 'idle');
      }
    },
  };
}

export const DEFENSE: Record<string, ActionDef> = {
  /** Held shield: drains health; jump, roll (flick sideways) and spot dodge (flick down) come out instantly. */
  shield: {
    physics: 'ground',
    update(x) {
      const { f, c } = x;
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

  spotDodge: {
    physics: 'ground',
    intangible: (f) => inWindow(f.actionFrame, SPOT_DODGE.intangible),
    update(x) {
      if (x.f.actionFrame >= SPOT_DODGE.faf) setAction(x, 'idle');
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
