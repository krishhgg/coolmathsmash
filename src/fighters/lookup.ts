import type { FighterDef } from './types';

/**
 * Fighter lookup for the simulation. It imports no fighter: a fighter's own modules (moves, entities, art) import sim
 * code that looks fighters up, and if that sim code loaded every fighter, the fighter loaded first would be built
 * while its own modules were still loading, without them. registry.ts finds the fighters and hands them here; step.ts
 * and the code outside the simulation import it.
 */
let discovered: (() => FighterDef[]) | undefined;
const registered: Record<string, FighterDef> = {};
let table: Record<string, FighterDef> | undefined;

/** Called once by registry.ts with its discovered fighters, read on the first lookup. */
export function provideFighters(found: () => FighterDef[]): void {
  discovered = found;
  table = undefined;
}

/** Every fighter: the discovered ones in id order, then the registered ones in the order they were registered. */
export function allFighters(): Readonly<Record<string, FighterDef>> {
  if (table) return table;
  if (!discovered)
    throw new Error('no fighters loaded: import src/fighters/registry.ts before looking fighters up');
  const found: Record<string, FighterDef> = {};
  for (const fighter of discovered()) found[fighter.id] = fighter;
  table = Object.assign(found, registered);
  return table;
}

/** Test-only fighters (e.g. the Mario reference) are registered at runtime. */
export function registerFighter(def: FighterDef): void {
  registered[def.id] = def;
  if (table) table[def.id] = def;
}

export function getFighter(id: string): FighterDef {
  const def = (table ?? allFighters())[id];
  if (!def) throw new Error(`unknown fighter "${id}" (have: ${Object.keys(allFighters()).join(', ')})`);
  return def;
}
