import { defineFighter } from '../types';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';
import { STANDING, TIP_ACTIONS } from './tip';

/** Bloxorz block, standing upright: the form every match starts in. Lying is src/fighters/bloxorz/lying.ts. */
export const fighter = defineFighter({
  id: STANDING,
  name: 'Bloxorz Block',
  series: 'Bloxorz (2007)',
  stats,
  moves,
  actions: TIP_ACTIONS,
  art,
});
