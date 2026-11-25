import { motionOffset, stageStateAt } from '../../sim/movingStage';
import type { StageMatch } from '../battlefield/view';
import { stage } from './geometry';

/** A hauler shows its brake lights this many frames before it starts to fall back, and while it does. */
export const BRAKE_WARNING = 45;

/** Whether hauler `index` is falling back now or within the warning window (hazards on). */
export function braking(index: number, frame: number): boolean {
  const motion = stage.platforms[index]!.motion;
  const now = motionOffset(motion, frame)[0];
  return (
    motionOffset(motion, frame + 1)[0] < now - 1e-6 ||
    motionOffset(motion, frame + BRAKE_WARNING)[0] < now - 1e-6
  );
}

export interface HaulerPose {
  /** Offset from the authored deck, game units, interpolated between the last two simulated frames. */
  x: number;
  y: number;
  braking: boolean;
}

/**
 * Where to draw each hauler: where the match has its deck, between frames as the renderer draws fighters. Without
 * a match (the stage lab) the haulers drive as they do with hazards on.
 */
export function haulerPoses(frame: number, match?: StageMatch): HaulerPose[] {
  const pieces = match?.pieces.platforms ?? stageStateAt(stage, frame).platforms;
  const alpha = match?.alpha ?? 1;
  const hazards = match?.hazards ?? true;
  return stage.platforms.map((_, i) => {
    const p = pieces[i]!;
    return {
      x: p.x - p.dx * (1 - alpha),
      y: p.y - p.dy * (1 - alpha),
      braking: hazards && braking(i, frame),
    };
  });
}
