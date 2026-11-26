import { describe, expect, it } from 'vitest';
import { neutralInput } from '../../input/types';
import { createCpu } from '../../ai';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { statusOf } from '../../sim/statuses';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { viewFlip } from '../../render/viewFlip';
import { registerFighter } from '../registry';
import { art } from './art';
import { RINGS, STUCK, finalSmash, statuses } from './finalSmash';
import { TUNNEL_FLIP } from './timing';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };
const F = TUNNEL_FLIP;

type Hit = Extract<SimEvent, { type: 'hit' }>;

/**
 * Runner at `at` facing right and Mario-weight fighters standing at `xs`, all landed on Battlefield (three or more
 * players: no 1v1 damage multiplier). `prep` runs just before Runner presses neutral special with the charge, on the
 * move's frame 1. Mario's hurtbox is 4 units in radius, so a fighter `d` units away is inside a ring of radius d - 4.
 */
function flipMatch(
  at: number,
  xs: number[],
  prep: (m: MatchState) => void = () => {},
  holds: Hold[] = [],
): { m: MatchState; r: FighterState; vs: FighterState[]; seen: SimEvent[] } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'runner' }, ...xs.map(() => ({ fighter: marioReference.id }))],
  });
  [at, ...xs].forEach((x, i) => {
    const f = m.fighters[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 0 || x < at ? 1 : -1 });
  });
  step(m, 30);
  const [r, ...vs] = m.fighters as [FighterState, ...FighterState[]];
  r.finalReady = true;
  prep(m);
  const seen = step(m, 1, [SPECIAL, ...holds]);
  return { m, r, vs, seen };
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

/** Steps until Runner's move reaches `frame`, collecting the events. */
function stepTo(m: MatchState, r: FighterState, frame: number, holds: Hold[] = []): SimEvent[] {
  return step(m, frame - r.actionFrame, holds);
}

const hits = (seen: SimEvent[]) => seen.filter((e): e is Hit => e.type === 'hit');

describe('Tunnel Flip (Final Smash), on Peach Blossom', () => {
  it("takes Peach Blossom's timing: hit 40-61, clean sleep 62-140, late sleep 141-230, actionable on 248", () => {
    expect(finalSmash.faf).toBe(248);
    expect(finalSmash.air).toBeUndefined();
    expect(finalSmash.final).toEqual({ freeze: 38, still: true, range: 25 });
    expect(finalSmash.hits.map((w) => [w.frames, w.rehit ?? false])).toEqual([
      [[40, 61], false],
      [[62, 140], true],
      [[141, 230], false],
    ]);
    // The activation hold ends on frame 39, so the hit comes out on Peach Blossom's frame 40.
    expect(finalSmash.final!.freeze! + 2).toBe(40);
  });

  it("deals Peach Blossom's 30%, 20% and 10% by distance with no knockback, and puts on its sleep lengths", () => {
    const [damage, clean, late] = finalSmash.hits.map((w) => w.boxes);
    expect(damage!.map((b) => [b.id, b.x, b.y, b.radius, b.damage, b.angle, b.bkb, b.kbg, b.hitlag])).toEqual(
      [
        [0, 0, 5, 25, 30, 361, 0, 0, 0],
        [1, 0, 5, 50, 20, 361, 0, 0, 0],
        [2, 0, 5, 100, 10, 361, 0, 0, 0],
      ],
    );
    const sleep = (boxes: typeof damage) =>
      boxes!.map((b) => [b.id, b.radius, b.damage, b.bkb, b.kbg, b.targets ?? 'both', b.status]);
    expect(sleep(clean)).toEqual([
      [4, 25, 0, 0, 0, 'both', STUCK.near],
      [5, 50, 0, 0, 0, 'both', STUCK.mid],
      [6, 100, 0, 0, 0, 'ground', STUCK.far],
    ]);
    expect(sleep(late)).toEqual([
      [4, 25, 0, 0, 0, 'both', STUCK.nearLate],
      [5, 50, 0, 0, 0, 'ground', STUCK.mid],
      [6, 100, 0, 0, 0, 'ground', STUCK.far],
    ]);
    // Peach Blossom's sleep values (3.0.0): 230, 130, 100 clean and 200, 130, 100 late, in frames here.
    expect(Object.values(statuses).map((s) => s.frames)).toEqual([230, 200, 130, 100]);
    expect(RINGS.map((r) => [r.clean, r.late])).toEqual([
      [230, 200],
      [130, 130],
      [100, 100],
    ]);
    for (const s of Object.values(statuses)) {
      expect([s.freeze, s.endOnHit]).toEqual([true, true]);
      expect(s.mash).toEqual({ stick: 8, button: 14.4 });
    }
  });

  it('hits everyone within 100 units on frame 40 by ring, through shields, and never Runner', () => {
    const shield: Hold = { buttons: ['shield'] };
    // 15, 40 and 80 units from her: inside the 25, 50 and 100 rings. The near one shields.
    const { m, r, vs } = flipMatch(-40, [-25, 0, 40], () => {}, [shield]);
    expect(vs[0]!.action).toBe('shield');
    const before = stepTo(m, r, F.hit[0] - 1, [{}, shield]);
    expect(hits(before)).toEqual([]);
    const seen = step(m, 1, [{}, shield]);
    expect(r.actionFrame).toBe(40);
    expect(seen.filter((e) => e.type === 'shieldHit')).toEqual([]);
    // Each ring's damage, fresh (x1.05, as every move's first use).
    expect(hits(seen).map((e) => [e.victim, e.kb, e.hitlag])).toEqual([
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ]);
    vs.forEach((v, i) => expect(v.damage).toBeCloseTo(RINGS[i]!.damage * 1.05, 6));
    expect(r.damage).toBe(0);
  });

  it('misses anyone further than the 100 ring, in front or behind, and leaves them free', () => {
    // 108 units away, in front and then behind: just past the far ring's edge (radius 100, Mario's hurtbox 4).
    for (const [at, x] of [
      [-63, 45],
      [45, -63],
    ] as const) {
      const { m, r, vs } = flipMatch(at, [x, x + 20 * Math.sign(x - at)]);
      const seen = stepTo(m, r, F.faf - 1);
      expect(hits(seen), `${at} -> ${x}`).toEqual([]);
      expect(vs.map((v) => [v.damage, v.statuses])).toEqual([
        [0, []],
        [0, []],
      ]);
    }
  });

  it('leaves each ring stuck for its sleep length from frame 62; only the near ring is still stuck when she acts', () => {
    const { m, r, vs } = flipMatch(-40, [-25, 0, 40]);
    stepTo(m, r, F.clean[0] - 1);
    expect(vs.map((v) => v.statuses)).toEqual([[], [], []]);
    const seen = step(m, 1);
    expect(hits(seen).map((e) => [e.victim, e.damage])).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    const kinds = [STUCK.near, STUCK.mid, STUCK.far];
    expect(vs.map((v, i) => statusOf(v, kinds[i]!)?.frames)).toEqual([230, 130, 100]);
    const at = vs.map((v) => ({ ...v.pos }));
    // The far ring wakes 100 frames on, the middle 130 on; the near ring holds past frame 248.
    const ended = new Map<number, number>();
    for (let f = F.clean[0] + 1; f <= F.faf; f++) {
      for (const e of step(m, 1)) if (e.type === 'statusEnd') ended.set(e.port, r.actionFrame);
      vs.forEach((v, i) => {
        if (statusOf(v, kinds[i]!)) expect(v.pos, `${i}@${f}`).toEqual(at[i]);
      });
    }
    expect([ended.get(3), ended.get(2), ended.get(1)]).toEqual([62 + 100, 62 + 130, undefined]);
    expect(r.action).toBe('idle');
    expect(statusOf(vs[0]!, STUCK.near)?.frames).toBe(230 - (F.faf - 62));
    // Nobody caught in the clean window is caught again by the late one.
    expect(vs.map((v) => v.statuses.map((s) => s.kind))).toEqual([[STUCK.near], [], []]);
  });

  it('catches a fighter that comes into the near ring in the late window, with its shorter 200-frame sleep', () => {
    // 110 units off, outside every ring until it comes in after the clean window.
    const { m, r, vs } = flipMatch(-40, [70, -78]);
    const v = vs[0]!;
    stepTo(m, r, F.late[0] - 1);
    expect([v.damage, v.statuses]).toEqual([0, []]);
    Object.assign(v, { pos: { x: -25, y: 0 }, prevPos: { x: -25, y: 0 } });
    step(m, 1);
    expect(statusOf(v, STUCK.nearLate)?.frames).toBe(200);
    expect(v.damage).toBe(0);
  });

  it('holds an airborne fighter in the near ring where it is, and leaves one in the far ring free (ground only)', () => {
    const { m, r, vs } = flipMatch(-40, [-25, 30]);
    stepTo(m, r, F.clean[0] - 2);
    for (const [v, x] of [
      [vs[0]!, -25],
      [vs[1]!, 30],
    ] as const)
      Object.assign(v, { pos: { x, y: 10 }, prevPos: { x, y: 10 }, vel: { x: 0, y: 0 }, ground: null });
    step(m, 2);
    expect(r.actionFrame).toBe(62);
    expect(statusOf(vs[0]!, STUCK.near)).toBeDefined();
    expect(vs[1]!.statuses).toEqual([]);
    const y = vs[0]!.pos.y;
    step(m, 60);
    expect(vs[0]!.pos.y).toBe(y);
    expect(vs[1]!.ground).not.toBe(null);
  });

  it('lets a stuck fighter mash out: 8 frames a new stick direction, 14.4 a button press', () => {
    const { m, r, vs } = flipMatch(-40, [-28, -20]);
    stepTo(m, r, F.clean[0]);
    const [calm, masher] = vs as [FighterState, FighterState];
    const left = () => [statusOf(calm, STUCK.near)!.frames, statusOf(masher, STUCK.near)!.frames];
    expect(left()).toEqual([230, 230]);
    step(m, 1, [{}, {}, { x: 100 }]);
    step(m, 1, [{}, {}, { x: -100, buttons: ['attack'] }]);
    expect(left()).toEqual([228, 228 - 8 - 8 - 14.4]);
  });

  it("wakes a stuck fighter with the hit that lands on it, and Runner's forward smash then launches it", () => {
    const { m, r, vs } = flipMatch(-40, [-28, 40]);
    const v = vs[0]!;
    stepTo(m, r, F.faf - 1);
    expect(statusOf(v, STUCK.near)).toBeDefined();
    step(m, 1);
    expect(r.action).toBe('idle');
    const seen = [...step(m, 1, [{ cx: 100 }]), ...step(m, 20)];
    const fsmash = hits(seen).find((e) => e.move === 'fsmash' && e.victim === v.port);
    expect(fsmash).toBeDefined();
    expect(seen).toContainEqual(expect.objectContaining({ type: 'statusEnd', port: v.port, reason: 'hit' }));
    step(m, 30);
    expect(v.statuses).toEqual([]);
    expect(Math.hypot(v.pos.x + 28, v.pos.y)).toBeGreaterThan(10);
  });

  it('never KOs by itself, as Peach Blossom (BK 0, KS 0) never does', () => {
    for (const box of [0, 1, 2]) {
      const hit = { damage: RINGS[box]!.damage, angle: 361, kbg: 0, bkb: 0 };
      expect(koPercent({ hit }), `ring ${box}`).toBe(null);
    }
    expect(koPercent({ hit: { fighter: 'runner', move: 'finalSmash' } })).toBe(null);
  });

  it('in the air holds still through the move and falls on frame 248', () => {
    const { m, r } = flipMatch(-40, [40, 60], (m) => {
      const a = m.fighters[0]!;
      Object.assign(a, { pos: { x: -40, y: 40 }, prevPos: { x: -40, y: 40 }, ground: null, action: 'fall' });
    });
    expect(r.move).toBe('finalSmash');
    const at = { ...r.pos };
    stepTo(m, r, F.faf - 1);
    expect(r.pos).toEqual(at);
    step(m, 1);
    expect(r.action).toBe('fall');
  });

  it('holds everyone else through the activation, 38 frames, so the zoom ends as the tunnel starts to turn', () => {
    const { m, r, seen } = flipMatch(-40, [0, 40]);
    expect(seen).toContainEqual(expect.objectContaining({ type: 'finalSmash', port: 0, freeze: 38 }));
    expect(FINAL_SMASH.freeze).toBe(40);
    const v = m.fighters[1]!;
    step(m, 37);
    expect([r.actionFrame, m.finalHold?.fighters]).toEqual([38, [1, 2]]);
    step(m, 1);
    expect(r.actionFrame).toBe(39);
    expect(m.finalHold).toBeUndefined();
    expect(v.hitlag).toBe(0);
  });

  it('turns the view upside down over frames 40-61, holds it to 230, and is upright again on 247 and after', () => {
    expect(art.viewFlips).toEqual({ finalSmash: { turn: [40, 61], back: [231, 247] } });
    const { m, r } = flipMatch(-40, [0, 40]);
    const scale = new Map<number, number>();
    for (let f = 1; f <= F.faf + 20; f++) {
      if (f > 1) step(m, 1);
      scale.set(f, viewFlip(m));
      if (f < F.faf) expect([r.move, r.actionFrame]).toEqual(['finalSmash', f]);
    }
    const turned = [...scale].filter(([, s]) => s !== 1).map(([f]) => f);
    expect([turned[0], turned.at(-1)]).toEqual([40, 246]);
    for (let f = 61; f <= 230; f++) expect(scale.get(f), `${f}`).toBe(-1);
    for (const f of [39, 247, F.faf, F.faf + 20]) expect(scale.get(f), `${f}`).toBe(1);
    expect(r.action).toBe('idle');
  });

  it('has a clip on its frame data with the tunnel drawn in her rig', () => {
    const clip = art.clips.finalSmash!;
    expect(clip.length).toBe(F.faf - 1);
    expect(clip.active).toEqual([F.hit, F.clean, F.late]);
    expect(art.rig.symbols.tunnel).toBeDefined();
    expect(art.rig.symbols.tunnelFaint).toBeDefined();
    const shown = (f: number) => clip.keys.filter((k) => k.frame <= f && k.swaps).at(-1)?.swaps?.fxUnder;
    expect([shown(39), shown(40), shown(61), shown(70), shown(231), shown(247)]).toEqual([
      undefined,
      'tunnel',
      'tunnel',
      undefined,
      'tunnelFaint',
      undefined,
    ]);
  });

  it('lets CPUs use it once an opponent is inside the near ring in front', () => {
    expect(finalReach('runner')).toEqual({ ahead: 25, low: -95, high: 105 });
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'runner' }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -60, 1],
      [opp, 0, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let gap: number | null = null;
    for (let i = 0; i < 600 && gap === null; i++) {
      const ahead = (opp.pos.x - me.pos.x) * me.facing;
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) gap = ahead;
    }
    expect(gap).not.toBe(null);
    expect(gap!).toBeLessThanOrEqual(25 + 3);
    expect(me.move).toBe('finalSmash');
  }, 60_000);
});
