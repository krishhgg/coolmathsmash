import { getFighter } from '../fighters/registry';
import type { FighterDef, FighterStats } from '../fighters/types';
import { SHIELD_MAX } from './constants';
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
  /** Direction of the current dodge or roll (unit vector, 0,0 for a neutral air dodge). */
  dodgeDir: Vec;
  airFrames: number;
  landingLag: number;
  damage: number;
  stocks: number;
  shieldHp: number;
  hitlag: number;
  hitstun: number;
  /** Intangibility from outside the current action (ledge grab, respawn), counting down. */
  intangible: number;
  ledge: number;
  ledgeGrabs: number;
  ledgeLock: number;
  /** Touched the ground or got hit since the last ledge grab, so the next grab gives intangibility. */
  ledgeFresh: boolean;
  /** Frames until a KO'd fighter reappears on the respawn platform. */
  respawnTimer: number;
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
    dodgeDir: vec(),
    airFrames: 0,
    landingLag: 0,
    damage: 0,
    stocks,
    shieldHp: SHIELD_MAX,
    hitlag: 0,
    hitstun: 0,
    intangible: 0,
    ledge: -1,
    ledgeGrabs: 0,
    ledgeLock: 0,
    ledgeFresh: true,
    respawnTimer: 0,
  };
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
