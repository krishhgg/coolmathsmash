import { defineFighter } from '../types';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'fireboy',
  name: 'Fireboy',
  series: 'Fireboy and Watergirl (2009)',
  stats,
});
