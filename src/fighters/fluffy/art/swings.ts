import type { SwingChecks } from '../../../render/rig/swingChecks';

/** Clips that spin the grabber round him along the floor. */
const TWISTERS = ['dsmash', 'getupAttack'];

/**
 * Fluffy's allowances for the swing checks (`src/render/rig/swingChecks.ts`); his clips are sorted into ground and
 * air by the shared defaults.
 */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  spins: [
    {
      bone: 'grab',
      why: 'Tail Twister and the getup attack spin the line round him along the floor: drawn in short, it turns round as it passes in front of or behind the ball.',
      clips: TWISTERS,
    },
    { bone: 'tip', why: 'The ball on the end of that line, which turns with it.', clips: TWISTERS },
    {
      bone: 'fur',
      why: "Fuzz Frenzy's grind spins the fur alone against the foe, 13 times round.",
      clips: ['finalSmashCinematic'],
    },
  ],
};
