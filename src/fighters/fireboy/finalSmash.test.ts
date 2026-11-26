import { describe, expect, it } from 'vitest';
import { knockback } from '../../sim/combat/formulas';
import { FINAL_SMASH, finalReach } from '../../sim/finalSmash';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { marioReference } from '../../sim/testing/reference';
import { input, type Hold } from '../../sim/testing/sim';
import { applyStatus, statusOf } from '../../sim/statuses';
import { PARALYZED } from '../bob-the-robber/entities';
import { registerFighter } from '../registry';
import { art } from './art';
import { BLAST, blast, finalSmash, finalSmashAir } from './finalSmash';

registerFighter(marioReference);

const SPECIAL: Hold = { buttons: ['special'] };

/**
 * Fireboy at x -60 facing right, a Mario-weight target 30 units in front at `percent`, and a third fighter behind
 * Fireboy (three players: no 1v1 damage multiplier). `prep` runs just before the activation frame. Returns after it.
 */
function blastMatch(
  percent = 0,
  air = false,
  hold: Hold = {},
  prep: (m: MatchState) => void = () => {},
): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'fireboy' }, { fighter: marioReference.id }, { fighter: marioReference.id }],
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
  prep(m);
  step(m, 1, [SPECIAL, hold]);
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

/** The blast's windows in move frames (its age 1 is move frame BLAST.frame). */
const windows = blast.hits!.map((w) => ({
  ...w,
  frames: w.frames.map((f) => f + BLAST.frame - 1) as [number, number],
}));

describe('Fire Blast (Final Smash), on Mario Finale', () => {
  it("takes Mario Finale's timing: fire out on 65, hits through 224 at a rehit rate of 7, actionable on 157 or 147 in the air", () => {
    expect([finalSmash.faf, finalSmashAir.faf]).toEqual([157, 147]);
    expect(finalSmash.air).toBe('finalSmashAir');
    for (const move of [finalSmash, finalSmashAir]) {
      expect(move.final).toBeDefined();
      expect(move.hits).toEqual([]);
      expect(move.spawn).toEqual([{ frame: 65, entity: 'blast', x: BLAST.x, y: BLAST.y, vx: BLAST.speed }]);
    }
    expect(blast.lifetime).toBe(224 - 65 + 1);
    expect(windows[0]!.frames[0]).toBe(65);
    expect(windows.at(-1)!.frames[1]).toBe(224);
    for (let i = 0; i < windows.length; i++) {
      const [from, to] = windows[i]!.frames;
      expect(windows[i]!.rehit).toBe(true);
      expect(to - from).toBeLessThan(7);
      if (i) expect(from).toBe(windows[i - 1]!.frames[1] + 1);
    }
    const starts = windows.map((w) => w.frames[0]);
    expect(starts.filter((f) => (f - 65) % 7 === 0 && f < 105)).toEqual([65, 72, 79, 86, 93, 100]);
    expect(starts).toContain(105);
    expect(starts).toContain(155);
  });

  it("deals Mario Finale's damage and knockback, grounded and aerial rows apart, 74% if every hit lands ('about 75%')", () => {
    const row = (f: number) => (f < 105 ? 0 : f < 155 ? 1 : 2);
    // [damage, BK, KS, fire1 angle, fire2 angle, targets] per row: SmashWiki's hitbox table.
    const table = [
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
    let total = 0;
    for (const w of windows) {
      const rows = table[row(w.frames[0])];
      const want = rows.flatMap(([damage, bkb, kbg, a1, a2, targets], i) =>
        [a1, a2].map((angle, k) => ({
          id: i * 2 + k,
          y: k ? -BLAST.stretch : BLAST.stretch,
          damage,
          bkb,
          kbg,
          angle,
          targets,
        })),
      );
      expect(
        w.boxes.map(({ id, y, damage, bkb, kbg, angle, targets }) => ({
          id,
          y,
          damage,
          bkb,
          kbg,
          angle,
          targets,
        })),
      ).toEqual(want);
      for (const b of w.boxes) expect([b.radius, b.hitlag, b.effect]).toEqual([16, 0, 'fire']);
      total += rows[0][0];
    }
    expect(total).toBe(74);
  });

  it("hits a fighter standing in its way with the grounded row, Mario Finale's mid-window 3% at BK 15, KS 100", () => {
    const { m, v } = blastMatch();
    Object.assign(v, { pos: { x: 40, y: v.pos.y }, prevPos: { x: 40, y: v.pos.y } });
    let first: Extract<SimEvent, { type: 'hit' }> | undefined;
    let frame = 1;
    for (; frame < 224 && !first; frame++) {
      first = step(m, 1).find((e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit');
    }
    expect(frame).toBeGreaterThan(105);
    expect(frame).toBeLessThan(155);
    const kb = knockback({ percent: 0, damage: 3, kbg: 100, bkb: 15, weight: 98, stale: 1.05, rage: 1 });
    expect(first).toEqual(expect.objectContaining({ victim: 1, damage: 3 * 1.05, hitlag: 0 }));
    expect(first!.kb).toBeCloseTo(kb, 6);
  });

  it('is unblockable, unreflectable and unabsorbable, and never clanks', () => {
    expect([blast.pierce, blast.transcendent, blast.reflectable, blast.absorbable]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const { m, v } = blastMatch(0, false, { buttons: ['shield'] });
    expect(v.action).toBe('shield');
    const seen = step(m, BLAST.frame, [{}, { buttons: ['shield'] }]);
    expect(seen.filter((e) => e.type === 'shieldHit' || e.type === 'parry')).toEqual([]);
    expect(seen.filter((e) => e.type === 'hit')).toEqual([
      expect.objectContaining({ attacker: 0, victim: 1, move: 'finalSmash', damage: 2.5 * 1.05, hitlag: 0 }),
    ]);
  });

  it('starts from neutral special with the charge and puts the fire out on frame 65 and sends it further than Battlefield is wide', () => {
    const { m, a } = blastMatch();
    expect([a.move, a.finalReady]).toEqual(['finalSmash', false]);
    step(m, BLAST.frame - 2);
    expect(m.entities.some((e) => e.kind === 'fireboy/blast')).toBe(false);
    step(m, 1);
    expect(a.actionFrame).toBe(BLAST.frame);
    const fire = m.entities.find((e) => e.kind === 'fireboy/blast')!;
    expect([fire.pos.x, fire.pos.y, fire.facing]).toEqual([a.pos.x + BLAST.x, a.pos.y + BLAST.y, 1]);
    const start = fire.pos.x;
    step(m, BLAST.lifetime - 1);
    expect(fire.pos.x - start).toBeCloseTo(BLAST.speed * (BLAST.lifetime - 1), 6);
    expect(fire.pos.x - start).toBeGreaterThan(160);
  });

  it('keeps burning after Fireboy can act again: he is idle from frame 157, the fire hits until 224', () => {
    const { m, a } = blastMatch(50);
    step(m, finalSmash.faf - 2);
    expect([a.move, a.actionFrame]).toEqual(['finalSmash', finalSmash.faf - 1]);
    step(m, 1);
    expect(a.action).toBe('idle');
    expect(m.entities.some((e) => e.kind === 'fireboy/blast')).toBe(true);
    step(m, 224 - finalSmash.faf);
    expect(m.entities.some((e) => e.kind === 'fireboy/blast')).toBe(true);
    step(m, 1);
    expect(m.entities.some((e) => e.kind === 'fireboy/blast')).toBe(false);
  });

  it("pauses a target's paralysis through the activation freeze: a 30-frame Stun Gun paralysis outlasts it", () => {
    const { m, v } = blastMatch(0, false, {}, (m) =>
      applyStatus(m, m.fighters[1]!, PARALYZED, { frames: 30 }),
    );
    for (let i = 0; i < FINAL_SMASH.freeze; i++) {
      step(m, 1);
      expect(statusOf(v, PARALYZED)?.frames).toBe(30);
    }
    step(m, 1);
    expect(statusOf(v, PARALYZED)?.frames).toBe(29);
  });

  it('in the air holds still until the release, which kicks Fireboy back and up, then falls on frame 147', () => {
    const { m, a } = blastMatch(0, true);
    expect([a.move, a.vel]).toEqual(['finalSmashAir', { x: 0, y: 0 }]);
    const at = { ...a.pos };
    step(m, BLAST.frame - 2);
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

  it('still puts the fire out when the rising raft lands him first (Raft War Lagoon, hazards on)', () => {
    const m = createMatch({
      seed: 1,
      stage: 'raft-wars-water',
      hazards: true,
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: marioReference.id }],
    });
    step(m, 20);
    const a = m.fighters[0]!;
    Object.assign(a, {
      pos: { x: -30, y: 0.4 },
      prevPos: { x: -30, y: 0.4 },
      vel: { x: 0, y: 0 },
      ground: null,
    });
    Object.assign(a, { action: 'fall', actionFrame: 1, facing: 1, finalReady: true });
    step(m, 1, [SPECIAL]);
    expect(a.move).toBe('finalSmashAir');
    step(m, BLAST.frame - 1);
    expect(a.ground).not.toBe(null);
    expect([a.move, a.actionFrame]).toEqual(['finalSmashAir', BLAST.frame]);
    expect(m.entities.filter((e) => e.kind === 'fireboy/blast')).toHaveLength(1);
    expect(a.vel.y).toBeLessThanOrEqual(0);
  });

  it('carries a Mario-weight fighter 30 units in front through most of its hits at any percent', () => {
    const hits = (percent: number) => {
      const { m, v } = blastMatch(percent);
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

  it('has a clip for each version on its frame data, and the fire drawn in his rig as a prop', () => {
    expect(art.clips.finalSmash?.length).toBe(finalSmash.faf - 1);
    expect(art.clips.finalSmashAir?.length).toBe(finalSmashAir.faf - 1);
    expect(art.clips.finalSmash?.active).toEqual([[BLAST.frame, BLAST.frame]]);
    expect(art.projectiles?.blast?.symbol).toBe('fxBlast');
    expect(art.rig.symbols.fxBlast).toBeDefined();
  });

  it('lets CPUs fire it at anyone within 120 units in front', () => {
    expect(finalReach('fireboy')?.ahead).toBe(120);
  });
});
