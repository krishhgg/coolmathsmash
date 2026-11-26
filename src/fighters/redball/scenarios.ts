import type { FighterScenarios } from '../../harness/scenarios';

const RB = 'characters/red-ball';

/**
 * Red Ball's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus his four jumps, the Cube Squash bounce, a full Charge Roll, Tongue Lash on a shield and reeling to
 * a ledge, and lab sheets of every move on its first active frame (zoom 10 keeps the lunges inside their cells; the
 * tongue sheet uses 5 for its 28-unit tongue). References live in the Captain drive's refs/.
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
      name: 'redball-squared',
      description:
        'Red Ball grabs Fireboy and down-throws him (Sit-Squash), which leaves him Squared; capture 40 frames in.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 10, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 0, from: 4, to: 5, buttons: ['grab'] },
        { port: 0, from: 24, to: 25, y: -100 },
      ],
      capture: {
        label: "P2's Squared status, 40 frames old",
        when: (s) => s.fighters[1]!.statuses[0]?.age === 40,
      },
      motion: { before: 50, after: 30 },
      refs: [`${RB}/assist-squarified-01*`, `${RB}/assist-gray-square-01*`],
    },
    {
      name: 'redball-sheet-ground',
      description:
        'Red Ball idle, rolling, jumping and hanging from the ledge, then every ground attack on its first active frame.',
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball', zoom: '10' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'idle@0',
              'run@6',
              'jump@4',
              'ledgeHang@0',
              'jab@3',
              'jab2@3',
              'jab3@4',
              'ftilt@6',
              'utilt@5',
              'dtilt@5',
              'dashAttack@6',
              'fsmash@15',
              'usmash@11',
              'dsmash@9',
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
      description:
        "Red Ball's aerials, grabs, Charge Roll and Mega Bounce on their first active frames, and the pummel and throws on their impact frames.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball', zoom: '10' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'nair@4',
              'fair@8',
              'bair@7',
              'uair@5',
              'dair@12',
              'grab@10',
              'dashGrab@12',
              'pivotGrab@13',
              'pummel@1',
              'fthrow@12',
              'bthrow@24',
              'uthrow@18',
              'dthrow@20',
              'chargeRoll1@2',
              'upB@8',
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
        "Red Ball's Charge Roll rev and faster rolls, Mega Bounce, air jump, dodge roll, taunt, helpless, ledge catch and grab release.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'neutralB@40',
              'chargeRoll2@2',
              'chargeRoll3@10',
              'upB@12',
              'doubleJump@3',
              'rollForward@12',
              'taunt@50',
              'helpless@10',
              'ledgeCatch@3',
              'grabRelease@4',
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
      name: 'redball-sheet-tongue',
      description:
        'Tongue Lash: the wind-up, the tongue half out, at full length on its first hit frame and snapping back, then the reel to a ledge.',
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'redball', zoom: '5' } },
      calls: [
        {
          fn: 'sheet',
          args: [['sideB@10', 'sideB@13', 'sideB@15', 'sideB@22', 'tetherPull@1', 'tetherPull@6']],
        },
      ],
      refs: [`${RB}/video-roster-art-*`, `${RB}/cutscene-expressions-*`],
    },
    {
      name: 'redball-tongue-shield',
      description:
        'Red Ball lashes Tongue Lash (side special) at a shielding Fireboy 24 units away; capture the tip hitting the shield.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -12, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 12, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 1, from: 2, to: 120, buttons: ['shield'] },
        { port: 0, from: 30, x: 100, buttons: ['special'] },
      ],
      capture: {
        label: 'P2 goes into shieldstun',
        when: (s, prev) =>
          s.fighters[1]!.action === 'shieldStun' && prev.fighters[1]!.action !== 'shieldStun',
      },
      motion: { before: 20, after: 24 },
      requires: ['move:sideB'],
      refs: ['smash/attack-active-*', 'smash/shield-0*', `${RB}/video-roster-art-*`],
    },
    {
      name: 'redball-tongue-ledge',
      description:
        'Red Ball falls off the right side of Battlefield, below the ledge, and Tongue Lashes towards it; capture the reel ending in a ledge catch.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 104, y: -5 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 4,
            facing: -1,
          },
        },
        { port: 1, state: { pos: { x: 20, y: 0 } } },
      ],
      script: [{ port: 0, from: 2, x: -100, buttons: ['special'] }],
      capture: {
        label: 'P1 catches the ledge',
        when: (s, prev) =>
          s.fighters[0]!.action === 'ledgeCatch' && prev.fighters[0]!.action !== 'ledgeCatch',
      },
      motion: { before: 22, after: 12 },
      requires: ['move:sideBAir', 'action:tetherPull'],
      refs: ['smash/ledge-hang-*', `${RB}/ingame-swing-*`],
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
