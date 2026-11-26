/**
 * Super Smash Bros. Ultimate (v13.0.1) combat formulas: knockback, hitstun, launch, DI, hitlag, shieldstun and friends.
 * Every number comes from the research reference (docs/physics-reference.md, src/sim/reference/physics-constants.json),
 * and formulas.test.ts checks each function against that file's test vectors.
 * Angles are in degrees, measured from the attacker's facing direction (0 = away from the attacker, 90 = up).
 */

import * as SimMath from '../math';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const RAD = Math.PI / 180;

/** Stale-move negation: the reduction for each of the 9 queue slots (slot 1 = most recent hit). */
export const STALE_FACTORS = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345, 0.025];
export const STALE_QUEUE_LENGTH = STALE_FACTORS.length;
export const FRESHNESS_BONUS = 1.05;

/** Damage multiplier for a move occupying `slots` (1-based) of the stale queue; 1.05 when it is not in the queue. */
export function staleMultiplier(slots: readonly number[]): number {
  if (slots.length === 0) return FRESHNESS_BONUS;
  return 1 - slots.reduce((sum, slot) => sum + (STALE_FACTORS[slot - 1] ?? 0), 0);
}

/** Rage: the attacker's % scales knockback from 1.0 (35% or less) to 1.1 (150% or more). */
export function rageMultiplier(attackerPercent: number): number {
  return 1 + ((clamp(attackerPercent, 35, 150) - 35) / 115) * 0.1;
}

export const KNOCKBACK_MAX = 2500;
export const CROUCH_CANCEL_KB = 0.85;
/**
 * In a match started with two players and items off, damage taken is x1.2 on the meter; knockback, hitstun and
 * hitlag ignore it (SmashWiki: 1v1 multiplier). addDamage (hits.ts) applies it.
 */
export const ONE_V_ONE_DAMAGE = 1.2;

export interface KnockbackParams {
  /** Target's % before the hit. */
  percent: number;
  /** The hitbox's base damage. */
  damage: number;
  kbg: number;
  bkb: number;
  /** Set (weight-based) knockback: replaces the % terms and ignores staleness and rage. */
  wbkb?: number;
  weight: number;
  /** Stale-move multiplier (1 = staleness off). */
  stale?: number;
  /** Rage multiplier from the attacker's %. */
  rage?: number;
  crouch?: boolean;
}

/** kb = ((((p/10 + p*d/20) * 200/(w+100) * 1.4) + 18) * kbg/100 + bkb) * r */
export function knockback(k: KnockbackParams): number {
  const crouch = k.crouch ? CROUCH_CANCEL_KB : 1;
  const weightTerm = 200 / (k.weight + 100);
  if (k.wbkb !== undefined && k.wbkb > 0) {
    const kb = ((1 + k.wbkb / 2) * weightTerm * 1.4 + 18) * (k.kbg / 100) + k.bkb;
    return Math.min(kb * crouch, KNOCKBACK_MAX);
  }
  const s = k.stale ?? 1;
  const p = k.percent + k.damage * s;
  const d = k.damage * (1 - (1 - s) * 0.3);
  const kb = ((p / 10 + (p * d) / 20) * weightTerm * 1.4 + 18) * (k.kbg / 100) + k.bkb;
  return Math.min(kb * (k.rage ?? 1) * crouch, KNOCKBACK_MAX);
}

export const HITSTUN_PER_KB = 0.4;
export const TUMBLE_HITSTUN = 32;

/** Hitstun = floor(max(kb * 0.4, 5)) - 1; the victim acts on the frame after. */
export function hitstunFrames(kb: number): number {
  return Math.floor(Math.max(kb * HITSTUN_PER_KB, 5)) - 1;
}

/** Tumble starts at 32 frames of hitstun before the 1-frame subtraction, i.e. kb >= 80. */
export function isTumble(kb: number): boolean {
  return Math.floor(kb * HITSTUN_PER_KB) >= TUMBLE_HITSTUN;
}

export const SAKURAI = 361;

/** The Sakurai angle: grounded 0 below 60 kb rising to 38 at 88 kb; always 38 against airborne targets. */
export function sakuraiAngle(kb: number, aerial: boolean): number {
  if (aerial || kb >= 88) return 38;
  if (kb < 60) return 0;
  return Math.min(((kb - 60) / 28) * 38 + 1, 38);
}

export const LAUNCH_SPEED_PER_KB = 0.03;
export const LAUNCH_DECAY = 0.051;
/** Tumble launches outside 70-110 degrees get vy += 5 * (gravity - 0.075). */
export const GRAVITY_BONUS_MULT = 5;
export const GRAVITY_BONUS_BASE = 0.075;
/** Tumble launches between these angles (inclusive) use the vertical-launch rules instead of the gravity bonus. */
export const VERTICAL_LAUNCH = [70, 110] as const;
export const VERTICAL_LAUNCH_FALL_SPEED = 1.8;
/** Default DamageFlyTopGravity: the median of Ultimate's 89 fighters (calculator data, commit 233590e). */
export const DAMAGE_FLY_TOP_GRAVITY = 0.07392;
export const DI_MAX = 0.17;
export const LSI_MAX = 1.095;
export const LSI_MIN = 0.92;
/**
 * Ultimate's autolink angles (SmashWiki, "Autolink angle"). A box with one of these launches by linking rather than
 * by angle: 365 moves the target at half the attacker's speed; 366 sends it at full launch speed the way the attacker
 * moves, pulled toward the hitbox for 5 frames; 367 sends it at the attacker's speed plus a fifth of the gap to the
 * hitbox (a grounded target is launched normally at 80 degrees); 368 boxes carry a position vector (HitboxDef.vector)
 * and act as 367 without one.
 */
export const AUTOLINK = { half: 365, vortex: 366, link: 367, vector: 368 } as const;
export const AUTOLINK_HALF = 0.5;
export const AUTOLINK_PULL = 0.2;
export const AUTOLINK_VORTEX_FRAMES = 5;
export const AUTOLINK_GROUND_ANGLE = 80;
export const AUTOLINK_SPEED_MAX = 3;
export const AUTOLINK_SPEED_CAP_DELAY = 5;
export const AUTOLINK_VY_MIN = -1;

export function isAutolink(angle: number): boolean {
  return (
    angle === AUTOLINK.half ||
    angle === AUTOLINK.vortex ||
    angle === AUTOLINK.link ||
    angle === AUTOLINK.vector
  );
}

export interface LaunchParams {
  kb: number;
  /** Hitbox angle (361 = Sakurai). */
  angle: number;
  /** The target is airborne. */
  aerial: boolean;
  /** The target's gravity. */
  gravity: number;
  /** Set-knockback hits get no gravity bonus and no balloon speed-up. */
  setKnockback?: boolean;
  /** The target's control stick, normalised to [-1, 1] and already mirrored into the attacker's frame. */
  stick?: { x: number; y: number };
}

export interface Launch {
  /** Hitbox angle after Sakurai and the 0/180 high-kb rule. */
  angle: number;
  /** Direction actually launched, after the gravity bonus and DI. */
  effectiveAngle: number;
  /** Launch velocity on the first knockback frame (u/frame, attacker frame: +x away from the attacker). */
  vx: number;
  vy: number;
  tumble: boolean;
  /** 70-110 degree tumble: no gravity bonus, fall speed 1.8 and the fighter's DamageFlyTop gravity. */
  vertical: boolean;
}

/** Launch velocity for `kb`, following SSBU-Calculator's Knockback.calculate (which the research cross-checked). */
export function launch(l: LaunchParams): Launch {
  let angle = l.angle === SAKURAI ? sakuraiAngle(l.kb, l.aerial) : l.angle;
  let groundedFlat = !l.aerial && (angle === 0 || angle === 180);
  if ((angle === 0 || angle === 180) && l.kb >= 120) {
    groundedFlat = false;
    angle = angle === 0 ? 32 : 148;
  }
  const tumble = isTumble(l.kb);
  const vertical = tumble && angle >= VERTICAL_LAUNCH[0] && angle <= VERTICAL_LAUNCH[1];
  const bonus =
    tumble && !l.setKnockback && !vertical ? GRAVITY_BONUS_MULT * (l.gravity - GRAVITY_BONUS_BASE) : 0;
  let speed = l.kb * LAUNCH_SPEED_PER_KB;
  let vx = speed * SimMath.cos(angle * RAD);
  let vy = speed * SimMath.sin(angle * RAD) + bonus;
  let effective = SimMath.atan2(vy, vx);
  const stick = l.stick ?? { x: 0, y: 0 };
  if (tumble && Math.abs(effective) >= DI_MAX && (stick.x !== 0 || stick.y !== 0)) {
    speed = SimMath.hypot(vx, vy);
    effective = directionalInfluence(vx, vy, stick.x, stick.y);
    speed *= launchSpeedInfluence(stick.y, effective / RAD);
    vx = speed * SimMath.cos(effective);
    vy = speed * SimMath.sin(effective);
  }
  if (groundedFlat) {
    vx *= 0.8;
    vy *= 0.8;
  }
  const deg = effective / RAD;
  return { angle, effectiveAngle: deg < 0 ? deg + 360 : deg, vx, vy, tumble, vertical };
}

/** DI: rotate the launch by up to 0.17 rad toward the stick's component perpendicular to it. Returns radians. */
export function directionalInfluence(vx: number, vy: number, sx: number, sy: number): number {
  const speed = SimMath.hypot(vx, vy);
  const angle = SimMath.atan2(vy, vx);
  if (speed < 1e-5 || Math.abs(angle) < DI_MAX) return angle;
  const di = (DI_MAX * Math.abs(sx * vy - sy * vx)) / speed;
  return sy * vx - sx * vy < 0 ? angle - di : angle + di;
}

/** LSI: holding up/down scales launch speed by up to 1.095 / 0.92, except for near-vertical launches. */
export function launchSpeedInfluence(stickY: number, angleDeg: number): number {
  const a = ((angleDeg % 360) + 360) % 360;
  if ((a > 65 && a < 115) || (a > 245 && a < 295)) return 1;
  return stickY >= 0 ? 1 + (LSI_MAX - 1) * stickY : 1 - (1 - LSI_MIN) * -stickY;
}

export const SPEED_UP = { fafMin: 30, fafMax: 80, maxMag: 6, endRate: 0.7 };

/**
 * Balloon knockback. A tumble launch's hitstun runs faster at first: each entry of `steps` is how many hitstun frames
 * elapse on that real frame (and how far along its trajectory the victim travels). `actionable` is the real frame
 * the victim can act, given the un-sped first actionable frame `faf` (hitstun + 1).
 */
export function speedUp(faf: number): { steps: number[]; actionable: number } {
  const max =
    1 + (SPEED_UP.maxMag - 1) * clamp((faf - SPEED_UP.fafMin) / (SPEED_UP.fafMax - SPEED_UP.fafMin), 0, 1);
  const end = faf * (1 - SPEED_UP.endRate);
  const steps: number[] = [];
  let frame = faf;
  let mag = max;
  while (mag > 1) {
    mag = clamp((end - frame) / (end - faf), 0, 1) * max;
    const step = mag < 1 ? 1 : mag;
    frame -= step;
    steps.push(step);
  }
  return { steps, actionable: steps.length + Math.ceil(frame) };
}

export const HITLAG = { mult: 0.65, add: 6, max: 30, electric: 1.5, crouch: 0.67 };

/** Hitlag = min(floor((damage * 0.65 + 6) * mult * electric), 30), then x0.67 (floored) on a crouch cancel. */
export function hitlagFrames(
  damage: number,
  opts: { mult?: number; electric?: boolean; crouch?: boolean } = {},
): number {
  const raw = (damage * HITLAG.mult + HITLAG.add) * (opts.mult ?? 1) * (opts.electric ? HITLAG.electric : 1);
  const frames = Math.min(Math.floor(raw), HITLAG.max);
  return opts.crouch ? Math.floor(frames * HITLAG.crouch) : frames;
}

export type ShieldHitKind = 'smash' | 'aerial' | 'projectile' | 'other';
export const SHIELDSTUN_MULT: Record<ShieldHitKind, number> = {
  smash: 0.725,
  aerial: 0.33,
  projectile: 0.29,
  other: 1,
};
export const SHIELD_DAMAGE_MULT = 1.19;

/** Shieldstun = floor(damage * 0.8 * t + 3) - 1. */
export function shieldstunFrames(damage: number, kind: ShieldHitKind): number {
  return Math.floor(damage * 0.8 * SHIELDSTUN_MULT[kind] + 3) - 1;
}

/** Shield pushback (u/frame): the defender slides (stun + 1) * 0.09 (max 1.3); the attacker rebounds damage * 0.04 + 0.025. */
export function shieldPushback(damage: number, shieldstun: number): { defender: number; attacker: number } {
  return { defender: Math.min((shieldstun + 1) * 0.09, 1.3), attacker: damage * 0.04 + 0.025 };
}

/** Ledge-grab intangibility including the 19-frame catch: more with airtime, less with %, at least 4 + 19. */
export function ledgeIntangibility(airtime: number, percent: number): number {
  const frames = 60 * (Math.min(airtime, 300) / 300) + 44 - 44 * (Math.min(percent, 120) / 120);
  return Math.floor(Math.max(frames, 4)) + 19;
}

/** Frames a grab holds before the victim breaks out unaided. */
export function grabHoldFrames(percent: number): number {
  return Math.floor(90 + 1.7 * percent);
}

/** Dizzy frames after a shield break. */
export function shieldBreakStun(percent: number): number {
  return Math.max(0, 400 - percent);
}
