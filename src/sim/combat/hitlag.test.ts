import { describe, expect, it } from 'vitest';
import { getFighter } from '../../fighters/registry';
import { registerEntity, spawnEntity } from '../entities/entities';
import type { FighterState } from '../fighter';
import { createMatch, type MatchState } from '../match';
import { marioReference as mario } from '../testing/reference';
import { attack, run, testMatch } from '../testing/sim';
import { hitlagFrames } from './formulas';

/**
 * Ultimate's hitlag (SmashWiki, Hitlag; docs/physics-reference.md section 5): a hit that connects on frame N freezes
 * the attacker and the victim for the next `hitlag` frames, N+1 to N+hitlag, and both act again on N+hitlag+1. They
 * are frozen for the whole of each of those frames: they don't move, aren't pushed apart, and land no hitbox.
 */

/** The probe's 12% with a fresh move's x1.05: floor(12.6 x 0.65 + 6) = 14 frames. */
const LAG = hitlagFrames(12 * 1.05);

/** Stand `f` on Battlefield's main stage at `x`, facing `facing`. */
function stand(f: FighterState, x: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, vel: { x: 0, y: 0 }, facing });
}

/** Port 0 throws the probe at port 1 standing 4 units in front, so close that their bodies overlap. */
function pointBlank(players: number): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ players });
  const [a, v] = m.fighters as [FighterState, FighterState];
  expect([a.action, v.action, a.ground, v.ground]).toEqual([
    'idle',
    'idle',
    expect.anything(),
    expect.anything(),
  ]);
  stand(a, -4, 1);
  stand(v, 0, -1);
  attack(m, 0, 'probe');
  return { m, a, v };
}

const hits = (m: MatchState) => m.events.filter((e) => e.type === 'hit');

const box = (damage: number, radius: number) => ({
  id: 0,
  x: 0,
  y: 0,
  radius,
  damage,
  angle: 361,
  kbg: 50,
  bkb: 20,
});
const still = { floor: 'pass', wall: 'pass' } as const;
/** A hittable turret whose box is always out and goes through everyone it touches. */
const TURRET = 'test-hitlag/turret';
registerEntity(TURRET, {
  ...still,
  radius: 3,
  hp: 100,
  pierce: true,
  hits: [{ frames: [1, 600], boxes: [box(3, 4)] }],
});
/** A 6% shot, used up by the first thing it hits. */
const PELLET = 'test-hitlag/pellet';
registerEntity(PELLET, {
  ...still,
  radius: 1.5,
  lifetime: 10,
  hits: [{ frames: [1, 10], boxes: [box(6, 1.5)] }],
});
/** A hittable entity with no hitboxes of its own. */
const CRATE = 'test-hitlag/crate';
registerEntity(CRATE, { ...still, radius: 3, hp: 100 });

/** Widths overlap: pushApart would shove two grounded fighters this close apart on any frame they act. */
function overlapping(a: FighterState, b: FighterState): boolean {
  const reach = (getFighter(a.fighter).stats.width + getFighter(b.fighter).stats.width) / 2;
  return Math.abs(a.pos.x - b.pos.x) < reach;
}

describe('hitlag', () => {
  it('freezes attacker and victim on every hitlag frame: no movement, no push apart, no hit, then both resume', () => {
    expect(LAG).toBe(14);
    const { m, a, v } = pointBlank(2);
    run(m, 1);
    expect(hits(m)).toMatchObject([{ attacker: 0, victim: 1, hitlag: LAG }]);
    expect([a.hitlag, v.hitlag]).toEqual([LAG, LAG]);
    const attackFrame = a.actionFrame;

    for (let frame = 1; frame <= LAG; frame++) {
      const before = { a: { ...a.pos }, v: { ...v.pos } };
      expect(overlapping(a, v)).toBe(true);
      run(m, 1);
      expect({ frame, a: a.pos, v: v.pos }).toEqual({ frame, ...before });
      expect({ frame, hits: hits(m) }).toEqual({ frame, hits: [] });
      expect({ frame, actionFrame: a.actionFrame }).toEqual({ frame, actionFrame: attackFrame });
      expect({ frame, hitlag: [a.hitlag, v.hitlag] }).toEqual({ frame, hitlag: [LAG - frame, LAG - frame] });
      expect(v.launch).not.toBeNull();
    }

    // Frame N+hitlag+1: both act again, the attacker's move advances and the victim launches.
    const frozen = { ...v.pos };
    run(m, 1);
    expect(a.actionFrame).toBe(attackFrame + 1);
    expect(v.launch).toBeNull();
    expect(v.pos).not.toEqual(frozen);
  });

  it("keeps the attacker's still-active hitbox out on every hitlag frame, and lands it on the first frame after", () => {
    const { m, a, v } = pointBlank(3);
    const t = m.fighters[2]!;
    // A bystander inside the probe's box, intangible for the hit frame and the two after it.
    stand(t, 4, -1);
    t.intangible = 3;
    run(m, 1);
    expect(hits(m)).toMatchObject([{ attacker: 0, victim: 1, hitlag: LAG }]);

    const landed: number[] = [];
    for (let frame = 1; frame <= LAG + 1; frame++) {
      run(m, 1);
      if (hits(m).some((e) => e.attacker === 0 && e.victim === 2)) landed.push(frame);
    }
    expect(t.intangible).toBe(0);
    expect(landed).toEqual([LAG + 1]);
    expect(a.hitVictims).toEqual([1, 2]);
    expect(v.launch).toBeNull();
  });

  it('keeps a frozen grabber from catching anyone until it acts again', () => {
    const m = testMatch({ fighter: 'fireboy', players: 2 });
    const [a, v] = m.fighters as [FighterState, FighterState];
    stand(a, -6, 1);
    stand(v, 3, -1);
    // Frozen on frame 6 of Fireboy's grab, the first of its two grab-box frames, with the victim inside the box.
    attack(m, 0, 'grab');
    Object.assign(a, { actionFrame: 6, hitlag: 3 });

    const caught: number[] = [];
    for (let frame = 1; frame <= 4; frame++) {
      run(m, 1);
      if (m.events.some((e) => e.type === 'grab')) caught.push(frame);
    }
    expect(caught).toEqual([4]);
    expect([a.action, v.action]).toEqual(['grabHold', 'grabbed']);
  });

  it('keeps stage hazards off a fighter on every hitlag frame', () => {
    const m = createMatch({ seed: 1, stage: 'hazard-testbed', stocks: 3, ports: [{ fighter: mario.id }] });
    const f = m.fighters[0]!;
    // In the testbed's lava, which hits a fighter there on the first frame it can.
    Object.assign(f, { pos: { x: -48, y: 0.001 }, prevPos: { x: -48, y: 0.001 }, hitlag: LAG });

    const landed: number[] = [];
    for (let frame = 1; frame <= LAG + 1; frame++) {
      run(m, 1);
      if (m.events.some((e) => e.type === 'stageHit')) landed.push(frame);
    }
    expect(landed).toEqual([LAG + 1]);
  });

  it("keeps a frozen entity's hitboxes off fighters and entities on every hitlag frame, and lands them on the first frame after", () => {
    const m = testMatch({ players: 2 });
    const [a, b] = m.fighters as [FighterState, FighterState];
    stand(a, 0, 1);
    stand(b, 80, -1);
    // Port 1's turret floats beside port 0, a crate of port 0's on its other side, both inside its box. Port 0's pellet
    // hits it on its first frame, before its box can land on anyone.
    const turret = spawnEntity(m, { kind: TURRET, owner: 1, pos: { x: 6, y: 8 } });
    spawnEntity(m, { kind: PELLET, owner: 0, pos: { x: 6, y: 8 } });
    const crate = spawnEntity(m, { kind: CRATE, owner: 0, pos: { x: 10, y: 8 } });
    run(m, 1);
    const lag = hitlagFrames(6);
    expect(lag).toBe(9);
    expect(m.events.filter((e) => e.type === 'entityHit')).toMatchObject([{ id: turret.id, attacker: 0 }]);
    expect([turret.hitlag, turret.age]).toEqual([lag, 1]);

    const landed: { fighter: number[]; entity: number[] } = { fighter: [], entity: [] };
    for (let frame = 1; frame <= lag + 1; frame++) {
      run(m, 1);
      if (hits(m).some((e) => e.entity === turret.id && e.victim === 0)) landed.fighter.push(frame);
      if (m.events.some((e) => e.type === 'entityHit' && e.id === crate.id)) landed.entity.push(frame);
      // Frozen: it doesn't age (its hit windows wait) until the frame after its last hitlag frame.
      const frozen = frame <= lag;
      expect({ frame, hitlag: turret.hitlag, age: turret.age }).toEqual({
        frame,
        hitlag: frozen ? lag - frame : 0,
        age: frozen ? 1 : 2,
      });
    }
    expect(landed).toEqual({ fighter: [lag + 1], entity: [lag + 1] });
  });
});
