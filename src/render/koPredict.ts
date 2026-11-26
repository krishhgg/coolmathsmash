import { getFighter } from '../fighters/registry';
import type { FighterStats } from '../fighters/types';
import {
  DAMAGE_FLY_TOP_GRAVITY,
  hitstunFrames,
  isAutolink,
  launch,
  LAUNCH_DECAY,
  speedUp,
  VERTICAL_LAUNCH_FALL_SPEED,
} from '../sim/combat/formulas';
import { blastZoneCrossed } from '../sim/blastZones';
import type { MatchState } from '../sim/match';
import { getStage } from '../stages/registry';

/** Where and when a pending launch crosses a blast zone. */
export interface KoPrediction {
  /** Frames after the launch starts (1 = the first frame the victim moves). */
  frames: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  /** Where it crosses, in world units (y up). */
  x: number;
  y: number;
}

/** The sim's movement sub-step (movement.ts MAX_SUBSTEP): positions add up in the same pieces, to the last bit. */
const MAX_SUBSTEP = 1.5;

/**
 * Will the launch waiting out the hitlag of the fighter on `port` KO it? Ultimate's Finish Zoom makes this call on
 * contact, and SmashWiki (Special Zoom, Finish Zoom section, oldid 2063643) says it "only factors in knockback and
 * launch angle, and does not account for obstructions or DI". So this runs the launch alone: Ultimate's launch from
 * formulas.ts with the stick neutral, then the sim's tumble physics frame by frame (launch speed decaying 0.051 a
 * frame, gravity on the fighter's own speed, DamageFlyTop for 70-110 degree launches, balloon speed-up) with no
 * stage collision, until hitstun runs out. A KO is crossing a blast zone before then, the definition SSBU-Calculator's
 * KO calculator uses and src/sim/testing/ko.ts reproduces, with the sim's own check (sim/blastZones.ts): the top zone
 * needs a vertical speed of 2.4 or 30 units of overshoot, and a fast meteor dies at Ultimate's meteor blast line, 25
 * units under the camera. Null when it survives, when nothing is pending, for an autolink hit (it follows the
 * attacker instead of flying) and for a grounded launch that slides along the floor.
 *
 * Reads the state and never writes it. With the stick neutral and a clear flight path it agrees with the sim frame
 * for frame (koPredict.test.ts); DI, a wall or a platform in the way can still save the victim, as in Ultimate.
 */
export function predictKo(state: MatchState, port: number): KoPrediction | null {
  const f = state.fighters[port];
  const pending = f?.launch;
  if (!f || !pending || pending.link || isAutolink(pending.angle)) return null;
  const s = getFighter(f.fighter).stats;
  const aerial = f.ground === null;
  const l = launch({
    kb: pending.kb,
    angle: pending.angle,
    aerial,
    gravity: s.gravity,
    setKnockback: pending.setKnockback,
  });
  const kb = { x: l.vx * pending.dir, y: l.vy };
  // A grounded victim (hits.ts applyLaunch): an upward launch lifts off, a tumble spike bounces off the floor at 0.8,
  // and a flat or weak downward one slides along it.
  if (!aerial) {
    const flat = l.angle === 0 || l.angle === 180;
    if (flat || (kb.y <= 0 && !l.tumble)) return null;
    if (kb.y <= 0) kb.y = Math.abs(kb.y) * 0.8;
  }
  const stun = hitstunFrames(pending.kb);
  const faf = l.tumble && !pending.setKnockback ? stun + 1 : 0;
  const steps = faf ? speedUp(faf).steps : [];
  const { blastZones: zones, camera } = getStage(state.config.stage);
  const vel = { x: 0, y: 0 };
  const pos = { x: f.pos.x, y: f.pos.y };
  let hitstun = stun + 1;
  for (let frame = 1; hitstun > 0; frame++) {
    // movement.ts launchTimeScale: hitstun counts down first (the tumble action), then the frame moves.
    const scale = () => (faf > 0 && hitstun > 0 ? (steps[frame - 1] ?? 1) : 1);
    hitstun -= scale();
    const t = scale();
    const fly = { flyTop: l.vertical, stunned: hitstun > 0 };
    const { dx, dy } = integrate(s, fly, { ...vel }, { ...kb }, t);
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP));
    for (let i = 0; i < n; i++) {
      pos.x += dx / n;
      pos.y += dy / n;
    }
    integrate(s, fly, vel, kb, t);
    // step.ts checkBlastZones.
    const side = blastZoneCrossed(zones, camera, pos, kb, vel);
    if (side) return { frames: frame, side, x: pos.x, y: pos.y };
  }
  return null;
}

/** movement.ts integrate: `t` frames of launch decay along the launch and gravity on the fighter's own speed. */
function integrate(
  s: FighterStats,
  fly: { flyTop: boolean; stunned: boolean },
  vel: { x: number; y: number },
  kb: { x: number; y: number },
  scale: number,
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  for (let left = scale; left > 0; left--) {
    const t = Math.min(1, left);
    dx += (vel.x + kb.x) * t;
    dy += (vel.y + kb.y) * t;
    const speed = Math.hypot(kb.x, kb.y);
    const k = speed > LAUNCH_DECAY * t ? (speed - LAUNCH_DECAY * t) / speed : 0;
    kb.x *= k;
    kb.y *= k;
    vel.y = fall(s, fly, vel.y, t);
  }
  return { dx, dy };
}

/** movement.ts fallStep. */
function fall(s: FighterStats, fly: { flyTop: boolean; stunned: boolean }, vy: number, t: number): number {
  if (fly.flyTop && fly.stunned) {
    return Math.max(vy - (s.damageFlyTopGravity ?? DAMAGE_FLY_TOP_GRAVITY) * t, -VERTICAL_LAUNCH_FALL_SPEED);
  }
  if (fly.flyTop && vy < -s.fallSpeed) return Math.min(vy + s.gravity * t, -s.fallSpeed);
  return Math.max(vy - s.gravity * t, -s.fallSpeed);
}
