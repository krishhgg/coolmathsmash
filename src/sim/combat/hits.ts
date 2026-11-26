import { getFighter } from '../../fighters/registry';
import type { CounterDef, FighterStats, HitboxDef, MoveKind } from '../../fighters/types';
import { moveOf } from '../actions/attack';
import { chargeMultiplier } from '../actions/charge';
import { parries } from '../actions/defense';
import { findGrabs, grabArmour, resolveGrabs } from '../actions/grab';
import { inWindow, isIntangible } from '../actions/registry';
import { COUNTER, LEDGE_HIT_LOCK, PARRY } from '../constants';
import { stickX, stickY } from '../control';
import { inHitlag, type Ctx, type FighterState, type LaunchLink } from '../fighter';
import { emit } from '../events';
import { isFinalMove } from '../finalSmash';
import type { MatchState } from '../match';
import type { CompiledStage } from '../stage';
import { destroyEntity, entityDef, entityHitboxes, sweepEntities } from '../entities/entities';
import type { EntityState } from '../entities/types';
import { leaveGround, restoreAirOptions, surfaceRange, surfaceY } from '../movement';
import { applyStatus, damageTaken, endStatusesOnHit, isFrozen } from '../statuses';
import {
  AUTOLINK,
  AUTOLINK_GROUND_ANGLE,
  AUTOLINK_HALF,
  AUTOLINK_PULL,
  AUTOLINK_SPEED_CAP_DELAY,
  AUTOLINK_SPEED_MAX,
  AUTOLINK_VORTEX_FRAMES,
  AUTOLINK_VY_MIN,
  HITLAG,
  hitlagFrames,
  hitstunFrames,
  isAutolink,
  isTumble,
  knockback,
  launch,
  LAUNCH_SPEED_PER_KB,
  ONE_V_ONE_DAMAGE,
  rageMultiplier,
  SAKURAI,
  sakuraiAngle,
  SHIELD_DAMAGE_MULT,
  shieldPushback,
  shieldstunFrames,
  STALE_QUEUE_LENGTH,
  staleMultiplier,
} from './formulas';

export const DAMAGE_MAX = 999;

/** A hitbox placed in the world for the current frame. */
export interface PlacedHitbox {
  box: HitboxDef;
  x: number;
  y: number;
}

/**
 * The body: a capsule around a core segment, `r` thick. Upright fighters have a vertical core from the feet to the
 * head (`y1` to `y2`, half the width thick). A fighter wider than it is tall (a block lying on its side) has a
 * horizontal core instead, `hw` either side of `x`, half the height thick. Crouching lowers an upright body;
 * a lying one is already as low as it gets.
 */
export interface Hurtbox {
  x: number;
  y1: number;
  y2: number;
  r: number;
  /** Half-length of a horizontal core; 0 (or absent) for an upright fighter. */
  hw?: number;
}

export function hurtbox(f: FighterState, s: FighterStats): Hurtbox {
  const posed = getFighter(f.fighter).hurtbox?.(f);
  if (posed) return posed;
  if (s.width > s.height) {
    const r = s.height / 2;
    return { x: f.pos.x, y1: f.pos.y + r, y2: f.pos.y + r, r, hw: s.width / 2 - r };
  }
  const height = f.action === 'crouch' ? s.height * 0.6 : s.height;
  const r = s.width / 2;
  return { x: f.pos.x, y1: f.pos.y + r, y2: f.pos.y + Math.max(height - r, r), r };
}

export function activeHitboxes(f: FighterState): PlacedHitbox[] {
  const move = moveOf(f);
  if (!move) return [];
  return move.hits
    .filter((w) => inWindow(f.actionFrame, w.frames))
    .flatMap((w) => w.boxes.map((box) => ({ box, x: f.pos.x + box.x * f.facing, y: f.pos.y + box.y })));
}

export function touches(h: PlacedHitbox, body: Hurtbox): boolean {
  const hw = body.hw ?? 0;
  const x = Math.min(Math.max(h.x, body.x - hw), body.x + hw);
  const y = Math.min(Math.max(h.y, body.y1), body.y2);
  const r = h.box.radius + body.r;
  return (h.x - x) ** 2 + (h.y - y) ** 2 <= r * r;
}

export function hittable(f: FighterState): boolean {
  return f.action !== 'ko' && f.action !== 'out' && !isIntangible(f);
}

/** Whether `box` can hit `v` where it is now (HitboxDef.targets): on the ground, or airborne (ledge hangs included). */
export function targetable(box: Pick<HitboxDef, 'targets'>, v: FighterState): boolean {
  const targets = box.targets ?? 'both';
  return targets === 'both' || (targets === 'ground') === (v.ground !== null);
}

/** One connection, with everything about both sides captured before any of this frame's hits land. */
interface Connection {
  /** The attacking fighter, who shares the hitlag and is pushed back by a shield; null for an entity's hit. */
  a: FighterState | null;
  /** Port credited with the hit: the attacker, or the entity's owner (-1 for nobody). */
  attacker: number;
  /** Id of the entity whose hit this is. */
  entity?: number;
  /** Where the hit came from (the attacker's or the entity's x), for shield pushback. */
  fromX: number;
  v: FighterState;
  box: HitboxDef;
  kind: MoveKind;
  /** Hitbox damage after smash charge, before staleness. */
  damage: number;
  stale: number;
  rage: number;
  dir: 1 | -1;
  /** The victim's % before this frame's hits. */
  percent: number;
  crouch: boolean;
  shielding: boolean;
  /** The victim is in its shield drop's parry window (PARRY). */
  parry: boolean;
  /** World position of the hitbox that connected. */
  at: { x: number; y: number };
  /** The attacker's move, kept here because an earlier hit this frame may clear it. */
  move: string | null;
  link?: LaunchLink;
  /** The victim's armor this frame (MoveDef.armor): hits below both thresholds don't launch. Null without armor. */
  armor: { kb: number; damage: number; breakDamageMul: number } | null;
  /** The victim's counter if its window is open this frame (MoveDef.counter): the hit is caught instead. */
  counter: CounterDef | null;
}

/**
 * What `box` of `f`'s current move deals before staleness, the same on a fighter, on a hittable entity and in a clank
 * with a projectile: its own damage, or a counterattack's when that is more (MoveDef.counter), times the charge.
 */
export function hitboxDamage(f: FighterState, box: HitboxDef): number {
  return Math.max(box.damage, f.counterDamage) * chargeMultiplier(f);
}

/**
 * The connection of `box` from `a` on `v`, read before anything lands. A move activation stales once: its
 * multiplier is fixed and it enters the stale queue the first time it connects, however many fighters or rehit
 * windows it hits afterwards.
 */
function connection(
  a: FighterState,
  v: FighterState,
  box: HitboxDef,
  at: { x: number; y: number },
  frame: number,
): Connection {
  const move = a.move!;
  if (!box.pushOnly && a.moveStale === 0) a.moveStale = stale(a, move);
  return {
    ...victim(v, frame, moveOf(a)?.final !== undefined),
    a,
    attacker: a.port,
    fromX: a.pos.x,
    box,
    kind: moveOf(a)?.kind ?? 'other',
    damage: hitboxDamage(a, box),
    stale: a.moveStale,
    rage: rageMultiplier(a.damage),
    dir: launchDir(box, a.facing, a.pos.x, v),
    at,
    move,
    link: isAutolink(box.angle) || box.vector ? linkOf(a, box, at) : undefined,
  };
}

/**
 * The knockback and damage thresholds of `v`'s armor this frame (MoveDef.armor), unset ones never breaking, and the
 * damage multiplier of the hit that breaks it (1 unless set).
 */
export function armorOf(v: FighterState): Connection['armor'] {
  const armor = moveOf(v)?.armor;
  if (!armor || !inWindow(v.actionFrame, armor.frames)) return null;
  return {
    kb: armor.threshold ?? Infinity,
    damage: armor.damageThreshold ?? Infinity,
    breakDamageMul: armor.breakDamageMul ?? 1,
  };
}

/** `v`'s counter if its window is open this frame (MoveDef.counter), else null. */
function counterOf(v: FighterState): CounterDef | null {
  const counter = moveOf(v)?.counter;
  return counter && inWindow(v.actionFrame, counter.window) ? counter : null;
}

/**
 * An entity's hits go down the same path as a fighter's, as a projectile: staled by the owner's move, scaled by the
 * owner's rage and by reflections, and DI'd and shielded like any hit. Only the victim freezes. It hits each fighter
 * once (per rehit window) and, unless it pierces, is used up by its first victim: true when it was.
 */
function entityHits(m: MatchState, e: EntityState, hits: Connection[]): boolean {
  const boxes = entityHitboxes(m, e);
  if (boxes.length === 0) return false;
  const def = entityDef(e.kind);
  const owner = m.fighters.find((f) => f.port === e.owner) ?? null;
  for (const v of m.fighters) {
    if (v.port === e.owner || e.hitVictims.includes(v.port) || !hittable(v)) continue;
    const body = hurtbox(v, getFighter(v.fighter).stats);
    const hit = boxes
      .filter((h) => targetable(h.box, v) && touches(h, body))
      .sort((p, q) => p.box.id - q.box.id)[0];
    if (!hit) continue;
    e.hitVictims.push(v.port);
    if (!hit.box.pushOnly && e.stale === 0) e.stale = owner && e.move ? stale(owner, e.move) : 1;
    hits.push({
      ...victim(v, m.frame, owner !== null && isFinalMove(owner.fighter, e.move)),
      a: null,
      attacker: e.owner,
      entity: e.id,
      fromX: e.pos.x,
      box: hit.box,
      kind: def.kind ?? 'projectile',
      damage: hit.box.damage * e.damageMul,
      stale: e.stale,
      rage: owner ? rageMultiplier(owner.damage) : 1,
      dir: launchDir(hit.box, e.facing, e.pos.x, v),
      at: { x: hit.x, y: hit.y },
      move: e.move,
    });
    if (!def.pierce) return true;
  }
  return false;
}

/** The stale multiplier for one activation of `move`, which then enters the stale queue. */
function stale(a: FighterState, move: string): number {
  const mult = staleMultiplier(a.staleQueue.flatMap((name, i) => (name === move ? [i + 1] : [])));
  a.staleQueue = [move, ...a.staleQueue].slice(0, STALE_QUEUE_LENGTH);
  return mult;
}

/**
 * The victim's state before any of this frame's hits land (on match frame `frame`). An `unblockable` hit (a Final
 * Smash's, src/sim/finalSmash.ts) goes through a shield, a parry or a counter as if none were up: SmashWiki
 * ("Counterattack") says "unblockable attacks cannot be countered".
 */
function victim(
  v: FighterState,
  frame: number,
  unblockable = false,
): Pick<Connection, 'v' | 'percent' | 'crouch' | 'shielding' | 'parry' | 'armor' | 'counter'> {
  return {
    v,
    percent: v.damage,
    crouch: v.action === 'crouch' && v.ground !== null,
    shielding: !unblockable && (v.action === 'shield' || v.action === 'shieldStun'),
    parry: !unblockable && parries(v, frame),
    armor: armorOf(v),
    counter: unblockable ? null : counterOf(v),
  };
}

/** Ultimate's LR check: the side a hit launches toward, from the source's facing and position. */
function launchDir(box: HitboxDef, facing: 1 | -1, fromX: number, v: FighterState): 1 | -1 {
  const away = (Math.sign(v.pos.x - fromX) || facing) as 1 | -1;
  return { forward: facing, back: -facing as 1 | -1, away }[box.direction ?? 'forward'];
}

/**
 * Land `box` from `a`'s current move on `v` without a hitbox contact (throws), exactly as a connecting hit
 * landing on the middle of `v`'s body.
 */
export function applyHit(
  m: MatchState,
  a: FighterState,
  v: FighterState,
  box: HitboxDef,
  again = false,
): void {
  const at = { x: v.pos.x, y: v.pos.y + getFighter(v.fighter).stats.height / 2 };
  const contact = connection(a, v, box, at, m.frame);
  if (box.pushOnly) windPush(contact);
  else hit(m, contact, again, new Map());
}

/**
 * Find every hit this frame from the state before any of them lands, then apply them all, so two fighters
 * whose moves connect on the same frame trade. Each move hits a fighter once (per rehit window), lowest
 * hitbox id first among the boxes that can hit it where it is (HitboxDef.targets), windboxes included. Hits on an
 * open counter are caught instead. Grab boxes are found from the same state and resolved after the hits (grab.ts), so
 * an attack beats a grab on the same frame. `stage` lands the stage hazards' hits (src/sim/hazards.ts) between the
 * two, adding its victims to `struck`, so they break grabs like any other hit. Counterattacks start last, for
 * counterers no grab or hazard took this frame; `posed` is the stage as it stands this frame, for a counter that
 * reappears on a floor.
 */
export function resolveHits(
  m: MatchState,
  posed: CompiledStage,
  stage?: (struck: Set<FighterState>) => void,
): void {
  const hits: Connection[] = [];
  const grabs = findGrabs(m);
  for (const a of m.fighters) {
    if (inHitlag(m, a) || isFrozen(m, a)) continue;
    const boxes = activeHitboxes(a).filter((h) => !h.box.grab);
    if (boxes.length === 0) continue;
    const found: { v: FighterState; box: HitboxDef; at: { x: number; y: number } }[] = [];
    for (const v of m.fighters) {
      if (v === a || a.hitVictims.includes(v.port) || !hittable(v)) continue;
      const body = hurtbox(v, getFighter(v.fighter).stats);
      const hit = boxes
        .filter((h) => targetable(h.box, v) && touches(h, body))
        .sort((p, q) => p.box.id - q.box.id)[0];
      if (hit) found.push({ v, box: hit.box, at: { x: hit.x, y: hit.y } });
    }
    for (const { v, box, at } of found) {
      a.hitVictims.push(v.port);
      hits.push(connection(a, v, box, at, m.frame));
    }
  }
  const used = m.entities.filter((e) => entityHits(m, e, hits));
  const caught: Connection[] = [];
  const struck = new Set<FighterState>();
  const ended: EndedOnHit = new Map();
  for (const h of hits) {
    // A windbox deals nothing, so it pushes a fighter in an open counter without setting it off.
    if (h.box.pushOnly) {
      windPush(h);
      continue;
    }
    if (h.counter) {
      if (!caught.some((c) => c.v === h.v)) caught.push(h);
      continue;
    }
    const again = struck.has(h.v);
    struck.add(h.v);
    if (h.parry) parry(m, h, again);
    else if (h.shielding) shieldHit(m, h, again);
    else hit(m, h, again, ended);
  }
  for (const e of used) destroyEntity(m, e, 'hit');
  sweepEntities(m);
  stage?.(struck);
  resolveGrabs(m, grabs, struck);
  // A caught hit is blocked, not a strike, so it doesn't stop a grab. Grabs and hazards go through counters: a
  // counterer that one of them took this frame doesn't answer.
  for (const h of caught) {
    if (!struck.has(h.v) && h.v.action !== 'grabbed') counterattack(m, posed, h, h.counter!);
  }
}

function windPush({ v, box, shielding, percent, crouch, dir, rage }: Connection): void {
  if (shielding) return;
  const kb = knockback({
    percent,
    damage: 0,
    kbg: box.kbg,
    bkb: box.bkb,
    wbkb: box.wbkb,
    weight: getFighter(v.fighter).stats.weight,
    rage,
    crouch,
  });
  const angle = box.angle === SAKURAI ? sakuraiAngle(kb, v.ground === null) : box.angle;
  const theta = (angle * Math.PI) / 180;
  const speed = kb * LAUNCH_SPEED_PER_KB;
  v.kb.x += Math.cos(theta) * speed * dir;
  if (!v.ground) v.kb.y += Math.sin(theta) * speed;
}

/**
 * Add `damage` to a fighter's meter: x1.2 in a 1v1 with items off, and x its statuses' damageTaken (the meter only, not
 * knockback), capped at 999%.
 */
export function addDamage(m: MatchState, v: FighterState, damage: number): void {
  const oneVOne = m.players.length === 2 && !m.config.items;
  const mul = (oneVOne ? ONE_V_ONE_DAMAGE : 1) * damageTaken(v);
  v.damage = Math.min(DAMAGE_MAX, v.damage + damage * mul);
}

/** What a hit does to its victim, whoever or whatever dealt it (a fighter's move, a stage hazard). */
export interface Strike {
  box: Pick<HitboxDef, 'damage' | 'angle' | 'kbg' | 'bkb' | 'wbkb' | 'hitlag' | 'effect'>;
  /** Damage before staleness. */
  damage: number;
  stale: number;
  rage: number;
  dir: 1 | -1;
  /** The victim's % before this frame's hits. */
  percent: number;
  crouch: boolean;
  /**
   * The victim's armor (MoveDef.armor): hits below both thresholds don't launch, and the hit that breaks through
   * adds `breakDamageMul` of its damage. Null without armor.
   */
  armor: { kb: number; damage: number; breakDamageMul: number } | null;
  /** How an autolink or position-vector hit follows its attacker after hitlag; only a fighter's hits have one. */
  link?: LaunchLink;
}

/**
 * The victim's side of a hit: damage, hitlag and the launch waiting for hitlag to end. When several hits land
 * on one victim on the same frame (`again`), the strongest knockback is the launch and the longest hitlag is
 * the freeze. An armored victim takes hits below both its thresholds without launching; the hit that breaks through
 * adds only `breakDamageMul` of its damage, judged and launched on the full damage. A held fighter stays in the grab,
 * the damage counting toward breaking it. The hit takes off the victim's statuses that end on a hit. Returns the
 * knockback, the hitlag, the % added and the kinds of status it took off.
 */
export function strike(
  m: MatchState,
  v: FighterState,
  { box, damage: base, stale, rage, dir, percent, crouch, armor, link }: Strike,
  again: boolean,
): { kb: number; lag: number; added: number; ended: string[] } {
  const kb = knockback({
    percent,
    damage: base,
    kbg: box.kbg,
    bkb: box.bkb,
    wbkb: box.wbkb,
    weight: getFighter(v.fighter).stats.weight,
    stale,
    rage,
    crouch,
  });
  const damage = base * stale;
  const armored = armor !== null && kb < armor.kb && damage < armor.damage;
  const before = v.damage;
  addDamage(m, v, armor && !armored ? damage * armor.breakDamageMul : damage);
  const ended = endStatusesOnHit(m, v);
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric', crouch });
  v.hitlag = again ? Math.max(v.hitlag, lag) : lag;
  const result = { kb, lag, added: v.damage - before, ended };
  if (armored) return result;
  const held = grabArmour(m, v, damage);
  if (again && v.launch && v.launch.kb >= kb) return result;
  v.launch = { kb, angle: box.angle, dir, setKnockback: (box.wbkb ?? 0) > 0, ...(link && { link }) };
  if (held) return result;
  v.action = isTumble(kb) ? 'tumble' : 'hitstun';
  v.actionFrame = 0;
  v.move = null;
  return result;
}

/**
 * Damage always adds up; a fighter attacker freezes for hitlag, but an entity and its owner do not. A box with a
 * `status` puts it on the victim after the hit event, its length taken from the % the hit added and its knockback
 * scaled like its hitlag, unless a hit in the same batch took that status off (StatusDef.endOnHit).
 */
/**
 * The kinds of status each victim's hits have taken off in one batch of hits (StatusDef.endOnHit), so no hit in the
 * batch puts back one that another just took off, whichever lands first.
 */
type EndedOnHit = Map<FighterState, string[]>;

function hit(m: MatchState, h: Connection, again: boolean, batch: EndedOnHit): void {
  const struck = strike(m, h.v, h, again);
  const { kb, lag, added } = struck;
  const ended = [...(batch.get(h.v) ?? []), ...struck.ended];
  batch.set(h.v, ended);
  // One swing can connect several times a frame (a parry among them): the attacker keeps the longest freeze.
  if (h.a) h.a.hitlag = Math.max(h.a.hitlag, lag);
  emit(m, {
    type: 'hit',
    attacker: h.attacker,
    ...(h.entity !== undefined && { entity: h.entity }),
    victim: h.v.port,
    move: h.move,
    damage: added,
    kb,
    tumble: isTumble(kb),
    hitlag: lag,
    effect: h.box.effect ?? 'normal',
    x: h.at.x,
    y: h.at.y,
  });
  if (h.box.status && !ended.includes(h.box.status)) {
    const knockback = kb * (h.box.hitlag ?? 1) * (h.crouch ? HITLAG.crouch : 1);
    applyStatus(m, h.v, h.box.status, { damage: added, knockback, source: h.attacker });
  }
}

/**
 * Counters (Ultimate, SmashWiki "Counterattack"): every hit on an open counter is blocked, and the first one this
 * frame sets it off. The counterer turns to face the hit, or with `behind` reappears behind the attacker facing
 * their back, and starts the counterattack, freezing with the attacker for `freeze` frames. Its frame 1 is the last
 * frozen frame, so its hitboxes come out on its own frame numbers, and it is intangible until then. The
 * counterattack's boxes deal the caught hit's damage (after staleness) times `multiplier`, capped at `max`, or their
 * own damage when that is more. A caught projectile is used up and freezes nobody else.
 */
function counterattack(m: MatchState, posed: CompiledStage, h: Connection, c: CounterDef): void {
  const { a, v: f } = h;
  const caught = h.damage * h.stale;
  const freeze = c.freeze ?? COUNTER.freeze;
  if (a && c.behind !== undefined) reappearBehind(posed, f, a, c.behind);
  else f.facing = (Math.sign(h.fromX - f.pos.x) || f.facing) as 1 | -1;
  Object.assign(f, {
    action: f.ground ? 'attack' : 'aerial',
    actionFrame: 0,
    move: c.move,
    hitVictims: [],
    hitEntities: [],
    moveStale: 0,
    charge: 0,
    counterDamage: Math.min(c.max ?? COUNTER.max, caught * (c.multiplier ?? COUNTER.multiplier)),
    hitlag: Math.max(0, freeze - 1),
    intangible: Math.max(f.intangible, 1),
  });
  if (a) a.hitlag = Math.max(a.hitlag, freeze);
  emit(m, {
    type: 'counter',
    port: f.port,
    attacker: h.attacker,
    ...(h.entity !== undefined && { entity: h.entity }),
    move: c.move,
    damage: caught,
    x: h.at.x,
    y: h.at.y,
  });
  emit(m, { type: 'move', port: f.port, move: c.move });
}

/** Reappear `behind` units behind `a`, facing their back: on `a`'s floor (kept on it), or in the air beside them. */
function reappearBehind(stage: CompiledStage, f: FighterState, a: FighterState, behind: number): void {
  const x = a.pos.x - a.facing * behind;
  f.facing = a.facing;
  f.vel = { x: 0, y: 0 };
  f.kb = { x: 0, y: 0 };
  if (a.ground) {
    const [lo, hi] = surfaceRange(stage, a.ground);
    const on = Math.min(Math.max(x, lo), hi);
    f.pos = { x: on, y: surfaceY(stage, a.ground, on) };
    if (!f.ground) restoreAirOptions(f);
    f.ground = { ...a.ground };
  } else {
    f.pos = { x, y: a.pos.y };
    if (f.ground) Object.assign(f, { ground: null, airFrames: 0, jumpsUsed: Math.max(f.jumpsUsed, 1) });
  }
  f.prevPos = { x: f.pos.x, y: f.pos.y };
}

/** What a shield or a parry reads from a hit: a fighter's, an entity's or a stage hazard's (`guardStageHit`). */
type Guarded = Pick<
  Connection,
  'a' | 'attacker' | 'entity' | 'fromX' | 'v' | 'kind' | 'damage' | 'stale' | 'dir' | 'at' | 'move'
> & { box: Pick<HitboxDef, 'hitlag' | 'effect' | 'shieldDamage'> };

function shieldHit(
  m: MatchState,
  { a, attacker, entity, fromX, v, box, kind, damage: base, stale, dir, at, move }: Guarded,
  again: boolean,
): void {
  const damage = base * stale;
  const stun = shieldstunFrames(damage, kind);
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric' });
  if (a) a.hitlag = Math.max(a.hitlag, lag);
  v.hitlag = again ? Math.max(v.hitlag, lag) : lag;
  v.shieldHp = Math.max(0, v.shieldHp - damage * SHIELD_DAMAGE_MULT - (box.shieldDamage ?? 0));
  const away = Math.sign(v.pos.x - fromX) || dir;
  const push = shieldPushback(damage, stun);
  v.kb.x = away * push.defender;
  if (a?.ground) a.kb.x = -away * push.attacker;
  v.hitstun = again ? Math.max(v.hitstun, stun) : stun;
  v.action = 'shieldStun';
  v.actionFrame = 0;
  emit(m, {
    type: 'shieldHit',
    attacker,
    ...(entity !== undefined && { entity }),
    victim: v.port,
    move,
    damage,
    shieldHp: v.shieldHp,
    x: at.x,
    y: at.y,
  });
}

/**
 * A hit on the first frames of a shield drop is parried (PARRY): no damage, no shield damage and no shieldstun, and
 * the defender can act as soon as its hitlag ends, which on a fighter's hit is 3 frames before the attacker can.
 * Pushback is the shield formula with no shieldstun; SmashWiki "Shield" only says a parry's pushback is reduced.
 */
function parry(
  m: MatchState,
  { a, attacker, entity, fromX, v, box, damage: base, stale, dir, at, move }: Guarded,
  again: boolean,
): void {
  const damage = base * stale;
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric' });
  const defender = a
    ? Math.min(lag + PARRY.defenderHitlag, PARRY.maxHitlag)
    : Math.max(0, lag + PARRY.projectileDefenderHitlag);
  if (a) a.hitlag = Math.max(a.hitlag, Math.min(lag + PARRY.attackerHitlag, PARRY.maxHitlag));
  v.hitlag = again ? Math.max(v.hitlag, defender) : defender;
  const away = Math.sign(v.pos.x - fromX) || dir;
  const push = shieldPushback(damage, 0);
  v.kb.x = away * push.defender;
  if (a?.ground) a.kb.x = -away * push.attacker;
  v.action = v.ground ? 'idle' : 'fall';
  v.actionFrame = 0;
  emit(m, {
    type: 'parry',
    attacker,
    ...(entity !== undefined && { entity }),
    victim: v.port,
    move,
    x: at.x,
    y: at.y,
  });
}

/**
 * A stage hazard's hit (src/sim/hazards.ts) on `v` meets its shield as any other hit does, read from `v`'s state as
 * `resolveHits` reads a fighter's hit: parried in a shield drop's parry window, else blocked by a held shield with
 * shield damage, shieldstun and pushback away from `fromX`. It credits nobody (`attacker` -1, no move), nobody else
 * freezes, and a parry counts as an indirect hit's. Shieldstun uses the formula's general case (SHIELDSTUN_MULT
 * 'other'), since a hazard is no smash attack, aerial or projectile. Returns what happened, or null, landing
 * nothing, when `v` has no shield up, so the hazard strikes.
 *
 * A shield blocks a hazard as it blocks any hit. SmashWiki, Shield: "A shield protects the user from a majority of attacks;
 * more specifically, any that are not grabs or determined to be unblockable". SmashWiki, Spear Pillar, on Dialga
 * and Palkia's laser: "It can be shielded and, in Ultimate, reflected or absorbed." SmashWiki, Perfect shield:
 * "Because it is technically a shield, it is ineffective against grabs and unblockable attacks", so whatever a
 * shield blocks can be parried.
 */
export function guardStageHit(
  m: MatchState,
  v: FighterState,
  hit: {
    box: Pick<HitboxDef, 'damage' | 'hitlag' | 'effect' | 'shieldDamage'>;
    fromX: number;
    dir: 1 | -1;
    at: { x: number; y: number };
  },
): 'parry' | 'shield' | null {
  const { parry: parrying, shielding } = victim(v, m.frame);
  if (!parrying && !shielding) return null;
  const h: Guarded = {
    ...hit,
    a: null,
    attacker: -1,
    v,
    kind: 'other',
    damage: hit.box.damage,
    stale: 1,
    move: null,
  };
  if (parrying) parry(m, h, false);
  else shieldHit(m, h, false);
  return parrying ? 'parry' : 'shield';
}

/** The attacker's motion and the hitbox an autolink or position-vector hit needs after hitlag, captured on contact. */
function linkOf(a: FighterState, box: HitboxDef, at: { x: number; y: number }): LaunchLink {
  const link: LaunchLink = { vel: { x: a.vel.x + a.kb.x, y: a.vel.y + a.kb.y }, at };
  if (box.vector) {
    link.to = { x: a.pos.x + box.vector.x * a.facing, y: a.pos.y + box.vector.y, frames: box.vector.frames };
  }
  return link;
}

/**
 * Hitlag is over: launch. DI comes from the victim's stick now. Grounded fighters hit flat (0 or 180 degrees)
 * or downward without tumble slide along the ground in hitstun; tumble spikes into the ground bounce off it.
 * Autolink and position-vector hits replace the launch speed (but not the hitstun) with their own (formulas.ts).
 */
export function applyLaunch(x: Ctx): void {
  const { f, c, s } = x;
  const pending = f.launch!;
  f.launch = null;
  f.launchMotion = null;
  const autolink = isAutolink(pending.angle);
  const grounded367 =
    autolink && f.ground !== null && pending.angle !== AUTOLINK.half && pending.angle !== AUTOLINK.vortex;
  const link = pending.link && (pending.link.to || !grounded367) ? pending.link : undefined;
  const l = launch({
    kb: pending.kb,
    angle: autolink ? AUTOLINK_GROUND_ANGLE : pending.angle,
    aerial: f.ground === null,
    gravity: s.gravity,
    setKnockback: pending.setKnockback,
    stick: link ? undefined : { x: stickX(c) * pending.dir, y: stickY(c) },
  });
  f.vel = { x: 0, y: 0 };
  const stun = hitstunFrames(pending.kb);
  f.hitstun = stun + 1;
  f.kb = link
    ? linkedLaunch(x, pending.angle, link, pending.kb * LAUNCH_SPEED_PER_KB)
    : { x: l.vx * pending.dir, y: l.vy };
  f.ledge = -1;
  f.ledgeLock = LEDGE_HIT_LOCK;
  f.ledgeGrabs = 0;
  f.ledgeFresh = true;
  f.fastFalling = false;
  f.airDodgeUsed = false;
  // Balloon speed-up runs several movement steps a frame; a launch that follows the attacker's motion keeps its pace.
  f.speedUpFaf = l.tumble && !pending.setKnockback && !link ? stun + 1 : 0;
  f.flyTop = l.vertical && !link;
  if (!f.ground) return;
  const flat = link ? f.kb.y === 0 : l.angle === 0 || l.angle === 180;
  if (!flat && f.kb.y > 0) return leaveGround(x);
  if (!link && !flat && l.tumble) {
    f.kb.y = Math.abs(f.kb.y) * 0.8;
    return leaveGround(x);
  }
  f.kb.y = 0;
  if (f.action === 'tumble') f.action = 'hitstun';
}

/** Launch velocity of an autolink (365-367) or position-vector hit; `speed` is the knockback's own launch speed. */
function linkedLaunch(x: Ctx, angle: number, link: LaunchLink, speed: number): { x: number; y: number } {
  const { f, s } = x;
  if (link.to) {
    f.launchMotion = { kind: 'vector', at: link.to, frames: Math.max(1, Math.ceil(link.to.frames)) };
    stepLaunchMotion(x);
    return f.kb;
  }
  const { vel } = link;
  if (angle === AUTOLINK.half) return { x: vel.x * AUTOLINK_HALF, y: vel.y * AUTOLINK_HALF };
  if (angle === AUTOLINK.vortex) {
    const dir = withSpeed(vel, 1);
    f.launchMotion = { kind: 'vortex', at: link.at, frames: AUTOLINK_VORTEX_FRAMES, dir };
    f.kb = withSpeed(dir, speed);
    stepLaunchMotion(x, speed);
    return f.kb;
  }
  const v = {
    x: vel.x + AUTOLINK_PULL * (link.at.x - f.pos.x),
    y: Math.max(AUTOLINK_VY_MIN, vel.y + AUTOLINK_PULL * (link.at.y - f.pos.y - s.height / 2)),
  };
  if (Math.hypot(v.x, v.y) > AUTOLINK_SPEED_MAX) {
    f.launchMotion = { kind: 'cap', frames: AUTOLINK_SPEED_CAP_DELAY - 1 };
  }
  return v;
}

function withSpeed(v: { x: number; y: number }, speed: number): { x: number; y: number } {
  const n = Math.hypot(v.x, v.y);
  return n > 0 ? { x: (v.x / n) * speed, y: (v.y / n) * speed } : { x: 0, y: 0 };
}

export function stepLaunchMotion(x: Ctx, speed = Math.hypot(x.f.kb.x, x.f.kb.y)): void {
  const { f, s } = x;
  const p = f.launchMotion!;
  if (f.hitstun <= 0 || (f.action !== 'tumble' && f.action !== 'hitstun')) {
    f.launchMotion = null;
    return;
  }
  if (p.frames === 0) {
    f.launchMotion = null;
    if (p.kind === 'cap') {
      if (speed > AUTOLINK_SPEED_MAX) f.kb = withSpeed(f.kb, AUTOLINK_SPEED_MAX);
    } else {
      f.kb = p.kind === 'vortex' ? withSpeed(p.dir, speed) : { x: 0, y: 0 };
    }
    return;
  }
  p.frames--;
  if (p.kind === 'cap') return;
  const dx = p.at.x - f.pos.x;
  const dy = p.at.y - f.pos.y - s.height / 2;
  f.kb =
    p.kind === 'vector'
      ? { x: dx / (p.frames + 1) - f.vel.x, y: dy / (p.frames + 1) - f.vel.y }
      : withSpeed(
          { x: p.dir.x * speed + dx * AUTOLINK_PULL, y: p.dir.y * speed + dy * AUTOLINK_PULL },
          speed,
        );
  if (f.ground && f.kb.y > 0) leaveGround(x);
}
