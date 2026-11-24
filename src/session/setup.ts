import type { DeviceId } from './devices';
import { fighterCostumes, stageIds } from './roster';

export const RANDOM = 'random';
export const MAX_PLAYERS = 4;
export const CPU_LEVELS = 9;

export type SlotKind = 'human' | 'cpu';

/** One player panel on the character select. Panels are kept in order; P-numbers come from their position. */
export interface SlotSetup {
  kind: SlotKind;
  /** The controller of a human slot. */
  device: DeviceId | null;
  /** CPU level, 1-9. */
  level: number;
  /** A fighter id, RANDOM, or null while still choosing. */
  fighter: string | null;
  /** Palette key from the fighter's art. */
  costume: string;
}

export interface Rules {
  stocks: number;
  /** Time limit in minutes; 0 = none. */
  minutes: number;
  items: boolean;
}

/** Everything chosen before a match: players, stage and rules. It survives rematches and trips back to the menus. */
export interface MatchSetup {
  slots: SlotSetup[];
  /** A stage id or RANDOM. */
  stage: string;
  rules: Rules;
}

export const STOCK_CHOICES = [1, 2, 3, 4, 5, 99];
export const TIME_CHOICES = [0, 2, 3, 4, 5, 6, 7, 8, 10];

export function humanSlot(device: DeviceId): SlotSetup {
  return { kind: 'human', device, level: 3, fighter: null, costume: 'default' };
}

export function cpuSlot(level = 3): SlotSetup {
  return { kind: 'cpu', device: null, level, fighter: RANDOM, costume: 'default' };
}

export function defaultSetup(): MatchSetup {
  return {
    slots: [humanSlot('kb1'), cpuSlot()],
    stage: stageIds()[0] ?? RANDOM,
    rules: { stocks: 3, minutes: 7, items: false },
  };
}

/** Two or more players and every human has picked (CPUs without a pick play a random fighter). */
export function isReady(setup: MatchSetup): boolean {
  return setup.slots.length >= 2 && setup.slots.every((s) => s.kind === 'cpu' || s.fighter !== null);
}

/** The first costume of `fighter` that no other slot playing the same fighter wears, starting from `wanted`. */
export function freeCostume(setup: MatchSetup, slot: number, fighter: string, wanted = 'default'): string {
  const all = fighterCostumes(fighter);
  const taken = new Set(
    setup.slots.filter((s, i) => i !== slot && s.fighter === fighter).map((s) => s.costume),
  );
  const start = Math.max(0, all.indexOf(wanted));
  for (let k = 0; k < all.length; k++) {
    const c = all[(start + k) % all.length]!;
    if (!taken.has(c)) return c;
  }
  return all[start]!;
}

/** Step a slot's costume forwards or backwards through its fighter's palettes, skipping ones others wear. */
export function cycleCostume(setup: MatchSetup, slot: number, step: 1 | -1): void {
  const s = setup.slots[slot];
  if (!s || !s.fighter || s.fighter === RANDOM) return;
  const all = fighterCostumes(s.fighter);
  const taken = new Set(
    setup.slots.filter((o, i) => i !== slot && o.fighter === s.fighter).map((o) => o.costume),
  );
  let i = Math.max(0, all.indexOf(s.costume));
  for (let k = 0; k < all.length; k++) {
    i = (i + step + all.length) % all.length;
    if (!taken.has(all[i]!)) break;
  }
  s.costume = all[i]!;
}

/** Give a slot a fighter (or RANDOM) and a costume nobody else wears on it. */
export function pickFighter(setup: MatchSetup, slot: number, fighter: string): void {
  const s = setup.slots[slot];
  if (!s) return;
  s.fighter = fighter;
  s.costume =
    fighter === RANDOM
      ? 'default'
      : freeCostume(setup, slot, fighter, s.fighter === fighter ? s.costume : 'default');
}
