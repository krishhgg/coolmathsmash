import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'fluffy',
  name: 'Fluffy',
  series: 'IQ Ball / Catch the Candy (2010)',
  stats,
  moves,
});
