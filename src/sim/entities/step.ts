import { LAUNCH_DECAY } from '../combat/formulas';
import type { MatchState } from '../match';
import { posedStage } from '../movingStage';
import { edgeMaxX, edgeMinX, floorY, type CompiledStage, type Edge } from '../stage';
import { destroyEntity, entityDef, sweepEntities } from './entities';
import type { EntityCtx, EntityState } from './types';

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
    if (e.hitlag > 0) {
      e.hitlag--;
      continue;
    }
    const x = entityCtx(m, e, stage);
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
    const touched = collide(x, prev);
    if (e.dead || touched === 'wall') break;
    if (touched === 'floor') sy = 0;
  }
  if (e.dead) return;
  const speed = Math.hypot(e.kb.x, e.kb.y);
  const k = speed > LAUNCH_DECAY ? (speed - LAUNCH_DECAY) / speed : 0;
  e.kb.x *= k;
  e.kb.y *= k;
  if (def.gravity) e.vel.y = Math.max(e.vel.y - def.gravity, -(def.maxFall ?? Infinity));
}

const crossing = (prev: number, next: number) => prev >= -EPS && next < 0;

/**
 * Resolve one sub-step against the stage: `'floor'` when it landed or bounced (the rest of the frame's move goes on
 * along the floor), `'wall'` when it hit a wall or ceiling (the rest is dropped).
 */
function collide(x: EntityCtx, prev: { x: number; y: number }): 'floor' | 'wall' | null {
  const { e, def, stage } = x;
  const r = def.radius;
  const floor = def.floor ?? 'destroy';
  if (floor !== 'pass' && e.vel.y + e.kb.y <= 0) {
    const surface = floorUnder(stage, e, prev, r);
    if (surface !== null) {
      if (floor === 'destroy') {
        destroyEntity(x.m, e, 'stage');
        return 'floor';
      }
      e.pos.y = surface + r;
      e.kb.y = 0;
      e.vel.y = floor === 'bounce' ? (def.bounce ?? Math.abs(e.vel.y)) : 0;
      e.grounded = floor === 'land';
      return 'floor';
    }
  }
  const wall = def.wall ?? 'destroy';
  if (wall === 'pass') return null;
  for (const edge of stage.edges) {
    if (edge.kind === 'floor' || !stage.present.solids[edge.solid] || !hitsEdge(e, prev, edge, r)) continue;
    if (wall === 'destroy') {
      destroyEntity(x.m, e, 'stage');
      return 'wall';
    }
    const d = (e.pos.x - edge.a.x) * edge.n.x + (e.pos.y - edge.a.y) * edge.n.y - r;
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
  return null;
}

/** Height of the floor edge or platform the body's bottom crossed on this sub-step, if any. */
function floorUnder(
  stage: CompiledStage,
  e: EntityState,
  prev: { x: number; y: number },
  r: number,
): number | null {
  for (const edge of stage.edges) {
    if (edge.kind !== 'floor' || !stage.present.solids[edge.solid]) continue;
    if (e.pos.x < edgeMinX(edge) - EPS || e.pos.x > edgeMaxX(edge) + EPS) continue;
    const now = floorY(edge, e.pos.x);
    const before = floorY(edge, Math.min(Math.max(prev.x, edgeMinX(edge)), edgeMaxX(edge)));
    if (crossing(prev.y - r - before, e.pos.y - r - now)) return now;
  }
  for (const [i, p] of stage.geo.platforms.entries()) {
    if (!stage.present.platforms[i] || e.pos.x < p.x1 || e.pos.x > p.x2) continue;
    if (crossing(prev.y - r - p.y, e.pos.y - r - p.y)) return p.y;
  }
  return null;
}

/** The body circle crossed into a wall or ceiling edge on this sub-step. */
function hitsEdge(e: EntityState, prev: { x: number; y: number }, edge: Edge, r: number): boolean {
  const dist = (p: { x: number; y: number }) => (p.x - edge.a.x) * edge.n.x + (p.y - edge.a.y) * edge.n.y - r;
  if (!crossing(dist(prev), dist(e.pos))) return false;
  const ex = edge.b.x - edge.a.x;
  const ey = edge.b.y - edge.a.y;
  const t = ((e.pos.x - edge.a.x) * ex + (e.pos.y - edge.a.y) * ey) / (ex * ex + ey * ey);
  return t >= -0.05 && t <= 1.05;
}
