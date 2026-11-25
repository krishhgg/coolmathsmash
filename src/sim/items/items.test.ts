import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { neutralInput } from '../../input/types';
import { defaultSetup, resolveMatch } from '../../session/setup';
import { hashState } from '../../engine/hash';
import { registerEntity, spawnEntity } from '../entities/entities';
import type { EntityState } from '../entities/types';
import type { SimEvent } from '../events';
import type { FighterState } from '../fighter';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from '../match';
import { gadgets } from '../testing/gadgets';
import { attack, input, type Hold } from '../testing/sim';
import {
  PLANET,
  PLANET_DECAY_FLOOR,
  PLANET_HP,
  PLANET_LIFETIME,
  PLANET_SPEED,
  trailingFighter,
} from './planet';
import { ITEM_TIMER, SMASH_BALL, createItems, planetChance } from './spawn';

registerFighter(gadgets);

/** Seven minutes, the default time limit. */
const SEVEN_MINUTES = 7 * 60 * 60;

const config = (seed: number, items?: boolean): MatchConfig => ({
  seed,
  stage: 'battlefield',
  stocks: 3,
  ...(items === undefined ? {} : { items }),
  ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
});

function step(m: MatchState, frames: number, holds: Hold[] = [], seen?: SimEvent[]): void {
  for (let i = 0; i < frames; i++) {
    stepMatch(
      m,
      m.players.map((p) => input(holds[p.port])),
    );
    seen?.push(...m.events);
  }
}

/** Every planet spawn and departure in `frames` frames of neutral play. */
function itemLog(m: MatchState, frames: number) {
  const log: { frame: number; event: 'spawn' | string; x: number; y: number }[] = [];
  for (let i = 0; i < frames; i++) {
    stepMatch(m, [neutralInput(), neutralInput()]);
    for (const e of m.events) {
      if (e.type === 'entitySpawn' && e.kind === PLANET)
        log.push({ frame: m.frame, event: 'spawn', x: e.x, y: e.y });
      if (e.type === 'entityDestroy' && e.kind === PLANET)
        log.push({ frame: m.frame, event: e.reason, x: e.x, y: e.y });
    }
  }
  return log;
}

/** Two fighters standing on Battlefield, P1 at -30 facing right and P2 at 60. */
function duel(items = false, fighter = 'test-gadgets'): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    items,
    ports: [{ fighter }, { fighter }],
  });
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, { pos: { x: -30, y: 1 }, prevPos: { x: -30, y: 1 }, facing: 1, intangible: 0 });
  Object.assign(v, { pos: { x: 60, y: 1 }, prevPos: { x: 60, y: 1 }, facing: -1, intangible: 0 });
  step(m, 20);
  expect(a.action).toBe('idle');
  return { m, a, v };
}

/** Put the planet where P1's 12% `strike` (box 8 forward, 6 up, radius 6) lands on it next frame. */
function inFrontOf(f: FighterState, e: EntityState): void {
  const at = { x: f.pos.x + 8, y: f.pos.y + 6 };
  Object.assign(e, { pos: { ...at }, prevPos: { ...at }, vel: { x: 0, y: 0 }, kb: { x: 0, y: 0 } });
}

/** P1 strikes the planet once, then waits until P1 is idle again; returns the frame's events. */
function strike(m: MatchState, a: FighterState, e: EntityState): SimEvent[] {
  const seen: SimEvent[] = [];
  while (a.action !== 'idle') step(m, 1);
  inFrontOf(a, e);
  attack(m, 0, 'strike');
  step(m, 1, [], seen);
  while (a.action !== 'idle') step(m, 1, [], seen);
  return seen;
}

describe('the Items rule', () => {
  it('off (and by default) spawns nothing in a seven-minute match and never touches the RNG', () => {
    for (const items of [false, undefined]) {
      const m = createMatch(config(7, items));
      expect(itemLog(m, SEVEN_MINUTES)).toEqual([]);
      expect(m.entities).toEqual([]);
      expect(m.rng).toBe(7);
      expect(m.items).toEqual(createItems());
    }
  });

  it('on spawns the planet, and the same seed spawns it on the same frames at the same spots', () => {
    const first = itemLog(createMatch(config(12, true)), SEVEN_MINUTES);
    const again = createMatch(config(12, true));
    expect(itemLog(again, SEVEN_MINUTES)).toEqual(first);
    const third = createMatch(config(12, true));
    itemLog(third, SEVEN_MINUTES);
    expect(hashState(third)).toBe(hashState(again));
    expect(first.filter((l) => l.event === 'spawn').length).toBeGreaterThan(1);
    expect(itemLog(createMatch(config(13, true)), SEVEN_MINUTES)).not.toEqual(first);
  });

  it('follows Ultimate: a 500-800 frame item timer, nothing in the first 900 frames, one planet at a time, 4800 frames between', () => {
    const gaps = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const m = createMatch(config(seed, true));
      let last = -1;
      let prev = m.items.timer;
      const log: { frame: number; event: string }[] = [];
      for (let i = 0; i < SEVEN_MINUTES; i++) {
        stepMatch(m, [neutralInput(), neutralInput()]);
        if (m.items.timer > prev) {
          if (last >= 0) gaps.add(m.frame - last);
          last = m.frame;
        }
        prev = m.items.timer;
        for (const e of m.events)
          if ((e.type === 'entitySpawn' || e.type === 'entityDestroy') && e.kind === PLANET)
            log.push({ frame: m.frame, event: e.type });
        expect(m.entities.filter((e) => e.kind === PLANET).length).toBeLessThanOrEqual(1);
      }
      const spawns = log.filter((l) => l.event === 'entitySpawn');
      expect(spawns.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(spawns[0]!.frame).toBeGreaterThan(SMASH_BALL.startLockout);
      log.forEach((l, i) => {
        if (l.event === 'entitySpawn' && i > 0)
          expect(l.frame - log[i - 1]!.frame).toBeGreaterThanOrEqual(SMASH_BALL.lockout);
      });
    }
    expect(Math.min(...gaps)).toBe(ITEM_TIMER.min);
    expect(Math.max(...gaps)).toBe(ITEM_TIMER.max);
  });

  it("rolls Ultimate's Smash Ball chance: 10% x 1.625 on Medium, rising over the 6660 frames after the lockout", () => {
    expect(planetChance(0)).toBe(0);
    expect(planetChance(900)).toBe(0);
    expect(planetChance(900 + 3330)).toBeCloseTo(0.08125, 10);
    expect(planetChance(900 + 6660)).toBeCloseTo(0.1625, 10);
    expect(planetChance(SEVEN_MINUTES)).toBeCloseTo(0.1625, 10);
  });

  it('comes from the stage select: the Items rule reaches the match config', () => {
    const setup = defaultSetup();
    expect(resolveMatch(setup, 3).config.items).toBe(false);
    setup.rules.items = true;
    expect(resolveMatch(setup, 3).config.items).toBe(true);
  });
});

describe('the Coolmath Planet', () => {
  it('has 40 HP, loses 2 every 60 frames down to 2.5 or less, and flies away after 1320 frames', () => {
    const { m } = duel();
    const p = spawnEntity(m, { kind: PLANET, owner: -1, pos: { x: 0, y: 70 } });
    step(m, 1);
    expect(p.hp).toBe(PLANET_HP);
    step(m, 58);
    expect(p.age).toBe(59);
    expect(p.hp).toBe(40);
    step(m, 1);
    expect(p.hp).toBe(38);
    step(m, 1080);
    expect(p.age).toBe(1140);
    expect(p.hp).toBe(2);
    expect(p.hp).toBeLessThanOrEqual(PLANET_DECAY_FLOOR);
    step(m, PLANET_LIFETIME - 1140);
    expect(p.hp).toBe(2);
    expect(m.entities).toContain(p);
    const seen: SimEvent[] = [];
    step(m, 1, [], seen);
    expect(m.entities).not.toContain(p);
    expect(seen).toContainEqual(expect.objectContaining({ type: 'entityDestroy', reason: 'expired' }));
  });

  it('floats: no gravity, roams over the trailing fighter at up to 0.6 units a frame, and stays on camera', () => {
    const { m, a, v } = duel();
    v.damage = 80;
    expect(trailingFighter(m)).toBe(v);
    const p = spawnEntity(m, { kind: PLANET, owner: -1, pos: { x: 0, y: 70 } });
    const cam = { left: -170, right: 170, top: 130, bottom: -80 };
    for (let i = 0; i < 1200; i++) {
      step(m, 1);
      expect(Math.abs(p.vel.x)).toBeLessThanOrEqual(PLANET_SPEED + 1e-9);
      expect(Math.abs(p.vel.y)).toBeLessThanOrEqual(PLANET_SPEED + 0.06 + 1e-9);
      expect(p.pos.x).toBeGreaterThan(cam.left);
      expect(p.pos.x).toBeLessThan(cam.right);
      expect(p.pos.y).toBeGreaterThan(0);
    }
    expect(Math.abs(p.pos.x - v.pos.x)).toBeLessThan(Math.abs(p.pos.x - a.pos.x));
  });

  it('takes 12% hits off its HP and breaks on the hit that takes its last point', () => {
    const { m, a } = duel();
    const p = spawnEntity(m, { kind: PLANET, owner: -1, pos: { x: 0, y: 70 } });
    step(m, 1);
    for (let hits = 1; hits <= 3; hits++) {
      const seen = strike(m, a, p);
      expect(seen).toContainEqual(
        expect.objectContaining({ type: 'entityHit', id: p.id, attacker: 0, damage: 12 }),
      );
      expect(m.entities).toContain(p);
      expect(p.hp).toBeCloseTo(PLANET_HP - 12 * hits - 2 * Math.floor(p.age / 60), 10);
    }
    expect(p.hp).toBeGreaterThan(0);
    expect(p.hp).toBeLessThanOrEqual(12);
    const seen = strike(m, a, p);
    expect(m.entities).not.toContain(p);
    expect(seen).toContainEqual(
      expect.objectContaining({ type: 'entityDestroy', id: p.id, reason: 'broken' }),
    );
  });

  it('gives whoever breaks it the charge: finalReady, a finalReady event, and the glow flag stays until a KO', () => {
    const { m, a, v } = duel(true);
    const p = spawnEntity(m, { kind: PLANET, owner: -1, pos: { x: 0, y: 70 } });
    step(m, 1);
    p.hp = 5;
    const seen = strike(m, a, p);
    expect(m.entities).not.toContain(p);
    expect(a.finalReady).toBe(true);
    expect(v.finalReady).toBe(false);
    const ready = seen.filter((e) => e.type === 'finalReady');
    expect(ready).toEqual([expect.objectContaining({ type: 'finalReady', port: 0 })]);
    const broke = seen.findIndex((e) => e.type === 'entityDestroy' && e.id === p.id);
    expect(seen.indexOf(ready[0]!)).toBe(broke + 1);

    // While P1 holds it no planet spawns, for a whole seven minutes.
    expect(itemLog(m, SEVEN_MINUTES)).toEqual([]);
    expect(a.finalReady).toBe(true);

    // A KO loses it (Ultimate), and the next planet waits out the 4800-frame lockout.
    Object.assign(a, { pos: { x: -300, y: 20 }, ground: null, action: 'fall' });
    step(m, 1);
    expect(a.action).toBe('ko');
    expect(a.finalReady).toBe(false);
    const lostAt = m.frame;
    const next = itemLog(m, SEVEN_MINUTES).find((l) => l.event === 'spawn');
    expect(next).toBeDefined();
    expect(next!.frame - lostAt).toBeGreaterThanOrEqual(SMASH_BALL.lockout);
  });
});

describe('item pickup', () => {
  registerEntity('item/test-snack', {
    radius: 2,
    gravity: 0.1,
    maxFall: 2,
    floor: 'land',
    wall: 'stop',
    pickup: (_m, f) => {
      f.damage = Math.max(0, f.damage - 10);
    },
  });

  it('an idle fighter pressing Attack over a grounded item picks it up instead of jabbing', () => {
    const { m, a } = duel(false, 'fireboy');
    a.damage = 25;
    const snack = spawnEntity(m, { kind: 'item/test-snack', owner: -1, pos: { x: -27, y: 6 } });
    step(m, 30);
    expect(snack.grounded).toBe(true);
    const seen: SimEvent[] = [];
    step(m, 1, [{ buttons: ['attack'] }], seen);
    expect(a.move).toBeNull();
    expect(a.action).toBe('idle');
    expect(a.damage).toBe(15);
    expect(m.entities).not.toContain(snack);
    expect(seen).toContainEqual({ type: 'itemPickup', port: 0, id: snack.id, kind: 'item/test-snack' });
    expect(seen).toContainEqual(expect.objectContaining({ type: 'entityDestroy', reason: 'pickup' }));
  });

  it('jabs as usual with no item in reach', () => {
    const { m, a } = duel(false, 'fireboy');
    spawnEntity(m, { kind: 'item/test-snack', owner: -1, pos: { x: 0, y: 6 } });
    step(m, 30);
    step(m, 1, [{ buttons: ['attack'] }]);
    expect(m.entities).toHaveLength(1);
    expect(a.action).toBe('attack');
  });
});
