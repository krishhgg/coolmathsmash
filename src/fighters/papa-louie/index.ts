import { defineFighter } from '../types';
import { art } from './art';
import { entities } from './entities';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'papa-louie',
  name: 'Papa Louie',
  series: 'Papa Louie: When Pizzas Attack! (2006)',
  stats,
  moves,
  art,
  entities,
});
