import type { FighterScenarios } from '../../harness/scenarios';

const RB = 'characters/red-ball';

/**
 * Red Ball's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus his four jumps and the Cube Squash bounce. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'redball',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${RB}/ingame-idle-*`, `${RB}/official-art-*`],
    run: ['smash/run-*', `${RB}/ingame-roll-vs-box-*`, `${RB}/coolmath-thumb-*`],
    'jump-apex': ['smash/jump-apex-*', `${RB}/ingame-gameplay-*`, `${RB}/ingame-idle-02-*`],
    'attack-active': ['smash/attack-active-*', `${RB}/video-roster-art-*`, `${RB}/official-art-01*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${RB}/official-art-02-*`],
    shield: ['smash/shield-0*', `${RB}/ingame-idle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${RB}/ingame-swing-*`],
    sheet: [`${RB}/official-art-*`, `${RB}/cutscene-expressions-*`, `${RB}/ingame-*`, `${RB}/title-screen-*`],
  },
  extra: [
    {
      name: 'redball-air-jumps',
      description: 'Red Ball full hops, then uses all three midair jumps; capture the apex of the last one.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] },
      script: [
        { port: 0, from: 10, to: 22, buttons: ['jump'] },
        { port: 0, from: 40, buttons: ['jump'] },
        { port: 0, from: 60, buttons: ['jump'] },
        { port: 0, from: 80, buttons: ['jump'] },
      ],
      capture: {
        label: 'P1 on its 4th jump, vel.y turns <= 0',
        when: (s, prev) =>
          s.fighters[0]!.jumpsUsed === 4 && prev.fighters[0]!.vel.y > 0 && s.fighters[0]!.vel.y <= 0,
      },
      motion: { before: 80, after: 20 },
      refs: ['smash/jump-apex-*', `${RB}/ingame-gameplay-*`],
    },
    {
      name: 'redball-dair-bounce',
      description:
        'Red Ball drops a Cube Squash (down air) onto Fireboy at 50%; capture the hit, then the bounce back up.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 0, y: 26 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 1,
            facing: 1,
          },
        },
        { port: 1, state: { pos: { x: 0, y: 0 }, damage: 50 } },
      ],
      script: [{ port: 0, from: 4, y: -100, buttons: ['attack'] }],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 20, after: 30 },
      requires: ['move:dair'],
      refs: ['smash/attack-active-*', `${RB}/ingame-roll-vs-box-*`, `${RB}/assist-gray-square-01*`],
    },
  ],
};
