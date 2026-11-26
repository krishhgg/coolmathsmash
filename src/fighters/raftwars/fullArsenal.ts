import { holdFrame } from '../../sim/actions/registry';
import { hurtbox, touches } from '../../sim/combat/hits';
import { stickX, stickY } from '../../sim/control';
import { destroyEntity, spawnEntity } from '../../sim/entities/entities';
import type { EntityCtx, EntityDef, EntityState } from '../../sim/entities/types';
import type { Ctx, FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import type { Vec } from '../../sim/vec';
import { getFighter } from '../registry';
import type { HitboxDef, MoveDef } from '../types';
import { ARSENAL, BLAST, REACH, SHOTS } from './fullArsenalData';

export { ARSENAL, BLAST, REACH, SHOTS } from './fullArsenalData';

/**
 * Full Arsenal, the kids' Final Smash, on Snake's Covering Fire: its moves and entities. The numbers, their sources and
 * the estimates are in fullArsenalData.ts.
 *
 * - The crosshair (`raftwars/reticle`) appears on frame 42 and the move holds frame 43 while it hunts. It moves with
 *   the owner's stick, or seeks a foe when the stick is let go, and marks a fighter it touches at most once every
 *   ARSENAL.lockEvery frames. Each mark is a `raftwars/lockMark` that follows its fighter. After five marks or
 *   ARSENAL.aimFrames frames it puts the marks it didn't get where it last was, and goes; the move plays on.
 * - On each of ARSENAL.fire the launcher lobs a shot at the next mark. It flies on a curve from the muzzle to the
 *   mark, wherever the mark has gone, and bursts there after ARSENAL.flight frames: Covering Fire's missile, a
 *   radius-23 hit.
 * - The shots are one use of the move, so the first burst to connect stales it and the others share its multiplier
 *   (shareStale), as Red Ball's Ball Rain does (SmashWiki, "Stale-move negation").
 */

const RETICLE = 'raftwars/reticle';
const MARK = 'raftwars/lockMark';
const BURST = 'raftwars/volleyBlast';

const live = (e: EntityState) => !e.dead;
const gone = (f: FighterState) => f.action === 'ko' || f.action === 'out';

/** The middle of a fighter's body, where marks sit and shots land. */
function middle(f: FighterState): Vec {
  return { x: f.pos.x, y: f.pos.y + getFighter(f.fighter).stats.height / 2 };
}

const mine = (m: MatchState, port: number, kind: string) =>
  m.entities.filter((e) => live(e) && e.owner === port && e.kind === kind);

/** A mark for lock `n` of use `use`, on fighter `target` (or -1: on the spot). */
function mark(m: MatchState, reticle: EntityState, n: number, target: number, at: Vec): void {
  const e = spawnEntity(m, { kind: MARK, owner: reticle.owner, pos: at, move: reticle.move, final: true });
  Object.assign(e.data, { use: reticle.data.use!, n, target });
}

/** The foe the crosshair seeks with the stick let go: fewest marks, then nearest, then lowest port. */
function seek(x: EntityCtx): FighterState | undefined {
  const { m, e } = x;
  const marks = mine(m, e.owner, MARK).filter((k) => k.data.use === e.data.use);
  const count = (f: FighterState) => marks.filter((k) => k.data.target === f.port).length;
  const dist = (f: FighterState) => Math.hypot(middle(f).x - e.pos.x, middle(f).y - e.pos.y);
  return m.fighters
    .filter((f) => f.port !== e.owner && !gone(f))
    .sort((a, b) => count(a) - count(b) || dist(a) - dist(b) || a.port - b.port)[0];
}

/** The crosshair as a hitbox, to test what it touches. */
const SIGHT: HitboxDef = { id: 0, x: 0, y: 0, radius: ARSENAL.radius, damage: 0, angle: 0, kbg: 0, bkb: 0 };

/** Where the crosshair goes this frame: along the stick at its speed, or with the stick let go towards `seek`. */
function steer(x: EntityCtx): Vec {
  const { e, c } = x;
  const s = c ? { x: stickX(c), y: stickY(c) } : { x: 0, y: 0 };
  if (s.x !== 0 || s.y !== 0) {
    const len = Math.max(1, Math.hypot(s.x, s.y));
    return { x: e.pos.x + (s.x / len) * ARSENAL.speed, y: e.pos.y + (s.y / len) * ARSENAL.speed };
  }
  const foe = seek(x);
  if (!foe) return { ...e.pos };
  const at = middle(foe);
  const d = Math.hypot(at.x - e.pos.x, at.y - e.pos.y);
  const k = d > ARSENAL.speed ? ARSENAL.speed / d : 1;
  return { x: e.pos.x + (at.x - e.pos.x) * k, y: e.pos.y + (at.y - e.pos.y) * k };
}

/**
 * The crosshair's frame: it moves (from its second frame, as entities do) and stays inside the blast zones, marks the
 * nearest fighter it touches there once its lock is ready, and finishes after five marks or ARSENAL.aimFrames frames.
 * It goes if the kids leave their Final Smash.
 */
function hunt(x: EntityCtx): void {
  const { m, e, stage } = x;
  if (!x.owner?.move?.startsWith('finalSmash')) {
    destroyEntity(m, e, 'script');
    return;
  }
  const b = stage.geo.blastZones;
  const inset = ARSENAL.radius * 3;
  const next = e.age > 1 ? steer(x) : { ...e.pos };
  const to = {
    x: Math.min(b.right - inset, Math.max(b.left + inset, next.x)),
    y: Math.min(b.top - inset, Math.max(b.bottom + inset, next.y)),
  };
  e.vel = { x: to.x - e.pos.x, y: to.y - e.pos.y };

  const locks = Number(e.data.locks ?? 0);
  const ready = e.data.last === undefined || e.age - Number(e.data.last) >= ARSENAL.lockEvery;
  const dist = (f: FighterState) => Math.hypot(middle(f).x - to.x, middle(f).y - to.y);
  const hit = ready
    ? m.fighters
        .filter((f) => f.port !== e.owner && !gone(f))
        .filter((f) => touches({ box: SIGHT, ...to }, hurtbox(f, getFighter(f.fighter).stats)))
        .sort((p, q) => dist(p) - dist(q) || p.port - q.port)[0]
    : undefined;
  if (hit) {
    mark(m, e, locks, hit.port, middle(hit));
    e.data.locks = locks + 1;
    e.data.last = e.age;
  }
  const done = Number(e.data.locks ?? 0);
  if (done < ARSENAL.locks && e.age < ARSENAL.aimFrames) return;
  for (let n = done; n < ARSENAL.locks; n++) mark(m, e, n, -1, to);
  destroyEntity(m, e, 'script');
}

/** A mark rides on its fighter until the fighter leaves the match; a spot mark stays put. */
function follow({ m, e }: EntityCtx): void {
  const t = Number(e.data.target);
  const f = t >= 0 ? m.fighters.find((g) => g.port === t) : undefined;
  if (!f || gone(f)) return;
  e.pos = middle(f);
}

/** Where a shot is `t` of the way along its curve: from where it left (x0, y0) past (cx, cy) to its mark. */
function along(e: EntityState, to: Vec, t: number): Vec {
  const [x0, y0, cx, cy] = [e.data.x0, e.data.y0, e.data.cx, e.data.cy].map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const u = 1 - t;
  return { x: u * u * x0 + 2 * u * t * cx + t * t * to.x, y: u * u * y0 + 2 * u * t * cy + t * t * to.y };
}

/** A shot flies along its curve to its mark and bursts there, taking the mark with it. */
function fly(x: EntityCtx): void {
  const { m, e } = x;
  const target = m.entities.find((k) => k.id === e.data.mark && live(k));
  const to = target ? target.pos : { x: Number(e.data.tx), y: Number(e.data.ty) };
  e.data.tx = to.x;
  e.data.ty = to.y;
  if (e.age <= ARSENAL.flight) {
    if (e.age === 1) return;
    const next = along(e, to, (e.age - 1) / ARSENAL.flight);
    e.vel = { x: next.x - e.pos.x, y: next.y - e.pos.y };
    return;
  }
  const dir = Math.sign(to.x - Number(e.data.x0)) || e.facing;
  const burst = spawnEntity(m, {
    kind: BURST,
    owner: e.owner,
    pos: to,
    facing: dir as 1 | -1,
    move: e.move,
    final: true,
  });
  burst.data.use = e.data.use!;
  if (target) destroyEntity(m, target, 'script');
  destroyEntity(m, e, 'script');
}

/** A burst not yet connected takes the stale multiplier of a burst of the same use that has (see above). */
function shareStale({ m, e }: EntityCtx): void {
  if (e.stale !== 0) return;
  const fired = m.entities.find(
    (o) => o.kind === e.kind && o.owner === e.owner && o.data.use === e.data.use && o.stale !== 0,
  );
  if (fired) e.stale = fired.stale;
}

/** Lobs shot `n` at mark `n` of the crosshair's use, from the muzzle. */
function lob(x: Ctx, n: number): void {
  const { m, f } = x;
  const target = mine(m, f.port, MARK)
    .filter((k) => k.data.n === n && k.data.shot === undefined)
    .sort((a, b) => a.id - b.id)[0];
  const at = f.move === 'finalSmashAir' ? ARSENAL.airMuzzle : ARSENAL.muzzle;
  const from = { x: f.pos.x + at.x * f.facing, y: f.pos.y + at.y };
  const to = target?.pos ?? { x: from.x + 60 * f.facing, y: f.pos.y };
  const e = spawnEntity(m, {
    kind: `${x.def.id}/${SHOTS[n]}`,
    owner: f.port,
    pos: from,
    vel: { x: 0, y: 0 },
    facing: f.facing,
    move: f.move,
    final: true,
  });
  Object.assign(e.data, {
    use: target?.data.use ?? e.id,
    mark: target?.id ?? -1,
    x0: from.x,
    y0: from.y,
    cx: (from.x + to.x) / 2,
    cy: Math.max(from.y, to.y) + ARSENAL.arc,
    tx: to.x,
    ty: to.y,
  });
  if (target) target.data.shot = e.id;
}

/** The move's script: the crosshair on frame 42, the hunt held on 43, the shots on ARSENAL.fire. */
function arsenal(x: Ctx): void {
  const { m, f } = x;
  if (f.actionFrame === ARSENAL.reticle) {
    const at = { x: f.pos.x + ARSENAL.start.x * f.facing, y: f.pos.y + ARSENAL.start.y };
    const e = spawnEntity(m, {
      kind: RETICLE,
      owner: f.port,
      pos: at,
      facing: f.facing,
      move: f.move,
      final: true,
    });
    e.data.use = e.id;
    return;
  }
  if (f.actionFrame === ARSENAL.hold && mine(m, f.port, RETICLE).length > 0) {
    holdFrame(x);
    return;
  }
  const n = ARSENAL.fire.indexOf(f.actionFrame as (typeof ARSENAL.fire)[number]);
  if (n >= 0) lob(x, n);
}

/** A shot in flight: no hitbox of its own, only the burst at the end hits. */
const shot: EntityDef = {
  radius: 1.5,
  lifetime: ARSENAL.flight + 1,
  floor: 'pass',
  wall: 'pass',
  reflectable: false,
  absorbable: false,
  transcendent: true,
  script: fly,
};

export const fullArsenalEntities: Record<string, EntityDef> = {
  /** The crosshair: it hunts until it has five marks or the time is up (`hunt`). */
  reticle: { radius: ARSENAL.radius, floor: 'pass', wall: 'pass', script: hunt },
  /** A lock: on a fighter until the shot lobbed at it bursts there. */
  lockMark: { radius: 1, floor: 'pass', wall: 'pass', script: follow },
  volleyBall: shot,
  volleyGrenade: shot,
  volleyRocket: shot,
  /** Covering Fire's missile explosion where a shot comes down: 15%, launching away from its middle. */
  volleyBlast: {
    radius: 1,
    lifetime: BLAST.lifetime,
    kind: 'other',
    floor: 'pass',
    wall: 'pass',
    pierce: true,
    transcendent: true,
    reflectable: false,
    absorbable: false,
    hits: [
      {
        frames: [1, BLAST.active],
        boxes: [
          {
            id: 0,
            x: 0,
            y: 0,
            radius: BLAST.radius,
            damage: BLAST.damage,
            angle: BLAST.angle,
            kbg: BLAST.kbg,
            bkb: BLAST.bkb,
            direction: 'away',
          },
        ],
      },
    ],
    script: shareStale,
  },
};

/** Full Arsenal, standing: the kids act again on frame 78, 35 frames after the barrage starts. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: ARSENAL.faf,
  final: { range: REACH },
  air: 'finalSmashAir',
  hits: [],
  script: arsenal,
};

/** Full Arsenal in the air: they hold still where they are through the hunt and the barrage, as Snake does. */
export const finalSmashAir: MoveDef = {
  kind: 'other',
  faf: ARSENAL.faf,
  final: { still: true, range: REACH },
  hits: [],
  script: arsenal,
};
