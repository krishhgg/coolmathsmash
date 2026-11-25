import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'snailbob',
  name: 'Snail Bob',
  series: 'Snail Bob (2010)',
  stats,
  moves,
  art,
  entities,
});
