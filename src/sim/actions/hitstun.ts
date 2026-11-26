import { Btn } from '../../input/types';
import { HITSTUN_CANCEL_AERIAL, HITSTUN_CANCEL_AIR_DODGE, PARRY, TECH_LOCKOUT } from '../constants';
import { buffered, consume, isHeld, justPressed } from '../control';
import type { Ctx } from '../fighter';
import { launchTimeScale } from '../movement';
import { airActionable } from './air';
import { airAttack } from './attack';
import { breakShield } from './defense';
import { tumbleLanding } from './knockdown';
import { setAction, type ActionDef } from './registry';

/** Count hitstun down (faster during balloon speed-up). True once the fighter can act. */
function hitstunOver(x: Ctx): boolean {
  const { f } = x;
  if (f.hitstun > 0) f.hitstun -= launchTimeScale(f);
  return f.hitstun <= 0;
}

export const HITSTUN: Record<string, ActionDef> = {
  /** Flinching from a hit too weak to tumble: no control until hitstun ends. */
  hitstun: {
    physics: 'ground',
    drift: false,
    update(x) {
      if (hitstunOver(x)) setAction(x, x.f.ground ? 'idle' : 'fall');
    },
    land() {},
  },

  /**
   * Launched into tumble. No control during hitstun except Ultimate's hitstun cancels once the launch has slowed:
   * an air dodge, or an aerial (not a special or a jump). SmashWiki (Hitstun canceling) names only those two, and
   * counts the 40 and 45 frames in real frames while balloon speed-up still shrinks the launch speed. A cancel
   * ends hitstun, so a near-vertical launch stops using DamageFlyTop gravity and the 1.8 fall cap. Afterwards
   * the fighter drifts and acts like falling. Landing in tumble techs if Shield was pressed in the last
   * TECH_WINDOW frames (a tech roll with the stick held sideways), else it is a missed tech.
   */
  tumble: {
    physics: 'air',
    drift: (x) => x.f.hitstun <= 0,
    ledge: (x) => x.f.hitstun <= 0,
    update(x) {
      const { f, c, m } = x;
      if (justPressed(c, Btn.Shield) && m.frame - f.techPressAt >= TECH_LOCKOUT) f.techPressAt = m.frame;
      if (f.hitstun > 0 && !hitstunOver(x)) {
        const speed = Math.hypot(f.kb.x, f.kb.y);
        if (
          f.actionFrame > HITSTUN_CANCEL_AERIAL.after &&
          speed < HITSTUN_CANCEL_AERIAL.below &&
          airAttack(x, false)
        ) {
          f.hitstun = 0;
          return;
        }
        if (
          f.actionFrame > HITSTUN_CANCEL_AIR_DODGE.after &&
          speed < HITSTUN_CANCEL_AIR_DODGE.below &&
          !f.airDodgeUsed &&
          buffered(c, Btn.Shield)
        ) {
          consume(c, Btn.Shield);
          f.hitstun = 0;
          setAction(x, 'airDodge');
        }
        return;
      }
      airActionable(x);
    },
    land: tumbleLanding,
  },

  /**
   * Shield held through a hit: stuck for the shieldstun stored in `hitstun`, then back to shield or dropping it.
   * A hit that emptied the shield breaks it once hitlag ends.
   */
  shieldStun: {
    physics: 'ground',
    update(x) {
      const { f, c } = x;
      if (f.shieldHp <= 0) return breakShield(x);
      if (f.actionFrame <= f.hitstun) return;
      f.hitstun = 0;
      f.parryFrom = x.m.frame + PARRY.lockout;
      setAction(x, isHeld(c, Btn.Shield) ? 'shield' : 'shieldDrop');
    },
  },
};
