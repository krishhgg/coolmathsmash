import { METEOR_KO_DEPTH, METEOR_KO_MIN_SPEED, TOP_KO_MARGIN, TOP_KO_MIN_SPEED } from './constants';

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface Vec {
  x: number;
  y: number;
}

export type BlastSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * The blast zone a fighter at `pos` has crossed, moving with launch speed `kb` and its own speed `vel`, or null.
 *
 * - Left, right and bottom: on or past the line.
 * - Top: past it with a vertical launch speed of at least 2.4, or 30 units past it (TOP_KO_MIN_SPEED).
 * - Ultimate's meteor blast line: launched downward, 25 units or more below the camera's lower limit, falling at 3 or
 *   more counting the launch and its own speed (METEOR_KO_DEPTH). It counts as the bottom zone.
 *
 * The sim (step.ts) and the KO prediction (render/koPredict.ts) both use it, so they agree frame for frame.
 */
export function blastZoneCrossed(
  zones: Bounds,
  camera: Bounds,
  pos: Vec,
  kb: Vec,
  vel: Vec,
): BlastSide | null {
  if (pos.x <= zones.left) return 'left';
  if (pos.x >= zones.right) return 'right';
  if (pos.y <= zones.bottom) return 'bottom';
  if (pos.y >= zones.top + TOP_KO_MARGIN || (pos.y >= zones.top && kb.y >= TOP_KO_MIN_SPEED)) return 'top';
  if (kb.y < 0 && pos.y <= camera.bottom - METEOR_KO_DEPTH && kb.y + vel.y <= -METEOR_KO_MIN_SPEED)
    return 'bottom';
  return null;
}
