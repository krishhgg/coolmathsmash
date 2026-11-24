import type { FighterScenarios, LabScenario } from '../../harness/scenarios';

const JU = 'characters/johnny-upgrade';

/** A lab contact sheet of Johnny's rig at `states` (clip@frame), in `palette`. */
const sheet = (
  name: string,
  description: string,
  states: string[],
  refs: string[],
  palette = 'default',
): LabScenario => ({
  name: `johnny-${name}`,
  description,
  page: {
    kind: 'lab',
    scene: 'fighter',
    params: { fighter: 'johnny', sheet: '1', states: states.join(','), palette },
  },
  refs,
});

/**
 * Johnny Upgrade's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus lab contact sheets of his movement, airborne and hurt clips, his attacks, grabs and specials, and
 * each alternate costume. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'johnny',
  refs: {
    idle: [
      'smash/battlefield-idle-1v1-*',
      `${JU}/ingame-idle-01*`,
      `${JU}/frames-idle-*`,
      `${JU}/official-art-04*`,
    ],
    run: ['smash/run-*', `${JU}/ingame-run-*`, `${JU}/frames-run-01*`],
    'jump-apex': ['smash/jump-apex-*', `${JU}/frames-run-02*`, `${JU}/official-art-02*`],
    'attack-active': ['smash/attack-active-*', `${JU}/official-art-02*`, `${JU}/sprite-sheet-01*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${JU}/ingame-hurt-*`, `${JU}/ingame-explode-*`],
    shield: ['smash/shield-0*', `${JU}/frames-idle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${JU}/sprite-sheet-01*`],
    sheet: [
      `${JU}/sprite-sheet-01*`,
      `${JU}/official-art-04*`,
      `${JU}/ingame-idle-01*`,
      `${JU}/sprite-sheet-02*`,
    ],
  },
  extra: [
    sheet(
      'movement',
      'Run, walk, dash, run brake, turnaround, crouch and landing key poses.',
      [
        'run@0',
        'run@6',
        'run@12',
        'run@18',
        'walk@0',
        'walk@10',
        'dash@0',
        'dash@4',
        'runBrake@0',
        'turn@0',
        'turn@3',
        'turn@6',
        'crouch@6',
        'land@0',
        'land@3',
      ],
      [`${JU}/frames-run-01*`, `${JU}/ingame-run-*`, `${JU}/frames-idle-*`],
    ),
    sheet(
      'air-hurt',
      'Jump squat to apex, the double-jump flip, the fall loop, shield, hitstun and tumble.',
      [
        'jumpSquat@3',
        'jump@0',
        'jump@20',
        'jump@40',
        'doubleJump@4',
        'doubleJump@10',
        'doubleJump@18',
        'fall@0',
        'fall@8',
        'fall@16',
        'shield@6',
        'hitstun@0',
        'hitstun@10',
        'tumble@0',
        'tumble@12',
      ],
      [`${JU}/frames-run-02*`, `${JU}/ingame-hurt-*`, `${JU}/ingame-explode-*`, `${JU}/sprite-sheet-01*`],
    ),
    sheet(
      'attacks',
      'The first active frame of each normal: jab chain, tilts, dash attack, smashes and aerials.',
      [
        'jab@3',
        'jab2@4',
        'jab3@6',
        'ftilt@8',
        'utilt@15',
        'dtilt@10',
        'dashAttack@8',
        'fsmash@19',
        'usmash@21',
        'dsmash@16',
        'nair@7',
        'fair@14',
        'bair@10',
        'uair@8',
        'dair@17',
      ],
      ['smash/attack-active-*', `${JU}/official-art-02*`, `${JU}/frames-run-02*`],
    ),
    sheet(
      'grabs-specials',
      'Grab, dash grab, pummel, the four throws, getup attack, Upgrade Dash and Double-Jump Boots.',
      [
        'grab@7',
        'dashGrab@10',
        'pummel@2',
        'fthrow@13',
        'bthrow@13',
        'uthrow@14',
        'dthrow@21',
        'getupAttack@17',
        'sideB@10',
        'sideB@17',
        'upB@9',
        'upB@15',
      ],
      ['smash/attack-active-*', `${JU}/official-art-02*`, `${JU}/sprite-sheet-01*`],
    ),
    ...['plain', 'blue', 'green', 'gold'].map((palette) =>
      sheet(
        `costume-${palette}`,
        `The ${palette} costume in idle, run, jump and forward smash.`,
        ['idle@0', 'run@6', 'jump@0', 'fsmash@19'],
        [`${JU}/official-art-04*`, `${JU}/ingame-noskills-confused-*`, `${JU}/official-art-02*`],
        palette,
      ),
    ),
  ],
};
