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
/** Holding down past this crouches (low enough that the keyboard walk modifier + down crouches without a drop). */
export const CROUCH_THRESHOLD = 0.45;
/** Any stick magnitude above this picks a direction for tilts, specials and dodges. */
export const DIRECTION_THRESHOLD = 0.25;

/** Button presses are remembered this many frames, so an input made during lag comes out on the first actionable frame. */
export const INPUT_BUFFER_FRAMES = 5;
/**
 * Ultimate's "hold buffer": a press made during lag that is still held when the fighter becomes actionable
 * is used then, however long ago it was pressed.
 */
export const HOLD_BUFFER = true;

/** Shield (Ultimate): health, per-frame depletion while held and regeneration while down, break and drop. */
export const SHIELD_MAX = 50;
export const SHIELD_DEPLETION = 0.15;
export const SHIELD_REGEN = 0.08;
export const SHIELD_MIN_HOLD = 3;
export const SHIELD_DROP_FRAMES = 11;
export const SHIELD_HP_AFTER_BREAK = 37.5;
/** Height a broken shield launches its owner to, and how long they stay dizzy after landing (approximate). */
export const SHIELD_BREAK_HEIGHT = 40;
export const SHIELD_BREAK_DIZZY = 300;

/** Dodges (Ultimate, Mario-like defaults). Frame windows are inclusive. */
export const SPOT_DODGE = { faf: 27, intangible: [3, 17] as [number, number] };
export const ROLL = { faf: 31, intangible: [4, 15] as [number, number], move: [4, 20] as [number, number] };
export const AIR_DODGE_NEUTRAL = { faf: 47, intangible: [3, 29] as [number, number], landingLag: 10 };
export const AIR_DODGE_DIRECTIONAL = {
  faf: 70,
  intangible: [3, 21] as [number, number],
  /** Free movement ends and gravity returns. */
  moveEnd: 20,
  decay: 0.9,
  /** Ledges can be grabbed from this frame (Ultimate: after 24 frames). */
  ledgeFrom: 25,
  landingLagEarly: 19,
  landingLagLate: 11,
};

/** Ledges (Ultimate): six grabs per airtime, intangibility on the first grab only. */
export const LEDGE_MAX_GRABS = 6;
export const LEDGE_INTANGIBILITY = 60;
export const LEDGE_HANG_MAX = 300;
export const LEDGE_REGRAB_LOCK = 20;
export const LEDGE_CATCH_FRAMES = 8;
export const LEDGE_CLIMB = { faf: 34, intangible: [1, 30] as [number, number], moveEnd: 30 };
export const LEDGE_ROLL = { faf: 50, intangible: [1, 34] as [number, number], moveEnd: 40, distance: 25 };
export const LEDGE_ATTACK = { faf: 56, intangible: [1, 22] as [number, number], moveEnd: 20 };
export const LEDGE_JUMP = { rise: 6, intangible: [1, 13] as [number, number], hSpeed: 0.6 };
/** Getup intangibility by grab count since last touching ground (Ultimate: ×0.8 on the 2nd grab, ×0.5 on the 3rd, none after). */
export const LEDGE_GETUP_INTANGIBILITY_SCALE = [1, 0.8, 0.5];

/** Hard landing applies after this many airborne frames (Ultimate: 4). */
export const HARD_LANDING_AIRTIME = 4;
export const HELPLESS_AIR_SPEED = 0.8;
export const HELPLESS_LANDING_LAG = 30;
export const RUN_BRAKE_FRAMES = 14;
export const RUN_TURN_FRAMES = 12;
export const DOUBLE_JUMP_FRAMES = 30;

/** Respawn (Ultimate): wait on the platform up to 5 s, then 2 s of invincibility after leaving it. */
export const RESPAWN_DELAY = 60;
export const RESPAWN_PLATFORM_MAX = 300;
export const RESPAWN_INVINCIBILITY = 120;
