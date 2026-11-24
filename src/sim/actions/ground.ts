import { Btn } from '../../input/types';
import {
  CROUCH_THRESHOLD,
  DASH_THRESHOLD,
  DIRECTION_THRESHOLD,
  RUN_BRAKE_FRAMES,
  RUN_TURN_FRAMES,
} from '../constants';
import { flickX, isHeld, stickX, stickY } from '../control';
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

  /** Initial dash: fixed speed for dashFrames; flicking back restarts it the other way (dash dance). */
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
      f.vel.x = f.facing * s.dashInitialSpeed;
      if (f.actionFrame > s.dashFrames) setAction(x, stickX(c) * f.facing > 0 ? 'run' : 'idle');
    },
  },

  run: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      const { f, s, c } = x;
      if (groundActionable(x)) return;
      const sx = stickX(c) * f.facing;
      if (sx <= -DIRECTION_THRESHOLD) return setAction(x, 'turn');
      if (sx <= 0) return setAction(x, 'runBrake');
      f.vel.x = approach(f.vel.x, f.facing * s.runSpeed, s.runAccelBase + s.runAccelAdd * sx);
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
