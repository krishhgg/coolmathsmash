import { describe, expect, it } from 'vitest';
import { isIntangible } from './actions/registry';
import { cameraTarget } from '../render/camera';
import { getStage } from '../stages/registry';
import { INPUT_BUFFER_FRAMES } from './constants';
import { createMatch, stepMatch, type MatchState } from './match';
import { attack, input, placeInAir, run, type Hold } from './testing/sim';
import { FRESHNESS_BONUS, isTumble, shieldBreakStun } from './combat/formulas';
import { getFighter, registerFighter } from '../fighters/registry';
import { defineFighter } from '../fighters/types';
import { marioReference } from './testing/reference';
import ref from './reference/physics-constants.json';
import type { ButtonName } from '../input/types';

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

/**
 * Reference Mario with Captain Falcon's 15-frame initial dash (UFD stats, Dash Turnaround: fast 1-5, buffer window
 * 6-15, full dash 16), long enough for a flick back after frame 5 to leave the input buffer before the dash ends.
 */
const LONG_DASH = defineFighter({
  ...marioReference,
  id: 'test-long-initial-dash',
  selectable: false,
  stats: { ...marioReference.stats, dashFrames: 15 },
});
registerFighter(LONG_DASH);

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
    // Ultimate's dash_speed_keep_frame: dash speed on frames 1-6, then traction (0.1) brakes it to run speed on
    // frame 7, still inside the dash, so the run starts at run speed instead of dropping 0.1 in one frame on frame 12.
    expect(speeds.slice(0, 6).every((v) => Math.abs(v - 1.95) < 1e-9)).toBe(true);
    expect(speeds[6]).toBeCloseTo(1.85, 9);
    expect(actions[11]).toBe('run');
    expect(speeds[11]).toBeCloseTo(1.85, 9);
    expect(actions.at(-1)).toBe('run');
    expect(s.vel.x).toBeCloseTo(1.85, 3);
  });

  it("Mario's initial dash lasts 10 frames and he runs from frame 11 (UFD stats: Dash Frames 10)", () => {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'reference-mario' }],
    });
    const s = P(m);
    s.pos.x = 0;
    settle(m);
    const speeds: number[] = [];
    const actions: string[] = [];
    for (let i = 0; i < 14; i++) {
      stepMatch(m, [input({ x: 100 })]);
      speeds.push(s.vel.x);
      actions.push(s.action);
    }
    expect(actions.filter((a) => a === 'dash').length).toBe(ref.movement.mario_initial_dash_frames);
    expect(actions.indexOf('run') + 1).toBe(ref.movement.mario_initial_dash_frames + 1);
    // docs/physics-reference.md section 10: 1.936 for 6 frames, then 1.834 and 1.76 held.
    expect(speeds.slice(0, 6).every((v) => Math.abs(v - 1.936) < 1e-9)).toBe(true);
    expect(speeds[6]).toBeCloseTo(1.834, 9);
    expect(speeds[7]).toBeCloseTo(1.76, 9);
    expect(speeds[10]).toBeCloseTo(1.76, 9);
  });

  /**
   * The fighter dashes right with a full stick, lets go for one frame and holds full left from frame `flick` until
   * `release`, where frame 1 is the dash's first frame. Returns the first frame it faces left, its action and its
   * speed then, or null if it never turns.
   */
  function flickBack(flick: number, release = Infinity, fighter = 'reference-mario') {
    return turnAround(fighter, (frame) =>
      frame < flick - 1 ? { x: 100 } : frame === flick - 1 || frame >= release ? {} : { x: -100 },
    );
  }

  /** The fighter's first frame facing left under `hold` (frame 1 is the first input), or null if it never turns. */
  function turnAround(fighter: string, hold: (frame: number) => Hold) {
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports: [{ fighter }] });
    const f = P(m);
    f.pos.x = 0;
    settle(m);
    for (let frame = 1; frame <= 30; frame++) {
      stepMatch(m, [input(hold(frame))]);
      if (frame > 1 && f.facing === -1) return { frame, action: f.action, vx: f.vel.x };
    }
    return null;
  }

  it('a flick back turns the initial dash around at once on frames 1-5 and when it ends on 6-10 (UFD Dash Turnaround)', () => {
    // UFD stats, Dash Turnaround, Mario: Fast (Initial Dash) frames 1-5, Normal (Buffer Window) 6-10, Slow (Full
    // Dash) 11. SmashWiki Dashdance: in Ultimate "any character is free to dash back without the laggy skid animation
    // as long as the run phase of the dash has not begun".
    const flicks = [3, 4, 5, 6, 7, 8, 9, 10];
    const turns = flicks.map((flick) => flickBack(flick));
    expect(turns.map((t) => t?.frame)).toEqual([3, 4, 5, 11, 11, 11, 11, 11]);
    // Each turn is a new initial dash the other way at full dash speed, not a skid.
    expect(turns.every((t) => t?.action === 'dash' && t.vx === -1.936)).toBe(true);
  });

  it('a late flick back stays in the buffer after the stick lets go', () => {
    // Flicked back on frame 8 and released on 9: still in the buffer on frame 11, so Mario dashes back then.
    expect(flickBack(8, 9)).toEqual({ frame: 11, action: 'dash', vx: -1.936 });
  });

  it('a late flick back leaves the buffer INPUT_BUFFER_FRAMES after the stick lets go', () => {
    const end = LONG_DASH.stats.dashFrames + 1;
    const flick = end - INPUT_BUFFER_FRAMES;
    expect(flick).toBeGreaterThan(5);
    // Flicked back for one frame: in the buffer until INPUT_BUFFER_FRAMES after that frame.
    expect(flickBack(flick + 1, flick + 2, LONG_DASH.id)?.frame).toBe(end);
    expect(flickBack(flick, flick + 1, LONG_DASH.id)).toBe(null);
    // The hold buffer counts from the last frame the stick was held back, as it does for a button: held on frame
    // flick + 1 is still in the buffer at the end, and held to the end always is.
    expect(flickBack(flick, flick + 2, LONG_DASH.id)?.frame).toBe(end);
    expect(flickBack(flick, Infinity, LONG_DASH.id)?.frame).toBe(end);
  });

  it('a second late flick back refreshes the buffer, as a new button press does', () => {
    // Flicked back for one frame on frame 6, then for one frame 2 frames before the end. The first flick is out of the
    // buffer by the end; the second is still in it, so the fighter dashes back then.
    const end = LONG_DASH.stats.dashFrames + 1;
    const first = end - INPUT_BUFFER_FRAMES - 1;
    const second = end - 2;
    expect(first).toBeGreaterThan(5);
    expect(flickBack(first, first + 1, LONG_DASH.id)).toBe(null);
    const hold = (frame: number): Hold =>
      frame === first || frame === second ? { x: -100 } : frame < first - 1 ? { x: 100 } : {};
    expect(turnAround(LONG_DASH.id, hold)?.frame).toBe(end);
  });

  it('a tapped dash holds 1.95 u/f for 6 frames, then slides out at traction (Ultimate: dash_speed_keep_frame 6)', () => {
    const m = grounded();
    const f = P(m);
    const x0 = f.pos.x;
    const speeds: number[] = [];
    const actions: string[] = [];
    for (let i = 0; i < 30; i++) {
      stepMatch(m, [input(i === 0 ? { x: 100 } : {})]);
      speeds.push(f.vel.x);
      actions.push(f.action);
    }
    expect(speeds.slice(0, 6).every((v) => Math.abs(v - 1.95) < 1e-9)).toBe(true);
    expect(speeds[6]).toBeCloseTo(1.85, 9);
    expect(speeds[10]).toBeCloseTo(1.45, 9);
    expect(speeds[11]).toBeCloseTo(1.35, 9);
    expect(speeds[24]).toBeCloseTo(0.05, 9);
    expect(speeds[25]).toBe(0);
    expect(actions[10]).toBe('dash');
    expect(actions[11]).toBe('idle');
    expect(f.pos.x - x0).toBeCloseTo(29.75, 2);
  });

  it('dash-dances: a neutral frame and a flick back on frame 5 restarts the dash the other way', () => {
    const m = grounded();
    const f = P(m);
    const xs: number[] = [];
    const vs: number[] = [];
    const facings: number[] = [];
    for (let i = 0; i < 24; i++) {
      const leg = Math.floor(i / 4);
      const hold = i % 4 === 3 ? {} : { x: leg % 2 === 0 ? 100 : -100 };
      stepMatch(m, [input(hold)]);
      xs.push(f.pos.x);
      vs.push(f.vel.x);
      facings.push(f.facing);
    }
    expect(new Set(facings).size).toBe(2);
    // Each flick back comes on frame 5 of the dash, the last frame of Ultimate's fast turnaround (turn_dash_frame 5),
    // and restarts the dash at full dash speed the other way.
    expect(vs[4]).toBeCloseTo(-1.95, 9);
    expect(vs[8]).toBeCloseTo(1.95, 9);
    // Each 4-frame leg, neutral frame included, is inside dash_speed_keep_frame: 4 x 1.95 = 7.8 u.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(7.8, 1);
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

  /**
   * Break a grounded Fireboy's shield at `percent`, then send `mash(n)` on each frame after the one it lands dizzy on.
   * Counting that landing frame as frame 1, it returns the frames spent dizzy and waking up, the first frame it can
   * act on, the action it acts with there, and its shield HP on the first wake-up frame.
   */
  function shieldBreak(percent: number, mash: (n: number) => Hold = () => ({})) {
    const m = grounded();
    const f = P(m);
    f.damage = percent;
    f.shieldHp = 1;
    for (let i = 0; f.action !== 'dizzy' && i < 300; i++) stepMatch(m, [input({ buttons: ['shield'] })]);
    const actions = [f.action];
    let shieldHp = NaN;
    while ((f.action === 'dizzy' || f.action === 'dizzyWake') && actions.length < 600) {
      stepMatch(m, [input(mash(actions.length))]);
      if (f.action === 'dizzyWake' && f.actionFrame === 1) shieldHp = f.shieldHp;
      actions.push(f.action);
    }
    const actionable = actions.findIndex((a) => a !== 'dizzy' && a !== 'dizzyWake');
    return {
      dizzy: actions.filter((a) => a === 'dizzy').length,
      wake: actions.filter((a) => a === 'dizzyWake').length,
      actionable: actionable + 1,
      next: actions[actionable],
      shieldHp,
    };
  }

  it('a broken shield leaves the fighter dizzy for 400 - % frames (SmashWiki: Stun), then at 37.5 shield HP', () => {
    for (const percent of [0, 100, 350]) {
      const r = shieldBreak(percent);
      expect(r.dizzy, `${percent}%`).toBe(shieldBreakStun(percent));
      // The shield is reset as the dizzy ends, then regenerates on that frame like any frame out of shield.
      expect(r.shieldHp).toBeCloseTo(ref.shield.hp_after_break + ref.shield.regen_per_frame, 6);
    }
  });

  it('wakes up for 33 frames after the dizzy before it can act (SmashWiki: Stun, FuraFuraEnd)', () => {
    for (const [percent, dizzy] of [
      [0, 400],
      [100, 300],
    ] as const) {
      const r = shieldBreak(percent);
      expect([r.dizzy, r.wake], `${percent}%`).toEqual([dizzy, ref.shield.break_wake_frames]);
      expect([r.actionable, r.next], `${percent}%`).toEqual([dizzy + 33 + 1, 'idle']);
    }
  });

  it('holds a jab pressed during the wake-up until the first actionable frame', () => {
    // Pressed on wake-up frame 31, inside the buffer window of frame 434.
    const r = shieldBreak(0, (n) => (n === 400 + 30 ? { buttons: ['attack'] } : {}));
    expect([r.dizzy, r.wake, r.actionable, r.next]).toEqual([400, 33, 434, 'attack']);
  });

  it('cuts the dizzy by 3 frames per new stick direction and 5.4 per button press (SmashWiki: Stun)', () => {
    const everyFrame = (n: number): Hold => ({ x: n % 2 ? 100 : -100 });
    const everyOther = (n: number): Hold => ({ x: n % 2 ? 100 : 0 });
    const holdRight = (): Hold => ({ x: 100 });
    const attackEveryOther = (n: number): Hold => ({ buttons: n % 2 ? ['attack'] : [] });
    const cases: [number, string, (n: number) => Hold, number][] = [
      // A new direction every frame: each frame takes 1 + 3, so 400 / 4 and 300 / 4.
      [0, 'stick every frame', everyFrame, 100],
      [100, 'stick every frame', everyFrame, 75],
      // Right, neutral, right: each right is a new input, so two frames take 1 + 3 + 1.
      [0, 'stick every other frame', everyOther, 160],
      [100, 'stick every other frame', everyOther, 120],
      // A held direction counts once.
      [0, 'stick held', holdRight, 397],
      // The fastest one button can go: two frames take 1 + 5.4 + 1.
      [0, 'attack every other frame', attackEveryOther, 109],
      [100, 'attack every other frame', attackEveryOther, 81],
    ];
    for (const [percent, label, mash, dizzy] of cases) {
      const r = shieldBreak(percent, mash);
      expect([r.dizzy, r.wake, r.actionable], `${percent}% ${label}`).toEqual([dizzy, 33, dizzy + 34]);
    }
    expect(ref.shield.break_mash_per_input).toBe(3);
    expect(ref.shield.break_mash_per_button).toBe(5.4);
  });
});

describe('dodges', () => {
  /**
   * Flick out of shield on one frame and step until the dodge ends, holding `then.buttons` from action frame
   * `then.from` on. Ultimate's numbers are Mario's (docs/physics-reference.md section 7, SmashWiki: Spot dodge, Roll).
   */
  function dodge(fighter: string, flick: Hold, then?: { from: number; buttons: ButtonName[] }) {
    const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports: [{ fighter }] });
    const f = P(m);
    f.pos.x = 0;
    settle(m);
    const x0 = f.pos.x;
    stepMatch(m, [input({ ...flick, buttons: ['shield'] })]);
    const action = f.action;
    const frames: number[] = [];
    const intangible: number[] = [];
    while (f.action === action && frames.length < 60) {
      frames.push(f.actionFrame);
      if (isIntangible(f)) intangible.push(f.actionFrame);
      const held = then && f.actionFrame + 1 >= then.from ? { buttons: then.buttons } : {};
      stepMatch(m, [input(held)]);
    }
    return {
      action,
      // The frame after the dodge's last one is the first the fighter acts on.
      actionable: Math.max(...frames) + 1,
      intangible: [intangible[0], intangible.at(-1)],
      distance: Math.abs(f.pos.x - x0),
      next: f.action,
      move: f.move,
    };
  }

  it("forward roll is intangible on frames 4-15, actionable on 30, and covers the fighter's own roll distance", () => {
    const mario = dodge('reference-mario', { x: 100 });
    expect(mario.action).toBe('rollForward');
    expect(mario.intangible).toEqual(ref.dodges.forward_roll.intangible);
    expect(mario.actionable).toBe(ref.dodges.forward_roll.total + 1);
    expect(mario.distance).toBeCloseTo(32.17, 2);
    const fireboy = dodge('fireboy', { x: 100 });
    expect(fireboy.actionable).toBe(30);
    expect(fireboy.distance).toBeCloseTo(getFighter('fireboy').stats.rollDistance, 2);
  });

  it("back roll is intangible on frames 5-16, actionable on 35, and covers the fighter's back roll distance", () => {
    const r = dodge('reference-mario', { x: -100 });
    expect(r.action).toBe('rollBack');
    expect(r.intangible).toEqual(ref.dodges.back_roll.intangible);
    expect(r.actionable).toBe(ref.dodges.back_roll.total + 1);
    expect(r.distance).toBeCloseTo(ref.dodges.back_roll.mario_distance, 2);
    // Fireboy sets no backRollDistance, so his back roll matches his forward roll.
    const fireboy = dodge('fireboy', { x: -100 });
    expect(fireboy.action).toBe('rollBack');
    expect(getFighter('fireboy').stats.backRollDistance).toBeUndefined();
    expect(fireboy.distance).toBeCloseTo(getFighter('fireboy').stats.rollDistance, 2);
  });

  it('spot dodge is intangible on frames 3-17 and actionable on 26', () => {
    const r = dodge('reference-mario', { y: -100 });
    expect(r.action).toBe('spotDodge');
    expect(r.intangible).toEqual(ref.dodges.spot_dodge.intangible);
    expect(r.actionable).toBe(ref.dodges.spot_dodge.total + 1);
    expect(r.distance).toBe(0);
  });

  it('spot dodge cancels into a ground attack or special on frame 21; a grab waits for frame 26', () => {
    const { total, total_with_cancel: cancel } = ref.dodges.spot_dodge;
    const jab = dodge('fireboy', { y: -100 }, { from: 15, buttons: ['attack'] });
    expect([jab.actionable, jab.move]).toEqual([cancel + 1, 'jab']);
    const special = dodge('fireboy', { y: -100 }, { from: 15, buttons: ['special'] });
    expect([special.actionable, special.move]).toEqual([cancel + 1, 'neutralB']);
    const grab = dodge('fireboy', { y: -100 }, { from: 15, buttons: ['grab'] });
    expect([grab.actionable, grab.move]).toEqual([total + 1, 'grab']);
  });

  /**
   * Air dodge with the stick held at `stick` on the press frame and `then` after it, high off the Battlefield edge it
   * dodges away from (the right one unless the stick points left) so it ends airborne, starting at `vel`. `path[n - 1]` is how far the fighter has moved from where it pressed, at
   * action frame n. Pressing no `buttons` instead of Shield just falls.
   */
  function airDodge(stick: Hold, then: Hold = {}, vel = { x: 0, y: 0 }, buttons: ButtonName[] = ['shield']) {
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'reference-mario' }],
    });
    settle(m, 10);
    m.players[0]!.tapJump = false;
    const x0 = (stick.x ?? 0) < 0 ? -120 : 120;
    const f = placeInAir(m, x0, 120);
    f.vel = { ...vel };
    stepMatch(m, [input({ ...stick, buttons })]);
    const action = f.action;
    const frames: number[] = [];
    const intangible: number[] = [];
    const path: { x: number; y: number }[] = [];
    while (f.action === action && frames.length < 200) {
      frames.push(f.actionFrame);
      path.push({ x: f.pos.x - x0, y: f.pos.y - 120 });
      if (isIntangible(f)) intangible.push(f.actionFrame);
      stepMatch(m, [input(then)]);
    }
    return {
      action,
      actionable: Math.max(...frames) + 1,
      intangible: [intangible[0], intangible.at(-1)],
      next: f.action,
      airborne: f.ground === null,
      path,
      /** How far the fighter moved on action frame n, along x and y. */
      step: (n: number) => ({ x: path[n - 1]!.x - path[n - 2]!.x, y: path[n - 1]!.y - path[n - 2]!.y }),
    };
  }

  it("neutral air dodge is intangible on frames 3-29 and actionable on 53 (Mario's 52 total frames)", () => {
    const r = airDodge({});
    expect(r.action).toBe('airDodge');
    expect(r.intangible).toEqual(ref.dodges.air_dodge_neutral.intangible);
    expect(r.actionable).toBe(ref.dodges.air_dodge_neutral.total + 1);
    expect([r.next, r.airborne]).toEqual(['fall', true]);
  });

  it("directional air dodges are actionable one frame after Mario's totals and end in a fall, not helpless", () => {
    const totals = ref.dodges.air_dodge_directional.total_by_direction;
    for (const [stick, total] of [
      [{ y: -100 }, totals.down],
      [{ x: 100, y: -100 }, totals.diag_down],
      [{ x: 100 }, totals.side],
      [{ x: -100 }, totals.side],
      [{ x: 100, y: 100 }, totals.diag_up],
      [{ y: 100 }, totals.up],
    ] as const) {
      const r = airDodge(stick);
      expect(r.action).toBe('airDodge');
      expect(r.intangible, JSON.stringify(stick)).toEqual(ref.dodges.air_dodge_directional.intangible);
      expect(r.actionable, JSON.stringify(stick)).toBe(total + 1);
      expect([r.next, r.airborne], JSON.stringify(stick)).toEqual(['fall', true]);
    }
  });

  // Ultimate's directional slide (physics-reference section 7): it starts at escape_air_slide_speed 4.2, and the stop
  // energy brakes it by a constant amount a frame along the dodge, the brake that takes it to escape_air_slide_end_speed
  // 1.3 in escape_air_slide_distance 20 u. From script frame 14 gravity and air control take over what is left, and
  // from frame 24 the stick drifts the fighter.
  const { slide, distance_fresh: slideDistance } = ref.dodges.air_dodge_directional;
  const slideBrake = (slide.speed_fresh ** 2 - slide.end_speed ** 2) / (2 * slideDistance);

  it('a directional air dodge slides at 4.2 u/f on frame 3 and brakes evenly to 1.3 u/f, the brake that takes 20 u', () => {
    const r = airDodge({ x: 100 });
    const speeds = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => r.step(n).x);
    const expected = speeds.map((_, i) => Math.max(slide.speed_fresh - i * slideBrake, slide.end_speed));
    expect(slideBrake).toBeCloseTo(0.39875, 10);
    expect(speeds).toEqual(expected.map((v) => expect.closeTo(v, 6)));
    expect(speeds.slice(-3)).toEqual([1.3, 1.3, 1.3].map((v) => expect.closeTo(v, 6)));
    // No gravity yet: it slides level.
    expect(r.path.slice(0, 14).map((p) => p.y)).toEqual(new Array(14).fill(0));
  });

  it("from frame 14 gravity and Mario's air friction take over the 1.3 u/f; the stick drifts again from frame 24", () => {
    const S = marioReference.stats;
    expect(S.airFriction).toBe(slide.mario_air_brake_x);
    const neutral = airDodge({ x: 100 });
    const held = airDodge({ x: 100 }, { x: 100 });
    for (const r of [neutral, held]) {
      // Frame 14's gravity shows in frame 15's step, since the fighter moves before gravity acts on its speed.
      expect([r.step(14).y, r.step(15).y]).toEqual([0, expect.closeTo(-S.gravity, 6)]);
      // Air friction slows the slide from frame 14 whether the stick is held forward or not, until frame 24.
      for (let n = slide.gravity_flag_frame; n < slide.control_flag_frame; n++) {
        expect(r.step(n).x, `frame ${n}`).toBeCloseTo(slide.end_speed - (n - 13) * S.airFriction, 6);
      }
    }
    // Held forward from frame 24, the stick takes the speed back up to Mario's air speed; let go, friction keeps on.
    expect(held.step(24).x).toBeCloseTo(S.airSpeed, 6);
    expect(neutral.step(24).x).toBeCloseTo(slide.end_speed - 11 * S.airFriction, 6);
  });

  it('a side air dodge covers 34.3 u by frame 20 and 80.2 u by its last frame; a diagonal one 24.1 across, 22.7 up', () => {
    // Side: the slingshot's -0.7, 22.44 braking on frames 3-10, 1.3 a frame on 11-13 and 8.68 under air friction on
    // 14-20 (main: 23.1). Then air friction alone carries it 45.9 u more by frame 87, its last (main: 54.4).
    const side = airDodge({ x: 100 });
    expect(side.path[19]!.x).toBeCloseTo(34.32, 2);
    expect(side.path.length).toBe(87);
    expect(side.path.at(-1)!.x).toBeCloseTo(80.21, 2);
    // Up and forward: the same slide at 45 degrees, 0.92 u/f left on each axis at frame 14, where gravity takes the
    // vertical part (main: 16.3 and 16.3). Air friction stops the horizontal part on frame 75, before its last
    // frame, 102 (main: 43.4 across).
    const diag = airDodge({ x: 100, y: 100 });
    expect(diag.path[19]!.x).toBeCloseTo(24.14, 2);
    expect(diag.path[19]!.y).toBeCloseTo(22.73, 2);
    expect(diag.path.length).toBe(102);
    expect(diag.path.at(-1)!.x).toBeCloseTo(45.84, 2);
  });

  it('a neutral air dodge keeps its momentum: it moves as a fall does, with air friction and gravity', () => {
    const moving = { x: 1.1, y: 1.2 };
    const dodge = airDodge({}, {}, moving);
    const fall = airDodge({}, {}, moving, []);
    expect([dodge.action, fall.action]).toEqual(['airDodge', 'fall']);
    expect(dodge.path).toEqual(fall.path.slice(0, dodge.path.length));
  });
});

describe('ledge', () => {
  /** A fighter falling onto Battlefield's left ledge; the next frame is the grab frame. */
  function hang(percent = 0, airtime = 0) {
    const m = grounded();
    const f = P(m);
    const L = getStage('battlefield').ledges[0]!;
    f.damage = percent;
    f.airFrames = airtime;
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

  it('hangs for 360 frames after the catch, then lets go (Ultimate cliff_catch_time_quick)', () => {
    const { m, f } = hang();
    run(m, 1);
    expect(f.action).toBe('ledgeCatch');
    run(m, 19);
    expect(f.action).toBe('ledgeHang');
    expect(isIntangible(f)).toBe(true);
    let frames = 0;
    while (f.action === 'ledgeHang' && frames < 400) {
      frames++;
      run(m, 1);
    }
    expect(frames).toBe(ref.ledge.hang_max_frames);
    expect(f.action).toBe('fall');
    expect(f.ledge).toBe(-1);
  });

  it('after letting go, catches no ledge until 44 frames later (Ultimate cliff_no_catch_frame)', () => {
    const { m, f } = hang();
    run(m, 30);
    expect(f.action).toBe('ledgeHang');
    const L = getStage('battlefield').ledges[0]!;
    run(m, 1, { y: -100 });
    expect(f.action).toBe('fall');
    // Hold the fighter where it would catch the ledge, falling, until it does; frame 0 is the release.
    let caught = 0;
    for (let t = 1; t <= 60 && !caught; t++) {
      Object.assign(f, { pos: { x: L.x + L.side * 3, y: L.y - 6 }, vel: { x: 0, y: 0 } });
      f.prevPos = { ...f.pos };
      run(m, 1);
      if (f.action.startsWith('ledge')) caught = t;
    }
    expect(caught).toBe(ref.ledge.no_regrab_after_release_frames);
  });

  it('the ledge catch lasts 19 frames counting the grab frame, so the hang acts on frame 20 (Ultimate)', () => {
    const { m, f } = hang();
    run(m, 1);
    expect(f.action).toBe('ledgeCatch');
    // Hold toward the stage from the frame after the grab: the climb starts on the first actionable frame.
    let frame = 1;
    while (f.action !== 'ledgeClimb' && frame < 60) {
      stepMatch(m, [input({ x: 100 })]);
      frame++;
    }
    expect(frame).toBe(ref.ledge.first_actionable_frame);
    expect(frame - 1).toBe(ref.ledge.catch_animation_frames);
  });

  it.each(
    ref.ledge.intangibility_test_vectors.map(
      (v) => [v.airtime_frames, v.percent, v.expected_frames_incl_19f_catch] as const,
    ),
  )(
    'ledge intangibility follows 60*airtime/300 + 44 - 44*%%/120 + 19: %s airtime frames at %s%% is %s frames',
    (airtime, percent, expected) => {
      const { m, f } = hang(percent, airtime);
      // Frames counted from the grab frame while the fighter hangs untouched.
      const intangible: number[] = [];
      for (let frame = 1; frame <= 200; frame++) {
        stepMatch(m, [input({})]);
        if (isIntangible(f)) intangible.push(frame);
      }
      expect(intangible.length).toBe(expected);
      expect(intangible[0]).toBe(1);
      expect(intangible.at(-1)).toBe(expected);
    },
  );

  it.each([
    // Mario, UFD Ledge Stats (physics-reference section 8): intangible frames, then total + 1.
    ['climb', { x: 100 }, [1, 33], 35],
    ['roll', { buttons: ['shield'] }, [1, 25], 46],
    ['attack', { buttons: ['attack'] }, [1, 26], 56],
    ['jump', { buttons: ['jump'] }, [1, 12], 15],
  ] as [string, Parameters<typeof input>[0], [number, number], number][])(
    'ledge %s getup is intangible on frames %j and actionable on frame %i (Ultimate)',
    (name, hold, [from, until], faf) => {
      const { m, f } = hang();
      run(m, 40);
      expect(f.action).toBe('ledgeHang');
      const intangible: number[] = [];
      let actionable = -1;
      for (let frame = 1; frame <= 80 && actionable < 0; frame++) {
        stepMatch(m, [input(frame === 1 ? hold : {})]);
        if (isIntangible(f)) intangible.push(frame);
        if (!f.action.startsWith('ledge')) actionable = frame;
      }
      expect(intangible[0]).toBe(from);
      expect(intangible.at(-1)).toBe(until);
      expect(intangible.length).toBe(until - from + 1);
      expect(actionable).toBe(faf);
      // Climb, roll and attack end standing on the stage; the jump ends airborne in a normal jump.
      expect(f.ground === null).toBe(name === 'jump');
    },
  );
});

describe('stage and camera', () => {
  it('Battlefield blast zones and camera box match the reference stage data', () => {
    const stage = getStage('battlefield');
    expect(stage.blastZones).toEqual({ left: -240, right: 240, top: 192, bottom: -140 });
    expect(stage.camera).toEqual({ left: -170, right: 170, top: 130, bottom: -80 });
    expect(stage.ledges.map((l) => l.x).sort((a, b) => a - b)).toEqual([-80, 80]);
  });

  it('frames both fighters with room to read the stage: about 5 px per unit', () => {
    const stage = getStage('battlefield');
    const m = fireboys(2);
    const zoomFor = (a: number, b: number) => {
      P(m, 0).pos = { x: a, y: 0 };
      P(m, 1).pos = { x: b, y: 0 };
      return cameraTarget(m, stage).zoom;
    };
    // Fighters close together or at the spawns: the narrowest view, 240 units across.
    expect(zoomFor(0, 20)).toBeCloseTo(5.33, 2);
    expect(zoomFor(-40, 40)).toBeCloseTo(5.33, 2);
    expect(zoomFor(-79, 79)).toBeCloseTo(4.78, 2);
    // The 160-unit deck at the spawns: about 60% of the screen in Ultimate, 67% here.
    expect((160 * zoomFor(-40, 40)) / 1280).toBeLessThanOrEqual(0.7);
  });
});
