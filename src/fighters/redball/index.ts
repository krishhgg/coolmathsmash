import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';
import { actions } from './actions';
import { statuses } from './statuses';

export const fighter = defineFighter({
  id: 'redball',
  name: 'Red Ball',
  series: 'Red Ball 4 (2013)',
  actions,
  stats,
  moves,
  statuses,
});
