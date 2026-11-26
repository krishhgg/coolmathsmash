import { stickX } from '../../sim/control';
import type { Ctx, FighterState } from '../../sim/fighter';
import { approach } from '../../sim/vec';
import type { HitboxDef, MoveDef } from '../types';
import { STRAFE_DASH } from './timing';

const { dash: DASH, active: ACTIVE, end: END } = STRAFE_DASH;

/**
 * Fox Illusion's movement parameters (SmashWiki, Fox (SSBU)/Side_special, "Parameters"). Startup multiplies her
 * speed by 0.67, and in the air it then bleeds off 0.05 a frame (the wiki's "acceleration on startup") with no
 * gravity for 13 frames and 0.017 after. The dash ends at 2.5 a frame on the ground and 2.3 in the air, slowing 0.15
 * and 0.07 a frame, or 0.5 when it has hit a shield. The air ending floats for 5 frames, then falls at 0.08, and
 * drifts at 0.7x her air speed with 0.9x her air acceleration.
 */
export const FOX_ILLUSION = {
  startupSpeed: 0.67,
  startupSlowdown: 0.05,
  startupFloat: 13,
  startupGravity: 0.017,
  endSpeed: { ground: 2.5, air: 2.3 },
  endFriction: { ground: 0.15, air: 0.07 },
  shieldSpeed: 0.5,
  endFloat: 5,
  endGravity: 0.08,
  airDriftSpeed: 0.7,
  airDriftAccel: 0.9,
};

/** The burst's speed and the afterimage trail's boxes, shared with the art (timing.ts). */
export const { speed: DASH_SPEED, trail: TRAIL } = STRAFE_DASH;

/** The trail's boxes with one hit's numbers: Fox's radius 4, 4 units up. */
const trail = (hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>): HitboxDef[] =>
  TRAIL.map((x, id) => ({ id, x, y: 4, radius: 4, ...hit }));

/** Whether the trail has hit a shield that is still reeling from it: Fox Illusion stops dead on shields. */
const blocked = ({ m, f }: Ctx) => f.hitVictims.some((port) => m.fighters[port]?.action === 'shieldStun');

/**
 * Sets this frame's travel to `speed` along her facing. On the ground groundMove takes her traction off first, so
 * it is added back.
 */
function travel({ f, s }: Ctx, speed: number): void {
  f.vel.x = f.facing * (f.ground && speed > 0 ? speed + s.groundFriction : speed);
}

/**
 * Sets her vertical speed while the move owns it. Holding the fast-fall flag keeps the fast-fall check from taking
 * over, as Box Drop does; the ending lets go of it.
 */
function hold(f: FighterState, vy: number): void {
  f.vel.y = vy;
  f.fastFalling = true;
}

/**
 * Starts the dash's ending early when the trail has hit a shield (Fox Illusion "skips to frame 29 on the next
 * frame if the hit happened beforehand", SmashWiki). True while it has: her speed is then held to 0.5.
 */
function stopOnShield(x: Ctx): boolean {
  if (!blocked(x)) return false;
  if (x.f.actionFrame < END) x.f.actionFrame = END;
  return true;
}

/** Strafe Dash on the floor: her traction slows her through the coil, then the burst and the slide out. */
function groundDash(x: Ctx): void {
  const { f } = x;
  if (f.actionFrame === 1) f.vel.x *= FOX_ILLUSION.startupSpeed;
  if (f.actionFrame < DASH[0]) return;
  const shield = stopOnShield(x);
  if (f.actionFrame <= DASH[1]) return travel(x, DASH_SPEED);
  const speed =
    f.actionFrame === END
      ? FOX_ILLUSION.endSpeed.ground
      : Math.max(0, Math.abs(f.vel.x) - FOX_ILLUSION.endFriction.ground);
  travel(x, shield ? Math.min(speed, FOX_ILLUSION.shieldSpeed) : speed);
}

/** The air ending's drift: towards 0.7x her air speed at 0.9x her air acceleration, else slowing 0.07 a frame. */
function endingDrift({ f, s, c }: Ctx): void {
  const stick = stickX(c);
  const max = s.airSpeed * FOX_ILLUSION.airDriftSpeed;
  if (stick === 0 || (Math.abs(f.vel.x) > max && Math.sign(f.vel.x) === Math.sign(stick))) {
    const target = stick === 0 ? 0 : Math.sign(f.vel.x) * max;
    f.vel.x = approach(f.vel.x, target, FOX_ILLUSION.endFriction.air);
    return;
  }
  const accel = FOX_ILLUSION.airDriftAccel * (s.airAccelBase + s.airAccelAdd * Math.abs(stick));
  f.vel.x = approach(f.vel.x, stick * max, accel);
}

/** Strafe Dash in the air: a near stall through the coil, a level burst, then a short float and a drifting fall. */
function airDash(x: Ctx): void {
  const { f, s } = x;
  if (f.actionFrame === 1) f.vel.x *= FOX_ILLUSION.startupSpeed;
  else if (f.actionFrame < DASH[0]) f.vel.x = approach(f.vel.x, 0, FOX_ILLUSION.startupSlowdown);
  if (f.actionFrame < DASH[0]) {
    const falling = f.actionFrame - FOX_ILLUSION.startupFloat;
    return hold(f, falling > 0 ? -FOX_ILLUSION.startupGravity * falling : 0);
  }
  const shield = stopOnShield(x);
  if (f.actionFrame <= DASH[1]) {
    f.vel.x = f.facing * DASH_SPEED;
    return hold(f, 0);
  }
  if (f.actionFrame === END) f.vel.x = f.facing * FOX_ILLUSION.endSpeed.air;
  else endingDrift(x);
  if (shield) f.vel.x = Math.sign(f.vel.x) * Math.min(Math.abs(f.vel.x), FOX_ILLUSION.shieldSpeed);
  const falling = f.actionFrame - END - FOX_ILLUSION.endFloat + 1;
  if (falling <= 0) return hold(f, 0);
  if (falling === 1) f.fastFalling = false;
  if (!f.fastFalling) f.vel.y = Math.max(-s.fallSpeed, -FOX_ILLUSION.endGravity * falling);
}

/**
 * Strafe Dash, Runner's side special: Fox Illusion in Ultimate. In Run she strafes from side to side of the tunnel
 * faster than the eye; here she coils, bursts forward and leaves a string of afterimages that hit anyone she passed,
 * then slides out. Special again doesn't stop it early: Melee and Brawl allowed that, Smash 4 and Ultimate don't
 * (SmashWiki, Fox Illusion). In the air it ends in a normal fall, not helpless, as Fox Illusion "doesn't leave him
 * helpless" (SmashWiki, Fox (SSBU)), and it grabs ledges from frame 25.
 *
 * Fox's numbers (SmashWiki, Fox (SSBU)/Side_special hitbox table and timing; ultimateframedata.com/fox): the trail is
 * out on frames 25-29, radius 4 at 4 up; 8%, 85°, BKB 35, KBG 110 on the ground and 5%, 60°, BKB 15, KBG 148 in
 * the air; FAF 56 on the ground and 73 in the air, with 16 frames of landing lag. The burst runs on frames 24-28,
 * where Fox stops jostling and his afterimages start.
 */
export const strafeDashMoves: Record<string, MoveDef> = {
  sideB: {
    kind: 'other',
    faf: STRAFE_DASH.groundFaf,
    air: 'sideBAir',
    hits: [{ frames: ACTIVE, boxes: trail({ damage: 8, angle: 85, bkb: 35, kbg: 110 }) }],
    script: groundDash,
  },
  sideBAir: {
    kind: 'other',
    faf: STRAFE_DASH.airFaf,
    landingLag: STRAFE_DASH.landingLag,
    ledgeFrom: ACTIVE[0],
    drift: false,
    hits: [{ frames: ACTIVE, boxes: trail({ damage: 5, angle: 60, bkb: 15, kbg: 148 }) }],
    script: airDash,
  },
};
