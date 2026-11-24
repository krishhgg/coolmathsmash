import type { FighterDef } from './types';

const modules = import.meta.glob<{ fighter: FighterDef }>('./*/index.ts', { eager: true });

/** Every fighter under src/fighters/<id>/index.ts, discovered automatically, in id order. */
export const FIGHTERS: Record<string, FighterDef> = Object.fromEntries(
  Object.keys(modules)
    .sort()
    .map((path) => {
      const fighter = modules[path]!.fighter;
      return [fighter.id, fighter];
    }),
);

/** Test-only fighters (e.g. the Mario reference) are registered at runtime. */
export function registerFighter(def: FighterDef): void {
  FIGHTERS[def.id] = def;
}

export function getFighter(id: string): FighterDef {
  const def = FIGHTERS[id];
  if (!def) throw new Error(`unknown fighter "${id}" (have: ${Object.keys(FIGHTERS).join(', ')})`);
  return def;
}
