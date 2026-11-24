import { Btn } from '../../input/types';
import { CROUCH_THRESHOLD, DASH_THRESHOLD } from '../constants';
import {
  buffered,
  consume,
  consumeTapJump,
  flickDown,
  flickX,
  isHeld,
  stickX,
  stickY,
  tapJumpReady,
} from '../control';
import type { Ctx } from '../fighter';
import { leaveGround } from '../movement';
import { setAction } from './registry';

export function wantsJump(x: Ctx): boolean {
  return buffered(x.c, Btn.Jump) || (x.p.tapJump && tapJumpReady(x.c));
}

/** Use up whichever input asked for the jump, remembering whether it was the stick (tap jump). */
export function consumeJump(x: Ctx): void {
  if (buffered(x.c, Btn.Jump)) {
    consume(x.c, Btn.Jump);
    x.f.jumpByStick = false;
  } else {
    consumeTapJump(x.c);
    x.f.jumpByStick = true;
  }
}

export function onPlatform(x: Ctx): boolean {
  return x.f.ground?.kind === 'platform';
}

export function dropThroughPlatform(x: Ctx): void {
  const { f } = x;
  f.dropPlatform = f.ground!.index;
  leaveGround(x);
  f.pos.y -= 0.01;
  setAction(x, 'fall');
}

/**
 * Options every actionable grounded state shares, in Smash's priority order. Returns true when it switched
 * action. Attacks, specials and grabs are added here by the combat layer.
 */
export function groundActionable(x: Ctx): boolean {
  const { f, c } = x;
  if (wantsJump(x)) {
    consumeJump(x);
    setAction(x, 'jumpSquat');
    return true;
  }
  if (buffered(c, Btn.Shield) || isHeld(c, Btn.Shield)) {
    consume(c, Btn.Shield);
    setAction(x, 'shield');
    return true;
  }
  if (onPlatform(x) && flickDown(c)) {
    dropThroughPlatform(x);
    return true;
  }
  if (f.action !== 'crouch' && stickY(c) <= -CROUCH_THRESHOLD) {
    setAction(x, 'crouch');
    return true;
  }
  return false;
}

/** From standing: dash on a flick, walk on a tilt (turning to face the stick). */
export function startMovement(x: Ctx): boolean {
  const { f, c } = x;
  const sx = stickX(c);
  if (sx === 0) return false;
  const fl = flickX(c, DASH_THRESHOLD);
  if (fl !== 0) {
    f.facing = fl as 1 | -1;
    setAction(x, 'dash');
    return true;
  }
  f.facing = Math.sign(sx) as 1 | -1;
  setAction(x, 'walk');
  return true;
}
