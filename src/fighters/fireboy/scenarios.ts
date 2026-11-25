import type { FighterScenarios } from '../../harness/scenarios';

/**
 * Fireboy's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set, plus the
 * down-special swap into Watergirl on the ground and in the air.
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
      description: 'Fireboy swaps near the top of a full hop without getting his jump back.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'fireboy' }, { fighter: 'watergirl' }] },
      patches: [{ port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } }],
      script: [
        { port: 0, from: 10, to: 22, buttons: ['jump'] },
        { port: 0, from: 18, y: -100, buttons: ['special'] },
      ],
      capture: {
        label: 'P1 becomes Watergirl while airborne with one jump spent',
        when: (s, prev) => {
          const next = s.fighters[0]!;
          return (
            prev.fighters[0]!.fighter === 'fireboy' &&
            next.fighter === 'watergirl' &&
            next.ground === null &&
            next.jumpsUsed === 1
          );
        },
      },
      motion: { before: 25, after: 40 },
      requires: ['move:downB'],
      refs: ['smash/jump-apex-*'],
    },
  ],
};
