import type { MoveDef } from '../../fighters/types';
import type { AnimClip } from './types';

/**
 * The clip frame to draw on `frame` of a move. The clip's authored `active` windows are mapped onto the move's
 * hit windows and its length onto the move's FAF, piecewise linearly, so startup, active frames and endlag each
 * play at the speed the frame data gives them. When the window counts differ, the first start and the last end
 * are matched. Clips without a move, or moves without a clip, play frame for frame.
 */
export function moveClipFrame(clip: AnimClip, frame: number, move: MoveDef | undefined): number {
  if (!move) return frame;
  const knots: [number, number][] = [[0, 0]];
  const ours = move.hits.map((h) => h.frames);
  const theirs = clip.active ?? [];
  const pairs: [[number, number], [number, number]][] =
    ours.length === theirs.length
      ? ours.map((w, i) => [w, theirs[i]!])
      : ours.length && theirs.length
        ? [
            [
              [ours[0]![0], ours[ours.length - 1]![1]],
              [theirs[0]![0], theirs[theirs.length - 1]![1]],
            ],
          ]
        : [];
  for (const [[s, e], [a, b]] of pairs) knots.push([s, a], [e, b]);
  knots.push([move.faf - 1, clip.length]);
  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1]!;
    const [x1, y1] = knots[i]!;
    if (frame > x1 && i < knots.length - 1) continue;
    if (x1 <= x0) return y1;
    return Math.max(y0, Math.min(y1, y0 + ((frame - x0) * (y1 - y0)) / (x1 - x0)));
  }
  return frame;
}
