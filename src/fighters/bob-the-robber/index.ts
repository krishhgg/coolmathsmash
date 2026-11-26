import { defineFighter } from '../types';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';
import { entities } from './entities';
import { statuses } from './statuses';

export const fighter = defineFighter({
  id: 'bob-the-robber',
  name: 'Bob the Robber',
  series: 'Bob the Robber (2011)',
  stats,
  moves,
  entities,
  statuses,
  art,
});
