/**
 * Per-fighter meters: named numbers a fighter's moves fill and spend, like Hero's MP or Robin's tome uses (charge,
 * ammo, coins, a once-per-airtime count). A fighter declares them in FighterDef.meters; FighterState.meters holds
 * the values. See docs/fighters.md, "Statuses and meters".
 */

import { getFighter } from '../fighters/registry';
import type { FighterDef } from '../fighters/types';
import type { SimEvent } from './events';
import type { Ctx, FighterState } from './fighter';
import type { MatchState } from './match';
import { applyStatus, clearStatus, hasStatus } from './statuses';

export interface MeterDef {
  /** A full meter. Values stay between 0 and `max`. */
  max: number;
  /** The value at the start of a match, and after a KO unless `onKo` is `keep`. Default 0. */
  start?: number;
  /** Change per frame the fighter acts (negative drains). Default 0. */
  regen?: number;
  /**
   * Only regenerate while standing on the ground (a count that refills on landing). `'stage'` counts only the stage
   * itself, not an entity's platform (EntityDef.platform), so standing on a placed raft or block refills nothing.
   */
  grounded?: boolean | 'stage';
  /** On a KO: `reset` to `start` (default) or `keep` the value into the next stock. */
  onKo?: 'reset' | 'keep';
  /**
   * Gain per % of damage this fighter deals to another fighter (hits, its projectiles' hits, pummels and throw hold
   * hits, and its statuses' damage) and per % it takes from anything, counted as the % the damage added. Shields
   * and entities don't count. Cloud's Limit Gauge in Ultimate is 0.667 per % dealt and 1 per % taken.
   */
  dealt?: number;
  taken?: number;
  /**
   * A status kind ("<fighter id>/<name>") the fighter holds while the meter is full: it goes on at the end of the
   * frame the meter fills and comes off at the end of the frame the meter is spent. When it runs out or a KO takes it
   * off, the meter empties. Cloud's Limit Break lasts 900 frames, then the gauge empties.
   */
  full?: string;
}

/** Every meter of `def` at its start value. */
export function createMeters(def: FighterDef): Record<string, number> {
  const meters: Record<string, number> = {};
  for (const [name, m] of Object.entries(def.meters ?? {})) meters[name] = m.start ?? 0;
  return meters;
}

function meterDef(f: FighterState, name: string): MeterDef {
  const def = getFighter(f.fighter).meters?.[name];
  if (!def) throw new Error(`fighter "${f.fighter}" has no meter "${name}"`);
  return def;
}

/** The value of meter `name`. */
export function meter(f: FighterState, name: string): number {
  return f.meters[name] ?? meterDef(f, name).start ?? 0;
}

/** Set meter `name`, clamped to 0..max; returns the new value. */
export function setMeter(f: FighterState, name: string, value: number): number {
  const def = meterDef(f, name);
  f.meters[name] = Math.max(0, Math.min(def.max, value));
  return f.meters[name];
}

/** Add `delta` (negative to take away) to meter `name`, clamped; returns the new value. */
export function addMeter(f: FighterState, name: string, delta: number): number {
  return setMeter(f, name, meter(f, name) + delta);
}

/** Spend `cost` from meter `name` if it holds that much: true when it did, false (and no change) when not. */
export function spendMeter(f: FighterState, name: string, cost: number): boolean {
  if (meter(f, name) < cost) return false;
  addMeter(f, name, -cost);
  return true;
}

/** One frame of regen for every meter, in the order the fighter declares them; none while KO'd off screen. */
export function tickMeters(x: Ctx): void {
  const { f, def } = x;
  if (f.action === 'ko' || f.action === 'out') return;
  for (const [name, m] of Object.entries(def.meters ?? {})) {
    if (!m.regen || (m.grounded && !f.ground)) continue;
    if (m.grounded === 'stage' && f.ground?.kind === 'entity') continue;
    addMeter(f, name, m.regen);
  }
}

/** The frame's damage events as (dealer port or -1, taker port, % added), in the order they happened. */
function damageOf(e: SimEvent): [number, number, number] | null {
  switch (e.type) {
    case 'hit':
    case 'pummel':
      return [e.attacker, e.victim, e.damage];
    case 'statusDamage':
      return [e.source, e.port, e.damage];
    case 'stageHit':
      return [-1, e.victim, e.damage];
    default:
      return null;
  }
}

/**
 * End of a frame, after every hit: meters with `dealt` or `taken` gain from the frame's damage events in the order
 * they happened, then each meter with a `full` status puts it on, takes it off, or empties when it ran out or a KO
 * took it off this frame. Fighters go in port order and meters in the order each fighter declares them.
 */
export function settleMeters(m: MatchState): void {
  for (const e of m.events) {
    const damage = damageOf(e);
    if (!damage) continue;
    const [dealer, taker, amount] = damage;
    for (const port of dealer === taker ? [taker] : [dealer, taker]) {
      const f = m.fighters[port];
      if (!f) continue;
      for (const [name, def] of Object.entries(getFighter(f.fighter).meters ?? {})) {
        const rate = port === taker ? def.taken : def.dealt;
        if (rate) addMeter(f, name, amount * rate);
      }
    }
  }
  for (const f of m.fighters) {
    for (const [name, def] of Object.entries(getFighter(f.fighter).meters ?? {})) {
      if (!def.full) continue;
      const ended = m.events.some(
        (e) =>
          e.type === 'statusEnd' &&
          e.port === f.port &&
          e.status === def.full &&
          (e.reason === 'expired' || e.reason === 'ko'),
      );
      const on = hasStatus(f, def.full);
      if (ended) setMeter(f, name, 0);
      else if (meter(f, name) >= def.max && !on && f.action !== 'ko' && f.action !== 'out')
        applyStatus(m, f, def.full, { source: f.port });
      else if (meter(f, name) < def.max && on) clearStatus(m, f, def.full);
    }
  }
}

/** A KO puts every meter without `onKo: 'keep'` back to its start value. */
export function resetMetersOnKo(f: FighterState): void {
  for (const [name, m] of Object.entries(getFighter(f.fighter).meters ?? {})) {
    if (m.onKo !== 'keep') f.meters[name] = m.start ?? 0;
  }
}
