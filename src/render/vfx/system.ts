import { getFighter } from '../../fighters/registry';
import type { FighterState } from '../../sim/fighter';
import type { MatchState } from '../../sim/match';
import { HALO_FADE_LIFE, type HaloFade } from './extras';
import { spawnHitSpark, type HitSpark } from './hitSpark';
import { KO_LIFE, spawnKoBlast, type KoBlast } from './koBlast';
import { spawnShake, type Shake } from './shake';
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
  shakes: Shake[];
  halos: HaloFade[];
}

export const emptyVfx = (): VfxState => ({
  frame: -1,
  sparks: [],
  puffs: [],
  shields: [],
  kos: [],
  shakes: [],
  halos: [],
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
  v.shakes = v.shakes.filter((s) => frame - s.frame < s.life);
  v.halos = v.halos.filter((h) => frame - h.frame < HALO_FADE_LIFE);

  for (const e of m.events) {
    switch (e.type) {
      case 'hit': {
        const a = m.fighters[e.attacker]!;
        const victim = m.fighters[e.victim]!;
        const dir = victim.launch?.dir ?? ((Math.sign(victim.pos.x - a.pos.x) || a.facing) as 1 | -1);
        const spark = spawnHitSpark(e, frame, dir);
        v.sparks.push(spark);
        if (e.tumble) v.shakes.push(spawnShake(frame, e.victim, 3 + 7 * spark.power, 10));
        break;
      }
      case 'shieldHit': {
        const side = Math.sign(m.fighters[e.victim]!.pos.x - m.fighters[e.attacker]!.pos.x) || 1;
        v.sparks.push(
          spawnHitSpark(
            { ...e, kb: 0, damage: e.damage * 0.5, effect: 'normal' },
            frame,
            side as 1 | -1,
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
        v.shakes.push(spawnShake(frame, e.port, 7, 14));
        break;
      }
      case 'ko':
        v.kos.push(spawnKoBlast(e.port, frame, e.x, e.y));
        v.shakes.push(spawnShake(frame, e.port, 16, 34));
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

/** The latest shield hit on `port` still flashing at `v`'s frame: frames since it landed and its strength. */
export function shieldPulse(v: VfxState, port: number): { age: number; power: number } | undefined {
  for (let i = v.shields.length - 1; i >= 0; i--) {
    const b = v.shields[i]!;
    if (b.kind === 'hit' && b.port === port) return { age: v.frame - b.frame, power: b.power };
  }
  return undefined;
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
