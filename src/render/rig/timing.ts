import type { MoveDef } from '../../fighters/types';
import type { AnimClip } from './types';

/**
 * The clip frame to draw on `frame` of a move. The clip's authored `active` windows are mapped onto the move's
 * hit windows and its length onto the move's FAF, piecewise linearly, so startup, active frames and endlag each
 * play at the speed the frame data gives them. When the window counts differ, the first start and the last end
 * are matched. A throw or pummel, which has no hit windows, maps its throw or pummel frame onto the clip's active
 * window instead. Clips without a move, or moves without a clip, play frame for frame.
 */
export function moveClipFrame(clip: AnimClip, frame: number, move: MoveDef | undefined): number {
  if (!move) return frame;
  const knots: [number, number][] = [[0, 0]];
  const impact = move.throw?.frame ?? move.pummel?.frame;
  const ours: [number, number][] =
    move.hits.length || impact === undefined ? move.hits.map((h) => h.frames) : [[impact, impact]];
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

/**
 * `clip` re-keyed to last `length` frames, to draw one action's clip over another action's timeline. Each key frame
 * maps piecewise linearly through `knots` (`[old frame, new frame]` pairs in order) from frame 0 to the clip's end,
 * then rounds; `active` windows move the same way. Throws if two keys round onto one frame.
 */
export function retimeClip(clip: AnimClip, length: number, knots: [number, number][] = []): AnimClip {
  const points: [number, number][] = [[0, 0], ...knots, [clip.length, length]];
  const at = (frame: number): number => {
    let i = 1;
    while (i < points.length - 1 && frame > points[i]![0]) i++;
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    return Math.round(x1 === x0 ? y1 : y0 + ((frame - x0) * (y1 - y0)) / (x1 - x0));
  };
  const keys = clip.keys.map((k) => ({ ...k, frame: at(k.frame) }));
  keys.forEach((k, i) => {
    if (i && k.frame === keys[i - 1]!.frame && clip.keys[i]!.frame !== clip.keys[i - 1]!.frame)
      throw new Error(
        `retimeClip: keys ${clip.keys[i - 1]!.frame} and ${clip.keys[i]!.frame} both land on ${k.frame}`,
      );
  });
  const active = clip.active?.map(([s, e]): [number, number] => [at(s), at(e)]);
  return { ...clip, length, keys, ...(active && { active }) };
}
