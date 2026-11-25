import type { FighterScenarios, GameScenario } from '../../harness/scenarios';

const F = 'characters/fluffy';
const VS_FIREBOY = { ports: [{ fighter: 'fluffy' }, { fighter: 'fireboy' }] };

/** Fluffy and Fireboy face to face, 12 units apart. */
const faceOff = (fluffy = {}, fireboy = {}): GameScenario['patches'] => [
  { port: 0, state: { pos: { x: -6, y: 0 }, facing: 1, ...fluffy } },
  { port: 1, state: { pos: { x: 6, y: 0 }, facing: -1, ...fireboy } },
];

/**
 * Fluffy's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus his Grabber Whip, Stick Tight, Fluffy himself launched at high percent, and four Fluffys in their
 * costumes. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'fluffy',
  refs: {
    idle: [
      'smash/battlefield-idle-1v1-*',
      `${F}/official-art-01-*`,
      `${F}/ingame-closeup-*`,
      `${F}/official-art-04-*`,
    ],
    run: ['smash/run-*', `${F}/official-art-01-*`, `${F}/ingame-level-01*`],
    'jump-apex': ['smash/jump-apex-*', `${F}/official-art-03-*`, `${F}/ingame-level-02*`],
    'attack-active': ['smash/attack-active-*', `${F}/ingame-grab-closeup-*`, `${F}/official-art-02-*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${F}/official-art-05-*`],
    shield: ['smash/shield-0*', `${F}/official-art-01-*`, `${F}/official-art-03-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${F}/official-art-03-*`, `${F}/ingame-level-02*`],
    sheet: [`${F}/official-art-*`, `${F}/ingame-*`, `${F}/video-roster-art-*`],
  },
  extra: [
    {
      name: 'fluffy-ledge-climb',
      description:
        'Fluffy catches the left ledge, hangs, then pulls himself onto Battlefield with his grabber.',
      page: { kind: 'game' },
      match: VS_FIREBOY,
      patches: [
        {
          port: 0,
          state: {
            pos: { x: -86, y: 6 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            facing: 1,
            jumpsUsed: 1,
          },
        },
      ],
      script: [{ port: 0, from: 44, to: 46, x: 100 }],
      capture: {
        label: "P1 action 'ledgeClimb', frame 12",
        when: (s) => s.fighters[0]!.action === 'ledgeClimb' && s.fighters[0]!.actionFrame === 12,
      },
      motion: { before: 31, after: 28 },
      requires: ['action:ledgeClimb'],
      refs: ['smash/ledge-hang-*', `${F}/official-art-03-*`, `${F}/ingame-grab-closeup-*`],
    },
    {
      name: 'fluffy-ftilt',
      description:
        'Fluffy forward tilt (Grabber Whip) into Fireboy at 0%; capture its first active frame (7-9).',
      page: { kind: 'game' },
      match: VS_FIREBOY,
      patches: faceOff(),
      script: [
        { port: 0, from: 10, to: 12, x: 60 },
        { port: 0, from: 10, buttons: ['attack'] },
      ],
      capture: {
        label: "P1 move 'ftilt', action frame >= 7",
        when: (s) => s.fighters[0]!.move === 'ftilt' && s.fighters[0]!.actionFrame >= 7,
      },
      motion: { before: 10, after: 30 },
      requires: ['move:ftilt'],
      refs: ['smash/attack-active-*', `${F}/ingame-grab-*`, `${F}/official-art-02-*`],
    },
    {
      name: 'fluffy-stick-tight',
      description:
        'Fluffy down special (Stick Tight): the grabber planted and braced, armoured from frame 4 to 60.',
      page: { kind: 'game' },
      match: VS_FIREBOY,
      script: [{ port: 0, from: 10, to: 12, y: -100, buttons: ['special'] }],
      capture: {
        label: "P1 move 'downB', action frame >= 20",
        when: (s) => s.fighters[0]!.move === 'downB' && s.fighters[0]!.actionFrame >= 20,
      },
      motion: { before: 15, after: 60 },
      requires: ['move:downB'],
      refs: [`${F}/official-art-03-*`, `${F}/ingame-grab-*`],
    },
    {
      name: 'fluffy-launched',
      description:
        "Fluffy at 150% takes Fireboy's forward smash; capture the first frame of his tumble, still on camera.",
      page: { kind: 'game' },
      match: VS_FIREBOY,
      patches: faceOff({ damage: 150 }),
      script: [{ port: 1, from: 10, to: 12, cx: -100 }],
      capture: {
        label: "P1 action 'tumble', frame >= 1",
        when: (s) => s.fighters[0]!.action === 'tumble' && s.fighters[0]!.actionFrame >= 1,
      },
      motion: { before: 40, after: 30 },
      requires: ['action:tumble'],
      refs: ['smash/launch-high-percent-*', `${F}/official-art-05-*`, `${F}/official-art-03-*`],
    },
    {
      name: 'fluffy-costumes',
      description: 'Four Fluffys at their spawns, one second in: each port wears a different costume.',
      page: { kind: 'game' },
      match: {
        ports: [{ fighter: 'fluffy' }, { fighter: 'fluffy' }, { fighter: 'fluffy' }, { fighter: 'fluffy' }],
      },
      capture: { frame: 60 },
      refs: [`${F}/official-art-*`, `${F}/coolmath-*`],
    },
  ],
};
