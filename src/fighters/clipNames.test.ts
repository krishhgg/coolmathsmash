import { describe, expect, it } from 'vitest';
import { BACK_ROLLS, fighterArt } from '../render/fighterView';
import { ACTIONS } from '../sim/actions';
import { allFighters } from './registry';

/**
 * Clips drawn for a name the engine can't play yet, by fighter (`*` for every fighter). There is no taunt action
 * behind the Taunt button, and Fluffy has a neutral special clip but no `neutralB` move.
 */
const NOT_PLAYED_YET: Record<string, string[]> = {
  '*': ['taunt'],
  fluffy: ['neutralB'],
};

/** Clips clipFor draws in place of an action's own: the back tech and getup rolls (BACK_ROLLS). */
const RENDERER_NAMES = new Set(Object.values(BACK_ROLLS));

const drawn = Object.values(allFighters()).flatMap((def) => {
  const art = fighterArt(def);
  return art ? [[def.id, def, art] as const] : [];
});

/**
 * clipFor (src/render/fighterView.ts) looks a clip up by the running move's name, else the action's (or a back
 * roll's), and draws idle for any name it doesn't find. A move that charges also plays `<move>Charge`
 * (chargeClipName) while it holds its charge frame. A clip under any other name never plays.
 */
describe.each(drawn)('%s clip names', (id, def, art) => {
  const waived = [...NOT_PLAYED_YET['*']!, ...(NOT_PLAYED_YET[id] ?? [])];
  const known = (name: string) =>
    ACTIONS[name] !== undefined ||
    RENDERER_NAMES.has(name) ||
    def.actions?.[name] !== undefined ||
    def.moves?.[name] !== undefined ||
    (name.endsWith('Charge') && def.moves?.[name.slice(0, -'Charge'.length)]?.charge !== undefined);

  it('names each clip after an engine action, a back roll or one of its moves', () => {
    const unknown = Object.keys(art.clips).filter((name) => !known(name) && !waived.includes(name));
    expect(unknown).toEqual([]);
  });

  it('waives only names that still have no action or move to play them', () => {
    expect(waived.filter(known)).toEqual([]);
  });
});
