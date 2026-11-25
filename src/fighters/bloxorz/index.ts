import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'bloxorz',
  name: 'Bloxorz Block',
  series: 'Bloxorz (2007)',
  stats,
  moves,
});
