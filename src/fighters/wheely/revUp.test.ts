import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { knowledge } from '../../ai/knowledge';
import { groundMove } from '../../ai/programs';
import { neutralInput } from '../../input/types';
import { chargeMultiplier } from '../../sim/actions/charge';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { placeInAir, run, until, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { REV_UP } from './revUp';

const SPECIAL: Hold = { buttons: ['special'] };
const SHIELD: Hold = { buttons: ['shield'] };
/** Fresh moves deal 1.05x, and a 1v1 adds 1.2x to the % shown. */
const SHOWN = 1.05 * 1.2;

/** Wheely (P1) against the Mario reference (P2) on Battlefield, settled on the ground; Mario stands `gap` ahead. */
function duel(gap?: number): MatchState {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'wheely' }, { fighter: 'reference-mario' }],
  });
  run(m, 10);
  const [a, v] = m.fighters as [FighterState, FighterState];
  if (gap === undefined) {
    Object.assign(v, { pos: { x: 150, y: 0 }, prevPos: { x: 150, y: 0 }, ground: null, action: 'fall' });
    return m;
  }
  const at = { x: a.pos.x + gap * a.facing, y: a.pos.y };
  Object.assign(v, { pos: { ...at }, prevPos: { ...at }, ground: a.ground, action: 'idle', intangible: 0 });
  return m;
}

/** Tap Special and let the revs build by themselves until they reach `frames`, ready for the press that lets go. */
function revTo(m: MatchState, frames: number): FighterState {
  const f = m.fighters[0]!;
  run(m, 1, SPECIAL);
  expect(f.move).toMatch(/^neutralB/);
  run(m, 1);
  if (frames > 0) until(m, (g) => g.charge === frames, {}, 200);
  return f;
}

/** Charge to full: he stores it himself and stops. */
function revToFull(m: MatchState): FighterState {
  const f = m.fighters[0]!;
  run(m, 1, SPECIAL);
  until(m, (g) => g.action !== 'attack' && g.action !== 'aerial', {}, 200);
  return f;
}

/** The % Rev Up adds to Mario `gap` ahead after `frames` of revs (110: stored at full, then used), as shown. */
function damageAt(frames: number, gap = 12): number {
  const m = duel(gap);
  const v = m.fighters[1]!;
  if (frames === REV_UP.chargeFrames) revToFull(m);
  else revTo(m, frames);
  run(m, 1, SPECIAL);
  run(m, REV_UP.faf);
  return v.damage / SHOWN;
}

describe('Wheely: Rev Up (Giant Punch input model)', () => {
  it('one tap revs: 7 frames in, then the revs build by themselves for 110 frames and he keeps them', () => {
    const m = duel();
    const f = m.fighters[0]!;
    run(m, 1, SPECIAL);
    expect(f).toMatchObject({ move: 'neutralB', action: 'attack' });
    run(m, REV_UP.charge - 2);
    expect(f.charge).toBe(0);
    run(m, 1);
    expect(f.charge).toBe(1);
    const frames = until(m, (g) => g.charge === REV_UP.chargeFrames, {}, 200);
    expect(frames + 1).toBe(REV_UP.chargeFrames);
    expect(f.move).toBe('neutralB');
    run(m, 1);
    expect(f.action).toBe('idle');
    expect(f.storedCharge).toEqual({ fighter: 'wheely', move: 'neutralB', frames: REV_UP.chargeFrames });
  });

  it('Special or Attack lets go, and the blast hits from 12 frames after the release', () => {
    for (const button of ['special', 'attack'] as const) {
      const m = duel();
      const f = revTo(m, 30);
      run(m, 1, { buttons: [button] });
      expect(f).toMatchObject({ move: 'neutralB', actionFrame: REV_UP.charge, charge: 30 });
      until(m, (g) => g.actionFrame === REV_UP.hit[0]);
      expect(f.actionFrame - REV_UP.charge).toBe(12);
    }
  });

  it('deals 10% uncharged, 19% at half revs and 28% at full, as grounded Giant Punch does', () => {
    expect(damageAt(0)).toBeCloseTo(10, 6);
    expect(damageAt(55)).toBeCloseTo(19, 6);
    expect(damageAt(REV_UP.chargeFrames)).toBeCloseTo(28, 6);
  });

  it('kept at full, it blasts off on frame 7 and hits on frame 19, as a full Giant Punch does', () => {
    const m = duel();
    const f = revToFull(m);
    run(m, 1, SPECIAL);
    expect(f.move).toBe('neutralB');
    until(m, (g) => g.actionFrame === REV_UP.charge);
    expect(f).toMatchObject({ charge: REV_UP.chargeFrames, storedCharge: null });
    expect(chargeMultiplier(f)).toBeCloseTo(2.8, 12);
    until(m, (g) => g.actionFrame === REV_UP.hit[0]);
    expect(f.hitVictims).toEqual([]);
    expect(REV_UP.hit[0]).toBe(19);
    expect(moves.neutralB!.faf).toBe(48);
  });

  it('drives a run-speed lunge uncharged and about 75 units at full revs (Straight Lunge)', () => {
    const travel = (frames: number) => {
      const m = duel();
      const f = frames === REV_UP.chargeFrames ? revToFull(m) : revTo(m, frames);
      const x0 = f.pos.x;
      run(m, 1, SPECIAL);
      while (f.move === 'neutralB') run(m, 1);
      return (f.pos.x - x0) * f.facing;
    };
    const none = travel(0);
    const full = travel(REV_UP.chargeFrames);
    expect(none).toBeGreaterThan(25);
    expect(none).toBeLessThan(40);
    expect(full).toBeGreaterThan(70);
    expect(full).toBeLessThan(80);
    expect(travel(55)).toBeGreaterThan(none);
    expect(travel(55)).toBeLessThan(full);
  });

  it('shield keeps the revs, and the next Rev Up carries on from them', () => {
    const m = duel(12);
    const f = revTo(m, 55);
    run(m, 1, { buttons: ['shield'] });
    expect(f.action).toBe('shield');
    expect(f.storedCharge).toEqual({ fighter: 'wheely', move: 'neutralB', frames: 55 });
    until(m, (g) => g.action === 'idle');
    run(m, 1, SPECIAL);
    until(m, (g) => g.actionFrame === REV_UP.charge - 1 && g.charge > 0);
    expect(f.charge).toBe(56);
    expect(f.storedCharge).toEqual({ fighter: 'wheely', move: 'neutralB', frames: 55 });
    run(m, 1, SPECIAL);
    expect(f.storedCharge).toBeNull();
    expect(chargeMultiplier(f)).toBeCloseTo(1 + (1.8 * 56) / 110, 12);
  });

  it('a roll or spot dodge out of that shield keeps them too', () => {
    for (const dodge of [{ x: 100 }, { y: -100 }]) {
      const m = duel();
      const f = revTo(m, 40);
      run(m, 1, SHIELD);
      run(m, 1, { ...dodge, buttons: ['shield'] });
      expect(f.action).toMatch(/^roll|spotDodge/);
      until(m, (g) => g.action === 'idle');
      expect(f.storedCharge).toEqual({ fighter: 'wheely', move: 'neutralB', frames: 40 });
    }
  });

  it('an air dodge or a jump keeps them, and the air and ground Rev Up share them', () => {
    const air = duel();
    placeInAir(air, 70, 150);
    const f = revTo(air, 30);
    expect(f.move).toBe('neutralBAir');
    run(air, 1, SHIELD);
    expect(f.action).toBe('airDodge');
    expect(f.storedCharge).toEqual({ fighter: 'wheely', move: 'neutralBAir', frames: 30 });
    until(air, (g) => g.action === 'idle', {}, 300);
    run(air, 1, SPECIAL);
    until(air, (g) => g.actionFrame === REV_UP.charge - 1 && g.charge > 0);
    expect(f).toMatchObject({ move: 'neutralB', charge: 31 });

    const ground = duel();
    const g = revTo(ground, 20);
    run(ground, 1, { buttons: ['jump'] });
    expect(g.action).toBe('jumpSquat');
    expect(g.storedCharge).toEqual({ fighter: 'wheely', move: 'neutralB', frames: 20 });
  });

  it('in the air it is aerial Giant Punch, 6% uncharged to 25% at full', () => {
    const air = moves.neutralBAir!;
    const damage = air.hits[0]!.boxes[0]!.damage;
    expect(damage).toBe(6);
    expect(damage * air.chargeDamage!).toBeCloseTo(25, 12);
    expect(air.hits[0]!.boxes[0]).toMatchObject({ angle: 361, bkb: 40, kbg: 72 });
  });

  it('loses the revs on a KO', () => {
    const m = duel();
    const f = revToFull(m);
    expect(f.storedCharge).not.toBeNull();
    Object.assign(f, { pos: { x: 0, y: -10000 }, ground: null, action: 'fall' });
    run(m, 1);
    expect(f.action).toBe('ko');
    expect(f.storedCharge).toBeNull();
  });

  it('at full revs KOs Mario from Battlefield centre within 5 points of a full Giant Punch', () => {
    const full = koPercent({ hit: { fighter: 'wheely', move: 'neutralB' }, from: 'centre', charge: 110 });
    const giantPunch = koPercent({ hit: { damage: 28, angle: 361, kbg: 73, bkb: 35 }, from: 'centre' });
    expect(full).not.toBeNull();
    expect(giantPunch).not.toBeNull();
    expect(Math.abs(full! - giantPunch!)).toBeLessThanOrEqual(5);
    expect(koPercent({ hit: { fighter: 'wheely', move: 'neutralB' }, from: 'centre' })).toBeGreaterThan(
      full! + 100,
    );
  });
});

/** Wheely (P1) runs the CPU's grounded Rev Up program for `hold` frames of charge; the charge it fires with. */
function cpuRevUp(m: MatchState, hold: number): number {
  const f = m.fighters[0]!;
  const program = groundMove('neutralB', 1, hold);
  for (let t = 0; t < 300; t++) {
    const input = program.step(t, f);
    if (!input) break;
    stepMatch(m, [input, neutralInput()]);
    if (f.move === 'neutralB' && f.actionFrame === REV_UP.charge) return f.charge;
  }
  throw new Error(`Rev Up held for ${hold} never fired`);
}

describe('Wheely: Rev Up for CPUs', () => {
  it('the CPU probe presses Special again and sees the uncharged blast, and a blast after 40 frames of revs', () => {
    const probe = knowledge('wheely', 'battlefield').ground.neutralB!;
    expect(probe.first).toBe(REV_UP.hit[0] - 1);
    expect(probe.damage).toBe(10);
    expect(probe.active.at(-1)!.dx).toBeGreaterThan(20);
    expect(probe.held).toBeUndefined();
    const charged = probe.charged!;
    expect(charged.held).toBe(40);
    expect([charged.first, charged.busy]).toEqual([probe.first + 40, probe.busy + 40]);
    expect(charged.endDx).toBeGreaterThan(probe.endDx + 10);
  });

  it("the CPU's Rev Up fires with the revs it picked, and a kept full charge still blasts at once", () => {
    expect(cpuRevUp(duel(), 0)).toBe(0);
    expect(cpuRevUp(duel(), 40)).toBe(40);
    for (const hold of [0, 40]) {
      const m = duel();
      revToFull(m);
      expect(cpuRevUp(m, hold)).toBe(REV_UP.chargeFrames);
    }
  });

  it('CPUs blast with it in a Wheely ditto, and never sit revving', () => {
    let blasts = 0;
    let longest = 0;
    for (const seed of [1, 2, 3]) {
      const m = createMatch({
        seed,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'wheely' }, { fighter: 'wheely' }],
      });
      const cpus = [0, 1].map((port) => createCpu({ port, level: 7, seed: seed * 2 + port }));
      const revving = [0, 0];
      for (let i = 0; i < 3600; i++) {
        stepMatch(
          m,
          cpus.map((c) => c.input(m)),
        );
        m.fighters.forEach((f, port) => {
          const rev = f.move?.startsWith('neutralB') ?? false;
          if (rev && f.actionFrame === REV_UP.hit[0]) blasts++;
          const held = rev && f.charge > 0 && f.actionFrame < REV_UP.charge ? revving[port]! + 1 : 0;
          revving[port] = held;
          longest = Math.max(longest, held);
        });
      }
    }
    expect(blasts).toBeGreaterThan(0);
    // The charged probe's blast hits on frame 58, past the 45 frames ahead a CPU that doesn't shoot reads its opponent
    // (cpu.ts, HORIZON), so the CPU doesn't pick it yet.
    expect(longest).toBe(0);
  });
});
