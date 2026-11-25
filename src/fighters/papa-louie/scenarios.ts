import type { FighterScenarios } from '../../harness/scenarios';

const PAPA = 'characters/papa-louie';

export const scenarios: FighterScenarios = {
  fighter: 'papa-louie',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${PAPA}/official-art-standing-*`, `${PAPA}/ingame-idle-*`],
    run: ['smash/run-*', `${PAPA}/ingame-run-*`, `${PAPA}/sprite-run-anim-*`],
    'jump-apex': ['smash/jump-apex-*', `${PAPA}/ingame-jungle-*`, `${PAPA}/ingame-glide-*`],
    'attack-active': [
      'smash/attack-active-*',
      `${PAPA}/ingame-attack-paddle-*`,
      `${PAPA}/official-art-paddle-*`,
    ],
    'launch-high-percent': ['smash/launch-high-percent-*', `${PAPA}/ingame-attack-paddle-*`],
    shield: ['smash/shield-0*', `${PAPA}/official-art-paddle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${PAPA}/ingame-glide-*`],
    sheet: [
      `${PAPA}/official-art-standing-*`,
      `${PAPA}/official-art-card-*`,
      `${PAPA}/official-art-paddle-*`,
    ],
  },
  extra: [
    {
      name: 'papa-louie-propeller',
      description: 'Papa spins his pizza peel overhead as his up special carries him off the floor.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      script: [{ port: 0, from: 12, y: 100, buttons: ['special'] }],
      capture: {
        label: 'Paddle Propeller rises through the second hit window',
        when: (s) => s.fighters[0]!.move === 'upB' && s.fighters[0]!.actionFrame === 10,
      },
      motion: { before: 14, after: 40 },
      requires: ['move:upB'],
      refs: [`${PAPA}/ingame-glide-*`, `${PAPA}/official-art-paddle-*`],
    },
    {
      name: 'papa-louie-deflect',
      description: 'Papa plants his feet and catches an approach with the edge of the peel.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 10, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 12, y: -100, buttons: ['special'] }],
      capture: {
        label: 'Paddle Deflect reaches its first active frame',
        when: (s) => s.fighters[0]!.move === 'downB' && s.fighters[0]!.actionFrame === 5,
      },
      motion: { before: 8, after: 25 },
      requires: ['move:downB'],
      refs: [`${PAPA}/official-art-paddle-*`, `${PAPA}/ingame-attack-paddle-*`],
    },
    {
      name: 'papa-louie-roy',
      description: "Papa's Roy costume swaps the chef's toque for the blue-and-red Pizzeria cap.",
      page: {
        kind: 'lab',
        scene: 'fighter',
        params: { fighter: 'papa-louie', palette: 'roy', clip: 'idle', frame: '0', zoom: '20' },
      },
      refs: [`${PAPA}/alt-roy-pauly-*`],
    },
  ],
};
