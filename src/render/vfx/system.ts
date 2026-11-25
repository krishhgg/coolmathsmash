import { getFighter } from '../../fighters/registry';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { HALO_FADE_LIFE, type HaloFade } from './extras';
import { freezesFrom, hitlagOffset, shieldFreezes, type Freeze } from './hitlag';
import { spawnHitSpark, type HitSpark } from './hitSpark';
import { KO_LIFE, spawnKoBlast, type KoBlast } from './koBlast';
import { shieldLife, spawnShieldBreak, spawnShieldHit, type ShieldBurst } from './shield';
import { dustPuffs, TRAIL_CUT, trailPuffs, type Puff } from './smoke';

/**
 * Every live effect, as plain spawn records. Each record's look is a pure function of the record and the frame
 * being drawn, so the effects at frame N depend only on the frames simulated up to N.
 */
export interface VfxState {
  /** The last frame stepped (-1 before the first). */
  frame: number;
  sparks: HitSpark[];
  puffs: Puff[];
  shields: ShieldBurst[];
  kos: KoBlast[];
  halos: HaloFade[];
  freezes: Freeze[];
}

export const emptyVfx = (): VfxState => ({
  frame: -1,
  sparks: [],
  puffs: [],
  shields: [],
  kos: [],
  halos: [],
  freezes: [],
});

const height = (f: FighterState): number => getFighter(f.fighter).stats.height;

/** Is `f` holding a smash attack's charge (charged some frames and not yet past the move's charge frame)? */
export function charging(f: FighterState): boolean {
  if (!f.move || f.charge <= 0) return false;
  const at = getFighter(f.fighter).moves?.[f.move]?.charge;
  return at !== undefined && f.actionFrame < at;
}

/** Frames since `f` let go of a charged smash attack (it charged and is past the charge frame), else undefined. */
export function chargeReleased(f: FighterState): number | undefined {
  if (!f.move || f.charge <= 0) return undefined;
  const at = getFighter(f.fighter).moves?.[f.move]?.charge;
  return at !== undefined && f.actionFrame >= at ? f.actionFrame - at : undefined;
}

/**
 * Advance `v` to the frame `m` just simulated: drop effects past their lifetime, then spawn this frame's from its
 * events (hits, shield hits and breaks, KOs, jumps, landings, leaving the respawn platform) and from launched
 * fighters (smoke along the stretch of path they covered this frame).
 */
export function stepVfx(v: VfxState, m: MatchState): void {
  const frame = m.frame;
  v.frame = frame;
  v.sparks = v.sparks.filter((s) => frame - s.frame < s.life);
  v.puffs = v.puffs.filter(
    (p) => frame - p.born < p.life && (p.cut === undefined || frame - p.cut < TRAIL_CUT),
  );
  v.shields = v.shields.filter((b) => frame - b.frame < shieldLife(b));
  v.kos = v.kos.filter((k) => frame - k.frame < KO_LIFE);
  v.halos = v.halos.filter((h) => frame - h.frame < HALO_FADE_LIFE);
  v.freezes = v.freezes.filter((z) => frame - z.frame < z.lag);

  for (const e of m.events) {
    switch (e.type) {
      case 'hit': {
        const freezes = freezesFrom(e, m, frame);
        v.freezes.push(...freezes);
        v.sparks.push(spawnHitSpark(e, frame, Math.atan2(-freezes[0]!.ay, freezes[0]!.ax)));
        break;
      }
      case 'shieldHit': {
        const freezes = shieldFreezes(e, m, frame);
        v.freezes.push(...freezes);
        v.sparks.push(
          spawnHitSpark(
            { ...e, kb: 0, damage: e.damage * 0.5, effect: 'normal' },
            frame,
            freezes[0]!.ax > 0 ? 0 : Math.PI,
            'shield',
          ),
        );
        v.shields.push(spawnShieldHit(e.victim, frame, e.damage));
        break;
      }
      case 'shieldBreak': {
        const f = m.fighters[e.port]!;
        const r = getFighter(f.fighter).stats.shieldSize;
        v.shields.push(spawnShieldBreak(e.port, frame, f.pos.x, f.pos.y + height(f) / 2, r));
        break;
      }
      case 'ko':
        v.kos.push(spawnKoBlast(e.port, frame, e.x, e.y));
        for (const p of v.puffs) if (p.port === e.port && p.tone === 'smoke') p.cut = frame;
        break;
      case 'jump': {
        const f = m.fighters[e.port]!;
        if (e.kind === 'air') v.puffs.push(...dustPuffs(f.pos.x, f.pos.y - 1, frame, e.port, 1, 0.3, 1.6));
        else v.puffs.push(...dustPuffs(f.pos.x, f.pos.y, frame, e.port, e.kind === 'full' ? 3 : 2, 0.5, 1.6));
        break;
      }
      case 'land': {
        const f = m.fighters[e.port]!;
        v.puffs.push(...dustPuffs(f.pos.x, f.pos.y, frame, e.port, 3, e.lag > 4 ? 0.6 : 0.45, 1.6));
        break;
      }
      case 'action':
        if (e.from === 'respawn') {
          const f = m.fighters[e.port]!;
          v.halos.push({ frame, port: e.port, x: f.pos.x, y: f.pos.y });
        }
        break;
      default:
        break;
    }
  }
  for (const f of m.fighters) v.puffs.push(...trailPuffs(f, height(f) / 2, frame));
}

/** The hit that froze `port` most recently, while its hitlag may still be running. */
export function freezeOf(v: VfxState, port: number): Freeze | undefined {
  for (let i = v.freezes.length - 1; i >= 0; i--) if (v.freezes[i]!.port === port) return v.freezes[i];
  return undefined;
}

/** The latest shield hit on `port` still flashing at `v`'s frame: frames since it landed and its strength. */
export function shieldPulse(v: VfxState, port: number): { age: number; power: number } | undefined {
  for (let i = v.shields.length - 1; i >= 0; i--) {
    const b = v.shields[i]!;
    if (b.kind === 'hit' && b.port === port) return { age: v.frame - b.frame, power: b.power };
  }
  return undefined;
}

/**
 * Effects drawn on a fighter itself: its hitlag (or smash-charge) jitter in world units, y up; the latest hit on its
 * shield; and a flash toward `color` by `amount` (0 to 1, weighted by brightness so outlines stay dark), which
 * replaces the plain intangibility blink.
 */
export interface FighterFx {
  jitter?: { x: number; y: number };
  shieldHit?: { age: number; power: number };
  flash?: { color: number; amount: number };
}

/** Smash charge: the fighter flashes pale gold, faster as the charge builds (every 8 frames, down to every 4). */
const CHARGE_FLASH = 0xfff4b0;
const CHARGE_JITTER = 0.15;

export function fighterFx(v: VfxState, f: FighterState, frame: number): FighterFx {
  const fx: FighterFx = {
    jitter: hitlagOffset(f, frame, freezeOf(v, f.port)),
    shieldHit: shieldPulse(v, f.port),
  };
  if (charging(f)) {
    const period = Math.round(8 - 4 * Math.min(1, f.charge / 60));
    fx.flash = { color: CHARGE_FLASH, amount: frame % period < (period >= 6 ? 2 : 1) ? 0.5 : 0 };
    fx.jitter = { x: fx.jitter!.x + (frame % 2 ? -CHARGE_JITTER : CHARGE_JITTER), y: fx.jitter!.y };
  } else if (f.action === 'respawn' || f.intangible > 0) {
    fx.flash = { color: 0xffffff, amount: frame % 6 < 2 ? 0.7 : 0 };
  }
  return fx;
}

/**
 * The effects of one match, stepped once after every simulated frame (Renderer.stepCamera). A new match, or a frame
 * that does not follow the last one, starts from no effects, so a frame looks the same however it was reached.
 */
export class Vfx {
  state = emptyVfx();
  private match: unknown = null;

  step(m: MatchState): void {
    if (m.config !== this.match || m.frame !== this.state.frame + 1) {
      this.state = emptyVfx();
      this.match = m.config;
    }
    stepVfx(this.state, m);
  }

  /** The effects to draw with `m`: the stepped effects once they are at m's frame, else none. */
  at(m: MatchState): VfxState | null {
    return this.match === m.config && this.state.frame === m.frame ? this.state : null;
  }
}
