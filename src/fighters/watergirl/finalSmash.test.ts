import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { neutralInput } from '../../input/types';
import { isIntangible } from '../../sim/actions/registry';
import { knockback } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { BLAST } from '../fireboy/finalSmash';
import { registerFighter } from '../registry';
import { art } from './art';
import { WAVE, finalSmash, finalSmashAir, wave } from './finalSmash';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };
const SWAP: Hold = { y: -100, buttons: ['special'] };
const SHIELD: Hold = { buttons: ['shield'] };
const WAVE_KIND = 'watergirl/wave';

/**
 * `fighter` (Watergirl unless set) at x -60 facing right, a Mario-weight target 30 units in front at `percent`, and a
 * third fighter behind her (three players: no 1v1 damage multiplier), all standing on Battlefield after 30 frames.
 * She holds the charge; `press` is her input on the next frame (neutral special by default).
 */
function waveMatch(
  percent = 0,
  {
    air = false,
    fighter = 'watergirl',
    press = SPECIAL,
    hold = {},
  }: { air?: boolean; fighter?: string; press?: Hold; hold?: Hold } = {},
): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: marioReference.id }, { fighter: marioReference.id }],
  });
  const xs = [-60, -30, -78];
  m.fighters.forEach((f, i) => {
    const x = xs[i]!;
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
    Object.assign(f, { action: 'fall', actionFrame: 1, facing: i === 1 ? -1 : 1 });
  });
  step(m, 30);
  const [a, v] = m.fighters as [FighterState, FighterState];
  v.damage = percent;
  if (air)
    Object.assign(a, { pos: { x: -60, y: 40 }, prevPos: { x: -60, y: 40 }, ground: null, action: 'fall' });
  a.finalReady = true;
  step(m, 1, [press, hold]);
  return { m, a, v };
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

const waveOf = (m: MatchState) => m.entities.find((e) => e.kind === WAVE_KIND);

/** The wave's windows in move frames (its age 1 is move frame WAVE.frame). */
const windows = wave.hits!.map((w) => ({
  ...w,
  frames: w.frames.map((f) => f + WAVE.frame - 1) as [number, number],
}));

/** SmashWiki's Mario (SSBU)/Final Smash hitbox table: [damage, BK, KS, fire1 angle, fire2 angle, targets] per row. */
const TABLE = [
  [[2.5, 25, 40, 50, 48, undefined]],
  [
    [3, 20, 90, 23, 20, 'air'],
    [3, 15, 100, 50, 48, 'ground'],
  ],
  [
    [3.5, 10, 120, 23, 20, 'air'],
    [3.5, 5, 130, 50, 48, 'ground'],
  ],
] as const;
const rowOf = (frame: number) => (frame < 105 ? 0 : frame < 155 ? 1 : 2);

describe('Tidal Wave (Final Smash), on Mario Finale', () => {
  it("takes Mario Finale's timing: the wave breaks on 65, hits through 224 at a rehit rate of 7, actionable on 157 or 147 in the air", () => {
    expect([finalSmash.faf, finalSmashAir.faf]).toEqual([157, 147]);
    expect(finalSmash.air).toBe('finalSmashAir');
    for (const move of [finalSmash, finalSmashAir]) {
      expect(move.final).toBeDefined();
      expect(move.hits).toEqual([]);
      expect(move.spawn).toEqual([{ frame: 65, entity: 'wave', x: 20, y: 13, vx: 1.1 }]);
    }
    expect(wave.lifetime).toBe(224 - 65 + 1);
    expect(windows[0]!.frames[0]).toBe(65);
    expect(windows.at(-1)!.frames[1]).toBe(224);
    for (let i = 0; i < windows.length; i++) {
      const [from, to] = windows[i]!.frames;
      expect(windows[i]!.rehit).toBe(true);
      expect(to - from).toBeLessThan(7);
      if (i) expect(from).toBe(windows[i - 1]!.frames[1] + 1);
    }
    const starts = windows.map((w) => w.frames[0]);
    expect(starts.filter((f) => f < 105)).toEqual([65, 72, 79, 86, 93, 100]);
    expect(starts).toContain(105);
    expect(starts).toContain(155);
  });

  it("deals Mario Finale's damage and knockback, grounded and aerial rows apart, 74% if every hit lands ('about 75%')", () => {
    let total = 0;
    for (const w of windows) {
      const rows = TABLE[rowOf(w.frames[0])];
      const want = rows.flatMap(([damage, bkb, kbg, a1, a2, targets], i) =>
        [a1, a2].map((angle, k) => ({ id: i * 2 + k, damage, bkb, kbg, angle, targets })),
      );
      expect(
        w.boxes.map(({ id, damage, bkb, kbg, angle, targets }) => ({ id, damage, bkb, kbg, angle, targets })),
      ).toEqual(want);
      for (const b of w.boxes) expect([b.hitlag, b.effect]).toEqual([0, undefined]);
      total += rows[0][0];
    }
    expect(total).toBe(74);
    expect(Math.abs(total - 75)).toBeLessThanOrEqual(5);
  });

  it("covers Mario Finale's hit area: two radius-16 boxes 3 above and below the wave's centre, which rises 20 ahead and 13 up", () => {
    for (const w of wave.hits!) {
      for (const b of w.boxes) {
        expect([b.x, b.radius]).toEqual([0, 16]);
        expect(b.y).toBe(b.id % 2 ? -3 : 3);
      }
    }
    expect([WAVE.radius, WAVE.stretch, WAVE.x, WAVE.y]).toEqual([16, 3, 20, 13]);
    // From her feet: 4 to 36 ahead, 6 under the floor to 32 up, so its body runs along the stage under anyone on it.
    expect(WAVE.x - WAVE.radius).toBe(4);
    expect(WAVE.y - WAVE.stretch - WAVE.radius).toBe(-6);
    expect(WAVE.y + WAVE.stretch + WAVE.radius).toBe(32);
  });

  it('hits a fighter standing in its way with the grounded row, and not one standing behind her', () => {
    const { m, v } = waveMatch();
    const behind = m.fighters[2]!;
    let first: Extract<SimEvent, { type: 'hit' }> | undefined;
    const seen: SimEvent[] = [];
    for (let frame = 1; frame < 224; frame++) {
      const now = step(m, 1);
      seen.push(...now);
      first ??= now.find((e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit');
    }
    expect(first).toEqual(
      expect.objectContaining({ victim: 1, damage: 2.5 * 1.05, hitlag: 0, move: 'finalSmash' }),
    );
    const kb = knockback({ percent: 0, damage: 2.5, kbg: 40, bkb: 25, weight: 98, stale: 1.05, rage: 1 });
    expect(first!.kb).toBeCloseTo(kb, 6);
    expect(seen.some((e) => e.type === 'hit' && e.victim === behind.port)).toBe(false);
    expect(v.damage).toBeGreaterThan(30);
  });

  it('is unblockable, unreflectable and unabsorbable, and never clanks', () => {
    expect([wave.pierce, wave.transcendent, wave.reflectable, wave.absorbable]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const { m, v } = waveMatch(0, { hold: SHIELD });
    expect(v.action).toBe('shield');
    const seen = step(m, WAVE.frame, [{}, SHIELD]);
    expect(seen.filter((e) => e.type === 'shieldHit' || e.type === 'parry')).toEqual([]);
    expect(seen.filter((e) => e.type === 'hit')).toEqual([
      expect.objectContaining({ attacker: 0, victim: 1, move: 'finalSmash', damage: 2.5 * 1.05, hitlag: 0 }),
    ]);
  });

  it('starts from neutral special with the charge, breaks on frame 65 in front of her and rolls further than Battlefield is wide', () => {
    const { m, a } = waveMatch();
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    step(m, WAVE.frame - 2);
    expect(waveOf(m)).toBeUndefined();
    step(m, 1);
    expect(a.actionFrame).toBe(WAVE.frame);
    const w = waveOf(m)!;
    expect([w.pos.x, w.pos.y, w.facing, w.final]).toEqual([a.pos.x + WAVE.x, a.pos.y + WAVE.y, 1, true]);
    const start = w.pos.x;
    step(m, wave.lifetime! - 1);
    expect(w.pos.x - start).toBeCloseTo(WAVE.speed * (wave.lifetime! - 1), 6);
    expect(w.pos.x - start).toBeGreaterThan(160);
  });

  it('without the charge, neutral special is still Water Stream', () => {
    const { m, a } = waveMatch(0, { press: {} });
    a.finalReady = false;
    step(m, 1, [SPECIAL]);
    expect(a.move).toBe('neutralB');
  });

  it('keeps rolling after she can act again: she is idle from frame 157, the wave hits until 224', () => {
    const { m, a } = waveMatch(50);
    step(m, finalSmash.faf - 2);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', finalSmash.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
    expect(waveOf(m)).toBeDefined();
    step(m, 224 - finalSmash.faf);
    expect(waveOf(m)).toBeDefined();
    step(m, 1);
    expect(waveOf(m)).toBeUndefined();
  });

  it("holds everyone else still through Mario Finale's activation freeze, then they move as usual", () => {
    const { m, v } = waveMatch();
    const at = { ...v.pos };
    for (let i = 0; i < FINAL_SMASH.freeze - 1; i++) step(m, 1, [{}, { x: 100 }]);
    expect(v.pos).toEqual(at);
    step(m, 10, [{}, { x: -100 }]);
    expect(v.pos.x).not.toBe(at.x);
  });

  it('in the air holds still until the release, which kicks her back and up, then falls on frame 147', () => {
    const { m, a } = waveMatch(0, { air: true });
    expect([a.move, a.vel]).toEqual(['finalSmashAir', { x: 0, y: 0 }]);
    const at = { ...a.pos };
    step(m, WAVE.frame - 2);
    expect(a.pos).toEqual(at);
    step(m, 60);
    expect(a.pos.x).toBeLessThan(at.x - 2);
    expect(a.pos.y).toBeGreaterThan(at.y + 3);
    expect(a.pos.x).toBeGreaterThan(at.x - 4);
    expect(a.pos.y).toBeLessThan(at.y + 6);
    step(m, finalSmashAir.faf - a.actionFrame - 1);
    expect(a.move).toBe('finalSmashAir');
    step(m, 1);
    expect(a.action).toBe('fall');
  });

  it('carries a Mario-weight fighter 30 units in front through most of its hits at any percent', () => {
    const hits = (percent: number) => {
      const { m, v } = waveMatch(percent);
      const seen = step(m, 260);
      return {
        n: seen.filter((e) => e.type === 'hit' && e.victim === v.port).length,
        dealt: v.damage - percent,
      };
    };
    const low = hits(0);
    expect(low.n).toBeGreaterThanOrEqual(15);
    expect(low.dealt).toBeLessThanOrEqual(74 * 1.05);
    expect(hits(50).n).toBeGreaterThanOrEqual(10);
    expect(hits(100).n).toBeGreaterThanOrEqual(7);
  });

  /**
   * Mario Finale has no finishing hitbox: it KOs by carrying, and its strongest hits are the late rows. SSBU-Calculator's
   * KO calculator (rubendal/SSBU-Calculator 233590e, run headless on SmashWiki's values) KOs a Mario standing at
   * Battlefield's ledge, fresh, no rage, no DI, from 243.7% and 241.3% with the aerial row's two boxes (3.5%, BK 10,
   * KS 120 at 23 and 20 degrees, target airborne) and 288.5% and 281.1% with the grounded row's (BK 5, KS 130 at 50
   * and 48 degrees). The same harness gives the 64.7% and 90.4% of Mario's forward smash in ko.test.ts.
   */
  it.each([
    { id: 0, air: true, sourced: 243.7 },
    { id: 1, air: true, sourced: 241.3 },
    { id: 2, air: false, sourced: 288.5 },
    { id: 3, air: false, sourced: 281.1 },
  ])(
    "the late wave's box $id KOs within 5 points of Mario Finale's at $sourced% (target airborne: $air)",
    ({ id, air, sourced }) => {
      const b = wave.hits!.at(-1)!.boxes.find((x) => x.id === id)!;
      const percent = koPercent({ hit: { damage: b.damage, angle: b.angle, kbg: b.kbg, bkb: b.bkb }, air });
      expect(percent).not.toBe(null);
      expect(Math.abs(percent! - sourced)).toBeLessThanOrEqual(5);
    },
  );

  it("can't be swapped out of: down special during the move does nothing, and she stays intangible", () => {
    const { m, a } = waveMatch();
    for (let i = 0; i < finalSmash.faf - 2; i++) {
      step(m, 1, [i % 2 ? SWAP : {}]);
      expect([a.fighter, a.move, isIntangible(a)]).toEqual(['watergirl', 'finalSmash', true]);
    }
  });

  it('stays unblockable after she swaps to Fireboy while it still rolls: the wave keeps its own Final Smash', () => {
    const { m, a } = waveMatch();
    const w = m.fighters[2]!;
    step(m, finalSmash.faf - 1, [{}, {}, SHIELD]);
    expect(a.action).toBe('idle');
    step(m, 1, [SWAP, {}, SHIELD]);
    for (let i = 0; i < 30 && a.fighter === 'watergirl'; i++) step(m, 1, [{}, {}, SHIELD]);
    expect([a.fighter, w.action]).toEqual(['fireboy', 'shield']);
    const water = waveOf(m)!;
    expect([water.final, water.owner]).toEqual([true, 0]);
    // By now the wave has rolled past Battlefield's edge: bring it back over the shielding fighter.
    Object.assign(water.pos, { x: w.pos.x, y: w.pos.y + WAVE.y });
    water.prevPos = { ...water.pos };
    const seen = step(m, WAVE.rehit, [{}, {}, SHIELD]).filter(
      (e) => (e.type === 'hit' || e.type === 'shieldHit' || e.type === 'parry') && e.victim === w.port,
    );
    expect(seen).toEqual([
      expect.objectContaining({ type: 'hit', attacker: 0, victim: 2, move: 'finalSmash' }),
    ]);
  });

  it("keeps the framework's charge rules through a swap: the charge carries over, and whichever twin presses neutral special spends it", () => {
    // Fireboy holding the charge swaps: down special stays a special, so Watergirl comes out with it.
    const { m, a } = waveMatch(0, { fighter: 'fireboy', press: SWAP });
    expect([a.move, a.finalReady]).toEqual(['downB', true]);
    step(m, 60);
    expect([a.fighter, a.action, a.finalReady]).toEqual(['watergirl', 'idle', true]);
    step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    step(m, finalSmash.faf);
    // One charge for the slot: swapping back after her Tidal Wave leaves Fireboy his fireball, not Fire Blast.
    step(m, 1, [SWAP]);
    step(m, 60);
    expect([a.fighter, a.finalReady]).toEqual(['fireboy', false]);
    step(m, 1, [SPECIAL]);
    expect(a.move).toBe('neutralB');
  });

  it('plays the twin it is pressed on: with the charge, Watergirl swapped back to Fireboy fires his Fire Blast', () => {
    const { m, a } = waveMatch(0, { press: SWAP });
    expect([a.move, a.finalReady]).toEqual(['downB', true]);
    step(m, 60);
    expect([a.fighter, a.finalReady]).toEqual(['fireboy', true]);
    step(m, 1, [SPECIAL]);
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    step(m, BLAST.frame);
    expect(m.entities.map((e) => e.kind)).toContain('fireboy/blast');
    expect(waveOf(m)).toBeUndefined();
  });

  it('lets CPUs use it on anyone within 120 units in front', () => {
    expect(finalReach('watergirl')).toEqual(expect.objectContaining({ ahead: 120 }));
    const m = createMatch({
      seed: 2,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'watergirl' }, { fighter: marioReference.id }],
    });
    const [me, opp] = m.fighters as [FighterState, FighterState];
    for (const [f, x, facing] of [
      [me, -50, 1],
      [opp, 50, -1],
    ] as const)
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null, facing });
    for (let i = 0; i < 20; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    me.finalReady = true;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    let used = -1;
    for (let i = 0; i < 30 && used < 0; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      if (m.events.some((e) => e.type === 'finalSmash' && e.port === 0)) used = i;
    }
    expect(used).toBeGreaterThanOrEqual(0);
    expect(used).toBeLessThan(15);
    expect(me.move).toBe('finalSmash');
  });

  it('has a clip for each version on its frame data, and the wave drawn in her rig as a prop', () => {
    expect(art.clips.finalSmash?.length).toBe(finalSmash.faf - 1);
    expect(art.clips.finalSmashAir?.length).toBe(finalSmashAir.faf - 1);
    expect(art.clips.finalSmash?.active).toEqual([[WAVE.frame, WAVE.frame]]);
    expect(art.clips.finalSmashAir?.active).toEqual([[WAVE.frame, WAVE.frame]]);
    expect(art.projectiles?.wave?.symbol).toBe('fxWave');
    expect(art.rig.symbols.fxWave).toBeDefined();
  });
});
