import {
  HARD_LANDING_AIRTIME,
  HELPLESS_AIR_SPEED,
  LEDGE_MAX_GRABS,
  PLATFORM_DROP_FLICK,
  PUSH_STIFFNESS,
} from './constants';
import { stickY } from './control';
import { getFighter } from '../fighters/registry';
import type { FighterStats } from '../fighters/types';
import { resetMobility } from './mobility';
import { inHitlag, type Ctx, type FighterState, type GroundRef } from './fighter';
import { emit } from './events';
import type { MatchState } from './match';
import { edgeMaxX, edgeMinX, floorY, ledgePresent, type CompiledStage, type Edge } from './stage';
import { isFrozen } from './statuses';
import { approach, type Vec } from './vec';
import {
  DAMAGE_FLY_TOP_GRAVITY,
  LAUNCH_DECAY,
  ledgeIntangibility,
  speedUp,
  VERTICAL_LAUNCH_FALL_SPEED,
} from './combat/formulas';
import { breakGrab } from './actions/grab';
import { actionDef, enterAction } from './actions/registry';

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

export function surfaceRange(stage: CompiledStage, g: GroundRef): [number, number] {
  if (g.kind === 'platform') {
    const p = stage.geo.platforms[g.index]!;
    return [p.x1, p.x2];
  }
  const e = stage.edges[g.index]!;
  return [edgeMinX(e), edgeMaxX(e)];
}

/**
 * A floor continuing past `x`, for walking across connected floors: another floor of the same solid, or a floor
 * of another solid that meets this one's end at the same height (a trapdoor set into the stage).
 */
function connectedFloor(stage: CompiledStage, g: GroundRef, x: number): GroundRef | null {
  if (g.kind !== 'solid') return null;
  const from = stage.edges[g.index]!;
  const end = x < edgeMinX(from) ? edgeMinX(from) : edgeMaxX(from);
  for (let i = 0; i < stage.edges.length; i++) {
    const e = stage.edges[i]!;
    if (i === g.index || e.kind !== 'floor' || !stage.present.solids[e.solid]) continue;
    if (x < edgeMinX(e) - EPS || x > edgeMaxX(e) + EPS) continue;
    const meets =
      end >= edgeMinX(e) - EPS &&
      end <= edgeMaxX(e) + EPS &&
      Math.abs(floorY(e, end) - floorY(from, end)) < EPS;
    if (e.solid === from.solid || meets) return { kind: 'solid', index: i };
  }
  return null;
}

/** Speed of the conveyor belt a grounded fighter stands on: 0 off a belt, or with hazards off. */
export function conveyorSpeed(x: Ctx, g: GroundRef): number {
  if (x.m.config.hazards === false) return 0;
  const geo = x.stage.geo;
  const piece = g.kind === 'platform' ? geo.platforms[g.index]! : geo.solids[x.stage.edges[g.index]!.solid]!;
  return piece.conveyor ?? 0;
}

/** Ground physics: traction, then slide along the surface (and a conveyor belt); walk off or stop at its end. */
export function groundMove(x: Ctx): void {
  const { f, s, stage } = x;
  const action = actionDef(f);
  if (action.friction !== false) f.vel.x = approach(f.vel.x, 0, s.groundFriction);
  f.kb.x = approach(f.kb.x, 0, s.groundFriction);
  const g = f.ground!;
  const belt = conveyorSpeed(x, g);
  const nx = f.pos.x + f.vel.x + f.kb.x + belt;
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
  if ((action.edge ?? 'stop') === 'stop' && Math.sign(belt) !== (nx < lo ? -1 : 1)) {
    f.pos.x = nx < lo ? lo : hi;
    f.pos.y = surfaceY(stage, g, f.pos.x);
    f.vel.x = 0;
    f.kb.x = 0;
    return;
  }
  f.pos.x = nx;
  if (f.grabPartner >= 0) breakGrab(x.m, f);
  leaveGround(x);
  // As when the stage takes the surface away (movingStage.ts loseGround), hitstun carries on in the air.
  if (action.edge !== 'keep' && f.action !== 'hitstun') enterAction(x, 'fall', 0);
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
  resetMobility(f.mobility);
}

export function land(x: Ctx, g: GroundRef): void {
  const { f, stage } = x;
  f.ground = g;
  f.pos.y = surfaceY(stage, g, f.pos.x);
  restoreAirOptions(f);
  const action = actionDef(f);
  if (action.land) {
    action.land(x);
  } else {
    f.landingLag = normalLandingLag(x);
    enterAction(x, 'land', 0);
  }
  f.vel.y = 0;
  f.kb.y = 0;
  emit(x.m, { type: 'land', port: f.port, lag: f.action === 'land' ? f.landingLag : 0 });
}

/**
 * Grounded fighters standing in each other push apart (Ultimate's jostle), each by PUSH_STIFFNESS of the
 * overlap per frame, and never off the surface they stand on. Fighters frozen in hitlag aren't pushed.
 */
export function pushApart(m: MatchState, stage: CompiledStage): void {
  const fs = m.fighters;
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i]!;
      const b = fs[j]!;
      if (!a.ground || !b.ground || Math.abs(a.pos.y - b.pos.y) > 1) continue;
      if (inHitlag(m, a) || inHitlag(m, b) || isFrozen(m, a) || isFrozen(m, b)) continue;
      const reach = (getFighter(a.fighter).stats.width + getFighter(b.fighter).stats.width) / 2;
      const dx = b.pos.x - a.pos.x;
      const overlap = reach - Math.abs(dx);
      if (overlap <= 0) continue;
      const side = Math.sign(dx) || 1;
      shove(stage, a, -side * overlap * PUSH_STIFFNESS);
      shove(stage, b, side * overlap * PUSH_STIFFNESS);
    }
  }
}

function shove(stage: CompiledStage, f: FighterState, dx: number): void {
  const g = f.ground!;
  const [lo, hi] = surfaceRange(stage, g);
  f.pos.x = Math.min(hi, Math.max(lo, f.pos.x + dx));
  f.pos.y = surfaceY(stage, g, f.pos.x);
}

/** Soft landing lag after a short airtime, hard landing lag after a longer one. */
export function normalLandingLag(x: Ctx): number {
  return x.f.airFrames < HARD_LANDING_AIRTIME ? x.s.softLandingLag : x.s.hardLandingLag;
}

export function crossing(prev: number, next: number): boolean {
  return prev >= -EPS && next < 0;
}

/**
 * Balloon knockback: during a tumble launch's speed-up, how many frames of trajectory (and hitstun) the fighter
 * covers on this real frame. 1 otherwise.
 */
export function launchTimeScale(f: FighterState): number {
  if (f.speedUpFaf === 0 || f.hitstun <= 0 || (f.action !== 'tumble' && f.action !== 'hitstun')) return 1;
  return speedUp(f.speedUpFaf).steps[f.actionFrame - 1] ?? 1;
}

/** Launch speed shrinks by `amount` along its own direction (Ultimate: 0.051 u/frame). */
function decayKnockback(kb: Vec, amount: number): void {
  const speed = Math.hypot(kb.x, kb.y);
  const k = speed > amount ? (speed - amount) / speed : 0;
  kb.x *= k;
  kb.y *= k;
}

/**
 * Gravity on the fighter's own vertical speed over `t` frames. A near-vertical tumble launch falls with the fighter's
 * DamageFlyTop gravity, capped at 1.8, during hitstun; afterwards a fall faster than the fighter's own fall speed
 * eases back to it by its gravity each frame (as SSBU-Calculator's launch simulation does).
 */
function fallStep(f: FighterState, s: FighterStats, vy: number, t: number): number {
  if (f.flyTop && f.hitstun > 0) {
    return Math.max(vy - (s.damageFlyTopGravity ?? DAMAGE_FLY_TOP_GRAVITY) * t, -VERTICAL_LAUNCH_FALL_SPEED);
  }
  if (f.flyTop && vy < -s.fallSpeed) return Math.min(vy + s.gravity * t, -s.fallSpeed);
  return Math.max(vy - s.gravity * t, -s.fallSpeed);
}

/**
 * Advances `vel` and `kb` through `scale` frames of launch decay and gravity (whole frames, then the fraction) and
 * returns the distance they cover.
 */
function integrate(f: FighterState, s: FighterStats, vel: Vec, kb: Vec, gravity: boolean, scale: number) {
  let dx = 0;
  let dy = 0;
  for (let left = scale; left > 0; left--) {
    const t = Math.min(1, left);
    dx += (vel.x + kb.x) * t;
    dy += (vel.y + kb.y) * t;
    decayKnockback(kb, LAUNCH_DECAY * t);
    if (gravity) vel.y = fallStep(f, s, vel.y, t);
  }
  return { dx, dy };
}

/** Air physics: drift, sub-stepped movement with landing/wall/ceiling collision, gravity, ledge grabs. */
export function airMove(x: Ctx): void {
  const { f, s } = x;
  const action = actionDef(f);
  f.airFrames++;
  const drift = typeof action.drift === 'function' ? action.drift(x) : (action.drift ?? true);
  if (drift) airDrift(x, drift === 'helpless' ? s.airSpeed * HELPLESS_AIR_SPEED : s.airSpeed);
  const gravity = typeof action.gravity === 'function' ? action.gravity(x) : (action.gravity ?? true);
  const scale = launchTimeScale(f);
  const { dx, dy } = integrate(f, s, { ...f.vel }, { ...f.kb }, gravity, scale);
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
  integrate(f, s, f.vel, f.kb, gravity, scale);
  if (gravity && f.fastFalling) f.vel.y = -s.fastFallSpeed;
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
    if (e.kind !== 'floor' || !movingDown || !stage.present.solids[e.solid]) continue;
    if (f.pos.x < edgeMinX(e) - EPS || f.pos.x > edgeMaxX(e) + EPS) continue;
    const yNow = floorY(e, f.pos.x);
    const yPrev = floorY(e, Math.min(Math.max(prev.x, edgeMinX(e)), edgeMaxX(e)));
    if (crossing(prev.y - yPrev, f.pos.y - yNow)) return { kind: 'solid', index: stage.edges.indexOf(e) };
  }
  if (movingDown) {
    const move = f.move ? getFighter(f.fighter).moves?.[f.move] : undefined;
    const passing = stickY(x.c) <= -PLATFORM_DROP_FLICK.stick && move?.fallThrough !== false;
    for (let i = 0; i < stage.geo.platforms.length; i++) {
      const p = stage.geo.platforms[i]!;
      if (!stage.present.platforms[i]) continue;
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
    if (e.kind === 'floor' || !stage.present.solids[e.solid]) continue;
    pushOut(f, prev, e, box);
  }
  for (const e of stage.edges) {
    if (e.corner && stage.present.solids[e.solid]) pushOffCorner(f, prev, e, box);
  }
  return null;
}

/** The collision box's sides as [from, to] indices into ecb(), counter-clockwise: feet, right, top, left. */
const BOX_SIDES = [
  [0, 3],
  [3, 1],
  [1, 2],
  [2, 0],
] as const;

/**
 * Push the ECB off the stage corner at the start of edge `e` if the corner came into the diamond since `prev`,
 * removing velocity into it. True if it did. pushOut only checks the diamond's points against edges, so without
 * this a fighter rising or drifting past a corner (a side wall meeting the underside, a ledge) takes the corner
 * into its box, ends up inside the solid and rises out through its floor. Ultimate's ECB diamond keeps out of
 * solid ground as a shape: rising into the underside the fighter stops or slides along it, never into it.
 *
 * The corner came in if it is inside the diamond now and was not at `prev`, or if its path crossed one of the
 * diamond's sides (past a narrow tip of the diamond it can cross in and out within one sub-step). The push is the
 * shallowest one back through such a side that moves the fighter in a direction between the outward normals of
 * the corner's two edges. A side whose push points into either edge is a diamond point against that edge
 * instead, which pushOut handles.
 */
export function pushOffCorner(f: FighterState, prev: { x: number; y: number }, e: Edge, box: Vec[]): boolean {
  const n1 = e.corner!;
  const n2 = e.n;
  const turn = n1.x * n2.y - n1.y * n2.x;
  // The corner relative to the fighter now and at `prev`.
  const now = { x: e.a.x - f.pos.x, y: e.a.y - f.pos.y };
  const was = { x: e.a.x - prev.x, y: e.a.y - prev.y };
  // Most corners are nowhere near: skip them unless the corner's path overlaps the box's bounds.
  let [left, right, bottom, top] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const v of box) {
    left = Math.min(left, v.x);
    right = Math.max(right, v.x);
    bottom = Math.min(bottom, v.y);
    top = Math.max(top, v.y);
  }
  const far =
    Math.max(now.x, was.x) < left ||
    Math.min(now.x, was.x) > right ||
    Math.max(now.y, was.y) < bottom ||
    Math.min(now.y, was.y) > top;
  if (far) return false;
  const dNow: number[] = [];
  const dPrev: number[] = [];
  const normals: Vec[] = [];
  for (const [i, j] of BOX_SIDES) {
    const p = box[i]!;
    const q = box[j]!;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const n = { x: (q.y - p.y) / len, y: (p.x - q.x) / len };
    normals.push(n);
    dNow.push((now.x - p.x) * n.x + (now.y - p.y) * n.y);
    dPrev.push((was.x - p.x) * n.x + (was.y - p.y) * n.y);
  }
  const entered = dNow.every((d) => d < 0) && dPrev.some((d) => d >= -EPS);
  let side: Vec | null = null;
  let depth = Infinity;
  for (let k = 0; k < BOX_SIDES.length; k++) {
    const n = normals[k]!;
    if (dNow[k]! >= 0 || -dNow[k]! >= depth) continue;
    // The fighter moves along -n: it must lie between n1 and n2.
    if ((n1.x * -n.y + n1.y * n.x) * turn < -EPS || (-n.x * n2.y + n.y * n2.x) * turn < -EPS) continue;
    if (!entered) {
      if (dPrev[k]! < -EPS) continue;
      // Where the corner crossed the side's line: on the side itself, or past the diamond's end of it.
      const s = dPrev[k]! > 0 ? dPrev[k]! / (dPrev[k]! - dNow[k]!) : 0;
      const p = box[BOX_SIDES[k]![0]]!;
      const q = box[BOX_SIDES[k]![1]]!;
      const cx = was.x + (now.x - was.x) * s - p.x;
      const cy = was.y + (now.y - was.y) * s - p.y;
      const u = (cx * (q.x - p.x) + cy * (q.y - p.y)) / ((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
      if (u < 0 || u > 1) continue;
    }
    side = n;
    depth = -dNow[k]!;
  }
  if (!side) return false;
  f.pos.x -= side.x * (depth + EPS);
  f.pos.y -= side.y * (depth + EPS);
  const into = (v: Vec) => {
    const d = v.x * side.x + v.y * side.y;
    if (d > 0) {
      v.x -= d * side.x;
      v.y -= d * side.y;
    }
  };
  into(f.vel);
  into(f.kb);
  return true;
}

/**
 * Push the ECB back out through edge `e` if any of its points crossed the edge since `prev`, by the deepest one,
 * removing velocity into it. True if it did. Every point counts: the one deepest past the edge's line can be past
 * the edge's end (beside a corner) while another crosses the edge itself.
 */
export function pushOut(
  f: FighterState,
  prev: { x: number; y: number },
  e: Edge,
  box: { x: number; y: number }[],
): boolean {
  const ex = e.b.x - e.a.x;
  const ey = e.b.y - e.a.y;
  let depth = 0;
  for (const v of box) {
    const px = f.pos.x + v.x;
    const py = f.pos.y + v.y;
    const dNow = (px - e.a.x) * e.n.x + (py - e.a.y) * e.n.y;
    const dPrev = (prev.x + v.x - e.a.x) * e.n.x + (prev.y + v.y - e.a.y) * e.n.y;
    if (!crossing(dPrev, dNow) || -dNow <= depth) continue;
    // Where along the edge the point crossed its line, not where it ended up.
    const k = dPrev > 0 ? dPrev / (dPrev - dNow) : 0;
    const cx = px + (prev.x - f.pos.x) * (1 - k);
    const cy = py + (prev.y - f.pos.y) * (1 - k);
    const t = ((cx - e.a.x) * ex + (cy - e.a.y) * ey) / (ex * ex + ey * ey);
    if (t >= e.span[0] && t <= e.span[1]) depth = -dNow;
  }
  if (depth === 0) return false;
  f.pos.x += e.n.x * (depth + EPS);
  f.pos.y += e.n.y * (depth + EPS);
  const into = (v: { x: number; y: number }) => {
    const d = v.x * e.n.x + v.y * e.n.y;
    if (d < 0) {
      v.x -= d * e.n.x;
      v.y -= d * e.n.y;
    }
  };
  into(f.vel);
  into(f.kb);
  return true;
}

/** Hands-near-ledge check while airborne and falling (or in an action that may grab while rising). */
export function tryLedgeGrab(x: Ctx): void {
  const { f, s, m, stage, c } = x;
  const action = actionDef(f);
  const rule = typeof action.ledge === 'function' ? action.ledge(x) : (action.ledge ?? false);
  const allowed = rule === true || (typeof rule === 'number' && f.actionFrame >= rule);
  if (!allowed || f.ledgeLock > 0 || f.ledgeGrabs >= LEDGE_MAX_GRABS) return;
  if (rule === true && f.vel.y + f.kb.y > 0) return;
  if (stickY(c) <= -0.5) return;
  const reach = s.width / 2 + 4;
  for (let i = 0; i < stage.geo.ledges.length; i++) {
    const L = stage.geo.ledges[i]!;
    if (!ledgePresent(stage, i) || (f.pos.x - L.x) * L.side < -1) continue;
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
  // The counter also ticks on the grab frame, so +1 leaves exactly ledgeIntangibility frames counting this one.
  f.intangible = f.ledgeFresh ? ledgeIntangibility(f.airFrames, f.damage) + 1 : 0;
  f.ledgeFresh = false;
  hangAt(x);
  enterAction(x, 'ledgeCatch', 0);
}

/** Position of a fighter hanging from its ledge (or ledge `i`): hands at the corner, body against the wall. */
export function hangPos(x: Ctx, i = x.f.ledge): { x: number; y: number } {
  const L = x.stage.geo.ledges[i]!;
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
    if (e.kind !== 'floor' || !stage.present.solids[e.solid] || px < edgeMinX(e) || px > edgeMaxX(e))
      continue;
    if (Math.abs(floorY(e, px) - py) < 1) return { kind: 'solid', index: i };
  }
  return null;
}
