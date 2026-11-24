import { Btn } from '../../input/types';
import { startMove } from '../../sim/actions/attack';
import { consumeJump, wantsJump } from '../../sim/actions/common';
import { setAction } from '../../sim/actions/registry';
import { isHeld, stickX } from '../../sim/control';
import type { Ctx } from '../../sim/fighter';
import { leaveGround } from '../../sim/movement';
import type { HitboxDef, MoveDef } from '../types';

const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({ id, x, y, radius, ...hit });

/** Charge Roll: frames of wind-up before the rev counts, and the longest rev (then he lets go by himself). */
export const REV_FROM = 8;
export const REV_MAX = 60;

/** The roll each rev length lets go into: from `rev` frames of revving, rolling at `speed` for `frames`. */
export const ROLLS = [
  { move: 'chargeRoll1', rev: 0, damage: 8, speed: 2.3, frames: 30 },
  { move: 'chargeRoll2', rev: 20, damage: 13, speed: 2.8, frames: 40 },
  { move: 'chargeRoll3', rev: 45, damage: 18, speed: 3.3, frames: 50 },
] as const;

/** Mega Bounce: frames spent squashing, then the spring's speed (about 80 units of rise). */
export const BOUNCE_FRAME = 8;
export const BOUNCE_SPEED = 3.55;

/** A connected roll bounces him back off the target, like a ball off a wall, and he can act on the way down. */
function bounceOff(x: Ctx): void {
  const { f } = x;
  if (f.ground) leaveGround(x);
  f.vel.x = -f.facing * 1;
  f.vel.y = 1.8;
  f.fastFalling = false;
  setAction(x, 'fall');
}

function roll({ damage, speed, frames }: (typeof ROLLS)[number]): MoveDef {
  return {
    kind: 'other',
    faf: frames + 16,
    continuesOnLanding: true,
    hits: [
      {
        frames: [2, frames],
        boxes: [box(0, 1, 5.5, 6, { damage, angle: 45, kbg: 70, bkb: 40 + damage, direction: 'forward' })],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.hitVictims.length > 0) return bounceOff(x);
      if (f.ground && f.actionFrame >= 6 && wantsJump(x)) {
        consumeJump(x);
        return setAction(x, 'jumpSquat');
      }
      f.vel.x = f.actionFrame <= frames ? f.facing * speed : f.vel.x * 0.85;
    },
  };
}

/**
 * Red Ball's specials. Neutral special is the video's charge, Sonic spin-charge style: hold Special to rev on the
 * spot, let go (or rev out) to roll into them; the longer the rev, the faster, longer and harder the roll, which
 * bounces off whatever it hits. Jump cancels the roll on the ground. Up special squashes him flat and springs him
 * about 80 units up, ending helpless.
 */
export const specials: Record<string, MoveDef> = {
  neutralB: {
    kind: 'other',
    faf: REV_FROM + REV_MAX + 10,
    hits: [],
    script(x) {
      const { f, c } = x;
      if (f.ground) f.vel.x *= 0.85;
      if (f.actionFrame < REV_FROM) return;
      if (isHeld(c, Btn.Special) && f.charge < REV_MAX) {
        f.charge++;
        return;
      }
      const tier = [...ROLLS].reverse().find((r) => f.charge >= r.rev)!;
      startMove(x, tier.move);
    },
  },
  ...Object.fromEntries(ROLLS.map((r) => [r.move, roll(r)])),
  upB: {
    kind: 'other',
    faf: 46,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 16,
    landingLag: 22,
    hits: [
      {
        frames: [BOUNCE_FRAME, BOUNCE_FRAME + 3],
        boxes: [box(0, 0, 6, 6.5, { damage: 6, angle: 80, kbg: 70, bkb: 60, direction: 'away' })],
      },
    ],
    script({ f, c }) {
      if (f.actionFrame < BOUNCE_FRAME) {
        f.vel.x *= 0.8;
        f.vel.y = Math.max(f.vel.y, 0);
        return;
      }
      if (f.actionFrame === BOUNCE_FRAME) f.vel.y = BOUNCE_SPEED;
      f.vel.x = stickX(c) * 1.1;
    },
  },
};
