import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'snailbob',
  name: 'Snail Bob',
  series: 'Snail Bob (2010)',
  stats,
  moves,
});
