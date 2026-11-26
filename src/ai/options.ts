import type { HitboxDef } from '../fighters/types';
import { SHIELD_BREAK_HEIGHT } from '../sim/constants';
import { derived, type FighterState } from '../sim/fighter';
import type { MatchState } from '../sim/match';
import type { FighterKnowledge, MoveProbe, ProbeFrame } from './knowledge';
import { AERIALS, TURNING_MOVES } from './inputs';
import { arc, overlaps, type Arc, type Sample } from './look';
import { shotHit, type Place, type ShotHit } from './shots';
import { floorBelow, type StageInfo } from './stage';

/**
 * Attack options: every way the CPU could start a move from where it stands (a grounded move, a short or full
 * hop aerial, an aerial or double-jump aerial in the air), tested frame by frame against where the target is
 * predicted to be. The probes say where each move's hitboxes are; the CPU's own path comes from its momentum
 * (ground moves) or from the air-motion model (jumps). A move that spawns a projectile is tested by playing the
 * projectile's flight from where it would appear (shots.ts), so it can connect long after the CPU can act again.
 */

export type AttackKind = 'ground' | 'jump' | 'air' | 'doubleJump';

export interface Attack {
  kind: AttackKind;
  move: string;
  /** Facing while the move plays (turning moves can face either way). */
  facing: 1 | -1;
  /** Main-stick x held for drift (world direction, -1..1). */
  drift: number;
  /** Jumps: full hop instead of short hop, and frames after take-off before the aerial. */
  full: boolean;
  late: number;
  /** Frames from now until it connects, and the hitbox that connects. */
  tHit: number;
  box: HitboxDef;
  /** Frames from now until the CPU can act again. */
  busy: number;
  /** Where it ends up (offstage checks). */
  endX: number;
  endY: number;
  /** Aerials: where the drift comes down, which can be past endX when the move ends in the air. */
  landX?: number;
  /**
   * Connects with an entity the move spawns (a projectile) rather than with the fighter's own hitboxes: `box` is the
   * first entity's hitbox, and this adds up the damage of every entity of a volley that connects.
   */
  shot?: {
    damage: number;
    /** The first entity's facing and x as it hits (ShotHit), which its launch direction comes from. */
    facing: 1 | -1;
    x: number;
    /** It would also meet the target running in (Target.rush) before the target's quickest hit could land. */
    stops?: true;
  };
  /** Fire the move with this many frames of charge (MoveProbe.charged, chargeInput), rather than tapping it. */
  held?: number;
  score: number;
}

export interface Target {
  /** Predicted target, t = 0 being the frame about to be simulated. */
  path: Sample[];
  /** Spacing misjudgement added to the target's x. */
  errX: number;
  /** Frames from now until grabs can catch it again (regrab immunity after escaping a grab). */
  grabbableIn: number;
  /**
   * The same prediction run further ahead (its first frames are `path`), for projectiles, which can meet the target
   * long after the CPU's own hitboxes are gone. Shots are tested against `path` when it is absent.
   */
  far?: Sample[];
  /**
   * The target running straight at the CPU from the first frame it can act, stopping within striking distance: the
   * frame it gets there (`arrive`, how soon it could punish a shot) and the frame its quickest grounded hit could land
   * (`strikes`). A shot that meets the runner before `strikes` stops the approach.
   */
  rush?: { path: Sample[]; arrive: number; strikes: number };
}

export interface Self {
  f: Readonly<FighterState>;
  k: FighterKnowledge;
  info: StageInfo;
  /** Frames before a grounded move can start (shield drop), and before a jump can start. */
  groundDelay: number;
  jumpDelay: number;
  /** Frames before a grab can start, when it differs from groundDelay (a shield grab skips the shield drop). */
  grabDelay?: number;
  /** The match, for playing out projectiles; without it, moves that only hit with what they spawn are skipped. */
  state?: Readonly<MatchState>;
}

const MARGIN = -0.5;
/** Moves whose button gives a dash attack or a dash grab instead out of a dash or run. */
const DASH_REPLACED = new Set(['jab', 'ftilt', 'utilt', 'dtilt', 'grab']);
/** Grabs can't pick up a fighter lying down, hanging on a ledge or in the air (half-size boxes there: not counted). */
const UNGRABBABLE = new Set(['down', 'downBound', 'grabbed', 'grabHold', 'grabPummel', 'grabThrow']);

/** First frame and hitbox of `frames` that touches the target, with the fighter at `at(frame)` facing `facing`. */
function firstHit(
  frames: ProbeFrame[],
  offset: number,
  at: (pf: ProbeFrame, t: number) => { x: number; y: number } | null,
  facing: 1 | -1,
  target: Target,
): { t: number; box: HitboxDef } | null {
  for (const pf of frames) {
    const t = offset + pf.t;
    if (t >= target.path.length) return null;
    const s = target.path[t]!;
    if (s.intangible || s.action === 'ko' || s.action === 'out' || s.action === 'respawn') continue;
    const p = at(pf, t);
    if (!p) return null;
    const hurt = { ...s.hurt, x: s.hurt.x + target.errX };
    const grabbable =
      t >= target.grabbableIn &&
      s.grounded &&
      s.ledge < 0 &&
      !UNGRABBABLE.has(s.action) &&
      (s.x - p.x) * facing >= 0;
    let best: HitboxDef | null = null;
    for (const b of pf.boxes) {
      if (b.box.grab && !grabbable) continue;
      if (!overlaps(p.x + b.x * facing, p.y + b.y, b.r, hurt, MARGIN)) continue;
      if (!best || b.box.id < best.id) best = b.box;
    }
    if (best) return { t, box: best };
  }
  return null;
}

/** Ground momentum carried into a move: traction slows it each frame. */
function carry(v: number, friction: number, frames: number): number {
  let d = 0;
  let s = Math.abs(v);
  for (let i = 0; i <= frames && s > 0; i++) {
    s = Math.max(0, s - friction);
    d += s;
  }
  return d * Math.sign(v);
}

/** The earlier of a fighter-hitbox hit and a projectile hit, and the projectile's when it is the one. */
function earlier(
  hit: { t: number; box: HitboxDef } | null,
  shot: (ShotHit & { stops?: true }) | null,
): { t: number; box: HitboxDef; shot?: ShotHit & { stops?: true } } | null {
  if (!shot || (hit && hit.t <= shot.t)) return hit;
  return { ...shot, shot };
}

/**
 * First projectile hit of `p` input `offset` frames from now, when the CPU can play projectiles and `p` has one. When
 * it lands after the target could run in (Target.rush), the flight is played again against the runner to see
 * whether it stops the approach.
 */
function shotOf(
  me: Self,
  p: MoveProbe,
  offset: number,
  facing: 1 | -1,
  place: Place,
  target: Target,
): (ShotHit & { stops?: true }) | null {
  if (!me.state || !p.shot) return null;
  const { errX, rush } = target;
  const hit = shotHit(me.state, me.f, p, offset, facing, place, { path: target.far ?? target.path, errX });
  if (!hit || !rush || hit.t <= rush.arrive) return hit;
  const met = shotHit(me.state, me.f, p, offset, facing, place, { path: rush.path, errX });
  return met && met.t < rush.strikes ? { ...hit, stops: true } : hit;
}

/** What an Attack keeps of the shot that hits. */
function shotOut(h: ShotHit & { stops?: true }): NonNullable<Attack['shot']> {
  return { damage: h.damage, facing: h.facing, x: h.x, ...(h.stops && { stops: true as const }) };
}

function landing(a: Arc, info: StageInfo, from: number): number {
  for (let t = Math.max(1, from); t < a.y.length; t++) {
    if (a.y[t]! >= a.y[t - 1]!) continue;
    const fy = floorBelow(info, a.x[t]!, a.y[t - 1]!);
    if (fy !== null && a.y[t]! <= fy) return t;
  }
  return Infinity;
}

function groundAttacks(me: Self, target: Target, out: Attack[]): void {
  const { f, k } = me;
  if (me.groundDelay === Infinity) return;
  const dashing = f.action === 'dash' || f.action === 'run';
  for (const p of Object.values(k.ground).flatMap((p) => (p.charged ? [p, p.charged] : [p]))) {
    if (p.first < 0 && !(me.state && p.shot)) continue;
    const delay = p.move === 'grab' ? (me.grabDelay ?? me.groundDelay) : me.groundDelay;
    if (p.start === 'dash' && (!dashing || delay > 0)) continue;
    if (dashing && DASH_REPLACED.has(p.move)) continue;
    const facings: (1 | -1)[] = TURNING_MOVES.has(p.move) ? [f.facing, -f.facing as 1 | -1] : [f.facing];
    for (const facing of facings) {
      const v = p.start === 'dash' ? 0 : f.vel.x + f.kb.x;
      const struck =
        p.first < 0
          ? null
          : firstHit(
              p.active,
              delay,
              (pf, t) => ({
                x: f.pos.x + pf.dx * facing + carry(v, k.stats.groundFriction, t),
                y: f.pos.y + pf.dy,
              }),
              facing,
              target,
            );
      const shot = shotOf(
        me,
        p,
        delay,
        facing,
        (s, t) => ({ x: f.pos.x + s.dx * facing + carry(v, k.stats.groundFriction, t), y: f.pos.y + s.dy }),
        target,
      );
      const hit = earlier(struck, shot);
      if (!hit) continue;
      out.push({
        kind: 'ground',
        move: p.move,
        facing,
        drift: 0,
        full: false,
        late: 0,
        tHit: hit.t,
        box: hit.box,
        busy: delay + p.busy,
        endX: f.pos.x + p.endDx * facing,
        endY: f.pos.y + p.endDy,
        ...(hit.shot && {
          shot: shotOut(hit.shot),
        }),
        ...(p.held && { held: p.held }),
        score: 0,
      });
    }
  }
}

const DRIFTS = [-1, 0, 1];

function aerialHits(
  me: Self,
  target: Target,
  a: Arc,
  land: number,
  inputAt: number,
  kind: AttackKind,
  drift: number,
  full: boolean,
  late: number,
  out: Attack[],
): void {
  const { f, k } = me;
  for (const name of AERIALS) {
    const p: MoveProbe | undefined = k.air[name];
    if (!p || (p.first < 0 && !(me.state && p.shot))) continue;
    const struck =
      p.first < 0
        ? null
        : firstHit(
            p.active,
            inputAt,
            (_pf, t) => (t < land && t < a.x.length ? { x: a.x[t]!, y: a.y[t]! } : null),
            f.facing,
            target,
          );
    const shot = shotOf(
      me,
      p,
      inputAt,
      f.facing,
      (s, t) => (t < land && t < a.x.length ? { x: a.x[t]! + s.ox * f.facing, y: a.y[t]! + s.oy } : null),
      target,
    );
    const hit = earlier(struck, shot);
    if (!hit) continue;
    const end = Math.min(land, a.x.length - 1, inputAt + p.def.faf);
    const lag = land <= inputAt + p.def.faf ? (p.def.landingLag ?? k.stats.softLandingLag) : 0;
    out.push({
      kind,
      move: name,
      facing: f.facing,
      drift,
      full,
      late,
      tHit: hit.t,
      box: hit.box,
      busy: Math.min(land, inputAt + p.def.faf) + lag,
      endX: a.x[end]!,
      endY: a.y[end]!,
      landX: a.x[Math.min(land, a.x.length - 1)]!,
      ...(hit.shot && { shot: shotOut(hit.shot) }),
      score: 0,
    });
  }
}

function jumpAttacks(me: Self, target: Target, out: Attack[]): void {
  const { f, k, info } = me;
  if (me.jumpDelay === Infinity || f.ground === null) return;
  const d = derived(k.stats, SHIELD_BREAK_HEIGHT);
  const squat = k.stats.jumpSquat + me.jumpDelay;
  const horizon = 100;
  for (const full of [false, true]) {
    for (const drift of DRIFTS) {
      const a = arc(
        k.stats,
        { x: f.pos.x, y: f.pos.y, vx: f.vel.x, vy: 0, squat, takeoff: full ? d.fullHopV : d.shortHopV },
        drift,
        horizon,
      );
      const land = landing(a, info, squat + 1);
      for (const late of full ? [0, 10] : [0]) {
        aerialHits(me, target, a, land, squat + 1 + late, 'jump', drift, full, late, out);
      }
    }
  }
}

function airAttacks(me: Self, target: Target, out: Attack[]): void {
  const { f, k, info } = me;
  if (f.ground !== null) return;
  const horizon = 90;
  for (const drift of DRIFTS) {
    const a = arc(
      k.stats,
      { x: f.pos.x, y: f.pos.y, vx: f.vel.x, vy: f.vel.y, kbx: f.kb.x, kby: f.kb.y },
      drift,
      horizon,
    );
    aerialHits(me, target, a, landing(a, info, 0), 0, 'air', drift, false, 0, out);
    if (f.jumpsUsed < k.stats.jumps) {
      const dj = derived(k.stats, SHIELD_BREAK_HEIGHT).doubleJumpV;
      const b = arc(
        k.stats,
        { x: f.pos.x, y: f.pos.y, vx: drift * k.stats.airSpeed, vy: dj },
        drift,
        horizon,
      );
      aerialHits(me, target, b, landing(b, info, 1), 1, 'doubleJump', drift, false, 0, out);
    }
  }
}

/** Every option that connects with the target, unscored. */
export function findAttacks(me: Self, target: Target): Attack[] {
  const out: Attack[] = [];
  groundAttacks(me, target, out);
  jumpAttacks(me, target, out);
  airAttacks(me, target, out);
  return out;
}
