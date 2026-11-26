import { describe, expect, it } from 'vitest';
import { statusBadges } from '../../render/fighterView';
import { activeHitboxes } from '../../sim/combat/hits';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { applyStatus, hasStatus, statusOf } from '../../sim/statuses';
import { koPercent, kos } from '../../sim/testing/ko';
import { attack, placeInAir, runPorts } from '../../sim/testing/sim';
import { moves, SHAKER } from './moves';
import { CHEESE, cheeseMul } from './statuses';
import { strike, versus } from './testing';

const CHEESED = 'papa-louie/cheesed';

/**
 * The Ice Climbers' Blizzard (SmashWiki, "Ice Climbers (SSBU)/Down special"): its hitboxes (clean, mid, late) and its
 * timing table, shot by shot.
 */
const BLIZZARD = [
  { damage: 1.8, angle: 361, bkb: 10, kbg: 50, radius: 5, hitlag: 0.5 },
  { damage: 1, angle: 361, bkb: 10, kbg: 50, radius: 4, hitlag: 0.5 },
  { damage: 1, angle: 361, bkb: 10, kbg: 20, radius: 2.5, hitlag: 0.5 },
];
const CLEAN = ['16-17', '21-22', '26-27', '31-32', '36-37', '41-42', '46-47', '51-52', '56-57'];
const MID = ['18-21', '23-26', '28-31', '33-36', '38-41', '43-46', '48-51', '53-56', '58-61'];
const LATE = ['22-24', '27-29', '32-34', '37-39', '42-44', '47-49', '52-54', '57-59', '62-64'];
const span = (s: string) => s.split('-').map(Number);

/** Papa (P1) and the Mario reference (P2) standing `gap` units in front of him, Mario at `percent`. */
function facing(gap: number, percent = 0): { m: MatchState; a: FighterState; v: FighterState } {
  const m = versus();
  const [a, v] = m.fighters as [FighterState, FighterState];
  a.facing = 1;
  const x = a.pos.x + gap;
  Object.assign(v, {
    pos: { x, y: a.pos.y },
    prevPos: { x, y: a.pos.y },
    vel: { x: 0, y: 0 },
    ground: a.ground,
    action: 'idle',
    actionFrame: 1,
    damage: percent,
    facing: -1,
    intangible: 0,
  });
  return { m, a, v };
}

/** Steps until an event of `type` (at most `frames` frames); true when one came. */
function stepTo(m: MatchState, type: string, frames = 120): boolean {
  for (let i = 0; i < frames; i++) {
    runPorts(m, 1, [{}, {}]);
    if (m.events.some((e) => e.type === type)) return true;
  }
  return false;
}

describe("Papa Louie: Parmesan Shaker (side special, on the Ice Climbers' Blizzard)", () => {
  const move = moves.sideB!;

  it("has Blizzard's nine shots: clean 16-17, mid 18-21 and late 22-24, every 5 frames to 62-64, and FAF 85", () => {
    expect(move.faf).toBe(85);
    const windows = CLEAN.flatMap((c, i) => [c, MID[i]!, LATE[i]!].map(span));
    expect(move.hits.map((w) => w.frames)).toEqual(windows);
    expect(move.hits.map((w) => w.rehit ?? false)).toEqual(windows.map((_, i) => i % 3 === 0));
    move.hits.forEach((w, i) => {
      expect(w.boxes).toHaveLength(1);
      expect(w.boxes[0]).toMatchObject({ ...BLIZZARD[i % 3], id: i % 3, status: CHEESED });
    });
  });

  it("puts each box where a shot flying 2.8 units a frame from the shaker's cap is halfway through its phase", () => {
    expect(SHAKER.cap).toEqual({ x: 6.5, y: 8 });
    const out = move.hits.slice(0, 3).map((w) => w.boxes[0]!);
    expect(out.map((b) => b.x)).toEqual([6.5 + 1.4, 6.5 + 9.8, 6.5 + 19.6]);
    expect(out.map((b) => b.y)).toEqual([8, 8, 8]);
    for (const [i, w] of move.hits.entries()) expect(w.boxes[0]!.x, `window ${i}`).toBe(out[i % 3]!.x);
  });

  it.each([false, true])('comes out on frame 16 and ends on its FAF, in the air: %s', (air) => {
    const m = versus();
    const f = air ? placeInAir(m, 40, 160) : m.fighters[0]!; // clear of the platforms all 85 frames
    attack(m, 0, 'sideB');
    let first = 0;
    let frames = 0;
    while (f.move === 'sideB') {
      runPorts(m, 1, [{}, {}]);
      frames++;
      if (!first && activeHitboxes(f).length > 0) first = f.actionFrame;
    }
    expect(first).toBe(16);
    expect(frames).toBe(85);
    expect(f.action).toBe(air ? 'fall' : 'idle');
  });

  it('a shot Cheeses the fighter it hits: 12 units, held 120 frames and then worn off over 48', () => {
    const { m, v } = facing(8);
    attack(m, 0, 'sideB');
    expect(stepTo(m, 'statusStart')).toBe(true);
    expect(m.events).toContainEqual({
      type: 'statusStart',
      port: 1,
      status: CHEESED,
      frames: 168,
      source: 0,
    });
    expect(statusOf(v, CHEESED)).toMatchObject({ level: CHEESE.perShot, frames: 120 + 12 / 0.25, source: 0 });
    expect(m.fighters[0]!.actionFrame).toBe(16);
  });

  it.each([5, 8, 12, 16, 20])(
    'all nine shots land on a Mario %s units away: 108 units of cheese, so he takes x1.3',
    (gap) => {
      const { v } = strike('sideB', { x: gap }, 0);
      const s = statusOf(v, CHEESED)!;
      expect(s.level).toBe(9 * CHEESE.perShot);
      expect(cheeseMul(s)).toBeCloseTo(1.3, 9);
    },
  );

  it('point blank the nine shots add 23.1%, each boosted by the cheese the shots before it laid', () => {
    const { v } = strike('sideB', { x: 8 }, 0);
    // Clean shots, fresh (x1.05), 1v1 (x1.2), the k-th taking 1 + 12 k x 0.5 / 180 for the k coats before it.
    const expected = Array.from({ length: 9 }, (_, k) => 1.8 * 1.05 * 1.2 * (1 + (12 * k * 0.5) / 180));
    expect(v.damage).toBeCloseTo(
      expected.reduce((a, b) => a + b),
      9,
    );
    expect(v.damage).toBeCloseTo(23.134, 3);
  });

  it('a shield takes the shots: no damage, no cheese', () => {
    const { m, v } = facing(8);
    runPorts(m, 4, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shield');
    attack(m, 0, 'sideB');
    runPorts(m, 85, [{}, { buttons: ['shield'] }]);
    expect(v.damage).toBe(0);
    expect(hasStatus(v, CHEESED)).toBe(false);
  });
});

describe("Papa Louie: Cheesed (Inkling's ink)", () => {
  /** Papa's 9% Peel Swipe on a Mario coated with `level` units: the % it adds and its knockback. */
  function swipe(level: number): { added: number; kb: number } {
    const { m, v } = facing(14);
    if (level) applyStatus(m, v, CHEESED, { level });
    attack(m, 0, 'ftilt');
    expect(stepTo(m, 'hit', 30)).toBe(true);
    return { added: v.damage, kb: v.launch!.kb };
  }

  it.each([
    [0, 1],
    [12, 1 + 1 / 30],
    [108, 1.3],
    [180, 1.5],
    [300, 1.5],
  ])(
    "at %s units he takes x%s damage from any hit, ink's 1 + coat x 0.5 / 180 up to x1.5, at the same knockback",
    (level, mul) => {
      const hit = swipe(level);
      expect(hit.added).toBeCloseTo(9 * 1.05 * 1.2 * mul, 9);
      expect(hit.kb).toBe(swipe(0).kb);
    },
  );

  it.each([
    [108, 552],
    [180, 840],
    [300, 1320],
  ])(
    'a %s-unit coat lasts %s frames: held 120, then 0.25 units a frame (ink: 14 s at 180, 22 s at 300)',
    (level, frames) => {
      const { m, v } = facing(30);
      applyStatus(m, v, CHEESED, { level });
      runPorts(m, 1, [{}, {}]); // the frame it went on
      runPorts(m, 120, [{}, {}]);
      expect(statusOf(v, CHEESED)!.level).toBe(level);
      runPorts(m, 1, [{}, {}]);
      expect(statusOf(v, CHEESED)!.level).toBe(level - 0.25);
      runPorts(m, frames - 122, [{}, {}]);
      expect(statusOf(v, CHEESED)).toMatchObject({ level: 0.25, frames: 1 });
      runPorts(m, 1, [{}, {}]);
      expect(hasStatus(v, CHEESED)).toBe(false);
      expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: CHEESED, reason: 'expired' });
    },
  );

  it('a KO takes the cheese off, and he comes back clean', () => {
    const { m, v } = strike('sideB', { x: 8 }, 0);
    expect(hasStatus(v, CHEESED)).toBe(true);
    Object.assign(v, { pos: { x: 400, y: 20 }, ground: null, action: 'fall' });
    runPorts(m, 1, [{}, {}]);
    expect(v.action).toBe('ko');
    expect(v.statuses).toEqual([]);
    expect(m.events).toContainEqual({ type: 'statusEnd', port: 1, status: CHEESED, reason: 'ko' });
    runPorts(m, 200, [{}, {}]);
    expect(v.statuses).toEqual([]);
  });

  it('shows on the coated fighter as a Parmesan-yellow badge', () => {
    const { v } = strike('sideB', { x: 8 }, 0);
    expect(statusBadges(v, 0)).toEqual(['#f2cf5b']);
  });
});

describe('Papa Louie: Parmesan Shaker never KOs, as Blizzard never does', () => {
  it("koPercent finds no KO by 999% for its last shot or for Blizzard's clean shot, at the ledge or centre stage", () => {
    const clean = { damage: 1.8, angle: 361, kbg: 50, bkb: 10 };
    for (const from of ['ledge', 'centre'] as const) {
      expect(koPercent({ hit: { fighter: 'papa-louie', move: 'sideB' }, from }), from).toBeNull();
      expect(koPercent({ hit: clean, from }), from).toBeNull();
    }
    expect(kos({ hit: { fighter: 'papa-louie', move: 'sideB' } }, 999)).toBe(false);
  });
});
