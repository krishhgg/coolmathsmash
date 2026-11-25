import type { CpuHints } from '../../ai/hints';

/**
 * The CPU reads a move's reach from the hitboxes it probes, so it can't predict the Fireball (an entity, not a
 * hitbox) or what the Temple Mirror's reflector is for yet; it leaves both alone until it learns entities.
 */
export const ai: CpuHints = { avoid: ['neutralB', 'sideB'] };
