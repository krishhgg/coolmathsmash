import { breakGrab } from './actions/grab';
import { dropLedge } from './actions/ledge';
import { actionDef, enterAction } from './actions/registry';
import { DOWN_FLICK_THRESHOLD } from './constants';
import { stickY } from './control';
import { emit } from './events';
import type { Ctx, GroundRef } from './fighter';
import type { MatchState } from './match';
import { crossing, ecb, land, leaveGround, pushOut, surfaceRange, surfaceY } from './movement';
import {
  edgeMaxX,
  edgeMinX,
  floorY,
  type CompiledStage,
  type Edge,
  type Motion,
  type PieceOptions,
  type Schedule,
  type StageGeometry,
} from './stage';
import { compiledStage, makeCtx } from './step';
import { clamp, type Vec } from './vec';

/**
 * Moving platforms and solids (docs/stage-geometry.md). A piece's position and presence are pure functions of the match
 * frame; MatchState.stage holds them for the current frame so the renderer, hashes and replays see them.
 */

/**
 * One solid or platform on one frame: its offset from the authored position, how far that offset moved since
 * the previous frame, and whether the piece is there.
 */
export interface PieceState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  on: boolean;
}

/** MatchState.stage: every solid and platform of the stage on the current frame, in StageGeometry order. */
export interface StageState {
  solids: PieceState[];
  platforms: PieceState[];
}

const EPS = 0.001;
/** Stage sweeps are split into substeps no longer than this, as in airMove. */
const MAX_SUBSTEP = 1.5;
const ZERO: Vec = { x: 0, y: 0 };
const mod = (frame: number, period: number) => ((frame % period) + period) % period;

/** A motion's offset on a match frame. Keyframes interpolate between the keys either side of it, looping. */
export function motionOffset(motion: Motion | undefined, frame: number): [number, number] {
  if (!motion) return [0, 0];
  if (typeof motion === 'function') return motion(frame);
  const { period, keys, ease } = motion;
  const t = mod(frame, period);
  let i = keys.length - 1;
  for (let j = 0; j < keys.length; j++) if (keys[j]![0] <= t) i = j;
  const [fa, xa, ya] = keys[i]!;
  const [fb, xb, yb] = keys[(i + 1) % keys.length]!;
  const k = mod(t - fa, period) / (mod(fb - fa, period) || period);
  const s = ease ? k * k * (3 - 2 * k) : k;
  return [xa + (xb - xa) * s, ya + (yb - ya) * s];
}

/** Whether a scheduled piece is there on a match frame. */
export function scheduledOn(schedule: Schedule | undefined, frame: number): boolean {
  if (!schedule) return true;
  if (typeof schedule === 'function') return schedule(frame);
  const t = mod(frame, schedule.period);
  return !schedule.off.some(([a, b]) => t >= a && t <= b);
}

/** Stage hazards are on unless the match turns them off (MatchConfig.hazards) for legal play. */
export const hazardsOn = (m: MatchState) => m.config.hazards !== false;

function pieceAt(
  piece: PieceOptions,
  frame: number,
  prev: PieceState | undefined,
  hazards: boolean,
): PieceState {
  const still = piece.hazard && !hazards;
  const [x, y] = still ? [0, 0] : motionOffset(piece.motion, frame);
  return {
    x,
    y,
    dx: prev ? x - prev.x : 0,
    dy: prev ? y - prev.y : 0,
    on: still || scheduledOn(piece.schedule, frame),
  };
}

/**
 * The stage on match frame `frame`; `prev`, the previous frame's state, gives each piece's movement. With
 * hazards off, pieces flagged `hazard` stay at their authored place, present.
 */
export function stageStateAt(
  geo: StageGeometry,
  frame: number,
  prev?: StageState,
  hazards = true,
): StageState {
  return {
    solids: geo.solids.map((s, i) => pieceAt(s, frame, prev?.solids[i], hazards)),
    platforms: geo.platforms.map((p, i) => pieceAt(p, frame, prev?.platforms[i], hazards)),
  };
}

const posed = new WeakMap<StageState, CompiledStage>();

/**
 * The stage as it stands on the match's current frame: every piece at its offset, absent pieces flagged. Every
 * Ctx carries it, so collision, ledges and getups all see the moved geometry. Cached per StageState object,
 * which advanceStage replaces (never mutates) each frame.
 */
export function posedStage(m: MatchState): CompiledStage {
  let c = posed.get(m.stage);
  if (!c) {
    c = pose(compiledStage(m.config.stage), m.stage);
    posed.set(m.stage, c);
  }
  return c;
}

function pose(base: CompiledStage, st: StageState): CompiledStage {
  const still = (p: PieceState) => p.x === 0 && p.y === 0 && p.on;
  if (st.solids.every(still) && st.platforms.every(still)) return base;
  const g = base.geo;
  const at = (s: number) => st.solids[s]!;
  const move = (v: Vec, o: PieceState): Vec => ({ x: v.x + o.x, y: v.y + o.y });
  return {
    geo: {
      ...g,
      solids: g.solids.map((s, i) => ({
        ...s,
        points: s.points.map(([x, y]): [number, number] => [x + at(i).x, y + at(i).y]),
      })),
      platforms: g.platforms.map((p, i) => {
        const o = st.platforms[i]!;
        return { ...p, x1: p.x1 + o.x, x2: p.x2 + o.x, y: p.y + o.y };
      }),
      ledges: g.ledges.map((l, i) => {
        const s = base.ledgeSolid[i]!;
        return s < 0 ? l : { ...l, ...move(l, at(s)) };
      }),
    },
    edges: base.edges.map((e) => ({ ...e, a: move(e.a, at(e.solid)), b: move(e.b, at(e.solid)) })),
    ledgeSolid: base.ledgeSolid,
    present: { solids: st.solids.map((p) => p.on), platforms: st.platforms.map((p) => p.on) },
  };
}

/**
 * Move the stage to the next frame's pose, after the fighters have moved against the current one, and keep
 * every fighter consistent with it. Fighters standing on or hanging from a piece ride it; a surface rising
 * through a fighter's feet catches them; a solid running into a fighter pushes it out, and a fighter squeezed
 * between that solid and other geometry pops out on top of it; a fighter whose piece vanishes falls.
 * Collision uses each fighter's motion relative to each solid, so nothing tunnels however fast a piece moves.
 */
export function advanceStage(m: MatchState): void {
  const before = m.stage;
  m.stage = stageStateAt(compiledStage(m.config.stage).geo, m.frame + 1, before, hazardsOn(m));
  const changed = (p: PieceState, i: number, was: PieceState[]) =>
    p.dx !== 0 || p.dy !== 0 || p.on !== was[i]!.on;
  const moved =
    m.stage.solids.some((p, i) => changed(p, i, before.solids)) ||
    m.stage.platforms.some((p, i) => changed(p, i, before.platforms));
  if (!moved) return;
  for (const piece of ['solid', 'platform'] as const) {
    const [was, now] =
      piece === 'solid' ? [before.solids, m.stage.solids] : [before.platforms, m.stage.platforms];
    now.forEach((p, index) => {
      if (p.on !== was[index]!.on) emit(m, { type: 'stagePiece', piece, index, on: p.on });
    });
  }
  for (const f of m.fighters) followStage(makeCtx(m, f, m.players[f.port]!), before);
}

function followStage(x: Ctx, before: StageState): void {
  const { f, m, stage } = x;
  if (f.action === 'ko' || f.action === 'out' || f.action === 'respawn') return;
  const carry = ride(x);
  if (f.ledge >= 0 || actionDef(f).physics === 'none') return;
  const box = ecb(f, x);
  let pusher = -1;
  let squeezed = false;
  let caught = false;
  for (let s = 0; s < stage.geo.solids.length; s++) {
    const p = m.stage.solids[s]!;
    if (!p.on || !before.solids[s]!.on) continue;
    const rel = { x: carry.x - p.dx, y: carry.y - p.dy };
    if (rel.x === 0 && rel.y === 0) continue;
    const hit = sweepSolid(x, s, rel, p.dy, box, !caught);
    caught ||= hit.caught;
    if (!hit.pushed) continue;
    pusher = s;
    if (!f.ground) continue;
    if (hit.pressed) {
      if (f.ground.kind === 'solid') squeezed = true;
      else {
        f.dropPlatform = f.ground.index;
        loseGround(x);
      }
      continue;
    }
    const [lo, hi] = surfaceRange(stage, f.ground);
    if (f.pos.x >= lo && f.pos.x <= hi) f.pos.y = surfaceY(stage, f.ground, f.pos.x);
    else loseGround(x);
  }
  if (!caught) catchOnPlatform(x, before, carry);
  if (pusher >= 0 && (squeezed || insideSolid(stage, f.pos.x, f.pos.y + box[1]!.y / 2))) popOut(x, pusher);
}

/**
 * Run the fighter along its path relative to solid `s` this frame (it moved by `rel` against the solid), in
 * substeps like airMove's, so a solid moving any distance in any direction can't skip over it: a floor rising
 * through its feet catches it, a wall or ceiling pushes it out. Without either, the fighter stays put.
 */
function sweepSolid(
  x: Ctx,
  s: number,
  rel: Vec,
  rise: number,
  box: Vec[],
  canCatch: boolean,
): { caught: boolean; pushed: boolean; pressed: boolean } {
  const { f, stage } = x;
  const end = { x: f.pos.x, y: f.pos.y };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(rel.x), Math.abs(rel.y)) / MAX_SUBSTEP));
  const out = { caught: false, pushed: false, pressed: false };
  f.pos.x -= rel.x;
  f.pos.y -= rel.y;
  for (let k = 0; k < steps && !out.caught; k++) {
    const prev = { x: f.pos.x, y: f.pos.y };
    f.pos.x += rel.x / steps;
    f.pos.y += rel.y / steps;
    for (let i = 0; i < stage.edges.length; i++) {
      const e = stage.edges[i]!;
      if (e.solid !== s) continue;
      if (e.kind !== 'floor') {
        if (!pushOut(f, prev, e, box)) continue;
        out.pushed = true;
        out.pressed ||= e.kind === 'ceiling';
      } else if (canCatch && !out.caught && risesThroughFeet(x, prev, e, rise)) {
        out.caught = true;
        standOn(x, { kind: 'solid', index: i });
      }
    }
  }
  if (!out.caught && !out.pushed) {
    f.pos.x = end.x;
    f.pos.y = end.y;
  }
  return out;
}

/** Carry a fighter standing on or hanging from a moving piece; one whose piece vanished falls. Returns the ride. */
function ride(x: Ctx): Vec {
  const { f, m, stage } = x;
  if (f.ground) {
    const g = f.ground;
    const p = g.kind === 'solid' ? m.stage.solids[stage.edges[g.index]!.solid]! : m.stage.platforms[g.index]!;
    if (!p.on) {
      loseGround(x);
      return ZERO;
    }
    f.pos.x += p.dx;
    f.pos.y = surfaceY(stage, g, f.pos.x);
    return { x: p.dx, y: p.dy };
  }
  const s = f.ledge >= 0 ? stage.ledgeSolid[f.ledge]! : -1;
  if (s < 0) return ZERO;
  const p = m.stage.solids[s]!;
  if (!p.on) {
    if (!f.launch) dropLedge(x);
    return ZERO;
  }
  f.pos.x += p.dx;
  f.pos.y += p.dy;
  return { x: p.dx, y: p.dy };
}

/** A floor that rose through the fighter's feet this frame (relative to the fighter, from `prev`). */
function risesThroughFeet(x: Ctx, prev: Vec, e: Edge, rise: number): boolean {
  const { f } = x;
  if (f.pos.x < edgeMinX(e) - EPS || f.pos.x > edgeMaxX(e) + EPS) return false;
  if (!f.ground && f.vel.y + f.kb.y > rise) return false;
  const was = prev.y - floorY(e, clamp(prev.x, edgeMinX(e), edgeMaxX(e)));
  return crossing(was, f.pos.y - floorY(e, f.pos.x));
}

/**
 * A soft platform rising through the feet of a fighter (not dropping through it) catches them, at the point of
 * the fighter's path relative to the platform where its feet cross it.
 */
function catchOnPlatform(x: Ctx, before: StageState, carry: Vec): void {
  const { f, m, stage } = x;
  if (stickY(x.c) <= -DOWN_FLICK_THRESHOLD) return;
  for (let i = 0; i < stage.geo.platforms.length; i++) {
    const p = m.stage.platforms[i]!;
    const plat = stage.geo.platforms[i]!;
    if (!p.on || !before.platforms[i]!.on || i === f.dropPlatform) continue;
    if (f.ground?.kind === 'platform' && f.ground.index === i) continue;
    const rel = { x: carry.x - p.dx, y: carry.y - p.dy };
    if (rel.y >= 0 || (!f.ground && f.vel.y + f.kb.y > p.dy)) continue;
    const from = f.pos.y - rel.y - plat.y;
    if (!crossing(from, f.pos.y - plat.y)) continue;
    const cx = f.pos.x - rel.x + (rel.x * from) / -rel.y;
    if (cx < plat.x1 || cx > plat.x2) continue;
    f.pos.x = cx;
    standOn(x, { kind: 'platform', index: i });
    return;
  }
}

/**
 * Put the fighter on surface `g`: an airborne one lands, a grounded one changes surface. A fighter frozen in
 * hitlag with a launch waiting keeps its action; the launch takes it off the surface when hitlag ends.
 */
function standOn(x: Ctx, g: GroundRef): void {
  const { f } = x;
  if (!f.ground && !f.launch) return land(x, g);
  f.ground = g;
  f.pos.y = surfaceY(x.stage, g, f.pos.x);
}

/** The stage left the fighter without ground: a grab it is in ends, and it falls unless launched or in hitstun. */
function loseGround(x: Ctx): void {
  const { f, m } = x;
  if (f.grabPartner >= 0) breakGrab(m, f);
  const keep = f.launch !== null || f.action === 'hitstun' || actionDef(f).physics === 'air';
  leaveGround(x);
  if (!keep) enterAction(x, 'fall', 0);
}

/**
 * Squeezed between solid `s` and other geometry: pop out on top of `s`, at the nearest point of its floor. A
 * solid without a floor passes through the fighter instead.
 */
function popOut(x: Ctx, s: number): void {
  const { f, stage } = x;
  let best = -1;
  let bestX = 0;
  for (let i = 0; i < stage.edges.length; i++) {
    const e = stage.edges[i]!;
    if (e.solid !== s || e.kind !== 'floor') continue;
    const px = clamp(f.pos.x, edgeMinX(e), edgeMaxX(e));
    const b = stage.edges[best];
    if (
      !b ||
      Math.abs(px - f.pos.x) < Math.abs(bestX - f.pos.x) ||
      (px === bestX && floorY(e, px) > floorY(b, px))
    ) {
      best = i;
      bestX = px;
    }
  }
  if (best < 0) {
    if (f.ground) f.pos.y = surfaceY(stage, f.ground, f.pos.x);
    return;
  }
  f.pos.x = bestX;
  standOn(x, { kind: 'solid', index: best });
  emit(x.m, { type: 'squeeze', port: f.port, solid: s, x: f.pos.x, y: f.pos.y });
}

function insideSolid(stage: CompiledStage, px: number, py: number): boolean {
  return stage.geo.solids.some((s, i) => {
    if (!stage.present.solids[i]) return false;
    let inside = false;
    const pts = s.points;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [xa, ya] = pts[a]!;
      const [xb, yb] = pts[b]!;
      if (ya > py !== yb > py && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
    }
    return inside;
  });
}
