import { getFighter } from '../../fighters/registry';
import type { FighterStats, HitboxDef, MoveKind } from '../../fighters/types';
import { chargeMultiplier, moveOf } from '../actions/attack';
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
}

/**
 * Find every hit this frame from the state before any of them lands, then apply them all, so two fighters
 * whose moves connect on the same frame trade. Each move hits a fighter once (per rehit window), lowest
 * hitbox id first. A move activation stales once: its multiplier is fixed and it enters the stale queue the
 * first time it connects, however many fighters or rehit windows it hits afterwards.
 */
export function resolveHits(m: MatchState): void {
  const hits: Connection[] = [];
  for (const a of m.fighters) {
    if (a.hitlag > 0) continue;
    const boxes = activeHitboxes(a);
    if (boxes.length === 0) continue;
    const found: { v: FighterState; box: HitboxDef }[] = [];
    for (const v of m.fighters) {
      if (v === a || a.hitVictims.includes(v.port) || !hittable(v)) continue;
      const body = hurtbox(v, getFighter(v.fighter).stats);
      const hit = boxes.filter((h) => touches(h, body)).sort((p, q) => p.box.id - q.box.id)[0];
      if (hit) found.push({ v, box: hit.box });
    }
    if (found.length === 0) continue;
    const move = a.move!;
    if (a.moveStale === 0) {
      a.moveStale = staleMultiplier(a.staleQueue.flatMap((name, i) => (name === move ? [i + 1] : [])));
      a.staleQueue = [move, ...a.staleQueue].slice(0, STALE_QUEUE_LENGTH);
    }
    const kind = moveOf(a)?.kind ?? 'other';
    for (const { v, box } of found) {
      a.hitVictims.push(v.port);
      const damage = box.damage * chargeMultiplier(a);
      hits.push({
        a,
        v,
        box,
        kind,
        damage,
        stale: a.moveStale,
        rage: rageMultiplier(a.damage),
        dir: a.facing,
        percent: v.damage,
        crouch: v.action === 'crouch' && v.ground !== null,
        shielding: v.action === 'shield' || v.action === 'shieldStun',
      });
    }
  }
  const struck = new Set<FighterState>();
  for (const h of hits) {
    const again = struck.has(h.v);
    struck.add(h.v);
    if (h.shielding) shieldHit(h, again);
    else hit(m, h, again);
  }
}

/**
 * Damage always adds up. When several fighters hit the same victim on one frame (`again`), the strongest
 * knockback is the launch and the longest hitlag is the victim's freeze.
 */
function hit(
  m: MatchState,
  { a, v, box, damage: base, stale, rage, dir, percent, crouch }: Connection,
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
  v.damage = Math.min(DAMAGE_MAX, v.damage + damage * (m.players.length === 2 ? ONE_V_ONE_DAMAGE : 1));
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric', crouch });
  a.hitlag = lag;
  v.hitlag = again ? Math.max(v.hitlag, lag) : lag;
  if (again && v.launch && v.launch.kb >= kb) return;
  v.launch = { kb, angle: box.angle, dir, setKnockback: (box.wbkb ?? 0) > 0 };
  v.action = isTumble(kb) ? 'tumble' : 'hitstun';
  v.actionFrame = 0;
  v.move = null;
}

function shieldHit({ a, v, box, kind, damage: base, stale, dir }: Connection, again: boolean): void {
  const damage = base * stale;
  const stun = shieldstunFrames(damage, kind);
  const lag = hitlagFrames(damage, { mult: box.hitlag, electric: box.effect === 'electric' });
  a.hitlag = lag;
  v.hitlag = again ? Math.max(v.hitlag, lag) : lag;
  v.shieldHp -= damage * SHIELD_DAMAGE_MULT + (box.shieldDamage ?? 0);
  const away = Math.sign(v.pos.x - a.pos.x) || dir;
  const push = shieldPushback(damage, stun);
  v.kb.x = away * push.defender;
  if (a.ground) a.kb.x = -away * push.attacker;
  v.hitstun = again ? Math.max(v.hitstun, stun) : stun;
  v.action = 'shieldStun';
  v.actionFrame = 0;
}

/**
 * Hitlag is over: launch. DI comes from the victim's stick now. Grounded fighters hit flat (0 or 180 degrees)
 * or downward without tumble slide along the ground in hitstun; tumble spikes into the ground bounce off it.
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
  const flat = l.angle === 0 || l.angle === 180;
  if (!flat && f.kb.y > 0) return leaveGround(x);
  if (!flat && l.tumble) {
    f.kb.y = Math.abs(f.kb.y) * 0.8;
    return leaveGround(x);
  }
  f.kb.y = 0;
  if (f.action === 'tumble') f.action = 'hitstun';
}
