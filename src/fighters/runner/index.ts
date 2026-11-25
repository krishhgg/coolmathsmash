import { defineFighter } from '../types';
import { boxDropActions } from './box-drop';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'runner',
  name: 'Runner',
  series: 'Run (2008)',
  stats,
  moves,
  actions: boxDropActions,
  art,
});
