import { emit } from '../../sim/events';
import type { HitboxDef, MoveDef } from '../types';
import { isLying, setShape, STANDING, tipFrame } from './tip';

const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({
  id,
  x,
  y,
  radius,
  ...hit,
});

/** Roll's tips: each lasts ROLL_TIP frames from frame ROLL_START, and the block keeps going for ROLL_TIPS of them. */
export const ROLL_START = 3;
export const ROLL_TIP = 10;
export const ROLL_TIPS = 4;

/** Each of Roll's first three landings carries the opponent ahead of the next tip, like the dash attack. */
const rollCarry = [
  box(0, 8, 6, 8, { damage: 3, angle: 25, kbg: 100, bkb: 0, wbkb: 70 }),
  box(1, -4, 6, 7, { damage: 3, angle: 25, kbg: 100, bkb: 0, wbkb: 70 }),
];

/** The last landing launches. */
const rollFinish = [
  box(0, 8, 6, 8, { damage: 5, angle: 40, kbg: 80, bkb: 60 }),
  box(1, -4, 6, 7, { damage: 5, angle: 40, kbg: 80, bkb: 60 }),
];

/** Heavy Switch's quake: low boxes along the floor out to 60 units on both sides, popping grounded opponents up. */
export const QUAKE_REACH = 60;
const quake = [6, 20, 34, 52].flatMap((x, i) =>
  [1, -1].map((side, j) =>
    box(i * 2 + j, x * side, 2, 8, { damage: 6, angle: 80, kbg: 100, bkb: 0, wbkb: 45, direction: 'away' }),
  ),
);

/** Heavy Switch: the frame the block slams down, and the frame an airborne block hangs on while it drops. */
export const QUAKE_FRAME = 14;
const DROP_FRAME = 9;
/** Faster than its fast fall: a block dropping like a pillar onto an X switch. */
const DROP_SPEED = 3.4;

export const specials: Record<string, MoveDef> = {
  /**
   * Roll (side special): keeps tipping forward, four tips of 18 units, three slams of 3% that carry the opponent
   * and a 5% launcher. In the air it holds its height while it rolls, then falls helpless; landing mid-roll keeps
   * it rolling along the ground.
   */
  sideB: {
    kind: 'other',
    faf: ROLL_START + ROLL_TIP * ROLL_TIPS + 16,
    helpless: true,
    continuesOnLanding: true,
    landingLag: 20,
    ledgeFrom: 12,
    hits: Array.from({ length: ROLL_TIPS }, (_, k) => ({
      frames: [ROLL_START + ROLL_TIP * k + 9, ROLL_START + ROLL_TIP * k + 10] as [number, number],
      rehit: true,
      boxes: k === ROLL_TIPS - 1 ? rollFinish : rollCarry,
    })),
    script(x) {
      const { f } = x;
      const t = f.actionFrame - ROLL_START;
      if (t < 0 || t >= ROLL_TIP * ROLL_TIPS) {
        f.vel.x = f.ground ? 0 : f.vel.x * 0.9;
        return;
      }
      tipFrame(x, t % ROLL_TIP, ROLL_TIP);
      if (f.ground) f.vel.x += f.facing * x.s.groundFriction;
      else f.vel.y = Math.max(f.vel.y, -0.3);
    },
  },

  /**
   * Heavy Switch (down special): stands upright and slams down like the block pressing an X switch in Bloxorz. The
   * ground quakes out to 60 units on both sides, popping grounded opponents up (6%). In the air it drops like a
   * pillar first and quakes where it lands.
   */
  downB: {
    kind: 'other',
    faf: 48,
    continuesOnLanding: true,
    hits: [{ frames: [QUAKE_FRAME, QUAKE_FRAME + 2], boxes: quake }],
    script(x) {
      const { f } = x;
      if (f.actionFrame === 4 && isLying(f)) setShape(x, STANDING);
      if (!f.ground) {
        if (f.actionFrame < DROP_FRAME) {
          f.vel.x *= 0.8;
          f.vel.y = 0.4;
          return;
        }
        f.actionFrame = DROP_FRAME;
        f.vel.x = 0;
        f.vel.y = -DROP_SPEED;
        f.fastFalling = true;
        return;
      }
      f.vel.x = 0;
      if (f.actionFrame === QUAKE_FRAME) emit(x.m, { type: 'shake', port: f.port, amplitude: 6, frames: 16 });
    },
  },
};
