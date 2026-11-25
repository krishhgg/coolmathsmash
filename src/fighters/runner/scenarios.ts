import type { FighterScenarios } from '../../harness/scenarios';
import { GRAVITY_SWITCH } from './moves';
import { BOX_DROP } from './timing';

const RUN = 'characters/runner';

/**
 * The Runner's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus Gravity Switch on the underside of a platform, Tile Flip and the Jog Flurry. References live in the
 * Captain drive's refs/.
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
      name: 'runner-box-drop',
      description:
        'Runner stalls as a crate, plunges and lands next to Fireboy, knocking him away on impact.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'runner' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 20, y: 38 },
            prevPos: { x: 20, y: 38 },
            ground: null,
            action: 'fall',
            facing: 1,
          },
        },
        { port: 1, state: { pos: { x: 32, y: 0 }, prevPos: { x: 32, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 0, y: -100, buttons: ['special'] }],
      capture: {
        label: 'Box Drop lands and hits P2',
        when: (s, prev) =>
          s.fighters[0]!.move === 'downB' && s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 18, after: 20 },
      requires: ['move:downBAir'],
      refs: [`${RUN}/ingame-run2-*`, 'smash/attack-active-*'],
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
    {
      name: 'runner-box-drop-exit',
      description: 'Close-up of Box Drop sealed, ready to cancel, opening, and returning to Runner.',
      page: {
        kind: 'lab',
        scene: 'fighter',
        params: {
          fighter: 'runner',
          bg: '#c4c6d0',
          sheet: '1',
          states: [
            BOX_DROP.cancelFrom - 1,
            BOX_DROP.cancelFrom,
            BOX_DROP.release,
            BOX_DROP.release + 3,
            BOX_DROP.release + 10,
          ]
            .map((frame) => `downB@${frame}`)
            .join(','),
        },
      },
      refs: [`${RUN}/official-art-runner-*`, `${RUN}/ingame-run2-*`],
    },
  ],
};
