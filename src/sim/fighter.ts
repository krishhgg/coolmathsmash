import { getFighter } from '../fighters/registry';
import type { FighterDef, FighterStats, TetherLatch } from '../fighters/types';
import { SHIELD_MAX, TECH_LOCKOUT } from './constants';
import type { ControlState } from './control';
import type { MatchState, PlayerState } from './match';
import { createMeters } from './meters';
import { createMobility, type MobilityState } from './mobility';
import { jumpVelocity } from './physics';
import type { CompiledStage } from './stage';
import type { StatusState } from './statuses';
import { vec, type Vec } from './vec';

export interface GroundRef {
  kind: 'solid' | 'platform';
  /** Edge index into CompiledStage.edges for solids, platform index for platforms. */
  index: number;
}

/**
 * One fighter's complete simulation state. Plain data; the renderer reads it, harness scenarios query it.
 * `action` names double as animation clip names; while attacking, `move` names the move (and its clip).
 */
export interface FighterState {
  port: number;
  fighter: string;
  action: string;
  /** Frames since the action began: 1 on its first frame (Smash frame-data convention). */
  actionFrame: number;
  move: string | null;
  pos: Vec;
  prevPos: Vec;
  /** Self-propelled velocity (walking, jumping, gravity). */
  vel: Vec;
  /** Knockback velocity, decaying separately like Smash's launch speed. */
  kb: Vec;
  facing: 1 | -1;
  ground: GroundRef | null;
  /** Platform being dropped through (-1 = none). */
  dropPlatform: number;
  jumpsUsed: number;
  /** The current jump was started by tap jump (stick), so full hop is decided by the stick. */
  jumpByStick: boolean;
  fastFalling: boolean;
  airDodgeUsed: boolean;
  /** Match frame of the last Shield press that counted as a tech input. */
  techPressAt: number;
  /** Direction of the current dodge or roll (unit vector, 0,0 for a neutral air dodge). */
  dodgeDir: Vec;
  airFrames: number;
  landingLag: number;
  damage: number;
  stocks: number;
  shieldHp: number;
  /** Frozen frames left (attacker and victim both freeze when a hit connects). */
  hitlag: number;
  /** Match frame of the fighter's latest hitlag frame (-1 = none), for inHitlag. */
  hitlagAt: number;
  /** Hitstun left, counted in un-sped frames: the fighter can act on the frame it reaches 0. */
  hitstun: number;
  /** Un-sped first actionable frame of the current tumble launch, for balloon speed-up (0 = none). */
  speedUpFaf: number;
  /** The current launch is near-vertical (70-110 degree tumble): DamageFlyTop gravity and fall speed during hitstun. */
  flyTop: boolean;
  launch: PendingLaunch | null;
  launchMotion: LaunchMotion | null;
  /** Ports the current move has already hit. */
  hitVictims: number[];
  /**
   * Hold hits (a pummel, a throw's chews) the current move has landed, kept apart from hitVictims so the move's
   * own hitboxes and rehit windows can't skip or repeat one.
   */
  holdHitsLanded: number;
  /** Ids of entities the current move has already hit. */
  hitEntities: number[];
  /** Stale multiplier of the current move activation, fixed when it first connects (0 = not connected yet). */
  moveStale: number;
  /** Frames the current move has charged (0 to its chargeFrames). */
  charge: number;
  /** A counterattack's damage (MoveDef.counter): its boxes deal at least this. 0 outside a counterattack. */
  counterDamage: number;
  /**
   * A charge kept for the next use of `move` by the form `fighter` (stored charge), spent when that move fires; lost
   * on a KO as that form.
   */
  storedCharge: { fighter: string; move: string; frames: number } | null;
  /** Names of the last moves that hit, most recent first (stale-move negation). */
  staleQueue: string[];
  /** Intangibility from outside the current action (ledge grab, respawn), counting down. */
  intangible: number;
  ledge: number;
  ledgeGrabs: number;
  ledgeLock: number;
  /** Touched the ground or got hit since the last ledge grab, so the next grab gives intangibility. */
  ledgeFresh: boolean;
  /** Frames until a KO'd fighter reappears on the respawn platform. */
  respawnTimer: number;
  /** Port of the other fighter in this fighter's grab, holding or held (-1 = none). */
  grabPartner: number;
  /** Held fighter: hold frames left after mashing; it breaks free at 0 (after GRAB.minHold frames). */
  grabTimer: number;
  /** Held fighter: damage taken from fighters outside the grab; GRAB.breakDamage frees it. */
  grabDamage: number;
  /** First match frame this fighter can be grabbed again (regrab immunity after a grab release). */
  grabbableFrom: number;
  /** First match frame a shield grab can come out (GRAB.shieldGrabLock frames after shieldstun). */
  shieldGrabFrom: number;
  /** First match frame a shield drop can start and still parry (PARRY.lockout frames after shieldstun ends). */
  parryFrom: number;
  /** Glide, float and hover state (src/sim/mobility.ts). */
  mobility: MobilityState;
  /**
   * The fighter's tether line (null = none): `out` while it travels, with `anchor` at its tip, then where it
   * anchored. `frame` is the match frame it fired or anchored; `ledge` the ledge index of a ledge anchor; a
   * surface anchor also keeps that surface and the anchor within it, so a moving piece carries the line along.
   * `moveFrame` is the move's frame on the first frame of tetherPull (the frame the line anchored) or tetherHang
   * (the frame the reel arrived), so the renderer plays the move's clip on through the reel instead of restarting it.
   */
  tether: {
    anchor: Vec;
    kind: 'out' | TetherLatch | 'fighter';
    ledge?: number;
    port?: number;
    frame: number;
    surface?: GroundRef;
    local?: Vec;
    moveFrame?: number;
  } | null;
  /** A tether's target as an offset from the fighter: the reticle while aiming, then where the line is going. */
  aim: Vec | null;
  /** Sky anchors taken this airtime (TetherDef.skyAnchors); landing or a ledge or surface latch resets it. */
  skyAnchorsUsed: number;
  /** Frames before stage hazards (damage zones, stage hitboxes) can hit this fighter again. */
  stageHitLock: number;
  /** Timed statuses on this fighter, oldest first (src/sim/statuses.ts). */
  statuses: StatusState[];
  /** Meter values by name (FighterDef.meters, src/sim/meters.ts). */
  meters: Record<string, number>;
  /** Holds a Final Smash charge: broke the Coolmath Planet (src/sim/items/planet.ts) and has not lost it yet. */
  finalReady: boolean;
}

export function createFighter(
  port: number,
  fighterId: string,
  spawn: [number, number, 1 | -1],
  stocks: number,
): FighterState {
  return {
    port,
    fighter: fighterId,
    action: 'fall',
    actionFrame: 0,
    move: null,
    pos: vec(spawn[0], spawn[1] + 0.001),
    prevPos: vec(spawn[0], spawn[1] + 0.001),
    vel: vec(),
    kb: vec(),
    facing: spawn[2],
    ground: null,
    dropPlatform: -1,
    jumpsUsed: 0,
    jumpByStick: false,
    fastFalling: false,
    airDodgeUsed: false,
    techPressAt: -TECH_LOCKOUT,
    dodgeDir: vec(),
    airFrames: 0,
    landingLag: 0,
    damage: 0,
    stocks,
    shieldHp: SHIELD_MAX,
    hitlag: 0,
    hitlagAt: -1,
    hitstun: 0,
    speedUpFaf: 0,
    flyTop: false,
    launch: null,
    launchMotion: null,
    hitVictims: [],
    holdHitsLanded: 0,
    hitEntities: [],
    moveStale: 0,
    charge: 0,
    counterDamage: 0,
    storedCharge: null,
    staleQueue: [],
    intangible: 0,
    ledge: -1,
    ledgeGrabs: 0,
    ledgeLock: 0,
    ledgeFresh: true,
    respawnTimer: 0,
    grabPartner: -1,
    grabTimer: 0,
    grabDamage: 0,
    grabbableFrom: 0,
    shieldGrabFrom: 0,
    parryFrom: 0,
    mobility: createMobility(getFighter(fighterId)),
    tether: null,
    aim: null,
    skyAnchorsUsed: 0,
    stageHitLock: 0,
    statuses: [],
    meters: createMeters(getFighter(fighterId)),
    finalReady: false,
  };
}

/**
 * `f` is frozen in hitlag on this frame of `m`. Ultimate freezes attacker and victim for the whole of every hitlag
 * frame (SmashWiki, Hitlag), but a fighter's step counts `hitlag` down before the frame's pushes, hits, grabs, hazards
 * and entity contacts run, so on its last frozen frame `hitlag` already reads 0 there. Those passes ask this instead.
 */
export function inHitlag(m: MatchState, f: FighterState): boolean {
  return f.hitlag > 0 || f.hitlagAt === m.frame;
}

/** Knockback waiting for hitlag to end; DI is read when it is applied. */
export interface PendingLaunch {
  kb: number;
  /** Hitbox angle (361 = Sakurai), relative to `dir`. */
  angle: number;
  /** World direction the attacker was facing: launch angles are measured from it. */
  dir: 1 | -1;
  setKnockback: boolean;
  /** An autolink (365-368) or position-vector hit: what the launch follows instead of its angle. */
  link?: LaunchLink;
}

/** The attacker's motion and the hitbox, captured when an autolink or position-vector hit lands. */
export interface LaunchLink {
  /** The attacker's velocity, self-propelled plus knockback. */
  vel: Vec;
  /** World centre of the hitbox that connected. */
  at: Vec;
  /** HitboxDef.vector in world space: where the target's middle is pulled, over `frames` frames. */
  to?: { x: number; y: number; frames: number };
}

export type LaunchMotion =
  | { kind: 'vortex'; frames: number; at: Vec; dir: Vec }
  | { kind: 'vector'; frames: number; at: Vec }
  | { kind: 'cap'; frames: number };

/** Values derived from a fighter's stats once (initial jump speeds that hit the stated apex heights). */
export interface Derived {
  fullHopV: number;
  shortHopV: number;
  doubleJumpV: number;
  /** Initial speed of each midair jump in order (the last repeats). */
  airJumpV: number[];
  ledgeJumpV: number;
  shieldBreakV: number;
}

const derivedCache = new Map<FighterStats, Derived>();

export function derived(stats: FighterStats, shieldBreakHeight: number): Derived {
  let d = derivedCache.get(stats);
  if (!d) {
    d = {
      fullHopV: jumpVelocity(stats.fullHopHeight, stats.gravity),
      shortHopV: jumpVelocity(stats.shortHopHeight, stats.gravity),
      doubleJumpV: jumpVelocity(stats.doubleJumpHeight, stats.gravity),
      airJumpV: (stats.airJumpHeights ?? [stats.doubleJumpHeight]).map((h) => jumpVelocity(h, stats.gravity)),
      ledgeJumpV: jumpVelocity(stats.ledgeJumpHeight, stats.gravity),
      shieldBreakV: jumpVelocity(shieldBreakHeight, stats.gravity),
    };
    derivedCache.set(stats, d);
  }
  return d;
}

/** Everything an action handler needs for one fighter on one frame. */
export interface Ctx {
  m: MatchState;
  f: FighterState;
  p: PlayerState;
  c: ControlState;
  def: FighterDef;
  s: FighterStats;
  d: Derived;
  stage: CompiledStage;
}

export function fighterDef(f: FighterState): FighterDef {
  return getFighter(f.fighter);
}
