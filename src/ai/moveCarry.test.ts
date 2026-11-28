import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { neutralInput } from '../input/types';
import type { FighterState } from '../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { DASH_INPUTS, GROUND_INPUTS, STICK, press } from './inputs';
import { actionable, chargeInput, knowledge } from './knowledge';
import { run, soloMatch, type Sample } from './look';
import { findAttacks, type Attack } from './options';
import { landsSafe, stageInfo } from './stage';

/**
 * Where the CPU expects a grounded move to end when it starts it already moving. The sim carries the fighter's speed
 * into the move under its ground friction, and the move's script can keep, replace or scale it, so out of a run a move
 * can end tens of units further than from standing: Runner's dash attack out of his 3.85-a-frame run goes 52 units,
 * not the 18 of the dash it was probed from. Attack.endX, which the CPU's safety check reads, used to be the standing
 * probe's end, so out of a run Snail Bob's Shell Pound hopped past a ledge the CPU thought it stopped short of.
 */

const LEFT = -80;

type Start = 'walk' | 'dash' | 'run';

/** `fighter` alone on Battlefield and a Fireboy at x 60, settled; `fighter` gets into `start` heading right. */
function moving(fighter: string, start: Start): { m: MatchState; f: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: 'fireboy' }],
  });
  for (let i = 0; i < 40; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const f = m.fighters[0]!;
  Object.assign(f, { pos: { x: LEFT + 6, y: f.pos.y }, prevPos: { x: LEFT + 6, y: f.pos.y }, facing: 1 });
  Object.assign(m.fighters[1]!, { pos: { x: 60, y: 0 }, prevPos: { x: 60, y: 0 } });
  stepMatch(m, [neutralInput(), neutralInput()]);
  const hold = (x: number) => stepMatch(m, [press({ x }), neutralInput()]);
  if (start === 'walk') for (let i = 0; i < 15; i++) hold(STICK.walkMax);
  if (start === 'dash') for (let i = 0; i < 6; i++) hold(STICK.full);
  if (start === 'run')
    for (let i = 0, running = 0; i < 120 && running < 8; i++, running += +(f.action === 'run'))
      hold(STICK.full);
  return { m, f };
}

/** Put `f`, moving as it is, at x on its floor. */
function at(f: FighterState, x: number): void {
  Object.assign(f, { pos: { x, y: f.pos.y }, prevPos: { x, y: f.pos.y } });
}

/** A target whose hurtbox covers the stage, so every grounded move with a hitbox is an option against it. */
function everywhere(m: MatchState): Sample[] {
  return run(soloMatch(m, m.fighters[1]!), 45).map((s) => ({ ...s, hurt: { ...s.hurt, r: 1000 } }));
}

/** The grounded options `f` has facing right, by move (tapped, not charged). */
function options(m: MatchState, f: FighterState): Map<string, Attack> {
  const self = {
    f,
    k: knowledge(f.fighter, 'battlefield'),
    info: stageInfo(m),
    groundDelay: 0,
    jumpDelay: Infinity,
  };
  const all = findAttacks(self, { path: everywhere(m), errX: 0, grabbableIn: 0 });
  return new Map(all.filter((a) => a.kind === 'ground' && a.facing === 1 && !a.held).map((a) => [a.move, a]));
}

/** Where `move` started now really leaves `f`, played on a copy of the match with the CPU's input for it. */
function realEnd(m: MatchState, f: FighterState, move: string): number {
  const c = soloMatch(m, f, m.players[0]!.control);
  const g = c.fighters[0]!;
  const input = DASH_INPUTS[move] ? { x: STICK.full, ...DASH_INPUTS[move] } : GROUND_INPUTS[move]!;
  stepMatch(c, [press(input, 1)]);
  for (let t = 1; t < 240; t++) {
    stepMatch(c, [(g.move === move && chargeInput(g, input.buttons ?? 0, 0)) || neutralInput()]);
    if (g.move !== move && actionable(g) && g.ground !== null) break;
  }
  return g.pos.x;
}

describe('the end the CPU expects of a grounded move started on the move', () => {
  // The Bloxorz block moves by tipping over, so its speed on the frame of the input says little about how far it
  // carries on; its ends out of a run are off on main and here alike.
  const fighters = Object.keys(allFighters()).filter(
    (id) => !id.startsWith('reference') && !id.startsWith('bloxorz'),
  );

  it.each(fighters)(
    '%s: every grounded move out of a walk, a dash and a run ends where the CPU expects',
    (id) => {
      const off: string[] = [];
      for (const start of ['walk', 'dash', 'run'] as const) {
        const { m, f } = moving(id, start);
        at(f, LEFT + 6);
        for (const [move, a] of options(m, f)) {
          const real = realEnd(m, f, move);
          if (Math.abs(a.endX - real) > 1)
            off.push(`${move} out of a ${start}: expects ${a.endX.toFixed(1)}, ends ${real.toFixed(1)}`);
        }
      }
      expect(off).toEqual([]);
    },
    60_000,
  );

  it.each([1, -1] as const)(
    'out of a run 10 units from the %d ledge, Snail Bob refuses Shell Pound, which hops past it, but keeps a smash that stops at it',
    (side) => {
      const { m, f } = moving('snailbob', 'run');
      if (side < 0) {
        Object.assign(f, { facing: -1, vel: { x: -f.vel.x, y: 0 } });
      }
      at(f, side * (80 - 10));
      const self = {
        f,
        k: knowledge('snailbob', 'battlefield'),
        info: stageInfo(m),
        groundDelay: 0,
        jumpDelay: Infinity,
      };
      const all = findAttacks(self, { path: everywhere(m), errX: 0, grabbableIn: 0 }).filter(
        (a) => a.kind === 'ground' && a.facing === side && !a.held,
      );
      const pound = all.find((a) => a.move === 'downB')!;
      const smash = all.find((a) => a.move === 'fsmash')!;
      const info = stageInfo(m);
      // The CPU's safety check (Cpu.rank): an option counts only if it ends over ground it can stand on.
      expect(side * pound.endX).toBeGreaterThan(80);
      expect(landsSafe(info, 'snailbob', pound.endX, pound.endY + 1)).toBe(false);
      expect(Math.abs(smash.endX - realEnd(m, f, 'fsmash'))).toBeLessThanOrEqual(1);
      expect(landsSafe(info, 'snailbob', smash.endX, smash.endY + 1)).toBe(true);
    },
  );
});
