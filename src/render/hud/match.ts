import { getFighter } from '../../fighters/registry';
import type { MatchState } from '../../sim/match';
import { recolorIcon } from '../rig/svg';
import type { FighterArt } from '../rig/types';
import { Hud, type HudOccluder } from './hud';
import type { HudPlayer } from './types';

const costumeIcons = new WeakMap<FighterArt, Map<string, string>>();

/** The icon SVG a fighter's art ships, repainted for the selected costume. */
export function fighterIcon(id: string, costume = 'default'): string | undefined {
  const art = getFighter(id).art as FighterArt | undefined;
  if (typeof art?.icon !== 'string') return undefined;
  const palette = art.palettes?.[costume];
  if (costume === 'default' || !palette) return art.icon;
  let colors = costumeIcons.get(art);
  if (!colors) costumeIcons.set(art, (colors = new Map<string, string>()));
  let icon = colors.get(costume);
  if (icon === undefined) {
    icon = recolorIcon(art.icon, art.palettes.default, palette);
    colors.set(costume, icon);
  }
  return icon;
}

/**
 * The bottom damage HUD for a running match. `step` runs after every simulated frame (with the camera) and remembers
 * the frame each fighter last took damage, so the shake and flash depend only on the frames simulated, never on when
 * they were drawn. The first frame it sees of a match is the baseline, so damage set up before the match (harness
 * patches) does not shake.
 */
export class MatchHud {
  readonly hud = new Hud();
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

  players(state: MatchState, costumes: readonly string[] = []): HudPlayer[] {
    const fresh = this.config !== state.config;
    return state.fighters.map((f, i) => ({
      port: f.port,
      name: getFighter(f.fighter).name,
      damage: f.damage,
      stocks: f.stocks,
      maxStocks: state.config.stocks,
      icon: fighterIcon(f.fighter, costumes[f.port] ?? state.config.ports[f.port]?.costume),
      eliminated: f.action === 'out',
      hitFrame: fresh ? -1 : (this.hitFrames[i] ?? -1),
    }));
  }

  update(state: MatchState, occluders: readonly HudOccluder[], costumes: readonly string[]): void {
    this.hud.update(this.players(state, costumes), state.frame, occluders);
  }
}
