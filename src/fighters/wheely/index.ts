import { defineFighter } from '../types';
import { actions } from './actions';
import { art } from './art';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'wheely',
  name: 'Wheely',
  series: 'Wheely (2012)',
  stats,
  moves,
  hurtbox(f) {
    if (f.action !== 'ledgeHang') return;
    const r = stats.height / 2;
    const bottom = f.pos.y - 2;
    return { x: f.pos.x + f.facing * r, y1: bottom + r, y2: bottom + stats.width - r, r };
  },
  actions,
  art,
});
