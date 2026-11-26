import { getFighter } from '../fighters/lookup';
import { hittable, hurtbox, type Hurtbox } from './combat/hits';
import type { GroundRef } from './fighter';
import type { MatchState } from './match';
import { posedStage } from './movingStage';
import { ledgePresent } from './stage';
import type { Vec } from './vec';
import * as SimMath from './math';

/** The first thing a segment touches (castSegment). */
interface CastContact {
  /** How far along the segment: 0 at `from`, 1 at `to`. */
  t: number;
  point: Vec;
}

export type CastHit = CastContact &
  (
    | { kind: 'fighter'; port: number }
    | { kind: 'ledge'; ledge: number }
    | { kind: 'surface'; surface: GroundRef }
  );

export interface CastOptions {
  /** Hit one-way platforms, from either side. */
  platforms: boolean;
  /** Hit fighters' hurtboxes (fighters that can be hit at all, so not intangible ones). */
  fighters: boolean;
  /** Never hit this port's fighter. */
  ignore?: number;
  /**
   * Hit ledges the segment passes within this many units of, approached from off the stage (`from` on the
   * ledge's open side). Ledges are off without it.
   */
  ledges?: number;
}

const BISECT_STEPS = 40;

/**
 * Cast the segment `from` → `to` through the stage as it stands this frame (moving pieces posed, absent ones
 * skipped) and, with `opts.fighters`, through fighters' hurtboxes, and return the nearest hit, or null. Ties
 * go to ledges, then surfaces, then fighters in port order. Deterministic: closed-form tests, and fixed-step
 * bisection for hurtbox capsules.
 */
export function castSegment(m: MatchState, from: Vec, to: Vec, opts: CastOptions): CastHit | null {
  const stage = posedStage(m);
  const d = { x: to.x - from.x, y: to.y - from.y };
  let best: CastHit | null = null;
  const consider = (hit: CastHit | null) => {
    if (hit && (!best || hit.t < best.t)) best = hit;
  };
  const at = (t: number): Vec => ({ x: from.x + d.x * t, y: from.y + d.y * t });

  if (opts.ledges !== undefined) {
    stage.geo.ledges.forEach((L, i) => {
      if (!ledgePresent(stage, i) || (from.x - L.x) * L.side <= 0) return;
      const t = circleEntry(from, d, L, opts.ledges!);
      if (t !== null) consider({ kind: 'ledge', t, point: { x: L.x, y: L.y }, ledge: i });
    });
  }
  stage.edges.forEach((e, i) => {
    if (!stage.present.solids[e.solid]) return;
    const t = segmentHit(from, d, e.a, e.b);
    if (t !== null) consider({ kind: 'surface', t, point: at(t), surface: { kind: 'solid', index: i } });
  });
  if (opts.platforms) {
    stage.geo.platforms.forEach((p, i) => {
      if (!stage.present.platforms[i]) return;
      const t = segmentHit(from, d, { x: p.x1, y: p.y }, { x: p.x2, y: p.y });
      if (t !== null) consider({ kind: 'surface', t, point: at(t), surface: { kind: 'platform', index: i } });
    });
  }
  if (opts.fighters) {
    for (const f of m.fighters) {
      if (f.port === opts.ignore || !hittable(f)) continue;
      const t = capsuleEntry(from, d, hurtbox(f, getFighter(f.fighter).stats));
      if (t !== null) consider({ kind: 'fighter', t, point: at(t), port: f.port });
    }
  }
  return best;
}

/** Where `from + t·d` (0 ≤ t ≤ 1) crosses the segment a-b, or null (parallel segments never hit). */
function segmentHit(from: Vec, d: Vec, a: Vec, b: Vec): number | null {
  const e = { x: b.x - a.x, y: b.y - a.y };
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-12) return null;
  const w = { x: a.x - from.x, y: a.y - from.y };
  const t = (w.x * e.y - w.y * e.x) / den;
  const u = (w.x * d.y - w.y * d.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** First t at which `from + t·d` is within `r` of point `c`, or null. */
function circleEntry(from: Vec, d: Vec, c: Vec, r: number): number | null {
  const fx = from.x - c.x;
  const fy = from.y - c.y;
  const a = d.x * d.x + d.y * d.y;
  const cc = fx * fx + fy * fy - r * r;
  if (cc <= 0) return 0;
  if (a < 1e-12) return null;
  const b = 2 * (fx * d.x + fy * d.y);
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** First t at which `from + t·d` touches the hurtbox capsule, or null. */
function capsuleEntry(from: Vec, d: Vec, h: Hurtbox): number | null {
  const hw = h.hw ?? 0;
  const dist = (t: number) => {
    const p = { x: from.x + d.x * t, y: from.y + d.y * t };
    const x = Math.min(Math.max(p.x, h.x - hw), h.x + hw);
    const y = Math.min(Math.max(p.y, h.y1), h.y2);
    return SimMath.hypot(p.x - x, p.y - y);
  };
  if (dist(0) <= h.r) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECT_STEPS; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (dist(a) <= dist(b)) hi = b;
    else lo = a;
  }
  let near = (lo + hi) / 2;
  if (dist(near) > h.r) return null;
  let far = 0;
  for (let i = 0; i < BISECT_STEPS; i++) {
    const mid = (far + near) / 2;
    if (dist(mid) <= h.r) near = mid;
    else far = mid;
  }
  return near;
}
