import { getFighter } from '../../fighters/registry';
import { Btn, neutralInput, type InputFrame } from '../../input/types';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import type { FighterState } from '../../sim/fighter';
import { compiledStage } from '../../sim/step';
import type { StageGeometry } from '../../sim/stage';
import { registerStage, STAGES } from '../../stages/registry';
import { createCpu } from '../index';
import { actionable } from '../knowledge';

/**
 * Recovery drills for tests: start a fighter falling at a point under or beside a stage, then see whether a CPU
 * gets it back, and whether any timing of drift, double jump and up special could have.
 */

/** A 150-wide raft with a flat underside 10 units down: Raft War Lagoon's hull without the swell. */
export const WIDE_150: StageGeometry = {
  id: 'test-wide-150',
  name: 'Test 150-wide stage',
  solids: [
    {
      points: [
        [-75, 0],
        [75, 0],
        [75, -6.1],
        [74.4, -8.8],
        [72.8, -10],
        [-72.8, -10],
        [-74.4, -8.8],
        [-75, -6.1],
      ],
    },
  ],
  platforms: [
    { x1: -56, x2: -24, y: 25 },
    { x1: 24, x2: 56, y: 25 },
    { x1: -15, x2: 15, y: 49 },
  ],
  ledges: [
    { x: -75, y: 0, side: -1 },
    { x: 75, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-42, 0, 1],
    [42, 0, -1],
  ],
  respawns: [
    [0, 72],
    [36, 72],
  ],
};

export function registerWide150(): void {
  if (!STAGES[WIDE_150.id]) registerStage(WIDE_150);
}

export interface Spot {
  x: number;
  y: number;
  where: 'under' | 'beside';
}

/** The lowest point of the stage's underside over [x - margin, x + margin], or null when nothing is overhead. */
function undersideY(stage: string, x: number, margin: number): number | null {
  let low: number | null = null;
  for (const e of compiledStage(stage).edges) {
    if (e.n.y >= 0) continue;
    const x1 = Math.max(Math.min(e.a.x, e.b.x), x - margin);
    const x2 = Math.min(Math.max(e.a.x, e.b.x), x + margin);
    if (x1 > x2) continue;
    for (const px of [x1, x2]) {
      const y = e.a.y + ((e.b.y - e.a.y) * (px - e.a.x)) / (e.b.x - e.a.x || 1);
      if (low === null || y < low) low = y;
    }
  }
  return low;
}

/**
 * Start points for a stage: under it, across its width, with the feet 13, 30 and 50 units below its underside (at
 * 13 the head is under 2 units from it); and beside it, off both ends at three distances and heights.
 */
export function spots(stage: string): Spot[] {
  const geo = compiledStage(stage).geo;
  const edge = Math.max(...geo.ledges.map((l) => Math.abs(l.x)));
  const ledgeY = Math.max(...geo.ledges.map((l) => l.y));
  const out: Spot[] = [];
  for (const u of [0, 0.3, 0.6, 0.85]) {
    for (const side of u === 0 ? [1] : [-1, 1]) {
      const x = Math.round(side * u * edge);
      const bottom = undersideY(stage, x, 5);
      if (bottom === null) continue;
      for (const depth of [13, 30, 50]) out.push({ x, y: Math.round(bottom - depth), where: 'under' });
    }
  }
  for (const side of [-1, 1]) {
    for (const d of [12, 35, 60]) {
      for (const dy of [15, -20, -50]) out.push({ x: side * (edge + d), y: ledgeY + dy, where: 'beside' });
    }
  }
  return out;
}

/** A match with port 0 falling at (x, y), its double jump left, and port 1 standing in the middle. */
export function drill(stage: string, x: number, y: number, fighter = 'fireboy'): MatchState {
  const m = createMatch({ seed: 1, stage, stocks: 3, ports: [{ fighter }, { fighter }] });
  Object.assign(m.fighters[0]!, {
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    ground: null,
    action: 'fall',
    actionFrame: 1,
    jumpsUsed: 1,
    airDodgeUsed: false,
    facing: x < 0 ? 1 : -1,
  });
  const ground = m.fighters[1]!;
  ground.pos = { x: 0, y: compiledStage(stage).geo.ledges[0]!.y };
  ground.prevPos = { ...ground.pos };
  return m;
}

export type Outcome = 'safe' | 'ko' | 'stuck';

/** Run a level `level` CPU from the drill until it lands, hangs on a ledge or is KO'd. */
export function cpuRecovers(
  stage: string,
  spot: Spot,
  level: number,
  seed: number,
  fighter?: string,
): Outcome {
  const m = drill(stage, spot.x, spot.y, fighter);
  const f = m.fighters[0]!;
  const cpu = createCpu({ port: 0, level, seed });
  for (let i = 0; i < 600; i++) {
    stepMatch(m, [cpu.input(m), neutralInput()]);
    if (f.stocks < 3 || f.action === 'ko' || f.action === 'out') return 'ko';
    if (f.ground !== null || f.action === 'ledgeHang') return 'safe';
  }
  return 'stuck';
}

/**
 * Whether the fighter can get back from the drill at all: a search over when to double jump and when to up
 * special, steering for the nearest ledge (out from under the stage, then onto the ledge). It does not use the
 * CPU's planner, so it settles whether a failure was the CPU's or the start point's.
 */
export function canRecover(stage: string, spot: Spot, fighter = 'fireboy'): boolean {
  const geo = compiledStage(stage).geo;
  const stats = getFighter(fighter).stats;
  const L = geo.ledges.reduce((a, b) => (Math.abs(b.x - spot.x) < Math.abs(a.x - spot.x) ? b : a));
  const hangX = L.x + L.side * (stats.width / 2 + 0.5);
  const steer = (f: Readonly<FighterState>): number => {
    const tx = f.pos.y >= L.y - 1 ? L.x - L.side * 12 : hangX;
    const d = tx - f.pos.x;
    return Math.abs(d) < 2 ? Math.round(d * 30) : Math.sign(d) * 100;
  };
  const never = Infinity;
  const jumps = [never];
  for (let t = 0; t <= 90; t += 3) jumps.push(t);
  for (const jumpAt of jumps) {
    for (let upAt = jumpAt === never ? 0 : jumpAt; upAt <= 150; upAt += 3) {
      const m = drill(stage, spot.x, spot.y, fighter);
      const f = m.fighters[0]!;
      let up = false;
      for (let t = 0; t < 320; t++) {
        const i: InputFrame = neutralInput();
        i.x = Math.max(-100, Math.min(100, steer(f)));
        if (t === jumpAt) i.buttons = Btn.Jump;
        else if (!up && t >= upAt && actionable(f)) {
          up = true;
          i.x = Math.sign(hangX - f.pos.x) * 40;
          i.y = 60;
          i.buttons = Btn.Special;
        }
        stepMatch(m, [i, neutralInput()]);
        if (f.action === 'ledgeCatch' || f.action === 'ledgeHang' || f.ground !== null) return true;
        if (f.stocks < 3 || f.action === 'ko' || f.action === 'out') break;
      }
    }
  }
  return false;
}
