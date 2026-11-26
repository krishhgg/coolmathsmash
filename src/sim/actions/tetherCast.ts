import type { TetherDef, TetherHit } from '../../fighters/types';
import { Btn } from '../../input/types';
import { castSegment } from '../cast';
import { DIRECTION_THRESHOLD, TETHER } from '../constants';
import { framesSincePress, isHeld, stickX, stickY, type ControlState } from '../control';
import { emit } from '../events';
import type { Ctx } from '../fighter';
import { leaveGround } from '../movement';
import type { Vec } from '../vec';
import { moveOf } from './attack';
import { setAction } from './registry';
import { anchorPiece, ledgeFree, releaseTether, tetherOrigin } from './tether';

/**
 * Firing a tether: a move with `tether` fires a line on its `frame` (aimed ones wait for special to be
 * released), the tip travels out, and the first thing the line touches anchors it if `latch` allows, into
 * tetherPull (tether.ts); anything else, or reaching full range without a sky anchor, whiffs and the move plays
 * out.
 */

/** After the action's update each frame (step.ts): run the line of a tether move that's playing. */
export function stepTetherMove(x: Ctx): void {
  const t = moveOf(x.f)?.tether;
  if (t && (x.f.action === 'attack' || x.f.action === 'aerial')) stepTether(x, t);
}

/** Aim, fire on `t.frame`, and move the tip while it travels. */
function stepTether(x: Ctx, t: TetherDef): void {
  const { f } = x;
  if (t.aimed && !f.tether && f.actionFrame <= t.frame) aim(x, t, t.aimed);
  if (f.actionFrame === t.frame && !f.tether) fire(x, t);
  if (f.tether?.kind === 'out') travel(x, t);
}

/** The reticle walks with the stick while special is held, while playMove holds the move before `t.frame`. */
function aim(x: Ctx, t: TetherDef, aimed: NonNullable<TetherDef['aimed']>): void {
  const { f, c } = x;
  f.aim ??= { x: 0, y: 0 };
  if (isHeld(c, Btn.Special)) {
    const s = { x: stickX(c), y: stickY(c) };
    const len = Math.max(1, Math.hypot(s.x, s.y));
    f.aim = clampLength(
      { x: f.aim.x + (s.x / len) * aimed.speed, y: f.aim.y + (s.y / len) * aimed.speed },
      t.range,
    );
    return;
  }
  const released = (c.prev.buttons & Btn.Special) !== 0;
  if (!aimed.quick || !released || framesSincePress(c, Btn.Special) > aimed.quick.frames) return;
  const dir = eightWay(c);
  if (dir) f.aim = { x: dir.x * t.range, y: dir.y * t.range };
}

const S = Math.SQRT1_2;
/** Unit vectors of the 8 directions, counter-clockwise from right. */
const EIGHT: Vec[] = [
  { x: 1, y: 0 },
  { x: S, y: S },
  { x: 0, y: 1 },
  { x: -S, y: S },
  { x: -1, y: 0 },
  { x: -S, y: -S },
  { x: 0, y: -1 },
  { x: S, y: -S },
];

/** The stick snapped to 8 directions as a unit vector, or null in the dead zone. */
function eightWay(c: ControlState): Vec | null {
  const sx = stickX(c);
  const sy = stickY(c);
  if (Math.hypot(sx, sy) < DIRECTION_THRESHOLD) return null;
  return EIGHT[(Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) + 8) % 8]!;
}

function clampLength(v: Vec, max: number): Vec {
  const len = Math.hypot(v.x, v.y);
  return len <= max ? v : { x: (v.x / len) * max, y: (v.y / len) * max };
}

/** Fire: aimed tethers at the reticle (no line if it never left the fighter), others along `angle`. */
function fire(x: Ctx, t: TetherDef): void {
  const { f, c, m } = x;
  const bend = (t.stickAdjust ?? 0) * Math.max(-1, Math.min(1, stickX(c) * f.facing));
  const a = ((t.angle - bend) * Math.PI) / 180;
  const target = t.aimed ? f.aim : { x: Math.cos(a) * t.range * f.facing, y: Math.sin(a) * t.range };
  if (!target || Math.hypot(target.x, target.y) < 1) {
    f.aim = null;
    return;
  }
  f.aim = target;
  const o = tetherOrigin(f);
  f.tether = { anchor: o, kind: 'out', frame: m.frame };
  emit(m, { type: 'tetherFire', port: f.port, x: o.x + target.x, y: o.y + target.y });
}

/** The tip moves out evenly over `t.travel` frames; the line from the hand to it anchors on what it first touches. */
function travel(x: Ctx, t: TetherDef): void {
  const { f, m } = x;
  const o = tetherOrigin(f);
  const p = Math.min(1, (m.frame - f.tether!.frame + 1) / t.travel);
  const tip = { x: o.x + f.aim!.x * p, y: o.y + f.aim!.y * p };
  const ledges = t.latch.includes('ledge') ? TETHER.ledgeSnap : undefined;
  const hit = castSegment(m, o, tip, {
    platforms: true,
    fighters: t.targetsFighters ?? false,
    ignore: f.port,
    ledges,
  });
  if (hit) return anchor(x, t, hit);
  f.tether!.anchor = tip;
  if (p < 1) return;
  if (t.latch.includes('sky')) return anchor(x, t, { kind: 'sky', t: 1, point: tip });
  releaseTether(m, f);
}

/** Anchor where the line stopped, if `latch` takes it, the ledge is free and `onAnchor` agrees; else whiff. */
function anchor(x: Ctx, t: TetherDef, hit: TetherHit): void {
  const { f, m } = x;
  const { kind, point } = hit;
  if (kind === 'fighter') {
    const target = m.fighters[hit.port]!;
    const tether = f.tether;
    const move = f.move;
    const action = f.action;
    emit(m, { type: 'tetherFighterHit', port: f.port, target: target.port, x: point.x, y: point.y });
    const response = t.onFighter?.(x, target, { phase: 'hit', ...hit });
    if (f.tether !== tether) return;
    if (response !== 'pullSelf' || f.move !== move || f.action !== action) return releaseTether(m, f);
    f.tether = {
      anchor: point,
      kind,
      port: target.port,
      local: { x: point.x - target.pos.x, y: point.y - target.pos.y },
      frame: m.frame,
    };
    startPull(x);
    return;
  }
  const ok =
    t.latch.includes(kind) && (kind !== 'ledge' || ledgeFree(x, hit.ledge)) && t.onAnchor?.(x, hit) !== false;
  if (!ok) return releaseTether(m, f);
  const surface = hit.kind === 'surface' ? hit.surface : undefined;
  const piece = surface ? anchorPiece(m, surface) : undefined;
  const local = piece ? { x: hit.point.x - piece.x, y: hit.point.y - piece.y } : undefined;
  f.tether = {
    anchor: hit.point,
    kind,
    ...(kind === 'ledge' ? { ledge: hit.ledge } : {}),
    ...(surface && local ? { surface, local } : {}),
    frame: m.frame,
  };
  emit(m, { type: 'tetherLatch', port: f.port, kind, x: hit.point.x, y: hit.point.y });
  startPull(x);
}

/** Into the reel, keeping the move (and the move frame the line anchored on, for its clip). */
function startPull(x: Ctx): void {
  const { f } = x;
  f.aim = null;
  if (f.ground) leaveGround(x);
  const move = f.move;
  f.tether!.moveFrame = f.actionFrame;
  setAction(x, 'tetherPull');
  f.move = move;
}
