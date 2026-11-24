import { getFighter } from '../../fighters/registry';
import { launch } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';

/** One fighter frozen by a hit: the hitlag the hit started and the knockback axis to jitter along (unit, y up). */
export interface Freeze {
  frame: number;
  port: number;
  lag: number;
  amplitude: number;
  ax: number;
  ay: number;
}

/** Hitlag jitter amplitude in world units: the victim shakes ±1.5 along the knockback axis, the attacker half that. */
export const VICTIM_JITTER = 1.5;
export const ATTACKER_JITTER = VICTIM_JITTER / 2;

/** The axis `victim`'s pending launch will send it along (hitbox angle after the Sakurai rule; unit, y up). */
export function knockbackAxis(victim: FighterState): { x: number; y: number } {
  const l = victim.launch;
  if (!l) return { x: victim.facing === 1 ? -1 : 1, y: 0 };
  const { angle } = launch({
    kb: l.kb,
    angle: l.angle,
    aerial: victim.ground === null,
    gravity: getFighter(victim.fighter).stats.gravity,
    setKnockback: l.setKnockback,
  });
  const rad = (angle * Math.PI) / 180;
  return { x: l.dir * Math.cos(rad), y: Math.sin(rad) };
}

/** The victim's and the attacker's freeze from a `hit` event on `frame`. */
export function freezesFrom(e: Extract<SimEvent, { type: 'hit' }>, m: MatchState, frame: number): Freeze[] {
  const axis = knockbackAxis(m.fighters[e.victim]!);
  const freeze = (port: number, amplitude: number): Freeze => ({
    frame,
    port,
    lag: Math.max(1, e.hitlag),
    amplitude,
    ax: axis.x,
    ay: axis.y,
  });
  return [freeze(e.victim, VICTIM_JITTER), freeze(e.attacker, ATTACKER_JITTER)];
}

/**
 * Where to draw `f` relative to its simulated position (world units, y up) while it sits in hitlag: `freeze`'s
 * amplitude along the knockback axis, flipping sign every frame and shrinking linearly to 0 at launch. Render only;
 * the simulated position never moves.
 */
export function hitlagOffset(
  f: FighterState,
  frame: number,
  freeze: Freeze | undefined,
): { x: number; y: number } {
  if (!freeze || f.hitlag <= 0) return { x: 0, y: 0 };
  const a = freeze.amplitude * Math.min(1, f.hitlag / freeze.lag) * (frame % 2 === 0 ? 1 : -1);
  return { x: freeze.ax * a, y: freeze.ay * a };
}
