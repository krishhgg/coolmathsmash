import type { SwingChecks } from '../../../render/rig/swingChecks';
import { FLOOR_DECALS } from './poses';

/**
 * Grounded clips checked frame by frame: his attacks, grabs and throws, specials, dodges, shield, crouch and Final
 * Smash. The clips in the air are listed under AIR.
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

/** Clips with the loot sack in his hand. */
const SACKS = ['dashAttack', 'dair'];

/**
 * The frame each swing's checks start from. The ledge attack opens with the ledge climb, drawn frame by frame and
 * shared with ledgeClimb and ledgeRoll, so its checks start on frame 12, where the climb leaves him standing.
 */
const FROM: Record<string, number> = { ledgeAttack: 12 };

/** Bob's clips and allowances for the swing checks (`src/render/rig/swingChecks.ts`). */
export const swingChecks: SwingChecks = {
  ground: SWINGS,
  air: AIR,
  from: FROM,
  props: ['baton', 'sack', 'gun'],
  /** The baton's tip, as `tipOf` in poses.ts. */
  tips: { baton: 7.5 },
  decals: FLOOR_DECALS,
  face: { prop: 'sack', clips: SACKS, head: 'head', features: 'face', hat: 'hat' },
};
