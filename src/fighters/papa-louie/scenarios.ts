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
      name: 'papa-louie-pepper-bomb',
      description:
        'Papa lobs a Pepper Bomb across Battlefield; it bounces twice and bursts on the third landing.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      patches: [{ port: 1, state: { pos: { x: 60, y: 0 }, facing: -1 } }],
      script: [{ port: 0, from: 10, buttons: ['special'] }],
      capture: {
        label: 'The bomb bursts',
        when: (s) => s.entities.some((e) => e.kind === 'papa-louie/pepperBurst' && e.age === 1),
      },
      motion: { before: 66, after: 12 },
      requires: ['move:neutralB'],
      refs: [`${PAPA}/item-pepper-bomb-*`, `${PAPA}/ingame-pepper-bomb-hit-*`],
    },
  ],
};
