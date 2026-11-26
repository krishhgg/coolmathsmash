import { describe, expect, it } from 'vitest';
import { registerFighter } from '../fighters/registry';
import { defineFighter } from '../fighters/types';
import { chargeMultiplier } from './actions/charge';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import type { MatchState } from './match';
import { testCharger } from './testing/charge';
import { placeInAir, run, testMatch, until, type Hold } from './testing/sim';

type Hit = Extract<SimEvent, { type: 'hit' }>;

const charger = () => testMatch({ fighter: testCharger.id });

/** A second form of the test charger with the same move names, as Watergirl is to Fireboy. */
const otherForm = defineFighter({ ...testCharger, id: 'test-charger-form', name: 'Test: form' });
registerFighter(otherForm);

/** The test charger with a separate air version of its neutral special, as Runner's Tile Flip has. */
const withAirVariant = defineFighter({
  ...testCharger,
  id: 'test-charger-air',
  name: 'Test: air variant',
  moves: {
    ...testCharger.moves,
    neutralB: { ...testCharger.moves.neutralB, air: 'neutralBAir' },
    neutralBAir: testCharger.moves.neutralB,
  },
});
registerFighter(withAirVariant);

/** The % a move adds to a fighter standing 8 units ahead: `press` starts it, then `hold` for `frames` frames. */
function damageDealt(press: (facing: number) => Hold, hold: Hold, frames: number): number {
  const m = testMatch({ fighter: testCharger.id, players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  const x = a.pos.x + 8 * a.facing;
  Object.assign(v, { pos: { x, y: a.pos.y }, prevPos: { x, y: a.pos.y }, ground: a.ground, action: 'idle' });
  run(m, 1, press(a.facing));
  for (let i = 0; i < 300; i++) {
    const hit = m.events.find((e): e is Hit => e.type === 'hit');
    if (hit) return hit.damage;
    run(m, 1, i < frames ? hold : {});
  }
  throw new Error('the move never hit');
}

/** Start `move` (a special) on port 0 and hold `hold` until it has charged `frames` frames. */
function chargeTo(
  m: MatchState,
  press: Hold,
  frames: number,
  hold: Hold = { buttons: ['special'] },
): FighterState {
  const f = m.fighters[0]!;
  run(m, 1, press);
  until(m, (g) => g.charge === frames, hold, 300);
  return f;
}

const sideB = (facing: number): Hold => ({ x: 100 * facing, buttons: ['special'] });
const neutralB: Hold = { buttons: ['special'] };
const downB: Hold = { y: -100, buttons: ['special'] };

describe('charging', () => {
  it('a smash attack still charges for exactly 60 frames to exactly 1.4x', () => {
    const m = charger();
    const f = m.fighters[0]!;
    const duration = (hold: Hold) => {
      run(m, 1, { x: 100 * f.facing, buttons: ['attack'] });
      expect(f.move).toBe('fsmash');
      return until(m, (g) => g.action === 'idle', hold);
    };
    const uncharged = duration({});
    expect(duration({ buttons: ['attack'] }) - uncharged).toBe(60);
    expect(f.charge).toBe(60);
    run(m, 1, { x: 100 * f.facing, buttons: ['attack'] });
    until(m, (g) => g.actionFrame > 6, { buttons: ['attack'] });
    expect(chargeMultiplier(f)).toBe(1.4);
    const smash = (facing: number): Hold => ({ x: 100 * facing, buttons: ['attack'] });
    expect(damageDealt(smash, { buttons: ['attack'] }, 100) / damageDealt(smash, {}, 0)).toBeCloseTo(1.4, 12);
  });

  it("charges a special while Special is held: Running Ram's chargeDamage 2.2 takes 10% to 22%", () => {
    const m = charger();
    const f = m.fighters[0]!;
    run(m, 1, sideB(f.facing));
    expect(f.move).toBe('sideB');
    until(m, (g) => g.actionFrame > 8, neutralB, 200);
    expect(f.charge).toBe(60);
    expect(chargeMultiplier(f) * 10).toBeCloseTo(22, 12);
    expect(damageDealt(sideB, neutralB, 100) / damageDealt(sideB, {}, 0)).toBeCloseTo(2.2, 12);
  });

  it('a special ignores a held Attack and a smash ignores a held Special', () => {
    const m = charger();
    const f = m.fighters[0]!;
    run(m, 1, sideB(f.facing));
    run(m, 30, { buttons: ['attack'] });
    expect(f.move).toBe('sideB');
    expect(f.charge).toBe(0);
    until(m, (g) => g.action === 'idle');
    run(m, 1, { x: 100 * f.facing, buttons: ['attack'] });
    run(m, 30, neutralB);
    expect(f.move).toBe('fsmash');
    expect(f.charge).toBe(0);
  });

  it('chargeFrames sets the full charge, and a move without storeAtFull waits there until released', () => {
    const m = charger();
    const f = chargeTo(m, neutralB, 90);
    expect(chargeMultiplier(f)).toBe(3);
    run(m, 40, neutralB);
    expect(f).toMatchObject({ move: 'neutralB', charge: 90 });
    expect(f.actionFrame).toBeLessThan(8);
    expect(until(m, (g) => g.actionFrame === 12, {}, 10)).toBe(5);
    expect(f.storedCharge).toBeNull();
  });

  it('charges with a level the move script can read for its speed', () => {
    const speed = (frames: number) => {
      const m = charger();
      const f = chargeTo(m, neutralB, frames);
      until(m, (g) => g.actionFrame === 13);
      return Math.abs(f.vel.x);
    };
    expect(speed(1)).toBeLessThan(speed(45));
    expect(speed(45)).toBeLessThan(speed(90));
  });
});

describe('stored charge', () => {
  it('shield keeps the charge, and the next use starts from it and fires at that level', () => {
    const m = charger();
    const f = chargeTo(m, neutralB, 30);
    run(m, 1, { buttons: ['special', 'shield'] });
    expect(f.action).toBe('shield');
    expect(f.storedCharge).toEqual({ fighter: testCharger.id, move: 'neutralB', frames: 30 });
    until(m, (g) => g.action === 'idle');
    run(m, 1, neutralB);
    until(m, (g) => g.actionFrame > 8);
    expect(f.charge).toBe(30);
    expect(chargeMultiplier(f)).toBeCloseTo(1 + (2 * 30) / 90, 12);
    expect(f.storedCharge).toBeNull();
  });

  it('a stored charge keeps growing on the next use and is kept again', () => {
    const m = charger();
    chargeTo(m, neutralB, 30);
    run(m, 1, { buttons: ['special', 'shield'] });
    until(m, (g) => g.action === 'idle');
    const f = chargeTo(m, neutralB, 50);
    run(m, 1, { buttons: ['special', 'shield'] });
    expect(f.storedCharge).toEqual({ fighter: testCharger.id, move: 'neutralB', frames: 50 });
  });

  it('a jump keeps the charge on the ground, and an air dodge or an air jump in the air', () => {
    const ground = charger();
    const g = chargeTo(ground, neutralB, 20);
    run(ground, 1, { buttons: ['special', 'jump'] });
    expect(g.action).toBe('jumpSquat');
    expect(g.storedCharge).toEqual({ fighter: testCharger.id, move: 'neutralB', frames: 20 });

    for (const [button, action] of [
      ['shield', 'airDodge'],
      ['jump', 'doubleJump'],
    ] as const) {
      const m = charger();
      placeInAir(m, 0, 80);
      const f = chargeTo(m, neutralB, 20);
      expect(f.action).toBe('aerial');
      run(m, 1, { buttons: ['special', button] });
      expect(f.action).toBe(action);
      expect(f.storedCharge).toEqual({ fighter: testCharger.id, move: 'neutralB', frames: 20 });
    }
  });

  it('a tap move charges by itself, fires on the next press, and stores itself at full charge', () => {
    const m = charger();
    const f = m.fighters[0]!;
    run(m, 1, downB);
    until(m, (g) => g.charge === 40);
    run(m, 1, { buttons: ['attack'] });
    run(m, 1);
    expect(f).toMatchObject({ move: 'downB', actionFrame: 11, charge: 40 });
    expect(chargeMultiplier(f)).toBeCloseTo(1 + (4.2 * 40) / 120, 12);
    until(m, (g) => g.action === 'idle');

    run(m, 1, downB);
    until(m, (g) => g.charge === 120);
    run(m, 1);
    expect(f.action).toBe('idle');
    expect(f.storedCharge).toEqual({ fighter: testCharger.id, move: 'downB', frames: 120 });

    run(m, 1, downB);
    until(m, (g) => g.actionFrame > 10);
    expect(f.charge).toBe(120);
    expect(chargeMultiplier(f)).toBeCloseTo(5.2, 12);
    expect(f.storedCharge).toBeNull();
  });

  it('a smash attack does not store: shield while charging does nothing', () => {
    const m = charger();
    const f = m.fighters[0]!;
    run(m, 1, { x: 100 * f.facing, buttons: ['attack'] });
    run(m, 20, { buttons: ['attack'] });
    run(m, 1, { buttons: ['attack', 'shield'] });
    expect(f.move).toBe('fsmash');
    expect(f.storedCharge).toBeNull();
  });

  it('is lost on a KO', () => {
    const m = charger();
    const f = chargeTo(m, neutralB, 30);
    run(m, 1, { buttons: ['special', 'shield'] });
    expect(f.storedCharge).not.toBeNull();
    Object.assign(f, { pos: { x: 0, y: -10000 }, ground: null, action: 'fall' });
    run(m, 1);
    expect(f.action).toBe('ko');
    expect(f.storedCharge).toBeNull();
  });

  it('a move and its air variant share one charge (Ultimate: grounded and aerial Charge Shot)', () => {
    const m = testMatch({ fighter: withAirVariant.id });
    placeInAir(m, 0, 40);
    const f = chargeTo(m, neutralB, 25);
    expect(f.move).toBe('neutralBAir');
    run(m, 1, { buttons: ['special', 'shield'] });
    expect(f.action).toBe('airDodge');
    until(m, (g) => g.action === 'idle', {}, 300);
    run(m, 1, neutralB);
    until(m, (g) => g.actionFrame > 8);
    expect(f).toMatchObject({ move: 'neutralB', charge: 25, storedCharge: null });

    until(m, (g) => g.action === 'idle');
    chargeTo(m, neutralB, 35);
    run(m, 1, { buttons: ['special', 'shield'] });
    expect(f.action).toBe('shield');
    run(m, 1);
    placeInAir(m, 0, 40);
    run(m, 1, neutralB);
    until(m, (g) => g.actionFrame > 8);
    expect(f).toMatchObject({ move: 'neutralBAir', charge: 35, storedCharge: null });
  });

  it('belongs to the form that stored it: a transform keeps it, and the other form cannot use it', () => {
    const m = charger();
    const f = chargeTo(m, neutralB, 30);
    run(m, 1, { buttons: ['special', 'shield'] });
    until(m, (g) => g.action === 'idle');
    f.fighter = otherForm.id;
    run(m, 1, neutralB);
    until(m, (g) => g.actionFrame > 8, {});
    expect(f.charge).toBe(0);
    expect(f.storedCharge).toEqual({ fighter: testCharger.id, move: 'neutralB', frames: 30 });
    until(m, (g) => g.action === 'idle');
    f.fighter = testCharger.id;
    run(m, 1, neutralB);
    until(m, (g) => g.actionFrame > 8, {});
    expect(f.charge).toBe(30);
    expect(f.storedCharge).toBeNull();
  });

  it('survives a KO as another form (Ultimate: Squirtle loses Water Gun charge only when KOed as Squirtle)', () => {
    const m = charger();
    const f = chargeTo(m, neutralB, 30);
    run(m, 1, { buttons: ['special', 'shield'] });
    f.fighter = otherForm.id;
    Object.assign(f, { pos: { x: 0, y: -10000 }, ground: null, action: 'fall' });
    run(m, 1);
    expect(f.action).toBe('ko');
    expect(f.storedCharge).toEqual({ fighter: testCharger.id, move: 'neutralB', frames: 30 });
  });
});
