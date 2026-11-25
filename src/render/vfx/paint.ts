import type { Graphics } from 'pixi.js';
import type { Shape } from './shapes';

/** Draw `shapes` into `g` in order (the only Pixi code the effects need). */
export function paint(g: Graphics, shapes: readonly Shape[]): void {
  for (const s of shapes) {
    if (s.type === 'circle') g.circle(s.x, s.y, s.r);
    else if (s.type === 'ellipse') g.ellipse(s.x, s.y, s.rx, s.ry);
    else g.poly(s.points, !s.open);
    if (s.fill) g.fill({ color: s.fill.color, alpha: s.fill.alpha ?? 1 });
    if (s.line)
      g.stroke({
        color: s.line.color,
        width: s.line.width,
        alpha: s.line.alpha ?? 1,
        join: 'round',
        cap: 'round',
      });
  }
}
