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
    {
      name: 'redball-sheet-ground',
      description:
        "Red Ball's ground attacks on their active frames: jab chain, tilts, dash attack, smashes, getup attack.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'jab@3',
              'jab3@5',
              'ftilt@7',
              'utilt@7',
              'dtilt@6',
              'dashAttack@8',
              'fsmash@16',
              'usmash@12',
              'dsmash@10',
              'getupAttack@17',
            ],
          ],
        },
      ],
      refs: [
        'smash/attack-active-*',
        `${RB}/video-roster-art-*`,
        `${RB}/official-art-01*`,
        `${RB}/ingame-roll-vs-box-*`,
      ],
    },
    {
      name: 'redball-sheet-air',
      description: "Red Ball's aerials, tongue grabs, pummel and throws on their key frames.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'nair@6',
              'fair@9',
              'bair@8',
              'uair@6',
              'dair@14',
              'grab@10',
              'pummel@2',
              'fthrow@12',
              'uthrow@18',
              'dthrow@20',
            ],
          ],
        },
      ],
      refs: [
        'smash/attack-active-*',
        `${RB}/video-roster-art-*`,
        `${RB}/official-art-02-*`,
        `${RB}/cutscene-expressions-*`,
      ],
    },
    {
      name: 'redball-sheet-specials',
      description:
        "Red Ball's Charge Roll rev and rolls, Mega Bounce, air jump, taunt, helpless and ledge catch.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'neutralB@40',
              'chargeRoll1@10',
              'chargeRoll3@10',
              'upB@7',
              'upB@10',
              'doubleJump@3',
              'taunt@13',
              'taunt@50',
              'helpless@10',
              'ledgeCatch@3',
            ],
          ],
        },
      ],
      refs: [
        `${RB}/official-art-02-*`,
        `${RB}/cutscene-expressions-*`,
        `${RB}/ingame-gameplay-*`,
        `${RB}/official-art-03-*`,
      ],
    },
    {
      name: 'redball-sheet-evil',
      description: 'Red Ball in his Evil Box costume (charcoal, orange eyes) on the key states.',
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball', palette: 'evil' } },
      calls: [{ fn: 'sheet', args: [['idle@0', 'run@6', 'fsmash@16', 'taunt@50', 'shield@10']] }],
      refs: [`${RB}/assist-gray-square-01*`, `${RB}/assist-squarified-01*`, `${RB}/cutscene-expressions-*`],
    },
    {
      name: 'redball-charge-roll',
      description:
        'Red Ball revs Charge Roll for 55 frames, lets go and rolls at top speed; capture 12 frames into the roll.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] },
      patches: [{ port: 1, state: { pos: { x: 70, y: 0 } } }],
      script: [{ port: 0, from: 10, to: 65, buttons: ['special'] }],
      capture: {
        label: "P1 move 'chargeRoll3', frame 12",
        when: (s) => s.fighters[0]!.move === 'chargeRoll3' && s.fighters[0]!.actionFrame === 12,
      },
      motion: { before: 50, after: 20 },
      requires: ['move:chargeRoll3'],
      refs: ['smash/run-*', `${RB}/ingame-roll-vs-box-*`],
    },
  ],
};
