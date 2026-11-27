import { getFighter } from '../fighters/registry';
import { compiledStage, posedStage } from '../sim/context';
import type { FighterState, GroundRef } from '../sim/fighter';
import { zoneAt } from '../sim/hazards';
import type { MatchState } from '../sim/match';
import { hazardsOn, scheduledOn } from '../sim/movingStage';
import {
  edgeMaxX,
  edgeMinX,
  floorY,
  type CompiledStage,
  type PieceOptions,
  type TerrainElement,
} from '../sim/stage';
import { arc } from './look';

/**
 * What the CPU knows about the stage on the frame it is deciding: the sim's posed stage (moved pieces at their
 * offsets, absent ones flagged), which pieces stay for a while, the damage zones and conveyor belts that are on,
 * and the main floor's extent, its ledges and where falling is fatal.
 */
export interface StageInfo {
  /** The stage the next frame collides against: posedStage of the match. */
  c: CompiledStage;
  /** Pieces present now and on each of the next STEADY_FRAMES frames: ground worth standing or landing on. */
  steady: { solids: boolean[]; platforms: boolean[] };
  /** Damage zones where they are on the next frame (when stage hits are checked); none with hazards off. */
  zones: { x1: number; x2: number; y1: number; y2: number; element: TerrainElement }[];
  /** Conveyor speed of each solid and platform; all 0 with hazards off. */
  belts: { solids: number[]; platforms: number[] };
  /**
   * No damage zones, no belts, every piece steady and no pit between the stage's ends (`pits`): nowhere on the ground
   * is unsafe but the edges.
   */
  calm: boolean;
  /**
   * The solid floor has a gap between the stage's ends that a fighter can fall through: Bloxorz Platform's 16-wide
   * hole in its middle, the two between Run Tunnel's blocks. As authored, whether or not the pieces are there now.
   */
  pits: boolean;
  /** Outer x of the stage's ground (the ledges, or the outermost floor ends), as authored. */
  left: number;
  right: number;
  /** Height of the main floor. */
  top: number;
  centerX: number;
  blast: { left: number; right: number; top: number; bottom: number };
}

/** Frames ahead the CPU reads schedules: ground that vanishes sooner is not somewhere to stand or land. */
export const STEADY_FRAMES = 45;

type Extent = Pick<StageInfo, 'left' | 'right' | 'top' | 'centerX' | 'blast' | 'pits'>;

const extents = new Map<string, Extent>();
/** Floors that meet within this much of each other leave no pit. */
const PIT_EPS = 1e-6;
const statics = new Map<string, StageInfo>();
const live = new WeakMap<object, StageInfo>();

function extent(id: string): Extent {
  let e = extents.get(id);
  if (e) return e;
  const c = compiledStage(id);
  const floors = c.edges.filter((x) => x.kind === 'floor');
  const ledges = c.geo.ledges;
  const left = ledges.length
    ? Math.min(...ledges.map((l) => l.x))
    : Math.min(...floors.map((x) => edgeMinX(x)));
  const right = ledges.length
    ? Math.max(...ledges.map((l) => l.x))
    : Math.max(...floors.map((x) => edgeMaxX(x)));
  const top = ledges.length ? Math.max(...ledges.map((l) => l.y)) : Math.max(...floors.map((x) => x.a.y));
  // Walk the floors left to right: a stretch that none of them covers is a pit.
  let reach = left;
  for (const f of [...floors].sort((a, b) => edgeMinX(a) - edgeMinX(b))) {
    if (edgeMinX(f) > reach + PIT_EPS) break;
    reach = Math.max(reach, edgeMaxX(f));
  }
  const pits = reach < right - PIT_EPS;
  e = { left, right, top, centerX: (left + right) / 2, blast: c.geo.blastZones, pits };
  extents.set(id, e);
  return e;
}

/** The stage as authored: every piece in place and present, no hazards. For probes and bookkeeping, not play. */
export function staticStage(id: string): StageInfo {
  let info = statics.get(id);
  if (info) return info;
  const c = compiledStage(id);
  info = {
    c,
    steady: c.present,
    zones: [],
    belts: { solids: c.geo.solids.map(() => 0), platforms: c.geo.platforms.map(() => 0) },
    calm: !extent(c.geo.id).pits,
    ...extent(c.geo.id),
  };
  statics.set(id, info);
  return info;
}

/**
 * The stage on the match's current frame, as the sim will collide with it and hit fighters on the next step.
 * Deterministic: schedules, motions and zones are functions of the stage's clock (MatchState.stageFrame). Cached per
 * frame.
 */
export function stageInfo(state: Readonly<MatchState>): StageInfo {
  let info = live.get(state.stage);
  if (info) return info;
  const m = state as MatchState;
  const c = posedStage(m);
  const hazards = hazardsOn(m);
  const geo = compiledStage(state.config.stage).geo;
  const stays = (p: PieceOptions, on: boolean | undefined): boolean => {
    if (!on) return false;
    if ((p.hazard && !hazards) || !p.schedule) return true;
    for (let t = 1; t <= STEADY_FRAMES; t++) if (!scheduledOn(p.schedule, state.stageFrame + t)) return false;
    return true;
  };
  const belt = (p: PieceOptions) => (hazards ? (p.conveyor ?? 0) : 0);
  const zones: StageInfo['zones'] = [];
  if (hazards) {
    for (const z of geo.zones ?? []) {
      const at = zoneAt(z, state.stageFrame + 1);
      if (at) zones.push({ ...at, element: z.element });
    }
  }
  const steady = {
    solids: geo.solids.map((p, i) => stays(p, c.present.solids[i])),
    platforms: geo.platforms.map((p, i) => stays(p, c.present.platforms[i])),
  };
  const belts = { solids: geo.solids.map(belt), platforms: geo.platforms.map(belt) };
  const calm =
    !extent(state.config.stage).pits &&
    zones.length === 0 &&
    [...belts.solids, ...belts.platforms].every((b) => b === 0) &&
    [...steady.solids, ...steady.platforms].every(Boolean);
  info = { c, steady, zones, belts, calm, ...extent(state.config.stage) };
  live.set(state.stage, info);
  return info;
}

/** A floor or platform under some x: its height there, its conveyor speed, and which piece it is (as in GroundRef). */
interface Ground {
  y: number;
  belt: number;
  kind: 'solid' | 'platform';
  /** Edge index into CompiledStage.edges for solids, platform index for platforms. */
  index: number;
}

/** The highest floor or platform at or below (x, y) that is there (and, with `steady`, stays), or null. */
function groundAt(info: StageInfo, x: number, y: number, platforms: boolean, steady: boolean): Ground | null {
  const on = steady ? info.steady : info.c.present;
  let best: Ground | null = null;
  const edges = info.c.edges;
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (e.kind !== 'floor' || !on.solids[e.solid] || x < edgeMinX(e) || x > edgeMaxX(e)) continue;
    const fy = floorY(e, x);
    if (fy <= y + 0.01 && (best === null || fy > best.y)) {
      best = { y: fy, belt: info.belts.solids[e.solid]!, kind: 'solid', index: i };
    }
  }
  if (platforms) {
    const ps = info.c.geo.platforms;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!;
      if (!on.platforms[i] || x < p.x1 || x > p.x2 || p.y > y + 0.01) continue;
      if (best === null || p.y > best.y) {
        best = { y: p.y, belt: info.belts.platforms[i]!, kind: 'platform', index: i };
      }
    }
  }
  return best;
}

/**
 * The stage floor or platform there this frame that a fighter at (x, y) stands on or would land on falling straight
 * down (the highest at or below it), as the sim refers to ground; null over a gap. Entities' platforms are not part
 * of the stage, so this never finds them.
 */
export function groundUnder(info: StageInfo, x: number, y: number): GroundRef | null {
  const g = groundAt(info, x, y, true, false);
  return g && { kind: g.kind, index: g.index };
}

/**
 * Height of the highest floor or platform at or below (x, y) that is there this frame, or null when nothing would
 * catch a fall there. With `steady`, only ground that stays for the next STEADY_FRAMES frames counts.
 */
export function floorBelow(
  info: StageInfo,
  x: number,
  y: number,
  platforms = true,
  steady = false,
): number | null {
  return groundAt(info, x, y, platforms, steady)?.y ?? null;
}

/** Solid ground (not a drop-through platform) somewhere below x. */
export function overSolidGround(info: StageInfo, x: number, y: number): boolean {
  return floorBelow(info, x, y, false) !== null;
}

/** The present platform index under (x, y) within `slack` units of its top, or -1. */
export function platformAt(info: StageInfo, x: number, y: number, slack = 0.5): number {
  return info.c.geo.platforms.findIndex(
    (p, i) => info.c.present.platforms[i] && x >= p.x1 && x <= p.x2 && Math.abs(p.y - y) <= slack,
  );
}

/** Keep a ground target this far inside the stage's ends. */
export function clampToStage(info: StageInfo, x: number, margin: number): number {
  return Math.min(info.right - margin, Math.max(info.left + margin, x));
}

/**
 * Whether `fighter` standing at (x, y) would touch a damage zone that hurts it (the sim's zone test), with each
 * zone grown by `pad` units on both sides.
 */
export function inZone(info: StageInfo, fighter: string, x: number, y: number, pad = 0): boolean {
  if (!info.zones.length) return false;
  const def = getFighter(fighter);
  const { width, height } = def.stats;
  return info.zones.some(
    (z) =>
      !def.immune?.includes(z.element) &&
      x + width / 2 > z.x1 - pad &&
      x - width / 2 < z.x2 + pad &&
      y + height > z.y1 &&
      y < z.y2,
  );
}

/** Room the CPU leaves around a damage zone when choosing where to stand, for landing slides and jostling. */
const ZONE_PAD = 2;

/** Height tolerance for "still the same surface" between two samples a unit apart (floors are at most 45°). */
const SAME = 1.2;

/**
 * Whether `fighter` can stand on the ground at (x, about y) and stay there: it is there now and for the next
 * STEADY_FRAMES frames, no damage zone that hurts it is there, and if it is a conveyor belt, standing still on it
 * for that long ends somewhere that is also safe.
 */
export function standSafe(info: StageInfo, fighter: string, x: number, y: number): boolean {
  const g = groundAt(info, x, y + SAME, true, true);
  if (!g || g.y < y - SAME || inZone(info, fighter, x, g.y, ZONE_PAD)) return false;
  if (g.belt === 0) return true;
  const dir = Math.sign(g.belt);
  let h = g.y;
  for (let i = 1; i <= Math.abs(g.belt) * STEADY_FRAMES; i++) {
    const sx = x + dir * i;
    const next = floorBelow(info, sx, h + SAME, true, true);
    if (next === null) return false;
    if (next < h - SAME) return !inZone(info, fighter, sx, next, ZONE_PAD);
    if (inZone(info, fighter, sx, next, ZONE_PAD)) return false;
    h = next;
  }
  return true;
}

/** Whether a fall at (x, y) lands somewhere `fighter` can stand (standSafe). */
export function landsSafe(info: StageInfo, fighter: string, x: number, y: number): boolean {
  const fy = floorBelow(info, x, y, true, true);
  return fy !== null && standSafe(info, fighter, x, fy);
}

/** Units the CPU stops short of an unsafe edge or a damage zone when walking. */
const WALK_MARGIN = 4;

/**
 * How far toward `target` `fighter` standing at (x, y) can walk: all the way, or WALK_MARGIN short of the first
 * place it should not go: an edge with nothing safe to drop onto (a gap, an open trapdoor), ground about to vanish
 * or a damage zone. Walking off onto safe ground below (a platform's end over the floor) is fine. Starting
 * somewhere unsafe, the walk goes through it to the first safe ground. Returns x when it cannot move safely.
 */
export function walkTarget(
  info: StageInfo,
  fighter: string,
  x: number,
  y: number,
  target: number,
  margin = WALK_MARGIN,
): number {
  const dir = Math.sign(target - x);
  if (!dir) return target;
  let h = y;
  const from = standSafe(info, fighter, x, y) ? x : null;
  let first = from;
  let last = from;
  const n = Math.ceil(Math.abs(target - x));
  for (let i = 1; i <= n; i++) {
    const sx = i === n ? target : x + dir * i;
    const fy = floorBelow(info, sx, h + SAME);
    if (fy === null || fy < h - SAME) {
      if (fy !== null && standSafe(info, fighter, sx, fy)) return target;
      break;
    }
    h = fy;
    if (standSafe(info, fighter, sx, fy)) {
      first ??= sx;
      last = sx;
    } else if (last !== null) break;
  }
  if (first === null || last === null) return x;
  if (last === target) return target;
  // Stop short of the edge or zone, but never walk back from where the walk started (or first got safe).
  const stop = last - dir * margin;
  return dir > 0 ? Math.max(first, stop) : Math.min(first, stop);
}

/** How far the CPU looks along its ground for somewhere safe to stand. */
const SAFE_SEARCH = 140;

/**
 * The nearest x along the ground `fighter` stands on at (x, y) that it can walk to and stand on safely, a few
 * units past the edge of the unsafe stretch; null when none is in reach on foot.
 */
export function safeSpot(info: StageInfo, fighter: string, x: number, y: number): number | null {
  let best: number | null = null;
  for (const dir of [-1, 1]) {
    let h = y;
    for (let i = 1; i <= SAFE_SEARCH; i++) {
      const sx = x + dir * i;
      const fy = floorBelow(info, sx, h + SAME);
      if (fy === null || fy < h - SAME) break;
      h = fy;
      if (!standSafe(info, fighter, sx, fy)) continue;
      const inside = sx + dir * 3;
      const fi = floorBelow(info, inside, h + SAME);
      const spot = fi !== null && fi >= h - SAME && standSafe(info, fighter, inside, fi) ? inside : sx;
      if (best === null || Math.abs(spot - x) < Math.abs(best - x)) best = spot;
      break;
    }
  }
  return best;
}

/**
 * Where airborne `f` should drift to land near `x`: x itself when a fall there lands safely (landsSafe) and, on a
 * stage with hazards, `f` can drift there before it comes down; else the safe x nearest it (within `reach`) that
 * `f` can reach in time, else the safe x nearest `f`, else x. The searches prefer spots with WALK_MARGIN units of safe landing on both sides, so momentum after
 * touching down doesn't carry the CPU into the gap or zone it steered around.
 */
export function landingX(info: StageInfo, f: Readonly<FighterState>, x: number, reach = 60): number {
  const { pos, vel, fighter } = f;
  const safe = (sx: number, roomy: boolean) =>
    landsSafe(info, fighter, sx, pos.y) &&
    (!roomy ||
      (landsSafe(info, fighter, sx - WALK_MARGIN, pos.y) &&
        landsSafe(info, fighter, sx + WALK_MARGIN, pos.y)));
  const stats = getFighter(fighter).stats;
  const start = { x: pos.x, y: pos.y, vx: vel.x, vy: vel.y, kbx: f.kb.x, kby: f.kb.y };
  // Holding the stick toward sx from the current momentum (arc), does f get there before it falls to its ground?
  const inTime = (sx: number): boolean => {
    const fy = floorBelow(info, sx, pos.y, true, true)!;
    const dir = Math.sign(sx - pos.x);
    const a = arc(stats, start, dir, 300);
    for (let t = 0; t < a.x.length; t++) {
      if (dir * (a.x[t]! - sx) >= -1) return true;
      if (a.y[t]! <= fy && (t === 0 || a.y[t]! < a.y[t - 1]!)) return false;
    }
    return false;
  };
  if (landsSafe(info, fighter, x, pos.y) && (info.calm || inTime(x))) return x;
  for (const roomy of [true, false]) {
    for (let i = 1; i <= reach; i++) {
      for (const sx of [x - i, x + i]) if (safe(sx, roomy) && inTime(sx)) return sx;
    }
  }
  for (const roomy of [true, false]) {
    for (let i = 0; i <= reach; i++) {
      for (const sx of [pos.x - i, pos.x + i]) if (safe(sx, roomy)) return sx;
    }
  }
  return x;
}
