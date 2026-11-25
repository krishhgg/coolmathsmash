import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

/**
 * Watergirl, the form Fireboy swaps into with down special. She isn't picked on her own. Her moves (Mario's kit,
 * with more range and less damage than Fireboy's) and her stats are her own.
 */
export const fighter = defineFighter({
  id: 'watergirl',
  name: 'Watergirl',
  series: 'Fireboy and Watergirl (2009)',
  stats,
  moves,
  selectable: false,
  immune: ['water'],
});
