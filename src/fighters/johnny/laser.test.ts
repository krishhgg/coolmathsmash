import { describe, expect, it } from 'vitest';
import {
  hitlagFrames,
  hitstunFrames,
  isTumble,
  knockback,
  shieldstunFrames,
} from '../../sim/combat/formulas';
import type { EntityState } from '../../sim/entities/types';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, runPorts, testMatch, until, type Hold } from '../../sim/testing/sim';
import { entities, LASER } from './entities';
import { LASER_GUN, moves } from './moves';

/**
 * Falco's Blaster in Ultimate, the move Laser Gun copies: SmashWiki's Falco (SSBU)/Neutral special (hitbox table,
 * timing and laser parameters) and ultimateframedata.com (startup, FAF and fire rate), and SmashWiki's Falco (SSBU)
 * for the 6 frames of landing lag on a short-hop shot.
 */
const FALCO = {
  ground: { shot: 8, faf: 42, rate: 26, repeat: [2, 17] },
  air: { shot: 7, faf: 39, rate: 23, repeat: [2, 15], landingLag: 6 },
  laser: { speed: 4.6, lifetime: 27, radius: 1.44 },
  hit: { damage: 3, angle: 361, kbg: 100, bkb: 0, wbkb: 20, hitlag: 0.1, effect: 'electric' },
} as const;

const SPECIAL: Hold = { buttons: ['special'] };
const lasers = (m: MatchState) => m.entities.filter((e) => e.kind === 'johnny/laser');

/**
 * Starts Laser Gun from standing (or high in the air), presses Special again on each of `presses` (move frames of the
 * first shot), and records the frames a laser appears on and the frame the move ends (its FAF).
 */
function fire(presses: number[], air = false): { shots: number[]; faf: number } {
  const m = testMatch({ fighter: 'johnny' });
  const f = air ? placeInAir(m, 0, 150) : m.fighters[0]!;
  const name = air ? 'neutralBAir' : 'neutralB';
  const shots: number[] = [];
  let frame = 0;
  do {
    frame++;
    const before = lasers(m).length;
    run(m, 1, frame === 1 || presses.includes(frame) ? SPECIAL : {});
    if (frame === 1) expect(f.move).toBe(name);
    if (lasers(m).length > before) shots.push(frame);
  } while (f.move === name && frame < 300);
  return { shots, faf: frame };
}

/** Johnny at x = -40 facing the Mario reference (the roster's weight-98 target) standing at 0, on Battlefield. */
function duel(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'johnny' }, { fighter: marioReference.id }],
  });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, -40, 1],
    [v, 0, -1],
  ] as const)
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, facing, intangible: 0 });
  runPorts(m, 20, []);
  expect(a.action).toBe('idle');
  return { m, a, v };
}

/** Laser Gun at a standing target at `percent`: the launch it gets and its hitlag and hitstun frames. */
function shoot(percent: number): { v: FighterState; kb: number; hitlag: number; hitstun: number } {
  const { m, v } = duel();
  v.damage = percent;
  runPorts(m, 1, [SPECIAL]);
  for (let i = 0; i < 40 && !v.launch; i++) runPorts(m, 1, []);
  const kb = v.launch!.kb;
  const hitlag = v.hitlag;
  runPorts(m, v.hitlag + 1, []);
  let hitstun = 1;
  while (v.action === 'hitstun') {
    runPorts(m, 1, []);
    hitstun++;
  }
  return { v, kb, hitlag, hitstun: hitstun - 1 };
}

describe("Johnny Upgrade: Laser Gun (Falco's Blaster)", () => {
  it("carries Falco's frame data and laser", () => {
    expect(moves.neutralB).toMatchObject({ faf: FALCO.ground.faf, air: 'neutralBAir', hits: [] });
    expect(moves.neutralBAir).toMatchObject({ faf: FALCO.air.faf, landingLag: FALCO.air.landingLag });
    expect(moves.neutralB!.spawn).toEqual([
      { frame: FALCO.ground.shot, entity: 'laser', x: LASER_GUN.x, y: LASER_GUN.y, vx: FALCO.laser.speed },
    ]);
    expect(moves.neutralBAir!.spawn).toEqual([
      { frame: FALCO.air.shot, entity: 'laser', x: LASER_GUN.x, y: LASER_GUN.airY, vx: FALCO.laser.speed },
    ]);
    expect(LASER).toEqual(FALCO.laser);
    expect(entities.laser).toMatchObject({ radius: 1.44, lifetime: 27, transcendent: true });
    expect(entities.laser!.hits).toEqual([
      { frames: [1, 27], boxes: [{ id: 0, x: 0, y: 0, radius: 1.44, ...FALCO.hit }] },
    ]);
  });

  it('one press fires one laser from the muzzle on frame 8 and he acts on frame 42', () => {
    expect(fire([])).toEqual({ shots: [FALCO.ground.shot], faf: FALCO.ground.faf });
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    run(m, 1, SPECIAL);
    until(m, () => lasers(m).length > 0);
    expect(f.actionFrame).toBe(8);
    expect(lasers(m)[0]).toMatchObject({
      owner: 0,
      age: 1,
      facing: f.facing,
      move: 'neutralB',
      pos: { x: f.pos.x + LASER_GUN.x * f.facing, y: f.pos.y + LASER_GUN.y },
      vel: { x: 4.6 * f.facing, y: 0 },
    });
  });

  it('flies 4.6 units a frame in a straight line for 27 frames: 119.6 units past the muzzle, then it is gone', () => {
    const m = testMatch({ fighter: 'johnny', x: -60 });
    const f = m.fighters[0]!;
    f.facing = 1;
    run(m, 1, SPECIAL);
    until(m, () => lasers(m).length > 0);
    const laser = lasers(m)[0] as EntityState;
    const start = { ...laser.pos };
    let frames = 1;
    let last = start;
    while (lasers(m).includes(laser)) {
      last = { ...laser.pos };
      run(m, 1);
      if (lasers(m).includes(laser)) {
        frames++;
        expect(laser.pos.x - last.x).toBeCloseTo(FALCO.laser.speed, 9);
      }
    }
    expect(frames).toBe(FALCO.laser.lifetime);
    expect(last.x - start.x).toBeCloseTo(26 * 4.6, 9);
    expect(last.x - start.x).toBeCloseTo(119.6, 9);
    expect(last.y).toBe(start.y);
  });

  it('pressing Special again by frame 17 fires again 26 frames later; a later press does not', () => {
    // The press that starts the move is frame 1, so a fresh press can come on frame 3 at the earliest.
    for (const press of [3, 10, 17]) {
      expect(fire([press]), `press on ${press}`).toEqual({ shots: [8, 34], faf: 42 + 26 });
    }
    expect(fire([18])).toEqual({ shots: [8], faf: 42 });
    expect(fire([30])).toEqual({ shots: [8], faf: 42 });
    // Mashing through frame 100: a shot every 26 frames while the presses keep coming.
    const mash = fire(Array.from({ length: 50 }, (_, i) => 2 + 2 * i));
    expect(mash.shots).toEqual([8, 34, 60, 86, 112]);
    expect(mash.shots.slice(1).map((s, i) => s - mash.shots[i]!)).toEqual(Array(4).fill(FALCO.ground.rate));
  });

  it('in the air: the laser on frame 7, FAF 39, and another every 23 frames from presses on frames 2-15', () => {
    expect(fire([], true)).toEqual({ shots: [FALCO.air.shot], faf: FALCO.air.faf });
    expect(fire([15], true)).toEqual({ shots: [7, 30], faf: 39 + 23 });
    expect(fire([16], true)).toEqual({ shots: [7], faf: 39 });
  });

  it('a shot that lands early has 6 frames of landing lag (a short-hop laser)', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = placeInAir(m, 0, 12);
    run(m, 1, SPECIAL);
    expect(f.move).toBe('neutralBAir');
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(FALCO.air.landingLag);
  });

  it('hits for 3% (x1.05 fresh, x1.2 in 1v1) with x0.1 electric hitlag, and is used up by the hit', () => {
    const { m, a, v } = duel();
    runPorts(m, 1, [SPECIAL]);
    for (let i = 0; i < 40 && v.damage === 0; i++) runPorts(m, 1, []);
    expect(v.damage).toBeCloseTo(3 * 1.05 * 1.2, 6);
    expect(v.hitlag).toBe(hitlagFrames(3 * 1.05, { mult: 0.1, electric: true }));
    expect(v.hitlag).toBe(1);
    expect(a.hitlag).toBe(0);
    expect(lasers(m)).toHaveLength(0);
    expect(a.staleQueue).toEqual(['neutralB']);
  });

  it('flinches for 12 frames without tumbling, the same at 0% and at 150% (20 set knockback)', () => {
    const kb = knockback({ percent: 0, damage: 3, kbg: 100, bkb: 0, wbkb: 20, weight: 98 });
    expect(kb).toBeCloseTo((11 * (200 / 198) * 1.4 + 18) * 1, 9);
    expect(isTumble(kb)).toBe(false);
    expect(hitstunFrames(kb)).toBe(12);
    for (const percent of [0, 150]) {
      const shot = shoot(percent);
      expect(shot.kb, `${percent}%`).toBeCloseTo(kb, 6);
      expect(shot.hitstun, `${percent}%`).toBe(12);
      expect(shot.v.action, `${percent}%`).toBe('idle');
    }
  });

  it('never KOs: set knockback launches the same at 999% as at 0%', () => {
    const box = entities.laser!.hits![0]!.boxes[0]!;
    expect(koPercent({ hit: box })).toBeNull();
    expect(koPercent({ hit: box, from: 'centre', air: true })).toBeNull();
  });

  it("on a shield: 2 frames of projectile shieldstun (ultimateframedata's 2) and no %", () => {
    const { m, v } = duel();
    const shield: Hold[] = [{}, { buttons: ['shield'] }];
    runPorts(m, 5, shield);
    runPorts(m, 1, [SPECIAL, { buttons: ['shield'] }]);
    for (let i = 0; i < 40 && v.action !== 'shieldStun'; i++) runPorts(m, 1, shield);
    expect(v.action).toBe('shieldStun');
    expect(v.damage).toBe(0);
    expect(v.hitstun).toBe(shieldstunFrames(3 * 1.05, 'projectile'));
    expect(v.hitstun).toBe(2);
    expect(lasers(m)).toHaveLength(0);
  });
});
