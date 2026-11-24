import { describe, expect, it } from 'vitest';
import { nextRandom } from '../engine/rng';
import { hashState } from '../engine/hash';
import { quantizeAxis, type InputFrame } from '../input/types';
import { DEFAULT_MATCH, createMatch, stepMatch } from './match';
import { decodeReplay, encodeReplay, playReplay, type Replay } from './replay';

function randomReplay(seed: number, length: number): Replay {
  const r = { rng: seed };
  const frames: InputFrame[][] = [];
  let held: InputFrame[] = DEFAULT_MATCH.ports.map(() => ({ x: 0, y: 0, cx: 0, cy: 0, buttons: 0 }));
  for (let f = 0; f < length; f++) {
    held = held.map((h) =>
      nextRandom(r) < 0.15
        ? {
            x: quantizeAxis(nextRandom(r) * 2 - 1),
            y: quantizeAxis(nextRandom(r) * 2 - 1),
            cx: 0,
            cy: 0,
            buttons: Math.floor(nextRandom(r) * 32),
          }
        : h,
    );
    frames.push(held);
  }
  return { version: 1, config: DEFAULT_MATCH, frames };
}

describe('replays', () => {
  it('round-trip through the compact encoding', () => {
    const replay = randomReplay(9, 600);
    const decoded = decodeReplay(encodeReplay(replay));
    expect(decoded).toEqual(replay);
    expect(encodeReplay(replay).length).toBeLessThan(JSON.stringify(replay).length / 2);
  });

  it('reproduce the same match state bit for bit', () => {
    const replay = randomReplay(42, 1200);
    const live = createMatch(replay.config);
    for (const frame of replay.frames) stepMatch(live, frame);
    const replayed = playReplay(decodeReplay(encodeReplay(replay)));
    expect(hashState(replayed)).toBe(hashState(live));
    expect(replayed.frame).toBe(1200);
  });
});
