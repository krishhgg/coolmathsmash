// Keep this import first. fluffy/index.ts used to load sim code that loaded the registry while Fluffy's own `fighter`
// export was still unset, which threw "Cannot read properties of undefined (reading 'id')".
import { fighter as fluffy } from './fluffy/index';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FighterDef } from './types';
import { allFighters, getFighter } from './registry';
import { run, testMatch } from '../sim/testing/sim';

/** Every fighter module, not loaded until called. */
const fighterModules = import.meta.glob<{ fighter: FighterDef }>('./*/index.ts');

/**
 * The fighter modules other code imports directly: the harness loads scenarios.ts, the lab and tests load moves,
 * entities and art. Each imports sim code. If any of that loaded the registry, the registry would build the fighter
 * from its index.ts while this module was still loading, and the fighter would have no moves, art or entities.
 */
const entryModules = import.meta.glob([
  './*/moves.ts',
  './*/entities.ts',
  './*/art/index.ts',
  './*/scenarios.ts',
]);

/** Where two loads of one fighter differ, the first 10 places. Functions match when their source does. */
function differences(
  a: unknown,
  b: unknown,
  path = '',
  out: string[] = [],
  seen = new Set<object>(),
): string[] {
  if (out.length >= 10) return out;
  if (typeof a === 'function' && typeof b === 'function') {
    if (String(a) !== String(b)) out.push(`${path}: a different function`);
    return out;
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    if (!Object.is(a, b)) out.push(`${path}: ${String(a)} where a normal load has ${String(b)}`);
    return out;
  }
  if (seen.has(a)) return out;
  seen.add(a);
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const key of new Set([...Object.keys(x), ...Object.keys(y)]))
    differences(x[key], y[key], path ? `${path}.${key}` : key, out, seen);
  return out;
}

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

describe("a fighter's own module imported before the registry", () => {
  /** Every fighter as the registry builds them when it is loaded first, in a module graph of its own. */
  let normal: Readonly<Record<string, FighterDef>>;
  beforeAll(async () => {
    vi.resetModules();
    normal = (await import('./registry')).allFighters();
  });

  it.each(Object.keys(entryModules).sort())(
    '%s, imported first in a fresh module graph, leaves its fighter with all its moves, art and entities',
    async (path) => {
      vi.resetModules();
      await entryModules[path]!();
      const { fighter } = await fighterModules[`./${path.split('/')[1]}/index.ts`]!();
      const registry = await import('./registry');
      expect(registry.getFighter(fighter.id)).toBe(fighter);
      expect(differences(fighter, normal[fighter.id])).toEqual([]);
    },
  );
});
