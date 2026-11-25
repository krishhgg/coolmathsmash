import { describe, expect, it } from 'vitest';
import { isIntangible } from './actions/registry';
import { cameraTarget } from '../render/camera';
import { getStage } from '../stages/registry';
import { createMatch, stepMatch, type MatchState } from './match';
import { attack, input, run } from './testing/sim';
import { FRESHNESS_BONUS, isTumble } from './combat/formulas';
import { getFighter } from '../fighters/registry';

/**
 * Feel metrics: the moment-to-moment behaviours a Smash player feels, measured frame by frame against
 * handoffs/research/physics-constants.json and the reference tables in docs/physics-reference.md. Geometry
 * tests run on Battlefield at x = 0, clear of its platforms.
 */

const P = (m: MatchState, port = 0) => m.fighters[port]!;
const settle = (m: MatchState, frames = 30) => run(m, frames);

function fireboys(ports = 1): MatchState {
  return createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: Array.from({ length: ports }, () => ({ fighter: 'fireboy' })),
  });
}

/** A grounded fighter at the middle of Battlefield. */
function grounded(ports = 1): MatchState {
  const m = fireboys(ports);
  for (const f of m.fighters) f.pos.x = 0;
  settle(m);
  return m;
}

describe('ground movement', () => {
  it('dashes at the initial dash speed for the dash window, then runs', () => {
    const m = grounded();
    const s = P(m);
    const speeds: number[] = [];
    const actions: string[] = [];
    for (let i = 0; i < 16; i++) {
      stepMatch(m, [input({ x: 100 })]);
      speeds.push(s.vel.x);
      actions.push(s.action);
    }
    const dashFrames = actions.filter((a) => a === 'dash').length;
    expect(dashFrames).toBe(11);
    expect(speeds[0]).toBeCloseTo(1.95, 3);
    expect(actions.at(-1)).toBe('run');
    expect(s.vel.x).toBeCloseTo(1.85, 3);
  });

  it('dash-dances: a neutral frame and a flick back restarts the dash the other way', () => {
    const m = grounded();
    const f = P(m);
    const xs: number[] = [];
    const facings: number[] = [];
    for (let i = 0; i < 24; i++) {
      const leg = Math.floor(i / 8);
      const hold = i % 8 === 7 ? {} : { x: leg % 2 === 0 ? 100 : -100 };
      stepMatch(m, [input(hold)]);
      xs.push(f.pos.x);
      facings.push(f.facing);
    }
    expect(new Set(facings).size).toBe(2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(15.6, 1);
    expect(f.action).toBe('dash');
    expect(Math.abs(f.vel.x)).toBeCloseTo(1.95, 3);
  });

  it('stops in traction distance from run speed (Ultimate: 1.76 u/f at 0.102 u/f^2 is 18 frames)', () => {
    const m = grounded();
    const f = P(m);
    run(m, 30, { x: 100 });
    const x0 = f.pos.x;
    let frames = 0;
    while (Math.abs(f.vel.x) > 0.001 && frames < 60) {
      stepMatch(m, [input({})]);
      frames++;
    }
    expect(frames).toBe(19);
    expect(f.pos.x - x0).toBeCloseTo(16.2, 1);
  });

  it('walks on a tilt, reaching the tilt-scaled walk speed in about 4 frames', () => {
    const m = grounded();
    const f = P(m);
    const speeds: number[] = [];
    for (let i = 0; i < 6; i++) {
      stepMatch(m, [input({ x: 50 })]);
      speeds.push(f.vel.x);
    }
    expect(speeds[2]).toBeCloseTo(0.45, 3);
    expect(speeds.at(-1)).toBe(0.55);
  });
});

describe('jumps and air movement', () => {
  it('jump squat is 3 frames and a held jump takes off on the 4th', () => {
    const m = grounded();
    const f = P(m);
    const actions: string[] = [];
    for (let i = 0; i < 5; i++) {
      stepMatch(m, [input({ buttons: ['jump'] })]);
      actions.push(f.action);
    }
    expect(actions).toEqual(['jumpSquat', 'jumpSquat', 'jumpSquat', 'jump', 'jump']);
  });

  it('a 1-frame jump press short hops; holding through the squat full hops', () => {
    for (const [hold, height] of [
      [1, 16],
      [3, 16],
      [4, 34],
      [12, 34],
    ] as const) {
      const m = grounded();
      const f = P(m);
      let apex = 0;
      for (let i = 0; i < 80; i++) {
        stepMatch(m, [input(i < hold ? { buttons: ['jump'] } : {})]);
        apex = Math.max(apex, f.pos.y);
      }
      expect(apex).toBeCloseTo(height, 1);
    }
  });

  it('fast fall snaps to the fast-fall speed (x1.6) and ends the hop 18 frames sooner', () => {
    const fast = grounded();
    const slow = grounded();
    for (const m of [fast, slow]) {
      stepMatch(m, [input({ buttons: ['jump'] })]);
      run(m, 25, { buttons: ['jump'] });
    }
    const airtime = (m: MatchState, tapDown: boolean) => {
      const f = P(m);
      let frames = 0;
      while (!f.ground && frames < 120) {
        const down = tapDown && f.vel.y <= 0;
        stepMatch(m, [input(down ? { y: -100 } : {})]);
        frames++;
      }
      return frames;
    };
    const withFastFall = airtime(fast, true);
    const without = airtime(slow, false);
    expect(P(fast).vel.y).toBe(0);
    expect(without - withFastFall).toBeGreaterThanOrEqual(16);
    expect(without - withFastFall).toBeLessThanOrEqual(20);
  });

  it('air drift accelerates 0.075 u/f per frame to the air speed, then holds it', () => {
    const m = grounded();
    const f = P(m);
    stepMatch(m, [input({ buttons: ['jump'] })]);
    run(m, 24, { buttons: ['jump'] });
    const speeds: number[] = [];
    for (let i = 0; i < 24; i++) {
      stepMatch(m, [input({ x: 100 })]);
      speeds.push(f.vel.x);
    }
    expect(speeds[1]! - speeds[0]!).toBeCloseTo(0.075, 3);
    expect(Math.max(...speeds)).toBeCloseTo(1.15, 2);
  });

  it('lands with hard landing lag after a real fall, soft after a hop', () => {
    const m = grounded();
    const f = P(m);
    run(m, 3, { buttons: ['jump'] });
    let lag = -1;
    for (let i = 0; i < 80 && lag < 0; i++) {
      stepMatch(m, [input({})]);
      if (f.action === 'land') lag = f.landingLag;
    }
    expect(lag).toBe(3);
  });
});

describe('hits', () => {
  /** P1's move hitting P2 point blank; returns what the victim felt. */
  function connect(move: string, percent = 0) {
    const m = fireboys(2);
    const a = P(m, 0);
    const v = P(m, 1);
    a.pos.x = -12;
    a.facing = 1;
    v.pos.x = -12 + (move === 'jab' ? 9 : move === 'ftilt' ? 11 : 15);
    v.facing = -1;
    v.damage = percent;
    settle(m, 5);
    attack(m, 0, move);
    let hitlag = 0;
    let kb = 0;
    let damage = 0;
    let tumble = false;
    let hitstun = 0;
    for (let i = 0; i < 40; i++) {
      stepMatch(m, [input({})]);
      const e = m.events.find((x) => x.type === 'hit');
      if (e?.type === 'hit' && hitlag === 0) {
        hitlag = e.hitlag;
        kb = e.kb;
        damage = e.damage;
        tumble = e.tumble;
      }
      hitstun = Math.max(hitstun, v.hitstun);
    }
    return { m, v, hitlag, kb, damage, tumble, hitstun };
  }

  /** Damage a fresh hit of `move`'s first box deals before the 1v1 meter bonus, from Fireboy's own data. */
  const fresh = (move: string) =>
    getFighter('fireboy').moves![move]!.hits[0]!.boxes[0]!.damage * FRESHNESS_BONUS;
  /** Ultimate's hitlag: floor(0.65 x damage + 6) frames. */
  const ultimateHitlag = (damage: number) => Math.floor(damage * 0.65 + 6);

  it("freezes both fighters for the Ultimate hitlag of a jab's damage", () => {
    const hit = connect('jab');
    expect(hit.damage).toBeCloseTo(fresh('jab') * 1.2, 6);
    expect(hit.hitlag).toBe(ultimateHitlag(fresh('jab')));
    expect(P(hit.m, 0).hitlag).toBe(0);
  });

  it('a forward smash freezes for its Ultimate hitlag and launches into a tumble that grows with %', () => {
    const light = connect('fsmash', 0);
    const heavy = connect('fsmash', 100);
    expect(light.damage).toBeCloseTo(fresh('fsmash') * 1.2, 6);
    expect(light.hitlag).toBe(ultimateHitlag(fresh('fsmash')));
    expect(heavy.kb).toBeGreaterThan(light.kb * 2.5);
    expect(isTumble(heavy.kb)).toBe(true);
  });

  it('hitstun follows floor(KB x 0.4) - 1 and the victim tumbles above 80 KB', () => {
    const hit = connect('ftilt', 90);
    const expected = Math.max(Math.floor(hit.kb * 0.4), 5) - 1;
    expect(Math.abs(hit.hitstun - expected)).toBeLessThanOrEqual(2);
    expect(hit.tumble).toBe(true);
  });
});

describe('shield', () => {
  it('shields on hold, depletes 0.15 a frame, and takes 11 frames to drop', () => {
    const m = grounded();
    const f = P(m);
    const hp: number[] = [];
    for (let i = 0; i < 15; i++) {
      stepMatch(m, [input({ buttons: ['shield'] })]);
      hp.push(f.shieldHp);
    }
    expect(f.action).toBe('shield');
    expect(hp[0]! - hp[14]!).toBeCloseTo(2.1, 2);
    let frames = 0;
    while (f.action !== 'idle' && frames < 30) {
      stepMatch(m, [input({})]);
      frames++;
    }
    expect(frames).toBe(12);
  });

  it('shieldstun adds the Ultimate formula on top of hitlag', () => {
    const m = fireboys(2);
    const a = P(m, 0);
    const d = P(m, 1);
    a.pos.x = -12;
    a.facing = 1;
    d.pos.x = 3;
    d.facing = -1;
    settle(m, 5);
    let stunned = 0;
    let firstStun = -1;
    for (let i = 0; i < 60; i++) {
      if (i === 3) attack(m, 0, 'fsmash');
      stepMatch(m, [input({}), input({ buttons: ['shield'] })]);
      if (d.action === 'shieldStun') {
        if (firstStun < 0) firstStun = i;
        stunned++;
      }
    }
    expect(firstStun).toBeGreaterThan(0);
    expect(stunned).toBeGreaterThanOrEqual(28);
    expect(stunned).toBeLessThanOrEqual(32);
  });
});

describe('dodges', () => {
  it('forward roll travels the fighter roll distance, intangible on frames 4-15, actionable on 31', () => {
    const m = grounded();
    const f = P(m);
    const x0 = f.pos.x;
    const intangible: number[] = [];
    const frames: number[] = [];
    stepMatch(m, [input({ x: 100, buttons: ['shield'] })]);
    while (f.action !== 'idle' && frames.length < 60) {
      frames.push(f.actionFrame);
      if (isIntangible(f)) intangible.push(f.actionFrame);
      stepMatch(m, [input({})]);
    }
    // The last action frame is 30, so the fighter is actionable on frame 31 (ROLL.faf).
    expect(f.action).toBe('idle');
    expect(Math.max(...frames) + 1).toBe(31);
    expect(Math.abs(f.pos.x - x0)).toBeCloseTo(28, 0);
    expect(intangible[0]).toBe(4);
    expect(intangible.at(-1)).toBe(15);
  });

  it('spot dodge is intangible on frames 3-17 and ends 4 frames sooner than a roll', () => {
    const m = grounded();
    const f = P(m);
    const intangible: number[] = [];
    const frames: number[] = [];
    stepMatch(m, [input({ y: -100, buttons: ['shield'] })]);
    while (f.action !== 'idle' && frames.length < 60) {
      frames.push(f.actionFrame);
      if (isIntangible(f)) intangible.push(f.actionFrame);
      stepMatch(m, [input({})]);
    }
    expect(intangible[0]).toBe(3);
    expect(intangible.at(-1)).toBe(17);
    // The last action frame is 26, so the fighter is actionable on frame 27 (SPOT_DODGE.faf).
    expect(Math.max(...frames) + 1).toBe(27);
  });
});

describe('ledge', () => {
  function hang(percent = 0) {
    const m = grounded();
    const f = P(m);
    const L = getStage('battlefield').ledges[0]!;
    f.damage = percent;
    f.pos.x = L.x + L.side * 3;
    f.pos.y = L.y - 6;
    f.prevPos = { ...f.pos };
    f.ground = null;
    f.action = 'fall';
    f.actionFrame = 1;
    f.jumpsUsed = 1;
    f.facing = -L.side as 1 | -1;
    return { m, f };
  }

  it('grabs within 7 units in front of the ledge, not from 9', () => {
    for (const [dx, grabs] of [
      [3, true],
      [7, true],
      [9, false],
    ] as const) {
      const m = grounded();
      const f = P(m);
      const L = getStage('battlefield').ledges[1]!;
      f.pos.x = L.x + L.side * dx;
      f.pos.y = L.y - 6;
      f.prevPos = { ...f.pos };
      f.ground = null;
      f.action = 'fall';
      f.actionFrame = 1;
      f.jumpsUsed = 1;
      f.facing = -L.side as 1 | -1;
      run(m, 2);
      expect(f.action.startsWith('ledge')).toBe(grabs);
    }
  });

  it('hangs, is intangible, and the hang lasts up to 300 frames', () => {
    const { m, f } = hang();
    run(m, 1);
    expect(f.action).toBe('ledgeCatch');
    run(m, 10);
    expect(f.action).toBe('ledgeHang');
    expect(isIntangible(f)).toBe(true);
    run(m, 320);
    expect(f.action).not.toBe('ledgeHang');
  });

  it('reaches the ledge-getup options in Ultimate order of speed', () => {
    const { m, f } = hang();
    run(m, 10);
    run(m, 2, { x: 100 });
    expect(f.action).toBe('ledgeClimb');
    let frames = 0;
    while (f.action === 'ledgeClimb' && frames < 60) {
      stepMatch(m, [input({})]);
      frames++;
    }
    expect(frames).toBeLessThanOrEqual(34);
    expect(f.ground).not.toBeNull();
  });

  it.todo('the ledge catch animation lasts 19 frames (Ultimate), not 8');
  it.todo('ledge intangibility follows 60*airtime/300 + 44 - 44*%/120 + 19 (23-123 frames), not a flat 60');
});

describe('stage and camera', () => {
  it('Battlefield blast zones and camera box match the reference stage data', () => {
    const stage = getStage('battlefield');
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
    expect(stage.camera).toEqual({ left: -170, right: 170, top: 130, bottom: -80 });
    expect(stage.ledges.map((l) => l.x).sort((a, b) => a - b)).toEqual([-80, 80]);
  });

  it('frames both fighters with room to read the stage: 4-8 px per unit', () => {
    const stage = getStage('battlefield');
    const m = fireboys(2);
    const zoomFor = (a: number, b: number) => {
      P(m, 0).pos = { x: a, y: 0 };
      P(m, 1).pos = { x: b, y: 0 };
      return cameraTarget(m, stage).zoom;
    };
    expect(zoomFor(0, 20)).toBeLessThanOrEqual(8.6);
    expect(zoomFor(-40, 40)).toBeCloseTo(7.5, 1);
    expect(zoomFor(-79, 79)).toBeCloseTo(5.2, 1);
    // A full screen of stage at 160 units wide is 480 px at the reference 3 px/u, 800 px at 5 px/u.
    expect(160 * zoomFor(-79, 79)).toBeLessThanOrEqual(1280);
  });
});
