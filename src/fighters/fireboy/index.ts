import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'fireboy',
  name: 'Fireboy',
  series: 'Fireboy and Watergirl (2009)',
  stats,
  moves,
});
