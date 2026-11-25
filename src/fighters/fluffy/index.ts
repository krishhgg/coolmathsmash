import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'fluffy',
  name: 'Fluffy',
  series: 'IQ Ball / Catch the Candy (2010)',
  stats,
  moves,
  art,
  entities,
});
