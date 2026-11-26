import { ColorMatrixFilter, Container, Graphics, Text } from 'pixi.js';
import { airDodgeFaf } from '../sim/actions/air';
import { isIntangible } from '../sim/actions/registry';
import { AIR_DODGE_DIRECTIONAL, AIR_DODGE_NEUTRAL, LEDGE_JUMP, SHIELD_MAX } from '../sim/constants';
import type { FighterState } from '../sim/fighter';
import { inFinalSmash } from '../sim/finalSmash';
import type { MatchConfig } from '../sim/match';
import { statusDef } from '../sim/statuses';
import type { FighterDef } from '../fighters/types';
import { PORT_COLORS } from './debug/inputDisplay';
import { drawFinalGlow } from './items';
import { moveClipFrame } from './rig/timing';
import type { AnimClip, FighterArt } from './rig/types';
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
  dizzyWake: 'dizzy',
};

/** The clip each roll action draws when it rolls away from the fighter's facing (backRoll). */
export const BACK_ROLLS: Record<string, string> = { techRoll: 'techRollBack', getupRoll: 'getupRollBack' };

/**
 * A tether's reel and hang keep the move's name and play on its clip (clipFor), unless the art has a clip named
 * after the action: that plays from the reel's own first frame instead (Red Ball's tongue reel).
 */
const REEL_ACTIONS = new Set(['tetherPull', 'tetherHang']);

export function fighterArt(def: FighterDef): FighterArt | undefined {
  return def.art as FighterArt | undefined;
}

/**
 * Tech roll and getup roll travel along `dodgeDir` and keep the fighter's facing, so one away from the facing is a
 * back roll. A back roll draws the fighter's `techRollBack` or `getupRollBack`, else its `rollBack`.
 */
function backRoll(art: FighterArt, f: FighterState): string | undefined {
  const back = BACK_ROLLS[f.action];
  if (!back || f.dodgeDir.x * f.facing >= 0) return undefined;
  return art.clips[back] ? back : art.clips.rollBack ? 'rollBack' : undefined;
}

/**
 * The move frame `f` is drawn on. A tether's reel keeps the move but restarts the action frame, so tetherPull
 * counts on from the move frame the line anchored on, and tetherHang holds the move frame the reel arrived on.
 */
function moveFrame(f: FighterState): number {
  const from = f.tether?.moveFrame;
  if (from === undefined) return f.actionFrame;
  if (f.action === 'tetherPull') return from + f.actionFrame - 1;
  if (f.action === 'tetherHang') return from;
  return f.actionFrame;
}

/** The clip that draws `move`'s charge, `<move>Charge`, when the art has one (docs/art.md). */
export function chargeClipName(art: FighterArt | undefined, move: string): string | undefined {
  const name = `${move}Charge`;
  return art?.clips[name] ? name : undefined;
}

/**
 * The clip frame an air dodge draws. The clip is drawn over the neutral dodge (AIR_DODGE_NEUTRAL.faf - 1 frames)
 * and plays frame for frame on one. A directional dodge is intangible for fewer frames and lasts longer, so its
 * intangible window maps onto the neutral one and its last frame onto the clip's end, piecewise linearly: the twist
 * plays a little faster and the recovery after it slows to fill the rest of the dodge.
 */
function airDodgeFrame(clip: AnimClip, f: FighterState): number {
  if (f.dodgeDir.x === 0 && f.dodgeDir.y === 0) return f.actionFrame;
  const knots: [number, number][] = [
    [0, 0],
    [AIR_DODGE_DIRECTIONAL.intangible[0], AIR_DODGE_NEUTRAL.intangible[0]],
    [AIR_DODGE_DIRECTIONAL.intangible[1], AIR_DODGE_NEUTRAL.intangible[1]],
    [airDodgeFaf(f.dodgeDir) - 1, clip.length],
  ];
  const t = Math.min(f.actionFrame, knots[knots.length - 1]![0]);
  let i = 1;
  while (knots[i]![0] < t) i++;
  const [x0, y0] = knots[i - 1]!;
  const [x1, y1] = knots[i]!;
  return y0 + ((t - x0) * (y1 - y0)) / (x1 - x0);
}

/**
 * The clip a status on `f` draws it in (StatusDef.clip), newest status first, on the status's own frames: Runner's
 * Tunnel Flip leaves its victims dazed in their `dizzy` clip. Undefined when no status names a clip the art has.
 */
export function statusClip(art: FighterArt, f: FighterState): [string, number] | undefined {
  for (let i = f.statuses.length - 1; i >= 0; i--) {
    const s = f.statuses[i]!;
    const clip = statusDef(s.kind).clip;
    const name = clip && (f.ground ? clip.ground : (clip.air ?? clip.ground));
    if (name && art.clips[name]) return [name, s.age];
  }
  return undefined;
}

/**
 * The clip and clip frame that show `f`; a status that names a clip shows it first (statusClip). move clips are retimed onto the move's frame data. A tech or getup roll
 * away from the facing draws a back roll (backRoll). A tether move's clip plays on through the reel, held on the
 * clip's `reel` frame (AnimClip.reel) until the fighter arrives, unless the art has its own clip for the reel
 * (REEL_ACTIONS). A move waiting on its charge frame plays the art's charge clip, if it has one, on the frames
 * charged so far.
 */
export function clipFor(def: FighterDef, art: FighterArt, f: FighterState): [string, number] {
  const held = statusClip(art, f);
  if (held) return held;
  const hold = f.move ? def.moves?.[f.move]?.charge : undefined;
  const charging = hold !== undefined && f.charge > 0 && f.actionFrame === hold - 1;
  const charge = charging ? chargeClipName(art, f.move!) : undefined;
  if (charge) return [charge, f.charge];
  // After the rise over the corner a ledge jump is a jump the sim holds without air options until its FAF: draw
  // the jump clip from the frame the jump began, and the jump action carries on from there.
  if (f.action === 'ledgeJump' && f.actionFrame > LEDGE_JUMP.rise && art.clips.jump)
    return ['jump', f.actionFrame - LEDGE_JUMP.rise];
  const reeling = REEL_ACTIONS.has(f.action);
  const own = f.move && !(reeling && art.clips[f.action]) ? f.move : (backRoll(art, f) ?? f.action);
  const name = art.clips[own] ? own : (STAND_INS[own] ?? 'idle');
  const clip = art.clips[name];
  if (clip && f.action === 'airDodge' && name === 'airDodge') return [name, airDodgeFrame(clip, f)];
  if (!clip || !f.move || name !== f.move) return [name, f.actionFrame];
  const frame = moveClipFrame(clip, moveFrame(f), def.moves?.[f.move]);
  return [name, reeling && clip.reel !== undefined ? Math.min(frame, clip.reel) : frame];
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

/** Frames the parry flash lasts (render only; Ultimate shows a bright flash on the parrying fighter). */
export const PARRY_FLASH_FRAMES = 12;

/**
 * Whether `f`'s body is dimmed on `frame` by the intangibility blink: every few frames while intangible, except through
 * a Final Smash, whose user is intangible on every frame and which Ultimate draws without flashing.
 */
export const intangibleBlink = (f: Readonly<FighterState>, frame: number): boolean =>
  isIntangible(f) && !inFinalSmash(f) && frame % 8 < 4;

/** One fighter: its rig posed from the action and frame, plus shield and debug label. World units, y down. */
export class FighterView {
  readonly container = new Container();
  private readonly body = new Container();
  /**
   * The rig's `under` slots (Slot.under), placed, mirrored and blinked with the body: the renderer draws it in a layer
   * under every fighter.
   */
  readonly under = new Container();
  private readonly underBody = new Container();
  private readonly art: FighterArt | undefined;
  private readonly rig: RigView | null;
  private readonly shield = new Graphics();
  /** The rainbow aura of a fighter holding a Final Smash charge (FighterState.finalReady). */
  private readonly glow = new Graphics();
  /** Status badges beside the head (the overhead tag takes the space above it). */
  private readonly badges = new Graphics();
  private readonly shieldColor: string;
  /** The colour flash (smash charge, respawn invincibility); never made in `lite`, where it is the blink instead. */
  private flash: ColorMatrixFilter | null = null;
  private flashing = false;
  /** The parry burst over the body. */
  private readonly parryFlash = new Graphics({ blendMode: 'add' });
  /** Match frame of this fighter's last parry (render state only). */
  private parryAt = -Infinity;
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
    this.container.addChild(this.glow, this.body, this.shield, this.parryFlash, this.badges, this.label);
    if (this.rig) this.underBody.addChild(this.rig.under);
    this.under.addChild(this.underBody);
  }

  /** Start the parry flash; `frame` is the match frame after the parry. */
  parried(frame: number): void {
    this.parryAt = frame;
  }

  /** `fx`: the jitter, flash and latest shield hit the effects put on this fighter (src/render/vfx). */
  update(f: FighterState, alpha: number, frame: number, debug: boolean, fx: FighterFx = {}): void {
    const out = f.action === 'ko' || f.action === 'out';
    this.container.visible = this.under.visible = !out;
    if (out) return;
    const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
    const y = f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha;
    this.container.position.set(x, -y);
    this.under.position.set(x, -y);
    const jx = fx.jitter?.x ?? 0;
    const jy = -(fx.jitter?.y ?? 0);
    this.body.position.set(jx, jy);
    this.underBody.position.set(jx, jy);
    this.shield.position.set(jx, jy);
    this.body.scale.x = this.underBody.scale.x = f.facing;
    if (this.rig && this.art) this.rig.pose(...clipFor(this.def, this.art, f), frame);
    const flash = this.lite ? undefined : fx.flash;
    this.body.alpha = this.underBody.alpha = !flash && intangibleBlink(f, frame) ? 0.55 : 1;
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
    this.glow.clear();
    this.glow.position.set(jx, jy);
    if (f.finalReady) drawFinalGlow(this.glow, this.def.stats.width, this.top, frame);
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
    this.drawParryFlash(frame - this.parryAt);
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

  /** A white burst and a pale yellow ring around the body, fading out over PARRY_FLASH_FRAMES. */
  private drawParryFlash(t: number): void {
    this.parryFlash.clear();
    if (t < 0 || t >= PARRY_FLASH_FRAMES) return;
    const k = t / PARRY_FLASH_FRAMES;
    const fade = (1 - k) * (1 - k);
    const r = this.def.stats.shieldSize;
    const y = -this.def.stats.height / 2;
    this.parryFlash.circle(0, y, r * (1.1 - 0.3 * k)).fill({ color: '#ffffff', alpha: 0.85 * fade });
    this.parryFlash.circle(0, y, r * (1.1 + 0.9 * k)).stroke({ color: '#fff3a8', width: 1.4, alpha: fade });
  }
}
