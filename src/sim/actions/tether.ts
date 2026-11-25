import { getFighter } from '../../fighters/registry';
import { Btn, buttonBit } from '../../input/types';
import { HELPLESS_LANDING_LAG, LEDGE_MAX_GRABS, TETHER } from '../constants';
import { consume, isHeld, justPressed } from '../control';
import { emit } from '../events';
import type { Ctx, FighterState, GroundRef } from '../fighter';
import type { MatchState } from '../match';
import { grabLedge, hangPos } from '../movement';
import { posedStage, type PieceState } from '../movingStage';
import { ledgePresent } from '../stage';
import type { Vec } from '../vec';
import { moveOf } from './attack';
import { setAction, type ActionDef } from './registry';

/**
 * Tethers, after the line anchors (tetherCast.ts fires it): the fighter reels in with tetherPull, onto the ledge
 * for a ledge anchor (tether recovery), else to the anchor, where holding `hang` keeps him there (tetherHang).
 * See docs/fighters.md.
 */

/** Where a fighter's tether line leaves the body: TETHER.handHeight of the way up. */
export function tetherOrigin(f: FighterState): Vec {
  return { x: f.pos.x, y: f.pos.y + getFighter(f.fighter).stats.height * TETHER.handHeight };
}

/** A ledge a tether may take: there, not held by anyone, and within the fighter's ledge-grab allowance. */
export function ledgeFree(x: Ctx, i: number): boolean {
  const { f, m, stage } = x;
  return (
    ledgePresent(stage, i) &&
    f.ledgeLock === 0 &&
    f.ledgeGrabs < LEDGE_MAX_GRABS &&
    !m.fighters.some((o) => o !== f && o.ledge === i && o.action.startsWith('ledge'))
  );
}

/** Retract the line (tetherRelease event when there was one) and forget the aim. */
export function releaseTether(m: MatchState, f: FighterState): void {
  if (f.tether) emit(m, { type: 'tetherRelease', port: f.port });
  f.tether = null;
  f.aim = null;
}

/**
 * The stage piece a surface anchor is on: a platform, or the solid that owns the edge index a solid hit
 * carries (GroundRef's index is an edge index for solids).
 */
export function anchorPiece(m: MatchState, surface: GroundRef): PieceState | undefined {
  if (surface.kind === 'platform') return m.stage.platforms[surface.index];
  const solid = posedStage(m).edges[surface.index]?.solid;
  return solid === undefined ? undefined : m.stage.solids[solid];
}

/**
 * Carry a surface anchor with the piece it is on: the anchor is stored as a point within the piece, so a moving
 * platform drags the line (and the hanging fighter) along, and a piece that goes away drops the line.
 */
export function rideAnchor(m: MatchState, f: FighterState): void {
  const t = f.tether;
  if (!t?.surface || !t.local) return;
  const piece = anchorPiece(m, t.surface);
  if (!piece || !piece.on) return releaseTether(m, f);
  t.anchor = { x: t.local.x + piece.x, y: t.local.y + piece.y };
}

/**
 * Before each fighter steps: drop a tether whose fighter left the tether (hit, grabbed, landed, KO'd), so the line
 * only exists while its move or the reel is running.
 */
export function dropLostTether(m: MatchState, f: FighterState): void {
  if (!f.tether && !f.aim) return;
  if (f.action === 'tetherPull' || f.action === 'tetherHang') return;
  if ((f.action === 'attack' || f.action === 'aerial') && moveOf(f)?.tether) return;
  releaseTether(m, f);
}

/** Let go of the anchor into a fall (helpless after a helpless move), keeping the reel's velocity or not. */
function letGo(x: Ctx, momentum: boolean): void {
  const { f } = x;
  const move = moveOf(f);
  releaseTether(x.m, f);
  if (!momentum) f.vel = { x: 0, y: 0 };
  setAction(x, move?.helpless ? 'helpless' : 'fall');
  if (move?.helpless) f.landingLag = move.landingLag ?? HELPLESS_LANDING_LAG;
}

/** Where the reel takes the fighter: the hang position for a ledge, else hand on the anchor. */
function pullTarget(x: Ctx): Vec {
  const { f, s } = x;
  const a = f.tether!;
  if (a.kind === 'ledge' && a.ledge !== undefined) return hangPos(x, a.ledge);
  return { x: a.anchor.x, y: a.anchor.y - s.height * TETHER.handHeight };
}

/** A reel this close to its target has arrived (the last step moves exactly onto it, through collision). */
const ARRIVED = 1e-6;

export const TETHER_ACTIONS: Record<string, ActionDef> = {
  /**
   * Reeling in at `pullSpeed`. A ledge anchor ends in a ledge grab within TETHER.ledgeArrive; another anchor
   * ends in tetherHang if `hang` is held on arrival, else in a fall. A jump press lets go keeping the reel's
   * velocity, and a reel that can't arrive (a wall in the way) gives up after range / pullSpeed + slack frames.
   */
  tetherPull: {
    physics: 'air',
    drift: false,
    gravity: false,
    update(x) {
      const { f, c, m } = x;
      const t = moveOf(f)?.tether;
      if (!t || !f.tether) return letGo(x, false);
      if (justPressed(c, Btn.Jump)) {
        consume(c, Btn.Jump);
        return letGo(x, true);
      }
      const to = pullTarget(x);
      const d = { x: to.x - f.pos.x, y: to.y - f.pos.y };
      const dist = Math.hypot(d.x, d.y);
      if (f.tether.kind === 'ledge' && dist <= TETHER.ledgeArrive) {
        const i = f.tether.ledge!;
        if (!ledgeFree(x, i)) return letGo(x, false);
        releaseTether(m, f);
        return grabLedge(x, i);
      }
      if (f.tether.kind !== 'ledge' && dist <= ARRIVED) {
        f.vel = { x: 0, y: 0 };
        if (!t.hang || !isHeld(c, buttonBit(t.hang))) return letGo(x, false);
        const move = f.move;
        setAction(x, 'tetherHang');
        f.move = move;
        return;
      }
      if (f.actionFrame > Math.ceil(t.range / t.pullSpeed) + TETHER.pullSlack) return letGo(x, false);
      const speed = Math.min(t.pullSpeed, dist);
      f.vel = { x: (d.x / dist) * speed, y: (d.y / dist) * speed };
      f.kb = { x: 0, y: 0 };
    },
  },

  /** Hanging at the anchor while `hang` is held; letting go of it, or a jump press, drops into a fall. */
  tetherHang: {
    physics: 'air',
    drift: false,
    gravity: false,
    update(x) {
      const { f, c, s } = x;
      const t = moveOf(f)?.tether;
      f.vel = { x: 0, y: 0 };
      if (f.tether?.surface)
        f.pos = { x: f.tether.anchor.x, y: f.tether.anchor.y - s.height * TETHER.handHeight };
      if (justPressed(c, Btn.Jump)) consume(c, Btn.Jump);
      else if (t?.hang && f.tether && isHeld(c, buttonBit(t.hang))) return;
      letGo(x, false);
    },
  },
};
