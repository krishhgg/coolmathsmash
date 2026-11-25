import { Graphics } from 'pixi.js';
import { getFighter } from '../../fighters/registry';
import type { MatchState } from '../../sim/match';
import type { CameraView } from '../camera';
import { PORT_COLORS } from '../debug/inputDisplay';
import { chargeReleaseShapes, chargeShapes, HALO_FADE_LIFE, haloShapes } from './extras';
import { hitSparkShapes } from './hitSpark';
import { koBlastShapes } from './koBlast';
import { paint } from './paint';
import { hex, type Shape } from './shapes';
import { shieldBreakShapes } from './shield';
import { puffShapes, speedLineShapes } from './smoke';
import { seedOf } from './random';
import { chargeReleased, charging, type VfxState } from './system';

export const portColor = (port: number): number => hex(PORT_COLORS[port % PORT_COLORS.length]!);

/**
 * Draws the effects in three layers: `behind` the fighters in the world (respawn halos, dust, launch smoke and speed
 * lines), in `front` of them (hit sparks, shield shatters, smash-charge sparkle and release flash), and `screen`
 * (KO blasts, in screen pixels; the renderer puts it in the world behind the fighters and undoes the camera on it).
 */
export class VfxView {
  readonly behind = new Graphics();
  readonly front = new Graphics();
  readonly screen = new Graphics();

  /** Draw `v` (null: nothing) with `state`'s fighters at interpolation `alpha`, through camera `view`. */
  draw(v: VfxState | null, state: MatchState, view: CameraView, alpha: number): void {
    for (const g of [this.behind, this.front, this.screen]) g.clear();
    if (!v) return;
    const frame = state.frame;
    const behind: Shape[] = [];
    const lines: Shape[] = [];
    const front: Shape[] = [];
    for (const h of v.halos)
      behind.push(...haloShapes(h.x, -h.y, portColor(h.port), frame, 1 - (frame - h.frame) / HALO_FADE_LIFE));
    for (const f of state.fighters) {
      const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
      const y = -(f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha);
      const { height, width } = getFighter(f.fighter).stats;
      const mid = y - height / 2;
      if (f.action === 'respawn')
        behind.push(...haloShapes(x, y, portColor(f.port), frame, f.actionFrame / 8));
      lines.push(...speedLineShapes(f, x, mid, portColor(f.port), frame));
      if (charging(f))
        front.push(...chargeShapes(x, mid, width / 2, height / 2, f.facing, f.port, frame, f.charge));
      const released = chargeReleased(f);
      if (released !== undefined)
        front.push(
          ...chargeReleaseShapes(
            x + f.facing * (width / 2 + 1),
            mid - height * 0.075,
            released,
            seedOf(frame - released, f.port, 11),
          ),
        );
    }
    behind.push(...puffShapes(v.puffs, frame), ...lines);
    for (const b of v.shields) front.push(...shieldBreakShapes(b, portColor(b.port), frame));
    for (const s of v.sparks) front.push(...hitSparkShapes(s, frame));
    paint(this.behind, behind);
    paint(this.front, front);
    paint(
      this.screen,
      v.kos.flatMap((k) => koBlastShapes(k, portColor(k.port), frame, view)),
    );
  }
}
