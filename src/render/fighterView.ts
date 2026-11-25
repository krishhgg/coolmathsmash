import { ColorMatrixFilter, Container, Graphics, Text } from 'pixi.js';
import { isIntangible } from '../sim/actions/registry';
import { SHIELD_MAX } from '../sim/constants';
import type { FighterState } from '../sim/fighter';
import type { MatchConfig } from '../sim/match';
import { statusDef } from '../sim/statuses';
import type { FighterDef } from '../fighters/types';
import { PORT_COLORS } from './debug/inputDisplay';
import { moveClipFrame } from './rig/timing';
import type { FighterArt } from './rig/types';
import { createRigView, type RigView } from './rig/view';
import { paint } from './vfx/paint';
import { hex } from './vfx/shapes';
import { CRACKED_SHIELD, shieldBubbleShapes } from './vfx/shield';
import type { FighterFx } from './vfx/system';

/**
 * Engine actions drawn with another canonical clip. Everything else plays the clip named after the move while one
 * runs, else after the action (docs/art.md); a name with no clip falls back to idle.
 */
const STAND_INS: Record<string, string> = {
  shieldStun: 'shield',
  downBound: 'down',
  getupRoll: 'techRoll',
};

export function fighterArt(def: FighterDef): FighterArt | undefined {
  return def.art as FighterArt | undefined;
}

/** The clip and clip frame that show `f`; move clips are retimed onto the move's frame data. */
export function clipFor(def: FighterDef, art: FighterArt, f: FighterState): [string, number] {
  const own = f.move ?? f.action;
  const name = art.clips[own] ? own : (STAND_INS[own] ?? 'idle');
  const clip = art.clips[name];
  if (!clip || !f.move || name !== f.move) return [name, f.actionFrame];
  return [name, moveClipFrame(clip, f.actionFrame, def.moves?.[f.move])];
}

/**
 * Each port's palette: the port's `costume` when it names one of the fighter's palettes, else `default`. In a
 * mirror match a port that would wear an earlier port's costume takes the first unused one instead.
 */
export function pickCostumes(
  config: MatchConfig,
  artOf: (fighter: string) => FighterArt | undefined,
): string[] {
  const picks: string[] = [];
  config.ports.forEach((p, port) => {
    const names = Object.keys(artOf(p.fighter)?.palettes ?? { default: {} });
    const wanted = p.costume && names.includes(p.costume) ? p.costume : 'default';
    const used = picks.filter((_, i) => config.ports[i]!.fighter === p.fighter);
    picks[port] = used.includes(wanted) ? (names.find((n) => !used.includes(n)) ?? wanted) : wanted;
  });
  return picks;
}

/** Shield bubble radius: shrinks with shield HP to 15% of full size, and never below zero when HP overshoots. */
export function shieldRadius(def: FighterDef, shieldHp: number): number {
  return Math.max(0, def.stats.shieldSize * ((shieldHp / SHIELD_MAX) * 0.85 + 0.15));
}

/** Badges blink for the last second of a status. */
export const BADGE_BLINK_FRAMES = 60;
const BADGE = 3.2;

/** The badge colours to draw this frame: one per status with a `color`, oldest first, blinking near their end. */
export function statusBadges(f: FighterState, frame: number): string[] {
  return f.statuses.flatMap((s) => {
    const color = statusDef(s.kind).color;
    if (!color || (s.frames <= BADGE_BLINK_FRAMES && frame % 8 >= 4)) return [];
    return [color];
  });
}

/** One fighter: its rig posed from the action and frame, plus shield and debug label. World units, y down. */
export class FighterView {
  readonly container = new Container();
  private readonly body = new Container();
  private readonly art: FighterArt | undefined;
  private readonly rig: RigView | null;
  private readonly shield = new Graphics();
  /** Status badges beside the head (the overhead tag takes the space above it). */
  private readonly badges = new Graphics();
  private readonly shieldColor: string;
  /** The colour flash (smash charge, respawn invincibility); never made in `lite`, where it is the blink instead. */
  private flash: ColorMatrixFilter | null = null;
  private flashing = false;
  /** Height of the head above the feet, in world units; the overhead tag points here. */
  readonly top: number;
  private readonly label = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 22, fill: '#ffffff' },
  });

  /** `lite` (RenderQuality): no filters, so a software renderer never draws the fighter twice. */
  constructor(
    private readonly def: FighterDef,
    port: number,
    costume = 'default',
    private readonly lite = false,
  ) {
    const { height: h, width: w } = def.stats;
    this.art = fighterArt(def);
    this.rig = this.art ? createRigView(this.art, costume) : null;
    this.body.addChild(
      this.rig?.container ??
        new Graphics()
          .roundRect(-w / 2, -h, w, h, w / 2)
          .fill('#ff7a1a')
          .stroke({ color: '#3a1300', width: 0.6 }),
    );
    this.shieldColor = PORT_COLORS[port % PORT_COLORS.length]!;
    this.label.anchor.set(0.5, 1);
    this.label.scale.set(0.12);
    this.top = this.art?.height ?? h;
    this.label.position.set(0, -this.top - 5);
    this.label.visible = false;
    this.container.addChild(this.body, this.shield, this.badges, this.label);
  }

  /** `fx`: the jitter, flash and latest shield hit the effects put on this fighter (src/render/vfx). */
  update(f: FighterState, alpha: number, frame: number, debug: boolean, fx: FighterFx = {}): void {
    const out = f.action === 'ko' || f.action === 'out';
    this.container.visible = !out;
    if (out) return;
    const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
    const y = f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha;
    this.container.position.set(x, -y);
    const jx = fx.jitter?.x ?? 0;
    const jy = -(fx.jitter?.y ?? 0);
    this.body.position.set(jx, jy);
    this.shield.position.set(jx, jy);
    this.body.scale.x = f.facing;
    if (this.rig && this.art) this.rig.pose(...clipFor(this.def, this.art, f), frame);
    const flash = this.lite ? undefined : fx.flash;
    this.body.alpha = !flash && isIntangible(f) && frame % 8 < 4 ? 0.55 : 1;
    const k = flash?.amount ?? 0;
    if (flash && k > 0) {
      this.flash ??= new ColorMatrixFilter();
      const c = flash.color;
      const row = (shift: number, i: 0 | 1 | 2): [number, number, number, number, number] => {
        const w = (2 * k * ((c >> shift) & 255)) / 255;
        const r: [number, number, number, number, number] = [w * 0.3, w * 0.59, w * 0.11, 0, 0];
        r[i] += 1 - k;
        return r;
      };
      this.flash.matrix = [...row(16, 0), ...row(8, 1), ...row(0, 2), 0, 0, 0, 1, 0];
    }
    if (this.flashing !== k > 0) this.body.filters = k > 0 ? [this.flash!] : [];
    this.flashing = k > 0;
    this.shield.clear();
    if (f.action === 'shield' || f.action === 'shieldStun') {
      const cracked = f.shieldHp <= 0;
      const r = cracked ? this.def.stats.shieldSize * CRACKED_SHIELD : shieldRadius(this.def, f.shieldHp);
      if (r > 0)
        paint(
          this.shield,
          shieldBubbleShapes(
            0,
            -this.def.stats.height / 2,
            r,
            hex(this.shieldColor),
            frame,
            fx.shieldHit,
            cracked,
          ),
        );
    }
    this.badges.clear();
    const bx = this.def.stats.width / 2 + 1.2;
    statusBadges(f, frame).forEach((color, i) => {
      const y = -this.top + 0.6 + i * (BADGE + 0.8);
      this.badges
        .roundRect(bx, y, BADGE, BADGE, 0.5)
        .fill(color)
        .stroke({ color: '#ffffff', width: 0.45, alpha: 0.9 });
    });
    this.label.visible = debug;
    if (debug) this.label.text = `${f.move ?? f.action} ${f.actionFrame}`;
  }
}
