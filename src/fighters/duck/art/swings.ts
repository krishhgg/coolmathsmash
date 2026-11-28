import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * The Duck's allowances for the swing checks (`src/render/rig/swingChecks.ts`); his clips are sorted into ground and
 * air by the shared defaults.
 */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  /**
   * Running Ram's charge glow and Evolved Stomp's glow (`fxGlow1` to `fxGlow3`): a soft disc of light behind him,
   * up to twice as wide as he is tall, that spills over the edge of the floor he stands on.
   */
  decals: ['fxGlow'],
};
