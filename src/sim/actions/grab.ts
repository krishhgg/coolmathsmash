import { getFighter } from '../../fighters/registry';
import { Btn, type InputFrame } from '../../input/types';
import { grabHoldFrames, hitlagFrames } from '../combat/formulas';
import { activeHitboxes, addDamage, applyHit, hittable, hurtbox, touches } from '../combat/hits';
import { DIRECTION_THRESHOLD, GRAB } from '../constants';
import {
  buffered,
  consume,
  consumeCStick,
  cStickDir,
  isHeld,
  stickDir,
  type ControlState,
  type Dir,
} from '../control';
import type { Ctx, FighterState } from '../fighter';
import type { MatchState } from '../match';
import { restoreAirOptions } from '../movement';
import { moveOf, playMove, startMove } from './attack';
import { setAction, type ActionDef } from './registry';

/**
 * Grabs, pummels and throws, Ultimate style. A grab is a grounded move whose grab boxes (HitboxDef.grab) catch a
 * fighter in front of the grabber: the grabber goes into grabHold, the victim into grabbed, held in front of him
 * until he pummels or throws, or the hold runs out. Everything that involves two fighters at once is resolved in
 * resolveGrabs, inside resolveHits after every fighter has stepped, so the result never depends on port order.
 */

/** Actions of a fighter holding someone. */
const HOLDING = new Set(['grabHold', 'grabPummel', 'grabThrow']);
const THROWS: Record<Exclude<Dir, 'neutral'>, string> = {
  forward: 'fthrow',
  back: 'bthrow',
  up: 'uthrow',
  down: 'dthrow',
};
const MASH_BUTTONS = [Btn.Attack, Btn.Special, Btn.Jump, Btn.Shield, Btn.Grab];

/** Grab, or Attack while Shield is held (Smash's shield + attack). */
const grabInput = (c: ControlState) =>
  buffered(c, Btn.Grab) || (buffered(c, Btn.Attack) && isHeld(c, Btn.Shield));

function startGrab(x: Ctx, name: string): boolean {
  if (!x.def.moves?.[name]) return false;
  consume(x.c, Btn.Grab);
  consume(x.c, Btn.Attack);
  return startMove(x, name);
}

/**
 * Grounded grab input: a standing grab, or out of a dash or run a dash grab, or with the stick held back a pivot
 * grab, which turns around first and keeps sliding the old way.
 */
export function groundGrab(x: Ctx): boolean {
  const { f, c } = x;
  if (!grabInput(c)) return false;
  if (f.action !== 'dash' && f.action !== 'run') return startGrab(x, 'grab');
  if (stickDir(c, f.facing) !== 'back' || !x.def.moves?.pivotGrab) return startGrab(x, 'dashGrab');
  f.facing = -f.facing as 1 | -1;
  return startGrab(x, 'pivotGrab');
}

/** Shield grab: the standing grab out of a held shield, from GRAB.shieldGrabLock frames after shieldstun ends. */
export function shieldGrab(x: Ctx): boolean {
  return x.m.frame >= x.f.shieldGrabFrom && grabInput(x.c) && startGrab(x, 'grab');
}

/** The stick's direction for mashing: 0 in the dead zone, else 1-4 for right, left, up, down. */
function mashDir(i: InputFrame): number {
  const x = i.x / 100;
  const y = i.y / 100;
  if (Math.max(Math.abs(x), Math.abs(y)) < DIRECTION_THRESHOLD) return 0;
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? 3 : 4;
  return x > 0 ? 1 : 2;
}

export const GRAB_ACTIONS: Record<string, ActionDef> = {
  /** Holding someone: any stick or C-stick direction throws that way, Attack or Grab pummels. */
  grabHold: {
    physics: 'ground',
    update(x) {
      const { f, c } = x;
      if (f.grabPartner < 0) return setAction(x, 'idle');
      const cDir = cStickDir(c, f.facing);
      if (cDir !== 'neutral') consumeCStick(c);
      const dir = cDir !== 'neutral' ? cDir : stickDir(c, f.facing);
      if (dir !== 'neutral' && startMove(x, THROWS[dir], 'grabThrow')) return;
      if (!buffered(c, Btn.Attack) && !buffered(c, Btn.Grab)) return;
      consume(c, Btn.Attack);
      consume(c, Btn.Grab);
      startMove(x, 'pummel', 'grabPummel');
    },
  },

  /** A pummel; its hit lands in resolveGrabs. Back to holding on its first actionable frame. */
  grabPummel: {
    physics: 'ground',
    update(x) {
      if (x.f.actionFrame >= playMove(x).faf) setAction(x, 'grabHold');
    },
  },

  /** A throw: invincible until it lets go on its release frame (resolveGrabs), as in Ultimate. */
  grabThrow: {
    physics: 'ground',
    intangible: (f) => f.grabPartner >= 0,
    update(x) {
      if (x.f.actionFrame >= playMove(x).faf) setAction(x, 'idle');
    },
  },

  /** Held: no control. Each new stick direction and each button press cuts the hold time. */
  grabbed: {
    physics: 'none',
    update(x) {
      const { f, c } = x;
      let mash = 0;
      for (const b of MASH_BUTTONS) {
        if (!buffered(c, b)) continue;
        consume(c, b);
        mash += GRAB.mashButton;
      }
      const dir = mashDir(c.cur);
      if (dir !== 0 && dir !== mashDir(c.prev)) mash += GRAB.mashStick;
      f.grabTimer -= 1 + mash;
    },
  },

  /** Pushed apart after a grab that ended without a throw. */
  grabRelease: {
    physics: 'ground',
    edge: 'fall',
    update(x) {
      if (x.f.actionFrame > GRAB.releaseLag) setAction(x, 'idle');
    },
  },
};

export interface GrabContact {
  a: FighterState;
  v: FighterState;
}

function grabbable(m: MatchState, v: FighterState): boolean {
  return (
    hittable(v) &&
    v.action !== 'grabbed' &&
    !HOLDING.has(v.action) &&
    v.ledge < 0 &&
    m.frame >= v.grabbableFrom
  );
}

/**
 * Every active grab box's catch this frame, from the state before any hit lands: the nearest grabbable fighter in
 * front of the grabber that a box touches (boxes are half size against airborne fighters; ties go to the lower
 * port).
 */
export function findGrabs(m: MatchState): GrabContact[] {
  const contacts: GrabContact[] = [];
  for (const a of m.fighters) {
    if (a.hitlag > 0) continue;
    const boxes = activeHitboxes(a).filter((h) => h.box.grab);
    if (boxes.length === 0) continue;
    let best: FighterState | null = null;
    for (const v of m.fighters) {
      if (v === a || !grabbable(m, v) || (v.pos.x - a.pos.x) * a.facing < 0) continue;
      const body = hurtbox(v, getFighter(v.fighter).stats);
      const scale = v.ground ? 1 : GRAB.airborneRadius;
      if (!boxes.some((h) => touches({ ...h, box: { ...h.box, radius: h.box.radius * scale } }, body)))
        continue;
      if (!best || Math.abs(v.pos.x - a.pos.x) < Math.abs(best.pos.x - a.pos.x)) best = v;
    }
    if (best) contacts.push({ a, v: best });
  }
  return contacts;
}

/**
 * Grab interactions, after the frame's hits (resolveHits calls this). In order: pummels and throws land on their
 * frame; held fighters whose hold ran out break free (not once a throw has started); new grabs connect; held
 * fighters move to their holder's hands. New grabs go in port order: two fighters grabbing each other clank (both
 * go into grab release and take GRAB.clankDamage), a fighter caught by two grabs goes to the lower port, and a
 * fighter struck by a hit this frame neither grabs nor is grabbed, so attacks beat grabs.
 */
export function resolveGrabs(m: MatchState, contacts: GrabContact[], struck: Set<FighterState>): void {
  for (const a of m.fighters) heldHit(m, a, struck.has(m.fighters[a.grabPartner]!));
  for (const v of m.fighters) if (v.action === 'grabbed') holdRunsOut(m, v);
  const taken = new Set<FighterState>();
  for (const { a, v } of contacts) {
    if (taken.has(a) || taken.has(v) || struck.has(a) || struck.has(v)) continue;
    taken.add(a);
    taken.add(v);
    if (contacts.some((o) => o.a === v && o.v === a)) clank(m, a, v);
    else grab(m, a, v);
  }
  for (const f of m.fighters) {
    if (f.action === 'grabbed') hold(m.fighters[f.grabPartner]!, f);
    if (f.action === 'shieldStun') f.shieldGrabFrom = m.frame + 1 + GRAB.shieldGrabLock;
  }
}

/** A pummel or throw on its frame: pummels deal damage and hitlag only; throws let go and launch. */
function heldHit(m: MatchState, a: FighterState, again: boolean): void {
  const v = m.fighters[a.grabPartner];
  const move = moveOf(a);
  if (!v || !move || v.grabPartner !== a.port || v.action !== 'grabbed') return;
  if (a.action === 'grabPummel' && move.pummel?.frame === a.actionFrame && !a.hitVictims.includes(v.port)) {
    a.hitVictims.push(v.port);
    addDamage(m, v, move.pummel.damage);
    a.hitlag = v.hitlag = hitlagFrames(move.pummel.damage, { mult: move.pummel.hitlag });
  }
  if (a.action === 'grabThrow' && move.throw?.frame === a.actionFrame) {
    a.grabPartner = v.grabPartner = -1;
    if (move.throw.hit.direction === 'back') v.pos.x = 2 * a.pos.x - v.pos.x;
    applyHit(m, a, v, { id: 0, x: 0, y: 0, radius: 0, hitlag: 0, ...move.throw.hit }, again);
  }
}

/** Let a held fighter go when its holder stopped holding it, or when its hold ran out outside a throw. */
function holdRunsOut(m: MatchState, v: FighterState): void {
  const a = m.fighters[v.grabPartner];
  if (!a || a.grabPartner !== v.port || !HOLDING.has(a.action)) return endGrab(m, undefined, v);
  if (a.action === 'grabThrow' || v.actionFrame < GRAB.minHold || v.grabTimer > 0) return;
  endGrab(m, a, v);
}

function toRelease(f: FighterState, dir: number): void {
  Object.assign(f, { action: 'grabRelease', actionFrame: 0, move: null, grabPartner: -1 });
  f.kb.x = dir * GRAB.releaseSpeed;
}

/**
 * End a grab without a throw: both slide apart into grab release, except `launched`, whom a hit is launching
 * instead. The held fighter can't be grabbed again for GRAB.regrabImmunity frames.
 */
function endGrab(
  m: MatchState,
  holder: FighterState | undefined,
  held: FighterState,
  launched?: FighterState,
) {
  const dir = holder ? Math.sign(held.pos.x - holder.pos.x) || holder.facing : -held.facing;
  for (const [f, d] of [
    [holder, -dir],
    [held, dir],
  ] as const) {
    if (!f) continue;
    f.grabPartner = -1;
    if (f !== launched) toRelease(f, d);
  }
  held.grabbableFrom = m.frame + 1 + GRAB.regrabImmunity;
}

/**
 * A hit landing on a fighter in a grab, before it launches (hits.ts). Hitting the holder frees the held fighter
 * into grab release. A held fighter armours through hits from others, taking damage and hitlag only, until they
 * add up to GRAB.breakDamage; then it breaks free and is launched while the holder goes into grab release.
 * False when the hit must not launch.
 */
export function grabHitLaunches(m: MatchState, v: FighterState, damage: number): boolean {
  const partner = m.fighters[v.grabPartner];
  if (!partner || partner.grabPartner !== v.port) return true;
  if (v.action === 'grabbed') {
    v.grabDamage += damage;
    if (v.grabDamage < GRAB.breakDamage) return false;
    endGrab(m, partner, v, v);
  } else if (HOLDING.has(v.action)) {
    endGrab(m, v, partner, v);
  }
  return true;
}

function grab(m: MatchState, a: FighterState, v: FighterState): void {
  Object.assign(a, { action: 'grabHold', actionFrame: 0, move: null, grabPartner: v.port });
  Object.assign(v, {
    action: 'grabbed',
    actionFrame: 0,
    move: null,
    grabPartner: a.port,
    grabTimer: grabHoldFrames(v.damage),
    grabDamage: 0,
    launch: null,
    hitstun: 0,
    speedUpFaf: 0,
    vel: { x: 0, y: 0 },
    kb: { x: 0, y: 0 },
  });
  restoreAirOptions(v);
  const c = m.players[v.port]!.control;
  for (const b of MASH_BUTTONS) consume(c, b);
  consumeCStick(c);
}

/** Ultimate's grab clank: two fighters grabbing each other on the same frame both release and take a little damage. */
function clank(m: MatchState, a: FighterState, v: FighterState): void {
  const dir = Math.sign(v.pos.x - a.pos.x) || a.facing;
  toRelease(a, -dir);
  toRelease(v, dir);
  addDamage(m, a, GRAB.clankDamage);
  addDamage(m, v, GRAB.clankDamage);
}

/** Keep a held fighter just in front of its holder, facing him, on his ground. */
function hold(a: FighterState, v: FighterState): void {
  const reach = (getFighter(a.fighter).stats.width + getFighter(v.fighter).stats.width) / 2 + GRAB.holdGap;
  v.pos.x = a.pos.x + reach * a.facing;
  v.pos.y = a.pos.y;
  v.ground = a.ground;
  v.facing = -a.facing as 1 | -1;
}
