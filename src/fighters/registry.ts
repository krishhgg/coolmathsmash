import { provideFighters } from './lookup';
import type { FighterDef } from './types';

/**
 * Every src/fighters/<id>/index.ts, handed to the lookup in lookup.ts. Sim code looks fighters up there, not here, so
 * a fighter's own modules never load this file. The exports are read on the first lookup all the same, in case a
 * fighter module ever reaches this file while it is still loading.
 */
const modules = import.meta.glob<{ fighter: FighterDef }>('./*/index.ts', { eager: true });

provideFighters(() =>
  Object.keys(modules)
    .sort()
    .map((path) => {
      const fighter = modules[path]!.fighter;
      if (!fighter)
        throw new Error(`${path} is still loading: look fighters up inside functions, not at module load`);
      return fighter;
    }),
);

export { allFighters, getFighter, registerFighter } from './lookup';
