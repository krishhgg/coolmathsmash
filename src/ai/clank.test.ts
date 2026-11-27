import { describe, expect, it } from 'vitest';
import { Btn, neutralInput } from '../input/types';
import { spawnEntity } from '../sim/entities/entities';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
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

  it("see the opponent's Fireball coming as a threat, on the frame it would hit", () => {
    expect(shotThreat(duel(), duel().fighters[0]!, [], [], 36)).toBeNull();
    // Port 1 fires; 40 frames later its Fireball is about 40 units from port 0.
    const m = duel();
    for (let i = 0; i < 40; i++)
      stepMatch(m, [neutralInput(), i === 0 ? press({ buttons: Btn.Special }) : neutralInput()]);
    expect(m.entities.filter((e) => e.owner === 1)).toHaveLength(1);
    const threat = shotThreat(m, m.fighters[0]!, seenShots(m, m.fighters[0]!, 0), [], 36);
    expect(threat).not.toBeNull();
    // Played out in the match with port 0 standing still, the Fireball hits it on that frame or, from the margin the
    // CPU allows an attack too (1.5 units), the next.
    let hitAt = -1;
    for (let t = 0; t < 36 && hitAt < 0; t++) {
      stepMatch(m, [neutralInput(), neutralInput()]);
      if (m.events.some((e) => e.type === 'hit' && e.victim === 0)) hitAt = t;
    }
    expect(hitAt - threat!.t).toBeGreaterThanOrEqual(0);
    expect(hitAt - threat!.t).toBeLessThanOrEqual(1);
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
