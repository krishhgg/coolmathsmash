import { Btn } from '../../input/types';
import { HITSTUN_CANCEL_AIR_DODGE } from '../constants';
import { buffered, consume, isHeld } from '../control';
import type { Ctx } from '../fighter';
import { launchTimeScale } from '../movement';
import { airActionable } from './air';
import { breakShield } from './defense';
import { enterAction, setAction, type ActionDef } from './registry';

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
   * Launched into tumble. No control during hitstun except Ultimate's hitstun-cancel air dodge once the launch
   * has slowed; afterwards the fighter drifts and acts like falling until it lands.
   */
  tumble: {
    physics: 'air',
    drift: (x) => x.f.hitstun <= 0,
    ledge: (x) => x.f.hitstun <= 0,
    update(x) {
      const { f, c } = x;
      if (f.hitstun > 0 && !hitstunOver(x)) {
        const slow = Math.hypot(f.kb.x, f.kb.y) <= HITSTUN_CANCEL_AIR_DODGE.maxSpeed;
        if (
          f.actionFrame >= HITSTUN_CANCEL_AIR_DODGE.from &&
          slow &&
          !f.airDodgeUsed &&
          buffered(c, Btn.Shield)
        ) {
          consume(c, Btn.Shield);
          setAction(x, 'airDodge');
        }
        return;
      }
      airActionable(x);
    },
    land(x) {
      x.f.landingLag = x.s.hardLandingLag;
      enterAction(x, 'land', 0);
    },
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
      setAction(x, isHeld(c, Btn.Shield) ? 'shield' : 'shieldDrop');
    },
  },
};
