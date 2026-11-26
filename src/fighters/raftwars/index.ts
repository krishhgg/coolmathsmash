import { defineFighter } from '../types';
import { aimedShotEntities } from './aimedShot';
import { art } from './art';
import { duckRaftEntities, raftMeters } from './duckRaft';
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
  entities: { ...entities, ...grenadeEntities, ...aimedShotEntities, ...duckRaftEntities },
  meters: raftMeters,
  art,
});
