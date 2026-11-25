import { getFighter } from '../../fighters/registry';
import type { HitboxDef, ThrowHitDef } from '../../fighters/types';
import { neutralInput, type InputFrame } from '../../input/types';
import { applyHit } from '../combat/hits';
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
  /** The hit: raw knockback fields, or a fighter's move (its strongest box, or the box with id `box`). */
  hit: KoHit | { fighter: string; move: string; box?: number };
  /** Target fighter id. Default: the Mario reference (weight 98), the roster's kill-% target. */
  target?: string;
  /**
   * Where the target stands: on the stage edge it is launched toward ('ledge', the default), at centre stage, or at
   * a point. Launches go toward +x except from a point left of centre.
   */
  from?: 'ledge' | 'centre' | { x: number; y: number };
  /** The target is airborne when hit (aerials, juggles). Default: grounded on the main floor. */
  air?: boolean;
  /** The target's stick, held through hitlag (InputFrame units, -100..100), for DI. Default: no DI. */
  di?: { x: number; y: number };
  /** Attacker's % (rage). Default 0. */
  attackerPercent?: number;
  stage?: string;
}

const MAX_PERCENT = 999;

function boxesOf(hit: KoSetup['hit']): { name: string; attacker: string; hits: KoHit[] } {
  if (!('fighter' in hit)) return { name: 'ko-probe', attacker: marioReference.id, hits: [hit] };
  const move = getFighter(hit.fighter).moves?.[hit.move];
  if (!move) throw new Error(`${hit.fighter} has no move ${hit.move}`);
  const boxes: KoHit[] = move.hits
    .flatMap((w) => w.boxes)
    .filter((b) => !b.grab && (hit.box === undefined || b.id === hit.box));
  if (move.throw && hit.box === undefined) boxes.push(move.throw.hit);
  if (boxes.length === 0) throw new Error(`${hit.fighter}.${hit.move} has no hitbox ${hit.box ?? ''}`);
  return { name: hit.move, attacker: hit.fighter, hits: boxes };
}

/**
 * True when `hit` KOs the target from `percent`: it crosses a blast zone before its hitstun ends, with no input but
 * the DI stick. This is the community KO-calculator definition (SSBU-Calculator's kocalc): once hitstun is over the
 * target could act.
 */
function kosWith(setup: KoSetup, move: string, attacker: string, hit: KoHit, percent: number): boolean {
  const stage = setup.stage ?? 'battlefield';
  const m = createMatch({
    seed: 1,
    stage,
    stocks: 3,
    ports: [{ fighter: attacker }, { fighter: setup.target ?? marioReference.id }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const from = setup.from ?? 'ledge';
  const edge = compiledStage(stage).geo.ledges.find((l) => l.side === 1)!;
  const at = from === 'ledge' ? { x: edge.x - 0.1, y: edge.y } : from === 'centre' ? { x: 0, y: 0 } : from;
  const side = at.x < 0 ? -1 : 1;
  Object.assign(a, {
    pos: { x: at.x - side * 10, y: at.y },
    facing: hit.direction === 'back' ? -side : side,
    move,
    staleQueue: [],
    moveStale: 0,
    damage: setup.attackerPercent ?? 0,
  });
  Object.assign(v, {
    pos: { ...at },
    prevPos: { ...at },
    facing: -side,
    damage: percent,
    vel: { x: 0, y: 0 },
  });
  if (setup.air) Object.assign(v, { ground: null, action: 'fall', actionFrame: 1 });
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
  const { name, attacker, hits } = boxesOf(setup.hit);
  return hits.some((h) => kosWith(setup, name, attacker, h, percent));
}

/**
 * The lowest % (to 0.1) from which the hit KOs the target, fresh, no rage and no DI unless set; null if it never
 * does by 999%. A move is as strong as its strongest box. Battlefield by default, with the target at the ledge.
 * Reproduces SSBU-Calculator's KO calculator within about 2% on Mario's own moves (see ko.test.ts).
 */
export function koPercent(setup: KoSetup): number | null {
  const { name, attacker, hits } = boxesOf(setup.hit);
  const results = hits.map((h) => {
    if (!kosWith(setup, name, attacker, h, MAX_PERCENT)) return null;
    let lo = 0;
    let hi = MAX_PERCENT * 10;
    if (kosWith(setup, name, attacker, h, 0)) return 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (kosWith(setup, name, attacker, h, mid / 10)) hi = mid;
      else lo = mid;
    }
    return hi / 10;
  });
  const found = results.filter((p): p is number => p !== null);
  return found.length ? Math.min(...found) : null;
}
