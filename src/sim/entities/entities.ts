import { allFighters } from '../../fighters/registry';
import { emit } from '../events';
import { inHitlag, type Ctx, type FighterState } from '../fighter';
import type { MatchState } from '../match';
import type { Vec } from '../vec';
import type { PlacedHitbox } from '../combat/hits';
import { chargeLevel, chargeScale } from '../actions/charge';
import { inWindow } from '../actions/registry';
import type { DestroyReason, EntityDef, EntityState, SpawnDef } from './types';

const ENGINE_ENTITIES: Record<string, EntityDef> = {};

/** Engine-owned kinds (items, stage objects, test entities) are registered under a scoped key like "item/<name>". */
export function registerEntity(kind: string, def: EntityDef): void {
  ENGINE_ENTITIES[kind] = def;
}

/** The definition behind a kind: "<fighter id>/<name>" looks in that fighter's `entities`, anything else is registered. */
export function entityDef(kind: string): EntityDef {
  const slash = kind.indexOf('/');
  const def = allFighters()[kind.slice(0, slash)]?.entities?.[kind.slice(slash + 1)] ?? ENGINE_ENTITIES[kind];
  if (!def) throw new Error(`unknown entity kind "${kind}"`);
  return def;
}

export interface SpawnOptions {
  kind: string;
  owner: number;
  pos: Vec;
  vel?: Vec;
  facing?: 1 | -1;
  /** The owner's move it belongs to, for staleness. */
  move?: string | null;
  /** That move's charge level (0 to 1, default 0): its hits deal up to EntityDef.chargeDamage times their damage. */
  charge?: number;
}

/** Put a new entity into the match. Its frame 1 is this frame: it shows and hits at `pos` and starts moving next frame. */
export function spawnEntity(m: MatchState, o: SpawnOptions): EntityState {
  const def = entityDef(o.kind);
  const e: EntityState = {
    id: m.nextEntityId++,
    kind: o.kind,
    owner: o.owner,
    pos: { x: o.pos.x, y: o.pos.y },
    prevPos: { x: o.pos.x, y: o.pos.y },
    vel: { x: o.vel?.x ?? 0, y: o.vel?.y ?? 0 },
    kb: { x: 0, y: 0 },
    facing: o.facing ?? 1,
    age: 0,
    lifetime: def.lifetime ?? 0,
    grounded: false,
    hp: def.hp ?? 0,
    damage: 0,
    hitlag: 0,
    hitlagAt: -1,
    move: o.move ?? null,
    stale: 0,
    damageMul: chargeScale(o.charge ?? 0, def.chargeDamage ?? 1),
    reflects: 0,
    hitVictims: [],
    hitEntities: [],
    data: {},
    dead: false,
  };
  m.entities.push(e);
  emit(m, { type: 'entitySpawn', id: e.id, kind: e.kind, owner: e.owner, x: e.pos.x, y: e.pos.y });
  return e;
}

/**
 * A move's spawn on its frame: the entity appears at the offset from the fighter's feet, moving forward, with the
 * move's charge level.
 */
export function spawnFromMove(x: Ctx, s: SpawnDef): void {
  const { m, f } = x;
  const kind = s.entity.includes('/') ? s.entity : `${x.def.id}/${s.entity}`;
  if (s.max !== undefined && m.entities.filter((e) => e.owner === f.port && e.kind === kind).length >= s.max)
    return;
  spawnEntity(m, {
    kind,
    owner: f.port,
    pos: { x: f.pos.x + s.x * f.facing, y: f.pos.y + s.y },
    vel: { x: (s.vx ?? 0) * f.facing, y: s.vy ?? 0 },
    facing: f.facing,
    move: f.move,
    charge: chargeLevel(f),
  });
}

/** Take an entity out of the match (it is removed at the end of the phase); destroying it twice does nothing. */
export function destroyEntity(m: MatchState, e: EntityState, reason: DestroyReason): void {
  if (e.dead) return;
  e.dead = true;
  emit(m, { type: 'entityDestroy', id: e.id, kind: e.kind, reason, x: e.pos.x, y: e.pos.y });
}

/** Drop destroyed entities. */
export function sweepEntities(m: MatchState): void {
  if (m.entities.some((e) => e.dead)) m.entities = m.entities.filter((e) => !e.dead);
}

/** Where an entity's soft platform (EntityDef.platform) is this frame, or null if it has none or is gone. */
export function entityPlatform(e: EntityState): { x1: number; x2: number; y: number } | null {
  const p = entityDef(e.kind).platform;
  if (!p || e.dead) return null;
  return { x1: e.pos.x - p.width / 2, x2: e.pos.x + p.width / 2, y: e.pos.y + p.y };
}

/** The fighters standing on entity `e`'s platform, in port order. */
export function standingOn(m: MatchState, e: EntityState): FighterState[] {
  return m.fighters.filter((f) => f.ground?.kind === 'entity' && f.ground.index === e.id);
}

/** Hittable: fighters' attacks and other entities' hits damage it. */
export const isHittable = (def: EntityDef) => def.hp !== undefined;

/** Projectiles (entities that hit and cannot be hit) reflect and absorb unless they opt out. */
export const isReflectable = (def: EntityDef) => def.reflectable ?? (!!def.hits?.length && !isHittable(def));
export const isAbsorbable = (def: EntityDef) => def.absorbable ?? (!!def.hits?.length && !isHittable(def));

/** The entity's hitboxes out on this frame of `m`, placed in the world; none while it is frozen in hitlag. */
export function entityHitboxes(m: MatchState, e: EntityState): PlacedHitbox[] {
  if (e.dead || inHitlag(m, e)) return [];
  const hits = entityDef(e.kind).hits;
  if (!hits) return [];
  return hits
    .filter((w) => inWindow(e.age, w.frames))
    .flatMap((w) => w.boxes.map((box) => ({ box, x: e.pos.x + box.x * e.facing, y: e.pos.y + box.y })));
}

/** Its strongest hit this frame after reflections, for clanks and reflector/absorber limits. */
export function entityPower(m: MatchState, e: EntityState): number {
  return Math.max(0, ...entityHitboxes(m, e).map(({ box }) => (box.pushOnly ? 0 : box.damage))) * e.damageMul;
}
