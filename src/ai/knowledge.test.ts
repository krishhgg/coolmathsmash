import { describe, expect, it } from 'vitest';
import { STUN_GUN } from '../fighters/bob-the-robber/entities';
import { allFighters, getFighter } from '../fighters/registry';
import type { HitboxDef, MoveDef } from '../fighters/types';
import { neutralInput } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import { STAGES } from '../stages/registry';
import { runCpuMatch } from './bench';
import { hintsFor } from './hints';
import { createCpu } from './index';
import { AERIALS, SPECIALS } from './inputs';
import { knowledge, type MoveProbe } from './knowledge';
import { drill } from './testing/recovery';

const STAGE = 'battlefield';

/** Every hitbox the move's hits put out. */
const boxesOf = (m: MoveDef): HitboxDef[] => m.hits.flatMap((h) => h.boxes);

/** Every hitbox the probe saw come out. */
const seen = (p: MoveProbe): HitboxDef[] => p.active.flatMap((a) => a.boxes.map((b) => b.box));

/** The move `name` of `fighter`, which must exist. */
const moveOf = (fighter: string, name: string): MoveDef => getFighter(fighter).moves![name]!;

describe('air probes of specials with an air variant', () => {
  it('play the variant the engine plays, for every fighter', () => {
    const variants = Object.values(allFighters()).flatMap((def) =>
      SPECIALS.flatMap((name) => {
        const air = def.moves?.[name]?.air;
        return air ? [{ fighter: def.id, name, air }] : [];
      }),
    );
    expect(variants.length).toBeGreaterThanOrEqual(5);
    for (const { fighter, name, air } of variants) {
      const p = knowledge(fighter, STAGE).air[name];
      const v = moveOf(fighter, air);
      expect(p, `${fighter} ${name} in the air`).toBeDefined();
      expect(p!.plays).toBe(air);
      expect(p!.def).toBe(v);
      if (!v.hits.length) continue;
      expect(p!.first, `${fighter} ${air}`).toBe(Math.min(...v.hits.map((h) => h.frames[0])) - 1);
      expect(seen(p!).every((b) => boxesOf(v).includes(b))).toBe(true);
    }
  });

  it.each([
    ['runner', 'neutralB', 'neutralBAir'],
    ['runner', 'downB', 'downBAir'],
    ['redball', 'sideB', 'sideBAir'],
  ])("give %s's air %s the hitboxes of %s, not the grounded move's", (fighter, name, air) => {
    const k = knowledge(fighter, STAGE);
    const p = k.air[name]!;
    const v = moveOf(fighter, air);
    expect(p.first).toBe(v.hits[0]!.frames[0] - 1);
    expect(p.last).toBe(Math.max(...v.hits.map((h) => h.frames[1])) - 1);
    expect(seen(p).length).toBeGreaterThan(0);
    expect(seen(p).every((b) => boxesOf(v).includes(b))).toBe(true);
    expect(seen(p).some((b) => boxesOf(moveOf(fighter, name)).includes(b))).toBe(false);
    expect(k.ground[name]!.plays).toBe(name);
  });

  it("put out Runner's spike, Red Ball's air vine and Runner's 4% kick", () => {
    const runner = knowledge('runner', STAGE);
    expect(seen(runner.air.downB!).every((b) => b.angle === 270)).toBe(true);
    expect(seen(runner.ground.downB!).every((b) => b.angle === 25)).toBe(true);
    expect(runner.air.neutralB!.damage).toBe(4);
    expect(runner.ground.neutralB!.damage).toBe(8);
    const redball = knowledge('redball', STAGE);
    expect(Math.min(...seen(redball.air.sideB!).map((b) => b.bkb))).toBe(40);
    expect(Math.min(...seen(redball.ground.sideB!).map((b) => b.bkb))).toBe(50);
  });

  it("fire Bob the Robber's Stun Gun and Johnny's Laser Gun on their air frames", () => {
    const bob = knowledge('bob-the-robber', STAGE).air.neutralB!;
    expect(bob.plays).toBe('neutralBAir');
    expect(bob.spawns.map((s) => [s.kind, s.t])).toEqual([['bob-the-robber/stunShot', STUN_GUN.shot - 1]]);
    expect(bob.shot).not.toBeNull();
    const johnny = knowledge('johnny', STAGE);
    const laser = (name: string) => moveOf('johnny', name).spawn![0]!;
    expect(johnny.air.neutralB!.spawns[0]!.t).toBe(laser('neutralBAir').frame - 1);
    expect(johnny.ground.neutralB!.spawns[0]!.t).toBe(laser('neutralB').frame - 1);
    expect(johnny.air.neutralB!.spawns[0]!.t).toBeLessThan(johnny.ground.neutralB!.spawns[0]!.t);
    expect(johnny.air.neutralB!.shot).not.toBeNull();
  });
});

describe('CPUs and air variants', () => {
  it("lash a Red Ball with no jumps left back to Battlefield's ledge with his air Tongue Lash", () => {
    // 40 units out from the right ledge at its height: the up special gets back from here too, but the tether is
    // the quicker way, and a level 9 CPU takes it.
    const m = drill(STAGE, 120, 0, 'redball');
    const f = m.fighters[0]!;
    f.jumpsUsed = getFighter('redball').stats.jumps;
    const cpu = createCpu({ port: 0, level: 9, seed: 5 });
    const path: string[] = [];
    for (let i = 0; i < 600 && f.action !== 'ledgeHang' && f.stocks === 3; i++) {
      stepMatch(m, [cpu.input(m), neutralInput()]);
      const at = `${f.action}${f.move ? `:${f.move}` : ''}`;
      if (path.at(-1) !== at) path.push(at);
    }
    expect(f.stocks).toBe(3);
    expect(path).toEqual(['aerial:sideBAir', 'tetherPull:sideBAir', 'ledgeCatch', 'ledgeHang']);
  });

  it('play their air side specials in a level 9 match, Red Ball against Runner', () => {
    const m = createMatch({
      seed: 1,
      stage: STAGE,
      stocks: 3,
      ports: [{ fighter: 'redball' }, { fighter: 'runner' }],
    });
    const cpus = [0, 1].map((port) => createCpu({ port, level: 9, seed: 7919 + port }));
    const uses = [0, 0];
    while (m.frame < 8 * 60 * 60 && m.fighters.every((f) => f.stocks > 0)) {
      stepMatch(
        m,
        cpus.map((c) => c.input(m)),
      );
      for (const e of m.events) if (e.type === 'move' && e.move === 'sideBAir') uses[e.port]!++;
    }
    expect(uses[0]).toBeGreaterThan(0);
    expect(uses[1]).toBeGreaterThan(0);
  }, 60_000);
});

describe('air probes of moves that end in a helpless fall', () => {
  // The air probe starts every move above the stage's middle. A helpless fall after a move drifts on with its speed,
  // and from there Wheely's Ramp Jump, which carries him 65 units sideways, falls out past the side. Before, that KO
  // dropped the move, so his CPU never knew it had an up special in the air. On smaller stages the same happened to
  // Bloxorz's, Fireboy's and Johnny's on Bloxorz Platform and Duck's on Coolmath Planet, Run Tunnel and World's
  // Hardest Game.
  it('know every aerial and special a fighter has in the air, on every stage, unless the move itself KOs it', () => {
    const missing: string[] = [];
    for (const [id, def] of Object.entries(allFighters())) {
      const avoid = new Set(hintsFor(id).avoid ?? []);
      for (const stage of Object.keys(STAGES)) {
        const k = knowledge(id, stage);
        for (const name of [...AERIALS, ...SPECIALS]) {
          if (def.moves?.[name] && !avoid.has(name) && !k.air[name])
            missing.push(`${id} ${name} on ${stage}`);
        }
      }
    }
    // What is still dropped is carried out of the blast zone by the move itself, from where the probe starts it,
    // 100 above the stage's middle: down specials plunge through the gap in Bloxorz Platform's middle to the bottom,
    // and Fluffy's up special rises through the top on the three stages whose top blast zone is 180.
    expect(missing.sort()).toEqual([
      'bloxorz downB on bloxorz-platform',
      'bloxorz-lying downB on bloxorz-platform',
      'fluffy upB on coolmath-planet',
      'fluffy upB on run-tunnel',
      'fluffy upB on worlds-hardest-game',
      'runner downB on bloxorz-platform',
      'snailbob downB on bloxorz-platform',
    ]);
  });

  it("keep Wheely's Ramp Jump in the air: where it carries him, and helpless after it", () => {
    const k = knowledge('wheely', STAGE);
    const p = k.air.upB!;
    expect(p.plays).toBe('upB');
    expect(p.helpless).toBe(true);
    expect(p.endsGrounded).toBe(false);
    expect(p.endDx).toBeGreaterThan(55);
    expect(p.endDy).toBeGreaterThan(55);
    // On the ground the CPU's attacks trust the probe to land them safely, so a fall out of the blast zone after the
    // move still drops it there.
    expect(k.ground.upB).toBeUndefined();
  });

  // 60 units beside either ledge, 20 and 50 under it, with the double jump left (src/ai/testing/recovery.ts). Before,
  // a level 9 Wheely was KO'd from all four on every seed.
  it.each([
    [-140, -20],
    [-140, -50],
    [140, -20],
    [140, -50],
  ])('a level 9 Wheely Ramp Jumps back to the stage from (%d, %d) on every seed', (x, y) => {
    const ends: string[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const m = drill(STAGE, x, y, 'wheely');
      const f = m.fighters[0]!;
      const cpu = createCpu({ port: 0, level: 9, seed });
      let ramp = false;
      let end = 'stuck';
      for (let i = 0; i < 600; i++) {
        stepMatch(m, [cpu.input(m), neutralInput()]);
        if (f.move === 'upB') ramp = true;
        if (f.stocks < 3) end = 'ko';
        else if (f.ground !== null || f.action === 'ledgeHang') end = 'back';
        if (end !== 'stuck') break;
      }
      ends.push(`seed ${seed}: ${end}${ramp ? ' with Ramp Jump' : ''}`);
    }
    expect(ends).toEqual([1, 2, 3, 4, 5].map((seed) => `seed ${seed}: back with Ramp Jump`));
  });
});

describe('a recovery that carries the CPU back over the stage', () => {
  // Level 9 against level 9 on Battlefield (src/ai/bench.ts). Wheely drifts past the right edge and Ramp Jumps, which
  // carries him back over the stage at 2.2 units a frame. The CPU used to drop its recovery plan once there was stage
  // under him and give no input in the helpless fall over the stage's middle, so he drifted off the left side and
  // self-destructed on frame 5156. The plan steers through that fall, as the planner checked it.
  it('keeps steering its helpless fall, so a level 9 Wheely does not self-destruct in seed 1 against Johnny', () => {
    const r = runCpuMatch({ seed: 1, levels: [9, 9], fighters: ['wheely', 'johnny'], maxFrames: 5156 + 60 });
    expect(r.kos.filter((k) => k.selfDestruct)).toEqual([]);
  }, 60_000);
});
