import { defineFighter } from '../types';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';
import { actions } from './actions';

export const fighter = defineFighter({
  id: 'redball',
  name: 'Red Ball',
  series: 'Red Ball 4 (2013)',
  actions,
  stats,
  moves,
  art,
});
