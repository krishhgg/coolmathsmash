import { getFighter } from '../../fighters/registry';
import type { FighterStats, HitboxDef, MoveKind } from '../../fighters/types';
import { moveOf } from '../actions/attack';
import { inWindow, isIntangible } from '../actions/registry';
import { LEDGE_HIT_LOCK } from '../constants';
import { stickX, stickY } from '../control';
import type { Ctx, FighterState } from '../fighter';
import type { MatchState } from '../match';
import { leaveGround } from '../movement';
import {
  hitlagFrames,
  hitstunFrames,
  isTumble,
  knockback,
  launch,
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

/** The body: a vertical capsule from the feet to the head, half the fighter's width thick. Crouching lowers it. */
export interface Hurtbox {
  x: number;
  y1: number;
  y2: number;
  r: number;
}

export function hurtbox(f: FighterState, s: FighterStats): Hurtbox {
  const r = s.width / 2;
  const height = f.action === 'crouch' ? s.height * 0.6 : s.height;
  return { x: f.pos.x, y1: f.pos.y + r, y2: f.pos.y + Math.max(height - r, r), r };
}

export function activeHitboxes(f: FighterState): PlacedHitbox[] {
  const move = moveOf(f);
  if (!move) return [];
  return move.hits
    .filter((w) => inWindow(f.actionFrame, w.frames))
    .flatMap((w) => w.boxes.map((box) => ({ box, x: f.pos.x + box.x * f.facing, y: f.pos.y + box.y })));
}

function touches(h: PlacedHitbox, body: Hurtbox): boolean {
  const y = Math.min(Math.max(h.y, body.y1), body.y2);
  const r = h.box.radius + body.r;
  return (h.x - body.x) ** 2 + (h.y - y) ** 2 <= r * r;
}

function hittable(f: FighterState): boolean {
  return f.action !== 'ko' && f.action !== 'out' && !isIntangible(f);
}

/**
 * Find every hit this frame from the state before any of them lands, then apply them all, so two fighters
 * whose moves connect on the same frame trade. Each move hits a fighter once (per rehit window), lowest
 * hitbox id first.
 */
export function resolveHits(m: MatchState): void {
  const hits: { a: FighterState; v: FighterState; box: HitboxDef }[] = [];
  for (const a of m.fighters) {
    if (a.hitlag > 0) continue;
    const boxes = activeHitboxes(a);
    if (boxes.length === 0) continue;
    for (const v of m.fighters) {
      if (v === a || a.hitVictims.includes(v.port) || !hittable(v)) continue;
      const body = hurtbox(v, getFighter(v.fighter).stats);
      const hit = boxes.filter((h) => touches(h, body)).sort((p, q) => p.box.id - q.box.id)[0];
      if (hit) hits.push({ a, v, box: hit.box });
    }
  }
  for (const { a, v, box } of hits) {
    const kind = moveOf(a)?.kind ?? 'other';
    a.hitVictims.push(v.port);
    if (v.action === 'shield' || v.action === 'shieldStun') shieldHit(a, v, box, kind);
    else hit(m, a, v, box);
  }
}

function hit(m: MatchState, a: FighterState, v: FighterState, box: HitboxDef): void {
  const move = a.move!;
  const slots = a.staleQueue.flatMap((name, i) => (name === move ? [i + 1] : []));
  const stale = staleMultiplier(slots);
  const crouch = v.action === 'crouch' && v.ground !== null;
  const kb = knockback({
    percent: v.damage,
    damage: box.damage,
    kbg: box.kbg,
    bkb: box.bkb,
    wbkb: box.wbkb,
    weight: getFighter(v.fighter).stats.weight,
    stale,
    rage: rageMultiplier(a.damage),
    crouch,
  });
  const damage = box.damage * stale;
  v.damage = Math.min(DAMAGE_MAX, v.damage + damage * (m.players.length === 2 ? ONE_V_ONE_DAMAGE : 1));
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric', crouch });
  a.hitlag = lag;
  v.hitlag = lag;
  a.staleQueue = [move, ...a.staleQueue].slice(0, STALE_QUEUE_LENGTH);
  v.launch = { kb, angle: box.angle, dir: a.facing, setKnockback: (box.wbkb ?? 0) > 0 };
  v.action = isTumble(kb) ? 'tumble' : 'hitstun';
  v.actionFrame = 0;
  v.move = null;
}

function shieldHit(a: FighterState, v: FighterState, box: HitboxDef, kind: MoveKind): void {
  const damage =
    box.damage * staleMultiplier(a.staleQueue.flatMap((name, i) => (name === a.move ? [i + 1] : [])));
  const stun = shieldstunFrames(damage, kind);
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric' });
  a.hitlag = lag;
  v.hitlag = lag;
  v.shieldHp -= damage * SHIELD_DAMAGE_MULT + (box.shieldDamage ?? 0);
  const away = Math.sign(v.pos.x - a.pos.x) || a.facing;
  const push = shieldPushback(damage, stun);
  v.kb.x = away * push.defender;
  if (a.ground) a.kb.x = -away * push.attacker;
  v.hitstun = stun;
  v.action = 'shieldStun';
  v.actionFrame = 0;
}

/**
 * Hitlag is over: launch. DI comes from the victim's stick now. Grounded fighters launched downward or flat
 * slide along the ground instead; tumble launches into the ground bounce off it.
 */
export function applyLaunch(x: Ctx): void {
  const { f, c, s } = x;
  const pending = f.launch!;
  f.launch = null;
  const l = launch({
    kb: pending.kb,
    angle: pending.angle,
    aerial: f.ground === null,
    gravity: s.gravity,
    setKnockback: pending.setKnockback,
    stick: { x: stickX(c) * pending.dir, y: stickY(c) },
  });
  f.vel = { x: 0, y: 0 };
  f.kb = { x: l.vx * pending.dir, y: l.vy };
  f.ledge = -1;
  f.ledgeLock = LEDGE_HIT_LOCK;
  f.ledgeGrabs = 0;
  f.ledgeFresh = true;
  f.fastFalling = false;
  f.airDodgeUsed = false;
  const stun = hitstunFrames(pending.kb);
  f.hitstun = stun + 1;
  f.speedUpFaf = l.tumble && !pending.setKnockback ? stun + 1 : 0;
  if (!f.ground) return;
  if (l.tumble) {
    if (f.kb.y < 0) f.kb.y *= -0.8;
    leaveGround(x);
  } else if (f.kb.y > 0) {
    leaveGround(x);
  } else {
    f.kb.y = 0;
  }
}
