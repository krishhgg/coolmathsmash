import { Container, DOMAdapter, Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { allFighters, getFighter, registerFighter } from '../fighters/registry';
import { spawnEntity } from '../sim/entities/entities';
import type { EntityState } from '../sim/entities/types';
import type { FighterState } from '../sim/fighter';
import { PLANET } from '../sim/items/planet';
import { inFinalSmash } from '../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { input } from '../sim/testing/sim';
import { finalTrapTester, noFinalTester } from '../sim/testing/finalSmash';
import { gadgets } from '../sim/testing/gadgets';
import { EntityView, entityArt, layerFighters, propPlacement, propSymbol } from './entities';
import { FighterView, fighterArt } from './fighterView';
import { drawPlanetEntity } from './items';
import { Renderer } from './renderer';
import type { PropArt } from './rig/types';

/** A test-only fighter whose entities have no art, so they always draw the disc. */
registerFighter(gadgets);

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
    expect(entityArt('papa-louie/pepperBomb')?.prop.symbol).toBe('pepperBomb');
    expect(entityArt('papa-louie/pepperBurst')?.prop.symbol).toBe('pepperBurst');
  });

  it('returns null for kinds without art, so they draw the disc', () => {
    expect(entityArt('test-gadgets/bolt')).toBeNull();
    expect(entityArt('test-gadgets/crate')).toBeNull();
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

describe('propSymbol', () => {
  it('draws each stack prop on one spot by its rank there, from the state, and counts down as they go', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'raftwars' }, { fighter: 'raftwars' }],
    });
    const mark = (owner: number, x: number) =>
      spawnEntity(m, { kind: 'raftwars/lockMark', owner, pos: { x, y: 7 } });
    const marks = [0, 1, 2, 3, 4, 5].map(() => mark(0, 10));
    const [apart, theirs] = [mark(0, -20), mark(1, 10)];
    const prop = entityArt('raftwars/lockMark')!.prop;
    const stack = prop.stack!;
    const symbol = (e: EntityState) => propSymbol(m, e, prop);
    // Six on one spot draw by rank, the sixth as the last of the stack; one elsewhere, or another owner's on the same
    // spot, starts its own stack.
    expect(marks.map(symbol)).toEqual([...stack, stack.at(-1)]);
    expect([apart, theirs].map(symbol)).toEqual([stack[0], stack[0]]);
    // Without `stack` a prop draws its own symbol.
    const ball = spawnEntity(m, { kind: 'fireboy/fireball', owner: 0, pos: { x: 10, y: 7 } });
    expect(propSymbol(m, ball, entityArt('fireboy/fireball')!.prop)).toBe('fxBall');

    // The view draws the rank's drawing, and swaps it when a mark below goes.
    m.entities = [marks[0]!, marks[1]!];
    for (const e of m.entities) e.age = 1;
    const view = new EntityView();
    const widths = () => {
      view.draw(m, 1, ['default', 'default']);
      return (view.over.children as Container[]).map((c) => (c.children[0] as Graphics).context.bounds.width);
    };
    const [inner, outer] = widths() as [number, number];
    expect(outer).toBeGreaterThan(inner + 2);
    m.entities = [marks[1]!];
    expect(widths()).toEqual([inner]);
  });

  it('draws a mark above a burst on the same spot, whichever came first', () => {
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports: [{ fighter: 'raftwars' }] });
    spawnEntity(m, { kind: 'raftwars/lockMark', owner: 0, pos: { x: 10, y: 7 } });
    spawnEntity(m, { kind: 'raftwars/volleyBlast', owner: 0, pos: { x: 10, y: 7 }, final: true });
    expect(entityArt('raftwars/lockMark')!.prop.above).toBe(true);
    const view = new EntityView();
    view.draw(m, 1, ['default']);
    const [markView] = view.over.children as [Container];
    const [burstView] = view.props.children as [Container];
    expect(markView.position).toMatchObject({ x: 10, y: -7 });
    expect(burstView.position).toMatchObject({ x: 10, y: -7 });
    expect(view.container.getChildIndex(view.over)).toBeGreaterThan(view.container.getChildIndex(view.props));
    // A later mark still goes above an earlier burst.
    spawnEntity(m, { kind: 'raftwars/lockMark', owner: 0, pos: { x: 10, y: 7 } });
    view.draw(m, 1, ['default']);
    expect(view.over.children).toHaveLength(2);
    expect(view.props.children).toEqual([burstView]);
  });
});

describe('EntityView', () => {
  it('draws a fireball and a Pepper Bomb with their art and an artless kind as the disc, and drops views of entities that left', () => {
    const m = match();
    const fireball = spawnEntity(m, {
      kind: 'fireboy/fireball',
      owner: 0,
      pos: { x: 10, y: 5 },
      vel: { x: -1.4, y: 0 },
      facing: -1,
    });
    spawnEntity(m, { kind: 'papa-louie/pepperBomb', owner: 1, pos: { x: -10, y: 5 } });
    spawnEntity(m, { kind: 'test-gadgets/bolt', owner: 1, pos: { x: 0, y: 20 } });
    fireball.age = 1;
    const view = new EntityView();
    view.draw(m, 1, ['default', 'default']);

    expect(view.props.children).toHaveLength(2);
    const [prop, pepper] = view.props.children as [Container, Container];
    expect(prop.position).toMatchObject({ x: 10, y: -5 });
    expect(prop.scale.x).toBe(-1);
    const g = prop.children[0] as Graphics;
    expect(g.scale.x).toBe(0.7);
    expect(g.context.instructions.length).toBeGreaterThan(0);
    expect(pepper.position).toMatchObject({ x: -10, y: -5 });
    expect((pepper.children[0] as Graphics).context.instructions.length).toBeGreaterThan(0);
    // The bolt's disc is the only thing in the placeholder layer.
    expect(view.discs.context.instructions.length).toBeGreaterThan(0);

    // fxBall flickers at 30 fps on the entity's age: age 2 is its second drawing.
    const first = g.context;
    fireball.age = 2;
    view.draw(m, 1, ['default', 'default']);
    expect(view.props.children[0]).toBe(prop);
    expect(g.context).not.toBe(first);

    m.entities = m.entities.filter((e) => e !== fireball);
    view.draw(m, 1, ['default', 'default']);
    expect(view.props.children).toEqual([pepper]);
    expect(view.discs.context.instructions.length).toBeGreaterThan(0);

    m.entities = [];
    view.draw(m, 1, ['default', 'default']);
    expect(view.discs.context.instructions).toHaveLength(0);
  });

  it('draws a prop with a front behind the fighters and its front into its own layer, and drops both views', () => {
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports: [{ fighter: 'raftwars' }] });
    const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 0, pos: { x: 4, y: 2.5 }, facing: -1 });
    const view = new EntityView();
    view.draw(m, 1, ['default']);
    expect(view.back.children).toHaveLength(1);
    expect(view.fronts.children).toHaveLength(1);
    expect(view.props.children).toHaveLength(0);
    const [body] = view.back.children as [Container];
    const [rim] = view.fronts.children as [Container];
    for (const c of [body, rim]) {
      expect(c.position).toMatchObject({ x: 4, y: -2.5 });
      expect(c.scale.x).toBe(-1);
    }
    const bounds = (c: Container) => (c.children[0] as Graphics).context.bounds;
    // The rim is the top band of the hull: as wide, and much shorter than the raft with its head.
    expect(bounds(rim).maxY - bounds(rim).minY).toBeLessThan((bounds(body).maxY - bounds(body).minY) / 3);
    expect(bounds(rim).width).toBeGreaterThan(14);

    m.entities = m.entities.filter((e) => e !== raft);
    view.draw(m, 1, ['default']);
    expect(view.back.children).toHaveLength(0);
    expect(view.fronts.children).toHaveLength(0);
  });

  it("draws Ball Rain's balls under the fighter layer and a fireball over it", () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }],
    });
    const ball = spawnEntity(m, {
      kind: 'redball/ball',
      owner: 0,
      pos: { x: 6, y: 8 },
      vel: { x: 0.5, y: -3 },
      final: true,
    });
    spawnEntity(m, { kind: 'fireboy/fireball', owner: 1, pos: { x: -10, y: 5 } });
    // The renderer's world as it builds it, on a stand-in app (nothing here draws to a screen).
    type Layers = { world: Container; entities: EntityView; fighterLayer: Container; boatLayer: Container };
    const app = { stage: new Container(), renderer: {}, canvas: {} };
    const r = new (Renderer as unknown as new (app: unknown, quality: string) => Layers)(app, 'lite');
    // The ball's gradients bake into a canvas, which node lacks: a stand-in that takes the drawing calls.
    const adapter = DOMAdapter.get();
    const gradient = { addColorStop: () => {} };
    const context = {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      fillRect: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      fillStyle: '',
    };
    DOMAdapter.set({
      ...adapter,
      createCanvas: (width = 1, height = 1) =>
        ({ width, height, getContext: () => context }) as unknown as ReturnType<typeof adapter.createCanvas>,
    });
    try {
      r.entities.draw(m, 1, ['default', 'default']);
    } finally {
      DOMAdapter.set(adapter);
    }
    expect(r.entities.back.children).toHaveLength(1);
    expect(r.entities.fronts.children).toHaveLength(0);
    expect(r.entities.props.children).toHaveLength(1);
    const [body] = r.entities.back.children as [Container];
    expect(body.position).toMatchObject({ x: 6, y: -8 });
    expect((body.children[0] as Graphics).context.instructions.length).toBeGreaterThan(0);
    const at = (c: Container) => r.world.getChildIndex(c);
    expect(at(r.entities.back)).toBeLessThan(at(r.boatLayer));
    expect(at(r.entities.back)).toBeLessThan(at(r.fighterLayer));
    expect(at(r.entities.container)).toBeGreaterThan(at(r.fighterLayer));

    m.entities = m.entities.filter((e) => e !== ball);
    r.entities.draw(m, 1, ['default', 'default']);
    expect(r.entities.back.children).toHaveLength(0);
  });

  it('puts only the fighters standing in a raft under its rim, everyone else over it, in port order', () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'raftwars' }, { fighter: 'fireboy' }],
    });
    const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 1, pos: { x: 0, y: 2.5 } });
    const crate = spawnEntity(m, { kind: 'test-gadgets/crate', owner: 0, pos: { x: 30, y: 0 } });
    const [a, kids, c] = m.fighters as [FighterState, FighterState, FighterState];
    const on = (e: EntityState) => ({ kind: 'entity' as const, index: e.id, x1: -7, x2: 7, y: 3.5 });
    kids.ground = on(raft);
    // Fireboy 0 stands on the floor under the raft; Fireboy 2 stands on an entity without a front.
    c.ground = on(crate);
    const views = m.fighters.map(() => new Container());
    const boat = new Container({ sortableChildren: true });
    const rest = new Container({ sortableChildren: true });
    layerFighters(m, views, boat, rest);
    expect(boat.children).toEqual([views[1]]);
    expect(rest.children).toEqual([views[0], views[2]]);
    expect(views.map((v) => v.zIndex)).toEqual([0, 1, 2]);

    // Out of the raft the kids go back among the others, in port order; a fighter in the raft goes under the rim.
    kids.ground = null;
    a.ground = on(raft);
    layerFighters(m, views, boat, rest);
    expect(boat.children).toEqual([views[0]]);
    rest.sortChildren();
    expect(rest.children).toEqual([views[1], views[2]]);
    // A raft that is gone no longer holds anyone under its rim.
    m.entities = [];
    layerFighters(m, views, boat, rest);
    expect(boat.children).toEqual([]);
    rest.sortChildren();
    expect(rest.children).toEqual(views);
  });

  it("draws a Final Smash user over every other port, raft or not, after the renderer's per-frame update", () => {
    // The in-game capture's setup: the Final Smash user on port 0, the foe it catches on 1, someone held on 2. The
    // trap tester stands in for Bob the Robber, whose rig's gradients need a browser canvas to build.
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: finalTrapTester.id }, { fighter: noFinalTester.id }, { fighter: noFinalTester.id }],
    });
    const [bob, caught] = m.fighters as [FighterState, FighterState, FighterState];
    m.fighters.forEach((f, i) => {
      const x = [-30, -16, 60][i]!;
      Object.assign(f, {
        pos: { x, y: 1 },
        prevPos: { x, y: 1 },
        ground: null,
        action: 'fall',
        facing: i ? -1 : 1,
      });
    });
    const idle = () => m.players.map(() => input({}));
    for (let i = 0; i < 30; i++) stepMatch(m, idle());
    const views = m.fighters.map((f) => new FighterView(getFighter(f.fighter), f.port, 'default', true));
    const boat = new Container({ sortableChildren: true });
    const rest = new Container({ sortableChildren: true });
    /** One rendered frame's fighters, in the renderer's order: every view's update, then layerFighters. */
    const draw = () => {
      m.fighters.forEach((f, i) => views[i]!.update(f, 1, m.frame, false));
      layerFighters(
        m,
        views.map((v) => v.container),
        boat,
        rest,
      );
      for (const layer of [boat, rest]) layer.sortChildren();
      const ports = (layer: Container) =>
        layer.children.map((c) => views.findIndex((v) => v.container === c));
      return { boat: ports(boat), rest: ports(rest) };
    };
    expect(draw()).toEqual({ boat: [], rest: [0, 1, 2] });
    bob.finalReady = true;
    stepMatch(m, [input({ buttons: ['special'] }), input({}), input({})]);
    let frames = 0;
    for (; frames < 600 && inFinalSmash(bob); frames++) {
      expect(draw()).toEqual({ boat: [], rest: [1, 2, 0] });
      stepMatch(m, idle());
    }
    expect(caught.damage).toBeGreaterThan(24);
    expect(frames).toBeGreaterThan(150);
    expect(draw()).toEqual({ boat: [], rest: [0, 1, 2] });

    // Standing in a raft he still goes over everyone, not under its rim with the others over him.
    const raft = spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 1, pos: { x: bob.pos.x, y: 2.5 } });
    Object.assign(bob, { action: 'grabThrow', move: 'finalSmashCinematic', actionFrame: 60, grabPartner: 1 });
    bob.ground = { kind: 'entity', index: raft.id, x1: -7, x2: 7, y: 3.5 };
    expect(draw()).toEqual({ boat: [], rest: [1, 2, 0] });
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
