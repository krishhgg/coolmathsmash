import type { Vec } from './vec';

/**
 * Collision geometry of a stage, in game units with y up. Rendering lives elsewhere (src/stages/<id>/view.ts);
 * the simulation only ever sees this.
 */
export interface StageGeometry {
  id: string;
  name: string;
  /** Closed solid polygons. Edges are classified as floor, wall or ceiling from their outward normal. */
  solids: { points: [number, number][] }[];
  /** One-way (drop-through) platforms. */
  platforms: { x1: number; x2: number; y: number }[];
  /** Grabbable corners. side -1 = left end of the stage (fighter hangs on its left, facing right). */
  ledges: { x: number; y: number; side: -1 | 1 }[];
  blastZones: { left: number; right: number; top: number; bottom: number };
  camera: { left: number; right: number; top: number; bottom: number };
  /** Starting positions per port: x, y, facing. */
  spawns: [number, number, 1 | -1][];
  /** Respawn platform positions per port. */
  respawns: [number, number][];
}

export type EdgeKind = 'floor' | 'wall' | 'ceiling';

export interface Edge {
  solid: number;
  index: number;
  a: Vec;
  b: Vec;
  /** Outward unit normal. */
  n: Vec;
  kind: EdgeKind;
}

export interface CompiledStage {
  geo: StageGeometry;
  edges: Edge[];
}

const FLOOR_NORMAL_Y = 0.7;

export function compileStage(geo: StageGeometry): CompiledStage {
  const edges: Edge[] = [];
  geo.solids.forEach((solid, s) => {
    const pts = solid.points;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % pts.length]!;
      area += x1 * y2 - x2 * y1;
    }
    const ccw = area > 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[(i + 1) % pts.length]!;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      const n = ccw ? { x: dy / len, y: -dx / len } : { x: -dy / len, y: dx / len };
      const kind: EdgeKind = n.y >= FLOOR_NORMAL_Y ? 'floor' : n.y <= -FLOOR_NORMAL_Y ? 'ceiling' : 'wall';
      edges.push({ solid: s, index: i, a: { x: ax, y: ay }, b: { x: bx, y: by }, n, kind });
    }
  });
  return { geo, edges };
}

/** Height of a floor edge at x (floors are never vertical). */
export function floorY(e: Edge, x: number): number {
  const t = (x - e.a.x) / (e.b.x - e.a.x);
  return e.a.y + (e.b.y - e.a.y) * t;
}

export function edgeMinX(e: Edge): number {
  return Math.min(e.a.x, e.b.x);
}

export function edgeMaxX(e: Edge): number {
  return Math.max(e.a.x, e.b.x);
}
