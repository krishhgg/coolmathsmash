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
        label: 'Paddle Propeller kicks through the finishing hit',
        when: (s) => s.fighters[0]!.move === 'upB' && s.fighters[0]!.actionFrame === 28,
      },
      motion: { before: 31, after: 18 },
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
        { port: 1, state: { pos: { x: 24, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 1, from: 7, to: 13, x: -100 },
        { port: 0, from: 12, y: -100, buttons: ['special'] },
      ],
      capture: {
        label: 'Paddle Deflect reaches its first active frame',
        when: (s) => s.fighters[0]!.move === 'downB' && s.fighters[0]!.actionFrame === 5,
      },
      motion: { before: 8, after: 25 },
      requires: ['move:downB'],
      refs: [`${PAPA}/official-art-paddle-*`, `${PAPA}/ingame-attack-paddle-*`],
    },
    {
      name: 'papa-louie-poses',
      description: 'The chef silhouette and his movement and paddle poses at the same lab scale.',
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'papa-louie', zoom: '8' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'idle@0',
              'dash@2',
              'run@7',
              'jump@28',
              'fall@8',
              'fsmash@10',
              'fsmash@16',
              'upB@28',
              'downB@5',
              'ledgeHang@0',
            ],
          ],
        },
      ],
      refs: [
        `${PAPA}/official-art-standing-*`,
        `${PAPA}/ingame-run-*`,
        `${PAPA}/ingame-attack-paddle-*`,
        `${PAPA}/ingame-glide-*`,
      ],
    },
    {
      name: 'papa-louie-brick-oven',
      description: 'Papa scoops up Fireboy on his peel and shoves him backwards into the brick oven.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 11, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 0, from: 10, buttons: ['grab'] },
        { port: 0, from: 22, x: -100 },
      ],
      capture: {
        label: 'Brick Oven releases the throw',
        when: (s) => s.fighters[0]!.move === 'bthrow' && s.fighters[0]!.actionFrame === 30,
      },
      motion: { before: 24, after: 17 },
      requires: ['move:bthrow'],
      refs: [`${PAPA}/official-art-paddle-*`, `${PAPA}/ingame-run-*`],
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
