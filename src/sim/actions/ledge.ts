import { Btn } from '../../input/types';
import {
  DIRECTION_THRESHOLD,
  LEDGE_ATTACK,
  LEDGE_CATCH_FRAMES,
  LEDGE_CLIMB,
  LEDGE_GETUP_INTANGIBILITY_SCALE,
  LEDGE_HANG_MAX,
  LEDGE_JUMP,
  LEDGE_REGRAB_LOCK,
  LEDGE_ROLL,
} from '../constants';
import { buffered, consume, stickX, stickY } from '../control';
import type { Ctx, FighterState } from '../fighter';
import { floorAt, hangAt, hangPos, restoreAirOptions } from '../movement';
import { startMove } from './attack';
import { consumeJump, wantsJump } from './common';
import { inWindow, setAction, type ActionDef } from './registry';

export function dropLedge(x: Ctx): void {
  const { f, stage } = x;
  const L = stage.geo.ledges[f.ledge]!;
  f.ledge = -1;
  f.intangible = 0;
  f.ledgeLock = LEDGE_REGRAB_LOCK;
  f.pos.x += L.side * 0.5;
  f.vel.x = f.vel.y = 0;
  f.ground = null;
  f.airFrames = 0;
  f.jumpsUsed = 1;
  setAction(x, 'fall');
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Last intangible frame of a getup, shrunk by the regrabs made since the fighter last touched ground. */
function getupIntangibleEnd(f: FighterState, end: number): number {
  return Math.floor(end * (LEDGE_GETUP_INTANGIBILITY_SCALE[Math.max(0, f.ledgeGrabs - 1)] ?? 0));
}

/** Climb, roll and attack getups: move from the hang position onto the stage, `distance` past the corner. */
function getup(
  spec: { faf: number; intangible: [number, number]; moveEnd: number },
  distance: (x: Ctx) => number,
): ActionDef {
  return {
    physics: 'none',
    intangible: (f) =>
      inWindow(f.actionFrame, [spec.intangible[0], getupIntangibleEnd(f, spec.intangible[1])]),
    update(x) {
      const { f, stage } = x;
      if (f.actionFrame === 1) f.intangible = 0;
      if (f.ledge >= 0) {
        const L = stage.geo.ledges[f.ledge]!;
        const from = hangPos(x);
        const to = { x: L.x - L.side * distance(x), y: L.y };
        const t = smooth(Math.min(1, f.actionFrame / spec.moveEnd));
        f.pos.x = from.x + (to.x - from.x) * t;
        f.pos.y = from.y + (to.y - from.y) * Math.min(1, t * 1.6);
        if (f.actionFrame >= spec.moveEnd) {
          f.pos.x = to.x;
          f.pos.y = to.y;
          f.ground = floorAt(stage, to.x, to.y);
          f.ledge = -1;
        }
      }
      if (f.actionFrame >= spec.faf) {
        restoreAirOptions(f);
        setAction(x, 'idle');
      }
    },
  };
}

export const LEDGE: Record<string, ActionDef> = {
  ledgeCatch: {
    physics: 'none',
    update(x) {
      hangAt(x);
      if (x.f.actionFrame >= LEDGE_CATCH_FRAMES) setAction(x, 'ledgeHang');
    },
  },

  /** Hanging: jump, attack, shield (roll), toward/up (climb) or away/down (drop). Lets go after 5 seconds. */
  ledgeHang: {
    physics: 'none',
    update(x) {
      const { f, c } = x;
      hangAt(x);
      if (f.actionFrame > LEDGE_HANG_MAX) return dropLedge(x);
      if (wantsJump(x)) {
        consumeJump(x);
        return setAction(x, 'ledgeJump');
      }
      if (buffered(c, Btn.Attack) || buffered(c, Btn.Special)) {
        consume(c, Btn.Attack);
        consume(c, Btn.Special);
        startMove(x, 'ledgeAttack', 'ledgeAttack');
        return;
      }
      if (buffered(c, Btn.Shield)) {
        consume(c, Btn.Shield);
        return setAction(x, 'ledgeRoll');
      }
      const toward = stickX(c) * f.facing;
      const up = stickY(c);
      if (toward >= DIRECTION_THRESHOLD || up >= DIRECTION_THRESHOLD) return setAction(x, 'ledgeClimb');
      if (toward <= -DIRECTION_THRESHOLD || up <= -DIRECTION_THRESHOLD) dropLedge(x);
    },
  },

  ledgeClimb: getup(LEDGE_CLIMB, (x) => x.s.width / 2 + 2),
  ledgeRoll: getup(LEDGE_ROLL, () => LEDGE_ROLL.distance),
  ledgeAttack: getup(LEDGE_ATTACK, (x) => x.s.width / 2 + 2),

  /**
   * Rise over the corner, then a jump that keeps the double jump. The jump starts after the rise, but the fighter
   * stays in this action, drifting and without its air options, until LEDGE_JUMP.faf (Ultimate: 14 frames total).
   */
  ledgeJump: {
    physics: 'air',
    drift: (x) => x.f.actionFrame > LEDGE_JUMP.rise,
    gravity: (x) => x.f.actionFrame > LEDGE_JUMP.rise,
    intangible: (f) =>
      inWindow(f.actionFrame, [LEDGE_JUMP.intangible[0], getupIntangibleEnd(f, LEDGE_JUMP.intangible[1])]),
    update(x) {
      const { f, d, s, stage } = x;
      if (f.actionFrame === 1) f.intangible = 0;
      if (f.ledge >= 0) {
        const L = stage.geo.ledges[f.ledge]!;
        const from = hangPos(x);
        const to = { x: L.x - L.side * (s.width / 2), y: L.y + 1 };
        const t = smooth(Math.min(1, f.actionFrame / LEDGE_JUMP.rise));
        f.pos.x = from.x + (to.x - from.x) * t;
        f.pos.y = from.y + (to.y - from.y) * t;
        if (f.actionFrame > LEDGE_JUMP.rise) {
          f.ledge = -1;
          f.vel.x = -L.side * LEDGE_JUMP.hSpeed;
          f.vel.y = d.ledgeJumpV;
          f.ground = null;
          f.airFrames = 0;
          f.jumpsUsed = 1;
        }
      }
      if (f.actionFrame >= LEDGE_JUMP.faf) {
        setAction(x, 'jump');
        // The jump began after the rise: keep counting from there, so the jump clip carries on unbroken.
        f.actionFrame = LEDGE_JUMP.faf - LEDGE_JUMP.rise;
      }
    },
  },
};
