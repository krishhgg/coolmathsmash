import { moves as fireboyMoves } from '../fireboy/moves';
import { swap } from '../fireboy/swap';
import { defineFighter } from '../types';
import { stats } from './stats';

/**
 * Watergirl, the form Fireboy swaps into with down special. She isn't picked on her own. Until the Fireboy and
 * Watergirl thread builds her kit she borrows Fireboy's moves; her stats are already her own.
 */
export const fighter = defineFighter({
  id: 'watergirl',
  name: 'Watergirl',
  series: 'Fireboy and Watergirl (2009)',
  stats,
  moves: { ...fireboyMoves, downB: swap('fireboy') },
  selectable: false,
});
