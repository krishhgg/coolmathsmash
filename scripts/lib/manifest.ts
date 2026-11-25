import type { FighterSummary } from '../../src/harness/scenarios.ts';

/** `manifest.json` written by scripts/capture.ts and read by scripts/judge-pack.ts. Paths are relative to it. */
export interface Manifest {
  version: 1;
  scoped?: boolean;
  createdAt: string;
  git: { sha: string; branch: string; dirty: boolean };
  baseUrl: string;
  viewport: { width: number; height: number };
  browser: string;
  /** False when ffmpeg was missing: no GIF or MP4 files. */
  video: boolean;
  scenarios: CaptureRecord[];
}

export type CaptureStatus = 'captured' | 'pending' | 'missed' | 'error';

export interface CaptureRecord {
  name: string;
  description: string;
  /** "game" or "lab:<scene>". */
  page: string;
  url: string;
  status: CaptureStatus;
  /** Why it was not captured ("needs move 'fsmash' ..."). */
  reason?: string;
  /** How the capture frame was chosen. */
  rule?: string;
  frame?: number;
  fighters?: FighterSummary[];
  /** Simulation state hash at the capture frame. */
  hash?: string;
  /** sha256 of the PNG: equal on every run of the same commit. */
  sha256?: string;
  files: { png?: string; strip?: string; gif?: string; mp4?: string };
  /** The scenario's own reference globs (fighter states); the judge pack falls back to scripts/judge/refs.json. */
  refs?: string[];
  motion?: { from: number; to: number; fps: number; frames: { frame: number; fighters: FighterSummary[] }[] };
}

export function fighterLine(f: FighterSummary): string {
  const move = f.move ? ` ${f.move}` : '';
  return `P${f.port + 1} ${f.action} ${f.actionFrame}${move} (${f.pos.x}, ${f.pos.y})`;
}
