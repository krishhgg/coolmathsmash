import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';

/**
 * Watergirl, the form Fireboy swaps into with down special. She isn't picked on her own. Her moves (Mario's kit,
 * with more range and less damage than Fireboy's), her stats and her art (the water placeholder mannequin) are her own.
 */
export const fighter = defineFighter({
  id: 'watergirl',
  name: 'Watergirl',
  series: 'Fireboy and Watergirl (2009)',
  stats,
  moves,
  art,
  entities,
  selectable: false,
  immune: ['water'],
});
