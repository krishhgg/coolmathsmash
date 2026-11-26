import { getFighter } from '../fighters/registry';
import type { FighterStats } from '../fighters/types';
import { neutralInput, type InputFrame } from '../input/types';
import { isIntangible } from '../sim/actions/registry';
import { activeHitboxes, hurtbox, type Hurtbox, type PlacedHitbox } from '../sim/combat/hits';
import { LAUNCH_DECAY } from '../sim/combat/formulas';
import { createControl, type ControlState } from '../sim/control';
import type { EntityState } from '../sim/entities/types';
import { createFighter, type FighterState } from '../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../sim/match';

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

/**
 * A one-fighter copy of the match holding a clone of `f` (and of its controller, when given), on the same frame of
 * the stage with the same hazards setting, so moving pieces, schedules and hazards play out as they will.
 */
export function soloMatch(
  state: Readonly<MatchState>,
  f: Readonly<FighterState>,
  control?: Readonly<ControlState>,
): MatchState {
  const m = createMatch({
    seed: 1,
    stage: state.config.stage,
    stocks: Math.max(1, f.stocks),
    ports: [{ fighter: f.fighter, tapJump: state.players[f.port]?.tapJump ?? true }],
    hazards: state.config.hazards,
  });
  m.frame = state.frame;
  m.stage = state.stage;
  m.fighters[0] = { ...structuredClone(f as FighterState), port: 0 };
  if (control) m.players[0]!.control = structuredClone(control as ControlState);
  return m;
}

/** The port that stands in for the owner of the entities setEntities puts into a look-ahead. */
const OWNER = 1;

/**
 * Make `entities` (fighter `owner`'s, as they were on some frame of the match) the ones `owner` has out in `m`, a
 * soloMatch of another fighter (`victim`, its port in the match), in place of any it had, so their hits land on that
 * fighter as they will: a grenade bursts on it, a shot already in the air connects. The first call adds a port
 * standing in for the owner, out of play (as with no stocks left) where it stands, so nothing hits, grabs or pushes
 * it; it gives the entities what they read from their owner: its rage, its stale queue, and where it is for one that
 * flies home. The copies keep their ids and their hits so far. Nothing changes while the owner has nothing out.
 */
export function setEntities(
  m: MatchState,
  owner: Readonly<FighterState>,
  entities: readonly Readonly<EntityState>[],
  victim: number,
): void {
  if (m.fighters.length <= OWNER) {
    if (!entities.length) return;
    m.config.ports.push({ fighter: owner.fighter });
    m.players.push({ port: OWNER, tapJump: true, control: createControl() });
    m.fighters.push({
      ...createFighter(OWNER, owner.fighter, [owner.pos.x, owner.pos.y, owner.facing], 0),
      action: 'out',
      damage: owner.damage,
      staleQueue: [...owner.staleQueue],
    });
  }
  m.entities = m.entities.filter((e) => e.owner !== OWNER);
  for (const e of entities) {
    const hitVictims = e.hitVictims.includes(victim) ? [0] : [];
    m.entities.push({ ...structuredClone(e as EntityState), owner: OWNER, hitVictims });
    m.nextEntityId = Math.max(m.nextEntityId, e.id + 1);
  }
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
    const speed = Math.hypot(kbx, kby);
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
