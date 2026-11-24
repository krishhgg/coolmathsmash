/**
 * Universal engine constants. Units follow Smash Ultimate: distances in game units (Battlefield's main
 * platform is 160 wide), speeds in units/frame, time in frames at 60 Hz. Fighter-specific values live in
 * each fighter's stats; these are the values every fighter shares.
 */

/** Stick values below this magnitude (per axis) read as neutral. */
export const STICK_DEADZONE = 0.2;
/** A stick axis below this magnitude counts as "back at neutral" for flick (tap) detection. */
export const FLICK_NEUTRAL = 0.3;
/** Frames between leaving neutral and reaching a threshold for the motion to count as a flick. */
export const FLICK_WINDOW = 3;
/** Horizontal stick magnitude that starts a dash (when flicked) and separates walk from run speed. */
export const DASH_THRESHOLD = 0.6;
/** Stick magnitude (when flicked within SMASH_WINDOW frames of the attack press) that makes a smash attack. */
export const SMASH_THRESHOLD = 0.7;
export const SMASH_WINDOW = 4;
/** Flicking up past this jumps when tap-jump is on. */
export const TAP_JUMP_THRESHOLD = 0.7;
/** Flicking down past this fast-falls in the air and drops through soft platforms. */
export const DOWN_FLICK_THRESHOLD = 0.7;
/** Holding down past this crouches. */
export const CROUCH_THRESHOLD = 0.6;
/** Any stick magnitude above this picks a direction for tilts, specials and dodges. */
export const DIRECTION_THRESHOLD = 0.25;

/** Button presses are remembered this many frames, so an input made during lag comes out on the first actionable frame. */
export const INPUT_BUFFER_FRAMES = 5;
/**
 * Ultimate's "hold buffer": a press made during lag that is still held when the fighter becomes actionable
 * is used then, however long ago it was pressed.
 */
export const HOLD_BUFFER = true;
