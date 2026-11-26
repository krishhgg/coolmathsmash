import { LAUNCH_DECAY } from '../combat/formulas';
import type { MatchState } from '../match';
import { posedStage, type PieceState } from '../movingStage';
import { edgeMaxX, edgeMinX, floorY, type Edge } from '../stage';
import { clamp, type Vec } from '../vec';
import { destroyEntity, entityDef, sweepEntities } from './entities';
import type { EntityCtx, EntityState } from './types';
import * as SimMath from '../math';

const EPS = 0.001;
/** Movement is split into sub-steps no longer than this, so fast entities never tunnel through thin geometry. */
const MAX_SUBSTEP = 1.5;

export function entityCtx(m: MatchState, e: EntityState, stage = posedStage(m)): EntityCtx {
  const owner = m.fighters.find((f) => f.port === e.owner) ?? null;
  return { m, e, def: entityDef(e.kind), stage, owner, c: owner ? m.players[owner.port]!.control : null };
}

/**
 * One frame of every entity, in spawn order, after the fighters and the stage have moved (so a move's spawn shows on
 * the frame it happens): age, rehit windows, script, then movement against the stage as it now stands, lifetime and
 * blast zones.
 */
export function stepEntities(m: MatchState): void {
  const stage = posedStage(m);
  for (const e of m.entities) {
    if (e.dead) continue;
    e.prevPos = { x: e.pos.x, y: e.pos.y };
    const x = entityCtx(m, e, stage);
    if (e.hitlag > 0) {
      e.hitlag--;
      e.hitlagAt = m.frame;
      if (e.grounded) keepFooting(x);
      continue;
    }
    e.age++;
    if (e.lifetime > 0 && e.age > e.lifetime) {
      destroyEntity(m, e, 'expired');
      continue;
    }
    if (x.def.hits?.some((w) => w.rehit && w.frames[0] === e.age)) e.hitVictims = [];
    x.def.script?.(x);
    if (e.dead) continue;
    if (e.age > 1) moveEntity(x);
    if (e.dead) continue;
    const b = stage.geo.blastZones;
    if (e.pos.x < b.left || e.pos.x > b.right || e.pos.y < b.bottom || e.pos.y > b.top)
      destroyEntity(m, e, 'blastZone');
  }
  sweepEntities(m);
}

/** Sub-stepped movement with stage collision, then gravity and knockback decay. */
function moveEntity(x: EntityCtx): void {
  const { e, def } = x;
  e.grounded = false;
  const dx = e.vel.x + e.kb.x;
  const dy = e.vel.y + e.kb.y;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP));
  let sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    const prev = { x: e.pos.x, y: e.pos.y };
    e.pos.x += dx / steps;
    e.pos.y += sy;
    const touched = collide(x, prev, { from: 1 - i / steps, to: 1 - (i + 1) / steps });
    if (e.dead || touched === 'wall') break;
    if (touched === 'floor') sy = 0;
  }
  if (e.dead) return;
  const speed = SimMath.hypot(e.kb.x, e.kb.y);
  const k = speed > LAUNCH_DECAY ? (speed - LAUNCH_DECAY) / speed : 0;
  e.kb.x *= k;
  e.kb.y *= k;
  if (def.gravity) e.vel.y = Math.max(e.vel.y - def.gravity, -(def.maxFall ?? Infinity));
}

/** Frozen in hitlag, a resting entity still rides the floor under it; one whose floor went from under it falls after. */
function keepFooting(x: EntityCtx): void {
  const { e } = x;
  const under = floorUnder(x, { x: e.pos.x, y: e.pos.y }, { from: 1, to: 0 });
  e.grounded = under !== null;
  if (!under) return;
  e.pos.x += under.carry;
  e.pos.y = under.y + x.def.radius;
}

/**
 * How much of each stage piece's motion this frame is still to come at the start and end of a sub-step (1 = the
 * piece is still where it was last frame, 0 = where it is now), so a sub-step sees the entity's motion relative to
 * the moving pieces, as fighters do: a floor rising under a resting entity catches it, a solid running into it
 * pushes it.
 */
interface Lag {
  from: number;
  to: number;
}

const crossing = (prev: number, next: number) => prev >= -EPS && next < 0;

/**
 * Resolve one sub-step against the stage: `'floor'` when it landed or bounced (the rest of the frame's move goes on
 * along the floor), `'wall'` when it hit a wall or ceiling (the rest is dropped). An entity on a floor that a ceiling
 * comes down on is crushed.
 */
function collide(x: EntityCtx, prev: Vec, lag: Lag): 'floor' | 'wall' | null {
  const { e, def, stage } = x;
  const r = def.radius;
  const floor = def.floor ?? 'destroy';
  let landed = false;
  if (floor !== 'pass' && e.vel.y + e.kb.y <= 0) {
    const under = floorUnder(x, prev, lag);
    if (under) {
      if (floor === 'destroy') {
        destroyEntity(x.m, e, 'stage');
        return 'floor';
      }
      e.pos.x += under.carry;
      e.pos.y = under.y + r;
      e.kb.y = 0;
      e.vel.y = floor === 'bounce' ? (def.bounce ?? Math.abs(e.vel.y)) : 0;
      e.grounded = floor === 'land';
      landed = true;
    }
  }
  const wall = def.wall ?? 'destroy';
  if (wall === 'pass') return landed ? 'floor' : null;
  for (const edge of stage.edges) {
    if (edge.kind === 'floor' || !there(x, 'solids', edge.solid)) continue;
    const o = x.m.stage.solids[edge.solid]!;
    if (!hitsEdge(e, prev, edge, r, o, lag)) continue;
    if (wall === 'destroy' || ((landed || e.grounded) && edge.kind === 'ceiling')) {
      destroyEntity(x.m, e, 'stage');
      return 'wall';
    }
    const d = edgeDistance(e.pos, edge, r, o, lag.to);
    e.pos.x += edge.n.x * (-d + EPS);
    e.pos.y += edge.n.y * (-d + EPS);
    for (const v of [e.vel, e.kb]) {
      const into = v.x * edge.n.x + v.y * edge.n.y;
      if (into >= 0) continue;
      const k = wall === 'bounce' ? 2 : 1;
      v.x -= k * into * edge.n.x;
      v.y -= k * into * edge.n.y;
    }
    if (wall === 'bounce' && Math.abs(e.vel.x) > EPS) e.facing = Math.sign(e.vel.x) as 1 | -1;
    return 'wall';
  }
  return landed ? 'floor' : null;
}

/** A piece of the stage that is there this frame. */
const there = ({ stage }: EntityCtx, list: 'solids' | 'platforms', i: number) =>
  stage.present[list][i] === true;

/**
 * The floor edge or platform under the body on this sub-step, if any: one its bottom crossed, or one it was resting
 * on, which carries it along (`carry`, sideways) and down as well as up. `y` is the surface height where it ends up.
 */
function floorUnder(x: EntityCtx, prev: Vec, lag: Lag): { y: number; carry: number } | null {
  const { e, stage, m } = x;
  const r = x.def.radius;
  const meets = (was: number, now: (dx: number) => number, o: PieceState) => {
    const standing = Math.abs(prev.y - r - was) <= EPS;
    if (!standing && !crossing(prev.y - r - was, e.pos.y - r - now(0))) return null;
    const carry = standing ? o.dx * (lag.from - lag.to) : 0;
    return { y: now(carry), carry };
  };
  for (const edge of stage.edges) {
    if (edge.kind !== 'floor' || !there(x, 'solids', edge.solid)) continue;
    const o = m.stage.solids[edge.solid]!;
    const at = e.pos.x + o.dx * lag.to;
    if (at < edgeMinX(edge) - EPS || at > edgeMaxX(edge) + EPS) continue;
    const surface = (px: number) => floorY(edge, clamp(px, edgeMinX(edge), edgeMaxX(edge)));
    const was = surface(prev.x + o.dx * lag.from) - o.dy * lag.from;
    const hit = meets(was, (carry) => surface(at + carry) - o.dy * lag.to, o);
    if (hit) return hit;
  }
  for (const [i, p] of stage.geo.platforms.entries()) {
    if (!there(x, 'platforms', i)) continue;
    const o = m.stage.platforms[i]!;
    const at = e.pos.x + o.dx * lag.to;
    if (at < p.x1 || at > p.x2) continue;
    const hit = meets(p.y - o.dy * lag.from, () => p.y - o.dy * lag.to, o);
    if (hit) return hit;
  }
  return null;
}

/** Signed distance from the body circle to an edge of a piece moving by `o`, `lag` of its motion still to come. */
function edgeDistance(p: Vec, edge: Edge, r: number, o: PieceState, lag: number): number {
  return (p.x + o.dx * lag - edge.a.x) * edge.n.x + (p.y + o.dy * lag - edge.a.y) * edge.n.y - r;
}

/** The body circle crossed into a wall or ceiling edge on this sub-step, relative to the edge's motion. */
function hitsEdge(e: EntityState, prev: Vec, edge: Edge, r: number, o: PieceState, lag: Lag): boolean {
  if (!crossing(edgeDistance(prev, edge, r, o, lag.from), edgeDistance(e.pos, edge, r, o, lag.to)))
    return false;
  const ex = edge.b.x - edge.a.x;
  const ey = edge.b.y - edge.a.y;
  const px = e.pos.x + o.dx * lag.to;
  const py = e.pos.y + o.dy * lag.to;
  const t = ((px - edge.a.x) * ex + (py - edge.a.y) * ey) / (ex * ex + ey * ey);
  return t >= -0.05 && t <= 1.05;
}
