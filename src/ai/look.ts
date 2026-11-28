import { getFighter } from '../fighters/registry';
import type { FighterStats } from '../fighters/types';
import { neutralInput, type InputFrame } from '../input/types';
import { isIntangible } from '../sim/actions/registry';
import { activeHitboxes, hurtbox, oneVOne, type Hurtbox, type PlacedHitbox } from '../sim/combat/hits';
import { LAUNCH_DECAY } from '../sim/combat/formulas';
import { createControl, type ControlState } from '../sim/control';
import { entityDef } from '../sim/entities/entities';
import type { EntityState } from '../sim/entities/types';
import { createFighter, type FighterState } from '../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import * as SimMath from '../sim/math';

/**
 * Looking ahead. The simulation is deterministic and cheap, so the CPU predicts a fighter by running a copy of it
 * alone on the stage: exact for anything committed (launches, attacks, recoveries), a guess for anything that
 * depends on future inputs. Nothing here touches the real match.
 */

/** A fighter on one future frame. */
export interface Sample {
  x: number;
  y: number;
  vx: number;
  vy: number;
  action: string;
  actionFrame: number;
  move: string | null;
  grounded: boolean;
  facing: 1 | -1;
  hurt: Hurtbox;
  intangible: boolean;
  boxes: PlacedHitbox[];
  ledge: number;
  hitstun: number;
  landingLag: number;
  jumpsUsed: number;
}

/** Input for frame `t` of a look-ahead, given the fighter as it stands before that frame. */
export type Driver = (t: number, f: Readonly<FighterState>) => InputFrame;

const idle: Driver = () => neutralInput();

/** The port that stands in for the owner of the entities setEntities puts into a look-ahead, by default. */
const OWNER = 1;
/** Stand-in ports setEntities may be given: one for each other fighter in a four-player match (OWNER to OWNER + 2). */
const STAND_INS = 3;
/**
 * Where setEntities files an entity's hit on a fighter the look-ahead doesn't hold: real port p becomes ABSENT + p,
 * a port no fighter there has, so the hit still counts (an entity that pierces doesn't hit that fighter again, and
 * one that reacts to having hit, like Johnny's upgraded laser bursting, still does) without touching anyone.
 */
const ABSENT = OWNER + STAND_INS;

/**
 * A one-fighter copy of the match holding a clone of `f` (and of its controller, when given), on the same frame of
 * the stage and of its clock with the same hazards setting, so moving pieces, schedules and hazards play out as they
 * will. It keeps the match's 1v1 damage rule (MatchConfig.oneVOne), which counts players.
 *
 * The entities fighters stand on (EntityDef.platform, such as a Duck Raft) come too, whoever put them out, so `f` lands
 * on them and stays on the one it stands on. Nothing else that is out comes: no shots, bursts or other hits. The copies
 * keep their ids, which a fighter's ground names (GroundRef), and their wear, so a raft wears out in the copy when it
 * would in the match. `f`'s own are port 0's, as `f` is, so one it put down in the air catches it as in the match
 * (collide). Anyone else's go under a port the copy doesn't hold (ABSENT + their port), so `f`'s hits and shots still
 * land on them.
 *
 * `others` come too, as they are, on ports 1 and up, and get no input: the recovery planner keeps whoever holds a
 * ledge, so the ledge is taken there as in the match. A copy with others doesn't go through setEntities, whose OWNER
 * port would be one of them; their entities' ports are pushed past theirs.
 */
export function soloMatch(
  state: Readonly<MatchState>,
  f: Readonly<FighterState>,
  control?: Readonly<ControlState>,
  others: readonly Readonly<FighterState>[] = [],
): MatchState {
  const m = createMatch({
    seed: 1,
    stage: state.config.stage,
    stocks: Math.max(1, f.stocks),
    ports: [
      { fighter: f.fighter, tapJump: state.players[f.port]?.tapJump ?? true },
      ...others.map((o) => ({ fighter: o.fighter })),
    ],
    hazards: state.config.hazards,
    oneVOne: oneVOne(state),
  });
  m.frame = state.frame;
  m.stage = state.stage;
  m.stageFrame = state.stageFrame;
  m.fighters[0] = { ...structuredClone(f as FighterState), port: 0 };
  others.forEach((o, i) => (m.fighters[i + 1] = { ...structuredClone(o as FighterState), port: i + 1 }));
  if (control) m.players[0]!.control = structuredClone(control as ControlState);
  const kept = (p: number) => others.findIndex((o) => o.port === p);
  const port = (p: number) =>
    p === f.port ? 0 : kept(p) >= 0 ? kept(p) + 1 : p < 0 ? p : ABSENT + others.length + p;
  for (const e of state.entities) {
    if (e.dead || !entityDef(e.kind).platform) continue;
    m.entities.push({
      ...structuredClone(e),
      owner: port(e.owner),
      hitVictims: e.hitVictims.map(port),
    });
    m.nextEntityId = Math.max(m.nextEntityId, e.id + 1);
  }
  return m;
}

/**
 * Make `entities` (fighter `owner`'s, as they were on some frame of the match) the ones `owner` has out in `m`, a
 * soloMatch of another fighter (`victim`, its port in the match), in place of any it had, so their hits land on that
 * fighter as they will: a grenade bursts on it, a shot already in the air connects. That takes out the copies of the
 * owner's entity platforms soloMatch put in. The first call with entities adds a port standing in for the owner, out
 * of play (as with no stocks left), so nothing hits, grabs or pushes it; each call sets it to `owner` as given. It
 * gives the entities what they read from their owner: its rage, its stale queue, and where it is for one that flies
 * home. The copies keep their ids and their hits so far, those on other fighters under ports the look-ahead doesn't
 * hold (ABSENT). With `keep`, the owner's entities already in `m` stay and these join them, and the owner's platforms
 * soloMatch copied in (under ABSENT + its port) move to the stand-in with them: a fighter's shot passes over its own
 * raft in the match, and would hit it here under two owners. `standIn` is the port that stands in for the owner
 * (OWNER and the STAND_INS - 1 after it): several owners need one each, or their entities, all under one port, would
 * let each other through where they clank in the match.
 */
export function setEntities(
  m: MatchState,
  owner: Readonly<FighterState>,
  entities: readonly Readonly<EntityState>[],
  victim: number,
  keep = false,
  standIn = OWNER,
): void {
  if (standIn < OWNER || standIn >= OWNER + STAND_INS) throw new Error(`no stand-in port ${standIn}`);
  if (!keep) m.entities = m.entities.filter((e) => e.owner !== standIn && e.owner !== ABSENT + owner.port);
  if (m.fighters.length <= standIn) {
    if (!entities.length) return;
    while (m.fighters.length <= standIn) {
      const port = m.fighters.length;
      m.config.ports.push({ fighter: owner.fighter });
      m.players.push({ port, tapJump: true, control: createControl() });
      m.fighters.push({ ...createFighter(port, owner.fighter, [0, 0, 1], 0), action: 'out' });
    }
  }
  if (keep) for (const e of m.entities) if (e.owner === ABSENT + owner.port) e.owner = standIn;
  Object.assign(m.fighters[standIn]!, {
    pos: { ...owner.pos },
    prevPos: { ...owner.pos },
    facing: owner.facing,
    damage: owner.damage,
    staleQueue: [...owner.staleQueue],
  });
  for (const e of entities) {
    const hitVictims = e.hitVictims.map((p) => (p === victim ? 0 : ABSENT + p));
    m.entities.push({ ...structuredClone(e as EntityState), owner: standIn, hitVictims });
    m.nextEntityId = Math.max(m.nextEntityId, e.id + 1);
  }
}

/** A fighter and the entities it had out, on one frame of a match (what the CPU remembers of itself). */
export interface OwnFrame {
  f: Readonly<FighterState>;
  entities: readonly Readonly<EntityState>[];
}

/**
 * `run` for `m`, a soloMatch of a fighter (`victim`, its port in the match) as it was `lag` frames ago, with another
 * fighter's entities playing out too, so their hits move it. `mine` holds that fighter's last frames, the latest
 * last. Its entities start as they were `lag` frames ago, with the fighter as it was then standing in as their owner,
 * so one that has hit since still hits, staled and raged as it was. When the run reaches the latest frame, the
 * entities out then replace them and the stand-in takes the fighter as it is. `each` sees `m` after every frame.
 */
export function runAmong(
  m: MatchState,
  frames: number,
  drive: Driver,
  lag: number,
  mine: readonly OwnFrame[],
  victim: number,
  each?: (t: number) => void,
): Sample[] {
  const at = (back: number) => mine[mine.length - 1 - back]!;
  return run(
    m,
    frames,
    (t, f) => {
      if (t === 0 || t === lag) setEntities(m, at(lag - t).f, at(lag - t).entities, victim);
      return drive(t, f);
    },
    each &&
      ((_, t) => {
        each(t);
        return false;
      }),
  );
}

export function sample(f: Readonly<FighterState>, stats: FighterStats): Sample {
  return {
    x: f.pos.x,
    y: f.pos.y,
    vx: f.vel.x + f.kb.x,
    vy: f.vel.y + f.kb.y,
    action: f.action,
    actionFrame: f.actionFrame,
    move: f.move,
    grounded: f.ground !== null,
    facing: f.facing,
    hurt: hurtbox(f, stats),
    intangible: isIntangible(f),
    boxes: activeHitboxes(f),
    ledge: f.ledge,
    hitstun: f.hitstun,
    landingLag: f.landingLag,
    jumpsUsed: f.jumpsUsed,
  };
}

/** Step a solo match `frames` times with `drive`, sampling the fighter after each frame; stop early when `until` holds. */
export function run(
  m: MatchState,
  frames: number,
  drive: Driver = idle,
  until?: (f: Readonly<FighterState>, t: number) => boolean,
): Sample[] {
  const out: Sample[] = [];
  const inputs = [neutralInput()];
  for (let t = 0; t < frames; t++) {
    inputs[0] = drive(t, m.fighters[0]!);
    stepMatch(m, inputs);
    const g = m.fighters[0]!;
    out.push(sample(g, getFighter(g.fighter).stats));
    if (g.action === 'ko' || g.action === 'out') break;
    if (until?.(g, t)) break;
  }
  return out;
}

/** One of runBranches' runs: its driver, and when it stops (as `run`'s `until`). */
export interface Branch {
  drive: Driver;
  until?: (f: Readonly<FighterState>, t: number) => boolean;
}

/**
 * `run` for several drivers from the same start (`m`, a solo match) at once, each getting the samples `run` would give
 * it. Drivers that have pressed the same inputs so far share a copy of the match, so the frames they have in common
 * are simulated once; where their inputs part, the copy is cloned for each new input before it steps. Drivers that
 * agree share sample objects (read them, don't change them). The sim is deterministic, so a shared frame comes out as
 * it would have alone.
 */
export function runBranches(m: MatchState, frames: number, branches: readonly Branch[]): Sample[][] {
  const r = branchRun(m, frames, branches);
  r.advance(Infinity);
  return r.paths;
}

/** runBranches played a few frames at a time: `advance` until it says it is done, then read `paths`. */
export interface BranchRun {
  /**
   * Play whole frames of every driver still going until `budget` simulated frames are spent or every driver has
   * stopped. A frame is never split, so it can go over by one frame's worth. True once every driver has stopped.
   */
  advance(budget: number): boolean;
  /** Every driver's samples: complete once `advance` has returned true. */
  readonly paths: Sample[][];
}

export function branchRun(m: MatchState, frames: number, branches: readonly Branch[]): BranchRun {
  const out: Sample[][] = branches.map(() => []);
  let live: { m: MatchState; members: number[]; path: Sample[] }[] = [
    { m, members: branches.map((_, i) => i), path: [] },
  ];
  const inputs = [neutralInput()];
  let t = 0;
  const done = () => {
    if (t < frames && live.length) return false;
    // Drivers still going when the frames run out.
    for (const b of live) for (const i of b.members) out[i] = b.path;
    live = [];
    return true;
  };
  return {
    paths: out,
    advance(budget) {
      let spent = 0;
      while (!done() && spent < budget) {
        const next: typeof live = [];
        for (const b of live) {
          const f = b.m.fighters[0]!;
          const parts: { input: InputFrame; members: number[] }[] = [];
          for (const i of b.members) {
            const input = branches[i]!.drive(t, f);
            const same = parts.find((p) => sameInput(p.input, input));
            if (same) same.members.push(i);
            else parts.push({ input, members: [i] });
          }
          // Copy the match and the path so far for each new input, before the first copy steps on.
          const copies = parts.map((_, k) => (k === 0 ? b.m : structuredClone(b.m)));
          const paths = parts.map((_, k) => (k === 0 ? b.path : b.path.slice()));
          parts.forEach((p, k) => {
            const pm = copies[k]!;
            const path = paths[k]!;
            inputs[0] = p.input;
            stepMatch(pm, inputs);
            spent++;
            const g = pm.fighters[0]!;
            path.push(sample(g, getFighter(g.fighter).stats));
            const over = g.action === 'ko' || g.action === 'out';
            const going: number[] = [];
            const stopped: number[] = [];
            for (const i of p.members) (over || branches[i]!.until?.(g, t) ? stopped : going).push(i);
            // Drivers that stop here keep the path as it is now; the rest go on adding to it.
            const kept = going.length ? path.slice() : path;
            for (const i of stopped) out[i] = kept;
            if (going.length) next.push({ m: pm, members: going, path });
          });
        }
        live = next;
        t++;
      }
      return done();
    },
  };
}

/**
 * Whether two values of plain match data (a MatchState and everything in it) are the same all the way down: the same
 * keys, numbers equal bit for bit (0 and -0 differ, NaN equals NaN), arrays, Maps and Sets the same throughout.
 */
export function sameState(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !sameState(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && sameState(ra[k], rb[k]));
}

function sameInput(a: InputFrame, b: InputFrame): boolean {
  return a.x === b.x && a.y === b.y && a.cx === b.cx && a.cy === b.cy && a.buttons === b.buttons;
}

/** Air motion without collisions, the way airMove integrates it: drift, then move, decay, gravity. */
export interface Arc {
  x: number[];
  y: number[];
}

export interface ArcStart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kbx?: number;
  kby?: number;
  /** Frames still on the ground before take-off (jump squat), during which vx carries the fighter. */
  squat?: number;
  /** Vertical take-off speed after the squat. */
  takeoff?: number;
}

/**
 * Positions over `frames` frames holding `stick` (-1..1, world x). With `squat`/`takeoff` it models a grounded
 * jump: the fighter slides for the squat, then leaves the ground with Ultimate's take-off speed rule. A fast fall
 * from frame `fastFallFrom` once falling.
 */
export function arc(
  s: FighterStats,
  start: ArcStart,
  stick: number,
  frames: number,
  fastFallFrom = Infinity,
): Arc {
  let { x, y, vx, vy } = start;
  let kbx = start.kbx ?? 0;
  let kby = start.kby ?? 0;
  const xs: number[] = [];
  const ys: number[] = [];
  let fast = false;
  const squat = start.squat ?? 0;
  for (let t = 0; t < frames; t++) {
    if (t < squat) {
      x += vx;
      xs.push(x);
      ys.push(y);
      continue;
    }
    if (t === squat && start.takeoff !== undefined) {
      const max = s.airSpeed * 1.2;
      vx = Math.min(max, Math.max(-max, vx * 0.85 + stick * 0.3));
      vy = start.takeoff;
    } else if (!fast && t >= fastFallFrom && vy <= 0) {
      fast = true;
      vy = -s.fastFallSpeed;
    }
    const ax = Math.abs(stick) < 0.2 ? 0 : stick;
    if (ax === 0) vx = approach(vx, 0, s.airFriction);
    else if (Math.abs(vx) > s.airSpeed && Math.sign(vx) === Math.sign(ax))
      vx = approach(vx, Math.sign(vx) * s.airSpeed, s.airFriction);
    else vx = approach(vx, ax * s.airSpeed, s.airAccelBase + s.airAccelAdd * Math.abs(ax));
    x += vx + kbx;
    y += vy + kby;
    const speed = SimMath.hypot(kbx, kby);
    const k = speed > LAUNCH_DECAY ? (speed - LAUNCH_DECAY) / speed : 0;
    kbx *= k;
    kby *= k;
    vy = Math.max(vy - s.gravity, -s.fallSpeed);
    if (fast) vy = -s.fastFallSpeed;
    xs.push(x);
    ys.push(y);
  }
  return { x: xs, y: ys };
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

/** A circle (hitbox) against a capsule (hurtbox), grown by `margin`. */
export function overlaps(bx: number, by: number, r: number, h: Hurtbox, margin = 0): boolean {
  const y = Math.min(Math.max(by, h.y1), h.y2);
  const rr = r + h.r + margin;
  return (bx - h.x) ** 2 + (by - y) ** 2 <= rr * rr;
}

/** A hurtbox moved to stand at (x, y). */
export function hurtAt(h: Hurtbox, fromX: number, fromY: number, x: number, y: number): Hurtbox {
  return { x: h.x - fromX + x, y1: h.y1 - fromY + y, y2: h.y2 - fromY + y, r: h.r };
}
