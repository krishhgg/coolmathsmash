import {
  DOWN_FLICK_THRESHOLD,
  HARD_LANDING_AIRTIME,
  HELPLESS_AIR_SPEED,
  LEDGE_INTANGIBILITY,
  LEDGE_MAX_GRABS,
} from './constants';
import { stickY } from './control';
import type { Ctx, FighterState, GroundRef } from './fighter';
import { edgeMaxX, edgeMinX, floorY, type CompiledStage, type Edge } from './stage';
import { approach } from './vec';
import { LAUNCH_DECAY, speedUp } from './combat/formulas';
import { ACTIONS, enterAction } from './actions/registry';

const EPS = 0.001;
/** Movement is split into sub-steps no longer than this, so fast fighters never tunnel through thin geometry. */
const MAX_SUBSTEP = 1.5;

export function ecb(f: FighterState, ctx: Ctx) {
  const h = ctx.s.height * 0.75;
  const w = ctx.s.width / 2;
  return [
    { x: 0, y: 0 },
    { x: 0, y: h },
    { x: -w, y: h / 2 },
    { x: w, y: h / 2 },
  ];
}

export function surfaceY(stage: CompiledStage, g: GroundRef, x: number): number {
  return g.kind === 'platform' ? stage.geo.platforms[g.index]!.y : floorY(stage.edges[g.index]!, x);
}

function surfaceRange(stage: CompiledStage, g: GroundRef): [number, number] {
  if (g.kind === 'platform') {
    const p = stage.geo.platforms[g.index]!;
    return [p.x1, p.x2];
  }
  const e = stage.edges[g.index]!;
  return [edgeMinX(e), edgeMaxX(e)];
}

/** A floor edge of the same solid continuing past `x` on the given side, for walking across connected floors. */
function connectedFloor(stage: CompiledStage, g: GroundRef, x: number): GroundRef | null {
  if (g.kind !== 'solid') return null;
  const from = stage.edges[g.index]!;
  for (const e of stage.edges) {
    if (e === from || e.kind !== 'floor' || e.solid !== from.solid) continue;
    if (x >= edgeMinX(e) - EPS && x <= edgeMaxX(e) + EPS)
      return { kind: 'solid', index: stage.edges.indexOf(e) };
  }
  return null;
}

/** Ground physics: traction, then slide along the surface; walk off or stop at its end. */
export function groundMove(x: Ctx): void {
  const { f, s, stage } = x;
  const action = ACTIONS[f.action]!;
  if (action.friction !== false) f.vel.x = approach(f.vel.x, 0, s.groundFriction);
  f.kb.x = approach(f.kb.x, 0, s.groundFriction);
  const g = f.ground!;
  const nx = f.pos.x + f.vel.x + f.kb.x;
  const [lo, hi] = surfaceRange(stage, g);
  if (nx >= lo && nx <= hi) {
    f.pos.x = nx;
    f.pos.y = surfaceY(stage, g, nx);
    return;
  }
  const next = connectedFloor(stage, g, nx);
  if (next) {
    f.ground = next;
    f.pos.x = nx;
    f.pos.y = surfaceY(stage, next, nx);
    return;
  }
  if ((action.edge ?? 'stop') === 'stop') {
    f.pos.x = nx < lo ? lo : hi;
    f.pos.y = surfaceY(stage, g, f.pos.x);
    f.vel.x = 0;
    f.kb.x = 0;
    return;
  }
  f.pos.x = nx;
  leaveGround(x);
  enterAction(x, 'fall', 0);
}

export function leaveGround(x: Ctx): void {
  const { f } = x;
  f.ground = null;
  f.vel.y = 0;
  f.airFrames = 0;
  f.jumpsUsed = Math.max(f.jumpsUsed, 1);
}

/** Standing on the stage restores jumps, the air dodge and the ledge-grab allowance. */
export function restoreAirOptions(f: FighterState): void {
  f.jumpsUsed = 0;
  f.fastFalling = false;
  f.airDodgeUsed = false;
  f.dropPlatform = -1;
  f.ledgeGrabs = 0;
  f.ledgeFresh = true;
}

export function land(x: Ctx, g: GroundRef): void {
  const { f, s, stage } = x;
  f.ground = g;
  f.pos.y = surfaceY(stage, g, f.pos.x);
  f.vel.y = 0;
  f.kb.y = 0;
  restoreAirOptions(f);
  const action = ACTIONS[f.action]!;
  if (action.land) {
    action.land(x);
  } else {
    f.landingLag = f.airFrames < HARD_LANDING_AIRTIME ? s.softLandingLag : s.hardLandingLag;
    enterAction(x, 'land', 0);
  }
}

function crossing(prev: number, next: number): boolean {
  return prev >= -EPS && next < 0;
}

/**
 * Balloon knockback: during a tumble launch's speed-up, how many frames of trajectory (and hitstun) the fighter
 * covers on this real frame. 1 otherwise.
 */
export function launchTimeScale(f: FighterState): number {
  if (f.speedUpFaf === 0 || f.hitstun <= 0 || f.action !== 'tumble') return 1;
  return speedUp(f.speedUpFaf).steps[f.actionFrame - 1] ?? 1;
}

/** Launch speed shrinks by `amount` along its own direction (Ultimate: 0.051 u/frame). */
function decayKnockback(f: FighterState, amount: number): void {
  const speed = Math.hypot(f.kb.x, f.kb.y);
  const k = speed > amount ? (speed - amount) / speed : 0;
  f.kb.x *= k;
  f.kb.y *= k;
}

/** Air physics: drift, sub-stepped movement with landing/wall/ceiling collision, gravity, ledge grabs. */
export function airMove(x: Ctx): void {
  const { f, s } = x;
  const action = ACTIONS[f.action]!;
  f.airFrames++;
  const drift = typeof action.drift === 'function' ? action.drift(x) : (action.drift ?? true);
  if (drift) airDrift(x, drift === 'helpless' ? s.airSpeed * HELPLESS_AIR_SPEED : s.airSpeed);
  const dt = launchTimeScale(f);
  const dx = (f.vel.x + f.kb.x) * dt;
  const dy = (f.vel.y + f.kb.y) * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP));
  for (let i = 0; i < steps; i++) {
    const prev = { x: f.pos.x, y: f.pos.y };
    f.pos.x += dx / steps;
    f.pos.y += dy / steps;
    const landed = collide(x, prev);
    if (landed) {
      land(x, landed);
      return;
    }
  }
  decayKnockback(f, LAUNCH_DECAY * dt);
  const gravity = typeof action.gravity === 'function' ? action.gravity(x) : (action.gravity ?? true);
  if (gravity) {
    f.vel.y = Math.max(f.vel.y - s.gravity * dt, -s.fallSpeed);
    if (f.fastFalling) f.vel.y = -s.fastFallSpeed;
  }
  tryLedgeGrab(x);
}

export function airDrift(x: Ctx, maxSpeed: number): void {
  const { f, s, c } = x;
  const sx = c.cur.x / 100;
  const ax = Math.abs(sx) < 0.2 ? 0 : sx;
  if (ax === 0) {
    f.vel.x = approach(f.vel.x, 0, s.airFriction);
    return;
  }
  const target = ax * maxSpeed;
  const accel = s.airAccelBase + s.airAccelAdd * Math.abs(ax);
  if (Math.abs(f.vel.x) > maxSpeed && Math.sign(f.vel.x) === Math.sign(ax)) {
    f.vel.x = approach(f.vel.x, Math.sign(f.vel.x) * maxSpeed, s.airFriction);
  } else {
    f.vel.x = approach(f.vel.x, target, accel);
  }
}

/** Resolve the ECB against the stage after one sub-step. Returns the surface landed on, if any. */
function collide(x: Ctx, prev: { x: number; y: number }): GroundRef | null {
  const { f, stage } = x;
  const movingDown = f.vel.y + f.kb.y <= 0;
  for (const e of stage.edges) {
    if (e.kind !== 'floor' || !movingDown) continue;
    if (f.pos.x < edgeMinX(e) - EPS || f.pos.x > edgeMaxX(e) + EPS) continue;
    const yNow = floorY(e, f.pos.x);
    const yPrev = floorY(e, Math.min(Math.max(prev.x, edgeMinX(e)), edgeMaxX(e)));
    if (crossing(prev.y - yPrev, f.pos.y - yNow)) return { kind: 'solid', index: stage.edges.indexOf(e) };
  }
  if (movingDown) {
    const passing = stickY(x.c) <= -DOWN_FLICK_THRESHOLD;
    for (let i = 0; i < stage.geo.platforms.length; i++) {
      const p = stage.geo.platforms[i]!;
      if (i === x.f.dropPlatform) {
        if (f.pos.y < p.y - 1) f.dropPlatform = -1;
        continue;
      }
      if (passing || f.pos.x < p.x1 || f.pos.x > p.x2) continue;
      if (crossing(prev.y - p.y, f.pos.y - p.y)) return { kind: 'platform', index: i };
    }
  }
  const box = ecb(f, x);
  for (const e of stage.edges) {
    if (e.kind === 'floor') continue;
    pushOut(f, prev, e, box);
  }
  return null;
}

function pushOut(
  f: FighterState,
  prev: { x: number; y: number },
  e: Edge,
  box: { x: number; y: number }[],
): void {
  let support = box[0]!;
  let best = Infinity;
  for (const v of box) {
    const d = v.x * e.n.x + v.y * e.n.y;
    if (d < best) {
      best = d;
      support = v;
    }
  }
  const px = f.pos.x + support.x;
  const py = f.pos.y + support.y;
  const dNow = (px - e.a.x) * e.n.x + (py - e.a.y) * e.n.y;
  const dPrev = (prev.x + support.x - e.a.x) * e.n.x + (prev.y + support.y - e.a.y) * e.n.y;
  if (!crossing(dPrev, dNow)) return;
  const ex = e.b.x - e.a.x;
  const ey = e.b.y - e.a.y;
  const t = ((px - e.a.x) * ex + (py - e.a.y) * ey) / (ex * ex + ey * ey);
  if (t < -0.05 || t > 1.05) return;
  f.pos.x += e.n.x * (-dNow + EPS);
  f.pos.y += e.n.y * (-dNow + EPS);
  const into = (v: { x: number; y: number }) => {
    const d = v.x * e.n.x + v.y * e.n.y;
    if (d < 0) {
      v.x -= d * e.n.x;
      v.y -= d * e.n.y;
    }
  };
  into(f.vel);
  into(f.kb);
}

/** Hands-near-ledge check while airborne and falling (or in an action that may grab while rising). */
export function tryLedgeGrab(x: Ctx): void {
  const { f, s, m, stage, c } = x;
  const action = ACTIONS[f.action]!;
  const rule = typeof action.ledge === 'function' ? action.ledge(x) : (action.ledge ?? false);
  const allowed = rule === true || (typeof rule === 'number' && f.actionFrame >= rule);
  if (!allowed || f.ledgeLock > 0 || f.ledgeGrabs >= LEDGE_MAX_GRABS) return;
  if (rule === true && f.vel.y + f.kb.y > 0) return;
  if (stickY(c) <= -0.5) return;
  const reach = s.width / 2 + 4;
  for (let i = 0; i < stage.geo.ledges.length; i++) {
    const L = stage.geo.ledges[i]!;
    if ((f.pos.x - L.x) * L.side < -1) continue;
    const rx = (L.x - f.pos.x) * f.facing;
    const ry = L.y - f.pos.y;
    const frontReach = rx >= 0 ? reach : reach * 0.6;
    if (Math.abs(rx) > frontReach || ry < s.height * 0.4 || ry > s.height * 1.15) continue;
    const holder = m.fighters.find((o) => o !== f && o.ledge === i && o.action.startsWith('ledge'));
    if (holder) {
      holder.ledge = -1;
      holder.ledgeLock = 30;
      holder.intangible = 0;
      holder.vel.x = L.side * 0.5;
      holder.vel.y = 0;
      holder.action = 'fall';
      holder.actionFrame = 0;
    }
    grabLedge(x, i);
    return;
  }
}

export function grabLedge(x: Ctx, i: number): void {
  const { f, stage } = x;
  const L = stage.geo.ledges[i]!;
  f.ledge = i;
  f.ledgeGrabs++;
  f.facing = -L.side as 1 | -1;
  f.vel.x = f.vel.y = f.kb.x = f.kb.y = 0;
  f.fastFalling = false;
  f.jumpsUsed = 0;
  f.airDodgeUsed = false;
  f.intangible = f.ledgeFresh ? LEDGE_INTANGIBILITY : 0;
  f.ledgeFresh = false;
  hangAt(x);
  enterAction(x, 'ledgeCatch', 0);
}

/** Position of a fighter hanging from its ledge: hands at the corner, body against the wall. */
export function hangPos(x: Ctx): { x: number; y: number } {
  const L = x.stage.geo.ledges[x.f.ledge]!;
  return { x: L.x + L.side * (x.s.width / 2 + 0.5), y: L.y - x.s.height * 0.85 };
}

export function hangAt(x: Ctx): void {
  const p = hangPos(x);
  x.f.pos.x = p.x;
  x.f.pos.y = p.y;
}

/** The solid floor under `px` at the ledge's height, for getups that end standing on stage. */
export function floorAt(stage: CompiledStage, px: number, py: number): GroundRef | null {
  for (let i = 0; i < stage.edges.length; i++) {
    const e = stage.edges[i]!;
    if (e.kind !== 'floor' || px < edgeMinX(e) || px > edgeMaxX(e)) continue;
    if (Math.abs(floorY(e, px) - py) < 1) return { kind: 'solid', index: i };
  }
  return null;
}
