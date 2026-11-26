import { Container, Graphics } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { createCpu } from '../../ai';
import { layerFighters } from '../../render/entities';
import { FighterView } from '../../render/fighterView';
import type { FighterArt } from '../../render/rig/types';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { finalReach, freezeOf } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { noFinalTester } from '../../sim/testing/finalSmash';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { samplePose } from '../../render/rig/sample';
import { getFighter, registerFighter } from '../registry';
import { art, lyingArt } from './art';
import { TOPPLED } from './art/finalSmash';
import { LEVEL_TILES } from './art/rig';
import { BARRAGE, REACH, SPLIT, finalSmash, finalSmashCinematic } from './finalSmash';
import { LYING, STANDING } from './tip';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };
const MARIO = marioReference.id;
const BLOCK_X = -40;
/** Where the engine holds a Mario-width catch: half of both widths plus GRAB.holdGap (1). */
const HELD = (12 + marioReference.stats.width) / 2 + 1;
/** Jungle Rush's final hit, the analogue's launch. */
const ANALOGUE = { damage: 14, angle: 70, kbg: 96, bkb: 90 };
/** Every hit before the launch: the punch and the barrage, 12 + 18 x 1.2 + 13 x 1.1. */
const BEFORE_LAUNCH = 12 + 18 * 1.2 + 13 * 1.1;

/**
 * The block at x -40 facing right in `form` with the charge, a Mario-weight foe `gap` units in front at `percent`,
 * and a third fighter at `third` (three players: no 1v1 damage multiplier), all settled on Battlefield.
 */
function splitMatch(
  gap: number,
  {
    percent = 0,
    third = 70,
    form = STANDING,
    foe = MARIO,
  }: { percent?: number; third?: number; form?: string; foe?: string } = {},
): { m: MatchState; a: FighterState; v: FighterState; w: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: STANDING }, { fighter: foe }, { fighter: MARIO }],
  });
  const xs = [BLOCK_X, BLOCK_X + gap, third];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i ? -1 : 1 });
  });
  step(m, 30);
  const [a, v, w] = m.fighters as [FighterState, FighterState, FighterState];
  for (const f of m.fighters) expect(f.action).toBe('idle');
  a.fighter = form;
  v.damage = percent;
  a.finalReady = true;
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

/** Step until `done` holds (at most `limit` frames); returns the events seen on the way. */
function stepUntil(m: MatchState, done: () => boolean, limit = 500): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < limit && !done(); i++) seen.push(...step(m, 1));
  return seen;
}

const hitsOn = (seen: SimEvent[], port: number) =>
  seen.filter((e) => (e.type === 'hit' || e.type === 'pummel') && e.victim === port);

/** Fires it and runs it to the end: the damage the foe took on each cinematic frame it took some. */
function damageMarks(m: MatchState, a: FighterState, v: FighterState): [number, number][] {
  step(m, 1, [SPECIAL]);
  stepUntil(m, () => a.move === 'finalSmashCinematic');
  const marks: [number, number][] = [];
  for (let i = 0; i < 400 && a.move === 'finalSmashCinematic'; i++) {
    const before = v.damage;
    step(m, 1);
    if (v.damage !== before) marks.push([a.actionFrame, Math.round((v.damage - before) * 1000) / 1000]);
  }
  return marks;
}

describe('Split Switch (Final Smash), on Jungle Rush', () => {
  it("takes Jungle Rush's timing: the punch on 29-34 after a 27-frame hold, 99 frames on a miss, a 209-frame cinematic", () => {
    expect(finalSmash.final).toEqual({ freeze: 27, still: true });
    expect(freezeOf(finalSmash.final!)).toBe(SPLIT.catch[0] - 2);
    expect(finalSmash.hits.map((w) => w.frames)).toEqual([[29, 34]]);
    expect(finalSmash.faf).toBe(99 + 1);
    expect(finalSmash.commandGrab).toBe('finalSmashCinematic');
    expect(finalSmashCinematic.final).toEqual({ still: true });
    expect(finalSmashCinematic.faf).toBe(209 + 1);
    expect(finalSmashCinematic.holdHits!.map((h) => h.frame)).toEqual([
      1, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 79, 83, 87, 91, 95, 99, 103,
      107, 111, 115, 119, 123, 127,
    ]);
    expect(finalSmashCinematic.throw!.frame).toBe(139);
  });

  it("catches with the punch's box, radius 13 from 8 to 28 in front at 10 up: 41 units ahead, from both forms", () => {
    const boxes = finalSmash.hits[0]!.boxes;
    expect(boxes.map((b) => b.x)).toEqual([8, 18, 28]);
    for (const b of boxes) expect([b.y, b.radius, b.grab, b.damage]).toEqual([10, 13, true, 0]);
    expect(REACH).toBe(41);
    for (const form of [STANDING, LYING]) expect(finalReach(form)).toEqual({ ahead: 41, low: -3, high: 23 });
  });

  it('catches a foe 40 units in front on frame 29, not before, and nobody 60 units away', () => {
    const near = splitMatch(40);
    step(near.m, 1, [SPECIAL]);
    expect([near.a.move, near.a.finalReady]).toEqual(['finalSmash', false]);
    let seen = step(near.m, 27);
    expect(near.a.actionFrame).toBe(28);
    expect(seen.some((e) => e.type === 'commandGrab' || e.type === 'hit')).toBe(false);
    seen = step(near.m, 1);
    expect(seen.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
    ]);
    expect([near.a.action, near.a.move, near.v.action]).toEqual([
      'grabThrow',
      'finalSmashCinematic',
      'grabbed',
    ]);

    const far = splitMatch(60);
    step(far.m, 1, [SPECIAL]);
    seen = step(far.m, finalSmash.faf + 10);
    expect(seen.some((e) => e.type === 'commandGrab')).toBe(false);
    expect(hitsOn(seen, 1)).toEqual([]);
    expect(far.v.damage).toBe(0);
  });

  it('traps the nearest foe in reach and leaves a second one in reach alone, as the engine holds one', () => {
    const { m, a, v, w } = splitMatch(20, { third: BLOCK_X + 35 });
    step(m, 1, [SPECIAL]);
    const seen = stepUntil(m, () => a.move === null);
    expect(seen.filter((e) => e.type === 'commandGrab')).toEqual([
      { type: 'commandGrab', attacker: 0, victim: 1, move: 'finalSmash' },
    ]);
    expect(v.damage).toBeGreaterThan(60);
    expect(hitsOn(seen, 2)).toEqual([]);
    expect(w.damage).toBe(0);
  });

  it("deals Jungle Rush's damage on its frames: the 12% punch, 18 hits of 1.2%, 13 of 1.1%, then 14% on 139, 62.6% in all", () => {
    const { m, a, v } = splitMatch(30);
    const marks = damageMarks(m, a, v);
    expect(marks).toEqual([
      [1, 12],
      ...BARRAGE.fast.map((f) => [f, 1.2]),
      ...BARRAGE.late.map((f) => [f, 1.1]),
      [139, 14.7],
    ]);
    expect(v.damage).toBeCloseTo(BEFORE_LAUNCH + 14 * 1.05, 6);
    // Jungle Rush's own total: 12 + 18 x 1.2 + 13 x 1.1 + 14 = 61.9.
    expect(Math.abs(v.damage - 61.9)).toBeLessThanOrEqual(5);
    const holds = finalSmashCinematic.holdHits!;
    expect(holds[0]).toEqual({ frame: 1, damage: 12, hitlag: 5 });
    for (const h of holds.slice(1)) expect(h.hitlag).toBe(0.4);
    expect(finalSmashCinematic.throw!.hit).toEqual({ ...ANALOGUE, hitlag: 1 });
  });

  it("launches with Jungle Rush's final hit: KOs Mario from 76.7% on the launch, within 5 of the analogue, so from about 29% before it", () => {
    const move = { fighter: STANDING, move: 'finalSmashCinematic' };
    for (const from of ['ledge', 'centre'] as const) {
      const ours = koPercent({ hit: move, from })!;
      expect(Math.abs(ours - koPercent({ hit: ANALOGUE, from })!)).toBeLessThanOrEqual(5);
      expect(ours).toBeGreaterThanOrEqual(75);
      expect(ours).toBeLessThanOrEqual(79);
    }
    const ko = (percent: number) => {
      const { m, a, v } = splitMatch(20, { percent });
      step(m, 1, [SPECIAL]);
      return stepUntil(m, () => a.move === null || v.action === 'ko').some(
        (e) => e.type === 'ko' && e.port === v.port,
      );
    };
    expect(76.7 - BEFORE_LAUNCH).toBeCloseTo(28.8, 6);
    expect(ko(32)).toBe(true);
    expect(ko(25)).toBe(false);
  });

  it('holds everyone else still and untouched through the cinematic: a fighter out of reach and one behind', () => {
    for (const third of [BLOCK_X + 100, BLOCK_X - 20]) {
      const { m, a, w } = splitMatch(20, { third });
      step(m, 1, [SPECIAL]);
      const seen = stepUntil(m, () => a.move === 'finalSmashCinematic');
      const at = { ...w.pos };
      for (let i = 0; i < 400 && a.grabPartner >= 0; i++) {
        seen.push(...step(m, 1, [{}, {}, { x: third > BLOCK_X ? -100 : 100, buttons: ['attack'] }]));
        if (a.grabPartner >= 0) expect([w.pos, w.action]).toEqual([at, 'idle']);
      }
      expect(a.actionFrame).toBe(BARRAGE.finish);
      expect(hitsOn(seen, 2)).toEqual([]);
      expect(w.damage).toBe(0);
    }
  });

  it('slides the catch in at 1.5 units a frame, near or far, and has it in place before the cubes split on frame 2', () => {
    expect(finalSmashCinematic.pull).toBe(BARRAGE.pull);
    expect(BARRAGE.pull).toBe(1.5);
    // Mario next to the block, Mario at the farthest a standing one is caught (45 out), and the farthest catch on the
    // roster: the Duck 42 out and 15 up.
    for (const { foe, gap, up } of [
      { foe: MARIO, gap: 12, up: 0 },
      { foe: MARIO, gap: 45, up: 0 },
      { foe: 'duck', gap: 42, up: 15 },
    ]) {
      const { m, a, v } = splitMatch(gap, { foe });
      step(m, 1, [SPECIAL]);
      step(m, SPLIT.catch[0] - 3);
      if (up)
        Object.assign(v, {
          pos: { x: v.pos.x, y: up },
          prevPos: { x: v.pos.x, y: up },
          vel: { x: 0, y: 0 },
          ground: null,
          action: 'fall',
        });
      const held = { x: BLOCK_X + (12 + getFighter(foe).stats.width) / 2 + 1, y: a.pos.y };
      let from = { ...v.pos };
      let far = 0;
      let steps = 0;
      while (a.move !== 'finalSmashCinematic' || a.actionFrame < 2) {
        step(m, 1);
        if (v.action === 'grabbed') {
          far ||= Math.hypot(from.x - held.x, from.y - held.y);
          expect(Math.hypot(v.pos.x - from.x, v.pos.y - from.y), `${foe} ${gap}`).toBeLessThanOrEqual(
            BARRAGE.pull + 1e-9,
          );
          steps++;
        }
        from = { ...v.pos };
        expect(steps).toBeLessThan(60);
      }
      expect([v.pos.x, v.pos.y, v.ground !== null], `${foe} ${gap}`).toEqual([held.x, held.y, true]);
      if (gap > 40) expect(far, `${foe} ${gap}`).toBeGreaterThan(33);
    }
  });

  it('holds the catch in front of the block from the split to the fling, whatever it mashes', () => {
    const { m, a, v } = splitMatch(45);
    step(m, 1, [SPECIAL]);
    stepUntil(m, () => a.move === 'finalSmashCinematic' && a.actionFrame >= 2);
    for (let f = 0; a.actionFrame < BARRAGE.finish; f++) {
      step(m, 1, [{}, { x: f % 2 ? 100 : -100, buttons: f % 3 ? ['attack', 'jump'] : ['shield'] }]);
      if (a.actionFrame < BARRAGE.finish) expect([v.action, v.pos.x]).toEqual(['grabbed', BLOCK_X + HELD]);
    }
  });

  it('stands a lying block up on frame 4, then plays the same punch and cinematic', () => {
    const { m, a, v } = splitMatch(30, { form: LYING });
    step(m, 1, [SPECIAL]);
    expect([a.fighter, a.move]).toEqual([LYING, 'finalSmash']);
    step(m, 2);
    expect([a.fighter, a.actionFrame]).toEqual([LYING, 3]);
    step(m, 1);
    expect([a.fighter, a.actionFrame]).toEqual([STANDING, 4]);
    stepUntil(m, () => a.move === 'finalSmashCinematic');
    expect(a.fighter).toBe(STANDING);
    stepUntil(m, () => a.move === null);
    expect([a.action, a.fighter]).toEqual(['idle', STANDING]);
    expect(v.damage).toBeCloseTo(BEFORE_LAUNCH + 14 * 1.05, 6);
  });

  it('catches a shielding foe: the punch is a grab and the Final Smash is unblockable', () => {
    const { m, a, v } = splitMatch(25);
    step(m, 1, [SPECIAL, { buttons: ['shield'] }]);
    const seen = stepUntil(m, () => a.move !== 'finalSmash');
    expect(seen.filter((e) => e.type === 'shieldHit' || e.type === 'parry')).toEqual([]);
    expect([a.move, v.action]).toEqual(['finalSmashCinematic', 'grabbed']);
  });

  it('plays all 99 frames on a miss, then lets the block act', () => {
    const { m, a } = splitMatch(90);
    step(m, 1, [SPECIAL]);
    step(m, finalSmash.faf - 2);
    expect([a.action, a.move, a.actionFrame]).toEqual(['attack', 'finalSmash', finalSmash.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
  });

  it('holds still in the air through the punch and the cinematic, and still traps a foe in reach', () => {
    const { m, a, v } = splitMatch(30);
    for (const f of [a, v])
      Object.assign(f, {
        pos: { x: f.pos.x, y: 50 },
        prevPos: { x: f.pos.x, y: 50 },
        ground: null,
        action: 'fall',
      });
    step(m, 1, [SPECIAL]);
    const at = { ...a.pos };
    let caught = false;
    for (let i = 0; i < 500 && a.move !== null; i++) {
      step(m, 1, [{ x: 100, y: -100 }]);
      caught ||= v.action === 'grabbed';
      if (a.move !== null) expect(a.pos).toEqual(at);
    }
    expect(caught).toBe(true);
    expect(v.damage).toBeCloseTo(BEFORE_LAUNCH + 14 * 1.05, 6);
  });

  it('has a clip for each move in both forms on its frame data: the punch on 29-34, the fling on 139', () => {
    for (const a of [art, lyingArt]) {
      expect(a.clips.finalSmash?.length).toBe(finalSmash.faf - 1);
      expect(a.clips.finalSmash?.active).toEqual([[29, 34]]);
      expect(a.clips.finalSmashCinematic?.length).toBe(finalSmashCinematic.faf - 1);
      expect(a.clips.finalSmashCinematic?.active).toEqual([[139, 139]]);
    }
    // Lying, the block turns up onto its end by frame 4 (its standing turn is 0 from there on).
    const turn = (f: number) => {
      const p = samplePose(lyingArt, 'finalSmash', f, f);
      return p.local.pivot!.rot + p.local.block!.rot;
    };
    expect(Math.abs(turn(0) % 180)).toBeCloseTo(90, 5);
    expect(turn(SPLIT.standUp) % 180).toBeCloseTo(0, 5);
  });

  it('draws the level only in the cinematic: tiles up from frame 2, the cubes through the barrage, all gone by the end', () => {
    const shown = (clip: string, f: number) => {
      const p = samplePose(art, clip, f, f);
      return {
        tiles: LEVEL_TILES.filter((t) => p.symbols[t]).length,
        cubes: [p.symbols.cubeA, p.symbols.cubeB].filter(Boolean).length,
        block: (p.symbols.face ?? p.symbols.faceUnder) !== null,
      };
    };
    for (let f = 0; f < finalSmash.faf; f++) expect(shown('finalSmash', f).tiles).toBe(0);
    expect(shown('finalSmashCinematic', 1)).toEqual({ tiles: 0, cubes: 0, block: true });
    expect(shown('finalSmashCinematic', 30)).toEqual({ tiles: 12, cubes: 2, block: false });
    for (const f of [...BARRAGE.fast, ...BARRAGE.late]) expect(shown('finalSmashCinematic', f).cubes).toBe(2);
    expect(shown('finalSmashCinematic', BARRAGE.finish)).toEqual({ tiles: 12, cubes: 0, block: true });
    expect(shown('finalSmashCinematic', BARRAGE.faf - 1)).toEqual({ tiles: 0, cubes: 0, block: true });
  });

  it("draws the foe over the toppled block from the topple to the split, and the cubes and tiles over it after, in the renderer's layer order", () => {
    // The foe is the Final Smash tester without one, as in Runner's tunnel test: Fireboy's rig, like the block's, has
    // gradients, which Pixi builds only on a browser canvas. The block's own art goes in with its gradients flattened.
    const flat: FighterArt = {
      ...art,
      rig: {
        ...art.rig,
        symbols: Object.fromEntries(
          Object.entries(art.rig.symbols).map(([name, sym]) => [
            name,
            Array.isArray(sym)
              ? sym.map((p) => (typeof p.fill === 'object' ? { ...p, fill: p.fill.stops[0]!.color } : p))
              : sym,
          ]),
        ),
      },
    };
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: STANDING }, { fighter: noFinalTester.id }, { fighter: MARIO }],
    });
    m.fighters.forEach((f, i) => {
      const x = [BLOCK_X, BLOCK_X + 30, 70][i]!;
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
      Object.assign(f, { action: 'fall', actionFrame: 1, facing: i ? -1 : 1 });
    });
    step(m, 30);
    // The renderer's world, fighters' part: the under layer, then the raft layer, then the fighter layer.
    const views = [
      new FighterView({ ...getFighter(STANDING), art: flat }, 0, 'default', true),
      new FighterView(getFighter(noFinalTester.id), 1, 'default', true),
    ] as const;
    const under = new Container();
    const boat = new Container({ sortableChildren: true });
    const rest = new Container({ sortableChildren: true });
    const world = new Container();
    world.addChild(under, boat, rest);
    for (const view of views) under.addChild(view.under);
    /** The visible drawings under `root` in the order Pixi draws them. */
    const drawn = (root: Container): Graphics[] => {
      if (!root.visible) return [];
      if (root instanceof Graphics) return root.context.instructions.length ? [root] : [];
      const kids = root.sortableChildren
        ? [...root.children].sort((p, q) => p.zIndex - q.zIndex)
        : root.children;
      return kids.flatMap((c) => drawn(c));
    };
    const [block, foe] = views;
    const [a, v] = m.fighters as [FighterState, FighterState];
    a.finalReady = true;
    step(m, 1, [SPECIAL]);
    let toppled = 0;
    let split = 0;
    while (a.move !== null) {
      m.fighters.slice(0, 2).forEach((f, i) => views[i]!.update(f, 1, m.frame, false));
      layerFighters(
        m,
        views.map((view) => view.container),
        boat,
        rest,
      );
      const order = drawn(world);
      const at = (gs: Graphics[]) => gs.map((g) => order.indexOf(g));
      const foeAt = at(drawn(foe.container));
      const lying = drawn(block.under);
      const own = drawn(block.container);
      const label = `${a.move}@${a.actionFrame}`;
      const cinematic = a.move === 'finalSmashCinematic';
      if (cinematic ? a.actionFrame < 2 : a.actionFrame >= TOPPLED[0]) {
        // The block lies under the foe; only its dust and the punch's spark go over.
        expect(lying.length, label).toBe(2);
        expect(Math.max(...at(lying)), label).toBeLessThan(Math.min(...foeAt));
        if (cinematic) toppled++;
      } else if (cinematic && a.actionFrame < BARRAGE.finish) {
        // Split: the cubes and the tiles draw over the foe, and nothing of the block goes under it.
        expect(lying, label).toEqual([]);
        expect(own.length, label).toBeGreaterThan(4);
        expect(Math.min(...at(own)), label).toBeGreaterThan(Math.max(...foeAt));
        split++;
      }
      step(m, 1);
    }
    expect(v.damage).toBeGreaterThan(60);
    // The catch frame, the punch's frame and its 30 frames of hitlag; then every barrage frame and its hitlag.
    expect(toppled).toBe(32);
    expect(split).toBe(BARRAGE.finish - 2 + 31 * 2);
  });

  it('keeps the numbers the art reads in a module the art can load first', async () => {
    vi.resetModules();
    const { art: fresh } = await import('./art');
    expect(fresh.clips.finalSmash?.length).toBe(SPLIT.faf - 1);
    const registry = await import('../registry');
    expect(registry.getFighter(STANDING).moves?.finalSmash?.faf).toBe(SPLIT.faf);
  });

  it('lets a CPU fire it at an opponent in reach (finalReach), at once, and trap it', () => {
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: STANDING }, { fighter: MARIO }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -25, 1],
      [opp, 5, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    step(m, 20);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let used = -1;
    for (let i = 0; i < 30 && used < 0; i++) {
      stepMatch(m, [cpu.input(m), input()]);
      if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) used = i;
    }
    expect(used).toBeGreaterThanOrEqual(0);
    expect(used).toBeLessThan(15);
    expect(me.move).toBe('finalSmash');
    stepUntil(m, () => me.move !== 'finalSmash');
    expect([me.move, opp.action]).toEqual(['finalSmashCinematic', 'grabbed']);
  });
});
