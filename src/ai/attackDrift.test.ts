import { describe, expect, it } from 'vitest';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import type { Cpu } from './cpu';
import { createCpu } from './index';
import type { Attack } from './options';
import { stageInfo } from './stage';

/**
 * Attacks that take the CPU into the air, played the way the CPU plays them. Before it starts one (Cpu.startAttack)
 * the CPU plays it out on a copy of the match (steerAttack); one that would carry it off the stage is steered toward
 * the stage during the move, from just after the move's last hit or shot when that is enough, and otherwise from as
 * late as still lands.
 */

type Starter = {
  startAttack(state: unknown, ranked: Attack[], me: unknown, info: unknown): boolean;
};

interface Played {
  end: 'landed' | 'ledge' | 'ko' | 'stuck';
  x: number;
  frame: number;
  /** Furthest out, toward the side the CPU faced. Landing counts once the CPU has left the ground. */
  out: number;
}

/**
 * A level 9 CPU's `fighter` at (side * x, 0) on Battlefield facing `side`, a Fireboy standing at the other end, starts
 * `attack` (mirrored for side -1) as its own; the rest of the match plays until it lands, catches a ledge or is KO'd.
 */
function play(fighter: string, x: number, side: 1 | -1, attack: Partial<Attack>, seed = 1): Played {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: 'fireboy' }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const f = m.fighters[0]!;
  Object.assign(m.fighters[1]!, { pos: { x: -side * 60, y: 0 }, prevPos: { x: -side * 60, y: 0 } });
  Object.assign(f, { pos: { x: side * x, y: 0 }, prevPos: { x: side * x, y: 0 }, facing: side });
  const cpu = createCpu({ port: 0, level: 9, seed }) as Cpu;
  cpu.input(m);
  const a = { facing: side, drift: 0, full: false, late: 0, endX: f.pos.x, endY: 0, ...attack } as Attack;
  if (a.drift) a.drift *= side;
  (cpu as unknown as Starter).startAttack(m, [a], f, stageInfo(m));
  let out = -Infinity;
  let flew = false;
  for (let t = 1; t <= 400; t++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    out = Math.max(out, side * f.pos.x);
    flew ||= f.ground === null;
    if (f.stocks < 3) return { end: 'ko', x: f.pos.x, frame: t, out };
    if (f.action === 'ledgeCatch') return { end: 'ledge', x: f.pos.x, frame: t, out };
    if (flew && f.ground !== null) return { end: 'landed', x: f.pos.x, frame: t, out };
  }
  return { end: 'stuck', x: f.pos.x, frame: 400, out };
}

const RAMP_JUMP: Partial<Attack> = { kind: 'ground', move: 'upB' };

describe('attacks that would carry the CPU off the stage', () => {
  // From the middle of Battlefield Ramp Jump carries Wheely 62 units forward and 69 up, and his helpless fall keeps
  // that speed: with nothing held he is KO'd. Held back from frame 25, after the move's last hit, he lands.
  it.each([1, -1] as const)(
    "Wheely's Ramp Jump from the middle of Battlefield, facing %d, lands on the stage",
    (side) => {
      for (const seed of [1, 2, 3]) {
        const r = play('wheely', 0, side, RAMP_JUMP, seed);
        expect(r.end, `seed ${seed}`).toBe('landed');
        expect(r.out, `seed ${seed}`).toBeLessThan(80);
      }
    },
    60_000,
  );

  // From 15 units further out, steering after the last hit is too late: the CPU steers from as late as still lands.
  it.each([1, -1] as const)(
    "Wheely's Ramp Jump from 15 units past the middle, facing %d, lands on the stage",
    (side) => {
      const r = play('wheely', 15, side, RAMP_JUMP);
      expect(r.end).toBe('landed');
      expect(r.out).toBeLessThan(80);
    },
    60_000,
  );

  // Raft Wars' back air shoves them forward at 1.4 units a frame past their air speed, which the CPU's arc for an
  // aerial (look.ts) leaves out. From 35 units inside the ledge it carried them 17 units past it before they got back.
  it.each([1, -1] as const)(
    "Raft Wars' short-hop back air near the %d ledge stays over the stage",
    (side) => {
      const r = play('raftwars', 45, side, { kind: 'jump', move: 'bair' });
      expect(r.end).toBe('landed');
      expect(r.out).toBeLessThan(80);
    },
    60_000,
  );
});

describe('attacks that already come down on the stage', () => {
  // Where each lands and on which frame, on main. The CPU plays them out first, finds them landing, and leaves them be.
  it.each([
    ['wheely', -20, RAMP_JUMP, 78.18, 87],
    ['raftwars', 20, { kind: 'jump', move: 'bair' }, 55.14, 41],
    ['raftwars', 45, { kind: 'jump', move: 'fair', drift: 1 }, 74.65, 41],
    ['fireboy', 0, { kind: 'ground', move: 'upB' }, 0, 45],
    ['fireboy', 40, { kind: 'jump', move: 'fair', drift: 1 }, 79.3, 41],
    ['duck', 0, { kind: 'ground', move: 'sideB' }, 59.26, 55],
  ] as const)('%s from x %d: %o lands where it does on main', (fighter, x, attack, landX, frame) => {
    const r = play(fighter, x, 1, attack);
    expect(r.end).toBe('landed');
    expect(r.x).toBeCloseTo(landX, 1);
    expect(r.frame).toBe(frame);
  });
});
