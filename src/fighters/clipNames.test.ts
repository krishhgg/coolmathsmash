import { describe, expect, it } from 'vitest';
import { fighterArt } from '../render/fighterView';
import { ACTIONS } from '../sim/actions';
import { FIGHTERS } from './registry';

/**
 * Clips drawn for a name the engine can't play yet, by fighter (`*` for every fighter). There is no taunt action
 * behind the Taunt button, and Fluffy and Watergirl have a neutral special clip but no `neutralB` move.
 */
const NOT_PLAYED_YET: Record<string, string[]> = {
  '*': ['taunt'],
  fluffy: ['neutralB'],
  watergirl: ['neutralB'],
};

const drawn = Object.values(FIGHTERS).flatMap((def) => {
  const art = fighterArt(def);
  return art ? [[def.id, def, art] as const] : [];
});

/**
 * clipFor (src/render/fighterView.ts) looks a clip up by the running move's name, else the action's, and draws
 * idle for any name it doesn't find. A clip under any other name never plays.
 */
describe.each(drawn)('%s clip names', (id, def, art) => {
  const waived = [...NOT_PLAYED_YET['*']!, ...(NOT_PLAYED_YET[id] ?? [])];
  const known = (name: string) =>
    ACTIONS[name] !== undefined || def.actions?.[name] !== undefined || def.moves?.[name] !== undefined;

  it('names each clip after an engine action or one of its moves', () => {
    const unknown = Object.keys(art.clips).filter((name) => !known(name) && !waived.includes(name));
    expect(unknown).toEqual([]);
  });

  it('waives only names that still have no action or move to play them', () => {
    expect(waived.filter(known)).toEqual([]);
  });
});
