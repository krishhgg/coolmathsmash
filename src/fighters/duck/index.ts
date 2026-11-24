import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'duck',
  name: 'The Duck',
  series: 'Duck Life (2010)',
  stats,
  moves,
});
