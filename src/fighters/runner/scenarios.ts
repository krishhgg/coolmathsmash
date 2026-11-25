import type { FighterScenarios, LabScenario } from '../../harness/scenarios';
import { art } from './art';
import { GRAVITY_SWITCH } from './moves';

const RUN = 'characters/runner';

/** `clip@frame` on the clip's first active frame: where its strike, grab or release is keyed. */
const firstActive = (clip: string) => `${clip}@${art.clips[clip]!.active![0]![0]}`;

/**
 * A lab contact sheet of Runner's rig at `states` (clip@frame), drawn at `zoom` pixels per unit: small enough
 * that her tallest and widest pose fits its cell (scenarios.test.ts checks every pose).
 */
const sheet = (
  name: string,
  description: string,
  zoom: number,
  states: string[],
  refs: string[],
): LabScenario => ({
  name: `runner-${name}`,
  description,
  page: {
    kind: 'lab',
    scene: 'fighter',
    params: { fighter: 'runner', bg: '#c4c6d0', sheet: '1', states: states.join(','), zoom: String(zoom) },
  },
  refs,
});

/**
 * The Runner's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus Gravity Switch on the underside of a platform, Tile Flip, the Jog Flurry, and lab contact sheets of
 * her key poses and every move on its first active frame. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'runner',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${RUN}/official-art-*`, `${RUN}/sprite-sheet-runner-*`],
    run: ['smash/run-*', `${RUN}/sprite-runner-run-cycle-*`, `${RUN}/ingame-run1-*`],
    'jump-apex': ['smash/jump-apex-*', `${RUN}/sprite-runner-jump-*`, `${RUN}/ingame-run3-*`],
    'attack-active': ['smash/attack-active-*', `${RUN}/sprite-sheet-runner-*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${RUN}/sprite-sheet-runner-*`],
    shield: ['smash/shield-0*', `${RUN}/official-art-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${RUN}/sprite-sheet-runner-*`],
    sheet: [
      `${RUN}/official-art-*`,
      `${RUN}/sprite-sheet-runner-*`,
      `${RUN}/alt-*-01.png`,
      `${RUN}/ingame-*`,
    ],
  },
  extra: [
    {
      name: 'runner-gravity-switch',
      description:
        'Runner under the top platform uses Gravity Switch (up special), falls upward onto its underside and runs ' +
        'along it upside down; capture her running on the ceiling.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'runner' }, { fighter: 'fireboy' }] },
      patches: [{ port: 0, state: { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 }, facing: 1 } }],
      script: [
        { port: 0, from: 10, y: 100, buttons: ['special'] },
        { port: 0, from: 40, to: 90, x: 100 },
      ],
      capture: {
        label: "P1 move 'upB', 6 frames into clinging",
        when: (s) =>
          s.fighters[0]!.move === 'upB' && s.fighters[0]!.actionFrame >= GRAVITY_SWITCH.cling[0] + 6,
      },
      motion: { before: 40, after: 20 },
      requires: ['move:upB'],
      refs: [`${RUN}/ingame-run2-*`, `${RUN}/ingame-run3-*`, `${RUN}/sprite-runner-run-cycle-*`],
    },
    {
      name: 'runner-tile-flip',
      description:
        'Runner slaps the floor with Tile Flip (neutral special) and the tile in front flips up into Fireboy at 40%.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'runner' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -10, y: 0 }, prevPos: { x: -10, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 1, y: 0 }, prevPos: { x: 1, y: 0 }, facing: -1, damage: 40 } },
      ],
      script: [{ port: 0, from: 10, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 20, after: 25 },
      requires: ['move:neutralB'],
      refs: ['smash/attack-active-*', `${RUN}/ingame-run3-*`],
    },
    {
      name: 'runner-jog-flurry',
      description: 'Runner mashes jab into Fireboy at 20%: two punches, the kick flurry, then the shove.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'runner' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -6, y: 0 }, prevPos: { x: -6, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 }, facing: -1, damage: 20 } },
      ],
      script: Array.from({ length: 9 }, (_, i) => ({
        port: 0,
        from: 10 + i * 4,
        buttons: ['attack' as const],
      })),
      capture: {
        label: "P1 move 'jabRapid', frame 5",
        when: (s) => s.fighters[0]!.move === 'jabRapid' && s.fighters[0]!.actionFrame === 5,
      },
      motion: { before: 42, after: 45 },
      requires: ['move:jabRapid'],
      refs: ['smash/attack-active-*', `${RUN}/sprite-sheet-runner-*`],
    },
    {
      name: 'runner-key-poses',
      description: 'Close-up key poses for the dash, planted run, jump, dropkick and Tile Flip.',
      page: {
        kind: 'lab',
        scene: 'fighter',
        params: {
          fighter: 'runner',
          bg: '#c4c6d0',
          sheet: '1',
          states:
            'idle@0,dash@4,run@1,run@4,run@8,jumpSquat@2,jump@4,jump@27,fall@8,land@1,fsmash@8,fsmash@10,fsmash@12,fsmash@24,neutralB@14',
        },
      },
      refs: [
        `${RUN}/official-art-runner-*`,
        `${RUN}/sprite-runner-run-cycle-*`,
        `${RUN}/sprite-runner-jump-*`,
      ],
    },
    sheet(
      'attacks',
      'Idle, run, jump and ledge hang, then the first active frame of the jab chain, tilts, dash attack, smashes and aerials.',
      7.5,
      [
        'idle@0',
        'run@6',
        'jump@4',
        'ledgeHang@0',
        ...[
          'jab',
          'jab2',
          'jabRapid',
          'ftilt',
          'utilt',
          'dtilt',
          'dashAttack',
          'fsmash',
          'usmash',
          'dsmash',
          'nair',
          'fair',
          'bair',
          'uair',
          'dair',
        ].map(firstActive),
      ],
      ['smash/attack-active-*', `${RUN}/sprite-sheet-runner-*`, `${RUN}/official-art-runner-*`],
    ),
    sheet(
      'grabs-specials',
      'The first active frame of the grabs, pummel, the four throws, Tile Flip on the ground and in the air, and Gravity Switch.',
      9,
      [
        'grab',
        'dashGrab',
        'pivotGrab',
        'pummel',
        'fthrow',
        'bthrow',
        'uthrow',
        'dthrow',
        'neutralB',
        'neutralBAir',
        'upB',
      ].map(firstActive),
      ['smash/attack-active-*', `${RUN}/sprite-sheet-runner-*`, `${RUN}/ingame-run3-*`],
    ),
  ],
};
