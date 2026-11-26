import type { FighterPatch, FighterScenarios, GameScenario, LabScenario } from '../../harness/scenarios';
import type { ScriptStep } from '../../harness/script';
import type { MoveDef } from '../types';
import { PARALYZED, STUN_GUN } from './entities';
import { moves } from './moves';

const ID = 'bob-the-robber';
const BOB = 'characters/bob-the-robber';
const ART = [`${BOB}/official-art-0*`, `${BOB}/official-art-chase-*`];

/** Airborne and falling at (x, y), with the first jump spent. */
const air = (x: number, y: number, facing: 1 | -1): FighterPatch => ({
  pos: { x, y },
  vel: { x: 0, y: 0 },
  ground: null,
  action: 'fall',
  facing,
  jumpsUsed: 1,
});

/**
 * Bob (P1) does `move` on Fireboy (P2): capture the first frame Bob's move reaches action frame `at` (its first
 * active frame, or the hit or release that matters), with a clip running on through the launch.
 */
const moveShot = (
  state: string,
  description: string,
  move: string,
  at: number,
  p1: FighterPatch,
  p2: FighterPatch,
  script: ScriptStep[],
): GameScenario => ({
  name: `${ID}-${state}`,
  description,
  page: { kind: 'game' },
  match: { ports: [{ fighter: ID }, { fighter: 'fireboy' }] },
  patches: [
    { port: 0, state: p1 },
    { port: 1, state: p2 },
  ],
  script,
  capture: {
    label: `P1's ${move} reaches frame ${at}`,
    when: (s) => s.fighters[0]!.move === move && s.fighters[0]!.actionFrame >= at,
  },
  motion: { before: 10, after: 40 },
  requires: [`move:${move}`],
  refs: ['smash/attack-active-*', ...ART],
});

/** A lab contact sheet of Bob's rig at `states` (clip@frame). */
const sheet = (name: string, description: string, states: string[]): LabScenario => ({
  name: `${ID}-${name}`,
  description,
  page: {
    kind: 'lab',
    scene: 'fighter',
    params: { fighter: ID, sheet: '1', states: states.join(','), zoom: '9' },
  },
  refs: ART,
});

/** The frame a move's clip is checked on: its first active frame, its throw or pummel frame, or the stun gun's shot. */
const firstActive = (move: MoveDef): number =>
  move.hits[0]?.frames[0] ?? move.throw?.frame ?? move.pummel?.frame ?? STUN_GUN.shot;

const AIR_MOVES = new Set(['nair', 'fair', 'bair', 'uair', 'dair', 'neutralBAir', 'sideB', 'upB']);
const atFirstActive = (pick: (name: string) => boolean) =>
  Object.entries(moves)
    .filter(([name]) => pick(name))
    .map(([name, move]) => `${name}@${firstActive(move)}`);

/**
 * Bob the Robber's capture states for the hill-climb loop (docs/hill-climb.md): the standard per-fighter set against
 * Fireboy, plus his tippers, twirls, sack meteor, kill throw, specials and the stun gun's paralysis. References live
 * in the Captain drive's refs/.
 */
export const scenarios: FighterScenarios = {
  fighter: ID,
  refs: {
    idle: ['smash/battlefield-idle-1v1-*', `${BOB}/ingame-idle-*`, `${BOB}/official-art-0*`],
    run: ['smash/run-*', `${BOB}/ingame-walk-*`, `${BOB}/official-art-chase-*`],
    'jump-apex': ['smash/jump-apex-*', `${BOB}/official-art-0*`],
    'attack-active': ['smash/attack-active-*', ...ART],
    'launch-high-percent': ['smash/launch-high-percent-*', `${BOB}/official-art-02*`],
    shield: ['smash/shield-0*', `${BOB}/ingame-idle-*`],
    'ledge-hang': ['smash/ledge-hang-*', `${BOB}/official-art-chase-*`],
    sheet: [`${BOB}/official-art-*`, `${BOB}/ingame-*`, `${BOB}/title-logo-*`],
  },
  extra: [
    sheet(
      'moves-ground',
      'Every grounded attack and grab at its first active frame (the pummel at its hit frame).',
      atFirstActive((name) => !AIR_MOVES.has(name) && !name.endsWith('throw')),
    ),
    sheet(
      'moves-air',
      'Every aerial, throw and special at its first active frame (throws at their release frame).',
      atFirstActive((name) => AIR_MOVES.has(name) || name.endsWith('throw')),
    ),
    sheet('reactions', 'Hit, knockdown, tech, grab, shield-break and ledge-attack clips.', [
      'hitstun@4',
      'tumble@8',
      'down@0',
      'getupStand@12',
      'techInPlace@6',
      'techRoll@12',
      'grabbed@0',
      'grabRelease@6',
      'shieldBreak@12',
      'dizzy@0',
      'ledgeAttack@6',
      'ledgeAttack@22',
      'respawn@0',
    ]),
    moveShot(
      'fsmash-tip',
      'Bob swings Home-Run Bonk (forward smash) with the baton tip on Fireboy at 60%.',
      'fsmash',
      13,
      { pos: { x: -12, y: 0 }, facing: 1 },
      { pos: { x: 6, y: 0 }, facing: -1, damage: 60 },
      [{ port: 0, from: 10, to: 12, cx: 100 }],
    ),
    moveShot(
      'ftilt-tip',
      'Bob walks in and tips Fireboy (40%) with Baton Swing (forward tilt).',
      'ftilt',
      6,
      { pos: { x: -17, y: 0 }, facing: 1 },
      { pos: { x: 5, y: 0 }, facing: -1, damage: 40 },
      [
        { port: 0, from: 10, to: 30, x: 50 },
        { port: 0, from: 18, to: 19, x: 50, buttons: ['attack'] },
      ],
    ),
    moveShot(
      'utilt',
      'Bob twirls the baton overhead (up tilt) into its launcher on Fireboy at 30%.',
      'utilt',
      15,
      { pos: { x: -6, y: 0 }, facing: 1 },
      { pos: { x: -2, y: 0 }, facing: -1, damage: 30 },
      [
        { port: 0, from: 10, to: 30, y: 50 },
        { port: 0, from: 18, to: 19, y: 50, buttons: ['attack'] },
      ],
    ),
    moveShot(
      'usmash',
      'Helicopter Twirl (up smash): the rotor hits drag Fireboy (90%) up into the finisher; capture the finisher.',
      'usmash',
      23,
      { pos: { x: -6, y: 0 }, facing: 1 },
      { pos: { x: -3, y: 0 }, facing: -1, damage: 90 },
      [{ port: 0, from: 10, to: 12, cy: 100 }],
    ),
    moveShot(
      'dsmash',
      'Floor Sweep (down smash): the baton along the floor in front, catching Fireboy at 50%.',
      'dsmash',
      7,
      { pos: { x: -6, y: 0 }, facing: 1 },
      { pos: { x: 7, y: 0 }, facing: -1, damage: 50 },
      [{ port: 0, from: 10, to: 12, cy: -100 }],
    ),
    moveShot(
      'nair',
      'Twirl (neutral air): the baton spun round Bob beside an airborne Fireboy.',
      'nair',
      6,
      air(-6, 20, 1),
      air(4, 18, -1),
      [{ port: 0, from: 10, to: 11, buttons: ['attack'] }],
    ),
    moveShot(
      'fair-tip',
      'Overhead Chop (forward air) landing its tip on an airborne Fireboy.',
      'fair',
      7,
      air(-12, 22, 1),
      air(5.5, 22, -1),
      [{ port: 0, from: 10, to: 12, cx: 100 }],
    ),
    moveShot(
      'bair',
      'Backswing (back air): Bob, facing away, swings the baton behind him into Fireboy.',
      'bair',
      9,
      air(-6, 22, -1),
      air(6, 22, -1),
      [{ port: 0, from: 10, to: 12, cx: 100 }],
    ),
    moveShot(
      'dair-meteor',
      'Sack Drop (down air): the loot sack swung straight down on Fireboy (40%) in its meteor frames.',
      'dair',
      14,
      air(-6, 40, 1),
      { ...air(-5, 25, -1), damage: 40 },
      [{ port: 0, from: 10, to: 12, cy: -100 }],
    ),
    moveShot(
      'bthrow',
      'Knockout (back throw), the kill throw: Bob grabs Fireboy (120%) and bonks him off behind.',
      'bthrow',
      24,
      { pos: { x: 40, y: 0 }, facing: -1 },
      { pos: { x: 29, y: 0 }, facing: 1, damage: 120 },
      [
        { port: 0, from: 10, to: 11, buttons: ['grab'] },
        { port: 0, from: 20, to: 22, x: 100 },
      ],
    ),
    moveShot(
      'side-special',
      'Baton Twirl Rush (side special): the twirls carry Fireboy (40%) along into the closing bonk.',
      'sideB',
      25,
      { pos: { x: -40, y: 0 }, facing: 1 },
      { pos: { x: -30, y: 0 }, facing: -1, damage: 40 },
      [{ port: 0, from: 10, to: 11, x: 100, buttons: ['special'] }],
    ),
    {
      name: `${ID}-stun-gun-charge`,
      description:
        'Stun Gun (neutral special) held to a full charge: the taser crackles at the prongs before it fires.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: ID }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -40, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: 10, y: 0 }, facing: -1 } },
      ],
      script: [{ port: 0, from: 10, to: 60, buttons: ['special'] }],
      capture: {
        label: "P1's stun gun is fully charged",
        when: (s) => s.fighters[0]!.move === 'neutralB' && s.fighters[0]!.charge >= STUN_GUN.chargeFrames,
      },
      motion: { before: 30, after: 30 },
      requires: ['move:neutralB'],
      refs: ['smash/attack-active-*', ...ART],
    },
    {
      name: `${ID}-stun-gun-paralyze`,
      description:
        'Stun Gun at full charge: the shot freezes Fireboy (40%) where he stands, shaking and flickering, before the knockback; capture 15 frames into the paralysis.',
      page: { kind: 'game' },
      match: { ports: [{ fighter: ID }, { fighter: 'fireboy' }] },
      patches: [
        { port: 0, state: { pos: { x: -40, y: 0 }, facing: 1 } },
        { port: 1, state: { pos: { x: -5, y: 0 }, facing: -1, damage: 40 } },
      ],
      script: [{ port: 0, from: 10, to: 60, buttons: ['special'] }],
      capture: {
        label: 'P2 is 15 frames into the paralysis',
        when: (s) => (s.fighters[1]!.statuses.find((st) => st.kind === PARALYZED)?.age ?? 0) >= 15,
      },
      motion: { before: 50, after: 50 },
      requires: ['move:neutralB'],
      refs: ['smash/attack-active-*', ...ART],
    },
    moveShot(
      'up-special',
      'Grappling Hook (up special) from below the left ledge: the hook flies, then Bob zips up after it.',
      'upB',
      12,
      air(-100, -28, 1),
      { pos: { x: -55, y: 0 }, facing: -1 },
      [{ port: 0, from: 10, to: 11, y: 100, buttons: ['special'] }],
    ),
  ],
};
