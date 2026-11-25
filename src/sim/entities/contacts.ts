import { chargeMultiplier, moveOf } from '../actions/attack';
import { inWindow } from '../actions/registry';
import { activeHitboxes, type PlacedHitbox } from '../combat/hits';
import { GRAVITY_BONUS_BASE, hitlagFrames, knockback, launch } from '../combat/formulas';
import type { FighterState } from '../fighter';
import { emit } from '../events';
import type { MatchState } from '../match';
import {
  destroyEntity,
  entityDef,
  entityHitboxes,
  entityPower,
  isAbsorbable,
  isHittable,
  isReflectable,
  sweepEntities,
} from './entities';
import type { AbsorberDef, EntityState, ReflectorDef } from './types';

/** Ultimate: a projectile can be reflected 7 times; touching an 8th reflector destroys it (SmashWiki, Reflection). */
export const REFLECT_LIMIT = 7;
/** Fox's Reflector in Ultimate (SmashWiki, Reflection): the default for ReflectorDef. */
export const REFLECT_DEFAULTS = { damage: 1.4, speed: 1.4, lifetime: 1, maxDamage: 50 };
/** Ness's PSI Magnet in Ultimate (SmashWiki, Absorption): the default for AbsorberDef. */
export const ABSORB_DEFAULTS = { heal: 1.6, maxDamage: 30 };
/** Ultimate's priority range: an attack outclasses another when it deals more than 9% more (SmashWiki, Priority). */
export const PRIORITY_RANGE = 9;

const circlesTouch = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) =>
  (ax - bx) ** 2 + (ay - by) ** 2 <= (ar + br) ** 2;

function touchesBody(e: EntityState, x: number, y: number, radius: number): boolean {
  return circlesTouch(e.pos.x, e.pos.y, entityDef(e.kind).radius, x, y, radius);
}

function placed<T extends ReflectorDef | AbsorberDef>(f: FighterState, list: T[] | undefined) {
  return (list ?? [])
    .filter((def) => inWindow(f.actionFrame, def.frames))
    .map((def) => ({ def, x: f.pos.x + def.x * f.facing, y: f.pos.y + def.y }));
}

/** The current move's reflector bubbles out this frame, placed in the world. */
export const activeReflectors = (f: FighterState) => placed(f, moveOf(f)?.reflectors);
/** The current move's absorber bubbles out this frame, placed in the world. */
export const activeAbsorbers = (f: FighterState) => placed(f, moveOf(f)?.absorbers);

const touching = <T extends ReflectorDef | AbsorberDef>(
  list: { def: T; x: number; y: number }[],
  e: EntityState,
) => list.find((b) => touchesBody(e, b.x, b.y, b.def.radius))?.def;

/**
 * Everything entities touch before anyone takes a hit this frame, in spawn order: reflectors and absorbers, fighters'
 * attacks against projectiles (clanks) and hittable entities, and entities against each other. A projectile that
 * survives goes on to hit fighters in resolveHits.
 *
 * Clanks follow Ultimate's 9% rule (SmashWiki, Priority), simplified: a projectile is destroyed by an attack or a
 * projectile unless it deals more than 9% more than it; a projectile that outclasses an attack passes through it.
 * The attacker never rebounds (the engine has no rebound yet) and transcendent projectiles never clank.
 *
 * Returns the hitlag each fighter (by index) owes for hitting hittable entities. It is shared only after resolveHits,
 * so a fighter whose attack hits an entity and a fighter on the same frame still lands both.
 */
export function resolveEntityContacts(m: MatchState): number[] {
  const owed = m.fighters.map(() => 0);
  for (const e of m.entities) {
    m.fighters.forEach((f, i) => {
      if (e.dead || f.port === e.owner || f.hitlag > 0 || f.action === 'ko' || f.action === 'out') return;
      if (reflectOrAbsorb(m, f, e)) return;
      owed[i] = Math.max(owed[i]!, attackEntity(m, f, e));
    });
  }
  for (let i = 0; i < m.entities.length; i++)
    for (let j = i + 1; j < m.entities.length; j++) entitiesMeet(m, m.entities[i]!, m.entities[j]!);
  sweepEntities(m);
  return owed;
}

function reflectOrAbsorb(m: MatchState, f: FighterState, e: EntityState): boolean {
  const def = entityDef(e.kind);
  const power = entityPower(e);
  const absorber = isAbsorbable(def) ? touching(activeAbsorbers(f), e) : undefined;
  if (absorber && power <= (absorber.maxDamage ?? ABSORB_DEFAULTS.maxDamage)) {
    const before = f.damage;
    f.damage = Math.max(0, f.damage - power * (absorber.heal ?? ABSORB_DEFAULTS.heal));
    emit(m, {
      type: 'absorb',
      id: e.id,
      kind: e.kind,
      port: f.port,
      heal: before - f.damage,
      x: e.pos.x,
      y: e.pos.y,
    });
    destroyEntity(m, e, 'absorbed');
    return true;
  }
  const reflector = isReflectable(def) ? touching(activeReflectors(f), e) : undefined;
  if (!reflector || power > (reflector.maxDamage ?? REFLECT_DEFAULTS.maxDamage)) return false;
  if (e.reflects >= REFLECT_LIMIT) {
    destroyEntity(m, e, 'clank');
    return true;
  }
  const away = (Math.sign(e.pos.x - f.pos.x) || f.facing) as 1 | -1;
  const speed = reflector.speed ?? REFLECT_DEFAULTS.speed;
  e.vel = { x: away * Math.abs(e.vel.x) * speed, y: e.vel.y * speed };
  e.facing = away;
  e.owner = f.port;
  e.move = f.move;
  e.stale = 0;
  e.damageMul *= reflector.damage ?? REFLECT_DEFAULTS.damage;
  e.reflects++;
  e.hitVictims = [];
  e.hitEntities = [];
  if (e.lifetime > 0)
    e.lifetime = e.age + Math.floor((e.lifetime - e.age) * (reflector.lifetime ?? REFLECT_DEFAULTS.lifetime));
  emit(m, { type: 'reflect', id: e.id, kind: e.kind, port: f.port, x: e.pos.x, y: e.pos.y });
  return true;
}

/**
 * The fighter's attack (never a grab box) against the entity: damages a hittable entity once per move, returning
 * the hitlag the attacker shares, or clanks with a projectile.
 */
function attackEntity(m: MatchState, f: FighterState, e: EntityState): number {
  if (f.hitEntities.includes(e.id)) return 0;
  const hit = activeHitboxes(f)
    .filter((h) => !h.box.grab && touchesBody(e, h.x, h.y, h.box.radius))
    .sort((p, q) => p.box.id - q.box.id)[0];
  if (!hit) return 0;
  f.hitEntities.push(e.id);
  const damage = hit.box.damage * chargeMultiplier(f);
  const def = entityDef(e.kind);
  if (isHittable(def))
    return damageEntity(m, e, hit, damage, Math.sign(e.pos.x - f.pos.x) || f.facing, f.port);
  if (!def.transcendent && entityHitboxes(e).length > 0 && entityPower(e) <= damage + PRIORITY_RANGE)
    destroyEntity(m, e, 'clank');
  return 0;
}

/** Two entities: one hitting a hittable other, or two projectiles clanking. Same-owner entities ignore each other. */
function entitiesMeet(m: MatchState, a: EntityState, b: EntityState): void {
  if (a.dead || b.dead || a.owner === b.owner) return;
  const hitA = entityDef(a.kind);
  const hitB = entityDef(b.kind);
  if (isHittable(hitB) && entityHits(m, a, b)) return;
  if (isHittable(hitA) && entityHits(m, b, a)) return;
  if (isHittable(hitA) || isHittable(hitB) || hitA.transcendent || hitB.transcendent) return;
  const boxesA = entityHitboxes(a);
  const boxesB = entityHitboxes(b);
  if (!boxesA.some((p) => boxesB.some((q) => circlesTouch(p.x, p.y, p.box.radius, q.x, q.y, q.box.radius))))
    return;
  const pa = entityPower(a);
  const pb = entityPower(b);
  if (pa <= pb + PRIORITY_RANGE) destroyEntity(m, a, 'clank');
  if (pb <= pa + PRIORITY_RANGE) destroyEntity(m, b, 'clank');
}

/** Entity `a`'s hitbox on hittable entity `v`, once per entity; `a` is used up unless it pierces. */
function entityHits(m: MatchState, a: EntityState, v: EntityState): boolean {
  if (a.hitEntities.includes(v.id)) return false;
  const hit = entityHitboxes(a)
    .filter((h) => touchesBody(v, h.x, h.y, h.box.radius))
    .sort((p, q) => p.box.id - q.box.id)[0];
  if (!hit) return false;
  a.hitEntities.push(v.id);
  damageEntity(m, v, hit, hit.box.damage * a.damageMul, Math.sign(v.pos.x - a.pos.x) || a.facing, a.owner);
  if (!entityDef(a.kind).pierce) destroyEntity(m, a, 'hit');
  return true;
}

/**
 * A hit on a hittable entity: it loses hit points (breaking at 0), freezes for hitlag and, with a weight, is launched
 * by Ultimate's knockback formula with its taken % as the percent. Returns the hitlag, which the attacker shares.
 */
function damageEntity(
  m: MatchState,
  e: EntityState,
  hit: PlacedHitbox,
  damage: number,
  dir: number,
  attacker: number,
): number {
  const def = entityDef(e.kind);
  const { box } = hit;
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric' });
  e.hitlag = lag;
  if (def.weight !== undefined) {
    const kb = knockback({
      percent: e.damage,
      damage,
      kbg: box.kbg,
      bkb: box.bkb,
      wbkb: box.wbkb,
      weight: def.weight,
    });
    const gravity = def.gravity ?? GRAVITY_BONUS_BASE;
    const l = launch({ kb, angle: box.angle, aerial: !e.grounded, gravity, setKnockback: !!box.wbkb });
    e.vel = { x: 0, y: 0 };
    e.kb = { x: l.vx * dir, y: l.vy };
  }
  e.damage += damage;
  e.hp -= damage;
  emit(m, { type: 'entityHit', id: e.id, kind: e.kind, attacker, damage, hp: e.hp, x: hit.x, y: hit.y });
  if (e.hp <= 0) destroyEntity(m, e, 'broken');
  return lag;
}
