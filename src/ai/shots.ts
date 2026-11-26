import type { HitboxDef } from '../fighters/types';
import { neutralInput } from '../input/types';
import { entityHitboxes, spawnEntity } from '../sim/entities/entities';
import type { FighterState } from '../sim/fighter';
import { stepMatch, type MatchState } from '../sim/match';
import type { MoveProbe, ProbeSpawn } from './knowledge';
import { overlaps, soloMatch, type Sample } from './look';

/**
 * Projectiles. A move's probe says what it spawns: each entity's kind, frame, offset, velocity and hitbox. To see
 * whether a shot meets the target, the CPU puts those entities out where they would appear on a copy of the match
 * (the stage as it stands on this frame, the CPU's own fighter as their owner), each as it was at the end of its
 * first frame in the probe, and plays their flight frame by frame against the target's predicted path. Bounces,
 * bursts, falls past the ledge and moving platforms come out as the simulation has them.
 */

/** Hitbox-to-hurtbox margin, as for the fighter's own hitboxes (options.ts). */
const MARGIN = -0.5;
/** Slack around the probe's reach before a flight is worth playing out. */
const PAD = 6;
const NEUTRAL = [neutralInput()];
const GONE = new Set(['ko', 'out', 'respawn']);

/** Where a spawn appears when its move is input `offset` frames from now, `t` frames from now; null if it doesn't. */
export type Place = (s: ProbeSpawn, t: number) => { x: number; y: number } | null;

export interface ShotTarget {
  /** Predicted target, t = 0 being the frame about to be simulated. */
  path: Sample[];
  errX: number;
}

/**
 * A shot that meets the target: the first frame and hitbox it does, and the damage of every entity of it that does.
 * `facing` and `x` are that first entity's facing and position as it hits, which the sim launches from
 * (`launchDir` in src/sim/combat/hits.ts): a back aerial's shot faces away from its fighter.
 */
export interface ShotHit {
  t: number;
  box: HitboxDef;
  damage: number;
  facing: 1 | -1;
  x: number;
}

/**
 * First frame (from now) and hitbox with which an entity of move `p`, input `offset` frames from now facing `facing`,
 * touches the target; null when none does within the path. A volley (several spawns) plays on to add up every entity
 * that would also connect. Entities over the move's `max` that the CPU already has out are not spawned, as the sim
 * skips them.
 */
export function shotHit(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  p: MoveProbe,
  offset: number,
  facing: 1 | -1,
  place: Place,
  target: ShotTarget,
): ShotHit | null {
  const first = p.spawns[0];
  if (!p.shot || !first) return null;
  const at = place(first, offset + first.t);
  if (!at || !inReach(p, at.x - first.ox * facing, offset, facing, target)) return null;
  const out = new Map<string, number>();
  for (const e of state.entities)
    if (e.owner === me.port && !e.dead) out.set(e.kind, (out.get(e.kind) ?? 0) + 1);
  const m = soloMatch(state, me);
  const end = target.path.length;
  const struck = new Set<number>();
  let hit: ShotHit | null = null;
  let next = 0;
  for (let t = 0; t < end; t++) {
    stepMatch(m, NEUTRAL);
    for (; next < p.spawns.length && offset + p.spawns[next]!.t === t; next++) {
      const s = p.spawns[next]!;
      const pos = place(s, t);
      const n = out.get(s.kind) ?? 0;
      if (!pos || (s.max !== undefined && n >= s.max)) continue;
      out.set(s.kind, n + 1);
      const e = spawnEntity(m, { kind: s.kind, owner: 0, pos, move: p.move });
      Object.assign(e, {
        age: 1,
        vel: { x: s.vx * facing, y: s.vy },
        facing: (s.facing * facing) as 1 | -1,
        lifetime: s.lifetime,
        data: { ...s.data },
      });
    }
    const live = m.entities.filter((e) => !struck.has(e.id));
    if (!live.length) {
      if (next >= p.spawns.length) break;
      continue;
    }
    const s = target.path[t]!;
    if (s.intangible || GONE.has(s.action)) continue;
    const hurt = { ...s.hurt, x: s.hurt.x + target.errX };
    for (const e of live) {
      const b = entityHitboxes(m, e).find(
        (b) => !b.box.pushOnly && targets(b.box, s) && overlaps(b.x, b.y, b.box.radius, hurt, MARGIN),
      );
      if (!b) continue;
      struck.add(e.id);
      hit ??= { t, box: b.box, damage: 0, facing: e.facing, x: e.pos.x };
      hit.damage += b.box.damage;
    }
    if (hit && p.spawns.length === 1) break;
  }
  return hit;
}

/** Whether `box` can hit the target where it is predicted to be: on the ground, or airborne (HitboxDef.targets). */
function targets(box: HitboxDef, s: Sample): boolean {
  const only = box.targets ?? 'both';
  return only === 'both' || (only === 'ground') === s.grounded;
}

/**
 * Whether the target comes within the probe's horizontal reach of the move's entities (measured from the fighter
 * when the first one appears, here at `baseX`) any time after they are first out. A cheap test before the flight.
 */
function inReach(p: MoveProbe, baseX: number, offset: number, facing: 1 | -1, target: ShotTarget): boolean {
  const r = p.shot!;
  const lo = baseX + (facing > 0 ? r.x1 : -r.x2) - PAD;
  const hi = baseX + (facing > 0 ? r.x2 : -r.x1) + PAD;
  for (let t = offset + r.from; t < target.path.length; t++) {
    const h = target.path[t]!.hurt;
    const x = h.x + target.errX;
    if (x + h.r >= lo && x - h.r <= hi) return true;
  }
  return false;
}
