import { Btn } from '../../input/types';
import {
  AIR_DODGE_DIRECTIONAL,
  AIR_DODGE_NEUTRAL,
  AIR_DODGE_TECH_WINDOW,
  DOUBLE_JUMP_FRAMES,
  FAST_FALL_FLICK,
} from '../constants';
import { buffered, consume, flickDown, stickX, stickY } from '../control';
import { emit } from '../events';
import type { Ctx } from '../fighter';
import { approach, type Vec } from '../vec';
import { airAttack } from './attack';
import { consumeJump, wantsJump } from './common';
import { techPressed, tumbleLanding } from './knockdown';
import { airMobility } from './mobility';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';
import * as SimMath from '../math';

export function fastFallCheck(x: Ctx): void {
  const { f, s, c } = x;
  if (!f.fastFalling && f.vel.y <= 0 && flickDown(c, FAST_FALL_FLICK)) {
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
  if (airMobility(x)) return true;
  fastFallCheck(x);
  return false;
}

const directional = (x: Ctx) => x.f.dodgeDir.x !== 0 || x.f.dodgeDir.y !== 0;

const { speed: SLIDE_SPEED, distance: SLIDE_DISTANCE, endSpeed: SLIDE_END_SPEED } = AIR_DODGE_DIRECTIONAL;
/** The slide's brake a frame: from SLIDE_SPEED down to SLIDE_END_SPEED over SLIDE_DISTANCE (v² = u² - 2as). */
export const AIR_DODGE_SLIDE_BRAKE =
  (SLIDE_SPEED * SLIDE_SPEED - SLIDE_END_SPEED * SLIDE_END_SPEED) / (2 * SLIDE_DISTANCE);

/**
 * One axis of the slide braked for a frame. Each axis brakes by its share of the dodge direction, as Ultimate's stop
 * energy does, so the slide keeps its angle; an axis already at or below its share of the end speed (a wall stopped
 * it) is left alone.
 */
function brakeSlide(v: number, dir: number): number {
  const floor = Math.abs(dir) * SLIDE_END_SPEED;
  if (Math.abs(v) <= floor) return v;
  return Math.sign(v) * Math.max(Math.abs(v) - Math.abs(dir) * AIR_DODGE_SLIDE_BRAKE, floor);
}

/** The FAF of an air dodge toward `dir`: neutral when it is zero, else by stick angle (AIR_DODGE_DIRECTIONAL). */
export function airDodgeFaf(dir: Vec): number {
  if (dir.x === 0 && dir.y === 0) return AIR_DODGE_NEUTRAL.faf;
  const { x: dx, y: dy } = dir;
  const table = AIR_DODGE_DIRECTIONAL.fafByAngle;
  const t = ((SimMath.atan2(dy, Math.abs(dx)) + Math.PI / 2) / Math.PI) * (table.length - 1);
  const i = Math.min(Math.floor(t), table.length - 2);
  return Math.round(table[i]! + (table[i + 1]! - table[i]!) * (t - i));
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
        emit(x.m, { type: 'jump', port: f.port, kind: 'air' });
        f.vel.y = d.airJumpV[Math.min(Math.max(f.jumpsUsed - 1, 0), d.airJumpV.length - 1)]!;
        f.jumpsUsed++;
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
   * Ultimate air dodge, once per airtime. Neutral keeps momentum; directional slingshots back briefly, then slides
   * in the stick direction without gravity, braking to the slide's end speed. From `gravityFrom` gravity and air
   * friction take over what is left of that speed, and from `driftFrom` the stick drifts the fighter again. It lands
   * with 11-19 frames of lag depending on timing. Out of tumble, the dodge's Shield press is also a tech press:
   * touching down within AIR_DODGE_TECH_WINDOW frames of it techs.
   */
  airDodge: {
    physics: 'air',
    drift: (x) => !directional(x) || x.f.actionFrame >= AIR_DODGE_DIRECTIONAL.driftFrom,
    gravity: (x) => !directional(x) || x.f.actionFrame >= AIR_DODGE_DIRECTIONAL.gravityFrom,
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
        const mag = SimMath.hypot(sx, sy);
        f.dodgeDir = mag >= AIR_DODGE_DIRECTIONAL.stick ? { x: sx / mag, y: sy / mag } : { x: 0, y: 0 };
      }
      if (directional(x)) {
        const dir = f.dodgeDir;
        if (f.actionFrame <= 2) {
          f.vel.x = -dir.x * 0.35;
          f.vel.y = -dir.y * 0.35;
        } else if (f.actionFrame === 3) {
          f.vel.x = dir.x * SLIDE_SPEED;
          f.vel.y = dir.y * SLIDE_SPEED;
        } else if (f.actionFrame < AIR_DODGE_DIRECTIONAL.gravityFrom) {
          f.vel.x = brakeSlide(f.vel.x, dir.x);
          f.vel.y = brakeSlide(f.vel.y, dir.y);
        } else if (f.actionFrame < AIR_DODGE_DIRECTIONAL.driftFrom) {
          // Air friction without the stick, which the dodge ignores until driftFrom.
          f.vel.x = approach(f.vel.x, 0, s.airFriction);
        }
      }
      if (f.actionFrame >= airDodgeFaf(f.dodgeDir)) setAction(x, 'fall');
    },
    land(x) {
      const { f } = x;
      if (techPressed(x, AIR_DODGE_TECH_WINDOW)) return tumbleLanding(x, AIR_DODGE_TECH_WINDOW);
      if (!directional(x) || f.actionFrame >= airDodgeFaf(f.dodgeDir)) {
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
