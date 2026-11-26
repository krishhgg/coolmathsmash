import type { FighterScenarios } from '../../harness/scenarios';

const SB = 'characters/snail-bob';

/**
 * Snail Bob's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus the down air Shell Plunge's landing shockwave, a Rocket Hover recovery from below the ledge, the
 * down special Shell Pound's hop and drop and the Final Smash Shell Ship's laser. References live in the Captain
 * drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'snailbob',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${SB}/official-art-01*`, `${SB}/ingame-sb1-crawl-*`],
    run: ['smash/run-*', `${SB}/ingame-sb1-crawl-*`, `${SB}/official-art-02*`],
    'jump-apex': ['smash/jump-apex-*', `${SB}/official-art-02*`, `${SB}/official-art-03*`],
    'attack-active': ['smash/attack-active-*', `${SB}/official-art-01*`],
    'launch-high-percent': ['smash/launch-high-percent-*', `${SB}/official-art-03*`],
    shield: ['smash/shield-0*', `${SB}/shell-01*`],
    'ledge-hang': ['smash/ledge-hang-*', `${SB}/official-art-03*`],
    sheet: [`${SB}/official-art-*`, `${SB}/ingame-sb1-crawl-*`, `${SB}/shell-*`, `${SB}/alt-*`],
  },
  extra: [
    {
      name: 'snailbob-dair-plunge',
      description:
        'Snail Bob drops a Shell Plunge (down air) from a full hop beside Fireboy at 60%; capture the landing ' +
        'shockwave (dairLand), then the shell flipping back over.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'snailbob' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 0, y: 24 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 1,
            facing: 1,
          },
        },
        { port: 1, state: { pos: { x: 8, y: 0 }, damage: 60, facing: -1 } },
      ],
      script: [{ port: 0, from: 4, y: -100, buttons: ['attack'] }],
      capture: {
        label: "P1 move 'dairLand', first frame",
        when: (s, prev) => s.fighters[0]!.move === 'dairLand' && prev.fighters[0]!.move !== 'dairLand',
      },
      motion: { before: 30, after: 30 },
      requires: ['move:dair'],
      refs: ['smash/attack-active-*', `${SB}/shell-01*`],
    },
    {
      name: 'snailbob-upb-recovery',
      description:
        'Snail Bob falls 35 units below the right ledge at 40% with his midair jump spent and fires Rocket Hover ' +
        '(up special): the booster lifts him past the ledge, he drifts in over the stage, lets go and lands. ' +
        'Capture the frame he rises past the ledge.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'snailbob' }, { fighter: 'fireboy' }] },
      patches: [
        {
          port: 0,
          state: {
            pos: { x: 100, y: -35 },
            vel: { x: 0, y: 0 },
            ground: null,
            action: 'fall',
            jumpsUsed: 2,
            damage: 40,
            facing: -1,
          },
        },
        { port: 1, state: { pos: { x: 20, y: 0 }, facing: 1 } },
      ],
      script: [
        { port: 0, from: 4, y: 50, buttons: ['special'] },
        { port: 0, from: 5, to: 85, buttons: ['special'] },
        { port: 0, from: 50, to: 85, x: -100 },
      ],
      capture: {
        label: 'P1 Rocket Hover rising past the ledge',
        when: (s, prev) =>
          s.fighters[0]!.move === 'upB' && s.fighters[0]!.pos.y >= 0 && prev.fighters[0]!.pos.y < 0,
      },
      motion: { before: 50, after: 90 },
      requires: ['move:upB'],
      refs: ['smash/ledge-hang-*', `${SB}/official-art-02*`],
    },
    {
      name: 'snailbob-downb-pound',
      description:
        'Snail Bob fires Shell Pound (down special, Bowser Bomb) from the ground beside Fireboy at 60%: he tucks ' +
        'into his shell, scoops Fireboy up as he hops on frame 11, somersaults, hangs and drops on frame 37, then ' +
        'lands in the shockwave and sits dizzy through the landing lag. Capture the first frame of the drop.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'snailbob' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 8, y: 0 }, damage: 60, facing: -1 } },
      ],
      script: [{ port: 0, from: 4, y: -100, buttons: ['special'] }],
      capture: {
        label: "P1 move 'downB', first frame of the drop",
        when: (s, prev) =>
          s.fighters[0]!.move === 'downB' &&
          s.fighters[0]!.actionFrame === 37 &&
          prev.fighters[0]!.actionFrame !== 37,
      },
      motion: { before: 40, after: 70 },
      requires: ['move:downB'],
      refs: ['smash/attack-active-*', `${SB}/shell-01*`],
    },
    {
      name: 'snailbob-final-smash',
      description:
        'Snail Bob holds the Final Smash charge and presses neutral special 40 units from Fireboy: he calls his ' +
        'spaceship with the remote, it swoops through the stage on frames 28-30 and traps Fireboy, banks round, ' +
        'lasers him on cinematic frame 52 and rams him away in a blast on 84 (Shell Ship, on the Blue Falcon). ' +
        'Capture the first frame of the laser.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'snailbob' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -40, y: 0 }, vel: { x: 0, y: 0 }, facing: 1, finalReady: true } },
        { port: 1, state: { pos: { x: 0, y: 0 }, damage: 30, facing: -1 } },
      ],
      script: [{ port: 0, from: 4, to: 5, buttons: ['special'] }],
      capture: {
        label: "P1 move 'finalSmashCinematic', the laser (frame 52)",
        when: (s, prev) =>
          s.fighters[0]!.move === 'finalSmashCinematic' &&
          s.fighters[0]!.actionFrame === 52 &&
          prev.fighters[0]!.actionFrame !== 52,
      },
      motion: { before: 110, after: 70 },
      requires: ['move:finalSmash'],
      refs: ['smash/attack-active-*', `${SB}/official-art-01*`],
    },
  ],
};
