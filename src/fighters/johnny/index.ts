import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';
import { meters, statuses, upgradeEntities } from './upgrade';

export const fighter = defineFighter({
  id: 'johnny',
  name: 'Johnny Upgrade',
  series: 'Johnny Upgrade (2012)',
  stats,
  moves,
  entities: { ...entities, ...upgradeEntities },
  meters,
  statuses,
  art,
});
