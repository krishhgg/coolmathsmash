import { getFighter } from '../fighters/registry';
import type { FighterDef, FighterStats, HitboxDef, MoveDef } from '../fighters/types';
import { neutralInput, type InputFrame } from '../input/types';
import { SMASH_CHARGE_FRAMES } from '../sim/actions/charge';
import { activeHitboxes } from '../sim/combat/hits';
import { entityHitboxes } from '../sim/entities/entities';
import type { EntityState } from '../sim/entities/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { hintsFor, type CpuHints } from './hints';
import {
  AERIALS,
  AIR_INPUTS,
  DASH_INPUTS,
  GROUND_INPUTS,
  GROUND_MOVES,
  SPECIALS,
  STICK,
  press,
} from './inputs';
import { staticStage } from './stage';

/**
 * What a CPU knows about a fighter, learned by trying every move once in a private copy of the simulation: when
 * its hitboxes come out, where they reach, what it spawns (projectiles), how it moves the fighter and how long it
 * leaves the fighter busy. Read from the registry and the real move code, so a new fighter needs no AI changes.
 */

/** A hitbox relative to the fighter on that frame, facing right. */
export interface LocalBox {
  x: number;
  y: number;
  r: number;
  box: HitboxDef;
}

export interface ProbeFrame {
  /** Frames after the input frame (the input frame is 0). */
  t: number;
  /** The fighter's displacement from where it started, facing right. */
  dx: number;
  dy: number;
  boxes: LocalBox[];
}

/** An entity the move put out (a projectile, a bomb, a falling crate), as it appeared. */
export interface ProbeSpawn {
  /** Frames after the input frame that it appears, counted like ProbeFrame.t. Its hits start that frame. */
  t: number;
  kind: string;
  /**
   * Where it appears, facing right: from where the fighter started (dx, dy) and from where the fighter is on that
   * frame (ox, oy).
   */
  dx: number;
  dy: number;
  ox: number;
  oy: number;
  /**
   * Its velocity and facing (1 = the fighter's) at the end of the frame it appears, after its script's first run,
   * and the state that run left in `data`: a copy put out in this state plays on as the original did.
   */
  vx: number;
  vy: number;
  facing: 1 | -1;
  data: EntityState['data'];
  /** Frames it lives (0 = until something destroys it). */
  lifetime: number;
  /**
   * The strongest hitbox it or what it turns into (a bomb's burst) put out during the probe; null when none did.
   * Windboxes (`pushOnly`) don't count: a shot here is something that hurts.
   */
  box: HitboxDef | null;
  /** The move's cap on how many of this kind the fighter can have out at once. */
  max?: number;
}

/**
 * Where the move's entities had hitboxes (windboxes aside) during the probe, from the first spawn until the last of
 * them was gone: the frames after the input frame of the first and last one, and their envelope from where the
 * fighter was when the first entity appeared, facing right. Entities fly on after the fighter can act again, so this
 * outlasts `busy`.
 */
export interface ShotReach {
  from: number;
  to: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface MoveProbe {
  move: string;
  def: MoveDef;
  /** How it was started: standing, out of a dash, or in mid-air at rest. */
  start: 'ground' | 'dash' | 'air';
  active: ProbeFrame[];
  /** t of the first and last active frame. */
  first: number;
  last: number;
  /** Frames from the input until the fighter can act again (landing included). */
  busy: number;
  /** Displacement when it can act again, and whether it is on the ground then. */
  endDx: number;
  endDy: number;
  endsGrounded: boolean;
  /** Took the fighter into helpless fall (recoveries). */
  helpless: boolean;
  /** Strongest hitbox damage. */
  damage: number;
  /** Envelope of the boxes relative to the fighter, facing right. */
  reach: { x1: number; x2: number; y1: number; y2: number };
  /** Entities the move spawned while it played, in the order they appeared (empty for most moves). */
  spawns: ProbeSpawn[];
  /** Where those entities' hitboxes went; null when they never had any. */
  shot: ShotReach | null;
  /**
   * A chargeable special (MoveDef.charge, not a smash attack) probed a second time with Special held until the charge
   * is full: Bob the Robber's Stun Gun fires a stronger shot that flies further. This probe is the tapped move.
   */
  charged?: MoveProbe;
  /** This probe held Special until the charge was full (it is another probe's `charged`). */
  held?: true;
}

export interface FighterKnowledge {
  id: string;
  def: FighterDef;
  stats: FighterStats;
  hints: CpuHints;
  /** Probes by move name, for grounded starts (normals, smashes, specials, the grab) and out of a dash. */
  ground: Record<string, MoveProbe>;
  /** Probes by move name, started in mid-air (aerials and specials). */
  air: Record<string, MoveProbe>;
  /** Some probed move puts out an entity with hitboxes (a projectile), so attack options must follow entities. */
  shoots: boolean;
}

const cache = new Map<string, FighterKnowledge>();

const ACTIONABLE = new Set([
  'idle',
  'walk',
  'dash',
  'run',
  'crouch',
  'fall',
  'jump',
  'doubleJump',
  'turn',
  'runBrake',
]);

/** The fighter can start something new this frame (Smash's "actionable"). */
export function actionable(f: { action: string; hitstun: number }): boolean {
  return ACTIONABLE.has(f.action) || (f.action === 'tumble' && f.hitstun <= 0);
}

export function knowledge(fighterId: string, stageId: string): FighterKnowledge {
  const key = `${fighterId}@${stageId}`;
  let k = cache.get(key);
  if (k) return k;
  const def = getFighter(fighterId);
  const hints = hintsFor(fighterId);
  const avoid = new Set(hints.avoid ?? []);
  const ground: Record<string, MoveProbe> = {};
  const air: Record<string, MoveProbe> = {};
  const moves = def.moves ?? {};
  for (const name of GROUND_MOVES) {
    if (!moves[name] || avoid.has(name)) continue;
    const p = probe(def, stageId, name, 'ground');
    if (!p) continue;
    const charged = chargeable(moves[name]!) ? probe(def, stageId, name, 'ground', true) : null;
    ground[name] = charged ? { ...p, charged } : p;
  }
  for (const name of Object.keys(DASH_INPUTS)) {
    if (!moves[name] || avoid.has(name)) continue;
    const p = probe(def, stageId, name, 'dash');
    if (p) ground[name] = p;
  }
  for (const name of [...AERIALS, ...SPECIALS]) {
    if (!moves[name] || avoid.has(name)) continue;
    const p = probe(def, stageId, name, 'air');
    if (p) air[name] = p;
  }
  const shoots = [...Object.values(ground), ...Object.values(air)].some((p) => p.shot !== null);
  k = { id: fighterId, def, stats: def.stats, hints, ground, air, shoots };
  cache.set(key, k);
  return k;
}

const DASH_LEAD = 6;
const PROBE_LIMIT = 240;
/** Frames after the input frame the probe follows a move's entities for, once the fighter can act again. */
const FLIGHT_LIMIT = 240;

function settle(def: FighterDef, stageId: string): MatchState {
  const m = createMatch({
    seed: 1,
    stage: stageId,
    stocks: 1,
    ports: [{ fighter: def.id, tapJump: true }],
    hazards: false,
  });
  const n = [neutralInput()];
  for (let i = 0; i < 40; i++) stepMatch(m, n);
  return m;
}

/** A special that charges while Special is held (src/sim/actions/charge.ts); smash attacks charge on Attack instead. */
function chargeable(move: MoveDef): boolean {
  return move.charge !== undefined && move.kind !== 'smash';
}

/** Probe `move` from `start`; with `held`, Special stays held after the press until the move's charge is full. */
function probe(
  def: FighterDef,
  stageId: string,
  move: string,
  start: MoveProbe['start'],
  held = false,
): MoveProbe | null {
  const m = settle(def, stageId);
  const f = m.fighters[0]!;
  const info = staticStage(stageId);
  f.facing = 1;
  if (start === 'air') {
    Object.assign(f, {
      pos: { x: info.centerX, y: info.top + 100 },
      prevPos: { x: info.centerX, y: info.top + 100 },
      vel: { x: 0, y: 0 },
      ground: null,
      action: 'fall',
      actionFrame: 1,
      jumpsUsed: 1,
      airDodgeUsed: false,
      fastFalling: false,
    });
  } else {
    Object.assign(f, { pos: { x: info.centerX, y: f.pos.y }, prevPos: { x: info.centerX, y: f.pos.y } });
  }
  const step = (i: InputFrame) => stepMatch(m, [i]);
  if (start === 'dash') {
    step(neutralInput());
    for (let i = 0; i < DASH_LEAD; i++) step(press({ x: STICK.full }));
    if (f.action !== 'dash' && f.action !== 'run') return null;
  }
  const x0 = f.pos.x;
  const y0 = f.pos.y;
  const input =
    start === 'air'
      ? AIR_INPUTS[move]
      : start === 'dash'
        ? { x: STICK.full, ...DASH_INPUTS[move] }
        : GROUND_INPUTS[move];
  if (!input) return null;
  const shots = new Shots(def, move, m);
  step(press(input));
  if (f.move !== move) return null;
  const active: ProbeFrame[] = [];
  let busy = PROBE_LIMIT;
  let helpless = false;
  const full = (def.moves ?? {})[move]?.chargeFrames ?? SMASH_CHARGE_FRAMES;
  for (let t = 0; t < PROBE_LIMIT; t++) {
    if (t > 0)
      step(held && f.move === move && f.charge < full ? press({ buttons: input.buttons }) : neutralInput());
    shots.see(t, f.move === move, x0, y0);
    if (f.action === 'helpless') helpless = true;
    const boxes = f.move === move ? activeHitboxes(f) : [];
    if (boxes.length) {
      active.push({
        t,
        dx: f.pos.x - x0,
        dy: f.pos.y - y0,
        boxes: boxes.map((b) => ({ x: b.x - f.pos.x, y: b.y - f.pos.y, r: b.box.radius, box: b.box })),
      });
    }
    if (t > 0 && f.move !== move && actionable(f) && (start === 'air' || f.ground !== null)) {
      busy = t;
      break;
    }
  }
  if (f.action === 'ko' || f.action === 'out') return null;
  const end = { x: f.pos.x - x0, y: f.pos.y - y0, grounded: f.ground !== null };
  for (let t = busy + 1; t < FLIGHT_LIMIT && shots.flying(); t++) {
    step(neutralInput());
    shots.see(t, false, x0, y0);
  }
  const all = active.flatMap((a) => a.boxes);
  return {
    move,
    def: (def.moves ?? {})[move]!,
    start,
    active,
    first: active[0]?.t ?? -1,
    last: active.at(-1)?.t ?? -1,
    busy,
    endDx: end.x,
    endDy: end.y,
    endsGrounded: end.grounded,
    helpless,
    damage: all.reduce((d, b) => Math.max(d, b.box.damage), 0),
    reach: {
      x1: Math.min(0, ...all.map((b) => b.x - b.r)),
      x2: Math.max(0, ...all.map((b) => b.x + b.r)),
      y1: Math.min(0, ...all.map((b) => b.y - b.r)),
      y2: Math.max(0, ...all.map((b) => b.y + b.r)),
    },
    spawns: shots.spawns,
    shot: shots.reach(),
    ...(held && { held: true as const }),
  };
}

/**
 * Follows the entities a probed move puts out. One that appears while the move plays is a spawn; one that appears
 * where one of the fighter's entities was destroyed on the same frame is what that entity turned into (a bomb's
 * burst) and counts toward its spawn's hitbox. Every hitbox of either goes into the envelope.
 */
class Shots {
  readonly spawns: ProbeSpawn[] = [];
  private readonly root = new Map<number, ProbeSpawn>();
  private seen: number;
  private base: { x: number; y: number } | null = null;
  private from = -1;
  private to = -1;
  private env = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity };

  constructor(
    private readonly def: FighterDef,
    private readonly move: string,
    private readonly m: MatchState,
  ) {
    this.seen = m.nextEntityId;
  }

  /** Any of the fighter's entities still in the match. */
  flying(): boolean {
    return this.m.entities.some((e) => e.owner === 0);
  }

  see(t: number, playing: boolean, x0: number, y0: number): void {
    const { m } = this;
    const f = m.fighters[0]!;
    for (const e of m.entities) {
      if (e.owner !== 0 || e.id < this.seen) continue;
      const parent = m.events.find(
        (v) => v.type === 'entityDestroy' && v.x === e.pos.x && v.y === e.pos.y && this.root.has(v.id),
      );
      if (parent?.type === 'entityDestroy') {
        this.root.set(e.id, this.root.get(parent.id)!);
      } else if (playing) {
        const s: ProbeSpawn = {
          t,
          kind: e.kind,
          dx: e.pos.x - x0,
          dy: e.pos.y - y0,
          ox: e.pos.x - f.pos.x,
          oy: e.pos.y - f.pos.y,
          vx: e.vel.x,
          vy: e.vel.y,
          facing: e.facing,
          data: { ...e.data },
          lifetime: e.lifetime,
          box: null,
          max: this.cap(e.kind),
        };
        this.spawns.push(s);
        this.root.set(e.id, s);
        this.base ??= { x: f.pos.x, y: f.pos.y };
      }
    }
    this.seen = m.nextEntityId;
    for (const e of m.entities) {
      const s = this.root.get(e.id);
      if (!s || !this.base) continue;
      for (const b of entityHitboxes(e)) {
        if (b.box.pushOnly) continue;
        if (!s.box || b.box.damage > s.box.damage) s.box = b.box;
        const r = b.box.radius;
        const x = b.x - this.base.x;
        const y = b.y - this.base.y;
        this.env = {
          x1: Math.min(this.env.x1, x - r),
          x2: Math.max(this.env.x2, x + r),
          y1: Math.min(this.env.y1, y - r),
          y2: Math.max(this.env.y2, y + r),
        };
        if (this.from < 0) this.from = t;
        this.to = t;
      }
    }
  }

  reach(): ShotReach | null {
    return this.from < 0 ? null : { from: this.from, to: this.to, ...this.env };
  }

  /** The `max` of the move's spawn that puts out this kind, named as spawnFromMove names it. */
  private cap(kind: string): number | undefined {
    const spawn = this.def.moves?.[this.move]?.spawn ?? [];
    return spawn.find((s) => (s.entity.includes('/') ? s.entity : `${this.def.id}/${s.entity}`) === kind)
      ?.max;
  }
}
