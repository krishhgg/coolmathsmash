// Keep this import first. fluffy/index.ts loads sim code that loads the registry while Fluffy's own `fighter`
// export is still unset, which used to throw "Cannot read properties of undefined (reading 'id')".
import { fighter as fluffy } from './fluffy/index';
import { describe, expect, it, vi } from 'vitest';
import type { FighterDef } from './types';
import { allFighters, getFighter } from './registry';
import { run, testMatch } from '../sim/testing/sim';

/** Every fighter module, not loaded until called. */
const fighterModules = import.meta.glob<{ fighter: FighterDef }>('./*/index.ts');

describe('a fighter imported before the registry', () => {
  it('is registered under its id', () => {
    expect(getFighter('fluffy')).toBe(fluffy);
    expect(Object.values(allFighters())).toContain(fluffy);
  });

  it('plays: Fluffy throws the candy and catches it on the way back', () => {
    const m = testMatch({ fighter: 'fluffy' });
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(m.fighters[0]!.move).toBe('sideB');
    run(m, 13);
    expect(m.entities.map((e) => e.kind)).toEqual(['fluffy/candy']);
    let caught = false;
    for (let i = 0; i < 120 && !caught; i++) {
      run(m, 1);
      caught = m.events.some((e) => e.type === 'entityDestroy' && e.reason === 'script');
    }
    expect(caught).toBe(true);
  });

  it.each(Object.keys(fighterModules).sort())(
    '%s, imported first in a fresh module graph, is registered',
    async (path) => {
      vi.resetModules();
      const { fighter } = await fighterModules[path]!();
      const registry = await import('./registry');
      expect(registry.getFighter(fighter.id)).toBe(fighter);
    },
  );
});
