import type { FighterScenarios } from '../../harness/scenarios';

/**
 * Fireboy's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set, plus the
 * down-special swap into Watergirl and back. Until the character drawing is settled (KRI-29) the rig wears the
 * placeholder mannequin, so the references are Smash Ultimate's presentation frames only: these rounds judge
 * animation and presentation, not likeness.
 */
export const scenarios: FighterScenarios = {
  fighter: 'fireboy',
  opponent: 'watergirl',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*'],
    run: ['smash/run-*'],
    'jump-apex': ['smash/jump-apex-*'],
    'attack-active': ['smash/attack-active-*'],
    'launch-high-percent': ['smash/launch-high-percent-*'],
    shield: ['smash/shield-0*'],
    'ledge-hang': ['smash/ledge-hang-0*'],
  },
  extra: [
    {
      name: 'fireboy-swap',
      description:
        'Fireboy uses down special on the ground and Watergirl bursts out; capture the frame she appears.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'fireboy' }, { fighter: 'watergirl' }] },
      script: [{ port: 0, from: 10, to: 12, y: -100, buttons: ['special'] }],
      capture: {
        label: 'P1 becomes Watergirl',
        when: (s, prev) => s.fighters[0]!.fighter === 'watergirl' && prev.fighters[0]!.fighter === 'fireboy',
      },
      motion: { before: 20, after: 40 },
      requires: ['move:downB'],
      refs: ['smash/battlefield-idle-1v1-*'],
    },
    {
      name: 'fireboy-swap-air',
      description:
        'Fireboy full hops and swaps at the top of the jump; capture Watergirl coming out in the air.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'fireboy' }, { fighter: 'watergirl' }] },
      script: [
        { port: 0, from: 10, to: 22, buttons: ['jump'] },
        { port: 0, from: 40, to: 42, y: -100, buttons: ['special'] },
      ],
      capture: {
        label: 'P1 becomes Watergirl in the air',
        when: (s, prev) => s.fighters[0]!.fighter === 'watergirl' && prev.fighters[0]!.fighter === 'fireboy',
      },
      motion: { before: 25, after: 40 },
      requires: ['move:downB'],
      refs: ['smash/jump-apex-*'],
    },
  ],
};
