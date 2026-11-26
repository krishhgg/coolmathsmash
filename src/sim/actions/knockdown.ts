import { Btn } from '../../input/types';
import {
  DOWN_AUTO_GETUP,
  DOWN_BOUNCE_FRAMES,
  GETUP_ROLL,
  GETUP_STAND,
  GETUP_STICK,
  TECH_IN_PLACE,
  TECH_MAX_SPEED,
  TECH_ROLL,
  TECH_WINDOW,
} from '../constants';
import { buffered, consume, stickX, stickY } from '../control';
import type { Ctx } from '../fighter';
import { startMove } from './attack';
import { rollWeights } from './defense';
import { enterAction, inWindow, setAction, type ActionDef } from './registry';

/** Shield was pressed in tumble within the last `window` frames (see the tumble action). */
export function techPressed(x: Ctx, window = TECH_WINDOW): boolean {
  return x.m.frame - x.f.techPressAt < window;
}

/**
 * Touching down from tumble: a tech (a tech roll with the stick held sideways) if Shield was pressed in time and
 * the landing is slow enough, otherwise a missed tech.
 */
export function tumbleLanding(x: Ctx, window = TECH_WINDOW): void {
  const { f, c } = x;
  const teched = techPressed(x, window) && Math.hypot(f.kb.x, f.kb.y) <= TECH_MAX_SPEED;
  f.hitstun = 0;
  f.kb = { x: 0, y: 0 };
  f.vel.x = 0;
  if (!teched) return enterAction(x, 'downBound', 0);
  const dir = Math.sign(stickX(c));
  f.dodgeDir = { x: dir, y: 0 };
  enterAction(x, dir === 0 ? 'techInPlace' : 'techRoll', 0);
}

/**
 * A fixed-length grounded action that slides `rollDistance` over `spec.move`. It is intangible on
 * `spec.intangible`, and on the touchdown tick (frame 0) when a tech enters it by landing.
 */
function timed(spec: { faf: number; intangible: [number, number]; move?: [number, number] }): ActionDef {
  const weights = spec.move ? rollWeights(spec.move) : [];
  return {
    physics: 'ground',
    friction: false,
    intangible: (f) => f.actionFrame === 0 || inWindow(f.actionFrame, spec.intangible),
    update(x) {
      const { f, s } = x;
      const k = spec.move ? f.actionFrame - spec.move[0] : -1;
      f.vel.x = k >= 0 && k < weights.length ? f.dodgeDir.x * s.rollDistance * weights[k]! : 0;
      if (f.actionFrame >= spec.faf) setAction(x, 'idle');
    },
  };
}

/** Getup from lying down: Attack or Special attacks, the stick sideways rolls, up, Jump or Shield stands. */
function getup(x: Ctx): boolean {
  const { f, c } = x;
  if (buffered(c, Btn.Attack) || buffered(c, Btn.Special)) {
    consume(c, buffered(c, Btn.Attack) ? Btn.Attack : Btn.Special);
    if (startMove(x, 'getupAttack')) return true;
    setAction(x, 'getupStand');
    return true;
  }
  const sx = stickX(c);
  if (Math.abs(sx) >= GETUP_STICK) {
    f.dodgeDir = { x: Math.sign(sx), y: 0 };
    setAction(x, 'getupRoll');
    return true;
  }
  for (const bit of [Btn.Jump, Btn.Shield]) {
    if (!buffered(c, bit)) continue;
    consume(c, bit);
    setAction(x, 'getupStand');
    return true;
  }
  if (stickY(c) >= GETUP_STICK) {
    setAction(x, 'getupStand');
    return true;
  }
  return false;
}

export const KNOCKDOWN: Record<string, ActionDef> = {
  techInPlace: timed(TECH_IN_PLACE),
  techRoll: timed(TECH_ROLL),

  /** Missed tech: bouncing off the floor, vulnerable, no control. */
  downBound: {
    physics: 'ground',
    update(x) {
      if (x.f.actionFrame >= DOWN_BOUNCE_FRAMES) setAction(x, 'down');
    },
  },

  /** Lying down after a missed tech until a getup is picked, or automatically after DOWN_AUTO_GETUP frames. */
  down: {
    physics: 'ground',
    update(x) {
      if (getup(x)) return;
      if (x.f.actionFrame >= DOWN_AUTO_GETUP) setAction(x, 'getupStand');
    },
  },

  getupStand: timed(GETUP_STAND),
  getupRoll: timed(GETUP_ROLL),
};
