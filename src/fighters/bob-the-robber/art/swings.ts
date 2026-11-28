import type { SwingChecks } from '../../../render/rig/swingChecks';
import { FLOOR_DECALS } from './poses';

/**
 * Grounded clips checked frame by frame: his attacks, grabs and throws, specials, dodges, shield, crouch, Final
 * Smash, walk, run, grab release and the ledge climb and roll. The clips in the air are listed under AIR.
 */
export const SWINGS = [
  'jab',
  'jab2',
  'jab3',
  'ftilt',
  'utilt',
  'dtilt',
  'dashAttack',
  'fsmash',
  'dsmash',
  'getupAttack',
  'dashGrab',
  'dthrow',
  'ledgeAttack',
  'usmash',
  'grab',
  'pivotGrab',
  'fthrow',
  'bthrow',
  'uthrow',
  'sideB',
  'neutralB',
  'downB',
  'downBHit',
  'spotDodge',
  'rollForward',
  'rollBack',
  'techRoll',
  'getupRoll',
  'techRollBack',
  'getupRollBack',
  'shield',
  'shieldDrop',
  'crouch',
  'finalSmash',
  // The Final Smash cut scene plays over the stage, with its floor drawn.
  'finalSmashCinematic',
  'walk',
  'run',
  'runBrake',
  'grabRelease',
  'ledgeClimb',
  'ledgeRoll',
];

/**
 * Clips in the air: checked frame by frame like the grounded ones, with no floor under them. The aerials, the air
 * special, the Stun Gun and Final Smash in the air, the air dodge, jumps, falls, tumbling and hitstun.
 */
export const AIR = [
  'nair',
  'fair',
  'bair',
  'uair',
  'dair',
  'upB',
  'neutralBAir',
  'finalSmashAir',
  'airDodge',
  'jump',
  'doubleJump',
  'ledgeJump',
  'fall',
  'helpless',
  'tumble',
  'hitstun',
];

/**
 * Drawings in the Final Smash cut scene that cross the floor line on purpose, by symbol name prefix, left out of the
 * floor check like the shadow pool.
 */
export const SCENE_FLOOR: Record<string, string> = {
  dark: 'the dark (and its iris and spotlight) covers the whole screen round him',
  spotBeam: "the spotlight's pool of light lies on the floor at his feet",
  fightCloud:
    'the fight cloud sits on the stage round the two of them, its lowest puffs across the floor line',
  shadowBurst: 'the cloud bursting into smoke round the foe, its lower puffs across the floor line',
};

/** Clips with the loot sack in his hand. */
const SACKS = ['dashAttack', 'dair'];

/** Bob's clips and allowances for the swing checks (`src/render/rig/swingChecks.ts`). */
export const swingChecks: SwingChecks = {
  ground: SWINGS,
  air: AIR,
  props: ['baton', 'sack', 'gun'],
  /** The baton's tip, as `tipOf` in poses.ts. */
  tips: { baton: 7.5 },
  decals: [...FLOOR_DECALS, ...Object.keys(SCENE_FLOOR)],
  cuts: [
    {
      clip: 'finalSmashCinematic',
      frame: 23,
      why: 'the iris shuts and the scene cuts to the dark, where only his eyes show',
    },
    { clip: 'finalSmashCinematic', frame: 320, why: 'the spotlight comes on, on his bow' },
  ],
  covered: [
    {
      clip: 'finalSmashCinematic',
      slot: 'fx2',
      from: 90,
      to: 292,
      why: 'the fight cloud the flurry happens in, with his arm swinging under it',
    },
  ],
  face: { prop: 'sack', clips: SACKS, head: 'head', features: 'face', hat: 'hat' },
};
