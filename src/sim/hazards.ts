import { getFighter } from '../fighters/registry';
import {
  armorOf,
  guardStageHit,
  hittable,
  hurtbox,
  strike,
  targetable,
  touches,
  type PlacedHitbox,
} from './combat/hits';
import { emit } from './events';
import { inHitlag, type FighterState } from './fighter';
import type { MatchState } from './match';
import { hazardsOn, motionOffset, scheduledOn } from './movingStage';
import type { DamageZone, HazardHit, StageGeometry, StageHitbox, TerrainElement } from './stage';
import { compiledStage } from './step';

/**
 * Stage hazards (docs/stage-geometry.md). Damage zones and stage hitboxes hit fighters through the same strike
 * as a fighter's move (knockback formula, hitlag, launch with DI, hitstun), with no attacker: no staleness, no
 * rage, and only the victim freezes. Shields block them and parries parry them (guardStageHit in
 * src/sim/combat/hits.ts). Conveyors live in groundMove; trapdoors are scheduled pieces flagged
 * `hazard` (src/sim/movingStage.ts). MatchConfig.hazards = false turns all of them off.
 */

/**
 * Each element's default hit, in the pattern of Ultimate's damage floors: set knockback straight up, so a hit
 * pops the fighter out the same height at any %, then the floor waits before it can hit again. Goo is the
 * roster's Forest Temple pool (2% every 10 frames and a weak pop); lava and water launch (12%, tumble).
 */
export const ELEMENT_HITS: Record<TerrainElement, { hit: HazardHit; rehit: number }> = {
  goo: { hit: { damage: 2, angle: 90, kbg: 100, bkb: 0, wbkb: 50 }, rehit: 10 },
  lava: { hit: { damage: 12, angle: 90, kbg: 100, bkb: 0, wbkb: 90, effect: 'fire' }, rehit: 30 },
  water: { hit: { damage: 12, angle: 90, kbg: 100, bkb: 0, wbkb: 90 }, rehit: 30 },
};

/** Frames after a stage hitbox hits before stage hazards can hit that fighter again, unless it sets `rehit`. */
export const STAGE_HITBOX_REHIT = 30;

/** Where a zone is on a match frame, or null while its schedule has it off. */
export function zoneAt(
  z: DamageZone,
  frame: number,
): { x1: number; x2: number; y1: number; y2: number } | null {
  if (!scheduledOn(z.schedule, frame)) return null;
  const [dx, dy] = motionOffset(z.motion, frame);
  return { x1: z.x1 + dx, x2: z.x2 + dx, y1: z.y1 + dy, y2: z.y2 + dy };
}

/** A stage hitbox's boxes in the world on a match frame; none while its schedule has it off. */
export function stageHitboxesAt(h: StageHitbox, frame: number): PlacedHitbox[] {
  if (!scheduledOn(h.schedule, frame)) return [];
  const [dx, dy] = motionOffset(h.motion, frame);
  return h.boxes.map((box) => ({ box, x: h.x + dx + box.x, y: h.y + dy + box.y }));
}

interface Contact {
  source: 'zone' | 'hitbox';
  index: number;
  element: TerrainElement | null;
  hit: HazardHit;
  rehit: number;
  dir: 1 | -1;
  /** Where the hit comes from for a shield's pushback: the zone's middle or the stage hitbox's anchor. */
  fromX: number;
  x: number;
  y: number;
}

const launchDir = (hit: HazardHit, away: number, fallback: 'forward' | 'away'): 1 | -1 =>
  ({ forward: 1, back: -1, away: away || 1 })[hit.direction ?? fallback] as 1 | -1;

/** The first zone the fighter's body overlaps, skipping elements it is immune to. Zones launch away from their middle. */
function zoneContact(geo: StageGeometry, v: FighterState, frame: number): Contact | null {
  const def = getFighter(v.fighter);
  const { width, height } = def.stats;
  const zones = geo.zones ?? [];
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]!;
    const at = zoneAt(z, frame);
    if (!at || def.immune?.includes(z.element)) continue;
    if (v.pos.x + width / 2 <= at.x1 || v.pos.x - width / 2 >= at.x2) continue;
    if (v.pos.y + height <= at.y1 || v.pos.y >= at.y2) continue;
    const hit = z.hit ?? ELEMENT_HITS[z.element].hit;
    if (!targetable(hit, v)) continue;
    const fromX = (at.x1 + at.x2) / 2;
    return {
      source: 'zone',
      index: i,
      element: z.element,
      hit,
      rehit: z.rehit ?? ELEMENT_HITS[z.element].rehit,
      dir: launchDir(hit, Math.sign(v.pos.x - fromX), 'away'),
      fromX,
      x: v.pos.x,
      y: v.pos.y,
    };
  }
  return null;
}

/** The first stage hitbox touching the fighter's hurtbox, lowest box id first. */
function hitboxContact(geo: StageGeometry, v: FighterState, frame: number): Contact | null {
  const body = hurtbox(v, getFighter(v.fighter).stats);
  const hitboxes = geo.hitboxes ?? [];
  for (let i = 0; i < hitboxes.length; i++) {
    const h = hitboxes[i]!;
    const touching = stageHitboxesAt(h, frame).filter((p) => targetable(p.box, v) && touches(p, body));
    const first = touching.sort((p, q) => p.box.id - q.box.id)[0];
    if (!first) continue;
    const fromX = h.x + motionOffset(h.motion, frame)[0];
    return {
      source: 'hitbox',
      index: i,
      element: null,
      hit: first.box,
      rehit: h.rehit ?? STAGE_HITBOX_REHIT,
      dir: launchDir(first.box, Math.sign(v.pos.x - fromX), 'forward'),
      fromX,
      x: first.x,
      y: first.y,
    };
  }
  return null;
}

/**
 * After the fighters' hits and before grabs are resolved (resolveHits): each fighter a hazard touches takes that
 * hazard's hit and joins `struck`, at most one stage hit per frame and none while `stageHitLock` (the hazard's
 * `rehit`) runs. Hazards skip intangible fighters and fighters already in hitlag; a fighter frozen by a status
 * (StatusDef.freeze, paralysis) is still hit once its hitlag is over. A raised shield blocks them and a shield drop's
 * parry window parries them, as it does any hit (guardStageHit), with `shieldHit` or `parry` and no
 * `stageHit`; the rehit wait still follows.
 *
 * Armor takes them like any hit. SmashWiki, Armor: "Armor is the concept of sustaining hitlag and damage, but not
 * sustaining any (or sustaining reduced) knockback", and "Grab hitboxes ignore all variations of armor." A hazard
 * is a hitbox, not a grab.
 *
 * Counters don't catch them: a hazard goes through an open counter (MoveDef.counter, docs/fighters.md). SmashWiki
 * gives no rule for hazards (docs/stage-geometry.md).
 */
export function stageHits(m: MatchState, struck: Set<FighterState>): void {
  for (const f of m.fighters) if (f.stageHitLock > 0) f.stageHitLock--;
  if (!hazardsOn(m)) return;
  const geo = compiledStage(m.config.stage).geo;
  if (!geo.zones && !geo.hitboxes) return;
  const frame = m.frame + 1;
  for (const v of m.fighters) {
    if (v.stageHitLock > 0 || inHitlag(m, v) || !hittable(v)) continue;
    const c = zoneContact(geo, v, frame) ?? hitboxContact(geo, v, frame);
    if (!c) continue;
    v.stageHitLock = c.rehit;
    struck.add(v);
    if (guardStageHit(m, v, { box: c.hit, fromX: c.fromX, dir: c.dir, at: { x: c.x, y: c.y } })) continue;
    const { kb, added } = strike(
      m,
      v,
      {
        box: c.hit,
        damage: c.hit.damage,
        stale: 1,
        rage: 1,
        dir: c.dir,
        percent: v.damage,
        crouch: v.action === 'crouch' && v.ground !== null,
        armor: armorOf(v),
      },
      false,
    );
    emit(m, {
      type: 'stageHit',
      victim: v.port,
      source: c.source,
      index: c.index,
      element: c.element,
      damage: added,
      kb,
      x: c.x,
      y: c.y,
    });
  }
}
