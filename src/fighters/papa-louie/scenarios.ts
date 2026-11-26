import type { FighterScenarios } from '../../harness/scenarios';

const PAPA = 'characters/papa-louie';

/**
 * Papa Louie's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, his Pepper Bomb, Paddle Propeller, Paddle Deflect and Brick Oven in a match, and lab sheets of every move
 * on its first active frame (the pummel and throws on their impact frame). Zoom 6 keeps the peel's reach inside the
 * cells. References live in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: 'papa-louie',
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${PAPA}/official-art-standing-*`, `${PAPA}/ingame-idle-*`],
    run: ['smash/run-*', `${PAPA}/ingame-run-*`, `${PAPA}/sprite-run-anim-*`],
    'jump-apex': ['smash/jump-apex-*', `${PAPA}/ingame-jungle-*`, `${PAPA}/ingame-glide-*`],
    'attack-active': [
      'smash/attack-active-*',
      `${PAPA}/ingame-attack-paddle-*`,
      `${PAPA}/official-art-paddle-*`,
    ],
    'launch-high-percent': ['smash/launch-high-percent-*', `${PAPA}/ingame-attack-paddle-*`],
    shield: ['smash/shield-0*', `${PAPA}/official-art-paddle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${PAPA}/ingame-glide-*`],
    sheet: [
      `${PAPA}/official-art-standing-*`,
      `${PAPA}/official-art-card-*`,
      `${PAPA}/official-art-paddle-*`,
    ],
  },
  extra: [
    {
      name: 'papa-louie-pepper-bomb',
      description:
        'Papa lobs a Pepper Bomb across Battlefield; it bounces twice and bursts on the third landing.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      patches: [{ port: 1, state: { pos: { x: 60, y: 0 }, facing: -1 } }],
      script: [{ port: 0, from: 10, buttons: ['special'] }],
      capture: {
        label: 'The bomb bursts',
        when: (s) => s.entities.some((e) => e.kind === 'papa-louie/pepperBurst' && e.age === 1),
      },
      motion: { before: 66, after: 12 },
      requires: ['move:neutralB'],
      refs: [`${PAPA}/item-pepper-bomb-*`, `${PAPA}/ingame-pepper-bomb-hit-*`],
    },
    {
      name: 'papa-louie-propeller',
      description: 'Papa spins his pizza peel overhead as his up special carries him off the floor.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      script: [{ port: 0, from: 12, y: 100, buttons: ['special'] }],
      capture: {
        label: 'Paddle Propeller reaches its finishing hit',
        when: (s) => s.fighters[0]!.move === 'upB' && s.fighters[0]!.actionFrame === 28,
      },
      motion: { before: 31, after: 18 },
      requires: ['move:upB'],
      refs: [`${PAPA}/ingame-glide-*`, `${PAPA}/official-art-paddle-*`],
    },
    {
      name: 'papa-louie-deflect',
      description: 'Papa plants his feet and catches an approaching Fireboy with the edge of the peel.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 24, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 1, from: 7, to: 13, x: -100 },
        { port: 0, from: 12, y: -100, buttons: ['special'] },
      ],
      capture: {
        label: 'Paddle Deflect reaches its first active frame',
        when: (s) => s.fighters[0]!.move === 'downB' && s.fighters[0]!.actionFrame === 5,
      },
      motion: { before: 8, after: 25 },
      requires: ['move:downB'],
      refs: [`${PAPA}/official-art-paddle-*`, `${PAPA}/ingame-attack-paddle-*`],
    },
    {
      name: 'papa-louie-brick-oven',
      description: 'Papa scoops Fireboy up on his peel and shoves him backwards into the brick oven.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: 'papa-louie' }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: 0, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 11, y: 0 }, facing: -1 } },
      ],
      script: [
        { port: 0, from: 10, buttons: ['grab'] },
        { port: 0, from: 22, x: -100 },
      ],
      capture: {
        label: 'Brick Oven releases the throw',
        when: (s) => s.fighters[0]!.move === 'bthrow' && s.fighters[0]!.actionFrame === 30,
      },
      motion: { before: 24, after: 17 },
      requires: ['move:bthrow'],
      refs: [`${PAPA}/official-art-paddle-*`, `${PAPA}/ingame-run-*`],
    },
    {
      name: 'papa-louie-sheet-ground',
      description:
        'Papa idle, running, jumping and hanging from the ledge, then every ground attack on its first active frame.',
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'papa-louie', zoom: '6' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'idle@0',
              'run@6',
              'jump@4',
              'ledgeHang@0',
              'jab@4',
              'jab2@4',
              'jab3@5',
              'ftilt@7',
              'utilt@6',
              'dtilt@6',
              'dashAttack@8',
              'fsmash@15',
              'usmash@11',
              'dsmash@8',
              'getupAttack@17',
            ],
          ],
        },
      ],
      refs: [
        'smash/attack-active-*',
        `${PAPA}/ingame-attack-paddle-*`,
        `${PAPA}/official-art-paddle-*`,
        `${PAPA}/official-art-standing-*`,
      ],
    },
    {
      name: 'papa-louie-sheet-air',
      description:
        "Papa's aerials, grabs, Paddle Propeller and Paddle Deflect on their first active frames, and the pummel and throws on their impact frames.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'papa-louie', zoom: '6' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'nair@5',
              'fair@10',
              'bair@7',
              'uair@5',
              'dair@8',
              'grab@8',
              'dashGrab@10',
              'pivotGrab@11',
              'pummel@1',
              'fthrow@13',
              'bthrow@30',
              'uthrow@20',
              'dthrow@22',
              'upB@6',
              'downB@5',
            ],
          ],
        },
      ],
      refs: [
        'smash/attack-active-*',
        `${PAPA}/ingame-attack-paddle-*`,
        `${PAPA}/ingame-glide-*`,
        `${PAPA}/official-art-paddle-*`,
      ],
    },
    {
      name: 'papa-louie-sheet-specials',
      description:
        "Papa's Pepper Bomb from pocket to release, the Propeller's finisher, the second sweeps of his down smash and getup attack, his dodges and his ledge getups.",
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'papa-louie', zoom: '6' } },
      calls: [
        {
          fn: 'sheet',
          args: [
            [
              'neutralB@3',
              'neutralB@9',
              'neutralB@13',
              'neutralB@14',
              'neutralB@20',
              'upB@28',
              'dsmash@14',
              'getupAttack@25',
              'spotDodge@10',
              'rollForward@10',
              'rollBack@10',
              'airDodge@10',
              'ledgeClimb@9',
              'ledgeAttack@16',
              'getupRoll@12',
            ],
          ],
        },
      ],
      refs: [
        `${PAPA}/item-pepper-bomb-*`,
        `${PAPA}/ingame-pepper-bomb-hit-*`,
        `${PAPA}/ingame-glide-*`,
        `${PAPA}/official-art-paddle-*`,
      ],
    },
    {
      name: 'papa-louie-sheet-roy',
      description: 'Papa in his Roy costume (red Pizzeria tee, blue-and-red cap) on the key states.',
      page: { kind: 'lab', scene: 'fighter', params: { fighter: 'papa-louie', palette: 'roy', zoom: '7' } },
      calls: [{ fn: 'sheet', args: [['idle@0', 'run@6', 'fsmash@15', 'taunt@28', 'shield@6']] }],
      refs: [`${PAPA}/alt-roy-pauly-*`],
    },
  ],
};
