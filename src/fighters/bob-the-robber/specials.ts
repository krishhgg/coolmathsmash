import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';

const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({ id, x, y, radius, ...hit });

/**
 * Baton Twirl Rush's carry hits: a flat set knockback whose launch speed matches Bob's rush, so the target is swept
 * along just ahead of him into the bonk at any %. The twirl reaches round his back too.
 */
const twirl = [
  box(0, 6, 7.5, 5, { damage: 1.5, angle: 5, kbg: 100, bkb: 0, wbkb: 65, hitlag: 0.5 }),
  box(1, -3, 7.5, 5, { damage: 1.5, angle: 5, kbg: 100, bkb: 0, wbkb: 65, hitlag: 0.5 }),
];

/** Speed of the rush: about 40 units over frames 6-27, easing off at the end. */
const RUSH_SPEED = 2.2;

/**
 * Baton Twirl Rush (side special): Bob dashes about 40 units forward twirling the baton, five 1.5% hits that carry
 * the target along, then a diagonal bonk (12.5% in all). In the air it only moves him forward, with no stall, so it
 * can't be chained to stay up.
 */
export const sideB: MoveDef = {
  kind: 'other',
  faf: 50,
  continuesOnLanding: true,
  hits: [
    ...[8, 11, 14, 17, 20].map((from) => ({
      frames: [from, from + 1] as [number, number],
      rehit: true,
      boxes: twirl,
    })),
    {
      frames: [25, 27],
      rehit: true,
      boxes: [box(0, 8, 8, 5, { damage: 5, angle: 45, kbg: 110, bkb: 55 })],
    },
  ],
  script({ f }) {
    if (f.actionFrame < 6) {
      f.vel.x *= 0.5;
      return;
    }
    if (f.actionFrame <= 27) {
      f.vel.x = f.facing * RUSH_SPEED * (f.actionFrame <= 22 ? 1 : 1 - (f.actionFrame - 22) / 6);
      return;
    }
    f.vel.x *= 0.7;
  },
};

/** Grappling Hook's zip: units per frame along the rope, from frame ZIP_FROM to ZIP_TO. */
const ZIP_SPEED = 2.8;
const ZIP_FROM = 14;
const ZIP_TO = 30;

/**
 * Grappling Hook (up special): Bob fires a burglar's grapple up and forward (a 5% hit on the hook) and zips after
 * it in a straight line, rising about 55 units. The stick picks the line when the zip starts: 70 degrees by
 * default, flatter held forward, near vertical held back. He can catch a ledge from the moment the zip starts, and
 * ends helpless.
 */
export const upB: MoveDef = {
  kind: 'other',
  faf: 46,
  leavesGround: true,
  helpless: true,
  ledgeFrom: ZIP_FROM,
  landingLag: 22,
  hits: [
    { frames: [10, 11], boxes: [box(0, 5, 15, 4, { damage: 5, angle: 80, kbg: 80, bkb: 45 })] },
    { frames: [12, 13], boxes: [box(0, 9, 24, 4, { damage: 5, angle: 80, kbg: 80, bkb: 45 })] },
  ],
  script({ f, c, s }) {
    if (f.actionFrame < ZIP_FROM) {
      f.vel.x *= 0.85;
      f.vel.y = Math.max(f.vel.y * 0.5, -0.4);
      return;
    }
    if (f.actionFrame === ZIP_FROM) {
      const lean = stickX(c) * f.facing;
      const rad = ((lean > 0.3 ? 55 : lean < -0.3 ? 85 : 70) * Math.PI) / 180;
      f.vel.x = f.facing * ZIP_SPEED * Math.cos(rad);
      f.vel.y = ZIP_SPEED * Math.sin(rad);
      return;
    }
    if (f.actionFrame > ZIP_TO) return;
    const vy = f.vel.y + s.gravity;
    const len = Math.hypot(f.vel.x, vy) || 1;
    const speed = ZIP_SPEED * (f.actionFrame > ZIP_TO - 4 ? 0.6 : 1);
    f.vel.x = (f.vel.x / len) * speed;
    f.vel.y = (vy / len) * speed;
  },
};
