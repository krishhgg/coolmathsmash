/**
 * The fighter format. One directory per fighter under src/fighters/<id>/ whose index.ts exports
 * `fighter: FighterDef`; the registry discovers it automatically. All numbers use Smash Ultimate's units
 * (game units, units/frame, frames at 60 Hz) so reference data can be used as-is. See docs/fighters.md.
 */

import type { ActionDef } from '../sim/actions/registry';
import type { ButtonName } from '../input/types';
import type { CastHit } from '../sim/cast';
import type { Hurtbox } from '../sim/combat/hits';
import type { AbsorberDef, EntityDef, ReflectorDef, SpawnDef } from '../sim/entities/types';
import type { Ctx, FighterState } from '../sim/fighter';
import type { MeterDef } from '../sim/meters';
import type { FloatDef, GlideDef, HoverDef } from '../sim/mobility';
import type { TerrainElement } from '../sim/stage';
import type { StatusDef } from '../sim/statuses';
import type { Vec } from '../sim/vec';

export interface FighterStats {
  /** Ultimate weight (Mario 98). Heavier fighters take less knockback. */
  weight: number;
  /** Standing size in units: hurtbox and environment collision box (feet at the origin). */
  height: number;
  width: number;

  walkSpeed: number;
  walkAccelBase: number;
  walkAccelAdd: number;
  /** Traction: speed lost per frame on the ground when not accelerating. */
  groundFriction: number;
  dashInitialSpeed: number;
  /** Length of the initial dash (dash-dance window) in frames. */
  dashFrames: number;
  runSpeed: number;
  runAccelBase: number;
  runAccelAdd: number;

  airSpeed: number;
  airAccelBase: number;
  airAccelAdd: number;
  airFriction: number;
  gravity: number;
  fallSpeed: number;
  fastFallSpeed: number;
  /**
   * Ultimate's DamageFlyTopGravity: gravity during hitstun after a near-vertical (70-110 degree) tumble launch. Mario
   * 0.074928; it ranges 0.0628-0.0874 across the cast. Defaults to the cast median, DAMAGE_FLY_TOP_GRAVITY.
   */
  damageFlyTopGravity?: number;

  jumpSquat: number;
  /** Apex heights in units above the take-off point. */
  fullHopHeight: number;
  shortHopHeight: number;
  doubleJumpHeight: number;
  /** Total jumps including the grounded one (2 for most fighters; Ultimate's cast has 2 to 6). */
  jumps: number;
  /**
   * Apex height of each midair jump in order, for multi-jumpers whose jumps shrink (Kirby, Jigglypuff). The first
   * entry must equal doubleJumpHeight; jumps past the end of the list repeat its last height. Default: every
   * midair jump is doubleJumpHeight.
   */
  airJumpHeights?: number[];
  ledgeJumpHeight: number;

  softLandingLag: number;
  hardLandingLag: number;

  /** Shield bubble radius at full health. */
  shieldSize: number;
  /** Distance travelled by a roll. */
  rollDistance: number;
  /** Distance travelled by a back roll out of shield (Mario 30.63). Defaults to rollDistance. */
  backRollDistance?: number;
  /** Speed of a directional air dodge at its start. */
  airDodgeSpeed: number;
}

/** One hitbox: a circle relative to the fighter's feet, x forward (in the facing direction) and y up. */
export interface HitboxDef {
  /** Lower ids win when several hitboxes of one move touch the same target on the same frame. */
  id: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  /**
   * Launch angle in degrees from the attacker's facing direction; 361 is the Sakurai angle and 365-368 are Ultimate's
   * autolink angles (docs/fighters.md).
   */
  angle: number;
  /** Knockback growth and base knockback, as in Ultimate's frame data. */
  kbg: number;
  bkb: number;
  /** Set (weight-based) knockback; replaces the % part of the formula. */
  wbkb?: number;
  /** Hitlag multiplier (default 1). */
  hitlag?: number;
  /** Extra shield damage on top of the move's damage. */
  shieldDamage?: number;
  effect?: 'normal' | 'fire' | 'electric';
  /** Windbox: apply knockback without damage, hitlag or hitstun. Shields ignore it. */
  pushOnly?: boolean;
  /**
   * Which way the hit launches (Ultimate's LR check): along the attacker's facing (default), against it for hits
   * behind him, or away from his centre for hits that surround him.
   */
  direction?: 'forward' | 'back' | 'away';
  /**
   * Position vector (Ultimate): instead of launching, pull the target's middle to this point, relative to the
   * attacker's feet (x forward), over `frames` frames. Ultimate's 368-degree boxes always carry one.
   */
  vector?: { x: number; y: number; frames: number };
  /**
   * A grab box: no damage or knockback (leave those 0). Touching a fighter in front of the grabber puts both in
   * a grab; it ignores shields and is halved in radius against airborne fighters (Ultimate).
   */
  grab?: boolean;
  /**
   * Which fighters it can hit (Ultimate's groundedness/airness): 'ground' only fighters on the ground, 'air' only
   * airborne ones (a fighter hanging on a ledge counts as airborne), 'both' (default) either.
   */
  targets?: 'ground' | 'air' | 'both';
  /** A status the hit puts on its victim (not through a shield), by kind "<fighter id>/<name>" (FighterDef.statuses). */
  status?: string;
}

/** A throw's release hit: a hitbox without a position, since it lands on the held fighter wherever they are. */
export type ThrowHitDef = Omit<
  HitboxDef,
  'id' | 'x' | 'y' | 'radius' | 'grab' | 'direction' | 'pushOnly' | 'targets'
> & {
  /** 'back' launches behind the thrower (back throws). */
  direction?: 'forward' | 'back';
};

/** A hit on a held fighter (a pummel, a command grab's chew): `damage` and hitlag (x `hitlag`), no knockback. */
export interface HoldHitDef {
  frame: number;
  damage: number;
  hitlag?: number;
}

/** What a tether line can anchor to: a ledge, any solid or platform surface, or empty air at full range. */
export type TetherLatch = 'ledge' | 'surface' | 'sky';

/**
 * A tether (Fluffy's grapples, the Fisherman's line): a line fired from the hand that travels out, anchors,
 * and reels the fighter in. See docs/fighters.md.
 */
export interface TetherDef {
  /** Move frame the line leaves the hand (aimed tethers wait here until special is released). */
  frame: number;
  /** Reach in units. */
  range: number;
  /** Frames the tip takes to reach full range, travelling at an even speed. */
  travel: number;
  /** Direction in degrees from straight forward (0) towards straight up (90). */
  angle: number;
  /** The stick's forward/back bends `angle` by up to this many degrees (Fluffy's Quick Grapple: 30). */
  stickAdjust?: number;
  /**
   * Reticle aiming: while special is held the reticle walks from the fighter at `speed` units a frame with the
   * stick (clamped to `range`), and releasing special fires at it. With `quick`, releasing special within
   * `quick.frames` of pressing it while the stick points somewhere fires at full range in that 8-way direction.
   */
  aimed?: { speed: number; quick?: { frames: number } };
  /** What the line may anchor to; hitting anything else stops it. */
  latch: TetherLatch[];
  /**
   * Sky anchors allowed per airtime (FighterState.skyAnchorsUsed, shared by all the fighter's tether moves). With
   * none left a sky shot whiffs. Landing, or a ledge or surface latch, gives them back. Unset: no limit.
   */
  skyAnchors?: number;
  /** Reel speed towards the anchor, units per frame. */
  pullSpeed: number;
  /** Holding this button when the reel arrives keeps the fighter hanging at the anchor. */
  hang?: ButtonName;
  /** Veto a latch (spend a resource, refuse sky anchors): return false and the line whiffs. */
  onAnchor?: (x: Ctx, hit: TetherHit) => boolean;
  /** Stop the line at the first hittable opponent in its path. Defaults to false. */
  targetsFighters?: boolean;
  /**
   * Handle fighter contact. At `hit`, return `'pullSelf'` to reel toward the fighter and receive `arrive`
   * once in contact. Return nothing to retract the line and handle responses such as a grab or yank in script.
   */
  onFighter?: (x: Ctx, target: FighterState, event: TetherFighterEvent) => 'pullSelf' | void;
  /**
   * The hit a `pullSelf` reel lands when it reaches its fighter (Fluffy's Point Grapple kick), placed from the
   * fighter like a move's hitbox. It is out on the arrival frame only and lands in that frame's hit pass
   * (resolveHits), after every fighter has stepped, so shields, parries, counters and trades treat it as any hitbox
   * whatever the ports. The fighter lets go into a fall on the next frame it steps. Without it the reel lets go on
   * arrival.
   */
  arriveHit?: HitboxDef;
}

export type TetherFighterEvent =
  ({ phase: 'hit' } & Extract<CastHit, { kind: 'fighter' }>) | { phase: 'arrive'; point: Vec };

/** Where a tether line stopped: a cast hit, or empty air at full range. */
export type TetherHit = CastHit | { kind: 'sky'; t: number; point: Vec };

/**
 * A counter (Marth's Counter, Lucario's Double Team): a hit that touches the fighter while `window` is open is
 * blocked, and the fighter plays the counterattack `move`. See docs/fighters.md.
 */
export interface CounterDef {
  /** Move frames (inclusive) on which a hit is caught. */
  window: [number, number];
  /** The counterattack played on a catch; its boxes deal at least their own damage (Marth's: 8%). */
  move: string;
  /** The counterattack deals the caught hit's damage times this (default 1.2), capped at `max` (default 50%). */
  multiplier?: number;
  max?: number;
  /** Frames the counterer and the attacker freeze on the catch (default 21, Marth's). */
  freeze?: number;
  /** Reappear this many units behind the attacker, facing their back (Double Team). Omit to answer in place. */
  behind?: number;
}

/** A window of frames (inclusive) during which a set of hitboxes is out. */
export interface HitWindow {
  frames: [number, number];
  boxes: HitboxDef[];
  /** Forget who this move has already hit when the window opens, so it can hit them again (multi-hit moves). */
  rehit?: boolean;
}

/** Shieldstun and staleness categories (Ultimate treats smash attacks and aerials differently on shield). */
export type MoveKind = 'smash' | 'aerial' | 'projectile' | 'other';

export interface MoveDef {
  kind: MoveKind;
  /** First actionable frame (frame data convention: total frames + 1). */
  faf: number;
  hits: HitWindow[];
  /**
   * Aerials: landing lag, and frames on which landing cancels the move with only normal landing lag. Helpless
   * moves: also the landing lag out of the helpless fall (default HELPLESS_LANDING_LAG).
   */
  landingLag?: number;
  autoCancel?: [number, number][];
  /**
   * Charging (src/sim/actions/charge.ts): the move pauses on this frame while it charges, for up to `chargeFrames`.
   * Smash attacks charge while Attack or the C-stick is held, other moves (specials) while Special is held.
   */
  charge?: number;
  /** Frames of charge for a full charge (default 60, Ultimate's smash attacks). */
  chargeFrames?: number;
  /** Damage multiplier at full charge (default 1.4); less charge scales linearly from 1. */
  chargeDamage?: number;
  /**
   * Stored charge: shield, an air dodge or a jump while charging keeps the charge for the move's next use by this
   * form. `tap` charges without holding Special and fires on the next Special or Attack press (otherwise releasing
   * Special fires); `storeAtFull` stores the charge and ends the move once it is full (otherwise the move waits at
   * full charge). Samus's Charge Shot and Donkey Kong's Giant Punch are `{ tap: true, storeAtFull: true }`.
   */
  storeCharge?: { tap?: boolean; storeAtFull?: boolean };
  /**
   * Jab combos: Attack (pressed, buffered or held) with no stick direction during `window` (inclusive) cancels this
   * grounded move into `move`, the next hit of the combo (jab -> jab2 -> jab3).
   */
  next?: { window: [number, number]; move: string };
  /** Specials that take off (recoveries): a grounded start leaves the ground and plays as an aerial. */
  leavesGround?: boolean;
  /** Frames (inclusive) on which the fighter is intangible, as on a getup attack. */
  intangible?: [number, number];
  /**
   * Armor (Ultimate): on `frames` (inclusive) hits still add damage and hitlag, but they don't launch, cause
   * hitstun or interrupt the move. A hit breaks through when its knockback reaches `threshold` or its damage
   * reaches `damageThreshold`; with neither set it is heavy armor and nothing breaks through. `breakDamageMul`
   * scales the % the breaking hit adds, leaving its knockback and hitlag full (Kirby's Stone: 0.5).
   */
  armor?: { frames: [number, number]; threshold?: number; damageThreshold?: number; breakDamageMul?: number };
  /** Recoveries: the move ends in helpless fall instead of a normal fall. */
  helpless?: boolean;
  /** Airborne moves that may grab a ledge from this frame. */
  ledgeFrom?: number;
  /** Landing doesn't end the move: it carries on from the same frame on the ground, with no landing lag. */
  continuesOnLanding?: boolean;
  /** Airborne moves: false turns off the stick's air drift (and air friction) while the move plays, for scripted paths. */
  drift?: boolean;
  /** Airborne moves: false turns off gravity while the move plays, so the script alone sets the vertical speed. */
  gravity?: boolean;
  /**
   * Airborne moves: false lands on soft platforms even with the stick held down, as Ultimate's aerial attacks and most
   * specials do (SmashWiki, "Platform"). By default holding down falls through them.
   */
  fallThrough?: boolean;
  /** Airborne moves: false stops a down flick from fast-falling while the move plays (Ultimate's specials). */
  fastFall?: boolean;
  /**
   * Ground/air variants (Ultimate's SpecialN and SpecialAirN): started in the air, this move plays the move named
   * `air` instead, which is also the clip and the name in the `move` event.
   */
  air?: string;
  /**
   * Transform (Zelda/Sheik style): on `frame` the fighter becomes fighter `into`, keeping its %, stocks, position
   * and everything else in FighterState; stats, moves and art switch. `into` must have a move of the same name,
   * which plays the rest of the move.
   */
  transform?: { frame: number; into: string };

  /** Pummels: on `frame` the held fighter takes `damage` and hitlag (x `hitlag`) but no knockback, and stays held. */
  pummel?: HoldHitDef;
  /**
   * Throws: on `frame` the held fighter is let go and takes `hit` through the normal knockback path (DI,
   * staleness and rage included). Throws have no hitlag unless `hit.hitlag` sets a multiplier, as in Ultimate.
   */
  throw?: { frame: number; hit: ThrowHitDef };
  /** Throws: hits on the held fighter before the release (a command grab's chews), like pummels, in frame order. */
  holdHits?: HoldHitDef[];
  /**
   * Command grabs (Ganondorf's Flame Choke, Incineroar's Alolan Whip): a catch by this move's grab boxes plays the
   * move named here at once as the throw, instead of the grab hold, so it can't be mashed out of. Its grab boxes
   * catch airborne fighters at full size.
   */
  commandGrab?: string;
  /** Tethers: fire a line on `tether.frame` that anchors and reels the fighter in (see TetherDef). */
  tether?: TetherDef;
  /** Counters: a hit caught inside the window is blocked and answered by a counterattack (see CounterDef). */
  counter?: CounterDef;
  /**
   * The action that plays this move instead of 'attack' / 'aerial', for moves with their own physics:
   * 'hover' (fuel hover, FighterDef.hover).
   */
  action?: string;
  /** Holding Jump when the move ends glides (FighterDef.glide); after a helpless move it ends in helpless fall. */
  glide?: boolean;
  /**
   * Scripted behaviour (specials): runs every frame of the move before physics, after actionFrame advances.
   * It may set velocity or facing. Keep it deterministic: no Math.random, no clocks.
   */
  script?: (x: Ctx) => void;
  /** Entities (projectiles, minions, objects) the move puts out on its frames, from the fighter's `entities`. */
  spawn?: SpawnDef[];
  /** Reflector bubbles: projectiles touching one turn around and become this fighter's. */
  reflectors?: ReflectorDef[];
  /** Absorber bubbles: absorbable projectiles touching one vanish and heal this fighter. */
  absorbers?: AbsorberDef[];
  /**
   * Part of the fighter's Final Smash (src/sim/finalSmash.ts, docs/fighters.md): the move named `finalSmash`, its
   * `air` variant and a trap's cinematic. The user is intangible, its hits can't be shielded, and landing doesn't end
   * it (as continuesOnLanding).
   */
  final?: FinalSmashDef;
}

/** Final Smash options (src/sim/finalSmash.ts). All are optional; `final: {}` marks a move as part of one. */
export interface FinalSmashDef {
  /** Frames everyone else is held still from activation (default FINAL_SMASH.freeze). */
  freeze?: number;
  /**
   * In the air, the user stops and holds still (no gravity or drift) for the move, like Mario in Mario Finale. A trap's
   * cinematic with it holds still too.
   */
  still?: boolean;
  /** How far ahead of the feet it reaches, for CPUs deciding when to use it (default: its hitboxes' reach). */
  range?: number;
}

export interface FighterDef {
  id: string;
  name: string;
  /** Source game, e.g. "Fireboy and Watergirl (2009)". */
  series: string;
  stats: FighterStats;
  /**
   * Moves by name. Normals use Smash's names: jab, ftilt, utilt, dtilt, dashAttack, fsmash, usmash, dsmash,
   * nair, fair, bair, uair, dair; grabs are grab, dashGrab, pivotGrab, pummel, fthrow, bthrow, uthrow, dthrow.
   * The name is also the animation clip name.
   */
  moves?: Record<string, MoveDef>;
  /** Air mobility, each opt-in (src/sim/mobility.ts): Brawl-style glide, Peach-style float, fuel hover. */
  glide?: GlideDef;
  float?: FloatDef;
  hover?: HoverDef;
  /**
   * This fighter's own versions of shared actions, by action name (`walk`, `dash`, `run`, `crouch`, ...), used
   * instead of the shared ones in `src/sim/actions/`, or new actions only this fighter enters. Bloxorz block tips
   * end over end instead of walking. Keep them deterministic, like move scripts.
   */
  actions?: Record<string, ActionDef>;
  /** A deterministic world-space capsule for a distinct pose, or undefined to use the normal body. */
  hurtbox?: (f: Readonly<FighterState>) => Hurtbox | undefined;
  /** Kinds of entity this fighter's moves spawn, by name (the entity kind is "<id>/<name>"). */
  entities?: Record<string, EntityDef>;
  /** Art data for the renderer (src/render/rig). Plain data, no renderer imports. */
  art?: unknown;
  /** False for forms reached only by transforming (Watergirl), so menus list only the fighter that starts. */
  selectable?: boolean;
  /** Damaging terrain this fighter is unharmed by, e.g. Fireboy's ['lava'] (docs/stage-geometry.md). */
  immune?: TerrainElement[];
  /** Timed statuses this fighter's hits and scripts inflict, by name (the kind is "<id>/<name>"; src/sim/statuses.ts). */
  statuses?: Record<string, StatusDef>;
  /** This fighter's meters by name: charge, ammo, coins, counts (src/sim/meters.ts). */
  meters?: Record<string, MeterDef>;
}

export function defineFighter<T extends FighterDef>(def: T): T {
  return def;
}
