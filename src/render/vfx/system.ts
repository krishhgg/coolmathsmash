import { getFighter } from '../../fighters/registry';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { HALO_FADE_LIFE, type HaloFade } from './extras';
import { freezesFrom, hitlagOffset, type Freeze } from './hitlag';
import { spawnHitSpark, type HitSpark } from './hitSpark';
import { KO_LIFE, spawnKoBlast, type KoBlast } from './koBlast';
import { shieldLife, spawnShieldBreak, spawnShieldHit, type ShieldBurst } from './shield';
import { dustPuffs, trailPuffs, type Puff } from './smoke';

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

/**
 * Advance `v` to the frame `m` just simulated: drop effects past their lifetime, then spawn this frame's from its
 * events (hits, shield hits and breaks, KOs, jumps, landings, leaving the respawn platform) and from launched
 * fighters (smoke along the stretch of path they covered this frame).
 */
export function stepVfx(v: VfxState, m: MatchState): void {
  const frame = m.frame;
  v.frame = frame;
  v.sparks = v.sparks.filter((s) => frame - s.frame < s.life);
  v.puffs = v.puffs.filter((p) => frame - p.born < p.life);
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
        const away = m.fighters[e.victim]!.pos.x >= m.fighters[e.attacker]!.pos.x ? 0 : Math.PI;
        v.sparks.push(
          spawnHitSpark({ ...e, kb: 0, damage: e.damage * 0.5, effect: 'normal' }, frame, away, 'shield'),
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
        break;
      case 'jump': {
        const f = m.fighters[e.port]!;
        if (e.kind === 'air') v.puffs.push(...dustPuffs(f.pos.x, f.pos.y - 1, frame, e.port, 1, 0.3, 1.6));
        else v.puffs.push(...dustPuffs(f.pos.x, f.pos.y, frame, e.port, e.kind === 'full' ? 3 : 2, 0.5, 1.6));
        break;
      }
      case 'land': {
        const f = m.fighters[e.port]!;
        v.puffs.push(...dustPuffs(f.pos.x, f.pos.y, frame, e.port, e.lag > 4 ? 3 : 2, 0.7, 1.7));
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

/** Effects drawn on a fighter itself: its hitlag jitter (world units, y up) and the latest hit on its shield. */
export interface FighterFx {
  jitter?: { x: number; y: number };
  shieldHit?: { age: number; power: number };
}

export function fighterFx(v: VfxState, f: FighterState, frame: number): FighterFx {
  return { jitter: hitlagOffset(f, frame, freezeOf(v, f.port)), shieldHit: shieldPulse(v, f.port) };
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
