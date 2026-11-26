import { describe, expect, it } from 'vitest';
import type { FighterState } from '../../sim/fighter';
import { createMatch, type MatchState } from '../../sim/match';
import { meter, setMeter } from '../../sim/meters';
import { hasStatus, statusOf } from '../../sim/statuses';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { attack, placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { LASER, MUZZLE } from './entities';
import { moves } from './moves';
import {
  LIMIT,
  MAGNET,
  MEGA_LASER,
  UPGRADED,
  UPGRADED_LASER,
  UPGRADE_METER,
  meters,
  statuses,
  upgradeEntities,
} from './upgrade';

/**
 * Cloud's Limit in Ultimate, the mechanic the upgrade meter copies. SmashWiki: "Limit (status)" (gauge, rates, 15
 * seconds), "Limit Charge" (0.3 a frame from 7.0.0, 334 frames from empty, the cancels' delay), Cloud (SSBU)/Down
 * special (interruptible 8) and Cloud (SSBU)/Neutral special (Blade Beam and Limit Blade Beam hitbox tables and
 * timing). ultimateframedata.com, Cloud: Limit Charge takes 7 frames to cancel; Blade Beam startup 18, Limit Blade
 * Beam startup 16 and intangible 10-17.
 */
const CLOUD = {
  gauge: 100,
  chargePerFrame: 0.3,
  fillFrames: 334,
  dealtPerPercent: 0.667,
  takenPerPercent: 1,
  limitBreakFrames: 900,
  limitCharge: { interruptible: 8, cancelLag: 7 },
  bladeBeam: { startup: 18, interruptible: 54 },
  limitBladeBeam: {
    startup: 16,
    interruptible: 61,
    intangible: [10, 17],
    beam: { damage: 6, kbg: 60, bkb: 38, radius: 5.5 },
    loop: { damage: 2, angle: 366, kbg: 100, bkb: 0, wbkb: 40, hitlag: 0.5, rehit: 6, frames: [1, 28] },
    final: { damage: 3, angle: 48, kbg: 226, bkb: 50, frames: [29, 30] },
    burstRadius: 14,
    onTarget: 19,
    inBurst: 13,
  },
} as const;

const SPECIAL: Hold = { buttons: ['special'] };
const DOWN_SPECIAL: Hold = { y: -100, buttons: ['special'] };

/** Holds down special for `held` frames (the first one starts it), then lets go: the meter after each frame held, and
 * the move frame he can act on (the frame the move has ended on). */
function magnet(
  held: number,
  after: Hold = {},
): { meters: number[]; acts: number; f: FighterState; m: MatchState } {
  const m = testMatch({ fighter: 'johnny' });
  const f = m.fighters[0]!;
  const meters: number[] = [];
  run(m, 1, DOWN_SPECIAL);
  expect(f.move).toBe('downB');
  meters.push(meter(f, UPGRADE_METER));
  let frame = 1;
  while (f.move === 'downB' && frame < 1000) {
    frame++;
    run(m, 1, frame <= held ? SPECIAL : after);
    if (frame <= held && f.move === 'downB' && f.actionFrame < MAGNET.end)
      meters.push(meter(f, UPGRADE_METER));
  }
  return { meters, acts: frame, f, m };
}

/** Johnny at `x` facing a Mario reference (weight 98) at `vx`, on Battlefield; more Marios make it free-for-all. */
function duel(x = -40, vx = 0, marios = 1): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'johnny' }, ...Array.from({ length: marios }, () => ({ fighter: marioReference.id }))],
  });
  const [a, ...vs] = m.fighters;
  const place = (f: FighterState, at: number, facing: 1 | -1) =>
    Object.assign(f, { pos: { x: at, y: 1 }, prevPos: { x: at, y: 1 }, facing, intangible: 0 });
  place(a!, x, 1);
  vs.forEach((v, i) => place(v, i === 0 ? vx : -150 + 20 * i, -1));
  runPorts(m, 20, []);
  expect(a!.action).toBe('idle');
  return { m, a: a!, v: vs[0]! };
}

describe("Johnny Upgrade: the upgrade meter (Cloud's Limit Gauge)", () => {
  it("carries Limit's gauge, damage rates and Limit Break length", () => {
    expect(LIMIT).toEqual({
      max: CLOUD.gauge,
      charge: CLOUD.chargePerFrame,
      dealt: CLOUD.dealtPerPercent,
      taken: CLOUD.takenPerPercent,
      frames: CLOUD.limitBreakFrames,
    });
    expect(meters[UPGRADE_METER]).toEqual({ max: 100, dealt: 0.667, taken: 1, full: UPGRADED });
    expect(statuses.upgraded).toEqual({ frames: 900, color: '#ffd21a' });
  });

  it('fills from damage: 0.667 per % he deals, 1 per % he takes', () => {
    const m = testMatch({ fighter: 'johnny', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    Object.assign(v, { pos: { x: a.pos.x + 9, y: a.pos.y }, facing: -1, intangible: 0 });
    v.prevPos = { ...v.pos };
    attack(m, 0, 'ftilt');
    for (let i = 0; i < 20 && v.damage === 0; i++) runPorts(m, 1, []);
    expect(v.damage).toBeGreaterThan(0);
    expect(meter(a, UPGRADE_METER)).toBeCloseTo(0.667 * v.damage, 9);
    expect(meter(v, UPGRADE_METER)).toBeCloseTo(v.damage, 9);
  });

  it('Limit Break: a full meter shows the badge for 900 frames, then empties', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    setMeter(f, UPGRADE_METER, 100);
    run(m, 1);
    expect(statusOf(f, UPGRADED)).toMatchObject({ frames: 900, age: 0 });
    run(m, 899);
    expect([hasStatus(f, UPGRADED), meter(f, UPGRADE_METER)]).toEqual([true, 100]);
    run(m, 1);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 0, status: UPGRADED, reason: 'expired' });
    expect([hasStatus(f, UPGRADED), meter(f, UPGRADE_METER)]).toEqual([false, 0]);
  });

  it('a KO ends Limit Break and empties the meter', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    setMeter(f, UPGRADE_METER, 100);
    run(m, 1);
    Object.assign(f, { pos: { x: -400, y: 20 }, ground: null, action: 'fall' });
    run(m, 1);
    expect(f.action).toBe('ko');
    expect([hasStatus(f, UPGRADED), meter(f, UPGRADE_METER)]).toEqual([false, 0]);
  });
});

describe("Johnny Upgrade: Coin Magnet (Cloud's Limit Charge)", () => {
  it('fills 0.3 a frame from its first frame and is full on the 334th; he acts 7 frames after it fills', () => {
    const { meters: filled, acts, f } = magnet(1000);
    expect(filled).toHaveLength(CLOUD.fillFrames);
    filled.forEach((v, i) => expect(v, `frame ${i + 1}`).toBeCloseTo(Math.min(100, 0.3 * (i + 1)), 6));
    expect(filled[CLOUD.fillFrames - 2]).toBeLessThan(100);
    expect(filled[CLOUD.fillFrames - 1]).toBe(100);
    expect(acts).toBe(CLOUD.fillFrames + CLOUD.limitCharge.cancelLag);
    expect(statusOf(f, UPGRADED)?.frames).toBeLessThanOrEqual(900);
  });

  it('a tap is actionable on frame 8, and a release 7 frames after the last frame held', () => {
    expect(magnet(1)).toMatchObject({ meters: [0.3], acts: CLOUD.limitCharge.interruptible });
    const held = magnet(40);
    expect(held.acts).toBe(40 + CLOUD.limitCharge.cancelLag);
    expect(held.meters).toHaveLength(40);
    expect(meter(held.f, UPGRADE_METER)).toBeCloseTo(12, 9);
    expect(MAGNET.faf - MAGNET.end).toBe(CLOUD.limitCharge.cancelLag - 1);
    expect(moves.downB).toMatchObject({ faf: MAGNET.faf, hits: [] });
  });

  it('loops its 12-frame cycle while held, charging once a frame', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    run(m, 1, DOWN_SPECIAL);
    const frames: number[] = [];
    for (let i = 0; i < 30; i++) {
      run(m, 1, SPECIAL);
      frames.push(f.actionFrame);
    }
    expect(frames.slice(0, 18)).toEqual([2, 3, 4, ...range(5, 16), 5, 6, 7]);
    expect(meter(f, UPGRADE_METER)).toBeCloseTo(0.3 * 31, 9);
  });

  it.each([
    ['shield', { buttons: ['shield', 'special'] }, 'shield'],
    ['jump', { buttons: ['jump', 'special'] }, 'jumpSquat'],
  ] as [string, Hold, string][])(
    'a %s press ends it into the same lag, and the %s comes out when it ends',
    (_name, press, action) => {
      const { acts, f } = magnet(10, press);
      expect(acts).toBe(11 + CLOUD.limitCharge.cancelLag - 1);
      expect(f.action).toBe(action);
      expect(meter(f, UPGRADE_METER)).toBeCloseTo(3, 9);
    },
  );

  it('charges in the air and keeps charging through the landing', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = placeInAir(m, 0, 15);
    run(m, 1, DOWN_SPECIAL);
    expect([f.move, f.action]).toEqual(['downB', 'aerial']);
    let frames = 1;
    while (!f.ground) {
      run(m, 1, SPECIAL);
      frames++;
    }
    run(m, 10, SPECIAL);
    expect([f.move, f.action]).toEqual(['downB', 'attack']);
    expect(meter(f, UPGRADE_METER)).toBeCloseTo(0.3 * (frames + 10), 9);
  });

  it('with the meter already full it charges nothing and ends at once', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    setMeter(f, UPGRADE_METER, 100);
    run(m, 1, DOWN_SPECIAL);
    expect([f.move, f.actionFrame]).toEqual(['downB', MAGNET.end]);
    run(m, MAGNET.faf - MAGNET.end, SPECIAL);
    expect(f.move).toBeNull();
    expect(meter(f, UPGRADE_METER)).toBe(100);
  });
});

describe('Johnny Upgrade: Upgraded Laser (Limit Blade Beam)', () => {
  it("fires 2 frames sooner and ends 7 frames later than Laser Gun, as Limit Blade Beam does Blade Beam's", () => {
    const sooner = CLOUD.bladeBeam.startup - CLOUD.limitBladeBeam.startup;
    const later = CLOUD.limitBladeBeam.interruptible - CLOUD.bladeBeam.interruptible;
    expect(UPGRADED_LASER.ground).toEqual({ shot: 8 - sooner, faf: moves.neutralB!.faf + later });
    expect(UPGRADED_LASER.air).toEqual({
      shot: 7 - sooner,
      faf: moves.neutralBAir!.faf + later,
      landingLag: 6,
    });
    expect(moves.neutralBUpgraded).toMatchObject({
      faf: 49,
      air: 'neutralBUpgradedAir',
      intangible: [1, 7],
      spawn: [{ frame: 6, entity: 'megaLaser', x: MUZZLE.x, y: MUZZLE.y, vx: LASER.speed }],
    });
    expect(moves.neutralBUpgradedAir).toMatchObject({
      faf: 46,
      landingLag: 6,
      intangible: [1, 6],
      spawn: [{ frame: 5, entity: 'megaLaser', x: MUZZLE.x, y: MUZZLE.airY, vx: LASER.speed }],
    });
    // Limit Blade Beam: intangible from 6 frames before the beam to 1 after.
    const [from, to] = CLOUD.limitBladeBeam.intangible;
    expect([CLOUD.limitBladeBeam.startup - from, to - CLOUD.limitBladeBeam.startup]).toEqual([6, 1]);
  });

  it("carries Limit Blade Beam's hits and sizes", () => {
    const { beam, loop, final } = CLOUD.limitBladeBeam;
    expect(MEGA_LASER.bolt).toEqual({ radius: beam.radius, damage: 6, angle: 365, kbg: 60, bkb: 38 });
    expect(MEGA_LASER.burstRadius).toBe(CLOUD.limitBladeBeam.burstRadius);
    const burst = upgradeEntities.laserBurst!;
    const loops = burst.hits!.slice(0, -1);
    expect(loops.map((w) => w.frames)).toEqual([1, 7, 13, 19, 25].map((f) => [f, f]));
    expect(loops.every((w) => w.frames[0] <= loop.frames[1] && w.rehit)).toBe(true);
    for (const w of loops)
      expect(w.boxes[0]).toMatchObject({
        damage: loop.damage,
        angle: loop.angle,
        kbg: loop.kbg,
        bkb: loop.bkb,
        wbkb: loop.wbkb,
        hitlag: loop.hitlag,
      });
    expect(burst.hits!.at(-1)).toMatchObject({
      frames: final.frames,
      rehit: true,
      boxes: [{ damage: final.damage, angle: final.angle, kbg: final.kbg, bkb: final.bkb }],
    });
    expect(burst).toMatchObject({ reflectable: false, absorbable: false, transcendent: true, pierce: true });
    expect(beam.damage + loops.length * loop.damage + final.damage).toBe(CLOUD.limitBladeBeam.onTarget);
    expect(loops.length * loop.damage + final.damage).toBe(CLOUD.limitBladeBeam.inBurst);
  });

  it('with a full meter neutral special plays it and empties the meter on its first frame, hit or miss', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    setMeter(f, UPGRADE_METER, 100);
    run(m, 1);
    run(m, 1, SPECIAL);
    expect([f.move, f.actionFrame, meter(f, UPGRADE_METER), hasStatus(f, UPGRADED)]).toEqual([
      'neutralBUpgraded',
      1,
      0,
      false,
    ]);
    const shots: number[] = [];
    let frame = 1;
    while (f.move === 'neutralBUpgraded') {
      frame++;
      run(m, 1);
      if (m.events.some((e) => e.type === 'entitySpawn' && e.kind === 'johnny/megaLaser')) shots.push(frame);
    }
    expect([shots, frame]).toEqual([[6], 49]);
  });

  it('in the air it plays the aerial version', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = placeInAir(m, 0, 150);
    setMeter(f, UPGRADE_METER, 100);
    run(m, 1, SPECIAL);
    expect([f.move, meter(f, UPGRADE_METER)]).toEqual(['neutralBUpgradedAir', 0]);
  });

  it('one short of full, neutral special is still Laser Gun', () => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    setMeter(f, UPGRADE_METER, 99.9);
    run(m, 1, SPECIAL);
    expect(f.move).toBe('neutralB');
  });

  it.each([
    ['sideB', { x: 100, buttons: ['special'] }],
    ['upB', { y: 100, buttons: ['special'] }],
  ] as [string, Hold][])('%s has no upgraded version yet and leaves the meter full', (move, hold) => {
    const m = testMatch({ fighter: 'johnny' });
    const f = m.fighters[0]!;
    setMeter(f, UPGRADE_METER, 100);
    run(m, 1, hold);
    expect(f.move).toBe(move);
    run(m, 5);
    expect([meter(f, UPGRADE_METER), hasStatus(f, UPGRADED)]).toEqual([100, true]);
  });

  it('bursts where it hits and holds the target through all seven hits: 19% on it, 13% on a fighter in the burst', () => {
    // Three fighters: no 1v1 multiplier, so the % added is the hit's damage times freshness (1.05).
    const { m, a, v } = duel(-40, 0, 2);
    const behind = m.fighters[2]!;
    Object.assign(behind, { pos: { x: 6, y: 1 }, prevPos: { x: 6, y: 1 } });
    runPorts(m, 1, []);
    setMeter(a, UPGRADE_METER, 100);
    runPorts(m, 1, [SPECIAL]);
    const hits: number[] = [];
    for (let i = 0; i < 80; i++) {
      runPorts(m, 1, []);
      for (const e of m.events) if (e.type === 'hit' && e.victim === v.port) hits.push(e.damage);
    }
    expect(hits).toHaveLength(7);
    expect(v.damage).toBeCloseTo(CLOUD.limitBladeBeam.onTarget * 1.05, 6);
    expect(behind.damage).toBeCloseTo(CLOUD.limitBladeBeam.inBurst * 1.05, 6);
    expect(m.entities.some((e) => e.kind.startsWith('johnny/'))).toBe(false);
  });
});

describe('Johnny Upgrade: Upgraded Laser kill percent (Mario at the Battlefield ledge, fresh, no rage, no DI)', () => {
  const { final } = CLOUD.limitBladeBeam;
  const ours = MEGA_LASER.final;
  const finisher = koPercent({
    hit: { damage: ours.damage, angle: ours.angle, kbg: ours.kbg, bkb: ours.bkb },
  })!;

  it("the burst's finisher KOs within 5 points of Limit Blade Beam's", () => {
    const cloud = koPercent({
      hit: { damage: final.damage, angle: final.angle, kbg: final.kbg, bkb: final.bkb },
    })!;
    expect(Math.abs(finisher - cloud)).toBeLessThanOrEqual(5);
  });

  /**
   * Mario standing near the right ledge at `percent`, shot from 40 units: whether the finisher KOs him before its
   * hitstun ends (the koPercent definition), and where he was when it landed.
   */
  function shot(percent: number): { ko: boolean; at: { x: number; y: number } } {
    const { m, a, v } = duel(30, 72);
    v.damage = percent;
    setMeter(a, UPGRADE_METER, 100);
    runPorts(m, 1, []);
    runPorts(m, 1, [SPECIAL]);
    let hits = 0;
    let at = { x: NaN, y: NaN };
    for (let i = 0; i < 400; i++) {
      runPorts(m, 1, []);
      if (v.action === 'ko') return { ko: hits === 7, at };
      hits += m.events.filter((e) => e.type === 'hit' && e.victim === v.port).length;
      if (hits === 7 && Number.isNaN(at.x)) at = { ...v.pos };
      if (hits === 7 && v.hitlag === 0 && v.hitstun <= 0) return { ko: false, at };
    }
    return { ko: false, at };
  }

  it('the whole shot KOs where the finisher lands within 5 points of the finisher alone, less the % before it', () => {
    let lo = 0;
    let hi = 200;
    expect(shot(lo).ko).toBe(false);
    expect(shot(hi).ko).toBe(true);
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      if (shot(mid).ko) hi = mid;
      else lo = mid;
    }
    // The burst pulls him in toward its centre, so the finisher lands a few units in from the ledge.
    const { at } = shot(hi);
    expect(at.x).toBeGreaterThan(60);
    const alone = koPercent({
      hit: { damage: final.damage, angle: final.angle, kbg: final.kbg, bkb: final.bkb },
      from: at,
    })!;
    // Before the finisher: the beam and five loops, 16% at x1.05 freshness and x1.2 for 1v1.
    const before = (CLOUD.limitBladeBeam.onTarget - final.damage) * 1.05 * 1.2;
    expect(Math.abs(hi - (alone - before))).toBeLessThanOrEqual(5);
  });
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
