import { stats } from './stats';

/**
 * Rev Up's timing (neutral special). Ultimate analogue: Donkey Kong's Giant Punch, read from SmashWiki ("Giant Punch",
 * "Donkey Kong (SSBU)/Neutral special") and ultimateframedata.com/donkey_kong.
 *
 * - `charge`: the move pauses on frame 7 while he revs ("Entering charge window takes 7 frames").
 * - `chargeFrames`: 110 frames to full revs ("The charge duration lasts 110 Frames as of 6.0.0").
 * - `hit`, `faf`: the fully charged punch's timing, a hitbox from frame 19 and FAF 48, so a stored full charge
 *   comes out on Giant Punch's frame. The uncharged punch hits 19 frames after the release with FAF 70 in Ultimate.
 *   One timeline can't hold both, and the stored full blast is the one that decides whether the move is safe.
 * - `drive`: neither source says how far the punch moves Donkey Kong, so the blast forward is Wheely's own. He pops
 *   the clutch 2 frames before the hit and drives through the hit window.
 * - `speed`: his drive speed uncharged and at full revs. Uncharged is his top run speed (Little Mac's). Full revs
 *   cover about 75 units, from Little Mac's Straight Lunge, Ultimate's other tap-charged lunge. SmashWiki says the
 *   full lunge sends him "almost half the distance of Final Destination", whose main stage is 160 wide.
 */
export const REV_UP = {
  charge: 7,
  chargeFrames: 110,
  hit: [19, 26] as [number, number],
  drive: [17, 26] as [number, number],
  faf: 48,
  speed: [stats.runSpeed, 5.2] as [number, number],
};
