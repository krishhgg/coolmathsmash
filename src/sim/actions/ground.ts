import { Btn } from '../../input/types';
import {
  CROUCH_THRESHOLD,
  DASH_SPEED_KEEP_FRAMES,
  DASH_THRESHOLD,
  DIRECTION_THRESHOLD,
  RUN_BRAKE_FRAMES,
  RUN_TURN_FRAMES,
} from '../constants';
import { flickX, isHeld, stickX, stickY } from '../control';
import { emit } from '../events';
import type { Ctx } from '../fighter';
import { approach, clamp } from '../vec';
import { jumpSquatAttack } from './attack';
import { groundActionable, startMovement } from './common';
import { setAction, type ActionDef } from './registry';

function takeOff(x: Ctx, v: number): void {
  const { f, s, c } = x;
  const max = s.airSpeed * 1.2;
  f.vel.x = clamp(f.vel.x * 0.85 + stickX(c) * 0.3, -max, max);
  f.vel.y = v;
  f.ground = null;
  f.airFrames = 0;
  f.jumpsUsed = 1;
  f.fastFalling = false;
  setAction(x, 'jump');
}

/**
 * Run physics for a stick held `sx` forward, as Ultimate's control energy moves the Dash and Run statuses: below
 * run speed it accelerates by run accel. Above it, as when an initial dash outpaces the run, it brakes back down at
 * traction (the energy's brake is ground_brake x run_brake_brake_mul, and that multiplier is 1 in common params).
 */
function runToward(x: Ctx, sx: number): void {
  const { f, s } = x;
  const over = f.vel.x * f.facing > s.runSpeed;
  f.vel.x = approach(
    f.vel.x,
    f.facing * s.runSpeed,
    over ? s.groundFriction : s.runAccelBase + s.runAccelAdd * sx,
  );
}

export const GROUND: Record<string, ActionDef> = {
  idle: {
    physics: 'ground',
    update(x) {
      if (groundActionable(x)) return;
      startMovement(x);
    },
  },

  walk: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, s, c } = x;
      if (groundActionable(x)) return;
      const sx = stickX(c);
      if (sx === 0) return setAction(x, 'idle');
      const fl = flickX(c, DASH_THRESHOLD);
      if (fl !== 0) {
        f.facing = fl as 1 | -1;
        return setAction(x, 'dash');
      }
      f.facing = Math.sign(sx) as 1 | -1;
      const target = sx * s.walkSpeed;
      const speedingUp = Math.abs(f.vel.x) <= Math.abs(target) || Math.sign(f.vel.x) !== Math.sign(target);
      f.vel.x = approach(
        f.vel.x,
        target,
        speedingUp ? s.walkAccelBase + s.walkAccelAdd * Math.abs(sx) : s.groundFriction,
      );
    },
  },

  /**
   * Initial dash, dashFrames long: dash speed for its first DASH_SPEED_KEEP_FRAMES, then run physics, so a stick held
   * forward eases it to run speed and a neutral or backward stick slides it out at traction. Flicking back restarts
   * it the other way (dash dance).
   */
  dash: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, s, c } = x;
      if (groundActionable(x)) return;
      const fl = flickX(c, DASH_THRESHOLD);
      if (fl === -f.facing) {
        f.facing = fl as 1 | -1;
        return setAction(x, 'dash');
      }
      const sx = stickX(c) * f.facing;
      if (f.actionFrame > s.dashFrames) return setAction(x, sx > 0 ? 'run' : 'idle');
      if (f.actionFrame <= DASH_SPEED_KEEP_FRAMES) f.vel.x = f.facing * s.dashInitialSpeed;
      else if (sx > 0) runToward(x, sx);
      else f.vel.x = approach(f.vel.x, 0, s.groundFriction);
    },
  },

  run: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, c } = x;
      if (groundActionable(x)) return;
      const sx = stickX(c) * f.facing;
      if (sx <= -DIRECTION_THRESHOLD) return setAction(x, 'turn');
      if (sx <= 0) return setAction(x, 'runBrake');
      runToward(x, sx);
    },
  },

  runBrake: {
    physics: 'ground',
    edge: 'fall',
    update(x) {
      const { f, c } = x;
      if (groundActionable(x)) return;
      const sx = stickX(c) * f.facing;
      if (f.actionFrame > 1 && sx >= DASH_THRESHOLD) return setAction(x, 'run');
      if (sx <= -DASH_THRESHOLD) return setAction(x, 'turn');
      if (f.actionFrame >= RUN_BRAKE_FRAMES) setAction(x, 'idle');
    },
  },

  /** Run turnaround: face the other way at once and skid out the old momentum. */
  turn: {
    physics: 'ground',
    edge: 'fall',
    update(x) {
      const { f, c } = x;
      if (f.actionFrame === 1) f.facing = -f.facing as 1 | -1;
      if (groundActionable(x)) return;
      if (f.actionFrame >= RUN_TURN_FRAMES) setAction(x, stickX(c) * f.facing > 0 ? 'run' : 'idle');
    },
  },

  crouch: {
    physics: 'ground',
    update(x) {
      if (groundActionable(x)) return;
      if (stickY(x.c) > -CROUCH_THRESHOLD && !startMovement(x)) setAction(x, 'idle');
    },
  },

  /** Grounded for jumpSquat frames, then a full hop if jump (or the tap-jump stick) is still held, else a short hop. */
  jumpSquat: {
    physics: 'ground',
    friction: false,
    update(x) {
      const { f, s, d, c } = x;
      if (jumpSquatAttack(x)) return;
      if (f.actionFrame <= s.jumpSquat) return;
      const full = f.jumpByStick ? stickY(c) >= 0.5 : isHeld(c, Btn.Jump);
      emit(x.m, { type: 'jump', port: f.port, kind: full ? 'full' : 'short' });
      takeOff(x, full ? d.fullHopV : d.shortHopV);
    },
  },

  land: {
    physics: 'ground',
    update(x) {
      if (x.f.actionFrame > x.f.landingLag) setAction(x, 'idle');
    },
  },
};
