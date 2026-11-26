import { getFighter } from '../../fighters/lookup';
import { Btn, type InputFrame } from '../../input/types';
import { grabHoldFrames, hitlagFrames, isTumble } from '../combat/formulas';
import { activeHitboxes, addDamage, applyHit, hittable, hurtbox, targetable, touches } from '../combat/hits';
import { DIRECTION_THRESHOLD, GRAB } from '../constants';
import { emit } from '../events';
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
import { inHitlag, type Ctx, type FighterState } from '../fighter';
import type { MatchState } from '../match';
import { restoreAirOptions } from '../movement';
import { endStatusesOnHit, isFrozen } from '../statuses';
import { moveOf, playMove, startMove, stopInPlace } from './attack';
import { setAction, type ActionDef } from './registry';
import * as SimMath from '../math';

/**
 * Grabs, pummels and throws, Ultimate style. A grab is a grounded move whose grab boxes (HitboxDef.grab) catch a
 * fighter in front of the grabber: the grabber goes into grabHold, the victim into grabbed, held in front of him
 * until he pummels or throws, or the hold runs out. Everything that involves two fighters at once is resolved in
 * resolveGrabs, inside resolveHits after every fighter has stepped, so the result never depends on port order.
 */

/** Actions of a fighter holding someone. */
const HOLDING = new Set(['grabHold', 'grabPummel', 'grabThrow']);
/** Grabs can't pick up a fighter lying on the floor. */
const LYING = new Set(['downBound', 'down']);
const THROWS: Record<Exclude<Dir, 'neutral'>, string> = {
  forward: 'fthrow',
  back: 'bthrow',
  up: 'uthrow',
  down: 'dthrow',
};
/** Buttons that count as mashing (a grab, a status with StatusDef.mash). */
export const MASH_BUTTONS = [Btn.Attack, Btn.Special, Btn.Jump, Btn.Shield, Btn.Grab];

/** Grab, or Attack while Shield is held (Smash's shield + attack). */
export const grabInput = (c: ControlState) =>
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
export function mashDir(i: InputFrame): number {
  const x = i.x / 100;
  const y = i.y / 100;
  if (Math.max(Math.abs(x), Math.abs(y)) < DIRECTION_THRESHOLD) return 0;
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? 3 : 4;
  return x > 0 ? 1 : 2;
}

/** A Final Smash cinematic with `final.still`: in the air the user holds still through it, as in its activation. */
const stillThrow = (f: FighterState) => moveOf(f)?.final?.still === true;

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
      const move = playMove(x);
      if (move && x.f.actionFrame >= move.faf) setAction(x, 'grabHold');
    },
  },

  /**
   * A throw: invincible until it lets go on its release frame (resolveGrabs), as in Ultimate, and a Final Smash's
   * cinematic to its end. A command grab caught in the air plays its throw in the air, and landing doesn't end it.
   */
  grabThrow: {
    physics: 'ground',
    drift: (x) => !stillThrow(x.f) && (moveOf(x.f)?.drift ?? true),
    gravity: (x) => !stillThrow(x.f),
    intangible: (f) => f.grabPartner >= 0 || moveOf(f)?.final !== undefined,
    update(x) {
      const move = playMove(x);
      if (move && x.f.actionFrame >= move.faf) setAction(x, x.f.ground ? 'idle' : 'fall');
    },
    land() {},
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

  /** Pushed apart after a grab that ended without a throw; pushed off a floor, the recovery goes on in the air. */
  grabRelease: {
    physics: 'ground',
    edge: 'keep',
    update(x) {
      if (x.f.actionFrame > GRAB.releaseLag) setAction(x, x.f.ground ? 'idle' : 'fall');
    },
    land() {},
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
    !LYING.has(v.action) &&
    v.ledge < 0 &&
    m.frame >= v.grabbableFrom
  );
}

/**
 * Every active grab box's catch this frame, from the state before any hit lands: the nearest grabbable fighter in
 * front of the grabber that a box touches (boxes are half size against airborne fighters, except a command grab's;
 * ties go to the lower port).
 */
export function findGrabs(m: MatchState): GrabContact[] {
  const contacts: GrabContact[] = [];
  for (const a of m.fighters) {
    if (inHitlag(m, a) || isFrozen(m, a)) continue;
    const boxes = activeHitboxes(a).filter((h) => h.box.grab);
    if (boxes.length === 0) continue;
    const command = moveOf(a)?.commandGrab !== undefined;
    let best: FighterState | null = null;
    for (const v of m.fighters) {
      if (v === a || !grabbable(m, v) || (v.pos.x - a.pos.x) * a.facing < 0) continue;
      const body = hurtbox(v, getFighter(v.fighter).stats);
      const scale = v.ground || command ? 1 : GRAB.airborneRadius;
      const caught = boxes.some(
        (h) =>
          targetable(h.box, v) && touches({ ...h, box: { ...h.box, radius: h.box.radius * scale } }, body),
      );
      if (!caught) continue;
      if (!best || Math.abs(v.pos.x - a.pos.x) < Math.abs(best.pos.x - a.pos.x)) best = v;
    }
    if (best) contacts.push({ a, v: best });
  }
  return contacts;
}

/**
 * Grab interactions, after the frame's hits (resolveHits calls this). In order: the frame's hits on fighters in a
 * grab break it or not; pummels and throws land on their frame; held fighters whose hold ran out break free (not
 * once a throw has started); new grabs connect; held fighters move to their holder's hands. New grabs go in port order: two fighters grabbing each other clank (both
 * go into grab release and take GRAB.clankDamage), a fighter caught by two grabs goes to the lower port, and a
 * fighter struck by a hit this frame neither grabs nor is grabbed, so attacks beat grabs.
 */
export function resolveGrabs(m: MatchState, contacts: GrabContact[], struck: Set<FighterState>): void {
  for (const v of m.fighters) if (v.action === 'grabbed') grabStruck(m, v, struck);
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

/**
 * A pummel, a throw's hold hit or a throw on its frame: pummels and hold hits deal damage and hitlag only (each
 * lands once, counted in holdHitsLanded, though hitlag holds its frame); throws let go and launch.
 */
function heldHit(m: MatchState, a: FighterState, again: boolean): void {
  const v = m.fighters[a.grabPartner];
  const move = moveOf(a);
  if (!v || !move || v.grabPartner !== a.port || v.action !== 'grabbed') return;
  const holdHits =
    a.action === 'grabPummel' ? [move.pummel] : a.action === 'grabThrow' ? (move.holdHits ?? []) : [];
  const h = holdHits[a.holdHitsLanded];
  if (h?.frame === a.actionFrame) {
    a.holdHitsLanded++;
    const before = v.damage;
    addDamage(m, v, h.damage);
    endStatusesOnHit(m, v);
    a.hitlag = v.hitlag = hitlagFrames(h.damage, { mult: h.hitlag });
    emit(m, { type: 'pummel', attacker: a.port, victim: v.port, damage: v.damage - before });
  }
  if (a.action === 'grabThrow' && move.throw?.frame === a.actionFrame) {
    a.grabPartner = v.grabPartner = -1;
    if (move.throw.hit.direction === 'back') v.pos.x = 2 * a.pos.x - v.pos.x;
    emit(m, { type: 'throw', attacker: a.port, victim: v.port, move: a.move! });
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
 * End a grab without a throw: both slide apart into grab release, except a fighter that a hit is launching this
 * frame. The held fighter can't be grabbed again for GRAB.regrabImmunity frames.
 */
function endGrab(m: MatchState, holder: FighterState | undefined, held: FighterState) {
  const dir = holder ? Math.sign(held.pos.x - holder.pos.x) || holder.facing : -held.facing;
  for (const [f, d] of [
    [holder, -dir],
    [held, dir],
  ] as const) {
    if (!f) continue;
    f.grabPartner = -1;
    if (!f.launch) toRelease(f, d);
  }
  held.grabbableFrom = m.frame + 1 + GRAB.regrabImmunity;
  emit(m, { type: 'grabRelease', holder: holder?.port ?? -1, held: held.port });
}

/**
 * End `f`'s grab from whichever side `f` is on, when the stage takes the ground from under it: both let go as
 * on a release (grabRelease event, regrab immunity for the held fighter). A partner already out of this grab
 * (KO'd, or grabbed by someone else since) is left as it is, as in holdRunsOut; `f` only drops its own link.
 */
export function breakGrab(m: MatchState, f: FighterState): void {
  const partner = m.fighters[f.grabPartner]!;
  const [holder, held] = HOLDING.has(f.action) ? [f, partner] : [partner, f];
  if (held.action !== 'grabbed' || held.grabPartner !== holder.port) {
    f.grabPartner = -1;
    return;
  }
  endGrab(m, HOLDING.has(holder.action) && holder.grabPartner === held.port ? holder : undefined, held);
}

/**
 * A hit landing on a held fighter (hits.ts): its damage counts towards GRAB.breakDamage, and the fighter stays
 * grabbed, its launch only pending, until grabStruck decides after all of the frame's hits. True when `v` is held.
 */
export function grabArmour(m: MatchState, v: FighterState, damage: number): boolean {
  if (v.action !== 'grabbed' || m.fighters[v.grabPartner]?.grabPartner !== v.port) return false;
  v.grabDamage += damage;
  return true;
}

/**
 * This frame's hits on a grab, judged from the grab as it stood before any of them landed, so port order never
 * changes the outcome. A held fighter armours through hits from others, taking damage and hitlag only, until they
 * add up to GRAB.breakDamage; then it breaks free and takes the strongest of the frame's launches. Hitting the
 * holder launches him and frees the held fighter into grab release.
 */
function grabStruck(m: MatchState, v: FighterState, struck: Set<FighterState>): void {
  const a = m.fighters[v.grabPartner];
  if (!a || a.grabPartner !== v.port || (!struck.has(v) && !struck.has(a))) return;
  const breaks = v.launch !== null && v.grabDamage >= GRAB.breakDamage;
  if (breaks)
    Object.assign(v, { action: isTumble(v.launch!.kb) ? 'tumble' : 'hitstun', actionFrame: 0, move: null });
  else v.launch = null;
  if (breaks || struck.has(a)) endGrab(m, a, v);
}

/** A catch: into the grab hold, or for a command grab straight into its throw. */
function grab(m: MatchState, a: FighterState, v: FighterState): void {
  const command = moveOf(a)?.commandGrab;
  emit(m, { type: command ? 'commandGrab' : 'grab', attacker: a.port, victim: v.port, move: a.move! });
  Object.assign(a, {
    action: command ? 'grabThrow' : 'grabHold',
    actionFrame: 0,
    move: command ?? null,
    grabPartner: v.port,
    hitVictims: [],
    holdHitsLanded: 0,
    moveStale: 0,
    bReverseFrom: -1,
  });
  Object.assign(v, {
    action: 'grabbed',
    actionFrame: 0,
    move: null,
    grabPartner: a.port,
    grabTimer: grabHoldFrames(v.damage),
    grabDamage: 0,
    launch: null,
    launchMotion: null,
    hitstun: 0,
    speedUpFaf: 0,
    vel: { x: 0, y: 0 },
    kb: { x: 0, y: 0 },
  });
  if (stillThrow(a) && !a.ground) stopInPlace(a);
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
  emit(m, { type: 'grabClank', ports: [a.port, v.port] });
}

/**
 * Keep a held fighter just in front of its holder, facing him, on his ground. A throw with `pull` draws it there
 * from where it was caught instead, `pull` units a frame in a straight line, off the ground until it arrives.
 */
function hold(a: FighterState, v: FighterState): void {
  const reach = (getFighter(a.fighter).stats.width + getFighter(v.fighter).stats.width) / 2 + GRAB.holdGap;
  const to = { x: a.pos.x + reach * a.facing, y: a.pos.y };
  const pull = a.action === 'grabThrow' ? moveOf(a)?.pull : undefined;
  const gap = SimMath.hypot(to.x - v.pos.x, to.y - v.pos.y);
  v.facing = -a.facing as 1 | -1;
  if (pull !== undefined && gap > pull) {
    v.pos.x += ((to.x - v.pos.x) * pull) / gap;
    v.pos.y += ((to.y - v.pos.y) * pull) / gap;
    v.ground = null;
    return;
  }
  v.pos.x = to.x;
  v.pos.y = to.y;
  v.ground = a.ground;
}
