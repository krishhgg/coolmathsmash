import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'duck',
  name: 'The Duck',
  series: 'Duck Life (2010)',
  stats,
  moves,
  art,
  entities,
});
