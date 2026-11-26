import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { createCpu } from './index';
import { knowledge } from './knowledge';

const STAGE = 'battlefield';
/** Every fighter with a move whose entity has hitboxes, found by probing, not listed by hand. */
const SHOOTERS = Object.keys(allFighters()).filter((id) => knowledge(id, STAGE).shoots);

/** Port 0 a `fighter` at x, port 1 a Red Ball at x + d, both standing on Battlefield. */
function facingOff(fighter: string, x: number, d: number, seed = 1): MatchState {
  const m = createMatch({ seed, stage: STAGE, stocks: 3, ports: [{ fighter }, { fighter: 'redball' }] });
  for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  Object.assign(m.fighters[0]!, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing: 1 });
  Object.assign(m.fighters[1]!, { pos: { x: x + d, y: 0 }, prevPos: { x: x + d, y: 0 }, facing: -1 });
  return m;
}

/** How far a fighter's farthest grounded shot reaches from where it stands, from its probes. */
function shotReach(fighter: string): number {
  const k = knowledge(fighter, STAGE);
  return Math.max(
    ...Object.values(k.ground).map((p) => (p.shot ? p.shot.x2 + p.spawns[0]!.dx - p.spawns[0]!.ox : 0)),
  );
}

describe('move probes', () => {
  it("record the Fireball as Fireboy's neutral special puts it out", () => {
    const p = knowledge('fireboy', STAGE).ground.neutralB!;
    expect(p.first).toBe(-1);
    expect(p.spawns).toHaveLength(1);
    const s = p.spawns[0]!;
    expect(s.kind).toBe('fireboy/fireball');
    expect(s.t).toBe(16);
    expect([s.ox, s.oy, s.vx, s.vy]).toEqual([6, 8, 1.4, -0.6]);
    expect(s.lifetime).toBe(70);
    expect(s.box?.damage).toBe(5.5);
    expect(p.shot!.from).toBe(16);
    expect(p.shot!.x2).toBeGreaterThan(95);
  });

  it("credit a grenade's burst to the grenade and read the move's cap", () => {
    const s = knowledge('raftwars', STAGE).ground.sideB!.spawns;
    expect(s.map((x) => x.kind)).toEqual(['raftwars/grenade']);
    expect(s[0]!.box?.damage).toBe(13);
    expect(s[0]!.max).toBe(2);
  });

  it('find every fighter whose moves shoot, and nothing on moves that spawn nothing', () => {
    expect(SHOOTERS).toEqual(['duck', 'fireboy', 'fluffy', 'johnny', 'papa-louie', 'raftwars', 'snailbob']);
    const k = knowledge('redball', STAGE);
    expect(k.shoots).toBe(false);
    for (const p of [...Object.values(k.ground), ...Object.values(k.air)]) {
      expect(p.spawns).toEqual([]);
      expect(p.shot).toBeNull();
    }
  });
});

describe('CPU projectiles', () => {
  it('fire at an opponent standing 60-120 units away', () => {
    for (const id of SHOOTERS) {
      // As far as its shot reaches, within 60-120. Shots shorter than 60 (Duck's Seeds, Fluffy's candy, Snail Bob's
      // crate) need the CPU to walk in first, and Fluffy's 64-unit forward smash outreaches its candy.
      const reach = shotReach(id);
      const d = Math.round(Math.min(120, Math.max(60, reach - 4)));
      for (const seed of [1, 2]) {
        const m = facingOff(id, -d / 2, d, seed);
        const cpu = createCpu({ port: 0, level: 9, seed });
        let fired = -1;
        let first: 'shot' | 'melee' | null = null;
        for (let i = 0; i < 300 && fired < 0; i++) {
          stepMatch(m, [cpu.input(m), neutralInput()]);
          for (const e of m.events) {
            if (e.type === 'entitySpawn' && e.owner === 0) fired = i;
            if (e.type === 'hit' && e.attacker === 0) first ??= e.entity === undefined ? 'melee' : 'shot';
          }
        }
        expect(fired, `${id} at ${d}, seed ${seed}`).toBeGreaterThanOrEqual(0);
        if (reach >= 64) {
          expect(fired, `${id} at ${d}, seed ${seed}: fires before walking in`).toBeLessThan(30);
          expect(first, `${id} at ${d}, seed ${seed}`).not.toBe('melee');
        }
      }
    }
  });

  /**
   * Eight 30-second matches per level against a level 5 Red Ball. Snail Bob's crate is slow and lands only 20 units
   * ahead, so he throws it a few times a match: with three seeds he had 3 hits at level 9 against 1 at level 3, and
   * #217 (solid ceilings) shifted two of those matches to 1 against 1. Over eight seeds he has 5-6 against 1 on
   * either side of that change, and every other shooter's gap is wider.
   */
  it.each(SHOOTERS)(
    'hit with them more often at level 9 than at level 3: %s',
    (id) => {
      const hits: Record<number, number> = {};
      for (const level of [9, 3]) {
        hits[level] = 0;
        for (let seed = 1; seed <= 8; seed++) {
          const m = createMatch({
            seed,
            stage: STAGE,
            stocks: 3,
            ports: [{ fighter: id }, { fighter: 'redball' }],
          });
          const cpus = [
            createCpu({ port: 0, level, seed }),
            createCpu({ port: 1, level: 5, seed: seed + 100 }),
          ];
          for (let i = 0; i < 1800; i++) {
            stepMatch(
              m,
              cpus.map((c) => c.input(m)),
            );
            for (const e of m.events) {
              if (e.type === 'hit' && e.attacker === 0 && e.entity !== undefined) hits[level]++;
            }
          }
        }
      }
      expect(hits[9], `shot hits against a level 5 Red Ball`).toBeGreaterThan(hits[3]!);
    },
    60_000,
  );

  it('shoot an opponent recovering from beside the stage', () => {
    for (const id of ['raftwars', 'papa-louie']) {
      for (const seed of [1, 2]) {
        const m = facingOff(id, 60, 60, seed);
        Object.assign(m.fighters[1]!, {
          pos: { x: 120, y: -10 },
          prevPos: { x: 120, y: -10 },
          ground: null,
          action: 'fall',
          actionFrame: 1,
          jumpsUsed: 2,
        });
        const cpus = [
          createCpu({ port: 0, level: 9, seed }),
          createCpu({ port: 1, level: 5, seed: seed + 9 }),
        ];
        let hit = -1;
        for (let i = 0; i < 60 && hit < 0; i++) {
          stepMatch(
            m,
            cpus.map((c) => c.input(m)),
          );
          if (m.events.some((e) => e.type === 'hit' && e.attacker === 0 && e.entity !== undefined)) hit = i;
        }
        expect(hit, `${id}, seed ${seed}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
