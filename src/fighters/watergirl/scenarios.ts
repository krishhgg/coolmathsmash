import type { FighterScenarios } from '../../harness/scenarios';
import { WAVE } from './finalSmashData';

/**
 * Watergirl's capture states (docs/hill-climb.md). She is only reached by Fireboy's swap in play, but the harness
 * can start a match with her, so she gets the standard set against Fireboy, plus Water Stream and Tidal Wave. Like his, the
 * references are Smash Ultimate's presentation frames only while the rig wears the placeholder mannequin (KRI-29).
 */
export const scenarios: FighterScenarios = {
  fighter: 'watergirl',
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
      name: 'watergirl-water-stream',
      description:
        'Watergirl holds neutral special for 60 frames, about 40 of them charging, then sprays Fireboy back with 0% windbox pumps.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'watergirl' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -45, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: -22, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 10, to: 70, buttons: ['special'] }],
      capture: {
        label: 'Fourth pump out, Fireboy sliding back',
        when: (s) =>
          s.fighters[0]!.move === 'neutralB' && s.entities.length > 0 && s.fighters[0]!.actionFrame === 36,
      },
      motion: { before: 50, after: 45 },
      requires: ['move:neutralB'],
      refs: ['smash/attack-active-*'],
    },
    {
      name: 'watergirl-tidal-wave',
      description:
        'Watergirl holds the Final Smash charge and presses neutral special on frame 10: Tidal Wave (Mario Finale) breaks on its frame 65 and rolls over Fireboy at 30%, 30 units ahead.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'watergirl' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -60, y: 0 }, facing: 1, finalReady: true } },
        { port: 1, state: { pos: { x: -30, y: 0 }, facing: -1, damage: 30 } },
      ],
      script: [{ port: 0, from: 10, to: 11, buttons: ['special'] }],
      capture: {
        label: 'The wave 8 frames out, over Fireboy',
        when: (s) => s.fighters[0]!.move === 'finalSmash' && s.fighters[0]!.actionFrame === WAVE.frame + 8,
      },
      motion: { before: 70, after: 60 },
      requires: ['move:finalSmash'],
      refs: ['smash/attack-active-*'],
    },
  ],
};
