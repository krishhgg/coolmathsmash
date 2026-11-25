import { FIGHTERS, getFighter } from '../fighters/registry';
import { STAGES } from '../stages/registry';

/** The parts of a fighter's art the menus use; the full type lives with the rig renderer. */
interface ArtSummary {
  icon?: unknown;
  palettes?: Record<string, Record<string, string>>;
}

const art = (id: string) => getFighter(id).art as ArtSummary | undefined;

/** The planned roster (handoffs/research/roster.md) in select-screen order, built or not. */
export const PLANNED_ROSTER: readonly string[] = [
  'Papa Louie',
  'Fireboy & Watergirl',
  'Runner',
  'Bob the Robber',
  'Snail Bob',
  'Red Ball',
  'The Duck',
  'Fluffy',
  'Raft Wars kids',
  'Bloxorz block',
  'Johnny Upgrade',
  'Wheely',
];

/** A portrait on the select grid: a registered fighter, or a planned one nobody has built yet (`id` null). */
export interface RosterTile {
  id: string | null;
  name: string;
}

const nameKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\s*the\s+/, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * The select grid: each planned character in order, as the registered fighters that play it (a fighter plays an
 * entry, or one of its "&" names, when its name or id starts that name: Fireboy and Watergirl both sit under theirs,
 * "Bloxorz" plays "Bloxorz block"), a locked tile where none does yet, then registered fighters outside the plan.
 * Forms reached only in a match (`selectable: false`, like Watergirl from Fireboy's down special) get no tile.
 */
export function rosterTiles(
  registered: readonly { id: string; name: string; selectable?: boolean }[] = Object.values(FIGHTERS),
): RosterTile[] {
  const fighters = registered.filter((f) => f.selectable !== false);
  const placed = new Set<string>();
  const tiles: RosterTile[] = [];
  for (const entry of PLANNED_ROSTER) {
    const before = tiles.length;
    for (const part of entry.split('&').map(nameKey)) {
      for (const f of fighters) {
        if (placed.has(f.id) || ![f.name, f.id].some((n) => nameKey(n) !== '' && part.startsWith(nameKey(n))))
          continue;
        placed.add(f.id);
        tiles.push({ id: f.id, name: f.name });
      }
    }
    if (tiles.length === before) tiles.push({ id: null, name: entry });
  }
  return [...tiles, ...fighters.filter((f) => !placed.has(f.id)).map((f) => ({ id: f.id, name: f.name }))];
}

/** Every fighter a player can pick, in registry order; forms reached only in a match are left out. */
export function selectableFighterIds(): string[] {
  return Object.values(FIGHTERS)
    .filter((f) => f.selectable !== false)
    .map((f) => f.id);
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
