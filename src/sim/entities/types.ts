import type { HitWindow, MoveKind } from '../../fighters/types';
import type { ControlState } from '../control';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import type { CompiledStage } from '../stage';
import type { Vec } from '../vec';

/**
 * Something a fighter, item or stage puts into the match that is not a fighter: a projectile, a minion, a setplay
 * object, an item. Plain data in `MatchState.entities` (hashed and replayed with everything else); its behaviour
 * comes from the EntityDef its `kind` names. See docs/fighters.md, "Entities and projectiles".
 */
export interface EntityState {
  /** Unique within the match, increasing in spawn order (MatchState.nextEntityId). */
  id: number;
  /** EntityDef key: "<fighter id>/<name>" for a fighter's entities, or a kind registered with registerEntity. */
  kind: string;
  /** Port that owns it (its hits are this fighter's), -1 for nobody. Reflecting a projectile takes it over. */
  owner: number;
  /** Centre of its body circle. */
  pos: Vec;
  prevPos: Vec;
  vel: Vec;
  /** Knockback from being hit (hittable entities), decaying like a fighter's. */
  kb: Vec;
  /** Direction its hitboxes face: x offsets are mirrored by it. */
  facing: 1 | -1;
  /** Frames since it appeared: 1 on the frame it spawns (at its spawn position). */
  age: number;
  /** Frames it lives: it is gone on the frame its age would pass this (0 = until something destroys it). */
  lifetime: number;
  /** Landed on a floor or platform this frame. */
  grounded: boolean;
  /** Hit points left for hittable entities (EntityDef.hp); 0 for entities that cannot be hit. */
  hp: number;
  /** % taken so far, for the knockback of hittable entities with a weight. */
  damage: number;
  /** Frozen frames left after being hit. A projectile does not freeze when it hits something. */
  hitlag: number;
  /** The owner's move that spawned (or reflected) it: its hits stale that move. */
  move: string | null;
  /** Stale multiplier fixed when it first connects (0 = not connected yet). */
  stale: number;
  /** Damage multiplier from reflections (1 = never reflected). */
  damageMul: number;
  /** Times reflected; the 8th reflector destroys it instead (Ultimate). */
  reflects: number;
  /** Ports it has already hit (cleared by rehit windows and reflections). */
  hitVictims: number[];
  /** Ids of hittable entities it has already hit. */
  hitEntities: number[];
  /** Free per-entity state for its script. */
  data: Record<string, number | string | boolean>;
  /** Destroyed this frame; removed at the end of the entity and hit phases. */
  dead: boolean;
}

/** Why an entity left the match. */
export type DestroyReason =
  'expired' | 'blastZone' | 'stage' | 'hit' | 'clank' | 'absorbed' | 'broken' | 'script';

/** Everything an entity's script sees on one frame. */
export interface EntityCtx {
  m: MatchState;
  e: EntityState;
  def: EntityDef;
  stage: CompiledStage;
  /** The owning fighter, null for ownerless entities. */
  owner: FighterState | null;
  /** The owner's controller, for owner-controlled entities (minions that follow the stick). */
  c: ControlState | null;
}

/** How a kind of entity looks to the simulation. Lives in a fighter's `entities` or is registered by the engine. */
export interface EntityDef {
  /** Body circle radius: stage collision, contact with reflectors, absorbers and attacks, and the hurt circle. */
  radius: number;
  /** Frames it lives (omit for an entity that stays until destroyed). */
  lifetime?: number;
  /** Shieldstun and staleness category of its hits (default 'projectile': shieldstun x0.29). */
  kind?: MoveKind;
  /** Hitbox windows over its age (frame 1 = the frame it spawns), x mirrored by its facing. */
  hits?: HitWindow[];
  /** Pulled down by this much every frame, up to `maxFall`. */
  gravity?: number;
  maxFall?: number;
  /**
   * Meeting a floor or platform while falling: 'bounce' up at `bounce` speed, 'land' and rest on it, 'destroy'
   * (default), or 'pass' through the stage.
   */
  floor?: 'bounce' | 'land' | 'destroy' | 'pass';
  /** Meeting a wall or ceiling: 'bounce' off it, 'stop' against it, 'destroy' (default) or 'pass' through. */
  wall?: 'bounce' | 'stop' | 'destroy' | 'pass';
  /** Upward speed after a floor bounce; every bounce is the same height, as with Mario's fireball. */
  bounce?: number;
  /** Keeps going after hitting someone (default: destroyed by its first hit, on a fighter or a shield). */
  pierce?: boolean;
  /** Reflectors can send it back (default true for entities with hits and no hp). */
  reflectable?: boolean;
  /** Absorbers can eat it (default true for entities with hits and no hp). */
  absorbable?: boolean;
  /** Never clanks with attacks or other projectiles. */
  transcendent?: boolean;
  /** Hittable: fighters' attacks and other entities' hits take this many hit points, and it breaks at 0. */
  hp?: number;
  /** Hittable entities with a weight are launched by the hits they take (Ultimate's knockback formula). */
  weight?: number;
  /** Runs every frame before physics. Deterministic only: use `x.m.rng` for randomness. */
  script?: (x: EntityCtx) => void;
}

/** A move puts an entity out on one of its frames. */
export interface SpawnDef {
  /** Action frame it appears on (and its first active frame, since its hits start at age 1). */
  frame: number;
  /** A name in the fighter's `entities`, or a full kind ("item/...") registered with registerEntity. */
  entity: string;
  /** Spawn point from the fighter's feet, x forward. */
  x: number;
  y: number;
  /** Initial velocity, x forward. */
  vx?: number;
  vy?: number;
  /** At most this many of this kind owned by the fighter at once; further spawns are skipped. */
  max?: number;
}

/**
 * A reflector bubble, out on a move's frames: projectiles touching it turn around and become the reflector's. Defaults
 * are Fox's Reflector in Ultimate (SmashWiki, Reflection: damage x1.4, speed x1.4, lifespan x1, reflects up to 50%).
 */
export interface ReflectorDef {
  frames: [number, number];
  /** Bubble centre from the feet, x forward, and radius. */
  x: number;
  y: number;
  radius: number;
  /** Damage multiplier (default 1.4). */
  damage?: number;
  /** Speed multiplier (default 1.4). */
  speed?: number;
  /** Remaining lifespan multiplier (default 1). */
  lifetime?: number;
  /** Projectiles stronger than this pass through and hit (default 50). */
  maxDamage?: number;
}

/**
 * An absorber bubble: absorbable projectiles touching it vanish and heal the user by their damage times `heal`.
 * Defaults are Ness's PSI Magnet in Ultimate (SmashWiki, Absorption: x1.6, up to 30% projectiles).
 */
export interface AbsorberDef {
  frames: [number, number];
  x: number;
  y: number;
  radius: number;
  /** Healing per % of the absorbed projectile's damage (default 1.6). */
  heal?: number;
  /** Projectiles stronger than this are not absorbed (default 30). */
  maxDamage?: number;
}
