import type { Graphics } from 'pixi.js';
import type { FighterDef } from '../../fighters/types';
import type { FighterState } from '../../sim/fighter';

const BAR_WIDTH = 10;

/**
 * Air mobility on the hitbox overlay, in world units (y down): jumps left as pips for multi-jumpers, float time
 * (blue) and hover fuel (orange) as bars above the head, and a glide's pitch as a line from the body.
 */
export function drawMobility(g: Graphics, f: FighterState, def: FighterDef): void {
  const { height, jumps } = def.stats;
  const x = f.pos.x;
  const top = -(f.pos.y + height + 12.5);
  const bars: [number, string][] = [];
  if (def.float) bars.push([1 - f.mobility.floatFrames / def.float.frames, '#5fd7ff']);
  if (def.hover) bars.push([f.mobility.hoverFuel / def.hover.fuel, '#ff9d2e']);
  bars.forEach(([share, color], i) => {
    const y = top - i * 2;
    g.rect(x - BAR_WIDTH / 2, y, BAR_WIDTH, 1.2).fill({ color: '#000000', alpha: 0.5 });
    g.rect(x - BAR_WIDTH / 2, y, BAR_WIDTH * Math.max(0, Math.min(1, share)), 1.2).fill(color);
  });
  if (jumps > 2) {
    for (let i = 0; i < jumps; i++) {
      const px = x + (i - (jumps - 1) / 2) * 2;
      g.circle(px, top + 2.4, 0.7).fill({ color: '#ffffff', alpha: i < jumps - f.jumpsUsed ? 0.95 : 0.25 });
    }
  }
  if (f.action === 'glide') {
    const a = (f.mobility.glideAngle * Math.PI) / 180;
    const y = -(f.pos.y + height / 2);
    g.moveTo(x, y)
      .lineTo(x + f.facing * Math.cos(a) * 12, y - Math.sin(a) * 12)
      .stroke({ color: '#b6ff3b', width: 0.8 });
  }
}
