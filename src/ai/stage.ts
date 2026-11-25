import { compiledStage } from '../sim/step';
import { edgeMaxX, edgeMinX, floorY, type CompiledStage } from '../sim/stage';

/** What the CPU knows about a stage: the main floor's extent, its ledges and where falling is fatal. */
export interface StageInfo {
  c: CompiledStage;
  /** Outer x of the stage's ground (the ledges, or the outermost floor ends). */
  left: number;
  right: number;
  /** Height of the main floor. */
  top: number;
  centerX: number;
  blast: { left: number; right: number; top: number; bottom: number };
}

const cache = new Map<string, StageInfo>();

export function stageInfo(id: string): StageInfo {
  let info = cache.get(id);
  if (info) return info;
  const c = compiledStage(id);
  const floors = c.edges.filter((e) => e.kind === 'floor');
  const ledges = c.geo.ledges;
  const left = ledges.length
    ? Math.min(...ledges.map((l) => l.x))
    : Math.min(...floors.map((e) => edgeMinX(e)));
  const right = ledges.length
    ? Math.max(...ledges.map((l) => l.x))
    : Math.max(...floors.map((e) => edgeMaxX(e)));
  const top = ledges.length ? Math.max(...ledges.map((l) => l.y)) : Math.max(...floors.map((e) => e.a.y));
  info = { c, left, right, top, centerX: (left + right) / 2, blast: c.geo.blastZones };
  cache.set(id, info);
  return info;
}

/** Height of the highest floor or platform at or below (x, y), or null when nothing would catch a fall there. */
export function floorBelow(info: StageInfo, x: number, y: number, platforms = true): number | null {
  let best: number | null = null;
  for (const e of info.c.edges) {
    if (e.kind !== 'floor' || x < edgeMinX(e) || x > edgeMaxX(e)) continue;
    const fy = floorY(e, x);
    if (fy <= y + 0.01 && (best === null || fy > best)) best = fy;
  }
  if (platforms) {
    for (const p of info.c.geo.platforms) {
      if (x < p.x1 || x > p.x2 || p.y > y + 0.01) continue;
      if (best === null || p.y > best) best = p.y;
    }
  }
  return best;
}

/** Solid ground (not a drop-through platform) somewhere below x. */
export function overSolidGround(info: StageInfo, x: number, y: number): boolean {
  return floorBelow(info, x, y, false) !== null;
}

/** The platform index under (x, y) within `slack` units of its top, or -1. */
export function platformAt(info: StageInfo, x: number, y: number, slack = 0.5): number {
  return info.c.geo.platforms.findIndex((p) => x >= p.x1 && x <= p.x2 && Math.abs(p.y - y) <= slack);
}

/** Keep a ground target this far inside the stage's ends. */
export function clampToStage(info: StageInfo, x: number, margin: number): number {
  return Math.min(info.right - margin, Math.max(info.left + margin, x));
}
