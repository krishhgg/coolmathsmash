import type { FighterScenarios } from '../../harness/scenarios';

const W = 'characters/wheelie';

export const scenarios: FighterScenarios = {
  fighter: 'wheely',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${W}/sprite-idle-side-*`, `${W}/official-art-02*`],
    run: ['smash/run-*', `${W}/video-thumb-ingame-driving-*`, `${W}/sprite-idle-side-*`],
    'jump-apex': ['smash/jump-apex-*', `${W}/video-thumb-ingame-road-*`, `${W}/official-art-03*`],
    'attack-active': ['smash/attack-active-*', `${W}/official-art-01*`, `${W}/sprite-eyes-expressions-*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${W}/sprite-eyes-expressions-*`],
    shield: ['smash/shield-0*', `${W}/sprite-idle-side-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${W}/sprite-idle-side-*`],
    sheet: [
      `${W}/sprite-idle-side-*`,
      `${W}/sprite-eyes-expressions-*`,
      `${W}/official-art-*`,
      `${W}/story-art-*`,
    ],
  },
  extra: [
    {
      name: 'wheely-three-point-turn',
      description:
        'Wheely runs right for a second, then holds left: capture the frame he swings round (turn frame 12).',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'wheely' }, { fighter: 'fireboy' }] },
      patches: [{ port: 0, state: { pos: { x: -70, y: 0 }, facing: 1 } }],
      script: [
        { port: 0, from: 10, to: 70, x: 100 },
        { port: 0, from: 70, to: 120, x: -100 },
      ],
      capture: {
        label: 'P1 turn, facing flips',
        when: (s, prev) =>
          s.fighters[0]!.action === 'turn' && s.fighters[0]!.facing !== prev.fighters[0]!.facing,
      },
      motion: { before: 25, after: 25 },
      requires: ['action:turn'],
      refs: ['smash/run-*', `${W}/video-thumb-ingame-driving-*`],
    },
    {
      name: 'wheely-charge-through',
      description:
        'Wheely floors it into Fireboy at 40% with Charge Through (side special); capture the hit.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'wheely' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -45, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: -10, y: 0 }, facing: -1, damage: 40 } },
      ],
      script: [{ port: 0, from: 10, x: 100, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 25, after: 30 },
      requires: ['move:sideB'],
      refs: ['smash/attack-active-*', `${W}/video-thumb-ingame-driving-*`, `${W}/official-art-01*`],
    },
    {
      name: 'wheely-rev-up-full',
      description:
        'Wheely taps Rev Up (neutral special), revs to full by himself and keeps it, then blasts into Fireboy at ' +
        '40% with the full charge; capture the hit.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'wheely' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -55, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: -10, y: 0 }, facing: -1, damage: 40 } },
      ],
      script: [
        { port: 0, from: 10, buttons: ['special'] },
        { port: 0, from: 140, buttons: ['special'] },
      ],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 45, after: 30 },
      requires: ['move:neutralB'],
      refs: ['smash/attack-active-*', `${W}/video-thumb-ingame-driving-*`, `${W}/official-art-01*`],
    },
    {
      name: 'wheely-ramp-jump',
      description: 'Wheely launches off the ramp with his up special; capture the top of the arc.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'wheely' }, { fighter: 'fireboy' }] },
      patches: [{ port: 0, state: { pos: { x: -60, y: 0 }, facing: 1 } }],
      script: [{ port: 0, from: 10, to: 14, y: 100, buttons: ['special'] }],
      capture: {
        label: 'P1 reaches the apex of the ramp jump',
        when: (s, prev) => prev.fighters[0]!.vel.y > 0 && s.fighters[0]!.vel.y <= 0 && !s.fighters[0]!.ground,
      },
      motion: { before: 40, after: 20 },
      requires: ['move:upB'],
      refs: ['smash/jump-apex-*', `${W}/video-thumb-ingame-road-*`, `${W}/official-art-03*`],
    },
    {
      name: 'wheely-costume-jolie',
      description: 'Wheely in his Jolie costume (Wheely 2) standing opposite Fireboy, one second in.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'wheely', costume: 'jolie' }, { fighter: 'fireboy' }] },
      capture: { frame: 60 },
      refs: ['smash/battlefield-idle-1v1-*', `${W}/sprite-idle-side-*`],
    },
  ],
};
