import { describe, expect, it } from 'vitest';
import { placeInAir, run, testMatch } from '../testing/sim';
import { destroyEntity, entityPlatform, registerEntity, spawnEntity, standingOn } from './entities';

/** A 16-wide soft platform 2 above the entity's centre, which stays put (no velocity, gravity or weight). */
registerEntity('test/deck', { radius: 3, floor: 'pass', wall: 'pass', platform: { width: 16, y: 2 } });

/** Mario on Battlefield with a deck off the right side of the stage: surface y 2, from x 112 to 128. */
function withDeck() {
  const m = testMatch();
  const e = spawnEntity(m, { kind: 'test/deck', owner: -1, pos: { x: 120, y: 0 } });
  return { m, e, f: m.fighters[0]! };
}

/** Drop Mario onto the deck from above and let him settle there. */
function standOnDeck() {
  const d = withDeck();
  placeInAir(d.m, 120, 20);
  run(d.m, 60);
  expect(d.f.ground).toMatchObject({ kind: 'entity', index: d.e.id });
  expect(d.f.action).toBe('idle');
  return d;
}

describe('entity platforms', () => {
  it('puts the surface on top of the entity, as wide as EntityDef.platform says', () => {
    const { e } = withDeck();
    expect(entityPlatform(e)).toEqual({ x1: 112, x2: 128, y: 2 });
  });

  it('catches a fighter falling onto it, who then stands on its surface', () => {
    const { m, e, f } = standOnDeck();
    expect(f.pos.y).toBe(2);
    expect(standingOn(m, e)).toEqual([f]);
    run(m, 120);
    expect(f.ground).toMatchObject({ kind: 'entity', index: e.id });
    expect(f.pos.y).toBe(2);
  });

  it('lets a fighter rise up through it from below and land on it coming down', () => {
    const { m, e, f } = withDeck();
    placeInAir(m, 120, -6);
    f.vel.y = 2.5;
    let above = false;
    for (let i = 0; i < 120 && !f.ground; i++) {
      run(m, 1);
      if (f.pos.y > 2 && !f.ground) above = true;
    }
    expect(above).toBe(true);
    expect(f.ground).toMatchObject({ kind: 'entity', index: e.id });
  });

  it('lets a fighter holding down fall through it', () => {
    const { m, f } = withDeck();
    placeInAir(m, 120, 20);
    run(m, 40, { y: -100 });
    expect(f.ground).toBeNull();
    expect(f.pos.y).toBeLessThan(-10);
  });

  it('catches its owner on the frame it appears under them, even while they hold down', () => {
    for (const owner of [0, -1]) {
      const m = testMatch();
      const f = placeInAir(m, 120, 40);
      run(m, 10, { y: -100 });
      expect(f.vel.y).toBeLessThan(0);
      // Spawned between frames, it is new (age 0) while the fighters act on the next one.
      const e = spawnEntity(m, { kind: 'test/deck', owner, pos: { x: f.pos.x, y: f.pos.y - 2 } });
      run(m, 1, { y: -100 });
      if (owner === 0) expect(f.ground).toMatchObject({ kind: 'entity', index: e.id });
      else expect(f.ground).toBeNull();
    }
  });

  it('drops a standing fighter through it on a down flick', () => {
    const { m, f } = standOnDeck();
    run(m, 1, { y: -100 });
    run(m, 20);
    expect(f.ground).toBeNull();
    expect(f.pos.y).toBeLessThan(0);
  });

  it('lets a fighter walk off its end', () => {
    const { m, f } = standOnDeck();
    run(m, 40, { x: 100 });
    expect(f.ground).toBeNull();
    expect(f.pos.x).toBeGreaterThan(128);
  });

  it('stays put with a fighter on it, carrying nobody', () => {
    const { m, e, f } = standOnDeck();
    run(m, 120);
    expect(e.pos).toEqual({ x: 120, y: 0 });
    expect(f.pos.y).toBe(2);
  });

  it('drops whoever stands on it on the frame after it is destroyed', () => {
    const { m, e, f } = standOnDeck();
    destroyEntity(m, e, 'script');
    run(m, 1);
    expect(f.ground).toBeNull();
    expect(f.action).toBe('fall');
    run(m, 10);
    expect(f.pos.y).toBeLessThan(2);
  });
});
