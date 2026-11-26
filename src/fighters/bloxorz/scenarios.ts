import type { FighterScenarios, LabScenario } from '../../harness/scenarios';

const BX = 'characters/bloxorz';

/**
 * Lab contact sheets of one form (`bloxorz` Standing or `bloxorz-lying`): its movement and defence clips, every
 * ground move on its first active frame, then the aerials, grabs and specials on theirs and the throws on their
 * release frames. Lying's own Tip Over hits from frame 8.
 */
function sheets(fighter: 'bloxorz' | 'bloxorz-lying'): LabScenario[] {
  const form = fighter === 'bloxorz' ? 'Standing' : 'Lying';
  const lab = (zoom: string) => ({ kind: 'lab', scene: 'fighter', params: { fighter, zoom } }) as const;
  return [
    {
      name: `${fighter}-sheet-moves`,
      description: `Bloxorz block (${form}) at rest, mid-tip, jumping, defending, hanging and hurt.`,
      page: lab('7'),
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'idle@0',
              'walk@7',
              'run@5',
              'crouch@10',
              'jump@4',
              'doubleJump@8',
              'fall@8',
              'helpless@10',
              'shield@8',
              'spotDodge@10',
              'rollForward@12',
              'airDodge@12',
              'ledgeHang@0',
              'ledgeClimb@12',
              'hitstun@2',
              'tumble@8',
              'down@0',
              'taunt@30',
            ],
          ],
        },
      ],
      refs: [`${BX}/ingame-idle-*`, `${BX}/ingame-roll-*`, `${BX}/ingame-lying-*`, `${BX}/ingame-fall-*`],
    },
    {
      name: `${fighter}-sheet-ground`,
      description: `Bloxorz block (${form}): every ground attack on its first active frame.`,
      page: lab('5'),
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'jab@5',
              'jab2@6',
              fighter === 'bloxorz' ? 'ftilt@12' : 'ftilt@8',
              'utilt@9',
              'dtilt@8',
              'dashAttack@10',
              'fsmash@20',
              'usmash@14',
              'dsmash@13',
              'getupAttack@17',
              'ledgeAttack@24',
            ],
          ],
        },
      ],
      refs: ['smash/attack-active-*', `${BX}/ingame-roll-*`, `${BX}/ingame-lying-*`],
    },
    {
      name: `${fighter}-sheet-air`,
      description: `Bloxorz block (${form}): aerials, grabs, Roll, Switch Bridge and Heavy Switch on their first active frames, and the throws on their release frames.`,
      page: lab('5'),
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'nair@8',
              'fair@11',
              'bair@10',
              'uair@9',
              'dair@16',
              'grab@9',
              'dashGrab@11',
              'pivotGrab@12',
              'pummel@1',
              'fthrow@16',
              'bthrow@30',
              'uthrow@20',
              'dthrow@22',
              'sideB@12',
              'upB@20',
              'upB@34',
              'downB@14',
            ],
          ],
        },
      ],
      refs: ['smash/attack-active-*', `${BX}/ability-switch-types-*`, `${BX}/ingame-fall-*`],
    },
  ];
}

/**
 * Bloxorz block's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus tipping, lying down, the jab chain, Roll and Heavy Switch, and lab sheets of both forms. References
 * live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'bloxorz',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${BX}/ingame-idle-*`, `${BX}/official-art-*`],
    run: ['smash/run-*', `${BX}/ingame-roll-*`, `${BX}/ingame-lying-*`],
    'jump-apex': ['smash/jump-apex-*', `${BX}/ingame-fall-*`],
    'attack-active': ['smash/attack-active-*', `${BX}/ingame-lying-*`, `${BX}/ingame-roll-*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${BX}/ingame-fall-*`],
    shield: ['smash/shield-0*', `${BX}/ingame-idle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${BX}/ingame-fall-*`],
    sheet: [`${BX}/official-art-*`, `${BX}/sprite-sheet-*`, `${BX}/ingame-*`],
  },
  extra: [
    {
      name: 'bloxorz-walk-tip',
      description:
        'Bloxorz block walks right; capture the frame it passes its balance point and turns from Standing to Lying.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -60, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 60, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 10, to: 120, x: 50 }],
      capture: {
        label: "P1 turns from 'bloxorz' to 'bloxorz-lying'",
        when: (s, prev) =>
          prev.fighters[0]!.fighter === 'bloxorz' && s.fighters[0]!.fighter === 'bloxorz-lying',
      },
      motion: { before: 20, after: 50 },
      refs: ['smash/run-*', `${BX}/ingame-roll-*`, `${BX}/ingame-lying-*`],
    },
    {
      name: 'bloxorz-crouch',
      description:
        'Bloxorz block holds down and lies on its side (its crouch); capture it lying 10 frames in.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      script: [{ port: 0, from: 10, to: 60, y: -100 }],
      capture: {
        label: "P1 action 'crouch', frame 10",
        when: (s) => s.fighters[0]!.action === 'crouch' && s.fighters[0]!.actionFrame === 10,
      },
      motion: { before: 12, after: 20 },
      refs: [`${BX}/ingame-lying-*`, `${BX}/ingame-idle-*`],
    },
    {
      name: 'bloxorz-jab-chain',
      description:
        'Bloxorz block jabs twice into Fireboy (Edge Rock, then jab2); capture the second rock landing.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -12, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 2, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 0, from: 10, buttons: ['attack'] },
        { port: 0, from: 19, buttons: ['attack'] },
      ],
      capture: {
        label: "P1 move 'jab2' and P2's damage rises",
        when: (s, prev) => s.fighters[0]!.move === 'jab2' && s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 25, after: 20 },
      requires: ['move:jab2'],
      refs: ['smash/attack-active-*', `${BX}/ingame-roll-*`],
    },
    {
      name: 'bloxorz-roll',
      description:
        'Bloxorz block uses Roll (side special) into Fireboy; capture the first slam, then the whole roll.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -40, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: -8, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 10, x: 100, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 20, after: 75 },
      requires: ['move:sideB'],
      refs: [`${BX}/ingame-roll-*`, `${BX}/ingame-lying-*`, 'smash/attack-active-*'],
    },
    {
      name: 'bloxorz-heavy-switch',
      description:
        'Bloxorz block uses Heavy Switch (down special) next to Fireboy; capture the quake hitting him.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -10, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 30, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 10, y: -100, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 20, after: 30 },
      requires: ['move:downB'],
      refs: [`${BX}/ability-switch-types-*`, `${BX}/ingame-idle-*`, 'smash/attack-active-*'],
    },
    {
      name: 'bloxorz-switch-bridge',
      description:
        'Bloxorz block uses Switch Bridge (up special) beside Fireboy; capture the bridge flinging it up into him.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -10, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: -2, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 10, y: 100, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 40, after: 30 },
      requires: ['move:upB'],
      refs: [`${BX}/ingame-fall-*`, `${BX}/ingame-idle-*`, 'smash/attack-active-*'],
    },
    {
      name: 'bloxorz-switch-bridge-recovery',
      description:
        'Bloxorz block falls past the right ledge, uses Switch Bridge from below it and grabs the ledge on the way up.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 88, y: -40 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            facing: -1,
            jumpsUsed: 2,
          },
        },
      ],
      script: [{ port: 0, from: 10, y: 100, buttons: ['special'] }],
      capture: {
        label: "P1 action 'ledgeHang', frame >= 10",
        when: (s) => s.fighters[0]!.action === 'ledgeHang' && s.fighters[0]!.actionFrame >= 10,
      },
      motion: { before: 60, after: 20 },
      requires: ['move:upB'],
      refs: ['smash/ledge-hang-*', `${BX}/ingame-fall-*`],
    },
    ...sheets('bloxorz'),
    ...sheets('bloxorz-lying'),
  ],
};
