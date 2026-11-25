import type { FighterScenarios } from '../../harness/scenarios';

/**
 * Watergirl's capture states (docs/hill-climb.md). She is only reached by Fireboy's swap in play, but the harness
 * can start a match with her, so she gets the standard set against Fireboy. Like his, the references are Smash
 * Ultimate's presentation frames only while the rig wears the placeholder mannequin (KRI-29).
 */
export const scenarios: FighterScenarios = {
  fighter: 'watergirl',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*'],
    run: ['smash/run-*'],
    'jump-apex': ['smash/jump-apex-*'],
    'attack-active': ['smash/attack-active-*'],
    'launch-high-percent': ['smash/launch-high-percent-*'],
    shield: ['smash/shield-0*'],
    'ledge-hang': ['smash/ledge-hang-0*'],
  },
};
