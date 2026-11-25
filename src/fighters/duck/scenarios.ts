import type { FighterScenarios } from '../../harness/scenarios';

const DL = 'characters/duck-life';

/** Key poses of the costume shots: standing, running, jump apex, the fsmash hit and the taunt's flap. */
const COSTUME_STATES = ['idle@0', 'run@6', 'jump@40', 'fsmash@15', 'taunt@12'];

export const refs: FighterScenarios['refs'] = {
  idle: ['smash/battlefield-idle-1v1-*', `${DL}/ingame-idle-*`, `${DL}/official-art-01*`],
  run: ['smash/run-*', `${DL}/ingame-run-*`],
  'jump-apex': ['smash/jump-apex-*', `${DL}/ingame-jump-*`],
  'attack-active': ['smash/attack-active-*', `${DL}/video-roster-art-*`, `${DL}/official-art-01*`],
  'launch-high-percent': ['smash/launch-high-percent-*', `${DL}/official-art-02-*`],
  shield: ['smash/shield-0*', `${DL}/ingame-idle-*`],
  'ledge-hang': ['smash/ledge-hang-*', `${DL}/ingame-climb-*`],
  sheet: [`${DL}/official-art-*`, `${DL}/ingame-*`, `${DL}/video-roster-art-*`],
};

export const scenarios: FighterScenarios = {
  fighter: 'duck',
  refs,
  extra: [
    {
      name: 'duck-launch',
      description: 'Fireboy launches the Duck at 150%; capture the first tumble pose.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'fireboy' }, { fighter: 'duck' }] },
      patches: [
        { port: 0, state: { pos: { x: -12, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 6, y: 0 }, facing: -1, damage: 150 } },
      ],
      script: [{ port: 0, from: 10, to: 12, cx: 100 }],
      capture: {
        label: "P2 action 'tumble', frame >= 1",
        when: (s) => s.fighters[1]!.action === 'tumble' && s.fighters[1]!.actionFrame >= 1,
      },
      motion: { before: 22, after: 20 },
      requires: ['move:fsmash', 'action:tumble'],
      refs: refs['launch-high-percent'],
    },
    {
      name: 'duck-ledge-climb',
      description:
        'The Duck grabs the left ledge and climbs onto the stage; capture midway through the climb.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'duck' }, { fighter: 'fireboy' }] },
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
      script: [{ port: 0, from: 38, x: 100 }],
      capture: {
        label: "P1 action 'ledgeClimb', frame >= 17",
        when: (s) => s.fighters[0]!.action === 'ledgeClimb' && s.fighters[0]!.actionFrame >= 17,
      },
      motion: { before: 32, after: 24 },
      requires: ['action:ledgeClimb'],
      refs: refs['ledge-hang'],
    },
    {
      name: 'duck-flaps',
      description: 'The Duck full hops, then flaps all four midair jumps; capture the apex of the last one.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'duck' }, { fighter: 'fireboy' }] },
      script: [
        { port: 0, from: 10, to: 22, buttons: ['jump'] },
        { port: 0, from: 40, buttons: ['jump'] },
        { port: 0, from: 60, buttons: ['jump'] },
        { port: 0, from: 80, buttons: ['jump'] },
        { port: 0, from: 100, buttons: ['jump'] },
      ],
      capture: {
        label: 'P1 on its 5th jump, vel.y turns <= 0',
        when: (s, prev) =>
          s.fighters[0]!.jumpsUsed === 5 && prev.fighters[0]!.vel.y > 0 && s.fighters[0]!.vel.y <= 0,
      },
      motion: { before: 100, after: 20 },
      refs: ['smash/jump-apex-*', `${DL}/ingame-fly-*`, `${DL}/ingame-jump-*`],
    },
    {
      name: 'duck-flight',
      description:
        'The Duck, out of jumps above the stage, uses Flight Training (up special); capture mid-climb.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'duck' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: -30, y: 12 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 5,
            facing: 1,
          },
        },
      ],
      script: [{ port: 0, from: 4, to: 6, y: 100, buttons: ['special'] }],
      capture: {
        label: "P1 move 'upB', frame >= 20",
        when: (s) => s.fighters[0]!.move === 'upB' && s.fighters[0]!.actionFrame >= 20,
      },
      motion: { before: 22, after: 40 },
      requires: ['move:upB'],
      refs: [`${DL}/ingame-fly-*`, 'smash/jump-apex-*'],
    },
    {
      name: 'duck-dive',
      description:
        'The Duck, high above the stage, uses Dive Ram (down special); capture the belly-flop slide.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'duck' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: -40, y: 40 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 1,
            facing: 1,
          },
        },
        { port: 1, state: { pos: { x: 60, y: 0 } } },
      ],
      script: [{ port: 0, from: 4, to: 6, y: -100, buttons: ['special'] }],
      capture: {
        label: "P1 move 'downB', frame >= 48 (the slide)",
        when: (s) => s.fighters[0]!.move === 'downB' && s.fighters[0]!.actionFrame >= 48,
      },
      motion: { before: 40, after: 24 },
      requires: ['move:downB'],
      refs: [`${DL}/ingame-swim-*`, 'smash/attack-active-*'],
    },
    {
      name: 'duck-crown',
      description: "The Duck's crown costume (Duck Life's champion Crown hat) in key poses.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'duck', palette: 'crown' } },
      calls: [{ fn: 'sheet', args: [COSTUME_STATES] }],
      refs: [`${DL}/alt-crown-*`],
    },
    {
      name: 'duck-evil',
      description: "The Duck's evil costume (DuckLife 3's Champion Duck) in key poses.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'duck', palette: 'evil' } },
      calls: [{ fn: 'sheet', args: [COSTUME_STATES] }],
      refs: [`${DL}/alt-evil-*`],
    },
  ],
};
