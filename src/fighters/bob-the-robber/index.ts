import { defineFighter } from '../types';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'bob-the-robber',
  name: 'Bob the Robber',
  series: 'Bob the Robber (2011)',
  stats,
  moves,
  art,
});
