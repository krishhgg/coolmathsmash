import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'snailbob',
  name: 'Snail Bob',
  series: 'Snail Bob (2010)',
  stats,
  /**
   * Rocket Hover's tank, on R.O.B.'s Robo Burner in Ultimate: 143 frames of thrust (ultimateframedata.com), refilled
   * from empty in HOVER_REFILL_FRAMES (about 1.5 s) on the ground. Ultimate's rise speed is unpublished, so the
   * thrust tops out at the engine's reference 1 unit/frame (docs/fighters.md, "Air mobility").
   */
  hover: { fuel: 143, rise: 1, accel: 0.1 },
  moves,
  art,
  entities,
});
