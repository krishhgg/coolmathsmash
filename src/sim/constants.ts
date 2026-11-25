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

/**
 * Ultimate's special_stick_y and special_stick_x (common params, 13.0.1): Special is an up or down special once the
 * stick is half way up or down, and a side special only once it is 0.6 sideways, so diagonals are up and down specials.
 */
export const SPECIAL_STICK_Y = 0.5;
export const SPECIAL_STICK_X = 0.6;

/**
 * Button presses are remembered this many frames, so an input made during lag comes out on the first actionable frame.
 * Ultimate's `precede` param is 7; its 2-frame `precede_extension` for held inputs is covered by HOLD_BUFFER.
 */
export const INPUT_BUFFER_FRAMES = 7;
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
/**
 * Parry (Ultimate's perfect shield; physics-reference sections 5 and 6, SmashWiki "Perfect shield"). A hit landing
 * on frames 1-5 of the 11-frame shield drop (`shield_just_frame` 5) is parried: no shield damage, no shieldstun.
 * A drop starting less than 3 frames after a shieldstun ends can't parry. On a fighter's (direct) hit the attacker
 * freezes 14 frames longer (`just_shield_hitstop_frame_add` 0xE) and the defender 11 longer, so the defender acts
 * 3 frames first; on an entity's (indirect projectile) hit the owner is unaffected and the defender freezes 1 frame
 * less. physics-reference caps the attacker's freeze at 30, the normal hitlag cap; the defender's cap is ours.
 */
export const PARRY = {
  window: 5,
  lockout: 3,
  attackerHitlag: 14,
  defenderHitlag: 11,
  projectileDefenderHitlag: -1,
  maxHitlag: 30,
};
/** Height a broken shield launches its owner to. The dizzy that follows lasts shieldBreakStun (formulas.ts) frames. */
export const SHIELD_BREAK_HEIGHT = 40;

/**
 * Ground dodges: Mario's Ultimate frame data, shared by every fighter (each sets its own `rollDistance`). UFD
 * (https://ultimateframedata.com/mario) and SmashWiki (https://www.ssbwiki.com/Spot_dodge,
 * https://www.ssbwiki.com/Roll) give total frames: spot dodge 25, or 20 when cancelled into an attack; forward
 * roll 29; back roll 34. FAF is total + 1, the convention docs/fighters.md uses and the data viewer's CancelFrame
 * confirms (Mario's ledge getup: UFD total 34, CancelFrame 35). Frame windows are inclusive.
 */
export const SPOT_DODGE = {
  faf: 26,
  intangible: [3, 17] as [number, number],
  /**
   * From this frame a ground attack or special cancels the dodge; grabs and dash attacks wait for the FAF
   * (SmashWiki: "can now be canceled 5 frames earlier than usual into any ground attack").
   */
  attackCancel: 21,
};
/** Mario's forward roll travels 32.17 u (SmashWiki: Roll). The movement frames are not in the reference. */
export const ROLL_FORWARD = {
  faf: 30,
  intangible: [4, 15] as [number, number],
  move: [4, 20] as [number, number],
};
export const ROLL_BACK = {
  faf: 35,
  intangible: [5, 16] as [number, number],
  move: [4, 20] as [number, number],
};
/**
 * Air dodges: Mario's Ultimate frame data, shared by every fighter. UFD and SmashWiki (https://www.ssbwiki.com/Air_dodge)
 * give total frames: neutral 52; directional 71 down, 77 diagonally down, 87 sideways, 102 diagonally up, 116 up.
 * FAF is total + 1, as for the ground dodges. A directional dodge leaves the fighter able to act, not helpless.
 */
export const AIR_DODGE_NEUTRAL = { faf: 53, intangible: [3, 29] as [number, number], landingLag: 10 };
export const AIR_DODGE_DIRECTIONAL = {
  /** FAF by stick angle from straight down to straight up, every 45 degrees; angles between interpolate. */
  fafByAngle: [72, 78, 88, 103, 117],
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

/** Tethers (src/sim/actions/tether.ts, docs/fighters.md). */
export const TETHER = {
  /** The line leaves the hand at this share of the fighter's height above the feet. */
  handHeight: 0.6,
  /** A tether line catches a ledge it passes within this many units of, from off the stage (generous snapping). */
  ledgeSnap: 10,
  /** A reeling fighter this close to the ledge's hang position grabs the ledge. */
  ledgeArrive: 6,
  /** Extra frames a reel may take beyond range / pullSpeed before it gives up (stuck against a wall). */
  pullSlack: 10,
};

/**
 * Grabs (Ultimate; physics-reference sections 6 and 14). A grab holds floor(90 + 1.7 x %) frames
 * (formulas.ts grabHoldFrames), cut by the victim's mashing, but never under minHold frames.
 */
export const GRAB = {
  /** Frames removed per new stick direction and per button press while held. */
  mashStick: 8,
  mashButton: 14.4,
  minHold: 19,
  /** After a grab ends without a throw, the freed fighter can't be grabbed again for this many frames. */
  regrabImmunity: 60,
  /** Damage from fighters outside the grab (3+ players) that frees the held fighter. */
  breakDamage: 10,
  /** Shield grabs come out this many frames after shieldstun ends (shield_setoff_catch_frame). */
  shieldGrabLock: 4,
  /** Grab boxes shrink to this share of their radius against airborne fighters. */
  airborneRadius: 0.5,
  /** Grab release: both fighters are stuck this long, so neither has the advantage (Ultimate: 29 frames of lag). */
  releaseLag: 29,
  /** Release push speed, decaying with traction (ESTIMATE). */
  releaseSpeed: 1.5,
  /** Two grabs connecting with each other: both release and take this damage (Ultimate: 1%, 1.2% in 1v1). */
  clankDamage: 1,
  /** Space between the two bodies while one holds the other (ESTIMATE). */
  holdGap: 1,
};

/** Hitstun cancel (Ultimate): air dodge out of tumble from frame 40 once the launch has slowed to 2.5 u/frame. */
export const HITSTUN_CANCEL_AIR_DODGE = { from: 40, maxSpeed: 2.5 };
/** Frames a fighter that was just hit cannot grab ledges. */
export const LEDGE_HIT_LOCK = 30;

/** Hard landing applies after this many airborne frames (Ultimate: 4). */
export const HARD_LANDING_AIRTIME = 4;
export const HELPLESS_AIR_SPEED = 0.8;
/** Landing out of helpless fall when the move gives none: Mario's landing_fall_special, FAF 30. */
export const HELPLESS_LANDING_LAG = 29;
export const RUN_BRAKE_FRAMES = 14;

/**
 * Tech (Ultimate): Shield pressed within TECH_WINDOW frames before a tumble landing techs it, and a press locks
 * out the next one for TECH_LOCKOUT frames. Floors only allow it at launch speeds up to TECH_MAX_SPEED (calc).
 */
export const TECH_WINDOW = 11;
export const TECH_LOCKOUT = 40;
export const TECH_MAX_SPEED = 3;
/** An air dodge out of tumble techs if it touches down within this many frames of its Shield press. */
export const AIR_DODGE_TECH_WINDOW = 15;
/** Mario's tech options. The roll's distance and movement frames are not in the reference: it reuses the roll's. */
export const TECH_IN_PLACE = { faf: 27, intangible: [1, 21] as [number, number] };
export const TECH_ROLL = {
  faf: 41,
  intangible: [1, 21] as [number, number],
  move: [4, 30] as [number, number],
};
/** Missed tech: bounce, then lie down until a getup is picked (automatic after DOWN_AUTO_GETUP frames). */
export const DOWN_BOUNCE_FRAMES = 26;
export const DOWN_AUTO_GETUP = 220;
export const GETUP_STAND = { faf: 30, intangible: [1, 23] as [number, number] };
export const GETUP_ROLL = {
  faf: 36,
  intangible: [1, 23] as [number, number],
  move: [4, 28] as [number, number],
};

/**
 * Grounded fighters standing in each other are pushed apart by this share of their overlap each frame. Not from
 * the reference: tuned so a walking fighter shoves a standing one at half walk speed instead of passing through.
 */
export const PUSH_STIFFNESS = 0.15;
export const RUN_TURN_FRAMES = 12;
export const DOUBLE_JUMP_FRAMES = 30;

/**
 * The top blast zone (SSBU-Calculator's KO check, knockback.js): crossing it KOs only with a vertical launch speed of
 * at least 2.4, or once the fighter is 30 units past it. Slower fighters drift back down.
 */
export const TOP_KO_MIN_SPEED = 2.4;
export const TOP_KO_MARGIN = 30;

/** Respawn (Ultimate): wait on the platform up to 5 s, then 2 s of invincibility after leaving it. */
export const RESPAWN_DELAY = 60;
export const RESPAWN_PLATFORM_MAX = 300;
export const RESPAWN_INVINCIBILITY = 120;

/**
 * `MatchConfig.stocks` for the Infinite rule, which plays like Ultimate's Time battle: a KO costs no stock, so nobody
 * is ever eliminated and only the clock (or quitting) ends the match.
 */
export const INFINITE_STOCKS = 99;
