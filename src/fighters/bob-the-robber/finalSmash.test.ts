import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import { samplePose } from '../../render/rig/sample';
import { knockback } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { finalReach, heldStill } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { registerFighter } from '../registry';
import { art } from './art';
import {
  ALL_OUT_ATTACK,
  DASH,
  LIGHTS_OUT_RANGE,
  SCENE,
  finalSmash,
  finalSmashAir,
  finalSmashCinematic,
} from './finalSmash';
import { fighter } from './index';

registerFighter(marioReference);

const ID = fighter.id;
const SPECIAL: Hold = { buttons: ['special'] };
/** The Mario reference's hurtbox radius (half its width): the catch reaches this much past the box. */
const BODY = marioReference.stats.width / 2;

/**
 * Bob at `xs[0]` facing right and two Mario-weight fighters at `xs[1]` and `xs[2]` on Battlefield's main stage, facing
 * Bob (three players: no 1v1 damage multiplier), settled. Returns after the activation frame when `go`.
 */
function setup(xs: [number, number, number], percent = 0, go = true) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: ID }, { fighter: marioReference.id }, { fighter: marioReference.id }],
  });
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i > 0 && x > xs[0] ? -1 : 1 });
  });
  step(m, 30);
  const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
  for (const f of m.fighters) expect(f.action).toBe('idle');
  v.damage = percent;
  a.finalReady = true;
  if (go) step(m, 1, [SPECIAL]);
  return { m, a, v, w };
}

function step(m: MatchState, frames: number, holds: Hold[] = []): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < frames; i++) {
    stepMatch(
      m,
      m.players.map((p) => input(holds[p.port])),
    );
    seen.push(...m.events);
  }
  return seen;
}

/** Step until Bob's move is over; the catch's move frame (or null) and every event. */
function playOut(m: MatchState, a: FighterState, holds: Hold[] = []) {
  let caught: number | null = null;
  const seen: SimEvent[] = [];
  for (let i = 0; i < 800 && a.move !== null; i++) {
    const frame = a.actionFrame + 1;
    const events = step(m, 1, holds);
    if (events.some((e) => e.type === 'commandGrab')) caught = frame;
    seen.push(...events);
  }
  return { caught, seen };
}

const A = ALL_OUT_ATTACK;
/** SmashWiki's Joker (SSBU) moveset table: "3% (trapping hit), 33.6% (cinematic), 13% (ending screen)". */
const ULTIMATE_DAMAGE = 3 + 33.6 + 13;
/** "Causes an instant KO if the opponent was at 100% damage or higher at the end of the cinematic": from this %. */
const ULTIMATE_KO = 100 - 3 - 33.6;

describe("Lights Out (Final Smash), on Joker's All-Out Attack", () => {
  it("takes All-Out Attack's frames: 65 held, the catch out on 67-77, the cinematic's hits, the launch and the ends", () => {
    expect([finalSmash.final, finalSmashAir.final]).toEqual([
      { freeze: 65, range: 97 },
      { freeze: 65, range: 97, still: true },
    ]);
    expect([finalSmash.air, finalSmash.commandGrab, finalSmashAir.commandGrab]).toEqual([
      'finalSmashAir',
      'finalSmashCinematic',
      'finalSmashCinematic',
    ]);
    for (const move of [finalSmash, finalSmashAir]) {
      expect(move.hits.map((w) => w.frames)).toEqual([[67, 77]]);
      expect(move.hits[0]!.boxes.map(({ id, x, y, radius, grab }) => ({ id, x, y, radius, grab }))).toEqual(
        [5, 7.5, 10].map((x, id) => ({ id, x, y: 6.5, radius: 7, grab: true })),
      );
    }
    // A whiff: 46 frames after the dash grounded, 37 in the air.
    expect([finalSmash.faf, finalSmashAir.faf]).toEqual([77 + 46 + 1, 77 + 37 + 1]);
    // The cinematic: the catch's 3% on its first frame, game_finalhit's 20 frames, scene 1's seven 3.8% hits, scene
    // 2's 7% finish, the launch after scene 2's 204 frames, actionable 20 frames after it.
    const scene1 = [100, 117, 134, 151, 168, 185, 195].map((f) => ({
      frame: 20 + f,
      damage: 3.8,
      hitlag: 0,
    }));
    expect(finalSmashCinematic.holdHits).toEqual([
      { frame: 1, damage: 3, hitlag: 0 },
      ...scene1,
      { frame: 20 + 200 + 93, damage: 7, hitlag: 0 },
    ]);
    expect(finalSmashCinematic.throw).toEqual({
      frame: 425,
      hit: { damage: 13, angle: 60, kbg: 100, bkb: 73 },
    });
    expect([finalSmashCinematic.faf, finalSmashCinematic.final]).toEqual([445, { still: true }]);
    const cinematic = finalSmashCinematic.holdHits!.slice(1).reduce((sum, h) => sum + h.damage, 0);
    expect(cinematic).toBeCloseTo(33.6, 9);
  });

  it('holds everyone else for 65 frames and catches nobody before frame 67, even standing in front of him', () => {
    const { m, a, v } = setup([-30, -24, 60]);
    const held = { x: v.pos.x, action: v.action };
    for (let i = 0; i < A.freeze; i++) {
      const seen = step(m, 1, [{}, { x: -100 }, {}]);
      expect(seen.some((e) => e.type === 'commandGrab')).toBe(false);
      expect({ x: v.pos.x, action: v.action }).toEqual(held);
    }
    expect(a.actionFrame).toBe(66);
    const seen = step(m, 1);
    expect([a.action, a.move]).toEqual(['grabThrow', 'finalSmashCinematic']);
    expect(seen.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
    ]);
  });

  it.each([
    [5, 67],
    [30, 69],
    [60, 72],
    [90, 76],
    [100, 77],
  ])('catches a foe %i units ahead on move frame %i, the dash still under way', (gap, frame) => {
    const { m, a } = setup([-50, -50 + gap, 75]);
    expect(playOut(m, a).caught).toBe(frame);
  });

  it(`reaches ${LIGHTS_OUT_RANGE} units ahead of his feet (80 dashed, the box out to 17) and to a body touching that`, () => {
    expect(LIGHTS_OUT_RANGE).toBe(97);
    const reach = LIGHTS_OUT_RANGE + BODY;
    for (const [gap, caught] of [
      [reach - 0.1, true],
      [reach + 0.1, false],
    ] as const) {
      const { m, a, v } = setup([-50, -50 + gap, 75]);
      const { caught: at } = playOut(m, a);
      expect([gap, at !== null, v.damage > 0]).toEqual([gap, caught, caught]);
    }
  });

  it('dashes 80 units over frames 68-77, slides out of a whiff and can act on frame 124', () => {
    const { m, a } = setup([-70, 75, 78]);
    const x0 = a.pos.x;
    step(m, DASH.from - 1);
    expect([a.actionFrame, a.pos.x]).toEqual([DASH.from, x0]);
    step(m, DASH.to - DASH.from);
    expect(a.actionFrame).toBe(DASH.to);
    expect(a.pos.x - x0).toBeCloseTo(80, 6);
    step(m, 20);
    // The slide: his run speed braked at 0.15 a frame, about 11 units.
    const slid = a.pos.x - x0 - 80;
    expect(slid).toBeGreaterThan(10);
    expect(slid).toBeLessThan(13);
    step(m, finalSmash.faf - a.actionFrame - 1);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', finalSmash.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it('stops at the ledge instead of dashing off it', () => {
    const { m, a } = setup([30, -60, -70]);
    playOut(m, a);
    expect(a.ground).not.toBe(null);
    expect(a.pos.x).toBeLessThanOrEqual(80);
    expect(a.pos.x).toBeGreaterThan(79);
  });

  it('holds the caught foe in front of him through the whole cinematic, mashing or not, and launches it on frame 425', () => {
    const { m, a, v } = setup([-30, -10, 60]);
    step(m, DASH.from - 1);
    expect([a.action, a.move, v.action]).toEqual(['grabThrow', 'finalSmashCinematic', 'grabbed']);
    const at = a.pos.x;
    const mash: Hold[] = [{}, { x: -100, buttons: ['attack', 'jump', 'shield'] }, {}];
    const damage: [number, number][] = [];
    while (a.grabPartner >= 0) {
      const before = v.damage;
      step(m, 1, a.actionFrame % 2 ? mash : [{}, { x: 100 }, {}]);
      if (v.damage !== before) damage.push([a.actionFrame, Math.round((v.damage - before) * 1000) / 1000]);
      if (a.grabPartner < 0) break;
      expect([v.action, v.grabPartner, a.pos.x]).toEqual(['grabbed', 0, at]);
      expect(v.pos.x - a.pos.x).toBeGreaterThan(0);
      expect(v.pos.x - a.pos.x).toBeLessThan(12);
    }
    expect(damage).toEqual([
      [1, 3],
      ...A.sceneHits.map((f): [number, number] => [SCENE.one + f, 3.8]),
      [SCENE.two + A.finishHit, 7],
      [SCENE.launch, 13 * 1.05],
    ]);
    expect(a.actionFrame).toBe(SCENE.launch);
    expect(v.launch).not.toBe(null);
    step(m, finalSmashCinematic.faf - SCENE.launch - 1);
    expect(a.move).toBe('finalSmashCinematic');
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it(`deals 50.25% in all (13% fresh x1.05), within 5 points of All-Out Attack's ${ULTIMATE_DAMAGE}%`, () => {
    const { m, a, v } = setup([-30, -10, 60]);
    playOut(m, a);
    expect(v.damage).toBeCloseTo(3 + 7 * 3.8 + 7 + 13 * 1.05, 9);
    expect(Math.abs(v.damage - ULTIMATE_DAMAGE)).toBeLessThanOrEqual(5);
  });

  it("launches with game_finalend's 13% at 60 degrees, BKB 73, KBG 100 on the % the cinematic left", () => {
    const { m, a } = setup([-30, -10, 60], 20);
    const { seen } = playOut(m, a);
    const thrown = seen.find((e) => e.type === 'throw');
    expect(thrown).toEqual({ type: 'throw', attacker: 0, victim: 1, move: 'finalSmashCinematic' });
    const kb = knockback({
      percent: 20 + 3 + 33.6,
      damage: 13,
      kbg: 100,
      bkb: 73,
      weight: marioReference.stats.weight,
      stale: 1.05,
      rage: 1,
    });
    const hits = seen.filter((e) => e.type === 'hit');
    expect(hits).toEqual([
      expect.objectContaining({ attacker: 0, victim: 1, move: 'finalSmashCinematic', hitlag: 0 }),
    ]);
    expect(hits[0]!.type === 'hit' && hits[0]!.kb).toBeCloseTo(kb, 6);
  });

  it(`KOs a Mario-weight foe at Battlefield's middle from about 62%, within 5 points of the ${ULTIMATE_KO}% instant KO`, () => {
    /** The KO calculators' rule (koPercent): KO'd when it crosses a blast zone before its hitstun ends. */
    const kos = (percent: number) => {
      const { m, a, v } = setup([-14, -4, 70], percent);
      if (playOut(m, a).seen.some((e) => e.type === 'ko' && e.port === 1)) return true;
      for (let i = 0; i < 300 && v.hitstun > 0; i++)
        if (step(m, 1).some((e) => e.type === 'ko' && e.port === 1)) return true;
      return false;
    };
    let [lo, hi] = [0, 150];
    expect(kos(hi)).toBe(true);
    while (hi - lo > 0.25) {
      const mid = (lo + hi) / 2;
      if (kos(mid)) hi = mid;
      else lo = mid;
    }
    expect(Math.abs(hi - ULTIMATE_KO)).toBeLessThanOrEqual(5);
    // The finisher on its own KOs from 98.8% there, where Ultimate's instant KO takes over at 100%.
    const alone = koPercent({ hit: finalSmashCinematic.throw!.hit, from: 'centre' })!;
    expect(Math.abs(alone - 100)).toBeLessThanOrEqual(5);
  }, 60_000);

  it('leaves everyone outside the catch untouched and held still until the release: behind him, past its reach, or second in line', () => {
    for (const [xs, who] of [
      [[-20, -10, -40], 'behind'],
      [[-60, -50, 60], 'out of reach'],
      [[-60, -50, -40], 'second in line'],
    ] as const) {
      const { m, a, v, w } = setup([...xs], 0);
      step(m, DASH.from - 1, [{}, {}, { x: -100 }]);
      expect([who, v.action, w.grabPartner]).toEqual([who, 'grabbed', -1]);
      const held = { ...w.pos, action: w.action };
      while (a.grabPartner >= 0) {
        step(m, 1, [{}, {}, { x: -100, buttons: ['attack'] }]);
        if (a.grabPartner >= 0) {
          expect(heldStill(m, w)).toBe(true);
          expect({ ...w.pos, action: w.action }).toEqual(held);
        }
      }
      expect([who, w.damage, w.grabPartner]).toEqual([who, 0, -1]);
      step(m, 2, [{}, {}, { x: -100 }]);
      expect(w.pos.x).not.toBe(held.x);
    }
  });

  it('catches through a shield: Final Smashes are unblockable', () => {
    const { m, a, v } = setup([-30, -10, 60], 0, false);
    const shield: Hold = { buttons: ['shield'] };
    step(m, 5, [{}, shield]);
    expect(v.action).toBe('shield');
    step(m, 1, [SPECIAL, shield]);
    const { caught, seen } = playOut(m, a, [{}, shield]);
    expect(caught).toBe(DASH.from);
    expect(seen.filter((e) => e.type === 'shieldHit' || e.type === 'parry')).toEqual([]);
  });

  it('in the air holds his height through the dash and the cinematic, then falls', () => {
    const { m, a, v } = setup([-50, 75, 78], 0, false);
    Object.assign(a, { pos: { x: -50, y: 40 }, prevPos: { x: -50, y: 40 }, ground: null, action: 'fall' });
    Object.assign(v, { pos: { x: -10, y: 38 }, prevPos: { x: -10, y: 38 }, ground: null, action: 'fall' });
    step(m, 1, [SPECIAL]);
    expect(a.move).toBe('finalSmashAir');
    const y = a.pos.y;
    let caught = false;
    for (let i = 0; i < 700 && a.move !== null; i++) {
      step(m, 1);
      caught ||= v.action === 'grabbed';
      if (a.move !== null) expect(a.pos.y).toBe(y);
    }
    expect(caught).toBe(true);
    expect(v.damage).toBeCloseTo(50.25, 6);
    expect(a.action).toBe('fall');
  });

  it('whiffs in the air on frame 115 and keeps his height until then', () => {
    const { m, a } = setup([-50, 75, 78], 0, false);
    Object.assign(a, { pos: { x: -50, y: 60 }, prevPos: { x: -50, y: 60 }, ground: null, action: 'fall' });
    step(m, 1, [SPECIAL]);
    step(m, finalSmashAir.faf - 2);
    expect([a.move, a.pos.y]).toEqual(['finalSmashAir', 60]);
    expect(a.pos.x - -50).toBeGreaterThan(80);
    step(m, 1);
    expect(a.action).toBe('fall');
  });

  it('puts the lights out on the cinematic frame 5 and back on with the launch, his eyes glowing in the dark', () => {
    const clip = art.clips.finalSmashCinematic!;
    expect([clip.length, clip.active]).toEqual([444, [[425, 425]]]);
    const symbols = (f: number) => samplePose(art, 'finalSmashCinematic', f, f).symbols;
    expect(symbols(SCENE.dark - 1).dark).toBeNull();
    for (let f = SCENE.dark; f < SCENE.launch; f++) expect(symbols(f).dark, `frame ${f}`).not.toBeNull();
    for (const f of [SCENE.launch, SCENE.launch + 10]) expect(symbols(f).dark).toBeNull();
    for (const f of [60, SCENE.one + A.sceneHits[0]!, SCENE.two + A.finishHit])
      expect(symbols(f).face, `frame ${f}`).toBe('face3qShadow');
  });
});

describe('CPUs and Lights Out', () => {
  it(`fire it with a foe inside its reach (${LIGHTS_OUT_RANGE} units ahead, 0.5 below to 13.5 above the feet)`, () => {
    expect(finalReach(ID)).toEqual({ ahead: 97, low: -0.5, high: 13.5 });
  });

  /** A level 9 CPU Bob (port 0) holding the charge, `gap` units from a Mario-weight foe that stands still. */
  function duel(gap: number) {
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: ID }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -gap / 2, 1],
      [opp, gap / 2, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    /** Run the CPU until it activates: the frame and the gap then, or null. */
    const play = (frames: number) => {
      for (let i = 0; i < frames; i++) {
        const ahead = (opp.pos.x - me.pos.x) * me.facing;
        stepMatch(m, [cpu.input(m), neutralInput()]);
        if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) return { frame: i, ahead };
      }
      return null;
    };
    return { m, me, opp, cpu, play };
  }

  it('use it at once on a foe 90 units ahead, and the dash catches it', () => {
    const { m, opp, cpu, play } = duel(90);
    const used = play(30);
    expect(used).not.toBe(null);
    expect(used!.frame).toBeLessThan(15);
    for (let i = 0; i < 100 && opp.action !== 'grabbed'; i++) stepMatch(m, [cpu.input(m), neutralInput()]);
    expect(opp.action).toBe('grabbed');
  });

  it('hold it while the foe is 150 away and use it only once inside the reach', () => {
    const used = duel(150).play(600);
    expect(used).not.toBe(null);
    expect(used!.frame).toBeGreaterThan(10);
    expect(used!.ahead).toBeLessThanOrEqual(LIGHTS_OUT_RANGE + 3);
  });
});
