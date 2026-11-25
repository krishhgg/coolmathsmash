import type { FighterScenarios } from '../../harness/scenarios';

const BX = 'characters/bloxorz';

/**
 * Bloxorz block's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus tipping, lying down, the jab chain, Roll and Heavy Switch. References live in the Captain drive's
 * refs/.
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
      motion: { before: 20, after: 50 },
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
  ],
};
