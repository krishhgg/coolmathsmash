import { getFighter } from '../fighters/registry';
import type { FighterDef, FighterStats } from '../fighters/types';
import { SHIELD_MAX, TECH_LOCKOUT } from './constants';
import type { ControlState } from './control';
import type { MatchState, PlayerState } from './match';
import { jumpVelocity } from './physics';
import type { CompiledStage } from './stage';
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
  /** Hitstun left, counted in un-sped frames: the fighter can act on the frame it reaches 0. */
  hitstun: number;
  /** Un-sped first actionable frame of the current tumble launch, for balloon speed-up (0 = none). */
  speedUpFaf: number;
  launch: PendingLaunch | null;
  /** Ports the current move has already hit. */
  hitVictims: number[];
  /** Stale multiplier of the current move activation, fixed when it first connects (0 = not connected yet). */
  moveStale: number;
  /** Frames the current smash attack was charged (0-60). */
  charge: number;
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
    hitstun: 0,
    speedUpFaf: 0,
    launch: null,
    hitVictims: [],
    moveStale: 0,
    charge: 0,
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
  };
}

/** Knockback waiting for hitlag to end; DI is read when it is applied. */
export interface PendingLaunch {
  kb: number;
  /** Hitbox angle (361 = Sakurai), relative to `dir`. */
  angle: number;
  /** World direction the attacker was facing: launch angles are measured from it. */
  dir: 1 | -1;
  setKnockback: boolean;
}

/** Values derived from a fighter's stats once (initial jump speeds that hit the stated apex heights). */
export interface Derived {
  fullHopV: number;
  shortHopV: number;
  doubleJumpV: number;
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
