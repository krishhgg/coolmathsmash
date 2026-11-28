import { describe, expect, it } from 'vitest';
import { Btn, neutralInput } from '../input/types';
import { spawnEntity } from '../sim/entities/entities';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { LASER } from '../fighters/johnny/entities';
import { registerStage } from '../stages/registry';
import { stage as runTunnel } from '../stages/run-tunnel/geometry';
import { createCpu } from './index';
import { press } from './inputs';
import { knowledge } from './knowledge';
import { run, soloMatch } from './look';
import { seenShots, shotHit, shotThreat } from './shots';

const STAGE = 'battlefield';

/** Port 0 a Fireboy at x -40 facing right, port 1 a Fireboy at x 40 facing left, standing on Battlefield. */
function duel(): MatchState {
  const m = createMatch({
    seed: 1,
    stage: STAGE,
    stocks: 3,
    ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
  });
  for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  Object.assign(m.fighters[0]!, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 }, facing: 1 });
  Object.assign(m.fighters[1]!, { pos: { x: 40, y: 0 }, prevPos: { x: 40, y: 0 }, facing: -1 });
  return m;
}

/** Port 1's Fireball, put out in front of it heading left as its neutral special puts one out, `ahead` frames ago. */
function incoming(m: MatchState, ahead: number): void {
  const s = knowledge('fireboy', STAGE).ground.neutralB!.spawns[0]!;
  const f = m.fighters[1]!;
  const e = spawnEntity(m, {
    kind: s.kind,
    owner: 1,
    pos: { x: f.pos.x - s.ox - s.vx * ahead, y: f.pos.y + s.oy },
  });
  Object.assign(e, {
    age: 1 + ahead,
    vel: { x: -s.vx, y: s.vy },
    facing: -1,
    lifetime: s.lifetime,
    data: { ...s.data },
  });
}

function fireball(m: MatchState) {
  const [me, opp] = m.fighters;
  const p = knowledge('fireboy', STAGE).ground.neutralB!;
  const path = run(soloMatch(m, opp!), 110);
  return shotHit(m, me!, p, 0, 1, (s) => ({ x: me!.pos.x + s.dx, y: me!.pos.y + s.dy }), {
    path,
    errX: 0,
    seen: seenShots(m, me!, 0),
  });
}

describe("CPUs and their opponent's shots", () => {
  it("count a Fireball that would clank with the opponent's coming the other way as no hit, as the match has it", () => {
    expect(fireball(duel())).not.toBeNull();

    const m = duel();
    incoming(m, 10);
    expect(fireball(m)).toBeNull();
    // In the match the two Fireballs clank and the other Fireboy is never hit.
    const clanks: number[] = [];
    let struck = false;
    for (let i = 0; i < 110; i++) {
      stepMatch(m, [i === 0 ? press({ buttons: Btn.Special }) : neutralInput(), neutralInput()]);
      for (const e of m.events) if (e.type === 'entityDestroy' && e.reason === 'clank') clanks.push(e.id);
      struck ||= m.events.some((e) => e.type === 'hit' && e.victim === 1);
    }
    expect(clanks).toHaveLength(2);
    expect(struck).toBe(false);
  });

  it("count a Fireball as a hit when its own Fireball already out clanks the opponent's first, as the match has it", () => {
    // Port 0's Fireball just out at x -34 heads right, port 1's at x -4 heads left: they meet first, and a new
    // Fireball from port 0 then flies clear.
    const m = duel();
    const s = knowledge('fireboy', STAGE).ground.neutralB!.spawns[0]!;
    for (const [owner, x, dir] of [
      [0, -34, 1],
      [1, -4, -1],
    ] as const) {
      const e = spawnEntity(m, { kind: s.kind, owner, pos: { x, y: s.oy } });
      Object.assign(e, { age: 1, vel: { x: s.vx * dir, y: s.vy }, facing: dir, lifetime: s.lifetime });
    }
    const hit = fireball(m);
    expect(hit).not.toBeNull();
    // In the match the first two clank, and the new Fireball hits port 1 on the frame the CPU predicted.
    let clankAt = -1;
    let hitAt = -1;
    for (let i = 0; i < 110 && hitAt < 0; i++) {
      stepMatch(m, [i === 0 ? press({ buttons: Btn.Special }) : neutralInput(), neutralInput()]);
      if (clankAt < 0 && m.events.some((e) => e.type === 'entityDestroy' && e.reason === 'clank'))
        clankAt = i;
      if (m.events.some((e) => e.type === 'hit' && e.victim === 1)) hitAt = i;
    }
    expect(clankAt).toBeGreaterThanOrEqual(0);
    expect(clankAt).toBeLessThan(hitAt);
    expect(hitAt).toBe(hit!.t);
  });

  it("see the opponent's Fireball coming as a threat, on the frame it would hit", () => {
    expect(shotThreat(duel(), duel().fighters[0]!, [], [], 36)).toBeNull();
    // Port 1 fires; 40 frames later its Fireball is about 40 units from port 0.
    const m = duel();
    for (let i = 0; i < 40; i++)
      stepMatch(m, [neutralInput(), i === 0 ? press({ buttons: Btn.Special }) : neutralInput()]);
    expect(m.entities.filter((e) => e.owner === 1)).toHaveLength(1);
    const threat = shotThreat(m, m.fighters[0]!, seenShots(m, m.fighters[0]!, 0), [], 36);
    expect(threat).not.toBeNull();
    // Played out in the match with port 0 standing still, the Fireball hits it on that frame.
    let hitAt = -1;
    for (let t = 0; t < 36 && hitAt < 0; t++) {
      stepMatch(m, [neutralInput(), neutralInput()]);
      if (m.events.some((e) => e.type === 'hit' && e.victim === 0)) hitAt = t;
    }
    expect(hitAt).toBe(threat!.t);
  });

  it("see Johnny's upgraded laser as a threat until it reaches the CPU, and its burst after", () => {
    // The bolt bursts on the first fighter it hits (src/fighters/johnny/upgrade.ts), so it must fly on in the CPU's
    // copy of the match as it does in the match.
    const m = createMatch({
      seed: 1,
      stage: STAGE,
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'johnny' }],
    });
    for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    Object.assign(m.fighters[0]!, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 }, facing: 1 });
    Object.assign(m.fighters[1]!, { pos: { x: 40, y: 0 }, prevPos: { x: 40, y: 0 }, facing: -1 });
    const e = spawnEntity(m, { kind: 'johnny/megaLaser', owner: 1, pos: { x: 30.6, y: 9.6 } });
    Object.assign(e, { age: 1, vel: { x: -LASER.speed, y: 0 }, facing: -1 });
    const me = m.fighters[0]!;
    const threat = shotThreat(m, me, seenShots(m, me, 0), [], 36);
    expect(threat).not.toBeNull();
    let hitAt = -1;
    for (let t = 0; t < 36 && hitAt < 0; t++) {
      stepMatch(m, [neutralInput(), neutralInput()]);
      if (m.events.some((x) => x.type === 'hit' && x.victim === 0)) hitAt = t;
    }
    expect(hitAt).toBe(threat!.t);
    expect(threat!.until).toBeGreaterThan(threat!.t);
  });

  it("see an opponent's shot as a threat when it crosses the opponent's own raft, as the match has it", () => {
    // A shot passes over its own fighter's Duck Raft in the match. In the CPU's copy the raft has to stay that
    // fighter's too, or the shot is used up on it.
    const m = createMatch({
      seed: 1,
      stage: STAGE,
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'raftwars' }],
    });
    for (let i = 0; i < 30; i++) stepMatch(m, [neutralInput(), neutralInput()]);
    Object.assign(m.fighters[0]!, { pos: { x: -40, y: 0 }, prevPos: { x: -40, y: 0 }, facing: 1 });
    Object.assign(m.fighters[1]!, { pos: { x: 40, y: 0 }, prevPos: { x: 40, y: 0 }, facing: -1 });
    spawnEntity(m, { kind: 'raftwars/duckRaft', owner: 1, pos: { x: -20, y: 5 } });
    const s = knowledge('raftwars', STAGE).ground.ftilt!.spawns[0]!;
    const shot = spawnEntity(m, { kind: s.kind, owner: 1, pos: { x: 0, y: 5 } });
    Object.assign(shot, { age: 1, vel: { x: -s.vx, y: s.vy }, facing: -1, lifetime: s.lifetime });
    const me = m.fighters[0]!;
    const threat = shotThreat(m, me, seenShots(m, me, 0), [], 36);
    expect(threat).not.toBeNull();
    let hitAt = -1;
    for (let t = 0; t < 36 && hitAt < 0; t++) {
      stepMatch(m, [neutralInput(), neutralInput()]);
      if (m.events.some((e) => e.type === 'hit' && e.victim === 0)) hitAt = t;
    }
    expect(hitAt).toBe(threat!.t);
  });

  it("see no threat in two opponents' shots that clank with each other first (three players)", () => {
    // Port 0 at x -60; port 1's Fireball heads for it from x -15, close enough to hit it within the CPU's 36 frames of
    // look-ahead, and port 2's comes the other way from x -45: the two meet at about x -30. In the CPU's copy each
    // opponent's shots need an owner of their own, or they pass through each other there.
    const m = createMatch({
      seed: 1,
      stage: STAGE,
      stocks: 3,
      ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }, { fighter: 'fireboy' }],
    });
    const idle = () => m.fighters.map(() => neutralInput());
    for (let i = 0; i < 30; i++) stepMatch(m, idle());
    for (const [port, x, facing] of [
      [0, -60, 1],
      [1, 50, -1],
      [2, 70, -1],
    ] as const) {
      Object.assign(m.fighters[port]!, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing });
    }
    const s = knowledge('fireboy', STAGE).ground.neutralB!.spawns[0]!;
    const fire = (owner: number, x: number, dir: 1 | -1) => {
      const e = spawnEntity(m, { kind: s.kind, owner, pos: { x, y: s.oy } });
      Object.assign(e, { age: 1, vel: { x: s.vx * dir, y: s.vy }, facing: dir, lifetime: s.lifetime });
    };
    const me = m.fighters[0]!;
    fire(1, -15, -1);
    expect(shotThreat(m, me, seenShots(m, me, 0), [], 36)).not.toBeNull();
    fire(2, -45, 1);
    expect(shotThreat(m, me, seenShots(m, me, 0), [], 36)).toBeNull();
    let clanks = 0;
    let struck = false;
    for (let t = 0; t < 50; t++) {
      stepMatch(m, idle());
      clanks += m.events.filter((x) => x.type === 'entityDestroy' && x.reason === 'clank').length;
      struck ||= m.events.some((x) => x.type === 'hit' && x.victim === 0);
    }
    expect([clanks, struck]).toEqual([2, false]);
  });

  it('see no threat in a shot that its own shot already out meets and clanks first', () => {
    // Port 0 has just fired; port 1's Fireball is 36 units off and would hit port 0 on its own.
    const m = duel();
    const s = knowledge('fireboy', STAGE).ground.neutralB!.spawns[0]!;
    for (const [owner, x, dir] of [
      [0, -34, 1],
      [1, -4, -1],
    ] as const) {
      const e = spawnEntity(m, { kind: s.kind, owner, pos: { x, y: s.oy } });
      Object.assign(e, { age: 1, vel: { x: s.vx * dir, y: s.vy }, facing: dir, lifetime: s.lifetime });
    }
    const me = m.fighters[0]!;
    expect(shotThreat(m, me, seenShots(m, me, 0), [], 36)).toBeNull();
    const alone = duel();
    const lone = spawnEntity(alone, { kind: s.kind, owner: 1, pos: { x: -4, y: s.oy } });
    Object.assign(lone, { age: 1, vel: { x: -s.vx, y: s.vy }, facing: -1, lifetime: s.lifetime });
    expect(
      shotThreat(alone, alone.fighters[0]!, seenShots(alone, alone.fighters[0]!, 0), [], 36),
    ).not.toBeNull();
    // In the match the two clank and port 0 is never hit.
    let clanks = 0;
    let struck = false;
    for (let t = 0; t < 40; t++) {
      stepMatch(m, [neutralInput(), neutralInput()]);
      clanks += m.events.filter((x) => x.type === 'entityDestroy' && x.reason === 'clank').length;
      struck ||= m.events.some((x) => x.type === 'hit' && x.victim === 0);
    }
    expect([clanks, struck]).toEqual([2, false]);
  });
});

/**
 * Run Tunnel with port 1 starting on the middle floor: two Fireboys end up either side of the right-hand gap, which
 * neither crosses on foot, with only their Fireballs to reach each other. (Port 1's spawn is where the knowledge
 * probe settles, so it stands on the floor it then probes from.)
 */
registerStage({
  ...runTunnel,
  id: 'run-tunnel-middle-start',
  spawns: [
    [-10, 0, 1],
    [64, 0, -1],
    [-20, 0, 1],
    [20, 0, -1],
  ],
});

/** The longest stretch, in frames, of clanks each less than 2 s after the last, in a level 9 CPU match. */
function longestClankRun(fighters: string[], seed: number, frames: number): number {
  const m = createMatch({
    seed,
    stage: 'run-tunnel-middle-start',
    stocks: 3,
    ports: fighters.map((fighter) => ({ fighter })),
  });
  const cpus = fighters.map((_, port) => createCpu({ port, level: 9, seed: seed * 7919 + port }));
  let longest = 0;
  let start = -1;
  let last = -Infinity;
  while (m.frame < frames) {
    stepMatch(
      m,
      cpus.map((c) => c.input(m)),
    );
    if (!m.events.some((e) => e.type === 'entityDestroy' && e.reason === 'clank')) continue;
    if (m.frame - last >= 120) start = m.frame;
    last = m.frame;
    longest = Math.max(longest, last - start);
  }
  return longest;
}

describe('level 9 CPUs with shots either side of a gap', () => {
  // Before, the right-hand Fireboy fired into each of the other's Fireballs 10 frames after it came out, 21 times
  // from frame 103 to frame 1104: a 1000-frame run of clanks.
  it("don't trade Fireballs that clank in the middle (Fireboy mirror, seed 1)", () => {
    expect(longestClankRun(['fireboy', 'fireboy'], 1, 60 * 60)).toBeLessThan(180);
  }, 60_000);

  // Before, Fireboy's Fireball (5.5%) and Bob the Robber's Stun Gun (4%), within 9% of each other, clanked 16 times
  // from frame 1238 to frame 2037.
  it("don't trade Fireballs and Stun Gun shots that clank (Fireboy against Bob the Robber, seed 1)", () => {
    expect(longestClankRun(['fireboy', 'bob-the-robber'], 1, 60 * 60)).toBeLessThan(180);
  }, 60_000);
});
