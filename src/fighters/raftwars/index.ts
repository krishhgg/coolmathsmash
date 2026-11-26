import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { grenadeEntities } from './grenade';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'raftwars',
  name: 'Raft Wars Kids',
  series: 'Raft Wars (2007)',
  stats,
  moves,
  entities: { ...entities, ...grenadeEntities },
  art,
});
