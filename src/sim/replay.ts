import type { InputFrame } from '../input/types';
import { createMatch, stepMatch, type MatchConfig, type MatchState } from './match';

/** A replay is the match config plus every port's input on every frame; replaying it reproduces the match exactly. */
export interface Replay {
  version: 1;
  config: MatchConfig;
  frames: InputFrame[][];
}

type Packed = [x: number, y: number, cx: number, cy: number, buttons: number];

/** Compact JSON: per port, runs of identical inputs as [count, x, y, cx, cy, buttons]. */
export function encodeReplay(replay: Replay): string {
  const ports = replay.config.ports.map((_, port) => {
    const runs: number[][] = [];
    for (const frame of replay.frames) {
      const i = frame[port]!;
      const packed: Packed = [i.x, i.y, i.cx, i.cy, i.buttons];
      const last = runs.at(-1);
      if (last && last.slice(1).every((v, k) => v === packed[k])) last[0]!++;
      else runs.push([1, ...packed]);
    }
    return runs;
  });
  return JSON.stringify({
    version: replay.version,
    config: replay.config,
    length: replay.frames.length,
    ports,
  });
}

export function decodeReplay(text: string): Replay {
  const raw = JSON.parse(text) as { version: 1; config: MatchConfig; length: number; ports: number[][][] };
  const frames: InputFrame[][] = Array.from({ length: raw.length }, () => []);
  raw.ports.forEach((runs, port) => {
    let f = 0;
    for (const [count, x, y, cx, cy, buttons] of runs as [number, ...Packed][]) {
      for (let k = 0; k < count; k++) frames[f++]![port] = { x, y, cx, cy, buttons };
    }
  });
  return { version: raw.version, config: raw.config, frames };
}

export function playReplay(replay: Replay, untilFrame = replay.frames.length): MatchState {
  const state = createMatch(replay.config);
  for (let f = 0; f < untilFrame; f++) stepMatch(state, replay.frames[f]!);
  return state;
}
