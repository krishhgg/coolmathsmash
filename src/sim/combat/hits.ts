import { getFighter } from '../../fighters/registry';
import type { FighterStats, HitboxDef, MoveKind } from '../../fighters/types';
import { chargeMultiplier, moveOf } from '../actions/attack';
import { findGrabs, grabArmour, resolveGrabs } from '../actions/grab';
import { inWindow, isIntangible } from '../actions/registry';
import { LEDGE_HIT_LOCK } from '../constants';
import { stickX, stickY } from '../control';
import type { Ctx, FighterState, LaunchLink } from '../fighter';
import { emit } from '../events';
import type { MatchState } from '../match';
import { leaveGround } from '../movement';
import {
  AUTOLINK,
  AUTOLINK_GROUND_ANGLE,
  AUTOLINK_HALF,
  AUTOLINK_PULL,
  AUTOLINK_SPEED_CAP_DELAY,
  AUTOLINK_SPEED_MAX,
  AUTOLINK_VORTEX_FRAMES,
  AUTOLINK_VY_MIN,
  hitlagFrames,
  hitstunFrames,
  isAutolink,
  isTumble,
  knockback,
  launch,
  LAUNCH_SPEED_PER_KB,
  ONE_V_ONE_DAMAGE,
  rageMultiplier,
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

/** One connection, with everything about both fighters captured before any of this frame's hits land. */
interface Connection {
  a: FighterState;
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
  /** World position of the hitbox that connected. */
  at: { x: number; y: number };
  /** The attacker's move, kept here because an earlier hit this frame may clear it. */
  move: string | null;
  link?: LaunchLink;
  /** The victim's armor this frame (MoveDef.armor): hits below both thresholds don't launch. Null without armor. */
  armor: { kb: number; damage: number } | null;
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
): Connection {
  const move = a.move!;
  if (a.moveStale === 0) {
    a.moveStale = staleMultiplier(a.staleQueue.flatMap((name, i) => (name === move ? [i + 1] : [])));
    a.staleQueue = [move, ...a.staleQueue].slice(0, STALE_QUEUE_LENGTH);
  }
  return {
    a,
    v,
    box,
    kind: moveOf(a)?.kind ?? 'other',
    damage: box.damage * chargeMultiplier(a),
    stale: a.moveStale,
    rage: rageMultiplier(a.damage),
    dir: { forward: a.facing, back: -a.facing, away: Math.sign(v.pos.x - a.pos.x) || a.facing }[
      box.direction ?? 'forward'
    ] as 1 | -1,
    percent: v.damage,
    crouch: v.action === 'crouch' && v.ground !== null,
    shielding: v.action === 'shield' || v.action === 'shieldStun',
    at,
    move,
    link: isAutolink(box.angle) || box.vector ? linkOf(a, box, at) : undefined,
    armor: armorOf(v),
  };
}

/** The knockback and damage thresholds of `v`'s armor this frame (MoveDef.armor); unset ones never break. */
function armorOf(v: FighterState): Connection['armor'] {
  const armor = moveOf(v)?.armor;
  if (!armor || !inWindow(v.actionFrame, armor.frames)) return null;
  return { kb: armor.threshold ?? Infinity, damage: armor.damageThreshold ?? Infinity };
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
  hit(m, connection(a, v, box, at), again);
}

/**
 * Find every hit this frame from the state before any of them lands, then apply them all, so two fighters
 * whose moves connect on the same frame trade. Each move hits a fighter once (per rehit window), lowest
 * hitbox id first. Grab boxes are found from the same state and resolved after the hits (grab.ts), so an
 * attack beats a grab on the same frame.
 */
export function resolveHits(m: MatchState): void {
  const hits: Connection[] = [];
  const grabs = findGrabs(m);
  for (const a of m.fighters) {
    if (a.hitlag > 0) continue;
    const boxes = activeHitboxes(a).filter((h) => !h.box.grab);
    if (boxes.length === 0) continue;
    const found: { v: FighterState; box: HitboxDef; at: { x: number; y: number } }[] = [];
    for (const v of m.fighters) {
      if (v === a || a.hitVictims.includes(v.port) || !hittable(v)) continue;
      const body = hurtbox(v, getFighter(v.fighter).stats);
      const hit = boxes.filter((h) => touches(h, body)).sort((p, q) => p.box.id - q.box.id)[0];
      if (hit) found.push({ v, box: hit.box, at: { x: hit.x, y: hit.y } });
    }
    for (const { v, box, at } of found) {
      a.hitVictims.push(v.port);
      hits.push(connection(a, v, box, at));
    }
  }
  const struck = new Set<FighterState>();
  for (const h of hits) {
    const again = struck.has(h.v);
    struck.add(h.v);
    if (h.shielding) shieldHit(m, h, again);
    else hit(m, h, again);
  }
  resolveGrabs(m, grabs, struck);
}

/** Add `damage` to a fighter's meter: x1.2 in 1v1 (the meter only), capped at 999%. */
export function addDamage(m: MatchState, v: FighterState, damage: number): void {
  v.damage = Math.min(DAMAGE_MAX, v.damage + damage * (m.players.length === 2 ? ONE_V_ONE_DAMAGE : 1));
}

/**
 * Damage always adds up. When several fighters hit the same victim on one frame (`again`), the strongest
 * knockback is the launch and the longest hitlag is the victim's freeze.
 */
function hit(
  m: MatchState,
  { a, v, box, damage: base, stale, rage, dir, percent, crouch, at, move, link, armor }: Connection,
  again: boolean,
): void {
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
  const before = v.damage;
  addDamage(m, v, damage);
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric', crouch });
  a.hitlag = lag;
  v.hitlag = again ? Math.max(v.hitlag, lag) : lag;
  emit(m, {
    type: 'hit',
    attacker: a.port,
    victim: v.port,
    move,
    damage: v.damage - before,
    kb,
    tumble: isTumble(kb),
    hitlag: lag,
    effect: box.effect ?? 'normal',
    x: at.x,
    y: at.y,
  });
  if (armor && kb < armor.kb && damage < armor.damage) return;
  const held = grabArmour(m, v, damage);
  if (again && v.launch && v.launch.kb >= kb) return;
  v.launch = { kb, angle: box.angle, dir, setKnockback: (box.wbkb ?? 0) > 0, ...(link && { link }) };
  if (held) return;
  v.action = isTumble(kb) ? 'tumble' : 'hitstun';
  v.actionFrame = 0;
  v.move = null;
}

function shieldHit(
  m: MatchState,
  { a, v, box, kind, damage: base, stale, dir, at, move }: Connection,
  again: boolean,
): void {
  const damage = base * stale;
  const stun = shieldstunFrames(damage, kind);
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric' });
  a.hitlag = lag;
  v.hitlag = again ? Math.max(v.hitlag, lag) : lag;
  v.shieldHp = Math.max(0, v.shieldHp - damage * SHIELD_DAMAGE_MULT - (box.shieldDamage ?? 0));
  const away = Math.sign(v.pos.x - a.pos.x) || dir;
  const push = shieldPushback(damage, stun);
  v.kb.x = away * push.defender;
  if (a.ground) a.kb.x = -away * push.attacker;
  v.hitstun = again ? Math.max(v.hitstun, stun) : stun;
  v.action = 'shieldStun';
  v.actionFrame = 0;
  emit(m, {
    type: 'shieldHit',
    attacker: a.port,
    victim: v.port,
    move,
    damage,
    shieldHp: v.shieldHp,
    x: at.x,
    y: at.y,
  });
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
  f.speedUpFaf = l.tumble && !pending.setKnockback && !link?.to ? stun + 1 : 0;
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
