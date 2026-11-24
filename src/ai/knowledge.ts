import { getFighter } from '../fighters/registry';
import type { FighterDef, FighterStats, HitboxDef, MoveDef } from '../fighters/types';
import { neutralInput, type InputFrame } from '../input/types';
import { activeHitboxes } from '../sim/combat/hits';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { hintsFor, type CpuHints } from './hints';
import { AERIALS, AIR_INPUTS, GROUND_INPUTS, GROUND_MOVES, SPECIALS, STICK, press } from './inputs';
import { stageInfo } from './stage';

/**
 * What a CPU knows about a fighter, learned by trying every move once in a private copy of the simulation: when
 * its hitboxes come out, where they reach, how it moves the fighter and how long it leaves the fighter busy. Read
 * from the registry and the real move code, so a new fighter needs no AI changes.
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
}

export interface FighterKnowledge {
  id: string;
  def: FighterDef;
  stats: FighterStats;
  hints: CpuHints;
  /** Probes by move name, for grounded starts (normals, smashes, specials) and the dash attack. */
  ground: Record<string, MoveProbe>;
  /** Probes by move name, started in mid-air (aerials and specials). */
  air: Record<string, MoveProbe>;
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
    if (p) ground[name] = p;
  }
  if (moves.dashAttack && !avoid.has('dashAttack')) {
    const p = probe(def, stageId, 'dashAttack', 'dash');
    if (p) ground.dashAttack = p;
  }
  for (const name of [...AERIALS, ...SPECIALS]) {
    if (!moves[name] || avoid.has(name)) continue;
    const p = probe(def, stageId, name, 'air');
    if (p) air[name] = p;
  }
  k = { id: fighterId, def, stats: def.stats, hints, ground, air };
  cache.set(key, k);
  return k;
}

const DASH_LEAD = 6;
const PROBE_LIMIT = 240;

function settle(def: FighterDef, stageId: string): MatchState {
  const m = createMatch({ seed: 1, stage: stageId, stocks: 1, ports: [{ fighter: def.id, tapJump: true }] });
  const n = [neutralInput()];
  for (let i = 0; i < 40; i++) stepMatch(m, n);
  return m;
}

function probe(def: FighterDef, stageId: string, move: string, start: MoveProbe['start']): MoveProbe | null {
  const m = settle(def, stageId);
  const f = m.fighters[0]!;
  const info = stageInfo(stageId);
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
        ? { x: STICK.full, buttons: 1 }
        : GROUND_INPUTS[move];
  if (!input) return null;
  step(press(input));
  if (f.move !== move) return null;
  const active: ProbeFrame[] = [];
  let busy = PROBE_LIMIT;
  let helpless = false;
  for (let t = 0; t < PROBE_LIMIT; t++) {
    if (t > 0) step(neutralInput());
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
  const all = active.flatMap((a) => a.boxes);
  return {
    move,
    def: (def.moves ?? {})[move]!,
    start,
    active,
    first: active[0]?.t ?? -1,
    last: active.at(-1)?.t ?? -1,
    busy,
    endDx: f.pos.x - x0,
    endDy: f.pos.y - y0,
    endsGrounded: f.ground !== null,
    helpless,
    damage: all.reduce((d, b) => Math.max(d, b.box.damage), 0),
    reach: {
      x1: Math.min(0, ...all.map((b) => b.x - b.r)),
      x2: Math.max(0, ...all.map((b) => b.x + b.r)),
      y1: Math.min(0, ...all.map((b) => b.y - b.r)),
      y2: Math.max(0, ...all.map((b) => b.y + b.r)),
    },
  };
}
