/**
 * Per-fighter meters: named numbers a fighter's moves fill and spend, like Hero's MP or Robin's tome uses (charge,
 * ammo, coins, a once-per-airtime count). A fighter declares them in FighterDef.meters; FighterState.meters holds
 * the values. See docs/fighters.md, "Statuses and meters".
 */

import { getFighter } from '../fighters/registry';
import type { FighterDef } from '../fighters/types';
import type { Ctx, FighterState } from './fighter';

export interface MeterDef {
  /** A full meter. Values stay between 0 and `max`. */
  max: number;
  /** The value at the start of a match, and after a KO unless `onKo` is `keep`. Default 0. */
  start?: number;
  /** Change per frame the fighter acts (negative drains). Default 0. */
  regen?: number;
  /** Only regenerate while standing on the ground (a count that refills on landing). */
  grounded?: boolean;
  /** On a KO: `reset` to `start` (default) or `keep` the value into the next stock. */
  onKo?: 'reset' | 'keep';
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

/** One frame of regen for every meter, in the order the fighter declares them. */
export function tickMeters(x: Ctx): void {
  const { f, def } = x;
  for (const [name, m] of Object.entries(def.meters ?? {})) {
    if (!m.regen || (m.grounded && !f.ground)) continue;
    addMeter(f, name, m.regen);
  }
}

/** A KO puts every meter without `onKo: 'keep'` back to its start value. */
export function resetMetersOnKo(f: FighterState): void {
  for (const [name, m] of Object.entries(getFighter(f.fighter).meters ?? {})) {
    if (m.onKo !== 'keep') f.meters[name] = m.start ?? 0;
  }
}
