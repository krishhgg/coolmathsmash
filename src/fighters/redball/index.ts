import { defineFighter } from '../types';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'redball',
  name: 'Red Ball',
  series: 'Red Ball 4 (2013)',
  stats,
  moves,
  art,
});
