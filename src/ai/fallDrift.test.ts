import { describe, expect, it } from 'vitest';
import { neutralInput, type InputFrame } from '../input/types';
import { createMatch, stepMatch } from '../sim/match';
import { createCpu } from './index';
import { groundUnder, stageInfo } from './stage';

/**
 * Falls nothing else steers. With no program running and no recovery plan, the CPU's air input comes from airIdle in
 * cpu.ts: a helpless fall after an up special used as an attack, or a free fall while the opponent it would think
 * about is KO'd and waiting to respawn. Air friction takes only 0.0075 (Fluffy) to 0.01 (Wheely, Red Ball) units a
 * frame off their speed, so with the stick centred such a fall keeps most of it. On main airIdle pushes back only
 * within 10 units of the stage's outer ends, which is too late for Wheely's Ramp Jump, and never over a gap inside the
 * stage. It now works out where the fall comes down and steers it back onto the stage when it wouldn't (driftBack in
 * stage.ts).
 */

interface Fall {
  stage: string;
  fighter: string;
  action: 'helpless' | 'fall';
  /** Start and speed on the right side; the left side is the mirror image. */
  at: { x: number; y: number };
  vel: { x: number; y: number };
  /** Where the ground the fall starts over ends, on the right. */
  edge: number;
  /** Port 1 was KO'd on the frame before and waits 60 frames to respawn, so the CPU has nobody to think about. */
  alone?: boolean;
}

interface Outcome {
  end: string;
  /** Furthest out the fighter got, toward the side it was moving. */
  out: number;
  /** The CPU's input and the fighter's x before each frame. */
  frames: { input: InputFrame; x: number }[];
}

/** A level 9 CPU on port 0 from `s`, mirrored for side -1, until it lands, catches a ledge or loses a stock. */
function play(s: Fall, side: 1 | -1, seed: number): Outcome {
  const m = createMatch({
    seed: 1,
    stage: s.stage,
    stocks: 3,
    ports: [{ fighter: s.fighter }, { fighter: 'fireboy' }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const f = m.fighters[0]!;
  const at = { x: side * s.at.x, y: s.at.y };
  Object.assign(f, {
    pos: at,
    prevPos: { ...at },
    vel: { x: side * s.vel.x, y: s.vel.y },
    kb: { x: 0, y: 0 },
    ground: null,
    action: s.action,
    actionFrame: 1,
    move: null,
    landingLag: 24,
    jumpsUsed: 2,
    airDodgeUsed: false,
    fastFalling: false,
    facing: side,
    airFrames: 40,
  });
  // Port 1 stands 60 units out on the other side, on the floor there. It has to take that floor as its ground too: on
  // Run Tunnel it spawns on the right floor (48 to 88), and kept as its ground that would snap it to x 48 from -60.
  const o = m.fighters[1]!;
  const away = { x: -side * 60, y: 0 };
  const ground = groundUnder(stageInfo(m), away.x, away.y);
  expect(ground).not.toBeNull();
  Object.assign(o, { pos: away, prevPos: { ...away }, ground });
  if (s.alone) Object.assign(o, { action: 'ko', respawnTimer: 60, stocks: 2 });
  const cpu = createCpu({ port: 0, level: 9, seed });
  const frames: Outcome['frames'] = [];
  let out = -Infinity;
  for (let i = 0; i < 600; i++) {
    const x = f.pos.x;
    const input = cpu.input(m);
    frames.push({ input, x });
    stepMatch(m, [input, neutralInput()]);
    out = Math.max(out, side * f.pos.x);
    if (f.stocks < 3) return { end: 'ko', out, frames };
    if (f.action === 'ledgeCatch') return { end: 'ledge', out, frames };
    if (f.ground !== null) return { end: 'landed', out, frames };
  }
  return { end: f.action, out, frames };
}

const SEEDS = [1, 2, 3, 4, 5];

/** Each seed on each side whose fall didn't land on the ground it started over. */
function misses(s: Fall): string[] {
  const bad: string[] = [];
  for (const side of [1, -1] as const) {
    for (const seed of SEEDS) {
      const r = play(s, side, seed);
      if (r.end !== 'landed' || r.out >= s.edge)
        bad.push(`side ${side}, seed ${seed}: ${r.end}, out to ${r.out.toFixed(1)}`);
    }
  }
  return bad;
}

describe('CPU falls with nothing steering them', () => {
  // Ramp Jump used as an attack from 30 units left of the middle, stick centred: Wheely is helpless from frame 40 at
  // (32.4, 68.7) moving 1.69 units a frame. His air friction is 0.01, so with no input he drifts past the right ledge
  // and is KO'd 120 frames later. Steered back, he lands at x 72.7 on frame 47.
  it('a helpless Wheely after Ramp Jump steers back onto Battlefield instead of drifting past either ledge', () => {
    const s: Fall = {
      stage: 'battlefield',
      fighter: 'wheely',
      action: 'helpless',
      at: { x: 32.4, y: 68.7 },
      vel: { x: 1.69, y: 0.18 },
      edge: 80,
    };
    expect(misses(s)).toEqual([]);
  }, 60_000);

  // Run Tunnel's middle floor runs from -32 to 32, with a 16 unit gap on each side. Fluffy helpless after a Quick
  // Grapple that found nothing keeps the drift he had, here his air speed, 0.735. Air friction 0.0075 lets him drift
  // into the gap, and his helpless air acceleration (0.04) needs 18 frames to stop him, so the CPU has to start early.
  it('a helpless Fluffy steers back onto the middle of Run Tunnel instead of drifting into either gap', () => {
    const s: Fall = {
      stage: 'run-tunnel',
      fighter: 'fluffy',
      action: 'helpless',
      at: { x: 10, y: 40 },
      vel: { x: 0.735, y: 0 },
      edge: 32,
    };
    expect(misses(s)).toEqual([]);
  }, 60_000);

  // Red Ball helpless after Bounce with the stick forward moves 1.09 units a frame, and rising 0.43. The near-edge
  // push stops him at Battlefield's ledges (his air acceleration is 0.12), but nothing stops him over Run Tunnel's gaps.
  it('a helpless Red Ball steers back onto the middle of Run Tunnel instead of drifting into either gap', () => {
    const s: Fall = {
      stage: 'run-tunnel',
      fighter: 'redball',
      action: 'helpless',
      at: { x: -10, y: 60 },
      vel: { x: 1.09, y: 0.43 },
      edge: 32,
    };
    expect(misses(s)).toEqual([]);
  }, 60_000);

  // The frame after an aerial that KO'd the opponent: Fluffy is in a free fall at his air speed with nobody to think
  // about for 60 frames, so airIdle drifts him. On main he drifts into the gap and the recovery that follows misses.
  it('a free fall after an aerial, with the opponent KO`d, steers back onto the middle of Run Tunnel', () => {
    const s: Fall = {
      stage: 'run-tunnel',
      fighter: 'fluffy',
      action: 'fall',
      at: { x: 20, y: 10 },
      vel: { x: 0.735, y: 0 },
      edge: 32,
      alone: true,
    };
    expect(misses(s)).toEqual([]);
  }, 60_000);

  // Falls that come down on the stage with room are left as they were: airIdle holds the stick centred over the
  // middle and full toward the middle within 10 units of the stage's ends, as on main, and never presses anything else.
  it.each(['wheely', 'fluffy', 'redball'])(
    'a %s falling onto the middle of Battlefield drifts exactly as on main',
    (fighter) => {
      const falls: Fall[] = [
        { at: { x: 0, y: 60 }, vel: { x: 0.8, y: 0.3 }, action: 'helpless' },
        { at: { x: -30, y: 40 }, vel: { x: 0.5, y: 0 }, action: 'helpless' },
        { at: { x: 74, y: 30 }, vel: { x: -1, y: 0 }, action: 'helpless' },
        { at: { x: -20, y: 30 }, vel: { x: 0.6, y: 0 }, action: 'fall', alone: true },
      ].map((s) => ({ ...s, stage: 'battlefield', fighter, edge: 80 }) as Fall);
      const main = (x: number) => (x < -70 || x > 70 ? -Math.sign(x) * 100 : 0);
      for (const s of falls) {
        for (const side of [1, -1] as const) {
          for (const seed of SEEDS) {
            const r = play(s, side, seed);
            const at = `${s.action} from (${side * s.at.x}, ${s.at.y}), seed ${seed}`;
            expect(r.end, at).toBe('landed');
            expect(
              r.frames.map((p) => p.input.x),
              at,
            ).toEqual(r.frames.map((p) => main(p.x)));
            expect(
              r.frames.filter((p) => p.input.buttons !== 0 || (s.action === 'helpless' && p.input.y !== 0)),
              at,
            ).toEqual([]);
          }
        }
      }
    },
    60_000,
  );
});
