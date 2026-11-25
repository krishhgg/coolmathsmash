import type { FighterScenarios } from '../../harness/scenarios';

const SB = 'characters/snail-bob';

/**
 * Snail Bob's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus the Shell Pound's landing shockwave. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'snailbob',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${SB}/official-art-01*`, `${SB}/ingame-sb1-crawl-*`],
    run: ['smash/run-*', `${SB}/ingame-sb1-crawl-*`, `${SB}/official-art-02*`],
    'jump-apex': ['smash/jump-apex-*', `${SB}/official-art-02*`, `${SB}/official-art-03*`],
    'attack-active': ['smash/attack-active-*', `${SB}/official-art-01*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${SB}/official-art-03*`],
    shield: ['smash/shield-0*', `${SB}/shell-01*`],
    'ledge-hang': ['smash/ledge-hang-*', `${SB}/official-art-03*`],
    sheet: [`${SB}/official-art-*`, `${SB}/ingame-sb1-crawl-*`, `${SB}/shell-*`, `${SB}/alt-*`],
  },
  extra: [
    {
      name: 'snailbob-dair-pound',
      description:
        'Snail Bob drops a Shell Pound (down air) from a full hop beside Fireboy at 60%; capture the landing ' +
        'shockwave (dairLand), then the shell flipping back over.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'snailbob' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 0, y: 24 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 1,
            facing: 1,
          },
        },
        { port: 1, state: { pos: { x: 8, y: 0 }, damage: 60, facing: -1 } },
      ],
      script: [{ port: 0, from: 4, y: -100, buttons: ['attack'] }],
      capture: {
        label: "P1 move 'dairLand', first frame",
        when: (s, prev) => s.fighters[0]!.move === 'dairLand' && prev.fighters[0]!.move !== 'dairLand',
      },
      motion: { before: 30, after: 30 },
      requires: ['move:dair'],
      refs: ['smash/attack-active-*', `${SB}/shell-01*`],
    },
  ],
};
