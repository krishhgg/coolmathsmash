import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { registerStage } from '../../stages/registry';
import { testbed } from '../../stages/testbed';
import { hitlagFrames, shieldstunFrames, knockback } from '../combat/formulas';
import type { FighterState } from '../fighter';
import { createMatch, stepMatch, type MatchState } from '../match';
import { gadgets } from '../testing/gadgets';
import { attack, input, type Hold } from '../testing/sim';
import { spawnEntity } from './entities';
import type { EntityState } from './types';

registerFighter(gadgets);

/** Two fighters standing on Battlefield's main stage at x0 and x1, facing each other. */
function duel(
  f0: string,
  f1: string,
  x0 = -30,
  x1 = 30,
): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: f0 }, { fighter: f1 }],
  });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, x0, Math.sign(x1 - x0)],
    [v, x1, Math.sign(x0 - x1)],
  ] as const) {
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, facing, intangible: 0 });
  }
  step(m, 20);
  expect(a.action).toBe('idle');
  expect(v.action).toBe('idle');
  return { m, a, v };
}

function step(m: MatchState, frames: number, holds: Hold[] = []): void {
  for (let i = 0; i < frames; i++)
    stepMatch(
      m,
      m.players.map((p) => input(holds[p.port])),
    );
}

const fireballs = (m: MatchState) => m.entities.filter((e) => e.kind === 'fireboy/fireball');

/** Step until `pred` holds, at most `limit` frames. */
function until(m: MatchState, pred: () => boolean, holds: Hold[] = [], limit = 300): number {
  for (let i = 0; i < limit; i++) {
    if (pred()) return i;
    step(m, 1, holds);
  }
  throw new Error('condition not reached');
}

describe("Fireboy's Fireball (the worked example)", () => {
  it('comes out on frame 17 at his hand, one entity per throw with increasing ids', () => {
    const { m, a } = duel('fireboy', 'fireboy', -60, 60);
    step(m, 1, [{ buttons: ['special'] }]);
    expect(a.move).toBe('neutralB');
    until(m, () => fireballs(m).length > 0);
    expect(a.actionFrame).toBe(17);
    const [ball] = fireballs(m) as [EntityState];
    expect(ball).toMatchObject({ id: 1, owner: 0, age: 1, facing: 1, move: 'neutralB' });
    expect(ball.pos).toEqual({ x: a.pos.x + 6, y: a.pos.y + 8 });
    until(m, () => a.action === 'idle');
    step(m, 1, [{ buttons: ['special'] }]);
    until(m, () => fireballs(m).length === 2);
    expect(fireballs(m).map((e) => e.id)).toEqual([1, 2]);
  });

  it('bounces along the stage to the same height every time, never sinks into it, and is gone after 70 frames', () => {
    const { m } = duel('fireboy', 'fireboy', -70, 60);
    step(m, 1, [{ buttons: ['special'] }]);
    until(m, () => fireballs(m).length > 0);
    const ball = fireballs(m)[0]!;
    const apexes: number[] = [];
    let last = ball.vel.y;
    let frames = 1;
    let low = Infinity;
    while (fireballs(m).length > 0) {
      step(m, 1);
      low = Math.min(low, ball.pos.y);
      if (ball.vel.y < 0 && last >= 0 && ball.age > 1) apexes.push(ball.pos.y);
      last = ball.vel.y;
      if (!ball.dead) frames = ball.age;
    }
    expect(frames).toBe(70);
    expect(low).toBeGreaterThanOrEqual(2.4 - 1e-9);
    expect(apexes.length).toBeGreaterThanOrEqual(3);
    for (const y of apexes.slice(1)) expect(y).toBeCloseTo(apexes[1]!, 1);
    expect(ball.pos.x).toBeGreaterThan(-70 + 80);
  });

  it('hits for 5.5% as a projectile: fresh, x1.2 in 1v1, only the victim freezes, then it is gone', () => {
    const { m, a, v } = duel('fireboy', 'fireboy', -30, 0);
    step(m, 1, [{ buttons: ['special'] }]);
    until(m, () => v.damage > 0);
    expect(v.damage).toBeCloseTo(5.5 * 1.05 * 1.2, 6);
    expect(v.hitlag).toBe(hitlagFrames(5.5 * 1.05));
    expect(a.hitlag).toBe(0);
    expect(fireballs(m)).toHaveLength(0);
    expect(a.staleQueue).toEqual(['neutralB']);
    const kb = knockback({ percent: 0, damage: 5.5, kbg: 35, bkb: 20, weight: 84, stale: 1.05 });
    expect(v.launch!.kb).toBeCloseTo(kb, 6);
    expect(v.launch!.dir).toBe(1);
  });

  it("scales with the owner's rage: x1.1 knockback when Fireboy is at 150%", () => {
    const kbAt = (percent: number) => {
      const { m, a, v } = duel('fireboy', 'fireboy', -30, 0);
      a.damage = percent;
      step(m, 1, [{ buttons: ['special'] }]);
      until(m, () => v.launch !== null);
      return v.launch!.kb;
    };
    expect(kbAt(150)).toBeCloseTo(kbAt(0) * 1.1, 6);
  });

  it("stales the owner's move: the second fireball to connect deals 0.91x", () => {
    const { m, a, v } = duel('fireboy', 'fireboy', -30, 0);
    step(m, 1, [{ buttons: ['special'] }]);
    until(m, () => v.damage > 0);
    const first = v.damage;
    until(m, () => a.action === 'idle' && v.action === 'idle', [], 400);
    Object.assign(v, { pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 }, kb: { x: 0, y: 0 } });
    Object.assign(a, { pos: { x: -30, y: 0 }, prevPos: { x: -30, y: 0 }, facing: 1 });
    step(m, 1, [{ buttons: ['special'] }]);
    until(m, () => v.damage > first);
    expect(v.damage - first).toBeCloseTo(5.5 * 0.91 * 1.2, 6);
  });

  it('on a shield: projectile shieldstun (x0.29), no %, and the fireball is used up', () => {
    const { m, v } = duel('fireboy', 'fireboy', -30, 0);
    const shield: Hold[] = [{}, { buttons: ['shield'] }];
    step(m, 5, shield);
    step(m, 1, [{ buttons: ['special'] }, { buttons: ['shield'] }]);
    until(m, () => v.action === 'shieldStun', shield);
    expect(v.damage).toBe(0);
    expect(v.hitstun).toBe(shieldstunFrames(5.5 * 1.05, 'projectile'));
    expect(v.hitstun).toBeLessThan(shieldstunFrames(5.5 * 1.05, 'other'));
    expect(v.kb.x).toBeGreaterThan(0);
    expect(fireballs(m)).toHaveLength(0);
  });

  it('a shield is pushed away from where the projectile is, whatever way it faces', () => {
    const { m, v } = duel('test-gadgets', 'test-gadgets', -60, 0);
    const shield: Hold[] = [{}, { buttons: ['shield'] }];
    step(m, 5, shield);
    spawnEntity(m, { kind: 'test-gadgets/bolt', owner: -1, pos: { x: 14, y: 8 }, vel: { x: -2, y: 0 } });
    until(m, () => v.action === 'shieldStun', shield);
    expect(v.kb.x).toBeLessThan(0);
  });

  it('the victim DIs a projectile launch like any other', () => {
    const angle = (di: Hold) => {
      const { m, v } = duel('fireboy', 'fireboy', -30, 0);
      v.damage = 400;
      step(m, 1, [{ buttons: ['special'] }]);
      until(m, () => v.launch !== null);
      until(m, () => v.launch === null, [{}, di]);
      return Math.atan2(v.kb.y, v.kb.x);
    };
    expect(angle({ x: -100 })).toBeGreaterThan(angle({}));
    expect(angle({ x: 100 })).toBeLessThan(angle({}));
  });
});

describe('reflectors', () => {
  it("Temple Mirror turns the fireball around with the Cape's multipliers and it hits its old owner", () => {
    const { m, a, v } = duel('fireboy', 'fireboy', -30, 0);
    step(m, 1, [{ buttons: ['special'] }]);
    until(m, () => fireballs(m).length > 0);
    const ball = fireballs(m)[0]!;
    until(m, () => ball.pos.x > v.pos.x - 22);
    const before = { vx: ball.vel.x, life: ball.lifetime - ball.age };
    step(m, 1, [{}, { x: -100, buttons: ['special'] }]);
    expect(v.move).toBe('sideB');
    until(m, () => ball.owner === 1);
    expect(ball.vel.x).toBeCloseTo(-Math.abs(before.vx), 6);
    expect(ball.facing).toBe(-1);
    expect(ball.damageMul).toBe(1.5);
    expect(ball.reflects).toBe(1);
    expect(ball.lifetime - ball.age).toBeLessThanOrEqual(Math.floor(before.life * 0.75));
    expect(v.damage).toBe(0);
    until(m, () => a.damage > 0);
    expect(a.damage).toBeCloseTo(5.5 * 1.5 * 1.05 * 1.2, 6);
    expect(v.staleQueue).toEqual(['sideB']);
  });

  it("defaults to Fox's Reflector (x1.4 damage and speed) and lets a projectile over 50% through", () => {
    const shot = (kind: string) => {
      const { m, v } = duel('test-gadgets', 'test-gadgets', -40, 0);
      attack(m, 1, 'reflect');
      const e = spawnEntity(m, { kind, owner: 0, pos: { x: -10, y: 8 }, vel: { x: 2, y: 0 } });
      until(m, () => e.dead || e.owner === 1 || v.damage > 0);
      return { e, v };
    };
    const bolt = shot('test-gadgets/bolt');
    expect(bolt.e.owner).toBe(1);
    expect(bolt.e.vel.x).toBeCloseTo(-2 * 1.4, 6);
    expect(bolt.e.damageMul).toBe(1.4);
    const cannon = shot('test-gadgets/cannon');
    expect(cannon.e.owner).toBe(0);
    expect(cannon.v.damage).toBeCloseTo(60 * 1.2, 6);
  });

  it('reflects a projectile 7 times, and destroys it at an 8th reflector (Ultimate)', () => {
    const reflectAfter = (reflects: number) => {
      const { m } = duel('test-gadgets', 'test-gadgets', -40, 0);
      attack(m, 1, 'reflect');
      const e = spawnEntity(m, {
        kind: 'test-gadgets/bolt',
        owner: 0,
        pos: { x: -10, y: 8 },
        vel: { x: 2, y: 0 },
      });
      e.reflects = reflects;
      until(m, () => e.dead || e.owner === 1);
      return { e, m };
    };
    expect(reflectAfter(6).e.reflects).toBe(7);
    const eighth = reflectAfter(7);
    expect(eighth.e.dead).toBe(true);
    expect(eighth.e.owner).toBe(0);
    expect(eighth.m.fighters[1]!.damage).toBe(0);
  });
});

describe('absorbers', () => {
  it("eat an absorbable projectile and heal by PSI Magnet's 1.6x; one over 30% hits instead", () => {
    const absorb = (kind: string) => {
      const { m, v } = duel('test-gadgets', 'test-gadgets', -40, 0);
      v.damage = 50;
      attack(m, 1, 'absorb');
      const e = spawnEntity(m, { kind, owner: 0, pos: { x: -14, y: 8 }, vel: { x: 2, y: 0 } });
      until(m, () => e.dead);
      return { m, v };
    };
    const bolt = absorb('test-gadgets/bolt');
    expect(bolt.v.damage).toBeCloseTo(50 - 6 * 1.6, 6);
    expect(bolt.m.entities).toHaveLength(0);
    expect(absorb('test-gadgets/cannon').v.damage).toBeGreaterThan(50);
  });
});

describe('clanks (9% rule)', () => {
  /** A bolt powered up to `power`% (by its reflect multiplier) meeting a 12% attack. */
  function meet(power: number) {
    const { m, v } = duel('test-gadgets', 'test-gadgets', -40, 0);
    const e = spawnEntity(m, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: -14, y: 6 },
      vel: { x: 1, y: 0 },
    });
    e.damageMul = power / 6;
    attack(m, 1, 'strike');
    step(m, 1);
    return { m, v, e };
  }

  it('an attack destroys a projectile up to 9% stronger than it, without being interrupted', () => {
    for (const power of [6, 21]) {
      const { m, v, e } = meet(power);
      expect(e.dead).toBe(true);
      expect(m.entities).toHaveLength(0);
      expect(v.move).toBe('strike');
    }
  });

  it('a projectile more than 9% stronger than the attack goes through it and hits', () => {
    const { m, v, e } = meet(21.6);
    expect(e.dead).toBe(false);
    until(m, () => e.dead);
    expect(v.damage).toBeCloseTo(21.6 * 1.2, 6);
  });

  it('two projectiles clank: each is destroyed unless it deals more than 9% more than the other', () => {
    const clash = (left: number) => {
      const { m } = duel('test-gadgets', 'test-gadgets', -60, 60);
      const l = spawnEntity(m, {
        kind: 'test-gadgets/bolt',
        owner: 0,
        pos: { x: -6, y: 20 },
        vel: { x: 1, y: 0 },
      });
      const r = spawnEntity(m, {
        kind: 'test-gadgets/bolt',
        owner: 1,
        pos: { x: 6, y: 20 },
        vel: { x: -1, y: 0 },
      });
      l.damageMul = left / 6;
      until(m, () => l.dead || r.dead);
      return [l.dead, r.dead];
    };
    expect(clash(6)).toEqual([true, true]);
    expect(clash(15)).toEqual([true, true]);
    expect(clash(15.6)).toEqual([false, true]);
  });

  it('a piercing projectile hits everyone in its path once and flies on', () => {
    const { m, a, v } = duel('test-gadgets', 'test-gadgets', -20, 20);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: 0, y: 4 } });
    step(m, 20);
    const beam = spawnEntity(m, {
      kind: 'test-gadgets/beam',
      owner: -1,
      pos: { x: -40, y: 5 },
      vel: { x: 2, y: 0 },
    });
    until(m, () => beam.pos.x > 40);
    expect(beam.dead).toBe(false);
    expect([a.damage, v.damage]).toEqual([4 * 1.2, 4 * 1.2]);
    expect(crate.hp).toBeCloseTo(26, 6);
  });

  it('projectiles of the same owner pass through each other', () => {
    const { m } = duel('test-gadgets', 'test-gadgets', -60, 60);
    const l = spawnEntity(m, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: -6, y: 20 },
      vel: { x: 1, y: 0 },
    });
    const r = spawnEntity(m, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: 6, y: 20 },
      vel: { x: -1, y: 0 },
    });
    step(m, 12);
    expect([l.dead, r.dead]).toEqual([false, false]);
  });
});

describe('hittable entities and minions', () => {
  it('a crate takes hits once per move, shares hitlag with the attacker, is launched, and breaks at 0 HP', () => {
    const { m, a } = duel('test-gadgets', 'test-gadgets', -40, 60);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: -32, y: 4 } });
    spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: 30, y: 4 } });
    step(m, 30);
    expect(crate.grounded).toBe(true);
    expect(crate.pos.y).toBeCloseTo(4, 3);
    attack(m, 0, 'strike');
    step(m, 1);
    expect(crate.hp).toBeCloseTo(30 - 12, 6);
    expect(crate.hitlag).toBe(hitlagFrames(12));
    expect(a.hitlag).toBe(hitlagFrames(12));
    step(m, 5);
    expect(crate.hp).toBeCloseTo(30 - 12, 6);
    until(m, () => crate.hitlag === 0 && crate.kb.x !== 0);
    expect(crate.kb.x).toBeGreaterThan(0);
    crate.hp = 5;
    Object.assign(crate, { pos: { x: -32, y: 4 }, kb: { x: 0, y: 0 } });
    until(m, () => a.action === 'idle');
    attack(m, 0, 'strike');
    step(m, 1);
    expect(m.entities).not.toContain(crate);
  });

  it('an attack lands on crates and a fighter on the same frame, and the attacker freezes for the longest hitlag', () => {
    const { m, a, v } = duel('test-gadgets', 'test-gadgets', -40, -26);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: -32, y: 4 } });
    const other = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: -31, y: 12 } });
    step(m, 20);
    attack(m, 0, 'strike');
    step(m, 1);
    expect([crate.hp, other.hp]).toEqual([18, 18]);
    expect(v.damage).toBeCloseTo(12 * 1.05 * 1.2, 6);
    expect(a.hitlag).toBe(Math.max(hitlagFrames(12), hitlagFrames(12 * 1.05)));
  });

  it('grab boxes neither hit entities nor clank with projectiles', () => {
    const { m, a } = duel('fireboy', 'test-gadgets', -40, 60);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: -32.5, y: 4 } });
    step(m, 20);
    const bolt = spawnEntity(m, { kind: 'test-gadgets/bolt', owner: 1, pos: { x: -29, y: 8 } });
    step(m, 1, [{ buttons: ['grab'] }]);
    expect(a.move).toBe('grab');
    step(m, 10);
    expect(crate.hp).toBe(30);
    expect(bolt.dead).toBe(false);
    expect(a.damage).toBe(0);
  });

  it('on the floor an entity keeps its whole horizontal move and loses the rest of its fall', () => {
    const { m } = duel('test-gadgets', 'test-gadgets', -60, 60);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 0, pos: { x: -40, y: 4 } });
    step(m, 20);
    crate.vel.x = 3;
    step(m, 10);
    expect(crate.pos.x).toBeCloseTo(-40 + 30, 6);
    expect(crate.grounded).toBe(true);
    const ball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 0,
      pos: { x: 0, y: 2.9 },
      vel: { x: 1.4, y: -1.6 },
    });
    step(m, 2);
    expect(ball.pos).toEqual({ x: 1.4, y: 2.4 });
  });

  it("a projectile breaks on a hittable entity and damages it; its owner's own crate is safe from it", () => {
    const { m } = duel('test-gadgets', 'test-gadgets', -60, 60);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 1, pos: { x: 10, y: 4 } });
    const mine = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 0, pos: { x: -10, y: 4 } });
    step(m, 20);
    const bolt = spawnEntity(m, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: -20, y: 5 },
      vel: { x: 2, y: 0 },
    });
    until(m, () => crate.hp < 30);
    expect(bolt.dead).toBe(true);
    expect(mine.hp).toBe(30);
    expect(crate.hp).toBeCloseTo(24, 6);
  });

  it('a minion walks where its owner holds the stick', () => {
    const { m } = duel('test-gadgets', 'test-gadgets', -60, 60);
    const minion = spawnEntity(m, { kind: 'test-gadgets/minion', owner: 0, pos: { x: 0, y: 3 } });
    step(m, 10);
    const x0 = minion.pos.x;
    step(m, 20, [{ x: 100 }]);
    expect(minion.pos.x - x0).toBeCloseTo(20 * 1.2, 0);
    expect(minion.grounded).toBe(true);
  });

  it('a move spawn respects its on-screen limit', () => {
    const { m, a } = duel('test-gadgets', 'test-gadgets', -60, 60);
    for (let i = 0; i < 3; i++) {
      attack(m, 0, 'shoot');
      until(m, () => a.actionFrame === 3);
      step(m, 1);
    }
    expect(m.entities.filter((e) => e.kind === 'test-gadgets/bolt')).toHaveLength(2);
  });
});

describe('projectiles and grabs', () => {
  function caught() {
    const d = duel('fireboy', 'fireboy', -10, 2);
    step(d.m, 1, [{ buttons: ['grab'] }]);
    until(d.m, () => d.v.action === 'grabbed');
    expect(d.a.action).toBe('grabHold');
    return d;
  }
  const bolt = (m: MatchState, x: number, vx: number) =>
    spawnEntity(m, { kind: 'test-gadgets/bolt', owner: -1, pos: { x, y: 8 }, vel: { x: vx, y: 0 } });

  it('a projectile on the holder frees the held fighter', () => {
    const { m, a, v } = caught();
    const e = bolt(m, a.pos.x - 16, 2);
    until(m, () => e.dead);
    expect(a.damage).toBeCloseTo(6 * 1.2, 6);
    expect(v.damage).toBe(0);
    expect(v.action).toBe('grabRelease');
  });

  it('the held fighter armours through a projectile under the break damage', () => {
    const { m, a, v } = caught();
    const e = bolt(m, v.pos.x + 16, -2);
    until(m, () => e.dead);
    expect(v.damage).toBeCloseTo(6 * 1.2, 6);
    expect(v.launch).toBeNull();
    step(m, 1);
    expect(v.action).toBe('grabbed');
    expect(a.action).toBe('grabHold');
  });
});

describe('entity lifecycle', () => {
  it('is plain data: a match with entities clones, hashes and replays identically', () => {
    const play = () => {
      const { m } = duel('fireboy', 'fireboy', -30, 30);
      step(m, 1, [{ buttons: ['special'] }, { buttons: ['special'] }]);
      step(m, 25);
      return m;
    };
    const one = play();
    expect(one.entities.length).toBeGreaterThan(0);
    expect(structuredClone(one)).toEqual(one);
    expect(JSON.parse(JSON.stringify(one))).toEqual(one);
    expect(play()).toEqual(one);
  });

  it('meets moving stage pieces where they are and passes where a piece is absent (testbed)', () => {
    const m = createMatch({ seed: 1, stage: 'testbed', stocks: 3, ports: [{ fighter: 'test-gadgets' }] });
    const bolt = spawnEntity(m, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: -90, y: 55 },
      vel: { x: 2, y: 0 },
    });
    until(m, () => bolt.dead);
    expect(bolt.pos.x).toBeLessThan(-60);
    step(m, 205 - m.frame);
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 0, pos: { x: 0, y: 66 } });
    until(m, () => crate.grounded);
    expect(crate.pos.y).toBeCloseTo(4, 6);

    const gone = {
      points: [
        [20, 40],
        [40, 40],
        [40, 50],
        [20, 50],
      ] as [number, number][],
      schedule: () => false,
    };
    registerStage({ ...testbed, id: 'entities-absent-solid', solids: [...testbed.solids, gone] });
    const m2 = createMatch({
      seed: 1,
      stage: 'entities-absent-solid',
      stocks: 3,
      ports: [{ fighter: 'test-gadgets' }],
    });
    const through = spawnEntity(m2, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: 0, y: 45 },
      vel: { x: 2, y: 0 },
    });
    const box = spawnEntity(m2, { kind: 'test-gadgets/crate', owner: 0, pos: { x: 30, y: 60 } });
    step(m2, 25);
    expect(through.dead).toBe(false);
    expect(through.pos.x).toBeGreaterThan(40);
    expect(box.pos.y).toBeLessThan(40);
  });

  it('rides moving floors and platforms up, down and sideways, even in hitlag, and is crushed under a descending solid (testbed)', () => {
    const m = createMatch({ seed: 1, stage: 'testbed', stocks: 3, ports: [{ fighter: 'test-gadgets' }] });
    const crate = (x: number, y: number) =>
      spawnEntity(m, { kind: 'test-gadgets/crate', owner: -1, pos: { x, y } });
    const lifted = crate(120, -36);
    const glided = crate(0, 34);
    const circled = crate(-107, 31);
    const crushed = crate(-50, 4);
    const reasons: string[] = [];
    const offsets = new Set<string>();
    while (m.frame < 420) {
      if (m.frame === 100 || m.frame === 300) lifted.hitlag = 13;
      step(m, 1);
      for (const ev of m.events) if (ev.type === 'entityDestroy') reasons.push(`${ev.id}:${ev.reason}`);
      if (m.frame < 30) continue;
      const st = m.stage;
      expect(lifted.grounded).toBe(true);
      expect(lifted.pos.y).toBeCloseTo(st.solids[1]!.y + 4, 6);
      expect(glided.pos.y).toBeCloseTo(30 + 4, 6);
      expect(circled.pos.y).toBeCloseTo(25 + st.platforms[2]!.y + 4, 6);
      offsets.add(
        [glided.pos.x - st.platforms[0]!.x, circled.pos.x - st.platforms[2]!.x]
          .map((v) => v.toFixed(6))
          .join(),
      );
    }
    expect(offsets.size).toBe(1);
    expect(reasons).toEqual([`${crushed.id}:stage`]);
  });

  it('disappears past a blast zone and on the stage when it does not bounce', () => {
    const { m } = duel('test-gadgets', 'test-gadgets', -60, 60);
    const out = spawnEntity(m, {
      kind: 'test-gadgets/minion',
      owner: 0,
      pos: { x: 230, y: 50 },
      vel: { x: 0, y: 0 },
    });
    out.kb.x = 20;
    const down = spawnEntity(m, {
      kind: 'test-gadgets/bolt',
      owner: 0,
      pos: { x: 0, y: 10 },
      vel: { x: 0, y: -2 },
    });
    step(m, 8);
    expect(out.dead).toBe(true);
    expect(down.dead).toBe(true);
    expect(m.entities).toHaveLength(0);
  });
});
