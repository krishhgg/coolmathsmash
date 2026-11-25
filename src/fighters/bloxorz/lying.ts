import { defineFighter } from '../types';
import { lyingMoves } from './moves';
import { stats } from './stats';
import { LYING, TIP_ACTIONS } from './tip';

/**
 * Bloxorz block lying on its side: the same block (src/fighters/bloxorz/tip.ts), 24 wide and 12 tall, so it has
 * a low, wide hurtbox and ducks high attacks. Reached only by tipping, never picked.
 */
export const lying = defineFighter({
  id: LYING,
  name: 'Bloxorz Block',
  series: 'Bloxorz (2007)',
  stats: { ...stats, width: 24, height: 12 },
  moves: lyingMoves,
  actions: TIP_ACTIONS,
  selectable: false,
});
