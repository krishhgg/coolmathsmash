import { defineFighter } from '../types';
import { moves } from './moves';
import { stats } from './stats';

export const fighter = defineFighter({
  id: 'papa-louie',
  name: 'Papa Louie',
  series: 'Papa Louie: When Pizzas Attack! (2006)',
  stats,
  moves,
  glide: { speed: 1.2, fallSpeed: 0.6 },
});
