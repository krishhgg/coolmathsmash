import type { StageState } from '../../sim/movingStage';
import { pieceOffset } from '../../render/stagePieces';
import { stage } from './geometry';

export interface HaulerPose {
  /** Offset from the authored deck, game units, interpolated between the last two simulated frames. */
  x: number;
  y: number;
  /** Brake lights: on while the hauler drops back (moving left), which hazards-off traffic never does. */
  braking: boolean;
}

/** Where to draw each hauler from the match's piece state, as the renderer draws fighters between frames. */
export function haulerPoses(pieces: StageState, alpha: number): HaulerPose[] {
  return stage.platforms.map((_, i) => {
    const p = pieces.platforms[i]!;
    return { ...pieceOffset(p, alpha), braking: p.dx < -1e-9 };
  });
}
