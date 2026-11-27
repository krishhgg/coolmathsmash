import { getFighter } from '../fighters/registry';
import type { FighterDef, FighterStats, HitboxDef, MoveDef } from '../fighters/types';
import { Btn, neutralInput, type InputFrame } from '../input/types';
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
  /** Its hits' damage multiplier from the move's charge (EntityState.damageMul; Raft Wars' Aimed Shot). */
  damageMul: number;
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
  /** The move the input asks for, by its input name: what the CPU presses (inputs.ts) and its hints name. */
  move: string;
  /**
   * The move the engine plays for that input: `move`, or its `air` variant when it has one and the probe started in
   * the air (MoveDef.air, startMove in src/sim/actions/attack.ts), as Red Ball's air Tongue Lash plays sideBAir.
   * `def`, the frames, the boxes and the spawns are this move's.
   */
  plays: string;
  def: MoveDef;
  /** How it was started: standing, out of a dash, or in mid-air at rest. */
  start: 'ground' | 'dash' | 'air';
  active: ProbeFrame[];
  /** t of the first and last active frame. */
  first: number;
  last: number;
  /**
   * Frames from the input until the fighter can act again (landing included); PROBE_LIMIT when it can't within the
   * probe, as when a helpless fall after the move never lands.
   */
  busy: number;
  /**
   * Displacement when it can act again, and whether it is on the ground then. For a move whose helpless fall from the
   * probe's start runs out of the blast zone, where the move left the fighter.
   */
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
   * A chargeable special (MoveDef.charge, not a smash attack) probed a second time fired with charge, up to
   * CHARGE_HOLD frames of it (chargeInput): Special held for Bob the Robber's Stun Gun at full charge and Raft Wars'
   * Aimed Shot part of the way, and Wheely's tap-charged Rev Up left to charge and then pressed again. This probe is
   * the tapped move.
   */
  charged?: MoveProbe;
  /** Frames of charge this probe fired the move with (it is another probe's `charged`). */
  held?: number;
  /**
   * Grounded moves: how much further forward the move ends when the fighter is already moving as it starts, by the
   * speed along its facing at the input (carriedSamples). The first sample is the probe's own start (0 standing, the
   * dash's speed for a dash move) with nothing further. Empty for air probes.
   */
  carried: { v: number; dx: number }[];
  /**
   * The fighter stays on the ground through the whole move, standing or moving, so the sim stops it at the end of the
   * ground it is on rather than letting it off.
   */
  grounded: boolean;
}

export interface FighterKnowledge {
  id: string;
  def: FighterDef;
  stats: FighterStats;
  hints: CpuHints;
  /** Probes by move name, for grounded starts (normals, smashes, specials, the grab) and out of a dash. */
  ground: Record<string, MoveProbe>;
  /**
   * Probes by move name, started in mid-air (aerials and specials). A special with an air variant is probed as the
   * variant, which is what its input plays there (MoveProbe.plays).
   */
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

/**
 * The input that fires the move `f` plays the way the knowledge probe fired it, `hold` being the frames of charge it
 * fires with (MoveProbe.held, 0 for the tapped probe); null once nothing more is needed.
 *
 * - A tap-charged special (MoveDef.storeCharge.tap) charges by itself until Special is pressed again: neutral until
 *   it reaches its charge frame with `hold` frames of charge, then Special, so it fires with that charge (uncharged
 *   for 0). The move waits on the frame before its charge frame while it charges, so that is the frame to press on.
 *   Null past its charge frame.
 * - Any other move keeps `buttons` (its input's) held while it has less than `hold` frames of charge (Special for a
 *   held charge, src/sim/actions/charge.ts), then null, which lets go and fires.
 */
export function chargeInput(
  f: { fighter: string; move: string | null; actionFrame: number; charge: number },
  buttons: number,
  hold: number,
): InputFrame | null {
  const def = f.move === null ? undefined : getFighter(f.fighter).moves?.[f.move];
  if (def?.storeCharge?.tap && def.charge !== undefined) {
    if (f.actionFrame >= def.charge) return null;
    return f.actionFrame === def.charge - 1 && f.charge >= hold
      ? press({ buttons: Btn.Special })
      : neutralInput();
  }
  return f.charge < hold ? press({ buttons }) : null;
}

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
    const hold = chargeHold(moves[name]);
    const charged = hold > 0 ? probe(def, stageId, name, 'ground', hold) : null;
    ground[name] = withCarry(def, p, charged ? withCarry(def, charged) : undefined);
  }
  for (const name of Object.keys(DASH_INPUTS)) {
    if (!moves[name] || avoid.has(name)) continue;
    const p = probe(def, stageId, name, 'dash');
    if (p) ground[name] = withCarry(def, p);
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

/**
 * The most charge frames a CPU waits through before it fires, holding Special or, for a tap-charged move, pressing it
 * again (chargeInput). A charge that holds the CPU in place longer gives the opponent that long to close in, and leaves too little of its 110-frame look-ahead (cpu.ts, SHOT_HORIZON) for the shot to fly:
 * Aimed Shot fires 3 frames after its charge ends, so a full 112-frame charge comes out on frame 128.
 */
const CHARGE_HOLD = 40;

/**
 * Frames of charge the CPU can fire a special with: up to its full charge and CHARGE_HOLD, 0 when it has no charge
 * (src/sim/actions/charge.ts). Smash attacks charge on Attack instead, so the CPU taps them.
 */
function chargeHold(move: MoveDef): number {
  if (move.charge === undefined || move.kind === 'smash') return 0;
  return Math.min(move.chargeFrames ?? SMASH_CHARGE_FRAMES, CHARGE_HOLD);
}

/** KO'd: out of the blast zone. */
function out(f: { action: string }): boolean {
  return f.action === 'ko' || f.action === 'out';
}

/** Probe `move` from `start`; with `hold`, it fires with that much charge (chargeInput). */
function probe(
  def: FighterDef,
  stageId: string,
  move: string,
  start: MoveProbe['start'],
  hold = 0,
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
  const plays = (start === 'air' && def.moves?.[move]?.air) || move;
  const shots = new Shots(def, plays, m);
  step(press(input));
  if (f.move !== plays) return null;
  const active: ProbeFrame[] = [];
  let busy = PROBE_LIMIT;
  let helpless = false;
  let leftGround = false;
  /** Where the fighter was on the first frame the move no longer played, if it was still in the match. */
  let left: { x: number; y: number } | null = null;
  for (let t = 0; t < PROBE_LIMIT; t++) {
    if (t > 0) step((f.move === plays && chargeInput(f, input.buttons ?? 0, hold)) || neutralInput());
    if (!left && f.move !== plays && !out(f)) left = { x: f.pos.x, y: f.pos.y };
    shots.see(t, f.move === plays, x0, y0);
    if (f.action === 'helpless') helpless = true;
    if (f.ground === null) leftGround = true;
    const boxes = f.move === plays ? activeHitboxes(f) : [];
    if (boxes.length) {
      active.push({
        t,
        dx: f.pos.x - x0,
        dy: f.pos.y - y0,
        boxes: boxes.map((b) => ({ x: b.x - f.pos.x, y: b.y - f.pos.y, r: b.box.radius, box: b.box })),
      });
    }
    if (t > 0 && f.move !== plays && actionable(f) && (start === 'air' || f.ground !== null)) {
      busy = t;
      break;
    }
  }
  // A move that carries the fighter out of the blast zone is no use. In the air, a helpless fall after it is another
  // matter: it drifts on with the move's speed wherever the move is used, so from above the stage's middle Wheely's
  // Ramp Jump, which carries him 65 units sideways, falls out past the side. The move itself got him there alive, so
  // it stays: air specials are for recovering, and the recovery planner plays one out on the real stage before it
  // uses it. On the ground the probe is what the CPU's attacks trust to land it safely, so a fall out still drops it.
  const fellOut = start === 'air' && out(f) && helpless && left !== null;
  if (out(f) && !fellOut) return null;
  const end = fellOut
    ? { x: left!.x - x0, y: left!.y - y0, grounded: false }
    : { x: f.pos.x - x0, y: f.pos.y - y0, grounded: f.ground !== null };
  for (let t = busy + 1; t < FLIGHT_LIMIT && shots.flying(); t++) {
    step(neutralInput());
    shots.see(t, false, x0, y0);
  }
  const all = active.flatMap((a) => a.boxes);
  return {
    move,
    plays,
    def: (def.moves ?? {})[plays]!,
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
    ...(hold > 0 && { held: hold }),
    carried: [],
    grounded: start !== 'air' && !leftGround,
  };
}

/** Where carriedSamples plays moves: Battlefield has the room every fighter's longest move out of a run needs. */
const CARRY_STAGE = 'battlefield';
/** Frames into a run before the input, so the fighter is at its run speed. */
const RUN_LEAD = 8;
/** Frames of walking before the input, so the fighter is at its walk speed. */
const WALK_LEAD = 15;

type Carry = Pick<MoveProbe, 'carried' | 'grounded'>;
const carries = new Map<string, Carry>();

/** Probe `p` with where it ends started moving (carriedSamples), and with `charged` as its charged probe. */
function withCarry(def: FighterDef, p: MoveProbe, charged?: MoveProbe): MoveProbe {
  const c = carriedSamples(def, p.move, p.start === 'dash' ? 'dash' : 'ground', p.held ?? 0);
  return { ...p, carried: c.carried, grounded: p.grounded && c.grounded, ...(charged && { charged }) };
}

/**
 * How much further a grounded move ends when the fighter is already moving as it starts: out of a walk, a dash
 * (DASH_LEAD frames in, as the dash probe starts) and a run (RUN_LEAD frames in). The sim carries the speed into the
 * move under the fighter's ground friction, and the move's script can keep it, replace it or scale it, so each start
 * is played out rather than worked out. A sample is the speed along the facing at the input and how much further
 * forward the move ended than from its own start (standing still, or the dash for a dash move). A start that plays
 * another move gives none: Attack out of a dash is a dash attack. Played on CARRY_STAGE from near its left end
 * running right, the same whatever stage the knowledge is for, and cached per fighter. Also whether the fighter
 * stayed on the ground through the move from every start.
 */
function carriedSamples(def: FighterDef, move: string, start: 'ground' | 'dash', hold: number): Carry {
  const key = `${def.id} ${move} ${start} ${hold}`;
  let c = carries.get(key);
  if (c) return c;
  const base = playFrom(def, move, start === 'dash' ? 'dash' : 'stand', hold);
  c = { carried: [], grounded: false };
  if (base) {
    const carried = [{ v: base.v, dx: 0 }];
    let grounded = base.grounded;
    for (const from of start === 'dash' ? (['run'] as const) : (['walk', 'dash', 'run'] as const)) {
      const r = playFrom(def, move, from, hold);
      if (!r) continue;
      grounded &&= r.grounded;
      if (carried.every((s) => Math.abs(s.v - r.v) > 0.01)) carried.push({ v: r.v, dx: r.dx - base.dx });
    }
    c = { carried: carried.sort((a, b) => a.v - b.v), grounded };
  }
  carries.set(key, c);
  return c;
}

/**
 * Play `move` on CARRY_STAGE from near its left end facing right, standing still or out of a walk, dash or run:
 * the speed along the facing at the input, how far it went by the time the fighter could act again on the ground,
 * and whether it stayed on the ground. Null when that start plays another move, the fighter can't get into it, or
 * the move ran into the stage's far end or off it.
 */
function playFrom(
  def: FighterDef,
  move: string,
  from: 'stand' | 'walk' | 'dash' | 'run',
  hold: number,
): { v: number; dx: number; grounded: boolean } | null {
  const m = settle(def, CARRY_STAGE);
  const f = m.fighters[0]!;
  const info = staticStage(CARRY_STAGE);
  const x = info.left + 6;
  Object.assign(f, { pos: { x, y: f.pos.y }, prevPos: { x, y: f.pos.y }, facing: 1 });
  const step = (i: InputFrame) => stepMatch(m, [i]);
  step(neutralInput());
  if (from === 'walk') for (let i = 0; i < WALK_LEAD; i++) step(press({ x: STICK.walkMax }));
  if (from === 'dash') for (let i = 0; i < DASH_LEAD; i++) step(press({ x: STICK.full }));
  if (from === 'run') {
    let running = 0;
    for (let i = 0; i < 120 && running < RUN_LEAD; i++) {
      step(press({ x: STICK.full }));
      if (f.action === 'run') running++;
    }
  }
  const want = { stand: ['idle'], walk: ['walk'], dash: ['dash', 'run'], run: ['run'] }[from];
  if (!want.includes(f.action) || f.ground === null) return null;
  // Back to the start, still moving, so the move has the whole stage: Runner's side special runs 95 units out of a run.
  Object.assign(f, { pos: { x, y: f.pos.y }, prevPos: { x, y: f.pos.y } });
  const v = f.vel.x;
  const x0 = f.pos.x;
  const input = DASH_INPUTS[move] ? { x: STICK.full, ...DASH_INPUTS[move] } : GROUND_INPUTS[move];
  if (!input) return null;
  step(press(input));
  if (f.move !== move) return null;
  let grounded = true;
  for (let t = 1; t < PROBE_LIMIT; t++) {
    step((f.move === move && chargeInput(f, input.buttons ?? 0, hold)) || neutralInput());
    if (out(f)) return null;
    if (f.ground === null) grounded = false;
    if (f.move !== move && actionable(f) && f.ground !== null) break;
  }
  if (f.pos.x > info.right - 1) return null;
  return { v, dx: f.pos.x - x0, grounded };
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
          damageMul: e.damageMul,
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
      for (const b of entityHitboxes(m, e)) {
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
