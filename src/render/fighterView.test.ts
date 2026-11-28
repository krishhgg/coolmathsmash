import { describe, expect, it } from 'vitest';
import { allFighters, getFighter, registerFighter } from '../fighters/registry';
import { defineFighter, type FighterDef } from '../fighters/types';
import {
  AIR_DODGE_DIRECTIONAL,
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  LEDGE_JUMP,
  SHIELD_MAX,
  TECH_ROLL,
} from '../sim/constants';
import { createFighter } from '../sim/fighter';
import { quickGrapple, tetherTester } from '../sim/testing/tethers';
import { attack, placeInAir, run, runPorts, testMatch, until, type Hold } from '../sim/testing/sim';
import { finalTrapTester } from '../sim/testing/finalSmash';
import {
  BADGE_BLINK_FRAMES,
  clipFor,
  fighterArt,
  intangibleBlink,
  shieldRadius,
  statusBadges,
} from './fighterView';

describe('shieldRadius', () => {
  const fireboy = getFighter('fireboy');

  it('shrinks from full size to 15% as the shield empties', () => {
    expect(shieldRadius(fireboy, SHIELD_MAX)).toBeCloseTo(fireboy.stats.shieldSize);
    expect(shieldRadius(fireboy, 0)).toBeCloseTo(fireboy.stats.shieldSize * 0.15);
  });

  it('never goes negative when shield HP overshoots below zero during hitlag', () => {
    expect(shieldRadius(fireboy, -SHIELD_MAX)).toBe(0);
  });
});

describe('clipFor', () => {
  it('draws a ledge jump as the rise, then the jump clip counting from the frame the jump began', () => {
    const def = getFighter('fireboy');
    const art = fighterArt(def)!;
    const m = testMatch({ fighter: 'fireboy' });
    const f = placeInAir(m, -85, 4, 1);
    until(m, (g) => g.action === 'ledgeHang');
    const shown: string[] = [];
    for (let i = 0; i < 20; i++) {
      run(m, 1, i === 0 ? { buttons: ['jump'] } : {});
      shown.push(clipFor(def, art, f).join('@'));
    }
    const rise = Array.from({ length: LEDGE_JUMP.rise }, (_, i) => `ledgeJump@${i + 1}`);
    const jump = Array.from({ length: 20 - LEDGE_JUMP.rise }, (_, i) => `jump@${i + 1}`);
    expect(shown).toEqual([...rise, ...jump]);
    expect(f.action).toBe('jump');
  });
});

describe('statusBadges', () => {
  const squared = { kind: 'redball/squared', age: 1, since: 0, source: 0 };

  it('draws one badge per status that has a colour, steady until its last second, then blinking', () => {
    const f = createFighter(1, 'fireboy', [0, 0, 1], 3);
    expect(statusBadges(f, 0)).toEqual([]);
    f.statuses = [{ ...squared, frames: 300 }];
    expect(statusBadges(f, 4)).toEqual(['#3b3b46']);
    f.statuses = [{ ...squared, frames: BADGE_BLINK_FRAMES }];
    expect(statusBadges(f, 0)).toEqual(['#3b3b46']);
    expect(statusBadges(f, 4)).toEqual([]);
  });
});

describe('clipFor on tech and getup rolls', () => {
  const ROLLS = { techRoll: TECH_ROLL, getupRoll: GETUP_ROLL };
  const rolling = Object.values(allFighters()).filter((def) => fighterArt(def)?.clips.techRoll);

  /** The clip and clip frame for `action` on `frame`, facing `facing` and rolling `dir` times the facing. */
  function pick(def: FighterDef, action: string, facing: 1 | -1, dir: 1 | -1, frame: number) {
    const f = createFighter(0, def.id, [0, 0, facing], 3);
    Object.assign(f, { action, actionFrame: frame, move: null, dodgeDir: { x: dir * facing, y: 0 } });
    return clipFor(def, fighterArt(def)!, f);
  }

  it('covers every fighter with art that has roll clips', () => {
    const without = Object.values(allFighters()).filter(
      (def) => fighterArt(def) && !fighterArt(def)!.clips.techRoll,
    );
    for (const def of without) expect(fighterArt(def)!.clips.rollBack, def.id).toBeUndefined();
    expect(rolling.length).toBeGreaterThanOrEqual(10);
  });

  it.each(rolling.map((def) => [def.id, def] as const))(
    '%s draws a backward tech or getup roll with its back roll, as long as the action',
    (_, def) => {
      for (const [action, { faf }] of Object.entries(ROLLS))
        for (const facing of [1, -1] as const)
          for (const [dir, want] of [
            [1, action],
            [-1, `${action}Back`],
          ] as const) {
            const label = `${def.id} ${action} facing ${facing} rolling ${dir * facing}`;
            expect(pick(def, action, facing, dir, 1)[0], label).toBe(want);
            expect(fighterArt(def)!.clips[want]!.length, label).toBe(faf - 1);
            expect(pick(def, action, facing, dir, faf - 1), label).toEqual([want, faf - 1]);
          }
    },
  );
});

describe('clipFor on air dodges', () => {
  const fireboy = getFighter('fireboy');

  /** The clip frame Fireboy's air dodge draws on `frame` of a dodge toward `dir`. */
  function drawn(frame: number, x: number, y: number): number {
    const f = createFighter(0, fireboy.id, [0, 0, 1], 3);
    Object.assign(f, { action: 'airDodge', actionFrame: frame, move: null, dodgeDir: { x, y } });
    const [clip, at] = clipFor(fireboy, fighterArt(fireboy)!, f);
    expect(clip).toBe('airDodge');
    return at;
  }

  it('plays a neutral dodge frame for frame', () => {
    for (let frame = 1; frame < AIR_DODGE_NEUTRAL.faf; frame++) expect(drawn(frame, 0, 0)).toBe(frame);
  });

  it('draws the neutral intangible window over a directional one, then slows the recovery to the dodge end', () => {
    const [start, end] = AIR_DODGE_DIRECTIONAL.intangible;
    const length = fighterArt(fireboy)!.clips.airDodge!.length;
    /** Straight down, straight forward and straight up: fafByAngle's first, middle and last entries. */
    const dirs: [number, number, number][] = [
      [0, -1, 0],
      [1, 0, 2],
      [0, 1, 4],
    ];
    for (const [x, y, row] of dirs) {
      const last = AIR_DODGE_DIRECTIONAL.fafByAngle[row]! - 1;
      expect(drawn(start, x, y)).toBe(AIR_DODGE_NEUTRAL.intangible[0]);
      expect(drawn(end, x, y)).toBe(AIR_DODGE_NEUTRAL.intangible[1]);
      expect(drawn(last, x, y)).toBe(length);
      const frames = Array.from({ length: last }, (_, t) => drawn(t + 1, x, y));
      expect(frames).toEqual([...frames].sort((a, b) => a - b));
    }
  });
});

describe('clipFor through a tether reel', () => {
  /** Fluffy's art on the Quick Grapple fixture, so her upB clip (with its `reel` hold) plays on a real tether. */
  const fluffy = getFighter('fluffy');
  const grappler = defineFighter({
    ...fluffy,
    id: 'test-fluffy-grapple',
    moves: { ...fluffy.moves, upB: quickGrapple },
    selectable: false,
  });
  registerFighter(grappler);

  /**
   * Quick Grapple fired from the air at (`x`, 10) on Battlefield: each frame's action and the clip that draws it,
   * for `frames` frames.
   */
  function grapple(def: FighterDef, x: number, frames: number, holds: Hold[] = []) {
    const m = testMatch({ fighter: def.id });
    const f = placeInAir(m, x, 10);
    attack(m, 0, 'upB');
    const seen: { action: string; clip: string; frame: number }[] = [];
    for (let i = 0; i < frames; i++) {
      runPorts(m, 1, holds);
      const [clip, frame] = clipFor(def, fighterArt(def)!, f);
      seen.push({ action: f.action, clip, frame });
    }
    return seen;
  }

  /** The frames from the move's start to the reel's end (the aerial, then the tether actions). */
  const throughReel = (seen: ReturnType<typeof grapple>) =>
    seen.filter((s) => s.action === 'aerial' || s.action.startsWith('tether'));

  it.each([
    ['Fluffy', grappler],
    ['the tether tester', tetherTester],
  ])('keeps playing the move clip when %s starts reeling in', (_, def) => {
    const reel = throughReel(grapple(def, 0, 60));
    const pull = reel.findIndex((s) => s.action === 'tetherPull');
    expect(reel[pull - 1]!.action).toBe('aerial');
    expect(reel.every((s) => s.clip === 'upB')).toBe(true);
    expect(reel[pull]!.frame).toBeGreaterThan(reel[pull - 1]!.frame);
    for (let i = 1; i < reel.length; i++) expect(reel[i]!.frame).toBeGreaterThanOrEqual(reel[i - 1]!.frame);
  });

  it('holds the clip on its reel frame through a long reel', () => {
    const hold = fighterArt(grappler)!.clips.upB!.reel!;
    const reel = throughReel(grapple(grappler, 66, 80)).filter((s) => s.action === 'tetherPull');
    expect(reel.length).toBeGreaterThan(20);
    expect(reel.every((s) => s.frame <= hold)).toBe(true);
    expect(reel.at(-1)!.frame).toBe(hold);
  });

  it('holds the pose the reel arrived in while hanging', () => {
    const seen = grapple(grappler, 0, 60, [{ buttons: ['jump'] }]);
    const hang = seen.findIndex((s) => s.action === 'tetherHang');
    expect(seen[hang - 1]!.action).toBe('tetherPull');
    expect(seen.slice(hang).every((s) => s.action === 'tetherHang')).toBe(true);
    expect(seen[hang]!.frame).toBeGreaterThanOrEqual(seen[hang - 1]!.frame);
    expect(new Set(seen.slice(hang).map((s) => `${s.clip}@${s.frame}`))).toEqual(
      new Set([`upB@${seen[hang]!.frame}`]),
    );
  });
  it('plays the art’s own tetherPull clip from the reel’s first frame instead, when it has one', () => {
    const redball = getFighter('redball');
    const m = testMatch({ fighter: 'redball' });
    const f = placeInAir(m, 104, -6, -1);
    runPorts(m, 1, [{ x: -100, buttons: ['special'] }]);
    const seen: { action: string; clip: string; frame: number }[] = [];
    for (let i = 0; i < 30 && f.action !== 'ledgeCatch'; i++) {
      runPorts(m, 1, []);
      const [clip, frame] = clipFor(redball, fighterArt(redball)!, f);
      seen.push({ action: f.action, clip, frame });
    }
    const pull = seen.filter((s) => s.action === 'tetherPull');
    expect(pull.length).toBeGreaterThan(2);
    expect(pull.map((s) => [s.clip, s.frame])).toEqual(pull.map((_, i) => ['tetherPull', i + 1]));
    expect(seen.filter((s) => s.action === 'aerial').every((s) => s.clip === 'sideBAir')).toBe(true);
  });
});

describe('clipFor while a move charges', () => {
  const duck = getFighter('duck');

  it("plays the Duck's sideBCharge on the frames charged so far, then sideB from its charge frame on release", () => {
    const m = testMatch({ fighter: 'duck' });
    const f = m.fighters[0]!;
    const seen = () => clipFor(duck, fighterArt(duck)!, f);
    runPorts(m, 1, [{ x: 65, buttons: ['special'] }]);
    expect(seen()).toEqual(['sideB', 1]);
    runPorts(m, 11, [{ buttons: ['special'] }]);
    expect(seen()).toEqual(['sideB', 12]);
    runPorts(m, 30, [{ buttons: ['special'] }]);
    expect(f.charge).toBe(30);
    expect(seen()).toEqual(['sideBCharge', 30]);
    runPorts(m, 1, [{}]);
    expect(seen()).toEqual(['sideB', 13]);
  });

  it("draws Wheely's air Rev Up as the grounded one once he lands mid-charge, the sim keeping the air move", () => {
    const wheely = getFighter('wheely');
    const m = testMatch({ fighter: 'wheely' });
    const f = placeInAir(m, 0, 30);
    const seen = () => clipFor(wheely, fighterArt(wheely)!, f);
    runPorts(m, 1, [{ buttons: ['special'] }]);
    expect(f.move).toBe('neutralBAir');
    until(m, (g) => g.charge > 0, { buttons: ['special'] }, 30);
    expect(f.ground).toBeNull();
    expect(seen()[0]).toBe('neutralBAirCharge');
    until(m, (g) => g.ground !== null, { buttons: ['special'] }, 120);
    runPorts(m, 1, [{ buttons: ['special'] }]);
    expect(f.move).toBe('neutralBAir');
    expect(f.charge).toBeGreaterThan(0);
    expect(seen()).toEqual(['neutralBCharge', f.charge]);
    // A second press lets the revs go (Giant Punch's input model): the blast plays the grounded clip.
    runPorts(m, 1, [{}]);
    runPorts(m, 1, [{ buttons: ['special'] }]);
    until(m, () => seen()[0] !== 'neutralBCharge', {}, 20);
    expect(f.move).toBe('neutralBAir');
    expect(seen()[0]).toBe('neutralB');
  });

  it('maps a landed air move only to a ground move with clips, for air moves that carry on after landing', () => {
    for (const def of Object.values(allFighters())) {
      const art = fighterArt(def);
      for (const [air, ground] of Object.entries(art?.landed ?? {})) {
        expect(def.moves?.[air]?.continuesOnLanding, `${def.id} ${air}`).toBe(true);
        expect(art!.clips[ground], `${def.id} ${ground}`).toBeDefined();
      }
    }
  });

  it('holds the move clip on its charge frame when the art has no charge clip', () => {
    const fireboy = getFighter('fireboy');
    const m = testMatch({ fighter: 'fireboy' });
    const f = m.fighters[0]!;
    runPorts(m, 1, [{ x: 100, buttons: ['attack'] }]);
    runPorts(m, 30, [{ buttons: ['attack'] }]);
    expect(f.charge).toBeGreaterThan(0);
    const [clip] = clipFor(fireboy, fighterArt(fireboy)!, f);
    expect(clip).toBe('fsmash');
  });
});

describe('a Final Smash user', () => {
  it('never shows the intangibility blink, which an intangible fighter otherwise shows', () => {
    const user = createFighter(0, finalTrapTester.id, [0, 0, 1], 3);
    const dodger = createFighter(1, finalTrapTester.id, [0, 0, -1], 3);
    Object.assign(user, {
      action: 'grabThrow',
      move: 'finalSmashCinematic',
      actionFrame: 30,
      grabPartner: 1,
    });
    Object.assign(dodger, { action: 'spotDodge', actionFrame: 5, intangible: 10 });
    const blinks = (f: typeof user) => [0, 1, 2, 3, 4, 5, 6, 7].filter((frame) => intangibleBlink(f, frame));
    expect(blinks(user)).toEqual([]);
    expect(blinks(dodger)).toEqual([0, 1, 2, 3]);
  });
});
