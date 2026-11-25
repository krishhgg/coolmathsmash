import { defineFighter } from '../types';
import { actions } from './actions';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'wheely',
  name: 'Wheely',
  series: 'Wheely (2012)',
  stats,
  moves,
  actions,
});
