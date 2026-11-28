/**
 * fluffy's clips that fail a swing check today. src/fighters/swingChecks.test.ts reads every fighter's list and
 * expects it to be exact: fixing a clip means taking it out of here, and a listed clip that passes fails the test.
 */
export const knownFailures: readonly string[] = [
  'bair',
  'dashAttack',
  'dashGrab',
  'downB',
  'dsmash',
  'dtilt',
  'fair',
  'finalSmash',
  'finalSmashCinematic',
  'fsmash',
  'ftilt',
  'getupAttack',
  'getupRoll',
  'getupRollBack',
  'grab',
  'jab',
  'jab2',
  'jab3',
  'ledgeClimb',
  'ledgeJump',
  'neutralB',
  'pivotGrab',
  'pummel',
  'rollBack',
  'rollForward',
  'techInPlace',
  'techRoll',
  'techRollBack',
];
