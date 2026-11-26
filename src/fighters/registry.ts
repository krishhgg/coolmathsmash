import type { FighterDef } from './types';

/**
 * Every src/fighters/<id>/index.ts. A fighter module imports sim code that imports this file, so when a fighter is
 * imported first its `fighter` export is not set yet while this file loads. Read the exports on the first lookup
 * instead, once every module has finished loading.
 */
const modules = import.meta.glob<{ fighter: FighterDef }>('./*/index.ts', { eager: true });

const registered: Record<string, FighterDef> = {};
let table: Record<string, FighterDef> | undefined;

/** Every fighter: the discovered ones in id order, then the registered ones in the order they were registered. */
export function allFighters(): Readonly<Record<string, FighterDef>> {
  if (table) return table;
  const found: Record<string, FighterDef> = {};
  for (const path of Object.keys(modules).sort()) {
    const fighter = modules[path]!.fighter;
    if (!fighter)
      throw new Error(`${path} is still loading: look fighters up inside functions, not at module load`);
    found[fighter.id] = fighter;
  }
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
