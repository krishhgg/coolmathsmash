import { Btn } from '../../input/types';
import {
  AIR_DODGE_DIRECTIONAL,
  AIR_DODGE_NEUTRAL,
  AIR_DODGE_TECH_WINDOW,
  DIRECTION_THRESHOLD,
  DOUBLE_JUMP_FRAMES,
} from '../constants';
import { buffered, consume, flickDown, stickX, stickY } from '../control';
import type { Ctx } from '../fighter';
import { airAttack } from './attack';
import { consumeJump, wantsJump } from './common';
import { techPressed, tumbleLanding } from './knockdown';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

export function fastFallCheck(x: Ctx): void {
  const { f, s, c } = x;
  if (!f.fastFalling && f.vel.y <= 0 && flickDown(c)) {
    f.fastFalling = true;
    f.vel.y = -s.fastFallSpeed;
  }
}

/** Options every actionable airborne state shares. An attack wins over a tap jump flicked with it (up + A is uair). */
export function airActionable(x: Ctx): boolean {
  const { f, s, c } = x;
  if (airAttack(x)) return true;
  if (f.jumpsUsed < s.jumps && wantsJump(x)) {
    consumeJump(x);
    setAction(x, 'doubleJump');
    return true;
  }
  if (!f.airDodgeUsed && buffered(c, Btn.Shield)) {
    consume(c, Btn.Shield);
    setAction(x, 'airDodge');
    return true;
  }
  fastFallCheck(x);
  return false;
}

const directional = (x: Ctx) => x.f.dodgeDir.x !== 0 || x.f.dodgeDir.y !== 0;

function airDodgeFaf(x: Ctx): number {
  if (!directional(x)) return AIR_DODGE_NEUTRAL.faf;
  const y = x.f.dodgeDir.y;
  return AIR_DODGE_DIRECTIONAL.faf + Math.round(y > 0 ? 22 * y : 10 * y);
}

export const AIR: Record<string, ActionDef> = {
  jump: {
    physics: 'air',
    ledge: true,
    update(x) {
      if (airActionable(x)) return;
      if (x.f.vel.y <= 0) setAction(x, 'fall');
    },
  },

  doubleJump: {
    physics: 'air',
    ledge: true,
    update(x) {
      const { f, s, d, c } = x;
      if (f.actionFrame === 1) {
        f.jumpsUsed++;
        f.vel.y = d.doubleJumpV;
        f.vel.x = stickX(c) * s.airSpeed;
        f.fastFalling = false;
        return;
      }
      if (airActionable(x)) return;
      if (f.actionFrame >= DOUBLE_JUMP_FRAMES && f.vel.y <= 0) setAction(x, 'fall');
    },
  },

  fall: {
    physics: 'air',
    ledge: true,
    update(x) {
      airActionable(x);
    },
  },

  /**
   * Special fall after recovery moves: slow drift, no actions until landing or a ledge. The move set the landing
   * lag when it entered helpless.
   */
  helpless: {
    physics: 'air',
    drift: 'helpless',
    ledge: true,
    update() {},
    land(x) {
      enterAction(x, 'land', 0);
    },
  },

  /**
   * Ultimate air dodge, once per airtime. Neutral keeps momentum; directional slingshots back briefly, then
   * travels in the stick direction without gravity, and lands with 11-19 frames of lag depending on timing.
   * Out of tumble, the dodge's Shield press is also a tech press: touching down within AIR_DODGE_TECH_WINDOW
   * frames of it techs.
   */
  airDodge: {
    physics: 'air',
    drift: (x) => !directional(x),
    gravity: (x) => !directional(x) || x.f.actionFrame > AIR_DODGE_DIRECTIONAL.moveEnd,
    ledge: (x) => (directional(x) ? AIR_DODGE_DIRECTIONAL.ledgeFrom : false),
    intangible: (f) =>
      inWindow(
        f.actionFrame,
        f.dodgeDir.x || f.dodgeDir.y ? AIR_DODGE_DIRECTIONAL.intangible : AIR_DODGE_NEUTRAL.intangible,
      ),
    update(x) {
      const { f, s, c } = x;
      if (f.actionFrame === 1) {
        f.airDodgeUsed = true;
        f.fastFalling = false;
        const sx = stickX(c);
        const sy = stickY(c);
        const mag = Math.hypot(sx, sy);
        f.dodgeDir = mag >= DIRECTION_THRESHOLD ? { x: sx / mag, y: sy / mag } : { x: 0, y: 0 };
      }
      if (directional(x)) {
        const dir = f.dodgeDir;
        if (f.actionFrame <= 2) {
          f.vel.x = -dir.x * 0.35;
          f.vel.y = -dir.y * 0.35;
        } else if (f.actionFrame === 3) {
          f.vel.x = dir.x * s.airDodgeSpeed;
          f.vel.y = dir.y * s.airDodgeSpeed;
        } else if (f.actionFrame <= AIR_DODGE_DIRECTIONAL.moveEnd) {
          f.vel.x *= AIR_DODGE_DIRECTIONAL.decay;
          f.vel.y *= AIR_DODGE_DIRECTIONAL.decay;
        }
      }
      if (f.actionFrame >= airDodgeFaf(x)) setAction(x, 'fall');
    },
    land(x) {
      const { f } = x;
      if (techPressed(x, AIR_DODGE_TECH_WINDOW)) return tumbleLanding(x, AIR_DODGE_TECH_WINDOW);
      if (!directional(x) || f.actionFrame >= airDodgeFaf(x)) {
        f.landingLag = AIR_DODGE_NEUTRAL.landingLag;
      } else {
        const t = Math.min(1, Math.max(0, (f.actionFrame - 3) / 30));
        const { landingLagEarly: early, landingLagLate: late } = AIR_DODGE_DIRECTIONAL;
        f.landingLag = Math.round(early + (late - early) * t);
      }
      enterAction(x, 'land', 0);
    },
  },
};
