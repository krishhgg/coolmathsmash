import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { PLANNED_ROSTER, rosterTiles, selectableFighterIds } from './roster';

const f = (id: string, name: string) => ({ id, name });

describe('roster grid', () => {
  it('lays out the planned roster with registered fighters under their entry', () => {
    const tiles = rosterTiles([f('watergirl', 'Watergirl'), f('fireboy', 'Fireboy')]);
    expect(tiles.map((t) => t.name)).toEqual([
      'Papa Louie',
      'Fireboy',
      'Watergirl',
      ...PLANNED_ROSTER.slice(2),
    ]);
    expect(tiles.filter((t) => t.id).map((t) => t.id)).toEqual(['fireboy', 'watergirl']);
    expect(tiles[0]).toEqual({ id: null, name: 'Papa Louie' });
  });

  it('matches by name or id, ignoring a leading "The", and appends fighters outside the plan', () => {
    const tiles = rosterTiles([
      f('mario', 'Mario'),
      f('duck', 'Duck'),
      f('bloxorz', 'Bloxorz'),
      f('bob', 'Bob'),
    ]);
    expect(tiles.find((t) => t.name === 'Duck')).toEqual({ id: 'duck', name: 'Duck' });
    expect(tiles.findIndex((t) => t.id === 'duck')).toBe(6);
    expect(tiles.findIndex((t) => t.id === 'bloxorz')).toBe(9);
    expect(tiles.findIndex((t) => t.id === 'bob')).toBe(3);
    expect(tiles.find((t) => t.name === 'Snail Bob')).toEqual({ id: null, name: 'Snail Bob' });
    expect(tiles.at(-1)).toEqual({ id: 'mario', name: 'Mario' });
    expect(tiles).toHaveLength(PLANNED_ROSTER.length + 1);
  });

  it('skips forms reached only in a match', () => {
    const tiles = rosterTiles([
      f('fireboy', 'Fireboy'),
      { id: 'watergirl', name: 'Watergirl', selectable: false },
      { id: 'bloxorz', name: 'Bloxorz Block' },
      { id: 'bloxorz-lying', name: 'Bloxorz Block (lying)', selectable: false },
    ]);
    const ids = tiles.flatMap((t) => (t.id ? [t.id] : []));
    expect(ids).toEqual(['fireboy', 'bloxorz']);
    expect(tiles).toHaveLength(PLANNED_ROSTER.length);
  });

  it('places every selectable registered fighter exactly once', () => {
    const ids = rosterTiles().flatMap((t) => (t.id ? [t.id] : []));
    const selectable = Object.values(allFighters()).filter((d) => d.selectable !== false);
    expect([...ids].sort()).toEqual(selectable.map((d) => d.id).sort());
    expect(ids).not.toContain('watergirl');
  });
});

describe('selectableFighterIds', () => {
  it('leaves out forms reached only in a match', () => {
    expect(selectableFighterIds()).toEqual(
      Object.values(allFighters())
        .filter((d) => d.selectable !== false)
        .map((d) => d.id),
    );
    expect(selectableFighterIds()).not.toContain('watergirl');
  });
});
