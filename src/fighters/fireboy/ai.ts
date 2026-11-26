import type { CpuHints } from '../../ai/hints';

/**
 * The CPU follows the Fireball through its probe and flight (src/ai/shots.ts), but it can't tell what the Temple
 * Mirror's reflector is for yet, so it leaves the mirror alone.
 */
export const ai: CpuHints = { avoid: ['sideB'] };
