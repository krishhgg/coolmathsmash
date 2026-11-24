import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'johnny',
  name: 'Johnny Upgrade',
  series: 'Johnny Upgrade (2012)',
  stats,
  moves,
});
