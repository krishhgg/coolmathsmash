import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

/**
 * Watergirl, the form Fireboy swaps into with down special (and back out of with hers). She isn't picked on her
 * own: menus list Fireboy, who starts the match.
 */
export const fighter = defineFighter({
  id: 'watergirl',
  name: 'Watergirl',
  series: 'Fireboy and Watergirl (2009)',
  stats,
  moves,
  selectable: false,
});
