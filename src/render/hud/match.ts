import { getFighter } from '../../fighters/registry';
import type { MatchState } from '../../sim/match';
import { Hud, type HudOccluder } from './hud';
import type { HudPlayer } from './types';

/** The icon SVG a fighter's art ships (`art.icon`), if any. */
export function fighterIcon(id: string): string | undefined {
  const art = getFighter(id).art as { icon?: unknown } | undefined;
  return typeof art?.icon === 'string' ? art.icon : undefined;
}

/**
 * The bottom damage HUD for a running match. `step` runs after every simulated frame (with the camera) and remembers
 * the frame each fighter last took damage, so the shake and flash depend only on the frames simulated, never on when
 * they were drawn. The first frame it sees of a match is the baseline, so damage set up before the match (harness
 * patches) does not shake.
 */
export class MatchHud {
  readonly hud = new Hud();
  /** Ports driven by a CPU; the match screen sets it so their cards turn grey. */
  cpus: ReadonlySet<number> = new Set();
  private config: unknown = null;
  private damage: number[] = [];
  private hitFrames: number[] = [];

  step(state: MatchState): void {
    if (this.config !== state.config) {
      this.config = state.config;
      this.damage = state.fighters.map((f) => f.damage);
      this.hitFrames = state.fighters.map(() => -1);
      return;
    }
    state.fighters.forEach((f, i) => {
      if (f.damage > (this.damage[i] ?? 0)) this.hitFrames[i] = state.frame;
      this.damage[i] = f.damage;
    });
  }

  players(state: MatchState): HudPlayer[] {
    const fresh = this.config !== state.config;
    return state.fighters.map((f, i) => ({
      port: f.port,
      name: getFighter(f.fighter).name,
      damage: f.damage,
      stocks: f.stocks,
      maxStocks: state.config.stocks,
      icon: fighterIcon(f.fighter),
      eliminated: f.action === 'out',
      cpu: this.cpus.has(i),
      hitFrame: fresh ? -1 : (this.hitFrames[i] ?? -1),
    }));
  }

  update(state: MatchState, occluders: readonly HudOccluder[]): void {
    this.hud.update(this.players(state), state.frame, occluders);
  }
}
