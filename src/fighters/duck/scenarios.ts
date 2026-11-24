import type { FighterScenarios } from '../../harness/scenarios';

const DL = 'characters/duck-life';

/** Key poses of the costume shots: standing, running, jump apex, the fsmash hit and the taunt's flap. */
const COSTUME_STATES = ['idle@0', 'run@6', 'jump@40', 'fsmash@15', 'taunt@12'];

/**
 * The Duck's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus his four midair flaps, Flight Training (up special), Dive Ram (down special) and the crown and evil
 * costumes. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'duck',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${DL}/ingame-idle-*`, `${DL}/official-art-01*`],
    run: ['smash/run-*', `${DL}/ingame-run-*`],
    'jump-apex': ['smash/jump-apex-*', `${DL}/ingame-jump-*`],
    'attack-active': ['smash/attack-active-*', `${DL}/video-roster-art-*`, `${DL}/official-art-01*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${DL}/official-art-02-*`],
    shield: ['smash/shield-0*', `${DL}/ingame-idle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${DL}/ingame-climb-*`],
    sheet: [`${DL}/official-art-*`, `${DL}/ingame-*`, `${DL}/video-roster-art-*`],
  },
  extra: [
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
      motion: { before: 80, after: 20 },
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
