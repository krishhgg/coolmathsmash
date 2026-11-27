import type { HitboxDef } from '../fighters/types';
import { neutralInput } from '../input/types';
import { entityDef, entityHitboxes, spawnEntity } from '../sim/entities/entities';
import type { EntityState } from '../sim/entities/types';
import type { FighterState } from '../sim/fighter';
import { stepMatch, type MatchState } from '../sim/match';
import type { MoveProbe, ProbeSpawn } from './knowledge';
import { overlaps, setEntities, soloMatch, type Sample } from './look';

/**
 * Projectiles. A move's probe says what it spawns: each entity's kind, frame, offset, velocity and hitbox. To see
 * whether a shot meets the target, the CPU puts those entities out where they would appear on a copy of the match
 * (the stage as it stands on this frame, the CPU's own fighter as their owner), each as it was at the end of its
 * first frame in the probe, and plays their flight frame by frame against the target's predicted path. Bounces,
 * bursts, falls past the ledge and moving platforms come out as the simulation has them. So do the shots the other
 * fighters already have out: one that meets the CPU's shot clanks with it there as it will in the match (Ultimate's 9%
 * rule, src/sim/entities/contacts.ts), and a shot that only clanks is no hit.
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
  /** Other fighters' shots out in the match that the CPU has seen (seenShots). */
  seen?: readonly EntityState[];
  /** Shots the target is about to put out, as the CPU's prediction of it has them, in the order they appear. */
  shots?: readonly ForeseenShot[];
}

/**
 * A shot an opponent is about to put out, from the CPU's prediction of it (cpu.ts, foresee): the frame from now, counted
 * as in ShotTarget.path, on which it appears, and the entity as it is then, owned by the opponent's port.
 */
export interface ForeseenShot {
  t: number;
  e: EntityState;
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
  joinFoes(m, state, me, target.seen ?? []);
  // The other fighters' shots only have to meet this one: the CPU's fighter in the copy lets them through untouched,
  // so they keep their own hit history (Johnny's upgraded laser bursts on the first fighter it hits).
  m.fighters[0]!.intangible = Number.MAX_SAFE_INTEGER;
  const coming = target.shots ?? [];
  let nextFoe = 0;
  // The CPU's entities from here on are the move's (and what they spawn); those before are the platforms soloMatch
  // copied.
  const from = m.nextEntityId;
  const end = target.path.length;
  const struck = new Set<number>();
  let hit: ShotHit | null = null;
  let next = 0;
  for (let t = 0; t < end; t++) {
    stepMatch(m, NEUTRAL);
    const appear: EntityState[] = [];
    for (; nextFoe < coming.length && coming[nextFoe]!.t <= t; nextFoe++) {
      if (coming[nextFoe]!.t === t)
        appear.push({ ...coming[nextFoe]!.e, id: m.nextEntityId++, hitVictims: [] });
    }
    joinFoes(m, state, me, appear);
    for (; next < p.spawns.length && offset + p.spawns[next]!.t === t; next++) {
      const s = p.spawns[next]!;
      const pos = place(s, t);
      const n = out.get(s.kind) ?? 0;
      if (!pos || (s.max !== undefined && n >= s.max)) continue;
      out.set(s.kind, n + 1);
      const e = spawnEntity(m, { kind: s.kind, owner: 0, pos, move: p.plays });
      Object.assign(e, {
        age: 1,
        vel: { x: s.vx * facing, y: s.vy },
        facing: (s.facing * facing) as 1 | -1,
        lifetime: s.lifetime,
        damageMul: s.damageMul,
        data: { ...s.data },
      });
    }
    const live = m.entities.filter((e) => e.owner === 0 && e.id >= from && !struck.has(e.id));
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
      // The sim deals the box's damage times the entity's multiplier (a charged Aimed Shot), and knockback follows.
      const box = e.damageMul === 1 ? b.box : { ...b.box, damage: b.box.damage * e.damageMul };
      hit ??= { t, box, damage: 0, facing: e.facing, x: e.pos.x };
      hit.damage += box.damage;
    }
    if (hit && p.spawns.length === 1) break;
  }
  return hit;
}

/**
 * The first frame from now that another fighter's shot, seen out (`seen`) or foreseen (`coming`), would hit `me` if it
 * did nothing, and the last frame of the hits that follow it (a burst's), each within BURST_GAP frames of the last;
 * null when none hits within `frames`. They are played out on a copy of the match with the CPU's own shots in it too,
 * so one that its own shot meets and clanks first is no threat. The CPU defends against it as against an attack
 * (cpu.ts, defend), rather than answering it with a shot of its own that clanks.
 */
export function shotThreat(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  seen: readonly EntityState[],
  coming: readonly ForeseenShot[],
  frames: number,
): { t: number; until: number } | null {
  if (!seen.length && !coming.length) return null;
  const m = soloMatch(state, me);
  joinOwn(m, state, me);
  joinFoes(m, state, me, seen);
  let next = 0;
  let hit: { t: number; until: number } | null = null;
  for (let t = 0; t < frames; t++) {
    stepMatch(m, NEUTRAL);
    const appear: EntityState[] = [];
    for (; next < coming.length && coming[next]!.t <= t; next++) {
      if (coming[next]!.t === t) appear.push({ ...coming[next]!.e, id: m.nextEntityId++, hitVictims: [] });
    }
    joinFoes(m, state, me, appear);
    if (m.events.some((e) => e.type === 'hit' && e.victim === 0 && e.entity !== undefined)) {
      hit = hit ? { t: hit.t, until: t } : { t, until: t };
    } else if (hit && t - hit.until > BURST_GAP) break;
  }
  return hit;
}

/** Frames between two hits of one shot (Johnny's upgraded laser bursts into a hit every 6 frames) that still run on. */
const BURST_GAP = 8;

/**
 * The shots other fighters have out (not the platforms soloMatch copies, nor the stage's items) that the CPU has seen:
 * those out `lag` frames ago, its reaction time, as it sees the fighters. One put out since then it knows only as its
 * prediction of the opponent has it (ShotTarget.shots).
 */
export function seenShots(
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  lag: number,
): EntityState[] {
  return state.entities.filter(
    (e) => foe(state, me, e.owner) && !e.dead && e.age > lag && !entityDef(e.kind).platform,
  );
}

/** Whether `port` is another fighter's (an item the stage put out has no fighter's port). */
function foe(state: Readonly<MatchState>, me: Readonly<FighterState>, port: number): boolean {
  return port !== me.port && state.fighters.some((f) => f.port === port);
}

/**
 * Add other fighters' shots to `m`, a soloMatch of `me`, alongside any already there, so the CPU's shots meet them as
 * they will in the match. Each other fighter's shots go under a stand-in port of its own (setEntities), the first
 * other fighter by port on port 1, the next on port 2, so two opponents' shots still clank with each other.
 */
function joinFoes(
  m: MatchState,
  state: Readonly<MatchState>,
  me: Readonly<FighterState>,
  shots: readonly EntityState[],
): void {
  const others = state.fighters.filter((f) => f.port !== me.port);
  others.forEach((owner, i) => {
    const theirs = shots.filter((e) => e.owner === owner.port);
    if (theirs.length) setEntities(m, owner, theirs, me.port, true, 1 + i);
  });
}

/**
 * Add the shots `me` has out to `m`, a soloMatch of it, as its own (port 0): they meet the other fighters' shots there
 * as in the match. They keep their ids and their hits so far, those on other fighters under ports the copy doesn't
 * hold.
 */
function joinOwn(m: MatchState, state: Readonly<MatchState>, me: Readonly<FighterState>): void {
  for (const e of state.entities) {
    if (e.owner !== me.port || e.dead || entityDef(e.kind).platform) continue;
    m.entities.push({
      ...structuredClone(e),
      owner: 0,
      hitVictims: e.hitVictims.map((p) => OTHERS + p),
    });
    m.nextEntityId = Math.max(m.nextEntityId, e.id + 1);
  }
}

/** Ports the copy doesn't hold, standing in for the fighters a shot of the CPU's has already hit (OTHERS + port). */
const OTHERS = 100;

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
