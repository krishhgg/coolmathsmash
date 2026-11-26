import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import { createCpu } from './index';

/**
 * A CPU's jump out of its shield. The shield consumes the Shield press that starts it, but a new press while the
 * fighter shields, or is in shield stun, stays in the input buffer, which keeps a held button buffered until 9 frames
 * after it is let go. A jump out of the shield then air dodges with it on its first frame in the air, in the jump's
 * stick direction. So the CPU must keep Shield held through its shield, never let go and press again.
 */

const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** Whether `actions` (a fighter's actions so far, one per change) end in an air dodge straight out of a shield jump. */
const dodgedOutOfShield = (actions: string[]) =>
  actions.at(-1) === 'airDodge' && actions.at(-2) === 'jumpSquat' && /^shield/.test(actions.at(-3) ?? '');

describe('CPU jumps out of shield', () => {
  /**
   * #326's bench, seed 2, Red Ball against Wheely: Wheely shields Red Ball's forward smash 9 units from the left
   * ledge, and the CPU starts a jump aerial out of the shield during the shield's stun. That program holds Shield until
   * it can jump, but runProgram let go of Shield for its first frame and it pressed Shield again. So the jump air
   * dodged on its first frame in the air, sideways toward the ledge with the jump's stick, slid off the stage and fell
   * 100 units. Here Red Ball starts the same forward smash. On main 11 of these 40 seeds air dodge out of the jump, and
   * 10 of those slide off and are KO'd.
   */
  it('a level 9 Wheely jumping out of shield beside the ledge does not air dodge off it', () => {
    let jumps = 0;
    const lost: string[] = [];
    for (const seed of seeds(40)) {
      const m = createMatch({
        seed: 1,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'wheely' }, { fighter: 'redball' }],
      });
      for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
      const f = m.fighters[0]!;
      Object.assign(f, { pos: { x: -54.3, y: 0 }, prevPos: { x: -54.3, y: 0 }, facing: -1 });
      const o = m.fighters[1]!;
      Object.assign(o, { pos: { x: -39.9, y: 0 }, prevPos: { x: -39.9, y: 0 }, facing: -1 });
      Object.assign(o, {
        action: 'attack',
        actionFrame: 0,
        move: 'fsmash',
        hitVictims: [],
        hitEntities: [],
        moveStale: 0,
      });
      const cpu = createCpu({ port: 0, level: 9, seed });
      const actions: string[] = [];
      let end = '';
      for (let i = 0; i < 600 && !end; i++) {
        stepMatch(m, [cpu.input(m), neutralInput()]);
        if (actions.at(-1) !== f.action) actions.push(f.action);
        if (f.stocks < 3) end = 'ko';
        else if (i >= 120 && f.ground !== null) end = 'stage';
      }
      const i = actions.indexOf('shieldStun');
      if (i >= 0 && actions.slice(i).includes('jumpSquat')) jumps++;
      if (actions.includes('airDodge') || end !== 'stage')
        lost.push(`seed ${seed}: ${end}: ${actions.join(' > ')}`);
    }
    expect(jumps).toBeGreaterThan(5);
    expect(lost).toEqual([]);
  }, 60_000);

  // Level 9 against level 9 on Battlefield. On main, in each of these matches a CPU's jump out of its shield air dodged
  // on its first frame in the air, on the frame given. In the first five it pressed Shield again when an out-of-shield
  // program started in the shield's stun (above). In seed 22 a shield program ran out during hitlag, which stretches the
  // stun past the frames the CPU counted, and the next one pressed Shield again.
  it.each([
    [3, ['redball', 'bob-the-robber'], 1661],
    [4, ['bob-the-robber', 'redball'], 458],
    [2, ['runner', 'wheely'], 417],
    [4, ['redball', 'runner'], 190],
    [2, ['fireboy', 'fireboy'], 772],
    [22, ['redball', 'bob-the-robber'], 300],
  ] as const)(
    'level 9 CPUs in seed %d, %j, jump out of shield without air dodging',
    (seed, fighters, frame) => {
      const m = createMatch({
        seed,
        stage: 'battlefield',
        stocks: 3,
        ports: fighters.map((fighter) => ({ fighter })),
      });
      const cpus = fighters.map((_, port) => createCpu({ port, level: 9, seed: seed * 7919 + port }));
      const seen: string[][] = fighters.map(() => []);
      const dodges: string[] = [];
      while (m.frame < frame + 30) {
        stepMatch(
          m,
          cpus.map((c) => c.input(m)),
        );
        m.fighters.forEach((f, p) => {
          const s = seen[p]!;
          if (s.at(-1) !== f.action) s.push(f.action);
          if (f.actionFrame === 1 && dodgedOutOfShield(s)) dodges.push(`port ${p}, frame ${m.frame}`);
        });
      }
      expect(dodges).toEqual([]);
    },
    60_000,
  );
});
