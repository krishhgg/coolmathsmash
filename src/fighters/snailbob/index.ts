import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'snailbob',
  name: 'Snail Bob',
  series: 'Snail Bob (2010)',
  stats,
  /** Rocket Hover's tank: 120 frames of thrust (roster), rising like the engine's hover reference. */
  hover: { fuel: 120, rise: 1, accel: 0.1 },
  moves,
});
