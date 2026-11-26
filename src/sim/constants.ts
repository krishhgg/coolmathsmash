/**
 * Universal engine constants. Units follow Smash Ultimate: distances in game units (Battlefield's main
 * platform is 160 wide), speeds in units/frame, time in frames at 60 Hz. Fighter-specific values live in
 * each fighter's stats; these are the values every fighter shares.
 */

/** Stick values below this magnitude (per axis) read as neutral. */
export const STICK_DEADZONE = 0.2;
/** A stick axis below this magnitude counts as "back at neutral" for flick (tap) detection. */
export const FLICK_NEUTRAL = 0.3;
/**
 * Frames between leaving neutral and reaching a threshold for the motion to count as a flick: dashes, tap jumps
 * (Ultimate common param `jump_flick_y` 3) and C-stick smashes. Fast falls, dodges and platform drops have their own.
 */
export const FLICK_WINDOW = 3;
/** Horizontal stick that starts a dash when flicked (Ultimate common param `dash_stick_x` 0.85). */
export const DASH_THRESHOLD = 0.85;
/** A run brake runs again with the stick forward past this (Ultimate common param `run_stick_x` 0.75). */
export const RUN_THRESHOLD = 0.75;
/** A run brake turns around with the stick back past this (`turn_run_stick_x` -0.6). */
export const TURN_RUN_THRESHOLD = 0.6;
/** Lying down, the stick sideways rolls and up stands. No source; it is the dash threshold this used to share. */
export const GETUP_STICK = 0.6;
/** A flick: the stick reaches `stick` (a magnitude) within `frames` frames of its last neutral frame. */
export interface Flick {
  stick: number;
  frames: number;
}
/** Fast fall: down to -0.66 within 4 frames (Ultimate common params `dive_cont_value`, `dive_flick_frame_value`). */
export const FAST_FALL_FLICK: Flick = { stick: 0.66, frames: 4 };
/**
 * Platform drop: down to -0.6875 within 6 frames (`pass_stick_y`, `pass_flick_y`). Holding down past the same
 * -0.6875 in the air passes through platforms.
 */
export const PLATFORM_DROP_FLICK: Flick = { stick: 0.6875, frames: 6 };
/**
 * Spot dodge (down to -0.7) and rolls (sideways to 0.7) out of shield, within 4 frames (`escape_stick_y`,
 * `escape_flick_y`, `escape_fb_stick_x`, `escape_fb_flick_x`).
 */
export const DODGE_FLICK: Flick = { stick: 0.7, frames: 4 };
/** Stick magnitude (when flicked within SMASH_WINDOW frames of the attack press) that makes a smash attack. */
export const SMASH_THRESHOLD = 0.7;
export const SMASH_WINDOW = 4;
/** Flicking up past this jumps when tap-jump is on. */
export const TAP_JUMP_THRESHOLD = 0.7;
/** Holding down past this crouches (low enough that the keyboard walk modifier + down crouches without a drop). */
export const CROUCH_THRESHOLD = 0.45;
/** Any stick magnitude above this picks a direction for tilts, throws and ledge options. */
export const DIRECTION_THRESHOLD = 0.25;

/**
 * Ultimate's special_stick_y and special_stick_x (common params, 13.0.1): Special is an up or down special once the
 * stick is half way up or down, and a side special only once it is 0.6 sideways, so diagonals are up and down specials.
 */
export const SPECIAL_STICK_Y = 0.5;
export const SPECIAL_STICK_X = 0.6;

/**
 * Turnaround special and B-reverse (Ultimate; SmashWiki "B-reversing", https://www.ssbwiki.com/B-reversing).
 * - Turnaround special: the stick at least `stickX` behind the fighter on the frame Special starts a special turns
 *   the fighter around first and keeps its momentum. It works for every special, on the ground and in the air ("In
 *   Ultimate, the new dash cancel mechanics now allow characters to perform grounded turnaround-Bs"; "when a player
 *   reverses the direction of their up special to recover, they are performing a turnaround up special").
 * - B-reverse: the stick at least `stickX` behind the fighter on frames `window` of the special, 1 to 4 frames after
 *   the press ("In Ultimate, the direction input must be within 4 frames of the special input"), turns it around
 *   and reverses its horizontal momentum ("turning around and reversing their momentum"), on the ground and in the
 *   air. Once per special. The window counts frames since the press, so a charge holding the move on its charge
 *   frame doesn't stretch it; charging specials can be B-reversed (Samus's Charge Shot is an exception only "prior
 *   to Ultimate"). Neutral, side and down specials allow it ("In Brawl, SSB4 and Ultimate, most side special
 *   moves can be reversed in the first few frames", SmashWiki "Side special move"); up specials don't, since
 *   SmashWiki only describes reversing them as a turnaround. "Not every special move can be B-reversed":
 *   MoveDef.bReverse opts a move out (Falcon Punch, Warlock Punch, Disable) or an up special in.
 * - Wavebounce: a turnaround special then a B-reverse. The fighter keeps its facing and its momentum reverses.
 * SmashWiki gives no stick threshold, so `stickX` is the engine's DIRECTION_THRESHOLD.
 */
export const SPECIAL_REVERSE = {
  stickX: DIRECTION_THRESHOLD,
  window: [2, 5] as [number, number],
};

/**
 * Button presses are remembered this many frames, so an input made during lag comes out on the first actionable frame.
 * SmashWiki (Buffer): Ultimate's window is "now 9 frames, down from 10". The params `precede` 7 and
 * `precede_extension` 2 may be the same 9 (physics-reference section 10).
 */
export const INPUT_BUFFER_FRAMES = 9;
/**
 * Ultimate's hold buffer (SmashWiki, Buffer): a press "can be made as early as desired, but must be held until the
 * beginning of the standard 9 frame buffer window". So a held button stays buffered, and the window counts from the
 * last frame it was held rather than from the press.
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
 * The shield-break dizzy, per SmashWiki: Stun (https://www.ssbwiki.com/Stun). Mashing cuts it by "3 frames per input"
 * on the stick and "5.4 for buttons in Smash 4 and Ultimate" (param `furafura_clatter_frame` 3; buttons count 1.8x,
 * as in grabs). The wiki gives no minimum. Then every fighter plays its wake-up (FuraFuraEnd), "33 frames from
 * Smash 4 onward", and can act on the frame after.
 */
export const DIZZY = { mashStick: 3, mashButton: 5.4, wakeFrames: 33 };

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
/** Mario's back roll travels 30.63 u (SmashWiki: Roll); fighters set it as `backRollDistance`. */
export const ROLL_BACK = {
  faf: 35,
  intangible: [5, 16] as [number, number],
  move: [4, 20] as [number, number],
};
/**
 * Air dodges: Mario's Ultimate frame data, shared by every fighter. UFD and SmashWiki (https://www.ssbwiki.com/Air_dodge)
 * give total frames: neutral 52; directional 71 down, 77 diagonally down, 87 sideways, 102 diagonally up, 116 up.
 * FAF is total + 1, as for the ground dodges. A directional dodge leaves the fighter able to act, not helpless.
 * The slide's sources are in docs/physics-reference.md section 7.
 */
export const AIR_DODGE_NEUTRAL = { faf: 53, intangible: [3, 29] as [number, number], landingLag: 10 };
export const AIR_DODGE_DIRECTIONAL = {
  /** FAF by stick angle from straight down to straight up, every 45 degrees; angles between interpolate. */
  fafByAngle: [72, 78, 88, 103, 117],
  /** A shorter stick gives a neutral air dodge (`escape_air_slide_stick` 0.66, of the stick's length). */
  stick: 0.66,
  intangible: [3, 21] as [number, number],
  /**
   * The slide starts at `speed` and brakes by a constant amount each frame along the dodge until it is down to
   * `endSpeed`, the brake that takes `distance` units to do it (Mario's fighter_param_motion: escape_air_slide_speed
   * 4.2, escape_air_slide_distance 20, escape_air_slide_end_speed 1.3; 81 of 83 fighters share them).
   */
  speed: 4.2,
  distance: 20,
  endSpeed: 1.3,
  /** Gravity and air friction take over the slide's speed from this frame (script flag SLIDE_ENABLE_GRAVITY). */
  gravityFrom: 14,
  /** The stick drifts the fighter again from this frame (script flag SLIDE_ENABLE_CONTROL). */
  driftFrom: 24,
  /** Ledges can be grabbed from this frame (Ultimate: after 24 frames). */
  ledgeFrom: 25,
  landingLagEarly: 19,
  landingLagLate: 11,
};

/**
 * Ledges (Ultimate): six grabs per airtime, intangibility on the first grab only. The hang intangibility is
 * formulas.ts ledgeIntangibility (airtime and %, 23-123 frames counting the catch).
 */
export const LEDGE_MAX_GRABS = 6;
/**
 * Hang frames after the catch; the fighter lets go on the next one (param cliff_catch_time_quick 0x168 = 360;
 * SmashWiki's 6.5 s is rounded, physics-reference sections 8 and 21).
 */
export const LEDGE_HANG_MAX = 360;
/**
 * Frames after letting go of a ledge before a ledge can be caught again (param cliff_no_catch_frame 0x2C = 44,
 * physics-reference section 8). Being hit sets LEDGE_HIT_LOCK instead.
 */
export const LEDGE_REGRAB_LOCK = 44;
/**
 * A ledge trump (Ultimate's CliffRobbed): a fighter catching a ledge another fighter hangs from pushes that fighter
 * off (movement.ts tryLedgeGrab, action `trumped`). SmashWiki (Edgeguarding, "Ledge trumping") says the catch will
 * "gently remove them from the ledge", so they "automatically let go of the ledge and they cannot take any action
 * for a moment". It gives no numbers, so they come from the params (physics-reference section 8,
 * physics-constants.json ledge.trump). Frames count in the trumped fighter's own steps, frame 1 being its first
 * after the trump.
 */
export const LEDGE_TRUMP = {
  /** Pushed straight out from the stage at this speed (param cliff_robbed_speed_x 0.9). */
  speedX: 0.9,
  /** No vertical speed: the sheet has no cliff_robbed speed for y, and SmashWiki's "gently" suggests no launch. */
  speedY: 0,
  /**
   * Frames without control (param cliff_robbed_no_control_frame 0x1C = 28): the stick and buttons do nothing, so it
   * slows by air friction and falls, then acts on frame 29.
   */
  noControl: 28,
  /** It let go of the ledge, so it catches none for the same 44 frames as any let-go (cliff_no_catch_frame). */
  regrabLock: LEDGE_REGRAB_LOCK,
  /**
   * Intangible frames: none, and it loses what was left of its hang intangibility. SmashWiki: "the removal of ledge
   * regrab invincibility can be exploited by a ledge trump edgeguard", Sheik's back air on the trumped fighter.
   */
  intangible: 0,
};
/**
 * The catch lasts 19 frames counting the grab frame, so the hang acts on frame 20 (physics-reference section 8;
 * SmashWiki Edge, "lasts 19 frames by default, preventing action until frame 20"; data viewer cliff_catch
 * CancelFrame 20).
 */
export const LEDGE_CATCH_FRAMES = 19;
/**
 * Getups, frame 1 being the input frame. Intangibility and totals are Mario's from UFD Ledge Stats
 * (physics-reference section 8, physics-constants.json ledge.options_mario); faf = total + 1 (docs/fighters.md).
 * Neutral getup 1-33 / 34 total, roll 1-25 / 45, attack 1-26 / 55, jump 1-12 / 14. `moveEnd` and `rise` (when the
 * fighter reaches the stage) are not in the sources and stay as they were.
 */
export const LEDGE_CLIMB = { faf: 35, intangible: [1, 33] as [number, number], moveEnd: 30 };
export const LEDGE_ROLL = { faf: 46, intangible: [1, 25] as [number, number], moveEnd: 40, distance: 25 };
export const LEDGE_ATTACK = { faf: 56, intangible: [1, 26] as [number, number], moveEnd: 20 };
export const LEDGE_JUMP = { rise: 6, faf: 15, intangible: [1, 12] as [number, number], hSpeed: 0.6 };
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

/**
 * Counter defaults (MoveDef.counter), Marth's Counter in Ultimate (SmashWiki, Marth (SSBU)/Down special,
 * Parameters): the counterattack deals 1.2x the caught hit's damage, at most 50%, and both fighters freeze for 21
 * frames on the catch ("Counter hitlag on activation"). Every counter in SmashWiki's Counterattack table caps at 50%.
 */
export const COUNTER = { multiplier: 1.2, max: 50, freeze: 21 };

/**
 * Hitstun cancel (Ultimate): an air dodge out of tumble after 40 frames of hitstun (from frame 41) once the launch
 * speed is below 2.5 u/frame. SmashWiki (Hitstun): "at least 40 frames" and "lower than 2.5"; params
 * damage_fly_escape_frame 40, damage_fly_escape_speed 2.5; SSBU-Calculator HitstunCancel: max(i + 2, 40 + 1), lc < 2.5.
 */
export const HITSTUN_CANCEL_AIR_DODGE = { after: 40, below: 2.5 };
/**
 * Hitstun cancel (Ultimate): an aerial out of tumble after 45 frames of hitstun (from frame 46) once the launch
 * speed is below 2 u/frame. SmashWiki (Hitstun): "at least 45 frames" and "lower than 2"; params
 * damage_fly_attack_frame 45, damage_fly_attack_speed 2; SSBU-Calculator HitstunCancel: max(i + 2, 45 + 1), lc < 2.
 */
export const HITSTUN_CANCEL_AERIAL = { after: 45, below: 2 };
/** Frames a fighter that was just hit cannot grab ledges. */
export const LEDGE_HIT_LOCK = 30;

/** Hard landing applies after this many airborne frames (Ultimate: 4). */
export const HARD_LANDING_AIRTIME = 4;
export const HELPLESS_AIR_SPEED = 0.8;
/** Landing out of helpless fall when the move gives none: Mario's landing_fall_special, FAF 30. */
export const HELPLESS_LANDING_LAG = 29;
export const RUN_BRAKE_FRAMES = 14;
/**
 * Ultimate's dash_speed_keep_frame (common params: 6): an initial dash holds its dash speed for its first 6 frames,
 * whatever the stick does. From frame 7 the dash moves on run physics (GROUND.dash), so the slide after a released
 * stick and the ease down to run speed both brake at the fighter's traction. Source: the decompiled control energy
 * for the Dash status, FighterKineticEnergyControl::update in github.com/blu-dev/energy_id (src/control.rs), which
 * zeroes the dash's acceleration and brake while its frame counter is below dash_speed_keep_frame. The param value
 * is from the common.prc dump in github.com/fudgepop01/amiibo_research and docs/physics-reference.md section 10.
 */
export const DASH_SPEED_KEEP_FRAMES = 6;

/**
 * Ultimate's turn_dash_frame (common params: 5): a flick back on frames 1-5 of an initial dash, counted from the
 * dash's first frame, turns it into a dash the other way at once. A flick back later in the initial dash goes into the
 * input buffer and the dash back comes out on the frame the dash ends; once the run starts, back is the run
 * turnaround. UFD stats, Dash Turnaround, Mario: "Fast (Initial Dash)" frames 1-5, "Normal (Buffer Window)" 6-10,
 * "Slow (Full Dash)" 11. SmashWiki, Dashdance: in Ultimate "any character is free to dash back without the laggy
 * skid animation as long as the run phase of the dash has not begun". See docs/physics-reference.md section 10.
 */
export const TURN_DASH_FRAMES = 5;

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
/**
 * Ultimate's meteor blast line (SmashWiki, "Meteor smash": a fighter meteor smashed "with their total launch speed
 * being 3 units per frame ... or higher when they reach about 25 units below the camera boundary" is KO'd before the
 * lower blast line). The speed is the downward launch speed plus the fighter's own, as SSBU-Calculator's KO check
 * (knockback.js, "Meteor smash KO") adds them.
 */
export const METEOR_KO_DEPTH = 25;
export const METEOR_KO_MIN_SPEED = 3;

/** Respawn (Ultimate): wait on the platform up to 5 s, then 2 s of invincibility after leaving it. */
export const RESPAWN_DELAY = 60;
export const RESPAWN_PLATFORM_MAX = 300;
export const RESPAWN_INVINCIBILITY = 120;

/**
 * `MatchConfig.stocks` for the Infinite rule, which plays like Ultimate's Time battle: a KO costs no stock, so nobody
 * is ever eliminated and only the clock (or quitting) ends the match.
 */
export const INFINITE_STOCKS = 99;
