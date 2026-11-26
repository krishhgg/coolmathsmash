import { describe, expect, it } from 'vitest';
import {
  AIR_DODGE_NEUTRAL,
  DASH_SPEED_KEEP_FRAMES,
  INFINITE_STOCKS,
  LEDGE_CATCH_FRAMES,
  LEDGE_MAX_GRABS,
  LEDGE_GETUP_INTANGIBILITY_SCALE,
  RESPAWN_INVINCIBILITY,
  ROLL_BACK,
  ROLL_FORWARD,
  SHIELD_DEPLETION,
  SHIELD_DROP_FRAMES,
  SHIELD_MAX,
  SHIELD_REGEN,
  SPOT_DODGE,
} from './constants';
import { isIntangible } from './actions/registry';
import { ledgeIntangibility } from './combat/formulas';
import { compiledStage } from './context';
import type { FighterState, GroundRef } from './fighter';
import { groundSpan, surfaceY } from './movement';
import { marioReference as mario } from './testing/reference';
import { placeInAir, run, testMatch, until, type Hold } from './testing/sim';
import { apexHeight, jumpVelocity } from './physics';

const S = mario.stats;
const fighter = (m: ReturnType<typeof testMatch>) => m.fighters[0]!;

describe('spawning and landing', () => {
  it('settles on the stage idle', () => {
    const f = fighter(testMatch());
    expect(f.action).toBe('idle');
    expect(f.ground).not.toBeNull();
    expect(f.pos.y).toBeCloseTo(0);
  });
});

describe('jumps (Mario reference: full hop 36.33, short hop 17.54, double jump 36.33)', () => {
  it('solves initial speeds that reach the exact apex', () => {
    for (const h of [S.fullHopHeight, S.shortHopHeight, 10, 50]) {
      expect(apexHeight(jumpVelocity(h, S.gravity), S.gravity)).toBeCloseTo(h, 6);
    }
  });

  it('stays grounded for exactly the 3-frame jumpsquat, then full hops while jump is held', () => {
    const m = testMatch();
    const f = fighter(m);
    const grounded: boolean[] = [];
    let apex = 0;
    for (let i = 0; i < 80; i++) {
      run(m, 1, { buttons: ['jump'] });
      grounded.push(f.ground !== null);
      apex = Math.max(apex, f.pos.y);
    }
    expect(grounded.slice(0, 4)).toEqual([true, true, true, false]);
    expect(apex).toBeCloseTo(S.fullHopHeight, 2);
  });

  it('short hops when jump is released during jumpsquat', () => {
    const m = testMatch();
    const f = fighter(m);
    run(m, 1, { buttons: ['jump'] });
    let apex = 0;
    for (let i = 0; i < 60; i++) {
      run(m, 1);
      apex = Math.max(apex, f.pos.y);
    }
    expect(apex).toBeCloseTo(S.shortHopHeight, 2);
  });

  it('tap jump uses the stick: held up = full hop, released = short hop', () => {
    const short = testMatch();
    run(short, 1, { y: 100 });
    let apexFull = 0;
    let apexShort = 0;
    const fs = fighter(short);
    for (let i = 0; i < 60; i++) {
      run(short, 1);
      apexShort = Math.max(apexShort, fs.pos.y);
    }
    expect(apexShort).toBeCloseTo(S.shortHopHeight, 2);
    const again = testMatch();
    const fa = fighter(again);
    for (let i = 0; i < 60; i++) {
      run(again, 1, { y: 100 });
      apexFull = Math.max(apexFull, fa.pos.y);
    }
    expect(apexFull).toBeCloseTo(S.fullHopHeight, 2);
  });

  it('double jumps to the double-jump height, once', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 60);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('doubleJump');
    const start = f.prevPos.y;
    let apex = f.pos.y;
    for (let i = 0; i < 60; i++) {
      run(m, 1);
      apex = Math.max(apex, f.pos.y);
    }
    expect(apex - start).toBeCloseTo(S.doubleJumpHeight, 2);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).not.toBe('doubleJump');
  });
});

describe('falling', () => {
  it('caps fall speed at 1.5 and fast falls at 2.4 after a down flick past the apex', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 150);
    run(m, 60);
    expect(f.vel.y).toBeCloseTo(-S.fallSpeed);
    run(m, 1, { y: -100 });
    expect(f.fastFalling).toBe(true);
    run(m, 3, { y: -100 });
    expect(f.vel.y).toBeCloseTo(-S.fastFallSpeed);
  });

  it('cannot fast fall while still rising', () => {
    const m = testMatch();
    const f = fighter(m);
    run(m, 6, { buttons: ['jump'] });
    run(m, 2, { y: -100 });
    expect(f.vel.y).toBeGreaterThan(0);
    expect(f.fastFalling).toBe(false);
  });

  it('lands with hard landing lag after a long fall and soft lag after a tiny hop', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 20);
    until(m, (g) => g.ground !== null);
    expect(f.action).toBe('land');
    expect(f.landingLag).toBe(S.hardLandingLag);
    run(m, S.hardLandingLag + 1);
    expect(f.action).toBe('idle');
  });
});

describe('ground movement (Mario reference: walk 1.155, initial dash 1.936, run 1.76)', () => {
  it('walks at a speed proportional to the stick', () => {
    const m = testMatch();
    run(m, 40, (i) => ({ x: i < 3 ? 25 + i * 10 : 50 }));
    expect(fighter(m).action).toBe('walk');
    expect(fighter(m).vel.x).toBeCloseTo(0.5 * S.walkSpeed, 5);
  });

  it('dashes at the initial dash speed on a flick, then runs at run speed', () => {
    const m = testMatch({ x: -60 });
    const f = fighter(m);
    run(m, 1, { x: 100 });
    expect(f.action).toBe('dash');
    expect(f.vel.x).toBeCloseTo(S.dashInitialSpeed);
    run(m, S.dashFrames, { x: 100 });
    expect(f.action).toBe('run');
    run(m, 30, { x: 100 });
    expect(f.vel.x).toBeCloseTo(S.runSpeed);
  });

  it('the initial dash lasts exactly dashFrames frames', () => {
    const m = testMatch({ x: -60 });
    const f = fighter(m);
    run(m, S.dashFrames, { x: 100 });
    expect(f.action).toBe('dash');
    expect(f.actionFrame).toBe(S.dashFrames);
    run(m, 1, { x: 100 });
    expect(f.action).toBe('run');
  });

  /** Mario's speed on each of the first `frames` frames of a dash whose stick is held for `held` frames. */
  function dashSpeeds(held: number, frames: number) {
    const m = testMatch({ x: -60 });
    const f = fighter(m);
    const x0 = f.pos.x;
    const speeds: number[] = [];
    const actions: string[] = [];
    for (let i = 0; i < frames; i++) {
      run(m, 1, i < held ? { x: 100 } : {});
      speeds.push(f.vel.x);
      actions.push(f.action);
    }
    return { speeds, actions, distance: f.pos.x - x0 };
  }

  it('holds the initial dash speed for dash_speed_keep_frame (6) frames, then eases to run speed at traction', () => {
    expect(DASH_SPEED_KEEP_FRAMES).toBe(6);
    const { speeds, actions } = dashSpeeds(16, 16);
    for (let i = 0; i < 6; i++) expect(speeds[i]).toBeCloseTo(S.dashInitialSpeed, 9);
    // Ultimate brakes speed above run_speed_max by ground_brake: 1.936 - 0.102 = 1.834, then 1.76.
    expect(speeds[6]).toBeCloseTo(S.dashInitialSpeed - S.groundFriction, 9);
    expect(speeds[7]).toBeCloseTo(S.runSpeed, 9);
    expect(actions[S.dashFrames - 1]).toBe('dash');
    expect(actions[S.dashFrames]).toBe('run');
    for (const v of speeds.slice(7)) expect(v).toBeCloseTo(S.runSpeed, 9);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i - 1]! - speeds[i]!).toBeLessThanOrEqual(S.groundFriction + 1e-9);
    }
  });

  it('a stick released during the initial dash keeps dash speed to frame 6, then slides out at traction', () => {
    const { speeds, actions, distance } = dashSpeeds(1, 30);
    for (let i = 0; i < 6; i++) expect(speeds[i]).toBeCloseTo(S.dashInitialSpeed, 9);
    for (let i = 6; i < 24; i++) {
      expect(speeds[i]).toBeCloseTo(S.dashInitialSpeed - S.groundFriction * (i - 5), 9);
    }
    expect(speeds[24]).toBe(0);
    // The dash still plays out its dashFrames, braking, then the fighter stands and skids on.
    expect(actions.slice(0, S.dashFrames).every((a) => a === 'dash')).toBe(true);
    expect(actions[S.dashFrames]).toBe('idle');
    // 6 x 1.936 held, then 1.834 + 1.732 + ... + 0.1 at 0.102 a frame.
    expect(distance).toBeCloseTo(29.022, 3);
  });

  it('dash dances when flicked back on the first 5 frames of the initial dash (turn_dash_frame 5)', () => {
    const m = testMatch();
    const f = fighter(m);
    run(m, 3, { x: 100 });
    run(m, 1);
    run(m, 1, { x: -100 });
    expect(f.actionFrame).toBe(1);
    expect(f.action).toBe('dash');
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBeCloseTo(-S.dashInitialSpeed);
  });

  it('skids to a stop when the stick is released during a run, and turns around when reversed', () => {
    const m = testMatch({ x: -70 });
    const f = fighter(m);
    run(m, 20, { x: 100 });
    run(m, 1);
    expect(f.action).toBe('runBrake');
    until(m, (g) => g.action === 'idle');
    run(m, 10);
    expect(f.vel.x).toBe(0);
    const t = testMatch({ x: -70 });
    run(t, 20, { x: 100 });
    run(t, 1, { x: -100 });
    expect(fighter(t).action).toBe('turn');
    expect(fighter(t).facing).toBe(-1);
  });

  it('runs off the stage into a fall that keeps the double jump', () => {
    const m = testMatch({ x: 60 });
    const f = fighter(m);
    until(m, (g) => g.ground === null, { x: 100 });
    expect(f.action).toBe('fall');
    expect(f.jumpsUsed).toBe(1);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('doubleJump');
  });

  it('crouches while down is held', () => {
    const m = testMatch();
    run(m, 5, { y: -100 });
    expect(fighter(m).action).toBe('crouch');
    run(m, 2);
    expect(fighter(m).action).toBe('idle');
  });
});

describe('soft platforms', () => {
  it('lands on a platform from above and drops through on a down flick', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 60);
    until(m, (g) => g.action === 'idle');
    expect(f.ground?.kind).toBe('platform');
    expect(f.pos.y).toBeCloseTo(47.19);
    run(m, 1, { y: -100 });
    expect(f.ground).toBeNull();
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('solid');
  });

  it('jumps up through a platform from below', () => {
    const m = testMatch({ x: -40 });
    const f = fighter(m);
    run(m, 30, { buttons: ['jump'] });
    expect(f.pos.y).toBeGreaterThan(24.12);
    until(m, (g) => g.ground !== null);
    expect(f.ground?.kind).toBe('platform');
  });

  it('falls through platforms while holding down', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 60);
    until(m, (g) => g.ground !== null, { y: -100 });
    expect(f.ground?.kind).toBe('solid');
  });
});

describe('ledges', () => {
  const hangOnLeft = () => {
    const m = testMatch();
    const f = placeInAir(m, -85, 4, 1);
    until(m, (g) => g.action === 'ledgeHang');
    return { m, f };
  };

  it('grabs a nearby ledge while falling, facing the stage, with intangibility on the first grab', () => {
    const m = testMatch();
    const f = placeInAir(m, -83, 4, -1);
    until(m, (g) => g.action === 'ledgeCatch');
    expect(f.ledge).toBe(0);
    expect(f.facing).toBe(1);
    expect(f.intangible).toBe(ledgeIntangibility(f.airFrames, f.damage));
    expect(f.pos.x).toBeLessThan(-80);
  });

  it('gives no intangibility on a regrab without landing, and stops grabbing after six', () => {
    const { m, f } = hangOnLeft();
    let grabs = 1;
    for (let i = 0; i < 10; i++) {
      run(m, 1, { y: -100 });
      expect(f.action).toBe('fall');
      f.ledgeLock = 0;
      f.pos.y = -4;
      f.vel.y = 0;
      run(m, 3);
      if (f.action === 'ledgeCatch') {
        grabs++;
        expect(f.intangible).toBe(0);
        run(m, LEDGE_CATCH_FRAMES);
      }
    }
    expect(grabs).toBe(LEDGE_MAX_GRABS);
  });

  it('climbs onto the stage when pushed toward it', () => {
    const { m, f } = hangOnLeft();
    run(m, 1, { x: 50 });
    expect(f.action).toBe('ledgeClimb');
    until(m, (g) => g.action === 'idle');
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.x).toBeGreaterThan(-80);
  });

  it('rolls onto the stage on shield and jumps on jump', () => {
    const roll = hangOnLeft();
    run(roll.m, 1, { buttons: ['shield'] });
    expect(roll.f.action).toBe('ledgeRoll');
    until(roll.m, (g) => g.action === 'idle');
    expect(roll.f.pos.x).toBeCloseTo(-55, 0);

    const jump = hangOnLeft();
    run(jump.m, 1, { buttons: ['jump'] });
    until(jump.m, (g) => g.action === 'jump');
    expect(jump.f.vel.y).toBeGreaterThan(0);
    expect(jump.f.jumpsUsed).toBe(1);
  });

  it('a getup restores the ledge allowance, so walking off and grabbing again is intangible', () => {
    const { m, f } = hangOnLeft();
    f.ledgeGrabs = LEDGE_MAX_GRABS;
    run(m, 1, { x: 50 });
    until(m, (g) => g.action === 'idle');
    expect(f.ledgeGrabs).toBe(0);
    expect(f.ledgeFresh).toBe(true);
    placeInAir(m, -85, 4, 1);
    until(m, (g) => g.action === 'ledgeCatch');
    expect(f.intangible).toBe(ledgeIntangibility(f.airFrames, f.damage));
  });

  /** Intangible frames of a getup started with `start`, from a hang reached after `grabs` grabs. */
  const getupIntangibility = (start: Hold, grabs: number) => {
    const { m, f } = hangOnLeft();
    f.ledgeGrabs = grabs;
    f.intangible = 0;
    let frames = 0;
    for (let i = 0; i < 60; i++) {
      run(m, 1, i === 0 ? start : {});
      if (isIntangible(f)) frames++;
    }
    return frames;
  };

  it.each([
    ['climb', { x: 50 }, 33],
    ['roll', { buttons: ['shield'] }, 25],
    ['attack', { buttons: ['attack'] }, 26],
    ['jump', { buttons: ['jump'] }, 12],
  ] as [string, Hold, number][])(
    'ledge %s intangibility shrinks on regrabs: x1, x0.8, x0.5, then none',
    (_, start, full) => {
      const expected = [1, 2, 3, 4].map((g) =>
        Math.floor(full * (LEDGE_GETUP_INTANGIBILITY_SCALE[g - 1] ?? 0)),
      );
      expect(expected).toEqual([full, Math.floor(full * 0.8), Math.floor(full * 0.5), 0]);
      expect([1, 2, 3, 4].map((g) => getupIntangibility(start, g))).toEqual(expected);
    },
  );

  it('a real drop-and-regrab gets the penalised getup', () => {
    const { m, f } = hangOnLeft();
    run(m, 1, { y: -100 });
    f.ledgeLock = 0;
    f.pos.y = -4;
    f.vel.y = 0;
    until(m, (g) => g.action === 'ledgeHang');
    expect(f.ledgeGrabs).toBe(2);
    expect(f.intangible).toBe(0);
    run(m, 1, { x: 50 });
    let frames = 0;
    until(m, (g) => {
      if (isIntangible(g)) frames++;
      return g.action === 'idle';
    });
    expect(frames).toBe(Math.floor(33 * 0.8));
  });
});

describe('shield (Ultimate: 50 HP, -0.15/frame held, +0.08/frame down, 11-frame drop)', () => {
  it('drains while held and breaks after ~5.56 seconds', () => {
    const m = testMatch();
    const f = fighter(m);
    run(m, 100, { buttons: ['shield'] });
    expect(f.action).toBe('shield');
    expect(f.shieldHp).toBeCloseTo(SHIELD_MAX - 100 * SHIELD_DEPLETION, 6);
    until(m, (g) => g.action === 'shieldBreak', { buttons: ['shield'] });
    expect(m.frame - 10).toBeGreaterThanOrEqual(Math.floor(SHIELD_MAX / SHIELD_DEPLETION) - 1);
    expect(m.frame - 10).toBeLessThanOrEqual(Math.ceil(SHIELD_MAX / SHIELD_DEPLETION) + 1);
    until(m, (g) => g.action === 'dizzy');
  });

  it('drops with 11 frames of lag, then regenerates', () => {
    const m = testMatch();
    const f = fighter(m);
    run(m, 20, { buttons: ['shield'] });
    const hp = f.shieldHp;
    run(m, 1);
    expect(f.action).toBe('shieldDrop');
    run(m, SHIELD_DROP_FRAMES - 1);
    expect(f.action).toBe('shieldDrop');
    run(m, 1);
    expect(f.action).toBe('idle');
    expect(f.shieldHp).toBeCloseTo(hp + (SHIELD_DROP_FRAMES + 1) * SHIELD_REGEN, 6);
  });

  it('rolls, spot dodges and jumps out of shield', () => {
    const m = testMatch();
    run(m, 5, { buttons: ['shield'] });
    run(m, 1, { buttons: ['shield'], x: -100 });
    expect(fighter(m).action).toBe('rollBack');
    const s = testMatch();
    run(s, 5, { buttons: ['shield'] });
    run(s, 1, { buttons: ['shield'], y: -100 });
    expect(fighter(s).action).toBe('spotDodge');
    const j = testMatch();
    run(j, 5, { buttons: ['shield'] });
    run(j, 1, { buttons: ['shield', 'jump'] });
    expect(fighter(j).action).toBe('jumpSquat');
  });
});

describe('dodges', () => {
  it('spot dodge: intangible on frames 3-17, actionable on frame 26', () => {
    const m = testMatch();
    const f = fighter(m);
    run(m, 5, { buttons: ['shield'] });
    run(m, 1, { buttons: ['shield'], y: -100 });
    const intangible: number[] = [];
    let last = 0;
    while (f.action === 'spotDodge') {
      last = f.actionFrame;
      if (isIntangible(f)) intangible.push(f.actionFrame);
      run(m, 1);
    }
    expect(intangible[0]).toBe(SPOT_DODGE.intangible[0]);
    expect(intangible.at(-1)).toBe(SPOT_DODGE.intangible[1]);
    expect(last + 1).toBe(SPOT_DODGE.faf);
  });

  it('spot dodge: an attack held from frame 15 comes out on the cancel frame, a grab on the FAF', () => {
    const exit = (buttons: Hold['buttons']) => {
      const m = testMatch({ fighter: 'fireboy' });
      const f = fighter(m);
      run(m, 5, { buttons: ['shield'] });
      run(m, 1, { buttons: ['shield'], y: -100 });
      until(m, (g) => g.actionFrame === 14);
      let last = 0;
      while (f.action === 'spotDodge') {
        last = f.actionFrame;
        run(m, 1, { buttons });
      }
      return [last + 1, f.move];
    };
    expect(exit(['attack'])).toEqual([SPOT_DODGE.attackCancel, 'jab']);
    expect(exit(['special'])).toEqual([SPOT_DODGE.attackCancel, 'neutralB']);
    expect(exit(['shield', 'attack'])).toEqual([SPOT_DODGE.faf, 'grab']);
  });

  it.each([
    ['rollForward', 100, ROLL_FORWARD, -1, S.rollDistance],
    ['rollBack', -100, ROLL_BACK, 1, S.backRollDistance],
  ] as const)(
    '%s: travels its own distance on its own intangible frames and FAF',
    (name, x, spec, facing, distance) => {
      const m = testMatch();
      const f = fighter(m);
      run(m, 5, { buttons: ['shield'] });
      const x0 = f.pos.x;
      run(m, 1, { buttons: ['shield'], x });
      expect(f.action).toBe(name);
      const intangible: number[] = [];
      let last = 0;
      while (f.action === name) {
        last = f.actionFrame;
        if (isIntangible(f)) intangible.push(f.actionFrame);
        run(m, 1);
      }
      expect(Math.abs(f.pos.x - x0)).toBeCloseTo(distance, 1);
      expect([intangible[0], intangible.at(-1)]).toEqual(spec.intangible);
      expect(last + 1).toBe(spec.faf);
      expect(f.facing).toBe(facing);
    },
  );

  it('air dodge: once per airtime; neutral is intangible 3-29 and lands with 10 frames of lag', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 30);
    run(m, 1, { buttons: ['shield'] });
    expect(f.action).toBe('airDodge');
    const frames: number[] = [];
    while (f.action === 'airDodge') {
      if (isIntangible(f)) frames.push(f.actionFrame);
      run(m, 1);
    }
    expect([frames[0], frames.at(-1)]).toEqual(AIR_DODGE_NEUTRAL.intangible);
    run(m, 1, { buttons: ['shield'] });
    expect(f.action).not.toBe('airDodge');
    const n = testMatch();
    const g = placeInAir(n, 0, 6);
    run(n, 1, { buttons: ['shield'] });
    until(n, (h) => h.action === 'land');
    expect(g.landingLag).toBe(AIR_DODGE_NEUTRAL.landingLag);
  });

  it('directional air dodge travels in the stick direction', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, 100);
    run(m, 1, { buttons: ['shield'], x: 100 });
    run(m, 20, { x: 100 });
    expect(f.pos.x).toBeGreaterThan(15);
  });
});

describe('blast zones and respawn', () => {
  it('loses a stock past a blast zone and respawns invincible on the platform', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, -130);
    run(m, 20);
    expect(f.stocks).toBe(2);
    until(m, (g) => g.action === 'respawn');
    expect(f.pos).toEqual({ x: 0, y: 70 });
    expect(isIntangible(f)).toBe(true);
    run(m, 25);
    run(m, 1, { x: 100 });
    expect(f.action).toBe('fall');
    expect(f.intangible).toBe(RESPAWN_INVINCIBILITY - 1);
  });

  it('keeps every stock under Infinite stock and respawns after the 99th fall and beyond', () => {
    const m = testMatch({ stocks: INFINITE_STOCKS });
    const f = fighter(m);
    let kos = 0;
    for (let fall = 1; fall <= 120; fall++) {
      placeInAir(m, 0, -130);
      until(m, (g) => g.action === 'ko');
      kos += m.events.filter((e) => e.type === 'ko' && e.stocks === INFINITE_STOCKS).length;
      expect(f.stocks).toBe(INFINITE_STOCKS);
      until(m, (g) => g.action === 'respawn');
    }
    expect(kos).toBe(120);
  });
});

describe('pushing', () => {
  /** Two idle fighters on the main stage, P2 `dx` to the right of P1 at x. */
  function pair(x: number, dx: number) {
    const m = testMatch({ players: 2 });
    const [a, b] = m.fighters as [FighterState, FighterState];
    for (const [f, px] of [
      [a, x],
      [b, x + dx],
    ] as const) {
      Object.assign(f, {
        pos: { x: px, y: 0 },
        prevPos: { x: px, y: 0 },
        ground: a.ground,
        action: 'idle',
        vel: { x: 0, y: 0 },
      });
    }
    return { m, a, b };
  }

  it('fighters standing in each other separate to their combined half widths', () => {
    const { m, a, b } = pair(-70, 1);
    run(m, 30);
    expect(b.pos.x - a.pos.x).toBeGreaterThan(S.width - 0.1);
    expect(b.pos.x - a.pos.x).toBeLessThanOrEqual(S.width);
    expect((a.pos.x + b.pos.x) / 2).toBeCloseTo(-69.5, 6);
  });

  it('a walking fighter shoves a standing one instead of walking through', () => {
    const { m, a, b } = pair(-70, S.width);
    const b0 = b.pos.x;
    run(m, 60, { x: 50 });
    expect(a.action).toBe('walk');
    expect(b.pos.x - b0).toBeGreaterThan(10);
    expect(b.pos.x - a.pos.x).toBeGreaterThan(S.width / 2);
  });

  it('pushing never moves a fighter off the stage', () => {
    const { m, a, b } = pair(-79, -1);
    run(m, 30);
    expect(b.pos.x).toBeGreaterThanOrEqual(-80);
    expect(b.ground).not.toBeNull();
    expect(a.pos.x - b.pos.x).toBeGreaterThan(S.width - 0.1);
  });
});

describe('walls and ceilings', () => {
  it('a jump into the underside of the stage stops rising instead of keeping its speed', () => {
    const m = testMatch();
    const f = placeInAir(m, 0, -60);
    f.vel.y = 3;
    const ys: number[] = [];
    for (let i = 0; i < 8; i++) {
      run(m, 1);
      ys.push(f.pos.y);
    }
    expect(f.vel.y).toBeLessThan(0);
    expect(Math.max(...ys)).toBeLessThan(-40 - S.height / 2);
    expect(ys.at(-1)).toBeLessThan(Math.max(...ys));
  });

  it('knockback into a wall is cancelled and stays cancelled', () => {
    const m = testMatch();
    const f = placeInAir(m, 86, -12);
    f.ledgeLock = 60;
    f.kb = { x: -3, y: 0 };
    run(m, 3);
    expect(f.kb.x).toBe(0);
    expect(f.pos.x).toBeGreaterThan(80);
  });
});

describe('groundSpan', () => {
  const span = (stage: string, g: GroundRef) => groundSpan(compiledStage(stage), g);

  it("covers the floors a slide carries a fighter onto, and no further than the ground's ends", () => {
    // Forest Temple's floor dips 6 units in the middle, over three more floors of the same solid.
    expect(span('forest-temple', { kind: 'solid', index: 0 })).toEqual([-85, 85]);
    expect(span('forest-temple', { kind: 'solid', index: 2 })).toEqual([-85, 85]);
    // Johnny Upgrade's floor steps down 6 at x 28.3.
    expect(span('johnny-upgrade-boss', { kind: 'solid', index: 5 })).toEqual([-85, 85]);
    // Bloxorz's two halves have a gap between them.
    expect(span('bloxorz-platform', { kind: 'solid', index: 0 })).toEqual([-88, -8]);
    expect(span('bloxorz-platform', { kind: 'solid', index: 4 })).toEqual([8, 88]);
    expect(span('battlefield', { kind: 'platform', index: 2 })).toEqual([24.79, 59.42]);
    expect(span('battlefield', { kind: 'entity', index: 7, x1: -7, x2: 7, y: 3.5 })).toEqual([-7, 7]);
  });

  it('ends where the sim stops a roll', () => {
    /** A getup roll toward `dir` from lying at x on `g`, to where it ends. */
    const roll = (stage: string, x: number, g: GroundRef, dir: 1 | -1) => {
      const m = testMatch({ stage });
      const f = fighter(m);
      const y = surfaceY(compiledStage(stage), g, x);
      Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground: g });
      Object.assign(f, { action: 'getupRoll', actionFrame: 0, dodgeDir: { x: dir, y: 0 } });
      until(m, () => f.action === 'idle', {}, 60);
      return f.pos.x;
    };
    const floor0: GroundRef = { kind: 'solid', index: 0 };
    // Across Forest Temple's dip, a roll runs its full length; at the floor's end it stops there.
    expect(roll('forest-temple', -20, floor0, 1)).toBeCloseTo(-20 + S.rollDistance, 9);
    expect(roll('forest-temple', -75, floor0, -1)).toBe(span('forest-temple', floor0)[0]);
    expect(roll('bloxorz-platform', -20, floor0, 1)).toBe(span('bloxorz-platform', floor0)[1]);
    expect(roll('battlefield', 50, { kind: 'platform', index: 2 }, 1)).toBe(59.42);
  });
});
