/**
 * watergirl's clips that fail a swing check today. src/fighters/swingChecks.test.ts reads every fighter's list and
 * expects it to be exact: fixing a clip means taking it out of here, and a listed clip that passes fails the test.
 */
export const knownFailures: readonly string[] = [
  'finalSmash',
  'finalSmashAir',
  'ftilt',
  'jab',
  'jab2',
  'jab3',
  'neutralB',
  'neutralBHeavy',
  'upB',
];
