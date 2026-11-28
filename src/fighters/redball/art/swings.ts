import type { SwingChecks } from '../../../render/rig/swingChecks';

/**
 * Effects drawn across the floor line on purpose, left out of the floor check, each with why. They are all drawn
 * from effect bones (fx1-fx4), never the ball.
 */
export const FLOOR_FX: Record<string, string> = {
  dust: 'dust puffs sit on the floor where he skids or rolls, their lower halves across the floor line',
  ring: 'the shockwave ring of a bounce lies flat on the floor in perspective',
  swirl: 'spin arcs circle the whole ball, so the lower arc runs under the floor where he sits on it',
  pop: 'a pop bursts rays all round the ball, so its lower rays cross the floor when he is on it',
  flash:
    "the full-charge flare's glow ring sits just outside the ball, so it crosses the floor when he is on it",
};

/** Clips where he rolls, flips or spins: his face rides round the ball with them. */
const SPINNING = [
  'taunt',
  'fsmash',
  'neutralB',
  'chargeRoll1',
  'chargeRoll2',
  'chargeRoll3',
  'getupAttack',
  'airDodge',
  'ledgeAttack',
];

/** Red Ball's allowances for the swing checks (`src/render/rig/swingChecks.ts`); his clips are sorted by default. */
export const swingChecks: SwingChecks = {
  ground: [],
  air: [],
  decals: Object.keys(FLOOR_FX),
  spins: [
    {
      bone: 'face',
      why: 'he is a ball: rolling, flipping and spinning turn his face round with him (the spin bone)',
      clips: SPINNING,
    },
  ],
};
