import { BLAST } from '../fireboy/finalSmash';

/**
 * Watergirl's Final Smash, Tidal Wave: she raises a wave out of the floor and sends it rolling across the stage, the
 * water half of the twins' "fire and water blasts" (roster plan). Her whole kit is on Mario's frames, and Fireboy's
 * Fire Blast is on Mario Finale, so hers is on Mario Finale too, in Ultimate 13.0.1 (SmashWiki, "Mario
 * (SSBU)/Final Smash", whose overview calls it "a large wave of fire to push opponents off the stage"):
 *
 * - Timing table: early hits 65-104, mid hits 105-154, late hits 155-224, each at a rehit rate of 7; interruptible
 *   on frame 157 grounded and 147 aerial. The wave is an entity that keeps rolling after she can act, as Mario's
 *   fireballs are articles that outlive his animation.
 * - Hitbox table: fire1 and fire2, radius 16.0, each stretched from Y -3 to 3, with the early 2.5%, mid 3% and late
 *   3.5% rows, grounded and aerial rows apart (MARIO_FINALE, src/fighters/fireboy/finalSmash.ts). Hitlag x0.0;
 *   unblockable, unreflectable, unabsorbable, no clang. Here fire1 is the wave's curling crest and fire2 its body
 *   along the floor. The Flame effect becomes the plain one: this is water, and the engine has no water effect.
 * - Every window landed adds up to 74%: SmashWiki's Mario Finale article puts Ultimate's at "about 75%".
 * - Mario Finale has no finishing hitbox; it KOs by carrying. Its strongest hits, the late rows, KO a Mario at
 *   Battlefield's ledge from 243.7% (aerial row, 23 degrees) and 288.5% (grounded row, 50 degrees) on SSBU-Calculator's
 *   KO calculator (rubendal/SSBU-Calculator 233590e, run headless on these values, fresh, no rage, no DI).
 *
 * The moves and the entity are in finalSmash.ts. SmashWiki gives no speed for the fireballs. Swept from 0.9 to 1.6 units a frame with the centre 10 or 13 up, the
 * wave lands the most hits on a Mario-weight fighter standing 30 units in front, summed over 0 to 150%, at 1.1 and 13
 * up: 89 hits, where Fireboy's fire (1.1, 10 up) lands 85. So hers rises higher than his, its body along the floor,
 * and rolls 176 units, past the far ledge of Battlefield (160 wide).
 */
export const WAVE = {
  /** Move frame the wave breaks forward: Mario Finale's first hit. */
  frame: BLAST.frame,
  /** Frames it rolls: Mario Finale's hits run from frame 65 to 224. */
  lifetime: BLAST.lifetime,
  rehit: BLAST.rehit,
  /** Units a frame, forward: an estimate, SmashWiki gives none. */
  speed: 1.1,
  /** Where its centre rises, from the feet: in front of her sweeping hands, its body's lowest edge under the floor. */
  x: 20,
  y: 13,
  /** Its body circle: Mario Finale's hitbox radius. */
  radius: 16,
};

/**
 * Mario Finale's two boxes round the wave's centre (x forward, y up), each radius 16.0 and stretched from Y -3 to 3:
 * fire1, the wave's curling crest, 3 above the centre line, and fire2, its body along the floor, 3 below. The entity's
 * hitboxes are built from these, and the art draws the wave inside them (art/parts.ts, art/index.test.ts), so the
 * drawing and the hits come from one place. They live apart from the moves so the art can read them without loading
 * sim code.
 */
export const WAVE_BOXES: readonly { x: number; y: number; radius: number }[] = [
  { x: 0, y: 3, radius: 16 },
  { x: 0, y: -3, radius: 16 },
];
