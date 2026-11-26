import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { Btn, neutralInput } from '../input/types';
import { spawnEntity } from '../sim/entities/entities';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { createCpu } from './index';
import { press } from './inputs';
import { knowledge } from './knowledge';
import { run, soloMatch } from './look';
import { shotHit } from './shots';
import { floorBelow, stageInfo } from './stage';

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

  it('record charged specials tapped and held: the Stun Gun to its full charge, Aimed Shot to 40 frames', () => {
    const p = knowledge('bob-the-robber', STAGE).ground.neutralB!;
    const tap = p.spawns[0]!;
    expect(p.held).toBeUndefined();
    expect([p.spawns.length, tap.kind, tap.t, tap.vx, tap.lifetime, tap.box?.damage, p.busy]).toEqual([
      1,
      'bob-the-robber/stunShot',
      20,
      2.2,
      24,
      4,
      48,
    ]);
    expect(p.shot!.x2).toBeCloseTo(61.5, 1);
    const c = p.charged!;
    const full = c.spawns[0]!;
    expect(c.held).toBe(22);
    expect([c.spawns.length, full.kind, full.t, full.vx, full.lifetime, full.box?.damage, c.busy]).toEqual([
      1,
      'bob-the-robber/stunShotFull',
      42,
      1.8,
      48,
      6,
      70,
    ]);
    expect(c.shot!.x2).toBeGreaterThan(95);

    // Raft Wars' Aimed Shot charges for up to 112 frames and fires 3 after the release. The CPU holds it for 40: the
    // ball comes out on frame 56 with 13.2% (2.64 times the tap's 5%), flying further and faster.
    const a = knowledge('raftwars', STAGE).ground.neutralB!;
    const ball = a.spawns[0]!;
    expect([a.held, ball.kind, ball.t, ball.damageMul, ball.box?.damage, a.busy]).toEqual([
      undefined,
      'raftwars/aimedShot',
      15,
      1,
      5,
      44,
    ]);
    const ac = a.charged!;
    const held = ac.spawns[0]!;
    expect([ac.held, held.kind, held.t, ac.busy]).toEqual([40, 'raftwars/aimedShot', 55, 84]);
    expect(held.damageMul * held.box!.damage).toBeCloseTo(5 + (23 * 40) / 112, 5);
    expect(held.vx).toBeGreaterThan(ball.vx);
    expect(ac.shot!.x2).toBeGreaterThan(a.shot!.x2 + 50);

    // Smash attacks charge on Attack, not Special, and are left tapped; so is every move without a charge frame.
    // Wheely's Rev Up charges by itself (`storeCharge.tap`): its charged probe is pressed again after 40 frames of
    // charge (src/fighters/wheely/revUp.test.ts).
    const charged = Object.keys(allFighters()).flatMap((id) =>
      Object.entries(knowledge(id, STAGE).ground)
        .filter(([, q]) => q.charged)
        .map(([name]) => `${id} ${name}`),
    );
    expect(charged).toEqual(['bob-the-robber neutralB', 'raftwars neutralB', 'wheely neutralB']);
    expect(knowledge('wheely', STAGE).ground.neutralB!.charged!.held).toBe(40);
  });

  it("report a back air shot's own facing and position as it hits, which it launches from", () => {
    // Raft Wars' back air fires its recoil shot behind the kids: facing right, the shot faces left.
    const m = facingOff('raftwars', 0, -30);
    const [me, opp] = m.fighters;
    const p = knowledge('raftwars', STAGE).air.bair!;
    const path = run(soloMatch(m, opp!), 60);
    const hit = shotHit(m, me!, p, 0, 1, (s) => ({ x: me!.pos.x + s.dx, y: me!.pos.y + s.dy }), {
      path,
      errX: 0,
    });
    expect(hit?.box.direction ?? 'forward').toBe('forward');
    expect(hit?.facing).toBe(-1);
    expect(hit!.x).toBeLessThan(-8);
  });

  it("spend a shot on another player's raft in its way, as the match does, and pass one through the shooter's own", () => {
    // Fireboy's Fireball at a Raft Wars 80 units off, with a Duck Raft resting on the floor halfway. Raft Wars' raft
    // takes the Fireball; one of Fireboy's own lets it by, as a fighter's entities ignore each other.
    for (const [owner, lands] of [
      [1, false],
      [0, true],
    ] as const) {
      const m = createMatch({
        seed: 1,
        stage: STAGE,
        stocks: 3,
        ports: [{ fighter: 'fireboy' }, { fighter: 'raftwars' }],
      });
      for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
      Object.assign(m.fighters[0]!, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 }, facing: 1 });
      Object.assign(m.fighters[1]!, { pos: { x: 40, y: 0 }, prevPos: { x: 40, y: 0 }, facing: -1 });
      spawnEntity(m, { kind: 'raftwars/duckRaft', owner, pos: { x: 0, y: 2.5 } });
      const [me, opp] = m.fighters;
      const p = knowledge('fireboy', STAGE).ground.neutralB!;
      const path = run(soloMatch(m, opp!), 110);
      const hit = shotHit(m, me!, p, 0, 1, (s) => ({ x: me!.pos.x + s.dx, y: me!.pos.y + s.dy }), {
        path,
        errX: 0,
      });
      expect(hit !== null, `raft of port ${owner}`).toBe(lands);
      const real = structuredClone(m);
      let struck = false;
      for (let i = 0; i < 110 && !struck; i++) {
        stepMatch(real, [i === 0 ? press({ buttons: Btn.Special }) : neutralInput(), neutralInput()]);
        struck = real.events.some((e) => e.type === 'hit' && e.victim === 1);
      }
      expect(struck, `raft of port ${owner}, in the match`).toBe(lands);
    }
  });

  it('find every fighter whose moves shoot, and nothing on moves that spawn nothing', () => {
    expect(SHOOTERS).toEqual([
      'bob-the-robber',
      'duck',
      'fireboy',
      'fluffy',
      'johnny',
      'papa-louie',
      'raftwars',
      'snailbob',
    ]);
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
      // crate) need the CPU to walk in first, and Fluffy's 64-unit forward smash outreaches its candy. Bob the
      // Robber's reach is his tapped Stun Gun's (61 units); the charged one is tested on its own below.
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

  it("tap Bob the Robber's Stun Gun in its reach and charge it at an opponent who can't close in first", () => {
    /** The first shot Bob fires at a Red Ball `d` away, stuck in `lag` frames of landing lag, and its paralysis. */
    function firstShot(
      d: number,
      lag: number,
      seed: number,
    ): { shot: string; at: number; paralysis: number } {
      const m = facingOff('bob-the-robber', -d / 2, d, seed);
      if (lag) Object.assign(m.fighters[1]!, { action: 'land', actionFrame: 1, landingLag: lag });
      const cpu = createCpu({ port: 0, level: 9, seed });
      const out = { shot: '', at: -1, paralysis: 0 };
      for (let i = 0; i < 200 && !out.paralysis; i++) {
        stepMatch(m, [cpu.input(m), neutralInput()]);
        for (const e of m.events) {
          if (e.type === 'entitySpawn' && e.owner === 0 && !out.shot)
            Object.assign(out, { shot: e.kind, at: i });
          if (e.type === 'statusStart' && e.port === 1) out.paralysis = e.frames;
        }
      }
      return out;
    }
    for (const seed of [1, 2]) {
      // A standing opponent who runs in meets the tapped shot (out on frame 21) before its jab can land.
      expect(firstShot(60, 0, seed), `60, seed ${seed}`).toEqual({
        shot: 'bob-the-robber/stunShot',
        at: 20,
        paralysis: 25,
      });
      // Past the tap's 61 units, an opponent stuck landing can't reach him before the full charge is out.
      expect(firstShot(80, 20, seed), `80, seed ${seed}`).toEqual({
        shot: 'bob-the-robber/stunShotFull',
        at: 42,
        paralysis: 52,
      });
    }
  });

  it("drop Snail Bob's crate onto an opponent over the stage that stood 60 or 80 units away", () => {
    // Crate Drop is 10% since #257. Without his CPU's 1.2 preference his down air outscores it, and at 60 units he
    // never drops it. The crate has to land on the Red Ball while it is over the stage: at 60 units it catches the Red
    // Ball his side special launched (frame 86), at 80 units a standing one (frames 200 and 202). At 90 units his
    // other hits knock the Red Ball off the stage first, and on seeds 1 to 4 every crate he drops in 600 frames falls
    // past the ledge at it about 119 units below.
    for (const d of [60, 80]) {
      for (const seed of [1, 2]) {
        const m = facingOff('snailbob', -d / 2, d, seed);
        const cpu = createCpu({ port: 0, level: 9, seed });
        const crates = new Set<number>();
        let landed = -1;
        for (let i = 0; i < 300 && landed < 0; i++) {
          stepMatch(m, [cpu.input(m), neutralInput()]);
          const o = m.fighters[1]!;
          for (const e of m.events) {
            if (e.type === 'entitySpawn' && e.owner === 0 && e.kind === 'snailbob/crateFall')
              crates.add(e.id);
            const crate =
              e.type === 'hit' && e.attacker === 0 && e.entity !== undefined && crates.has(e.entity);
            if (crate && floorBelow(stageInfo(m), o.pos.x, o.pos.y) !== null) landed = i;
          }
        }
        expect(landed, `${d}, seed ${seed}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  /**
   * Eight 30-second matches per level against a level 5 Red Ball. Snail Bob's crate is slow and lands only 20 units
   * ahead, so he throws it a few times a match: with three seeds he had 3 hits at level 9 against 1 at level 3, and
   * #217 (solid ceilings) shifted two of those matches to 1 against 1. Over eight seeds he has 8 against 1 (5 against
   * 1 before his CPU's crate preference), and every other shooter's gap is wider.
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

  it('stop shooting a held shield once they see it, even when the shot would KO', () => {
    // A Red Ball at 200% shielding 80-100 units from a level 9 Raft Wars, whose jab, tilts and aerials are all shots.
    // The move on frame 0 comes before the CPU's reaction lag shows it the shield (a charged Aimed Shot started then
    // fires on frame 55); no shot started after that, while it is still far off, as it walks in for the grab.
    for (const d of [80, 100]) {
      for (const seed of [1, 2]) {
        const m = facingOff('raftwars', -d / 2, d, seed);
        m.fighters[1]!.damage = 200;
        const cpu = createCpu({ port: 0, level: 9, seed });
        const late: number[] = [];
        let started = -1;
        for (let i = 0; i < 90; i++) {
          stepMatch(m, [cpu.input(m), press({ buttons: Btn.Shield })]);
          const far = Math.abs(m.fighters[1]!.pos.x - m.fighters[0]!.pos.x) > 45;
          for (const e of m.events) {
            if (e.type === 'move' && e.port === 0) started = i;
            if (e.type === 'entitySpawn' && e.owner === 0 && started >= 30 && far) late.push(started);
          }
        }
        expect(late, `${d}, seed ${seed}`).toEqual([]);
      }
    }
  });

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

  it("count on their own shots already out: Raft Wars' Aimed Shots connect with a standing Red Ball", () => {
    // The setups from the captures: a Red Ball 80-120 units away, seeds 1 to 6. Before his look-ahead of the Red Ball
    // held his own entities, he fired 18 Aimed Shots held to 40 frames here and hit with one. At 90 units on seed 1
    // his grenade from frame 0 bursts on the Red Ball on frame 105 and launches it over the ball that came out on
    // frame 97. With his entities in it, he also sees a shot of his land inside his 8 frames of reaction time, and no
    // longer starts charging at a Red Ball it just knocked toward the ledge (80 units, seed 1: hit on frame 141,
    // charging from 145, the Red Ball off the stage when the ball comes out).
    // A tapped one fired while the Red Ball still stands where it started has to reach it too. With his spacing error
    // in the shot's flight, at 90 units on seed 1 one came out on frame 59 and the floor took it on frame 96, 0.04
    // units short of the Red Ball on the frame before. Now he taps from 2 frames further in and it hits on frame 95.
    const fired = { held: 0, tapped: 0 };
    const missed: string[] = [];
    for (const d of [80, 90, 100, 110, 120]) {
      for (let seed = 1; seed <= 6; seed++) {
        const m = facingOff('raftwars', -d / 2, d, seed);
        const cpu = createCpu({ port: 0, level: 9, seed });
        const out = new Map<number, string>();
        let charged = false;
        let touched = false;
        for (let i = 0; i < 420; i++) {
          stepMatch(m, [cpu.input(m), neutralInput()]);
          for (const e of m.events) {
            // The sim reports a charged release; the ball comes out 3 frames later.
            if (e.type === 'charge' && e.port === 0 && e.phase === 'fire' && e.move.startsWith('neutralB'))
              charged = true;
            if (e.type === 'entitySpawn' && e.owner === 0 && e.kind === 'raftwars/aimedShot') {
              const kind = charged ? 'held' : 'tapped';
              if (charged || !touched) {
                out.set(e.id, `${d}, seed ${seed}: ${kind}, out on frame ${i}`);
                fired[kind]++;
              }
              charged = false;
            }
            if (e.type === 'hit' && e.entity !== undefined) out.delete(e.entity);
            if (e.type === 'hit' && e.victim === 1) touched = true;
          }
        }
        missed.push(...out.values());
      }
    }
    expect(fired.held).toBeGreaterThan(0);
    expect(fired.tapped).toBeGreaterThan(0);
    expect(missed).toEqual([]);
  }, 60_000);

  it('spend no long shot on an opponent falling far below the stage', () => {
    // A Red Ball falling 35-45 units under the right ledge with three jumps left and no input, Raft Wars standing near
    // the middle, as in the captures (80 units, seed 1: charging from frame 199 at a Red Ball 50 units below, the ball
    // out on frame 254, the Red Ball KO'd on frame 263). The CPU assumes it recovers (assumedInput in cpu.ts), and a
    // held Aimed Shot or a grenade at the ledge where it would come back scored as a hit.
    for (const [x, y] of [
      [111, -40],
      [119, -45],
      [110, -35],
    ] as const) {
      for (const seed of [1, 2]) {
        const m = facingOff('raftwars', 0, 30, seed);
        Object.assign(m.fighters[1]!, {
          pos: { x, y },
          prevPos: { x, y: y + 1.4 },
          vel: { x: 0, y: -1.4 },
          ground: null,
          action: 'fall',
          actionFrame: 20,
          jumpsUsed: 1,
          damage: 20,
        });
        const cpu = createCpu({ port: 0, level: 9, seed });
        const long: string[] = [];
        let started = -1;
        for (let i = 0; i < 120; i++) {
          stepMatch(m, [cpu.input(m), neutralInput()]);
          for (const e of m.events) {
            if (e.type === 'move' && e.port === 0) started = i;
            const held =
              e.type === 'charge' && e.port === 0 && e.phase === 'fire' && e.move.startsWith('neutralB');
            const grenade = e.type === 'entitySpawn' && e.owner === 0 && e.kind === 'raftwars/grenade';
            if (held || grenade)
              long.push(`${held ? 'held Aimed Shot' : 'grenade'} started on frame ${started}`);
          }
        }
        expect(long, `${x}, ${y}, seed ${seed}`).toEqual([]);
      }
    }
  });
});
