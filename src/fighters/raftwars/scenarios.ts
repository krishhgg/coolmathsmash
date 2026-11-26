import type { FighterScenarios } from '../../harness/scenarios';

const RW = 'characters/raft-wars';

/**
 * Raft Wars Kids' capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus Rocket Ride (up special), Bottle Rocket (up smash), the shots and Duck Raft (down special). References
 * live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'raftwars',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${RW}/ingame-raft-idle-*`, `${RW}/character-brother-*`],
    run: ['smash/run-*', `${RW}/coolmath-thumb-*`],
    'jump-apex': ['smash/jump-apex-*', `${RW}/title-screen-*`],
    'attack-active': ['smash/attack-active-*', `${RW}/official-art-*`, `${RW}/ingame-aim-*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${RW}/video-roster-art-*`],
    shield: ['smash/shield-0*', `${RW}/character-brother-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${RW}/ingame-raft-upgraded-*`],
    sheet: [
      `${RW}/character-*`,
      `${RW}/official-art-*`,
      `${RW}/video-roster-art-*`,
      `${RW}/ingame-raft-idle-*`,
    ],
  },
  extra: [
    {
      name: 'raftwars-rocket-ride',
      description:
        "Simon's brother lights Rocket Ride (up special) from the ground; capture the explosion at the top.",
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }] },
      script: [{ port: 0, from: 10, to: 12, y: 100, buttons: ['special'] }],
      capture: {
        label: "P1 move 'upB', the explosion's first frame (49)",
        when: (s) => s.fighters[0]!.move === 'upB' && s.fighters[0]!.actionFrame === 49,
      },
      motion: { before: 45, after: 20 },
      requires: ['move:upB'],
      refs: ['smash/attack-active-*', `${RW}/ingame-aim-*`, `${RW}/coolmath-thumb-*`],
    },
    {
      name: 'raftwars-bottle-rocket',
      description: 'Bottle Rocket (up smash) as Fireboy at 60% full hops beside them; capture the hit.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 3, y: 0 }, facing: -1, damage: 60 } },
      ],
      script: [
        { port: 0, from: 10, to: 12, cy: 100 },
        { port: 1, from: 14, to: 24, buttons: ['jump'] },
      ],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 20, after: 30 },
      requires: ['move:usmash'],
      refs: ['smash/attack-active-*', `${RW}/ingame-aim-*`],
    },
    {
      name: 'raftwars-straight-shot',
      description:
        'Straight Shot (forward tilt) hits Fireboy across Battlefield without closing the distance.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }] },
      script: [
        { port: 0, from: 10, to: 19, x: 50 },
        { port: 0, from: 19, x: 50, buttons: ['attack'] },
      ],
      capture: {
        label: "P2's damage rises",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 30, after: 12 },
      requires: ['move:ftilt'],
      refs: ['smash/attack-active-*', `${RW}/ingame-aim-*`],
    },
    {
      name: 'raftwars-grenade',
      description: 'Grenade (side special) bounces across Battlefield before its fuse expires near Fireboy.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }] },
      patches: [{ port: 1, state: { pos: { x: 51, y: 0 }, damage: 60 } }],
      script: [{ port: 0, from: 10, x: 100, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises when the grenade bursts",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 107, after: 12 },
      requires: ['move:sideB'],
      refs: ['smash/attack-active-*', `${RW}/ingame-aim-*`],
    },
    {
      name: 'raftwars-duck-raft',
      description:
        'Duck Raft (down special) at the top of a full hop in mid-stage: the raft pops open under the kids and they stand in it.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }] },
      patches: [{ port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } }],
      script: [
        { port: 0, from: 10, to: 16, buttons: ['jump'] },
        { port: 0, from: 36, to: 38, y: -100, buttons: ['special'] },
      ],
      capture: {
        label: "P1 move 'downB' frame 7, standing in the raft",
        when: (s) => {
          const f = s.fighters[0]!;
          return f.move === 'downB' && f.actionFrame === 7 && f.ground?.kind === 'entity';
        },
      },
      motion: { before: 33, after: 30 },
      requires: ['move:downB'],
      refs: ['smash/attack-active-*', `${RW}/ingame-raft-idle-*`],
    },
    {
      name: 'raftwars-aimed-shot',
      description:
        'Aimed Shot (neutral special) held to full charge, 112 frames, fires by itself and hits Fireboy at 60% 50 units away.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'raftwars' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -40, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 10, y: 0 }, facing: -1, damage: 60 } },
      ],
      script: [{ port: 0, from: 10, to: 140, buttons: ['special'] }],
      capture: {
        label: "P2's damage rises when the full-charge ball lands",
        when: (s, prev) => s.fighters[1]!.damage > prev.fighters[1]!.damage,
      },
      motion: { before: 60, after: 20 },
      requires: ['move:neutralB'],
      refs: ['smash/attack-active-*', `${RW}/ingame-aim-*`],
    },
  ],
};
