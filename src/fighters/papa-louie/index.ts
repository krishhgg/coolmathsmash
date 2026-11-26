import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';
import { statuses } from './statuses';

export const fighter = defineFighter({
  id: 'papa-louie',
  name: 'Papa Louie',
  series: 'Papa Louie: When Pizzas Attack! (2006)',
  stats,
  moves,
  entities,
  statuses,
  art,
});
