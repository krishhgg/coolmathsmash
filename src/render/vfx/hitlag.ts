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
/** A blocked hit shakes the shielding fighter (and its bubble) sideways by this much, the attacker half that. */
export const SHIELD_JITTER = 0.5;

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

/**
 * The fighter that dealt a hit and froze with it: none for a projectile's hit (the sim freezes neither it nor its
 * owner) or a hit nobody is credited with.
 */
function striker(e: { attacker: number; entity?: number }, m: MatchState): FighterState | undefined {
  return e.entity === undefined ? m.fighters[e.attacker] : undefined;
}

/** The victim's freeze from a `hit` event on `frame`, and the attacker's when a fighter's own move landed. */
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
  const a = striker(e, m);
  return [freeze(e.victim, VICTIM_JITTER), ...(a ? [freeze(a.port, ATTACKER_JITTER)] : [])];
}

/**
 * The shielding fighter's freeze from a `shieldHit` event, sideways away from the attacker (from the contact point
 * for a projectile), and the attacker's when a fighter's own move landed.
 */
export function shieldFreezes(
  e: Extract<SimEvent, { type: 'shieldHit' }>,
  m: MatchState,
  frame: number,
): Freeze[] {
  const a = striker(e, m);
  const ax = m.fighters[e.victim]!.pos.x >= (a ? a.pos.x : e.x) ? 1 : -1;
  const freeze = (port: number, amplitude: number): Freeze => ({
    frame,
    port,
    lag: Math.max(1, m.fighters[port]!.hitlag),
    amplitude,
    ax,
    ay: 0,
  });
  return [freeze(e.victim, SHIELD_JITTER), ...(a ? [freeze(a.port, SHIELD_JITTER / 2)] : [])];
}

/** The victim's freeze from a stage hazard's hit (`stageHit`), along its knockback axis. */
export function stageFreeze(
  e: Extract<SimEvent, { type: 'stageHit' }>,
  m: MatchState,
  frame: number,
): Freeze {
  const v = m.fighters[e.victim]!;
  const axis = knockbackAxis(v);
  return {
    frame,
    port: e.victim,
    lag: Math.max(1, v.hitlag),
    amplitude: VICTIM_JITTER,
    ax: axis.x,
    ay: axis.y,
  };
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
