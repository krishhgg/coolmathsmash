import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type HitboxDef, type MoveDef } from '../../fighters/types';
import { registerStage } from '../../stages/registry';
import { registerEntity, spawnEntity } from '../entities/entities';
import type { FighterState } from '../fighter';
import { createMatch, type MatchState } from '../match';
import { marioReference } from '../testing/reference';
import { attack, runPorts } from '../testing/sim';

/** The Mario reference's 12% probe box (angle 45, kbg 100, bkb 30), at 8 forward and 8 up with radius 8. */
const probe = marioReference.moves.probe.hits[0]!.boxes[0]!;

const move = (...boxes: HitboxDef[]): MoveDef => ({
  kind: 'other',
  faf: 30,
  hits: [{ frames: [1, 3], boxes }],
});
const grab = (box: Partial<HitboxDef>): MoveDef => ({
  kind: 'other',
  faf: 35,
  hits: [
    {
      frames: [1, 2],
      boxes: [{ id: 0, x: 7.5, y: 7, radius: 4.5, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true, ...box }],
    },
  ],
});

/**
 * The Mario reference with the probe box set to each `targets`, Samus' up tilt pattern (a ground-only box at 0
 * degrees and an air-only box at 90 in the same place, the ground one with the lower id), and standing grabs.
 */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-targets',
    name: 'Test targets',
    moves: {
      unset: move(probe),
      both: move({ ...probe, targets: 'both' }),
      ground: move({ ...probe, targets: 'ground' }),
      air: move({ ...probe, targets: 'air' }),
      split: move(
        { ...probe, id: 0, angle: 0, targets: 'ground' },
        { ...probe, id: 1, angle: 90, targets: 'air' },
      ),
      grab: grab({}),
      groundGrab: grab({ targets: 'ground' }),
    },
  }),
);

/** A ground-only shockwave that stays put, passes through the stage and hits everyone it touches. */
registerEntity('test/ground-wave', {
  radius: 1,
  lifetime: 20,
  floor: 'pass',
  wall: 'pass',
  pierce: true,
  hits: [{ frames: [1, 20], boxes: [{ ...probe, x: 0, y: 6, radius: 10, targets: 'ground' }] }],
});

/** A floor with a ground-only stage hitbox over x = -40 and an air-only zone over x 30 to 50. */
registerStage({
  id: 'test-targets-stage',
  name: 'test-targets-stage',
  solids: [
    {
      points: [
        [-80, 0],
        [-80, -30],
        [80, -30],
        [80, 0],
      ],
    },
  ],
  platforms: [],
  ledges: [],
  hitboxes: [{ x: -40, y: 6, boxes: [{ ...probe, x: 0, y: 0, radius: 10, targets: 'ground' }] }],
  zones: [
    {
      x1: 30,
      x2: 50,
      y1: -1,
      y2: 40,
      element: 'goo',
      hit: { damage: 2, angle: 90, kbg: 100, bkb: 0, wbkb: 50, targets: 'air' },
    },
  ],
  blastZones: { left: -400, right: 400, top: 300, bottom: -300 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-60, 0, 1],
    [60, 0, -1],
  ],
  respawns: [
    [-60, 80],
    [60, 80],
  ],
});

type Situation = 'grounded' | 'airborne';

/** Lift `f` to `y` above the floor with no ground under it, falling from rest. */
function liftInto(f: FighterState, y: number): void {
  Object.assign(f, {
    pos: { x: f.pos.x, y },
    prevPos: { x: f.pos.x, y },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    actionFrame: 1,
  });
}

/**
 * P1 (the test fighter) at x -10 facing P2 (Mario) `gap` units in front, both standing on Battlefield; an airborne
 * P2 is lifted 4 units, still inside the probe box.
 */
function duel(p2: Situation, gap = 8): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'test-targets' }, { fighter: marioReference.id }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, -10, 1],
    [v, -10 + gap, -1],
  ] as const)
    Object.assign(f, {
      pos: { x, y: 0 },
      prevPos: { x, y: 0 },
      vel: { x: 0, y: 0 },
      facing,
      ground: a.ground,
    });
  if (p2 === 'airborne') liftInto(v, 4);
  return { m, a, v };
}

/** P1 starts `name`; returns the duel after its first active frame. */
function swing(name: string, p2: Situation, gap?: number) {
  const d = duel(p2, gap);
  attack(d.m, 0, name);
  runPorts(d.m, 1, [{}, {}]);
  return d;
}

describe('hitbox targets (HitboxDef.targets)', () => {
  it.each([
    ['unset', 'grounded', true],
    ['unset', 'airborne', true],
    ['both', 'grounded', true],
    ['both', 'airborne', true],
    ['ground', 'grounded', true],
    ['ground', 'airborne', false],
    ['air', 'grounded', false],
    ['air', 'airborne', true],
  ] as const)('targets %s, fighter %s: hits %s', (name, p2, hits) => {
    const { m, a, v } = swing(name, p2);
    expect(v.ground === null).toBe(p2 === 'airborne');
    expect(m.events.some((e) => e.type === 'hit' && e.victim === 1)).toBe(hits);
    expect(v.damage > 0).toBe(hits);
    expect(a.hitVictims).toEqual(hits ? [1] : []);
  });

  it("picks the box that can hit the target where it is, as Samus' up tilt does with two boxes in one place", () => {
    const grounded = swing('split', 'grounded').v;
    expect(grounded.launch?.angle).toBe(0);
    const airborne = swing('split', 'airborne').v;
    expect(airborne.launch?.angle).toBe(90);
  });

  it('a ground-only box that misses an airborne fighter still hits it once it lands, later in the move', () => {
    const { m, a, v } = swing('ground', 'airborne');
    expect(v.damage).toBe(0);
    Object.assign(v, {
      pos: { x: v.pos.x, y: 0 },
      prevPos: { x: v.pos.x, y: 0 },
      ground: a.ground,
      action: 'idle',
    });
    runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeGreaterThan(0);
  });

  it('a ground-only grab box grabs a grounded fighter but not an airborne one a normal grab catches', () => {
    expect(swing('grab', 'airborne').v.action).toBe('grabbed');
    expect(swing('groundGrab', 'airborne').v.action).not.toBe('grabbed');
    expect(swing('groundGrab', 'grounded').v.action).toBe('grabbed');
  });

  it("applies to an entity's hits", () => {
    for (const [p2, hits] of [
      ['grounded', true],
      ['airborne', false],
    ] as const) {
      const { m, v } = duel(p2, 40);
      spawnEntity(m, { kind: 'test/ground-wave', owner: 0, pos: { x: v.pos.x, y: 0 } });
      runPorts(m, 2, [{}, {}]);
      expect(v.damage > 0, p2).toBe(hits);
    }
  });

  it('applies to stage hitboxes and damage zones', () => {
    const hitAt = (x: number, p2: Situation): boolean => {
      const m = createMatch({
        seed: 1,
        stage: 'test-targets-stage',
        stocks: 3,
        ports: [{ fighter: marioReference.id }],
      });
      runPorts(m, 10, [{}]);
      const f = m.fighters[0]!;
      expect(f.ground).not.toBeNull();
      Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, vel: { x: 0, y: 0 } });
      if (p2 === 'airborne') liftInto(f, 4);
      runPorts(m, 1, [{}]);
      return m.events.some((e) => e.type === 'stageHit');
    };
    expect(hitAt(-40, 'grounded')).toBe(true);
    expect(hitAt(-40, 'airborne')).toBe(false);
    expect(hitAt(40, 'grounded')).toBe(false);
    expect(hitAt(40, 'airborne')).toBe(true);
  });
});
