import { FIGHTERS, getFighter } from '../fighters/registry';
import { STAGES } from '../stages/registry';

/** The parts of a fighter's art the menus use; the full type lives with the rig renderer. */
interface ArtSummary {
  icon?: unknown;
  palettes?: Record<string, Record<string, string>>;
}

const art = (id: string) => getFighter(id).art as ArtSummary | undefined;

/** Every selectable fighter id, in registry order. */
export function fighterIds(): string[] {
  return Object.keys(FIGHTERS);
}

export function stageIds(): string[] {
  return Object.keys(STAGES);
}

/** The head icon SVG a fighter's art ships, if any. */
export function fighterIcon(id: string): string | undefined {
  const icon = art(id)?.icon;
  return typeof icon === 'string' ? icon : undefined;
}

/** Costume (palette) keys, `default` first; fighters without art have just `default`. */
export function fighterCostumes(id: string): string[] {
  const keys = Object.keys(art(id)?.palettes ?? {});
  return ['default', ...keys.filter((k) => k !== 'default')];
}

/** A few representative colours of a costume for its swatch: the palette's first non-black, non-white entries. */
export function costumeColors(id: string, costume: string): string[] {
  const palette = art(id)?.palettes?.[costume];
  if (!palette) return [];
  const colors = Object.values(palette).filter(
    (c) => /^#[0-9a-f]{6}$/i.test(c) && !/^#(000000|ffffff)$/i.test(c),
  );
  return [...new Set(colors)].slice(0, 3);
}
