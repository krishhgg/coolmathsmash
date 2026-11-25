import type { HitboxDef } from '../fighters/types';
import type { Vec } from './vec';

/**
 * Offset of a moving piece from its authored position, as a deterministic function of the match frame (see
 * docs/stage-geometry.md): keyframes that loop every `period` frames, or a function of the frame.
 */
export type Motion =
  | {
      period: number;
      /** [frame within the period, dx, dy], sorted by frame. The path loops from the last key back to the first. */
      keys: [number, number, number][];
      /** Ease in and out of every key (smoothstep) instead of moving at constant speed between keys. */
      ease?: boolean;
    }
  | ((frame: number) => [number, number]);

/**
 * When a piece is there: absent on the listed frames (inclusive ranges) of every `period`, or a function of the
 * match frame that returns true while the piece is present.
 */
export type Schedule = { period: number; off: [number, number][] } | ((frame: number) => boolean);

/** A solid or platform may move and may appear and vanish; without either it stays put. */
export interface Moving {
  motion?: Motion;
  schedule?: Schedule;
}

/** What a solid or platform can be besides its shape (docs/stage-geometry.md). */
export interface PieceOptions extends Moving {
  /** Its motion and schedule are a stage hazard: with hazards off it stays at its authored place, present. */
  hazard?: boolean;
  /** A conveyor belt: fighters standing on it move this many units per frame along x (0 with hazards off). */
  conveyor?: number;
}

/** Elements of damaging terrain. Fighters list the ones they are immune to in FighterDef.immune. */
export type TerrainElement = 'goo' | 'lava' | 'water';

/** The damage and knockback of a HitboxDef, for hazards that are areas rather than circles. */
export type HazardHit = Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>;

/**
 * A damaging area (goo, lava, water pools): hits fighters whose body overlaps it, with set knockback like
 * Ultimate's damage floors. It may move and follow a schedule like a piece.
 */
export interface DamageZone extends Moving {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  element: TerrainElement;
  /** Damage and knockback; by default the element's (ELEMENT_HITS in src/sim/hazards.ts). */
  hit?: HazardHit;
  /** Frames after a hit before any stage hazard can hit that fighter again; by default the element's. */
  rehit?: number;
}

/**
 * Stage hitboxes (a sweeping blade, a falling hazard): circles around an anchor at (x, y) that moves with
 * `motion` and is active while `schedule` says it is there. Box angles count from +x (`direction: 'back'`
 * mirrors them, `'away'` sends fighters away from the anchor).
 */
export interface StageHitbox extends Moving {
  x: number;
  y: number;
  boxes: HitboxDef[];
  /** Frames after a hit before any stage hazard can hit that fighter again (default 30). */
  rehit?: number;
}

/**
 * Collision geometry of a stage, in game units with y up. Rendering lives elsewhere (src/stages/<id>/view.ts);
 * the simulation only ever sees this.
 */
export interface StageGeometry {
  id: string;
  name: string;
  /** Closed solid polygons. Edges are classified as floor, wall or ceiling from their outward normal. */
  solids: ({ points: [number, number][] } & PieceOptions)[];
  /** One-way (drop-through) platforms. */
  platforms: ({ x1: number; x2: number; y: number } & PieceOptions)[];
  /**
   * Grabbable corners. side -1 = left end of the stage (fighter hangs on its left, facing right). A ledge moves
   * and vanishes with its `solid`, by default the solid that has a corner at (x, y).
   */
  ledges: { x: number; y: number; side: -1 | 1; solid?: number }[];
  blastZones: { left: number; right: number; top: number; bottom: number };
  camera: { left: number; right: number; top: number; bottom: number };
  /** Starting positions per port: x, y, facing. */
  spawns: [number, number, 1 | -1][];
  /** Respawn platform positions per port. */
  respawns: [number, number][];
  /** Damaging areas. Off, with every other hazard, when MatchConfig.hazards is false. */
  zones?: DamageZone[];
  /** Stage hitboxes. */
  hitboxes?: StageHitbox[];
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
  /** The solid each ledge belongs to, -1 for none. */
  ledgeSolid: number[];
  /** Which solids and platforms are there this frame; collision skips absent ones. */
  present: { solids: boolean[]; platforms: boolean[] };
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
  const ledgeSolid = geo.ledges.map(
    (l) =>
      l.solid ??
      geo.solids.findIndex((s) =>
        s.points.some(([x, y]) => Math.abs(x - l.x) < 0.01 && Math.abs(y - l.y) < 0.01),
      ),
  );
  return {
    geo,
    edges,
    ledgeSolid,
    present: { solids: geo.solids.map(() => true), platforms: geo.platforms.map(() => true) },
  };
}

export function ledgePresent(stage: CompiledStage, i: number): boolean {
  const s = stage.ledgeSolid[i] ?? -1;
  return s < 0 || stage.present.solids[s] === true;
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
