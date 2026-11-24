import { getFighter } from '../../fighters/registry';
import type { HitboxDef, MoveKind, ThrowHitDef } from '../../fighters/types';
import { neutralInput, type InputFrame } from '../../input/types';
import { applyHit, hurtbox, touches } from '../combat/hits';
import type { FighterState } from '../fighter';
import { createMatch, stepMatch } from '../match';
import { compiledStage } from '../step';
import { marioReference } from './reference';
import './sim';

/** The knockback fields of a hitbox or throw release. */
export type KoHit = Pick<HitboxDef, 'damage' | 'angle' | 'kbg' | 'bkb'> &
  Partial<Pick<HitboxDef, 'wbkb' | 'effect'>> & {
    direction?: HitboxDef['direction'] | ThrowHitDef['direction'];
  };

export interface KoSetup {
  /**
   * The hit: raw knockback fields, or a fighter's move. A move counts only its launching hit: a throw's release, or
   * the final hit of a multi-hit move (its windows from the last `rehit` one on), as strong as that hit's strongest
   * box or the box with id `box`.
   */
  hit: KoHit | { fighter: string; move: string; box?: number };
  /** Target fighter id. Default: the Mario reference (weight 98), the roster's kill-% target. */
  target?: string;
  /**
   * Where the target stands: on the stage edge it is launched toward ('ledge', the default), at centre stage, or at
   * a point. Launches go toward +x except from a point left of centre. A move's attacker faces whichever way sends
   * its box (forward, back or away from his centre) toward that edge and stands where the box meets the target's
   * middle; an aerial's attacker never stands below the floor, so a box out of a standing target's reach (up smashes,
   * up airs) lifts the target off the floor to meet it, as the real hits do. A raw hit or a throw lands from 10 units
   * inward.
   */
  from?: 'ledge' | 'centre' | { x: number; y: number };
  /** The target is airborne when hit (aerials, juggles). Default: grounded on the main floor unless lifted. */
  air?: boolean;
  /** The target's stick, held through hitlag (InputFrame units, -100..100), for DI. Default: no DI. */
  di?: { x: number; y: number };
  /** Attacker's % (rage). Default 0. */
  attackerPercent?: number;
  stage?: string;
}

const MAX_PERCENT = 999;

interface Launcher {
  name: string;
  attacker: string;
  kind: MoveKind;
  /** Each candidate launching hit; a positioned box when it comes from a move's hit windows. */
  hits: (KoHit | HitboxDef)[];
}

function launcherOf(hit: KoSetup['hit']): Launcher {
  if (!('fighter' in hit))
    return { name: 'ko-probe', attacker: marioReference.id, kind: 'other', hits: [hit] };
  const move = getFighter(hit.fighter).moves?.[hit.move];
  if (!move) throw new Error(`${hit.fighter} has no move ${hit.move}`);
  const base = { name: hit.move, attacker: hit.fighter, kind: move.kind };
  if (move.throw) return { ...base, hits: [move.throw.hit] };
  const last = move.hits.reduce((at, w, i) => (w.rehit ? i : at), 0);
  const boxes = move.hits
    .slice(last)
    .flatMap((w) => w.boxes)
    .filter((b) => !b.grab && (hit.box === undefined || b.id === hit.box));
  if (boxes.length === 0) throw new Error(`${hit.fighter}.${hit.move} has no hitbox ${hit.box ?? ''}`);
  return { ...base, hits: boxes };
}

const positioned = (hit: KoHit | HitboxDef): hit is HitboxDef => 'radius' in hit;

/**
 * True when `hit` KOs the target from `percent`: it crosses a blast zone before its hitstun ends, with no input but
 * the DI stick. This is the community KO-calculator definition (SSBU-Calculator's kocalc): once hitstun is over the
 * target could act.
 */
function kosWith(setup: KoSetup, launcher: Launcher, hit: KoHit | HitboxDef, percent: number): boolean {
  const stage = setup.stage ?? 'battlefield';
  const m = createMatch({
    seed: 1,
    stage,
    stocks: 3,
    ports: [{ fighter: launcher.attacker }, { fighter: setup.target ?? marioReference.id }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const from = setup.from ?? 'ledge';
  const edge = compiledStage(stage).geo.ledges.find((l) => l.side === 1)!;
  const at =
    from === 'ledge' ? { x: edge.x - 0.1, y: edge.y } : from === 'centre' ? { x: 0, y: 0 } : { ...from };
  const side = at.x < 0 ? -1 : 1;
  const away = positioned(hit) && hit.direction === 'away' ? Math.sign(hit.x) || 1 : 1;
  const facing = (hit.direction === 'back' ? -side : side * away) as 1 | -1;
  const attackerAt = { x: at.x - side * 10, y: at.y };
  let lifted = false;
  if (positioned(hit)) {
    const height = getFighter(v.fighter).stats.height;
    const floor = typeof from === 'string';
    attackerAt.x = at.x - hit.x * facing;
    if (launcher.kind === 'aerial') attackerAt.y = at.y + height / 2 - hit.y;
    if (floor && attackerAt.y < at.y) attackerAt.y = at.y;
    const box = { box: hit, x: at.x, y: attackerAt.y + hit.y };
    if (floor && !touches(box, hurtbox({ ...v, pos: at, action: 'idle' }, getFighter(v.fighter).stats))) {
      at.y = box.y - height / 2;
      lifted = true;
    }
  }
  Object.assign(a, {
    pos: attackerAt,
    facing,
    move: launcher.name,
    staleQueue: [],
    moveStale: 0,
    damage: setup.attackerPercent ?? 0,
  });
  Object.assign(v, {
    pos: { ...at },
    prevPos: { ...at },
    facing: (Math.sign(attackerAt.x - at.x) || -side) as 1 | -1,
    damage: percent,
    vel: { x: 0, y: 0 },
  });
  if (setup.air || lifted) Object.assign(v, { ground: null, action: 'fall', actionFrame: 1 });
  applyHit(m, a, v, { id: 0, x: 0, y: 0, radius: 0, hitlag: 1, ...hit });
  a.move = null;
  const stick: InputFrame = { ...neutralInput(), ...setup.di };
  for (let i = 0; i < 600; i++) {
    if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return false;
    stepMatch(m, [neutralInput(), stick]);
    if (v.action === 'ko') return true;
  }
  return false;
}

/** Does the hit KO the target from `percent`? (See koPercent for the setup.) */
export function kos(setup: KoSetup, percent: number): boolean {
  const launcher = launcherOf(setup.hit);
  return launcher.hits.some((h) => kosWith(setup, launcher, h, percent));
}

/**
 * The lowest % (to 0.1) from which the hit KOs the target, fresh, no rage and no DI unless set; null if it never
 * does by 999%. A move counts only its launching hit, as strong as that hit's strongest box, landed where the box
 * meets the target (see KoSetup). Battlefield by default, with the target at the ledge. Reproduces SSBU-Calculator's
 * KO calculator within about 2% on Mario's own moves and on Captain Falcon's up smash and forward air (ko.test.ts).
 */
export function koPercent(setup: KoSetup): number | null {
  const launcher = launcherOf(setup.hit);
  const results = launcher.hits.map((h) => {
    if (!kosWith(setup, launcher, h, MAX_PERCENT)) return null;
    let lo = 0;
    let hi = MAX_PERCENT * 10;
    if (kosWith(setup, launcher, h, 0)) return 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (kosWith(setup, launcher, h, mid / 10)) hi = mid;
      else lo = mid;
    }
    return hi / 10;
  });
  const found = results.filter((p): p is number => p !== null);
  return found.length ? Math.min(...found) : null;
}
