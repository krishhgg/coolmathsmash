import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { allFighters, getFighter } from '../fighters/registry';
import { spawnEntity } from '../sim/entities/entities';
import type { EntityState } from '../sim/entities/types';
import { PLANET } from '../sim/items/planet';
import { createMatch, type MatchState } from '../sim/match';
import { EntityView, entityArt, propPlacement } from './entities';
import { fighterArt } from './fighterView';
import { drawPlanetEntity } from './items';
import type { PropArt } from './rig/types';

function match(): MatchState {
  return createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'fireboy' }, { fighter: 'papa-louie' }],
  });
}

describe('entityArt', () => {
  it("picks the fighter's projectile art for kinds that have it", () => {
    expect(entityArt('fireboy/fireball')?.prop.symbol).toBe('fxBall');
    expect(entityArt('johnny/laser')?.prop.symbol).toBe('laserBolt');
    expect(entityArt('fluffy/candy')?.prop.symbol).toBe('candy');
  });

  it('returns null for kinds without art, so they draw the disc', () => {
    expect(entityArt('papa-louie/pepperBomb')).toBeNull();
    expect(entityArt('papa-louie/pepperBurst')).toBeNull();
    expect(entityArt('fireboy/nothing')).toBeNull();
    expect(entityArt('nobody/fireball')).toBeNull();
    expect(entityArt('planet')).toBeNull();
    expect(entityArt(PLANET)).toBeNull();
  });

  it("every projectile drawing names one of its fighter's entities, so matches use it", () => {
    for (const def of Object.values(allFighters())) {
      for (const name of Object.keys(fighterArt(def)?.projectiles ?? {}))
        expect(def.entities?.[name], `${def.id}/${name}`).toBeDefined();
    }
  });
});

describe('propPlacement', () => {
  const plain: PropArt = { symbols: {}, symbol: 'x', scale: 1 };
  const aligned: PropArt = { ...plain, align: true };
  const at = (o: Partial<EntityState>): EntityState => {
    const e = spawnEntity(match(), { kind: 'fireboy/fireball', owner: 0, pos: { x: 0, y: 0 } });
    return { ...e, ...o };
  };

  it('interpolates the centre with y flipped down and clocks loops by age', () => {
    const e = at({ prevPos: { x: 0, y: 2 }, pos: { x: 4, y: 6 }, age: 9 });
    expect(propPlacement(e, plain, 0.5)).toMatchObject({ x: 2, y: -4, frame: 9 });
  });

  it('mirrors a plain prop with the facing and never turns it', () => {
    const e = at({ facing: -1, vel: { x: -1, y: -1 } });
    expect(propPlacement(e, plain, 1)).toMatchObject({ scaleX: -1, rotation: 0 });
  });

  it('turns an aligned prop to its travel and keeps it upright both ways', () => {
    const down = Math.atan2(1.1, 1.4);
    expect(propPlacement(at({ vel: { x: 1.4, y: -1.1 } }), aligned, 1)).toMatchObject({
      scaleX: 1,
      rotation: down,
    });
    // Moving left and down: mirrored, then turned the other way, so the nose points down-left.
    const left = propPlacement(at({ facing: 1, vel: { x: -1.4, y: -1.1 } }), aligned, 1);
    expect(left).toMatchObject({ scaleX: -1, rotation: -down });
    expect(propPlacement(at({ facing: -1, vel: { x: 0, y: 0 } }), aligned, 1)).toMatchObject({
      scaleX: -1,
      rotation: 0,
    });
  });
});

describe('EntityView', () => {
  it('draws a fireball with its art and a Pepper Bomb as the disc, and drops views of entities that left', () => {
    const m = match();
    const fireball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 0,
      pos: { x: 10, y: 5 },
      vel: { x: -1.4, y: 0 },
      facing: -1,
    });
    spawnEntity(m, { kind: 'papa-louie/pepperBomb', owner: 1, pos: { x: -10, y: 5 } });
    fireball.age = 1;
    const view = new EntityView();
    view.draw(m, 1, ['default', 'default']);

    expect(view.props.children).toHaveLength(1);
    const prop = view.props.children[0]!;
    expect(prop.position).toMatchObject({ x: 10, y: -5 });
    expect(prop.scale.x).toBe(-1);
    const g = prop.children[0] as Graphics;
    expect(g.scale.x).toBe(0.7);
    expect(g.context.instructions.length).toBeGreaterThan(0);
    // The pepper's disc is the only thing in the placeholder layer.
    expect(view.discs.context.instructions.length).toBeGreaterThan(0);

    // fxBall flickers at 30 fps on the entity's age: age 2 is its second drawing.
    const first = g.context;
    fireball.age = 2;
    view.draw(m, 1, ['default', 'default']);
    expect(view.props.children[0]).toBe(prop);
    expect(g.context).not.toBe(first);

    m.entities = m.entities.filter((e) => e !== fireball);
    view.draw(m, 1, ['default', 'default']);
    expect(view.props.children).toHaveLength(0);
    expect(view.discs.context.instructions.length).toBeGreaterThan(0);

    m.entities = [];
    view.draw(m, 1, ['default', 'default']);
    expect(view.discs.context.instructions).toHaveLength(0);
  });

  it('draws the Coolmath Planet with its item drawing, not a disc', () => {
    const m = match();
    const planet = spawnEntity(m, { kind: PLANET, owner: -1, pos: { x: 0, y: 30 } });
    const view = new EntityView();
    view.draw(m, 1, ['default', 'default']);
    expect(view.props.children).toHaveLength(0);
    const expected = new Graphics();
    drawPlanetEntity(expected, planet, 0, -30, m.frame);
    const actions = (g: Graphics) => g.context.instructions.map((i) => i.action);
    expect(actions(view.discs)).toEqual(actions(expected));
    const box = (g: Graphics) => {
      const { minX, minY, maxX, maxY } = g.context.bounds;
      return [minX, minY, maxX, maxY];
    };
    expect(box(view.discs)).toEqual(box(expected));
    // A placeholder disc of the planet's radius would be one fill and stroke, far fewer instructions.
    expect(actions(view.discs).length).toBeGreaterThan(2);
  });

  it("dresses a prop in its owner's costume and rebuilds it when a reflection changes owner", () => {
    const m = match();
    const fireball = spawnEntity(m, { kind: 'fireboy/fireball', owner: 0, pos: { x: 0, y: 5 } });
    const palettes = Object.keys(fighterArt(getFighter('fireboy'))!.palettes);
    const alt = palettes.find((p) => p !== 'default')!;
    const view = new EntityView();
    view.draw(m, 1, [alt, 'default']);
    const before = (view.props.children[0]!.children[0] as Graphics).context;
    fireball.owner = 1;
    view.draw(m, 1, [alt, 'default']);
    expect(view.props.children).toHaveLength(1);
    expect((view.props.children[0]!.children[0] as Graphics).context).not.toBe(before);
  });
});
