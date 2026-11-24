import type { MoveDef } from '../types';

/**
 * Fireboy and Watergirl's down special, Swap (roster): the active twin dives into a splash of fire or water and
 * the other bursts out on frame 18, intangible through frame 32 and actionable on frame 51. It works on the
 * ground and in the air, where it doesn't refresh jumps. The twins are one fighter: one %, one stock count.
 */
export function swap(into: string): MoveDef {
  return { kind: 'other', faf: 51, intangible: [18, 32], transform: { frame: 18, into }, hits: [] };
}
